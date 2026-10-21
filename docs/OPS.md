# 运维手册（OPS）

> 稳定不变的操作规范放这里，随仓库版本化。PRD 只保留决策与验收。
> 对应 PRD v1.2 第 11 章 SOP / 第 7 章评论。

## SOP-01 首次上线

1. GitHub 建仓库，把本目录所有文件推上去（`public/`、`resources/` 已 gitignore）。
2. Cloudflare → Workers & Pages → Create → Pages → Connect to Git → 授权 → 选仓库。
3. 按 `.cloudflare/README.md` 配置构建命令与环境变量。
4. 部署成功后把 `hugo.toml` 的 `baseURL` 和 `static/robots.txt` 里的域名替换为真实 `xxx.pages.dev`。
5. D1 建表（`schema.sql`），绑定变量 `DB`，设置 `COMMENT_ADMIN_TOKEN`。
6. 开启部署通知邮件（构建失败兜底感知，NFR-010）。

## SOP-02 日常发布（主路径）

1. 浏览器打开在线编辑器（github.dev / 其他 M1 定稿方案）。
2. 新建 `content/posts/YYYY-MM-DD-slug.md`，front matter：

```yaml
---
title: "标题"
date: 2026-10-21
tags: ["标签"]
summary: "一句话摘要"
cover: "/images/2026-10-21/cover.jpg"   # 可选
comments: true
draft: false
---
```

3. 配图：先压到 ≤ 300 KB（WebP/JPEG），上传到 `static/images/YYYY-MM-DD/`，正文用相对路径引用。
4. Commit & Push 到 `main`。
5. **确认**：等邮件通知或看部署页，然后刷新站点确认内容与图片生效（30 秒自检）。

> **发布后页面 404 / sitemap 里没有这篇文章**：先看是不是时区问题。
> Cloudflare 按 UTC 构建，`date: 2026-10-21` 在北京时间 08:00 前仍属"未来"，Hugo 会跳过。
> `hugo.toml` 已设 `buildFuture = true`；若仍想精确控制，front matter 写完整时间：
> `date: 2026-10-21T20:00:00+08:00`。

## SOP-03 备用 / 降级发布

- 备用：换矩阵里次优编辑器，重复 SOP-02。
- 降级：本机 `git push` 走 `ssh.github.com:443`。违反 C-04，使用后在本文件末尾记录日期与原因。

## SOP-04 换设备恢复

浏览器登录 GitHub + Cloudflare（若评论改用 CM-04，再加一个平台账号）→ 打开在线编辑器继续写。不装任何软件。

## SOP-05 回滚

- 内容错：在仓库里还原文件历史版本并提交。
- 部署异常：Cloudflare Deployments → Rollback。
- 评论函数异常：若导致整站构建失败 → 回滚部署；若只是运行时报错 → 先把该文 `comments: false` 关掉评论区，再修函数。

## SOP-06 网络不可用降级

在线编辑器连续 3 次进不去或提交失败 → 换备用编辑器 → 本地 Git → 必要时 Direct Upload 备用项目。记录时间、现象、走的路径。

## SOP-07 构建异常处置（含评论函数）

常见失败原因，按概率排序：

1. `HUGO_VERSION` 未固定、或固定后没重新部署 → 看构建日志里的 `hugo vX.Y.Z` 确认（当前 `0.147.7`）
2. front matter 缩进/引号错误 → 看日志里报错的文件
3. `functions/` 下 JS 语法错误或**相对路径写错** → 构建日志会指向具体文件。
   注意层级：`functions/api/*.js` 引 `../lib/`，`functions/api/comments/*.js` 引 `../../lib/`（已踩过一次）
4. 主题依赖 SCSS 但环境无 Hugo Extended → 换主题或确认 Extended
5. 资源超限（单文件 > 25 MiB）→ 压缩图片

本地先自查再推，能省一次构建额度：

```bash
hugo147 --minify                 # 与 Cloudflare 同版本；应输出 Pages ≥ 15 且无 WARN/ERROR
node tests/comments.test.mjs     # 应输出「15 通过 / 0 失败」
```

> 别用 `hugo`（brew 的 0.168.0）代替 `hugo147` 做发布前验证——旧版有已移除的语法限制，
> 本地新版本过了不代表云端过得了。

连续 2 次修不好就先回滚（SOP-05），保证站点可用优先。

## SOP-08 评论审核（每 24 小时一次）

1. 打开 `https://<域名>/admin/`，填入 `COMMENT_ADMIN_TOKEN`。
2. 看「待审」：命中敏感词的条目带红框，重点看。
3. 放行 / 删除 / 回复。广告与辱骂直接删。
4. 超过 7 天未处理的待审自动不再展示（不会自动发布）。
5. 批量垃圾来了：临时把该文章 `comments: false`。

## 每月例行（NFR-011 / NFR-008）

- [ ] 核对账单为 0 元、构建次数 ≤ 50
- [ ] 核对 Workers / D1 用量（记入 `.cloudflare/README.md` 台账）
- [ ] 导出一次评论（`admin/` 页导出 JSON）存档到本地或网盘
- [ ] 把仓库内容同步一份到本地/网盘（NFR-001 双份备份）

## 迁移演练（M3，NFR-008）

因为评论引入了 Functions + D1，迁移不再是"拷贝静态产物"：

1. `admin/` 导出全量评论 JSON
2. 仓库整体打包（含 `functions/` 与 `schema.sql`）
3. 在新环境建表、导入数据、重新绑定 `DB` 与 `COMMENT_ADMIN_TOKEN`
4. 计时，目标 ≤ 1 天

---

## 降级记录（违反 C-04 时填写）

| 日期 | 原因 | 采用的路径 |
| --- | --- | --- |
| | | |
