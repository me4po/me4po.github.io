# 部署手册：GitHub → Cloudflare Pages → 评论上线

> 适用于本仓库当前状态（commit `dbcbabd`）。所有要填的值都写在下面，照抄即可。
> 全程约 20–30 分钟。**先做第 0 步**，否则后面会返工。

---

## 0. 开工前先做这两件事（1 分钟）

### 0.1 生成一个审核口令

在本机终端执行，把输出的字符串**单独存好**（后面要填两次）：

```bash
openssl rand -hex 32
```

这个口令 = 评论审核权限。泄露等于别人能删你的评论，但**不会**泄露文章内容。

### 0.2 确认控制台能打开

浏览器访问 <https://dash.cloudflare.com> 并登录。

> 如果打不开：这是 PRD 里的 A-06 假设（Cloudflare 控制台国内可达性）验证失败。
> 改用附录 B 的 wrangler CLI 方式完成 D1 与环境变量部分；Pages 项目本身仍需一次控制台操作。

---

## 1. 创建 Pages 项目（Git 集成）

1. 打开 <https://dash.cloudflare.com/?to=/:account/workers-and-pages>
2. 右上角 **Create** → 切到 **Pages** 标签页 → **Connect to Git**
   - ⚠️ Cloudflare 现在默认引导 **Workers**。**务必切到 Pages 标签**，别建错。
   - 本项目用 `functions/` 文件路由，Pages 原生支持；Workers 需要额外编译步骤（见附录 A）。
3. **Connect GitHub** → 授权 → 选择仓库 `me4po/blog`
   - 如果列表里看不到：点 **Configure GitHub App**，把 `me4po/blog` 加进授权范围。
4. 进入 **Set up builds and deployments** 页面，按下表填：

| 字段 | 填什么 |
| --- | --- |
| Project name | `blog`（会成为 `blog.pages.dev`） |
| Production branch | `main` |
| Framework preset | `Hugo` |
| Build command | `hugo --minify` |
| Build output directory | `public` |
| Root directory | **留空** |

5. 点 **Save and Deploy**。

---

## 2. 固定 Hugo 版本（关键，别跳过）

首次部署**大概率会失败**，因为 Cloudflare 的默认 Hugo 版本可能太旧。先把它固定：

1. 进项目 → **Settings** → **Environment variables** → **Add**
2. 按下表加一条（Production 和 Preview 都勾上）：

| Variable name | Value |
| --- | --- |
| `HUGO_VERSION` | `0.168.0` |

3. 回 **Deployments** → 最新一条右侧 `···` → **Retry deployment**

> 本地已用 `hugo v0.168.0+extended` 实测通过（15 页，0 警告），这个版本号是验证过的。

---

## 3. 首次构建成功的标志

**Deployments** 里出现绿色 **Success**，日志末尾应类似：

```
Pages            15
Total in 4x ms
Success: Your site was deployed!
```

点开 `blog.pages.dev` 能看到终端风首页，即成功。

如果失败：直接跳到第 9 节故障排查。

---

## 4. 回填真实域名（必须做，否则图片/链接全是错的）

拿到真实域名（如 `blog.pages.dev`）后，改仓库里的两个占位符：

**`config.toml` 第 1 行**

```toml
baseURL = "https://blog.pages.dev/"     # 换成你的真实域名
```

**`static/robots.txt` 最后一行**

```
Sitemap: https://blog.pages.dev/sitemap.xml
```

然后推送，触发第二次构建：

```bash
cd /Users/jacobjhs/cs/blogger/blog
git add -A
git commit -m "chore: 回填真实域名"
git push
```

> 注意结尾的 `/`。`baseURL` 少了尾斜杠，Hugo 的绝对链接会拼错。

---

## 5. 创建 D1 数据库

1. 左侧 **Storage & Databases** → **D1 SQL Database** → **Create**
2. Database name：`blog-comments`
3. Location：选 **Automatic**（或离你近的亚太区），**创建后不可改**
4. 创建完成后，记下页面上的 **Database ID**（备用）

---

## 6. 建表

1. 进刚建的 `blog-comments` → **Console** 标签页
2. 把仓库根目录 `schema.sql` 的**全部内容**粘贴进去
3. 点 **Execute**

验证：在同一个 Console 里执行

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

应返回 `comments`。

> `schema.sql` 里已含 3 个索引，**不要删**。D1 免费档按"扫描行数"计费，
> 没索引的全表扫描会几倍消耗额度。

---

## 7. 把 D1 绑到 Pages 项目

1. 回 **Workers & Pages** → 选 `blog` 项目
2. **Settings** → **Bindings** → **Add** → **D1 database bindings**
3. 填：

| 字段 | 值 |
| --- | --- |
| Variable name | `DB`（**必须一字不差**，代码里读的是 `env.DB`） |
| D1 database | `blog-comments` |

4. 保存。

---

## 8. 设置审核口令

同一个项目 → **Settings** → **Environment variables** → **Add**

| Variable name | Value |
| --- | --- |
| `COMMENT_ADMIN_TOKEN` | 第 0.1 步生成的 64 位字符串 |

Production 和 Preview 都勾上。建议点 **Encrypt**（作为 secret 存储）。

---

## 9. 重新部署（最容易被漏掉的一步）

> ⚠️ **绑定和环境变量都不会自动生效**，必须重新部署一次。

**Deployments** → 最新一条 → `···` → **Retry deployment**

或者推一个空提交：

```bash
git commit --allow-empty -m "chore: 触发重新部署以生效 D1 绑定"
git push
```

---

## 10. 验收清单（逐条打勾）

把 `<域名>` 和 `<TOKEN>` 换成真实值，在终端执行。

### 10.1 静态站点

```bash
DOMAIN=https://blog.pages.dev

curl -s -o /dev/null -w "首页      %{http_code}\n" $DOMAIN/
curl -s -o /dev/null -w "文章页    %{http_code}\n" $DOMAIN/posts/2026-10-21-hello-terminal/
curl -s -o /dev/null -w "归档      %{http_code}\n" $DOMAIN/archives/
curl -s -o /dev/null -w "sitemap   %{http_code}\n" $DOMAIN/sitemap.xml
curl -s -o /dev/null -w "审核台    %{http_code}\n" $DOMAIN/admin/
```

期望全部 `200`。

### 10.2 评论接口（未绑定 D1 时会是 500，属正常降级）

```bash
# 读评论（应当 200 + 空数组）
curl -s "$DOMAIN/api/comments?slug=2026-10-21-hello-terminal"

# 提交一条测试评论（应当 201）
curl -s -X POST "$DOMAIN/api/comments" \
  -H 'content-type: application/json' \
  -d '{"slug":"2026-10-21-hello-terminal","nickname":"测试","content":"这是一条测试评论"}'

# 再读一次：应仍是空数组 —— 因为先审后发（D-11）
curl -s "$DOMAIN/api/comments?slug=2026-10-21-hello-terminal"
```

### 10.3 审核台

浏览器打开 `https://blog.pages.dev/admin/`：

- [ ] 填入 `COMMENT_ADMIN_TOKEN` → 能看到刚才那条"测试"评论在**待审**列表
- [ ] 点 **放行** → 刷新文章页，评论出现
- [ ] 试一次"导出"，能下载 JSON（这条满足 C-10 可导出）

### 10.4 降级验证（C-12）

评论区在接口报错时应当隐藏、正文照常可读。可用错误 slug 触发或临时解绑 D1 观察。

---

## 11. 开启构建失败通知（NFR-010）

构建失败是静默的，没有通知你根本不知道。

**Notifications**（账户级）→ **Add** → 选 **Cloudflare Pages** → 事件勾 **Deployment failed** → 送达方式 **Email**

或者走 Workers 的 Observability，但 Pages 用 Notifications 最简单。

---

## 12. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| 构建日志报 `hugo: command not found` 或版本相关 | `HUGO_VERSION` 未设 | 回到第 2 步 |
| 构建成功但页面 404 / sitemap 里没这篇文章 | **时区陷阱**：UTC 构建下 `date: 2026-10-21` 在北京 08:00 前属"未来" | `config.toml` 已设 `buildFuture = true`；若被删了就加回来 |
| `/api/comments` 返回 `DB not bound` | D1 没绑或绑完没重新部署 | 第 7 步 + 第 9 步 |
| `/admin/` 一直 401 | token 不一致，或没重新部署 | 检查环境变量值两端是否一致（注意别带空格） |
| `/api/comments/moderate` 404 | `functions/api/comments.js` 与 `functions/api/comments/` 目录路由冲突 | 把 `comments.js` 改名为 `comments/index.js`，同时把里面的 `'../lib/'` 改成 `'../../lib/'`，重新部署 |
| 部署成功但样式全丢 | `baseURL` 没尾斜杠，或 CSS 路径错 | 第 4 步 |
| 文章推上去了但没出现 | 同"时区陷阱"；或 front matter 语法错 | 看构建日志 |

---

## 附录 A：如果控制台里找不到 Pages 创建入口

Cloudflare 正在把 Pages 往 Workers 收。若 **Create** 里已经没有 Pages 标签（说明 D-07 的迁移触发条件已满足），走 Workers 路线：

1. **Workers & Pages** → **Create** → **Workers** → **Connect to Git**（Workers Builds）
2. 构建命令 `hugo --minify`，输出目录填 `public`
3. 需要一个 `wrangler.jsonc`：

```jsonc
{
  "name": "blog",
  "compatibility_date": "2026-10-20",
  "assets": { "directory": "./public", "not_found_handling": "404-page" }
}
```

4. Pages Functions 的 `functions/` 目录 Workers **不直接支持**（兼容性矩阵标 🟡），需要编译：

```bash
npx wrangler pages functions build --outdir=./dist/worker/
```

然后在 `wrangler.jsonc` 里加 `"main": "./dist/worker/index.js"`，并把构建命令改成
`hugo --minify && npx wrangler pages functions build --outdir=./dist/worker/`。

> 这条路明显更绕。**只要 Pages 还能建，就用 Pages。**

---

## 附录 B：用 wrangler CLI 代替控制台（可脚本化，也适合控制台打不开时）

```bash
cd /Users/jacobjhs/cs/blogger/blog

npx wrangler login                                   # 浏览器授权

npx wrangler d1 create blog-comments                 # 建库，输出里会有 database_id
npx wrangler d1 execute blog-comments --remote --file=./schema.sql   # 建表

npx wrangler pages secret put COMMENT_ADMIN_TOKEN    # 设置审核口令（交互式输入）
npx wrangler pages deployment list                   # 查看部署
npx wrangler pages deployment tail                   # 实时看 Functions 日志（排错利器）
```

`deployment tail` 是排查评论接口 500 最快的手段，控制台看不到 Functions 的运行时错误。

---

## 附录 C：免费额度与本次部署的消耗（2026-10 核实）

| 项 | 免费额度 | 本站预估 |
| --- | --- | --- |
| 构建 | 500 次/月，1 并发，20 分钟超时 | 每月 < 10 次 |
| 带宽 / 请求 | 不限 | — |
| Pages Functions | 100,000 请求/天（00:00 UTC 重置） | 每篇文章一次评论拉取；日均几百次 |
| D1 行读取 | 5,000,000 /天 | 索引命中，每次查询几十行 |
| D1 行写入 | 100,000 /天 | 一天几十条评论 |
| D1 存储 | 5 GB | 远不到 |

额度瓶颈是 Functions 的 10 万请求/天，个人博客远远碰不到。**费用应为 0**。

每月核对一次 Billing，并更新 `.cloudflare/README.md` 的台账。

---

## 完成后请回填

- [ ] `.cloudflare/README.md` 第 2 节的额度台账（Workers / D1 两行）
- [ ] 把真实域名同步进 `docs/OPS.md` 的 SOP-08（审核台地址）
