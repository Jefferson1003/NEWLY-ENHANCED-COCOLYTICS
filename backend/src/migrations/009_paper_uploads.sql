CREATE TABLE IF NOT EXISTS paper_uploads (
  id BIGINT NOT NULL AUTO_INCREMENT,
  trader_id INT NOT NULL,
  paper_type ENUM('to_cut', 'transport') NOT NULL,
  title VARCHAR(180) NOT NULL,
  description TEXT NULL,
  file_path VARCHAR(700) NOT NULL,
  original_file_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(180) NULL,
  file_size BIGINT NULL,
  status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
  review_notes VARCHAR(800) NULL,
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_paper_uploads_trader (trader_id),
  KEY idx_paper_uploads_status_type (status, paper_type),
  KEY idx_paper_uploads_created (created_at),
  CONSTRAINT fk_paper_uploads_trader
    FOREIGN KEY (trader_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_paper_uploads_reviewer
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
