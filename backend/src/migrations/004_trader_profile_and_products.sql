ALTER TABLE users
  ADD COLUMN profile_name VARCHAR(120) NULL AFTER status,
  ADD COLUMN profile_description TEXT NULL AFTER profile_name,
  ADD COLUMN contact_number VARCHAR(40) NULL AFTER profile_description,
  ADD COLUMN business_address VARCHAR(255) NULL AFTER contact_number;

CREATE TABLE IF NOT EXISTS products (
  id INT NOT NULL AUTO_INCREMENT,
  trader_id INT NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  size ENUM('small', 'medium', 'large') NOT NULL,
  length_cm DECIMAL(8,2) NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  product_image_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_products_trader_id (trader_id),
  CONSTRAINT fk_products_trader
    FOREIGN KEY (trader_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
