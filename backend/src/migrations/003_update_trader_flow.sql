UPDATE users
SET
  role = 'client',
  status = 'accepted_client'
WHERE status = 'pending_staff';

UPDATE users
SET
  role = 'trader',
  status = 'trader'
WHERE role = 'staff' OR status = 'staff';

ALTER TABLE users
MODIFY COLUMN role ENUM('admin', 'client', 'trader') NOT NULL DEFAULT 'client';

ALTER TABLE users
MODIFY COLUMN status ENUM('pending_client', 'accepted_client', 'pending_staff', 'trader') NOT NULL DEFAULT 'pending_client';
