-- metric_type 컬럼에 'iface', 'traffic' 추가 (Data truncated 오류 해결)
-- 실행: mysql -u root -p aion < sql/migrate-telemetry-metric-type.sql
ALTER TABLE telemetry_snapshots
  MODIFY COLUMN metric_type ENUM('cpu','mem','temp','interface','iface','traffic') NOT NULL;
