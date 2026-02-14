-- 메일 사용자: 이메일 주소 및 메일 사용 권한 (한 번만 실행)
-- 실행: mysql -u aion -p aion < sql/migrations/001_add_user_email_and_can_use_mail.sql

ALTER TABLE users ADD COLUMN email VARCHAR(255) DEFAULT NULL AFTER display_name;
ALTER TABLE users ADD COLUMN can_use_mail TINYINT(1) NOT NULL DEFAULT 0 AFTER email;
