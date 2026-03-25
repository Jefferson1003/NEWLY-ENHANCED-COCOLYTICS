CREATE TABLE IF NOT EXISTS chat_call_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  conversation_id INT NOT NULL,
  caller_id INT NOT NULL,
  callee_id INT NOT NULL,
  call_mode ENUM('audio', 'video') NOT NULL DEFAULT 'audio',
  status ENUM('ringing', 'completed', 'missed', 'declined', 'cancelled') NOT NULL DEFAULT 'ringing',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  answered_at TIMESTAMP NULL DEFAULT NULL,
  ended_at TIMESTAMP NULL DEFAULT NULL,
  duration_seconds INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_call_logs_conversation_started (conversation_id, started_at),
  KEY idx_call_logs_caller_started (caller_id, started_at),
  KEY idx_call_logs_callee_started (callee_id, started_at),
  CONSTRAINT fk_call_logs_conversation
    FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_call_logs_caller
    FOREIGN KEY (caller_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_call_logs_callee
    FOREIGN KEY (callee_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;