INSERT INTO users (full_name, email, password_hash, role, status)
VALUES
  ('System Administrator', 'admin@gmail.com', '$2b$10$I3Sunjlg0HbmkcC1AYqsZ.yW13GK/HJfJx0NKpXRmPs3sFG0D./8m', 'admin', 'accepted_client'),
  ('System Administrator', 'admin@gmail,com', '$2b$10$I3Sunjlg0HbmkcC1AYqsZ.yW13GK/HJfJx0NKpXRmPs3sFG0D./8m', 'admin', 'accepted_client')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role = 'admin',
  status = 'accepted_client';
