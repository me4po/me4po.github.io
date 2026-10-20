// 敏感词表（7.4）
// 命中不自动拒绝，只标记为 flagged 交由站长人工复核——避免误杀正常讨论。
// 站长可直接在浏览器编辑器里维护这个数组，提交即生效。

const WORDS = [
  // 广告 / 推广
  '代刷', '刷单', '兼职日结', '免费领取', '加微信', '加v信', '菠菜', '博彩',
  // 辱骂与攻击（示例，按需要补充）
  '傻逼', '智障', '垃圾站点',
  // 违法违规线索
  '翻墙', 'vpn代理', '私服', '外挂'
];

export function hitSensitive(text) {
  const lower = String(text || '').toLowerCase();
  return WORDS.some((w) => lower.includes(w.toLowerCase()));
}

export function listWords() {
  return WORDS.slice();
}
