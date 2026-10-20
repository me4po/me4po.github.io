// 管理端鉴权（NFR-005：审核入口不得无鉴权暴露）
// token 从环境变量 COMMENT_ADMIN_TOKEN 读取，在 Cloudflare Pages 控制台配置。

export function readToken(request) {
  const header = request.headers.get('x-admin-token') || '';
  if (header) return header;
  const url = new URL(request.url);
  return url.searchParams.get('token') || '';
}

export function authorized(request, env) {
  const expected = env.COMMENT_ADMIN_TOKEN || '';
  if (!expected) return false;
  return readToken(request) === expected;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: 'unauthorized' }), {
    status: 401,
    headers: { 'content-type': 'application/json; charset=utf-8' }
  });
}

// 极简的常量时间比较（避免时序侧信道），可选使用
export function safeEqual(a, b) {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}
