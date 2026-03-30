SET @db_name = DATABASE();

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'gcash_qr_path'
  ) = 0,
  'ALTER TABLE users ADD COLUMN gcash_qr_path VARCHAR(255) NULL AFTER profile_image_path',
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
      AND COLUMN_NAME = 'payment_status'
  ) = 0,
  "ALTER TABLE orders ADD COLUMN payment_status VARCHAR(30) NOT NULL DEFAULT 'not_required' AFTER payment_method",
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
      AND COLUMN_NAME = 'payment_receipt_path'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN payment_receipt_path VARCHAR(255) NULL AFTER payment_status',
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
      AND COLUMN_NAME = 'payment_submitted_at'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN payment_submitted_at DATETIME NULL AFTER payment_receipt_path',
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
      AND COLUMN_NAME = 'payment_verified_at'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN payment_verified_at DATETIME NULL AFTER payment_submitted_at',
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
      AND COLUMN_NAME = 'payment_verified_by'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN payment_verified_by INT NULL AFTER payment_verified_at',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_payment_status'
  ) = 0,
  'CREATE INDEX idx_orders_payment_status ON orders (payment_status)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'orders'
      AND INDEX_NAME = 'idx_orders_payment_verified_by'
  ) = 0,
  'CREATE INDEX idx_orders_payment_verified_by ON orders (payment_verified_by)',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
