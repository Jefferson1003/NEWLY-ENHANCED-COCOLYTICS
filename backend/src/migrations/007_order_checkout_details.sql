SET @db_name = DATABASE();

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'orders'
      AND COLUMN_NAME = 'customer_full_name'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN customer_full_name VARCHAR(160) NULL AFTER status',
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
      AND COLUMN_NAME = 'customer_contact_number'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN customer_contact_number VARCHAR(40) NULL AFTER customer_full_name',
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
      AND COLUMN_NAME = 'delivery_region'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN delivery_region VARCHAR(180) NULL AFTER customer_contact_number',
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
      AND COLUMN_NAME = 'delivery_province'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN delivery_province VARCHAR(180) NULL AFTER delivery_region',
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
      AND COLUMN_NAME = 'delivery_city'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN delivery_city VARCHAR(180) NULL AFTER delivery_province',
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
      AND COLUMN_NAME = 'delivery_barangay'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN delivery_barangay VARCHAR(180) NULL AFTER delivery_city',
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
      AND COLUMN_NAME = 'delivery_street_address'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN delivery_street_address VARCHAR(255) NULL AFTER delivery_barangay',
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
      AND COLUMN_NAME = 'delivery_full_address'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN delivery_full_address VARCHAR(600) NULL AFTER delivery_street_address',
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
      AND COLUMN_NAME = 'payment_method'
  ) = 0,
  "ALTER TABLE orders ADD COLUMN payment_method VARCHAR(40) NOT NULL DEFAULT 'cash_on_delivery' AFTER delivery_full_address",
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
      AND COLUMN_NAME = 'delivery_notes'
  ) = 0,
  'ALTER TABLE orders ADD COLUMN delivery_notes VARCHAR(600) NULL AFTER payment_method',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
