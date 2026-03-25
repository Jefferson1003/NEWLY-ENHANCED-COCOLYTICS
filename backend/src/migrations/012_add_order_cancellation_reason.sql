ALTER TABLE orders
ADD COLUMN cancellation_reason VARCHAR(500) NULL AFTER delivery_notes;
