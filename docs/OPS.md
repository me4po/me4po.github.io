# 运维手册（OPS）

> 稳定不变的操作规范放这里，随仓库版本化。PRD 只保留决策与验收。
> 当前形态：GitHub Pages 托管 + GitHub Actions 构建，对外地址 <https://me4po.github.io/>。

## SOP-01 首次上线

1. 仓库满足三个条件：名为 `me4po.github.io`、公开、账号邮箱已验证。
2. 仓库 → Settings → Pages → Source 选 **GitHub Actions**。
3. 仓库 → Settings → General → Features 勾选 **Discussions**；安装
   [giscus App](https://github.com/apps/giscus)，在 <https://giscus.app> 取 `category_id`
   填入 `hugo.toml`（详见 `docs/DEPLOY.md` 第 2.1 节）。
4. 本地 `git push` 到 `main`，工作流自动构建并部署。
5. 用 `docs/DEPLOY.md` 第 5 节验收。

## SOP-02 日常发布（主路径）

1. 本地打开 `content/posts/`，新建 `YYYY-MM-DD-slug.md`，front matter：

```yaml
---
title: "标题"
date: 2026-10-21T17:30:00+08:00   # 同一天发多篇时必须带时间
tags: ["标签"]
summary: "一句话摘要"
cover: "/images/2026-10-21/cover.jpg"   # 可选
pinned: true                           # 可选：置顶到首页最前
draft: false
---
```

2. 排序：首页与文章列表按 `date` 倒序；`pinned: true` 优先。只写日期时同一天的文章时间相同，会退化为按标题排序，所以同日多篇务必写完整时间。
3. 配图：先压到 ≤ 300 KB（WebP/JPEG），放 `static/images/YYYY-MM-DD/`，正文用相对路径引用。
4. 发布前自检：

```bash
hugo147 --minify     # 期望 15 页以上、无 WARN/ERROR
```

4. `git add -A && git commit -m "post: 标题" && git push`
5. 等 1～2 分钟刷新站点（Ctrl/Cmd + Shift + R）确认内容与图片生效。
6. 可选：在仓库 Actions 页确认本次 run 是绿色。

> **发布后页面 404 / sitemap 里没有这篇文章**：先看时区。
> Actions 按 UTC 构建，`date: 2026-10-21` 在北京时间 08:00 前仍属“未来”，Hugo 会跳过。
> `hugo.toml` 已设 `buildFuture = true`；若仍想精确控制，front matter 写完整时间：
> `date: 2026-10-21T20:00:00+08:00`。

## SOP-03 备用 / 降级发布

- **备用**：GitHub 网页能打开时，用 github.dev 或网页编辑器改文件并 Commit。
- **降级**：本机 Git 走 SSH over 443（`ssh.github.com:443`）。违反 C-04，使用后在本文件末尾记录日期与原因。

## SOP-04 换设备恢复

新设备装 Git（或浏览器能打开 GitHub 网页时用在线编辑器）→ 克隆仓库 → 继续写。无需安装 Hugo 也能发布。

## SOP-05 回滚

- **内容错**：`git revert <commit>` 或在仓库里还原文件历史版本，push 后自动重新部署。
- **部署异常**：Actions → 选中上一次成功的 run → **Re-run jobs**。
- **工作流坏掉**：恢复 `.github/workflows/hugo.yml` 的历史版本再 push。
- Pages 没有平台级一键 Rollback，回滚以 Git 历史为准。

## SOP-06 网络不可用降级

1. **判定**：`git push` 连续 3 次失败，或 GitHub 网页连续 3 次打不开。
2. **处置顺序**：检查本地代理 → 切 SSH 443 → 换网络（手机热点）→ 先本地写完，恢复后再推送。
3. **记录**：故障时间、现象、采用的路径。

## SOP-07 构建异常处置（含 Actions）

常见失败原因，按概率排序：

1. Hugo 版本漂移 → 看 Actions 日志里 `hugo version`，应为 `v0.147.7`
2. front matter 缩进/引号错误 → 日志会指向具体文件
3. 主题引用了不存在的模板或资源 → 日志会给出路径
4. Pages 未开启或 Source 不是 GitHub Actions → `Get Pages site failed`
5. 资源超限（单文件过大、站点 > 1 GB）→ 压缩图片

本地先自查再推，能省一次排查：

```bash
hugo147 --minify     # 与 Actions 同版本；应无 WARN/ERROR
```

连续 2 次修不好就先回滚（SOP-05），保证站点可用优先。

## SOP-08 评论管理（Giscus）

评论数据存放在本仓库的 **Discussions**（分类 `Announcements`），没有独立数据库。

- **审核**：在 GitHub Discussions 中对具体讨论执行隐藏、删除、锁定；giscus App 需要该仓库的
  Discussions 读写权限。
- **单篇关闭**：文章 front matter 写 `comments: false`。
- **全站关闭**：`hugo.toml` → `[params.comments] enabled = false`，push 后评论区消失。
- **读者门槛**：阅读无需登录，发表评论必须登录 GitHub。
- **备份/导出**：Discussions 属于仓库数据，随仓库迁移；需要单独导出时用 GitHub API 拉取讨论与评论。
- **改分类**：`hugo.toml` 的 `category` 与 `category_id` 必须同时改，否则讨论会挂到错误分类。

## 每月例行（NFR-011 / NFR-008）

- [ ] 抽查首页、文章页、归档页、sitemap 返回 200
- [ ] 核对 Actions 本月运行次数与失败记录
- [ ] 抽查文章页评论区能否正常加载（`giscus.app/client.js` 200）
- [ ] 抽查 RSS：`curl -s https://me4po.github.io/index.xml` 是合法 XML、条目数与文章数一致、
      且不含 `about` / `archives`（模板在 `layouts/_default/rss.xml`）
- [ ] 清理 Discussions 中的垃圾评论
- [ ] 把仓库内容同步一份到本地/网盘（NFR-001 双份备份）

## 迁移演练（M3，NFR-008）

1. 仓库整体打包（含 `content/`、`static/`、`themes/`、`layouts/`、`hugo.toml`、`.github/`）
   —— **`layouts/` 别漏**，里面放着自定义 RSS 模板，漏了 feed 会静默退回内置模板（变回只有摘要、混入单页）
2. 在新账号或新平台建仓库，放回文件
3. 重新开启 Pages（或等价静态托管），确认构建与页面
4. 计时，目标 ≤ 1 天

---

## 降级记录（违反 C-04 时填写）

| 日期 | 原因 | 采用的路径 |
| --- | --- | --- |
| | | |
