-- AION MySQL 사용자 생성 (root로 실행)
-- 실행: mysql -u root -p < sql/create-user.sql
-- .env 의 MYSQL_USER / MYSQL_PASSWORD 와 맞춰야 함 (기본: aion / aion_secret)

CREATE DATABASE IF NOT EXISTS aion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 사용자 없으면 생성, 있으면 비밀번호만 맞춤
CREATE USER IF NOT EXISTS 'aion'@'localhost';
ALTER USER 'aion'@'localhost' IDENTIFIED BY 'aion_secret';
GRANT ALL PRIVILEGES ON aion.* TO 'aion'@'localhost';
FLUSH PRIVILEGES;
