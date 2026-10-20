-- D1 评论表结构（PRD v1.2 · 7.5）
-- 在 Cloudflare 控制台 → D1 → Console 执行，或用 wrangler d1 execute

CREATE TABLE IF NOT EXISTS comments (
  id         TEXT    PRIMARY KEY,
  slug       TEXT    NOT NULL,
  parent_id  TEXT,
  nickname   TEXT,
  email      TEXT,             -- 仅站长可见，公开接口不返回（NFR-016）
  content    TEXT    NOT NULL,
  status     TEXT    NOT NULL DEFAULT 'pending',   -- pending / approved / deleted
  is_admin   INTEGER NOT NULL DEFAULT 0,           -- 站长回复
  flagged    INTEGER NOT NULL DEFAULT 0,           -- 命中敏感词，需重点复核
  created_at INTEGER NOT NULL,
  ua_hash    TEXT                                  -- 限流用，不存原始 IP（NFR-016）
);

CREATE INDEX IF NOT EXISTS idx_comments_slug    ON comments (slug, status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_pending ON comments (status, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_hash    ON comments (ua_hash, created_at);

-- 常用查询示例
-- 待审队列：
--   SELECT id, slug, nickname, content, flagged, created_at
--   FROM comments WHERE status='pending' ORDER BY created_at DESC LIMIT 50;
-- 全量导出：
--   SELECT * FROM comments ORDER BY created_at ASC;
-- 清理 30 天前的已删除记录（可选）：
--   DELETE FROM comments WHERE status='deleted' AND created_at < strftime('%s','now','-30 days') * 1000;
