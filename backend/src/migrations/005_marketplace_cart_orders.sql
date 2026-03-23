CREATE TABLE IF NOT EXISTS cart_items (
  id INT NOT NULL AUTO_INCREMENT,
  buyer_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uniq_cart_buyer_product (buyer_id, product_id),
  INDEX idx_cart_buyer_id (buyer_id),
  INDEX idx_cart_product_id (product_id),
  CONSTRAINT fk_cart_buyer
    FOREIGN KEY (buyer_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_cart_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
  id INT NOT NULL AUTO_INCREMENT,
  buyer_id INT NOT NULL,
  status ENUM('pending', 'to_ship', 'completed', 'cancelled') NOT NULL DEFAULT 'to_ship',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_orders_buyer_id (buyer_id),
  CONSTRAINT fk_orders_buyer
    FOREIGN KEY (buyer_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id INT NOT NULL AUTO_INCREMENT,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  trader_id INT NOT NULL,
  product_name VARCHAR(180) NOT NULL,
  size ENUM('small', 'medium', 'large') NOT NULL,
  length_cm DECIMAL(8,2) NULL,
  quantity INT NOT NULL,
  product_image_path VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  INDEX idx_order_items_order_id (order_id),
  INDEX idx_order_items_trader_id (trader_id),
  CONSTRAINT fk_order_items_order
    FOREIGN KEY (order_id) REFERENCES orders(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product
    FOREIGN KEY (product_id) REFERENCES products(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_order_items_trader
    FOREIGN KEY (trader_id) REFERENCES users(id)
    ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
