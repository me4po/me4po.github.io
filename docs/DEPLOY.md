# 部署手册：GitHub Pages + GitHub Actions

> 目标：对外站点为 <https://me4po.github.io/>，日常写作与提交在本地完成，
> 构建由 GitHub Actions 在服务端执行，**不需要打开 GitHub 网页**。
> 一次性配置约 10 分钟；之后每次发布 1～2 分钟。

---

## 0. 先搞清楚为什么是这个形态

| 需求 | 现实约束 |
| --- | --- |
| 对外地址是 `me4po.github.io` | 该域名属于 GitHub Pages，只有 GitHub 能提供内容，Cloudflare 无法接管 |
| 不想经常打开 GitHub 网页 | 构建放 GitHub Actions（服务端跑）；提交用本地 `git push`；网页只在一次性开 Pages 时需要 |
| 不装本地构建环境 | 本地只装 Git（必需）与可选的 Hugo（预览用）；正式构建在云端 |

因此 Cloudflare 从发布链路中整体移除：`wrangler.jsonc`、`functions/`、`schema.sql`、
评论审核台与 D1 绑定均已删除（实现保留在 git 历史里）。评论本期关闭。

---

## 1. 仓库要求（一次性）

1. 仓库名必须是 **`me4po.github.io`**（与账号名一致的用户站，URL 才会是根路径 `https://me4po.github.io/`）。
2. 仓库必须**公开**。GitHub Free 的 Pages 只对公开仓库开放。
3. 账号邮箱需已验证（Pages 的前置条件）。

> 若仓库现在叫 `me4po/blog`：Settings → General → Repository name 直接改名即可，提交历史会保留。
> 本地 remote 随后改为 `https://github.com/me4po/me4po.github.io.git`。

## 2. 开启 Pages（一次性，需要打开 GitHub 网页）

1. 仓库 → **Settings** → **Pages**
2. **Build and deployment** → Source 选 **GitHub Actions**
3. 不需要选分支、不需要填目录（工作流自己上传产物）

> 这是整条链路里唯一必须打开 GitHub 网页的步骤。如果当时打不开，换网络或等可达时再做；
> 未开启前，Actions 的部署步骤会报 `Get Pages site failed`。

## 3. 首次推送

```bash
cd /Users/jacobjhs/cs/blogger/blog
git remote set-url origin https://github.com/me4po/me4po.github.io.git
git add -A
git commit -m "feat: 迁移到 GitHub Pages + Actions，关闭评论，移除 Cloudflare 依赖"
git push -u origin main
```

推送后进入仓库 **Actions** 页可看构建；也可以完全不看，等 1～2 分钟后直接访问站点。

**GitHub 网页打不开时**：HTTP 代理不稳定会让 `git push` 报 `CONNECT tunnel failed`。
优先改用 SSH over 443（对应 PRD SOP-03 的降级路径）：

```bash
# ~/.ssh/config
Host github.com
  Hostname ssh.github.com
  Port 443
  User git

git remote set-url origin git@github.com:me4po/me4po.github.io.git
```

## 4. 构建流程（`.github/workflows/hugo.yml`）

```
push main
  → checkout
  → 安装 Hugo 0.147.7（与本地 hugo147 同版本）
  → actions/configure-pages 读取站点元信息
  → hugo --minify --baseURL https://me4po.github.io/
  → upload-pages-artifact（上传 public/）
  → deploy-pages（发布到 Pages）
```

要点：

- **版本固定 0.147.7**：本地 `hugo147` 与线上一致，避免“本地能构建、线上报错”。
- Hugo 构建在云端，本地无需安装 Hugo 也能发布。
- `public/` 已在 `.gitignore`，不进入仓库。
- 时区：Actions 按 UTC 构建，`hugo.toml` 的 `buildFuture = true` 已规避“当天文章被判为未来”。
- 构建失败可在仓库 **Actions** 页看日志；同一页也有 **Re-run jobs**。

## 5. 验收

```bash
DOMAIN=https://me4po.github.io

curl -s -o /dev/null -w "首页      %{http_code}\n" $DOMAIN/
curl -s -o /dev/null -w "文章页    %{http_code}\n" $DOMAIN/posts/2026-10-21-hello-terminal/
curl -s -o /dev/null -w "归档      %{http_code}\n" $DOMAIN/archives/
curl -s -o /dev/null -w "关于      %{http_code}\n" $DOMAIN/about/
curl -s -o /dev/null -w "sitemap   %{http_code}\n" $DOMAIN/sitemap.xml
curl -s -o /dev/null -w "robots    %{http_code}\n" $DOMAIN/robots.txt
curl -s -o /dev/null -w "404页     %{http_code}\n" $DOMAIN/no-such-page/
```

预期：前六项 `200`，404 页返回 `404`（内容为终端风格页面）。

- [ ] 首页样式正常，CSS 不是 404
- [ ] sitemap.xml 里的链接是 `https://me4po.github.io/...`
- [ ] 文章页不显示评论区，浏览器 Network 里没有 `/api/comments` 请求
- [ ] 手机宽度下无横向滚动

## 6. 日常发布

1. 本地编辑 `content/posts/YYYY-MM-DD-slug.md`，配图放 `static/images/<日期>/`。
2. 发布前自检：`hugo147 --minify`（期望 15 页且无 WARN/ERROR）。
3. `git add -A && git commit -m "post: 标题" && git push`。
4. 等 1～2 分钟刷新站点。

想在本机先看效果就 `hugo server`，浏览器打开 `http://localhost:1313`。

## 7. 故障排查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| Actions 报 `Get Pages site failed` / `Not Found` | Pages 没开启，或 Source 不是 GitHub Actions | 回第 2 步 |
| 工作流没触发 | 推送的不是 `main`，或 Actions 被禁用 | 确认分支；仓库 Settings → Actions 允许运行 |
| 构建报 `paginate was deprecated...` | Hugo 版本不是 0.147.7 | 检查工作流里的 `HUGO_VERSION`，本地用 `hugo147` 验证 |
| 站点 404 | 仓库名不是 `me4po.github.io`，或 Pages 未部署成功 | 改名 + 看 Actions 日志 |
| 页面能开但样式全丢 | 构建时 `baseURL` 不对 | 工作流已传 `--baseURL`；确认 `hugo.toml` 的 `baseURL` 也是 `https://me4po.github.io/` |
| 文章推上去了但页面没有 | 时区：UTC 下当天日期属“未来” | `buildFuture = true` 已开；或 front matter 写完整时间 |
| `git push` 报 `CONNECT tunnel failed 502` | 本地代理故障 | 检查代理；或改走 SSH 443（第 3 步） |
| 改了配置但站点没变 | 那次 commit 没推上去，或构建失败 | `git log origin/main..HEAD` 确认；看 Actions |

## 8. 回滚

- **内容错误**：`git revert <commit>` 后 push，Actions 自动重新部署。
- **部署异常**：Actions 里对上一次成功的 run 点 **Re-run jobs**；Pages 没有 Cloudflare 那种一键 Rollback。
- **工作流改坏**：先恢复 `.github/workflows/hugo.yml` 的历史版本，再 push。

## 9. 网络受限时的预期

- `github.io` 与 `github.com` 是不同域名，前者当前可达，不等于后者可达；两者都可能波动。
- 构建在 GitHub 服务端执行，不占用你的网络；只有 `git push` 需要你能连上 GitHub（HTTPS 或 SSH 443）。
- 若某段时间两者都不通，属于 PRD SOP-06 的降级场景：先本地写好文章，网络恢复后一次性推送。

## 附录：GitHub Pages 免费额度（GitHub Free）

| 项 | 限制 |
| --- | --- |
| 站点大小 | 1 GB |
| 月流量（软限制） | 100 GB |
| 构建 | 公开仓库 Actions 免费；每仓库每小时软限制 10 次 |
| 私有仓库 Pages | 不支持（需 GitHub Pro 及以上） |
| 自定义域名 / HTTPS | 支持；本站不需要 |

费用应为 0 元。
