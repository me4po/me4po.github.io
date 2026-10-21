# TERMINAL // LOG

一个托管在 GitHub Pages、内容源在同一 GitHub 仓库的个人博客。
暗色终端风格，等宽字体，Markdown 写作，push 即发布。

对外地址：<https://me4po.github.io/>

## 目录结构

```
blog/
├── hugo.toml                  站点配置（含视觉开关与评论开关）
├── content/                   文章与页面
│   ├── posts/                 文章（YYYY-MM-DD-slug.md）
│   ├── about.md
│   └── archives.md
├── static/                    静态资源
│   ├── images/                图片（images/<日期>/<文件名>）
│   ├── favicon.svg
│   └── robots.txt
├── themes/terminal/           自制主题（极客 / 神秘 / 终端）
│   ├── assets/css/main.css
│   └── layouts/
├── .github/workflows/hugo.yml GitHub Actions：Hugo 构建 + Pages 部署
├── docs/OPS.md                运维手册（SOP）
└── docs/DEPLOY.md             部署手册（含一次性配置与踩坑记录）
```

## 写一篇新文章

见 `docs/OPS.md` 的 SOP-02。要点：

- 文件放 `content/posts/YYYY-MM-DD-slug.md`
- front matter 必填 `title` / `date`；同一天发多篇时 `date` 要带时间（如 `2026-10-21T17:30:00+08:00`）
- 按需填 `tags` / `summary` / `cover` / `comments` / `pinned`
- `pinned: true` 会把文章固定排在首页最前（多篇置顶时仍按日期倒序）
- 配图先压到 ≤ 300 KB，放 `static/images/<日期>/`
- push 到 `main` 即发布

## 视觉开关

`hugo.toml` 的 `[params.effects]` 控制各项效果，默认只开克制档（V-01/02/03/04/05/08）。
想要更浓就把 `scanlines` / `glitch` / `commandBar` / `themeToggle` 改成 `true`，改完记得跑一次性能与移动端检查（PRD 8.3 预算）。

## 评论

使用 **Giscus**（基于 GitHub Discussions），零后端、零成本。读者需要登录 GitHub 账号才能发表，
评论数据保存在本仓库的 Discussions 中，无需数据库、无需服务器。

- 配置在 `hugo.toml` 的 `[params.comments.giscus]`
- 单篇关闭：front matter 写 `comments: false`
- 首次启用（需在 GitHub 网页完成）：仓库 Settings → 勾选 **Discussions** → 安装
  [giscus App](https://github.com/apps/giscus) → 在 <https://giscus.app> 取 `category_id` 填入配置

## 本地开发与验证

```bash
hugo server          # 日常写作预览 http://localhost:1313（brew 的 0.168.0）
hugo147 --minify     # 发布前验证：与 Actions 同版本，期望 15 页且无 WARN/ERROR
```

> **两个 hugo 并存是有意为之**：`.github/workflows/hugo.yml` 固定使用 **0.147.7**，
> 本地 brew 装的 0.168.0 更新，旧版有已移除的语法限制（曾因 `paginate` 直接构建失败）。
> **推送前一定要用 `hugo147` 验一遍**，用 `hugo` 验过不代表线上能过。

> 注意时区：只写 `date: YYYY-MM-DD` 的文章，在 UTC 下可能被判为“未来内容”而整篇不产出。
> `hugo.toml` 已设 `buildFuture = true` 规避。
>
> 排序规则：首页与文章列表按 `date` 倒序，`pinned: true` 的文章永远排在最前。
> 只写日期时同一天的文章时间相同，会退化为按标题排序——同一天发多篇请给 `date` 加时间。

## 发布

push 到 `main` → GitHub Actions 自动构建 → 部署到 GitHub Pages。
日常发布全程不需要打开 GitHub 网页，详见 `docs/DEPLOY.md`。

## 一次性配置（上线前需在 GitHub 完成）

- [ ] 仓库名与账号一致：`me4po/me4po.github.io`，且为**公开**仓库
- [ ] Settings → Pages → Source 选 **GitHub Actions**
- [ ] Settings → General → Features 勾选 **Discussions**
- [ ] 安装 giscus App，并把 `category_id` 填入 `hugo.toml`
- [x] `hugo.toml` 的 `baseURL` → `https://me4po.github.io/`
- [x] `static/robots.txt` 的 Sitemap 域名 → 已填
- [x] `.github/workflows/hugo.yml` 固定 Hugo `0.147.7`
- [x] Giscus 的 `repo` / `repo_id` / `category` 已填

## 为什么不跑在 Cloudflare

`me4po.github.io` 是 GitHub Pages 的专属域名，只有 GitHub 能提供；Cloudflare 无法在该域名出内容，
也没有在线编辑器或 git 托管能力。因此发布链路从 Cloudflare 整体迁回 GitHub Pages，
决策与代价见 PRD v1.4 的 D-14、D-16。
