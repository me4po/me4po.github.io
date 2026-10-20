# Cloudflare Pages 构建与运行时配置

> 本文件随仓库版本化。控制台里改了任何一项，都要同步改这里——否则换设备/迁移时会踩坑。

## 1. Pages 项目（Git 集成）

| 配置项 | 值 |
| --- | --- |
| Framework preset | Hugo |
| Build command | `hugo --minify` |
| Build output directory | `public` |
| Production branch | `main` |
| Root directory | （留空） |

## 2. 环境变量

| 变量 | 值 | 说明 |
| --- | --- | --- |
已在本地 `hugo v0.168.0+extended` 实测构建通过（15 页，0 警告），故按下表固定版本。

| 变量 | 值 | 说明 |
| --- | --- | --- |
| `HUGO_VERSION` | `0.168.0` | Cloudflare 默认 Hugo 版本较旧，不固定易构建失败或主题不兼容。**升级 Hugo 时要同步改这里 + 本地验证后再推** |

主题为纯 CSS（无 SCSS/PostCSS），**不强制 Hugo Extended**；本地装的是 extended 版，若后续换成依赖 SCSS 的主题，需按 PRD D-08 重新确认 Extended 获取方式。

### 时区别踩坑（已修，别改回去）

Cloudflare 构建机按 **UTC** 运行。北京时间 08:00 之前发布、front matter 只写当天日期（如 `date: 2026-10-21`）的文章，其 `publishDate` 在 UTC 下仍是"未来"，Hugo 默认会整篇跳过——表现为"文章推上去了但页面 404"。

`config.toml` 里已设 `buildFuture = true` 规避。本站不做定时发布，所以不要删这一行。若以后需要定时发布，改成"front matter 里写完整时间（如 `2026-10-21T20:00:00+08:00`）"并移除该配置。

## 3. 评论运行时（D-10 / CM-05）

### D1 数据库绑定

Pages → 项目 → Settings → Functions → **D1 database bindings**

| 字段 | 值 |
| --- | --- |
| Variable name | `DB` |
| D1 database | 你的数据库名（建议 `blog-comments`） |

建表语句见仓库根目录 `schema.sql`（在 D1 Console 执行一次即可）。

### 密钥

Pages → Settings → Environment variables（Production & Preview）

| 变量 | 说明 |
| --- | --- |
| `COMMENT_ADMIN_TOKEN` | 审核台口令，自己生成一个长随机串。泄露等于审核权限泄露 |

审核台地址：`https://<你的域名>/admin/`（已在 robots.txt 中禁止索引，但仍需保管好 token）。

## 4. 部署与回滚

- **发布**：push 到 `main` → 自动构建部署；其他分支生成预览部署（默认公网可访问，见 D-09）。
- **回滚**：Deployments → 选一个历史部署 → Rollback（会产生新部署记录）。
- **失败排查**：Deployments → 查看构建日志。常见原因见 `docs/OPS.md` 的 SOP-07。
- **注意**：Git 集成项目之后**无法**切换为 Direct Upload（PRD D-02），应急上传需另建项目（D-04）。

## 5. 免费额度台账（C-08 / NFR-011）

每月核对一次并记录：

| 项 | 上限（免费档） | 本月用量 |
| --- | --- | --- |
| 构建次数 | 500 / 月（1 并发，20 分钟超时） | |
| 单文件 | ≤ 25 MiB | |
| 站点文件数 | ≤ 20,000 | |
| Workers / Pages Functions 请求 | 免费档额度（M1 核实后回填） | |
| D1 存储与读写 | 免费档额度（M1 核实后回填） | |
| 月度费用 | 0 元 | |
