ALTER TABLE orders
MODIFY COLUMN status ENUM('pending', 'to_ship', 'to_receive', 'completed', 'cancelled')
NOT NULL DEFAULT 'to_ship';
