-- 메일 로그 테이블 (보낸/받은 메일 저장, 검색용) - 한 번만 실행
-- 실행: mysql -u aion -p aion < sql/migrations/003_add_mail_log.sql

CREATE TABLE IF NOT EXISTS mail_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  direction ENUM('sent','received') NOT NULL DEFAULT 'sent',
  from_address VARCHAR(255) NOT NULL DEFAULT '',
  to_address VARCHAR(512) NOT NULL DEFAULT '',
  subject VARCHAR(512) NOT NULL DEFAULT '',
  body_text TEXT,
  body_html LONGTEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created (created_at),
  INDEX idx_direction (direction)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 검색용 FULLTEXT 인덱스 (MySQL 5.7+)
-- ALTER TABLE mail_log ADD FULLTEXT KEY ft_search (subject, body_text, from_address, to_address);
