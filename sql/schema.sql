-- AION MySQL Schema
-- Run once to create database and tables

CREATE DATABASE IF NOT EXISTS aion CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE aion;

-- Users (login)
CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(128) DEFAULT NULL,
  email VARCHAR(255) DEFAULT NULL,
  can_use_mail TINYINT(1) NOT NULL DEFAULT 0,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_username (username),
  INDEX idx_role (role)
) ENGINE=InnoDB;

-- Network assets
CREATE TABLE IF NOT EXISTS assets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  device_id VARCHAR(64) NOT NULL,
  type ENUM('router','switch','server','other') DEFAULT 'router',
  location VARCHAR(128) DEFAULT NULL,
  role ENUM('hq','research','datacenter','control','other') DEFAULT 'other',
  ip VARCHAR(45) DEFAULT NULL,
  pos_x INT DEFAULT NULL,
  pos_y INT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_device_id (device_id),
  INDEX idx_role (role),
  INDEX idx_ip (ip)
) ENGINE=InnoDB;

-- VLANs / logical structure
CREATE TABLE IF NOT EXISTS vlans (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  vlan_id INT UNSIGNED NOT NULL,
  name VARCHAR(64) DEFAULT NULL,
  subnet VARCHAR(64) DEFAULT NULL,
  zone VARCHAR(64) DEFAULT NULL,
  asset_id INT UNSIGNED DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  INDEX idx_asset (asset_id)
) ENGINE=InnoDB;

-- Services / container metadata
CREATE TABLE IF NOT EXISTS services (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  version VARCHAR(32) DEFAULT NULL,
  role VARCHAR(64) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- Syslog events
CREATE TABLE IF NOT EXISTS syslog_events (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id INT UNSIGNED DEFAULT NULL,
  severity VARCHAR(16) DEFAULT NULL,
  facility VARCHAR(16) DEFAULT NULL,
  message TEXT,
  raw TEXT,
  host_from VARCHAR(255) DEFAULT NULL,
  received_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  indexed_at DATETIME DEFAULT NULL,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL,
  INDEX idx_received_asset (received_at, asset_id),
  INDEX idx_severity (severity)
) ENGINE=InnoDB;

-- Telemetry snapshots (meta/aggregate)
CREATE TABLE IF NOT EXISTS telemetry_snapshots (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  asset_id INT UNSIGNED NOT NULL,
  metric_type ENUM('cpu','mem','temp','interface','iface','traffic') NOT NULL,
  value_json JSON,
  collected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE,
  INDEX idx_asset_collected (asset_id, collected_at)
) ENGINE=InnoDB;

-- Automation logs
CREATE TABLE IF NOT EXISTS automation_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  playbook_name VARCHAR(128) DEFAULT NULL,
  extra_vars_json JSON DEFAULT NULL,
  result_summary VARCHAR(512) DEFAULT NULL,
  executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_executed (executed_at)
) ENGINE=InnoDB;

-- 메일 로그 (보낸/받은 메일 저장, 검색용)
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

-- User sessions (login tracking + forced logout)
CREATE TABLE IF NOT EXISTS user_sessions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(128) NOT NULL UNIQUE,
  user_id INT UNSIGNED NOT NULL,
  username VARCHAR(64) NOT NULL,
  login_ip VARCHAR(64) DEFAULT NULL,
  login_user_agent TEXT,
  login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_ip VARCHAR(64) DEFAULT NULL,
  last_seen_user_agent TEXT,
  revoked_at DATETIME DEFAULT NULL,
  revoked_by INT UNSIGNED DEFAULT NULL,
  revoked_reason VARCHAR(255) DEFAULT NULL,
  INDEX idx_user_id (user_id),
  INDEX idx_username (username),
  INDEX idx_revoked (revoked_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- AI 질의 로그 (파인튜닝용, 카테고리별)
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

-- Default admin is created by app on first run (see services/authService.js)
