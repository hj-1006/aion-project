-- 실행: mysql -u aion -p aion < sql/migrations/007_add_user_sessions.sql
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL UNIQUE,
  user_id INT NOT NULL,
  username VARCHAR(64) NOT NULL,
  login_ip VARCHAR(64) DEFAULT NULL,
  login_user_agent TEXT,
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_ip VARCHAR(64) DEFAULT NULL,
  last_seen_user_agent TEXT,
  revoked_at DATETIME DEFAULT NULL,
  revoked_by INT DEFAULT NULL,
  revoked_reason VARCHAR(255) DEFAULT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_username (username),
  INDEX idx_revoked (revoked_at)
);
