SET @db_name = DATABASE();

SET @sql = IF(
  (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = @db_name
      AND TABLE_NAME = 'products'
      AND COLUMN_NAME = 'unit_price'
  ) = 0,
  'ALTER TABLE products ADD COLUMN unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER length_cm',
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
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'unit_price'
  ) = 0,
  'ALTER TABLE order_items ADD COLUMN unit_price DECIMAL(12,2) NOT NULL DEFAULT 0.00 AFTER length_cm',
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
      AND TABLE_NAME = 'order_items'
      AND COLUMN_NAME = 'line_total'
  ) = 0,
  'ALTER TABLE order_items ADD COLUMN line_total DECIMAL(14,2) NOT NULL DEFAULT 0.00 AFTER quantity',
  'SELECT 1'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

UPDATE order_items oi
INNER JOIN products p ON p.id = oi.product_id
SET
  oi.unit_price = CASE WHEN oi.unit_price = 0 THEN COALESCE(p.unit_price, 0) ELSE oi.unit_price END,
  oi.line_total = CASE
    WHEN oi.line_total = 0 THEN ROUND(oi.quantity * (CASE WHEN oi.unit_price = 0 THEN COALESCE(p.unit_price, 0) ELSE oi.unit_price END), 2)
    ELSE oi.line_total
  END;
