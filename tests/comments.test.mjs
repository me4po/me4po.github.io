// 评论 API 冒烟测试（无依赖，内存 mock D1）
// 运行：node tests/comments.test.mjs
// 覆盖：D-11 先审后发、NFR-016 email 不外泄、审核鉴权、入参校验、限流、C-12 无 DB 降级
import { onRequestGet, onRequestPost } from '../functions/api/comments.js';
import { onRequestPost as moderatePost, onRequestGet as moderateGet } from '../functions/api/comments/moderate.js';

function makeDB() {
  const rows = [];
  function execInsert(sql, args) {
    if (/INSERT INTO comments/.test(sql)) {
      const [id, slug, parent_id, nickname, email, content, created_at, ua_hash, flagged] = args;
      return { id, slug, parent_id, nickname, email, content, status: 'pending', is_admin: 0, created_at, ua_hash, flagged };
    }
    if (/UPDATE comments SET status = \? WHERE id = \?/.test(sql)) {
      const r = rows.find((x) => x.id === args[1]);
      if (r) r.status = args[0];
      return {};
    }
    return {};
  }
  return {
    _rows: rows,
    prepare(sql) {
      let args = [];
      const stmt = {
        bind(...a) { args = a; return stmt; },
        async all() {
          if (/INSERT/.test(sql)) { rows.push(execInsert(sql, args)); return { results: [], success: true }; }
          return { results: rows.filter((r) => r.status === 'approved' && r.slug === args[0]).slice(0, args[1]) };
        },
        async first() {
          if (/COUNT\(\*\)/.test(sql)) {
            return { c: rows.filter((r) => r.ua_hash === args[0] && r.created_at > args[1]).length };
          }
          const m = sql.match(/SELECT id, parent_id FROM|SELECT \* FROM comments WHERE id/);
          if (m) return rows.find((r) => r.id === args[0]) || null;
          return null;
        },
        async run() { rows.push(execInsert(sql, args)); return { success: true }; }
      };
      return stmt;
    }
  };
}

const env = { DB: makeDB(), COMMENT_ADMIN_TOKEN: 'test-token-123' };
const UA = { 'user-agent': 'test-agent', 'cf-connecting-ip': '1.2.3.4' };

function req(method, url, body, headers = {}) {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json', ...UA, ...headers },
    body: body ? JSON.stringify(body) : undefined
  });
}
const ctx = (r, e = env) => ({ request: r, env: e });

let pass = 0, fail = 0;
function t(name, cond, extra = '') {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra); }
}

const API = 'https://example.pages.dev/api/comments';

console.log('--- POST 提交 ---');
let r = await onRequestPost(ctx(req('POST', API, { slug: 'hello', nickname: '小明', content: '写得挺好，受教了', email: 'a@b.com' })));
let j = await r.json();
t('提交成功 201', r.status === 201, JSON.stringify(j));
t('返回 pending', j.pending === true);

console.log('--- 未审核不可见（D-11 先审后发）---');
r = await onRequestGet(ctx(req('GET', API + '?slug=hello')));
j = await r.json();
t('待审评论不出现在公开列表', j.comments.length === 0, JSON.stringify(j));

console.log('--- 审核放行 ---');
r = await moderatePost(ctx(req('POST', API + '/moderate', { id: env.DB._rows[0].id, action: 'approve' }, { 'x-admin-token': 'test-token-123' })));
t('审核通过', r.status === 200, 'got ' + r.status);

r = await onRequestGet(ctx(req('GET', API + '?slug=hello')));
j = await r.json();
t('已审核可见', j.comments.length === 1);
t('email 不出现在响应（NFR-016）', !JSON.stringify(j).includes('a@b.com'), JSON.stringify(j));
t('ua_hash 不出现在响应', !JSON.stringify(j).includes('ua_hash'));

console.log('--- 鉴权 ---');
r = await moderatePost(ctx(req('POST', API + '/moderate', { id: env.DB._rows[0].id, action: 'delete' }, { 'x-admin-token': 'wrong' })));
t('错误 token 被拒 401', r.status === 401, 'got ' + r.status);
r = await moderateGet(ctx(req('GET', API + '/moderate')));
t('无 token 列待审被拒 401', r.status === 401, 'got ' + r.status);

console.log('--- 入参校验 ---');
t('过短内容 400', (await onRequestPost(ctx(req('POST', API, { slug: 'hello', content: 'x' })))).status === 400);
t('非法邮箱 400', (await onRequestPost(ctx(req('POST', API, { slug: 'hello', content: '正常内容', email: 'not-an-email' })))).status === 400);
t('超长内容 400', (await onRequestPost(ctx(req('POST', API, { slug: 'hello', content: 'a'.repeat(1001) })))).status === 400);
t('缺 slug 400', (await onRequestGet(ctx(req('GET', API)))).status === 400);

console.log('--- 限流（3 次/分钟）---');
const codes = [];
for (let i = 0; i < 5; i++) {
  const rr = await onRequestPost(ctx(req('POST', API, { slug: 'hello', nickname: 't' + i, content: '测试内容 ' + i })));
  codes.push(rr.status);
}
t('超额提交被 429', codes.filter((c) => c === 429).length >= 2, JSON.stringify(codes));

console.log('--- DB 未绑定（C-12 降级：正文照常可读）---');
r = await onRequestGet(ctx(req('GET', API + '?slug=hello'), {}));
j = await r.json();
t('无 DB 返回空数组不抛错', Array.isArray(j.comments) && j.comments.length === 0 && r.status === 500);

console.log(`\n结果：${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
