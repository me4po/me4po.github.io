// 评论公开接口：GET 取已审核评论，POST 提交新评论（进入待审）
// PRD v1.2 · CM-05（Pages Functions + D1）· D-11 先审后发 · C-12 失败不阻塞正文

// 注意：本文件在 functions/api/ 下，lib 在 functions/lib/，相对路径是 "../lib/"
// （functions/api/comments/ 下的文件才是 "../../lib/"）
import { hitSensitive } from '../lib/words.js';

const MAX_LEN = 1000;
const MIN_LEN = 2;
const LIMIT_PER_MINUTE = 3;
const LIMIT_PER_DAY = 20;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function clientKey(request) {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for') ||
    'unknown'
  ) + '|' + (request.headers.get('user-agent') || 'unknown');
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!env.DB) return json({ comments: [], error: 'DB not bound' }, 500);

  const url = new URL(request.url);
  const slug = (url.searchParams.get('slug') || '').slice(0, 200);
  if (!slug) return json({ comments: [], error: 'missing slug' }, 400);

  const pageSize = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

  try {
    const rs = await env.DB.prepare(
      `SELECT id, slug, parent_id, nickname, content, is_admin, created_at
       FROM comments
       WHERE slug = ? AND status = 'approved'
       ORDER BY created_at ASC
       LIMIT ?`
    )
      .bind(slug, pageSize)
      .all();

    // NFR-016：email / ua_hash 永不出现在公开响应里。
    // 不依赖 SQL 的列名——显式投影，避免以后有人改成 SELECT * 就泄了隐私。
    const safe = (rs.results || []).map((r) => ({
      id: r.id,
      slug: r.slug,
      parent_id: r.parent_id ?? null,
      nickname: r.nickname,
      content: r.content,
      is_admin: r.is_admin ? 1 : 0,
      created_at: r.created_at
    }));

    return json({ comments: safe });
  } catch (e) {
    return json({ comments: [], error: 'query failed' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!env.DB) return json({ error: 'DB not bound' }, 500);

  let payload;
  try {
    payload = await request.json();
  } catch (e) {
    return json({ error: 'invalid json' }, 400);
  }

  const slug = String(payload.slug || '').slice(0, 200);
  const content = String(payload.content || '').trim();
  const nickname = String(payload.nickname || '').trim().slice(0, 24);
  const email = String(payload.email || '').trim().slice(0, 64);
  const parentId = payload.parent_id ? String(payload.parent_id).slice(0, 64) : null;

  if (!slug) return json({ error: 'missing slug' }, 400);
  if (content.length < MIN_LEN || content.length > MAX_LEN) {
    return json({ error: `内容长度需在 ${MIN_LEN} 到 ${MAX_LEN} 字之间` }, 400);
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: '邮箱格式不正确' }, 400);
  }

  const now = Date.now();
  const uaHash = await sha256(clientKey(request));

  // 限流（7.4）
  const minute = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM comments WHERE ua_hash = ? AND created_at > ?`
  )
    .bind(uaHash, now - 60 * 1000)
    .first();
  if ((minute && minute.c >= LIMIT_PER_MINUTE)) {
    return json({ error: '提交太频繁了，请稍后再试' }, 429);
  }

  const day = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM comments WHERE ua_hash = ? AND created_at > ?`
  )
    .bind(uaHash, now - 24 * 60 * 60 * 1000)
    .first();
  if (day && day.c >= LIMIT_PER_DAY) {
    return json({ error: '今天的提交次数已达上限' }, 429);
  }

  // 父评论必须存在且已发布（D-12 最多两级）
  let parent = null;
  if (parentId) {
    parent = await env.DB.prepare(
      `SELECT id, parent_id FROM comments WHERE id = ? AND status = 'approved'`
    )
      .bind(parentId)
      .first();
    if (!parent) return json({ error: '被回复的评论不存在' }, 400);
  }

  const flagged = hitSensitive(content) ? 1 : 0;

  const id = crypto.randomUUID();
  // D-12：回复层级最多两级——父评论若有父，则挂到其父上
  const finalParent = parent && parent.parent_id ? parent.parent_id : parentId;

  await env.DB.prepare(
    `INSERT INTO comments (id, slug, parent_id, nickname, email, content, status, is_admin, created_at, ua_hash, flagged)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', 0, ?, ?, ?)`
  )
    .bind(id, slug, finalParent, nickname || '', email, content, now, uaHash, flagged)
    .run();

  return json({ ok: true, id, pending: true }, 201);
}
