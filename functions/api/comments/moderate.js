// 审核接口（鉴权）：GET 取待审队列，POST 放行 / 删除 / 回复
// PRD v1.2 · SOP-08

import { authorized, unauthorized } from '../../lib/auth.js';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!authorized(request, env)) return unauthorized();
  if (!env.DB) return json({ error: 'DB not bound' }, 500);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10) || 50, 200);

  const rs = await env.DB.prepare(
    `SELECT id, slug, parent_id, nickname, email, content, status, is_admin, flagged, created_at
     FROM comments WHERE status = ? ORDER BY created_at DESC LIMIT ?`
  )
    .bind(status, limit)
    .all();

  return json({ comments: rs.results || [] });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!authorized(request, env)) return unauthorized();
  if (!env.DB) return json({ error: 'DB not bound' }, 500);

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'invalid json' }, 400);
  }

  const action = body.action;
  const id = String(body.id || '');

  if (action === 'approve' || action === 'delete') {
    if (!id) return json({ error: 'missing id' }, 400);
    const newStatus = action === 'approve' ? 'approved' : 'deleted';
    await env.DB.prepare(`UPDATE comments SET status = ? WHERE id = ?`)
      .bind(newStatus, id)
      .run();
    return json({ ok: true, id, status: newStatus });
  }

  if (action === 'reply') {
    const slug = String(body.slug || '');
    const content = String(body.content || '').trim();
    if (!slug || content.length < 1 || content.length > 1000) {
      return json({ error: 'slug 与 content 必填，content ≤ 1000 字' }, 400);
    }
    const target = id
      ? await env.DB.prepare(`SELECT id, parent_id FROM comments WHERE id = ?`).bind(id).first()
      : null;
    if (id && !target) return json({ error: '被回复的评论不存在' }, 404);

    const replyId = crypto.randomUUID();
    const finalParent = target && target.parent_id ? target.parent_id : id;

    await env.DB.prepare(
      `INSERT INTO comments (id, slug, parent_id, nickname, email, content, status, is_admin, created_at, ua_hash, flagged)
       VALUES (?, ?, ?, ?, '', ?, 'approved', 1, ?, 'admin', 0)`
    )
      .bind(replyId, slug, finalParent, body.nickname ? String(body.nickname).slice(0, 24) : '站长', content, Date.now())
      .run();

    return json({ ok: true, id: replyId }, 201);
  }

  return json({ error: 'unknown action' }, 400);
}
