-- 사용자 권한 레벨(역할): viewer, user, operator, admin (한 번만 실행)
-- 실행: mysql -u aion -p aion < sql/migrations/002_add_user_role.sql

-- can_use_mail 없어도 동작하도록 AFTER 제거 (001 실행 여부와 무관)
ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user';

-- 기존 admin 계정이 있으면 역할을 admin으로 설정 (마이그레이션 후 한 번 실행 권장)
UPDATE users SET role = 'admin' WHERE username = 'admin' AND role = 'user';
