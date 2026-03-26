SET @db_name = DATABASE();

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'buyer_rating'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN buyer_rating TINYINT UNSIGNED NULL AFTER cancellation_reason',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'buyer_review'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN buyer_review VARCHAR(600) NULL AFTER buyer_rating',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'buyer_rated_at'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN buyer_rated_at DATETIME NULL AFTER buyer_review',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
