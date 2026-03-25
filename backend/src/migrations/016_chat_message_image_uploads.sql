SET @db_name = DATABASE();

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'chat_messages'
      AND COLUMN_NAME = 'message_image_path'
  ) = 0,
  'ALTER TABLE chat_messages ADD COLUMN message_image_path VARCHAR(255) NULL AFTER message_text',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
