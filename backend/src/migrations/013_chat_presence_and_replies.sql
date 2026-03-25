SET @users_has_last_seen := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'users'
    AND COLUMN_NAME = 'last_seen_at'
);

SET @sql_users_last_seen := IF(
  @users_has_last_seen = 0,
  'ALTER TABLE users ADD COLUMN last_seen_at TIMESTAMP NULL DEFAULT NULL AFTER profile_image_path',
  'SELECT 1'
);
PREPARE stmt_users_last_seen FROM @sql_users_last_seen;
EXECUTE stmt_users_last_seen;
DEALLOCATE PREPARE stmt_users_last_seen;

SET @messages_has_reply_to := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND COLUMN_NAME = 'reply_to_message_id'
);

SET @sql_messages_reply := IF(
  @messages_has_reply_to = 0,
  'ALTER TABLE chat_messages ADD COLUMN reply_to_message_id BIGINT NULL AFTER message_text',
  'SELECT 1'
);
PREPARE stmt_messages_reply FROM @sql_messages_reply;
EXECUTE stmt_messages_reply;
DEALLOCATE PREPARE stmt_messages_reply;

SET @messages_has_reply_index := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'chat_messages'
    AND INDEX_NAME = 'idx_chat_messages_reply_to'
);

SET @sql_messages_reply_idx := IF(
  @messages_has_reply_index = 0,
  'ALTER TABLE chat_messages ADD INDEX idx_chat_messages_reply_to (reply_to_message_id)',
  'SELECT 1'
);
PREPARE stmt_messages_reply_idx FROM @sql_messages_reply_idx;
EXECUTE stmt_messages_reply_idx;
DEALLOCATE PREPARE stmt_messages_reply_idx;

SET @messages_has_reply_fk := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = DATABASE()
    AND CONSTRAINT_NAME = 'fk_chat_messages_reply_to'
    AND TABLE_NAME = 'chat_messages'
);

SET @sql_messages_reply_fk := IF(
  @messages_has_reply_fk = 0,
  'ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_reply_to FOREIGN KEY (reply_to_message_id) REFERENCES chat_messages(id) ON DELETE SET NULL',
  'SELECT 1'
);
PREPARE stmt_messages_reply_fk FROM @sql_messages_reply_fk;
EXECUTE stmt_messages_reply_fk;
DEALLOCATE PREPARE stmt_messages_reply_fk;