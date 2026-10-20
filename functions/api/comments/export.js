// 评论导出（鉴权）：?format=json|csv   —— C-10 / NFR-008

import { authorized, unauthorized } from '../../lib/auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!authorized(request, env)) return unauthorized();
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'DB not bound' }), {
      status: 500,
      headers: { 'content-type': 'application/json; charset=utf-8' }
    });
  }

  const fmt = (new URL(request.url).searchParams.get('format') || 'json').toLowerCase();
  const rs = await env.DB.prepare(
    `SELECT id, slug, parent_id, nickname, email, content, status, is_admin, flagged, created_at
     FROM comments ORDER BY created_at ASC`
  ).all();
  const rows = rs.results || [];

  if (fmt === 'csv') {
    const head = 'id,slug,parent_id,nickname,email,content,status,is_admin,flagged,created_at';
    const esc = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [head].concat(rows.map((r) => [
      r.id, r.slug, r.parent_id, r.nickname, r.email, r.content, r.status, r.is_admin, r.flagged, r.created_at
    ].map(esc).join(','))).join('\n');

    return new Response(csv, {
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': 'attachment; filename="comments.csv"'
      }
    });
  }

  return new Response(JSON.stringify({ count: rows.length, comments: rows }, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="comments.json"'
    }
  });
}
