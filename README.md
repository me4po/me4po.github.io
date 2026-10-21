# TERMINAL // LOG

一个托管在 Cloudflare Pages、内容源在 GitHub 的个人博客。零成本、免服务器、浏览器内完成写作与发布。

暗色终端风格，等宽字体，评论先审后发。

## 目录结构

```
blog/
├── config.toml                 站点配置（含视觉开关与评论开关）
├── content/                    文章与页面
│   ├── posts/                  文章（YYYY-MM-DD-slug.md）
│   ├── about.md
│   └── archives.md
├── static/                     静态资源
│   ├── images/                 图片（images/<日期>/<文件名>）
│   ├── admin/index.html        评论审核台（noindex）
│   ├── favicon.svg
│   └── robots.txt
├── themes/terminal/            自制主题（极客 / 神秘 / 终端）
│   ├── assets/css/main.css
│   └── layouts/
├── functions/                  评论接口（Pages Functions + D1）
│   ├── api/comments.js         GET 列表 / POST 提交
│   ├── api/comments/moderate.js  审核（鉴权）
│   ├── api/comments/export.js    导出（鉴权）
│   └── lib/                    鉴权与敏感词
├── schema.sql                  D1 建表语句
├── tests/comments.test.mjs     评论接口冒烟测试（无依赖）
├── .cloudflare/README.md       构建与运行时配置
├── docs/OPS.md                 运维手册（SOP）
└── PRD 见仓库外的 PRD_Cloudflare_Pages_GitHub_个人博客_v1.2.md
```

## 写一篇新文章

见 `docs/OPS.md` 的 SOP-02。要点：

- 文件放 `content/posts/YYYY-MM-DD-slug.md`
- front matter 必填 `title` / `date`，按需填 `tags` / `summary` / `cover` / `comments`
- 配图先压到 ≤ 300 KB，放 `static/images/<日期>/`
- push 到 `main` 即发布

## 视觉开关

`config.toml` 的 `[params.effects]` 控制各项效果，默认只开克制档（V-01/02/03/04/05/08）。
想要更浓就把 `scanlines` / `glitch` / `commandBar` / `themeToggle` 改成 `true`，改完记得跑一次性能与移动端检查（PRD 8.3 预算）。

## 评论

- 读者提交 → 进待审 → 站长在 `/admin/` 审核后公开（D-11）
- 反垃圾：限流 + 长度校验 + 敏感词标记 + 输出转义（7.4）
- 数据可导出（C-10），邮箱与 IP 不外泄（NFR-016）
- 评论接口挂了会隐藏评论区，正文照常可读（C-12）

## 本地开发与验证

```bash
hugo server              # 日常写作预览 http://localhost:1313（brew 的 0.168.0）
hugo147 --minify         # 发布前验证：与 Cloudflare 同版本，期望 15 页且无 WARN/ERROR
node tests/comments.test.mjs   # 评论接口冒烟测试，15 条断言
```

> **两个 hugo 并存是有意为之**：Cloudflare 构建镜像默认 Hugo 是 **0.147.7**，比本地 brew 装的
> 0.168.0 旧，旧版会多出已移除的语法限制（曾因 `paginate` 直接构建失败）。
> **推送前一定要用 `hugo147` 验一遍**，用 `hugo` 验过不代表云端能过。

> 注意时区：只写 `date: YYYY-MM-DD` 的文章，在 UTC 下可能被判为"未来内容"而整篇不产出。
> `config.toml` 已设 `buildFuture = true` 规避，详见 `.cloudflare/README.md`。

## 首次部署前必须替换

- `config.toml` 的 `baseURL`
- `static/robots.txt` 的 Sitemap 域名

（~~`.cloudflare/README.md` 的 `HUGO_VERSION`~~ 已实测为 `0.168.0`，无需再改）
