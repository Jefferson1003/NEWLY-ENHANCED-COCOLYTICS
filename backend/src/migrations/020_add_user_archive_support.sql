ALTER TABLE users
  ADD COLUMN is_archived TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN archived_at DATETIME NULL AFTER is_archived;

CREATE INDEX idx_users_is_archived ON users (is_archived);
