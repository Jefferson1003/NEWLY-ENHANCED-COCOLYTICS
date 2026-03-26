ALTER TABLE orders
ADD COLUMN dispatch_date DATETIME NULL AFTER status;
