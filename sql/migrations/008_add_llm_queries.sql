-- 실행: mysql -u aion -p aion < sql/migrations/008_add_llm_queries.sql
-- AI 질의 저장 (파인튜닝용, 카테고리별)
CREATE TABLE IF NOT EXISTS llm_queries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  question TEXT NOT NULL,
  category VARCHAR(64) NOT NULL DEFAULT 'general',
  hostname VARCHAR(128) DEFAULT NULL,
  command_or_action VARCHAR(255) DEFAULT NULL,
  success TINYINT(1) DEFAULT NULL,
  output_preview TEXT DEFAULT NULL,
  summary TEXT DEFAULT NULL,
  user_id INT UNSIGNED DEFAULT NULL,
  username VARCHAR(64) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_category (category),
  INDEX idx_created_at (created_at),
  INDEX idx_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
