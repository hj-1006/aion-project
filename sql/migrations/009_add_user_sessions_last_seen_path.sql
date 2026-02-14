-- 실행: mysql -u aion -p aion < sql/migrations/009_add_user_sessions_last_seen_path.sql
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS last_seen_path VARCHAR(512) DEFAULT NULL AFTER last_seen_user_agent;
