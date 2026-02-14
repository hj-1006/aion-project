-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: aion
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `assets`
--

DROP TABLE IF EXISTS `assets`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `assets` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `device_id` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `type` enum('router','switch','other') COLLATE utf8mb4_unicode_ci DEFAULT 'router',
  `location` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` enum('hq','research','datacenter','control','other') COLLATE utf8mb4_unicode_ci DEFAULT 'other',
  `ip` varchar(45) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `interface_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `pos_x` int DEFAULT NULL,
  `pos_y` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_device_id` (`device_id`),
  KEY `idx_role` (`role`),
  KEY `idx_ip` (`ip`)
) ENGINE=InnoDB AUTO_INCREMENT=99 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `assets`
--

LOCK TABLES `assets` WRITE;
/*!40000 ALTER TABLE `assets` DISABLE KEYS */;
INSERT INTO `assets` VALUES (22,'ISP_R1','router',NULL,'other','172.16.1.1','GigaEthernet 0/0','2026-02-07 17:46:19',60,44),(23,'ISP_R1','router',NULL,'other','172.16.0.1','Serial 0/0/0','2026-02-07 17:46:19',60,44),(24,'ISP_R1','router',NULL,'other','8.8.8.8','Loopback 0','2026-02-07 17:46:19',60,44),(25,'ISP_R2','router',NULL,'other','172.16.4.1','GigaEthernet 0/0','2026-02-07 17:46:19',322,49),(26,'ISP_R2','router',NULL,'other','52.219.60.1','GigaEthernet 0/1','2026-02-07 17:46:19',322,49),(27,'ISP_R2','router',NULL,'other','172.16.0.2','Serial 0/0/0','2026-02-07 17:46:19',322,49),(28,'ISP_R2','router',NULL,'other','8.8.4.4','Loopback 0','2026-02-07 17:46:19',322,49),(29,'BB_L3SW1','switch',NULL,'other','172.16.1.2','FastEthernet 0/1','2026-02-07 17:46:19',58,145),(30,'BB_L3SW1','switch',NULL,'other','172.16.2.1','FastEthernet 0/2','2026-02-07 17:46:19',58,145),(31,'BB_L3SW1','switch',NULL,'other','172.16.7.1','FastEthernet 0/3','2026-02-07 17:46:19',58,145),(32,'BB_L3SW1','switch',NULL,'other',NULL,'FastEthernet 0/4','2026-02-07 17:46:19',58,145),(33,'BB_L3SW1','switch',NULL,'other',NULL,'FastEthernet 0/5','2026-02-07 17:46:19',58,145),(34,'BB_L3SW1','switch',NULL,'other','172.16.200.2','VLAN 200 (SVI)','2026-02-07 17:46:19',58,145),(35,'BB_L3SW1','switch',NULL,'other','172.16.255.2','VLAN 255 (SVI)','2026-02-07 17:46:19',58,145),(36,'BB_L3SW2','switch',NULL,'other','172.16.4.2','FastEthernet 0/1','2026-02-07 17:46:19',320,143),(37,'BB_L3SW2','switch',NULL,'other','172.16.5.1','FastEthernet 0/2','2026-02-07 17:46:19',320,143),(38,'BB_L3SW2','switch',NULL,'other','172.16.7.2','FastEthernet 0/3','2026-02-07 17:46:19',320,143),(39,'BB_L3SW2','switch',NULL,'other',NULL,'FastEthernet 0/4','2026-02-07 17:46:19',320,143),(40,'BB_L3SW2','switch',NULL,'other',NULL,'FastEthernet 0/5','2026-02-07 17:46:19',320,143),(41,'BB_L3SW2','switch',NULL,'other','172.16.200.3','VLAN 200 (SVI)','2026-02-07 17:46:19',320,143),(42,'BB_L3SW2','switch',NULL,'other','172.16.255.3','VLAN 255 (SVI)','2026-02-07 17:46:19',320,143),(43,'BB_R1','router',NULL,'other','172.16.2.2','GigaEthernet 0/0','2026-02-07 17:46:19',59,239),(44,'BB_R1','router',NULL,'other','172.16.3.1','GigaEthernet 0/1','2026-02-07 17:46:19',59,239),(45,'BB_R1','router',NULL,'other','172.16.8.1','Serial 0/0/0','2026-02-07 17:46:19',59,239),(46,'BB_R2','router',NULL,'other','172.16.5.2','GigaEthernet 0/0','2026-02-07 17:46:19',320,240),(47,'BB_R2','router',NULL,'other','172.16.6.1','GigaEthernet 0/1','2026-02-07 17:46:19',320,240),(48,'BB_R2','router',NULL,'other','172.16.8.2','Serial 0/0/0','2026-02-07 17:46:19',320,240),(49,'LAB_L3SW1','switch',NULL,'other','172.16.3.2','FastEthernet 0/1','2026-02-07 17:46:19',61,327),(50,'LAB_L3SW1','switch',NULL,'other',NULL,'FastEthernet 0/2','2026-02-07 17:46:19',61,327),(51,'LAB_L3SW1','switch',NULL,'other',NULL,'FastEthernet 0/3','2026-02-07 17:46:19',61,327),(52,'LAB_L3SW1','switch',NULL,'other',NULL,'FastEthernet 0/4','2026-02-07 17:46:19',61,327),(53,'LAB_L3SW1','switch',NULL,'other',NULL,'FastEthernet 0/5','2026-02-07 17:46:19',61,327),(54,'LAB_L3SW1','switch',NULL,'other',NULL,'FastEthernet 0/6','2026-02-07 17:46:19',61,327),(55,'LAB_L3SW1','switch',NULL,'other','172.16.9.1','VLAN 7 (SVI)','2026-02-07 17:46:19',61,327),(56,'LAB_L3SW1','switch',NULL,'other','10.6.0.2','VLAN 10 (SVI)','2026-02-07 17:46:19',61,327),(57,'LAB_L3SW1','switch',NULL,'other','192.168.200.2','VLAN 200 (SVI)','2026-02-07 17:46:19',61,327),(58,'LAB_L3SW2','switch',NULL,'other','172.16.6.2','FastEthernet 0/1','2026-02-07 17:46:19',322,331),(59,'LAB_L3SW2','switch',NULL,'other',NULL,'FastEthernet 0/2','2026-02-07 17:46:19',322,331),(60,'LAB_L3SW2','switch',NULL,'other',NULL,'FastEthernet 0/3','2026-02-07 17:46:19',322,331),(61,'LAB_L3SW2','switch',NULL,'other',NULL,'FastEthernet 0/4','2026-02-07 17:46:19',322,331),(62,'LAB_L3SW2','switch',NULL,'other',NULL,'FastEthernet 0/5','2026-02-07 17:46:19',322,331),(63,'LAB_L3SW2','switch',NULL,'other',NULL,'FastEthernet 0/6','2026-02-07 17:46:19',322,331),(64,'LAB_L3SW2','switch',NULL,'other','172.16.9.2','VLAN 7 (SVI)','2026-02-07 17:46:19',322,331),(65,'LAB_L3SW2','switch',NULL,'other','10.6.0.3','VLAN 10 (SVI)','2026-02-07 17:46:19',322,331),(66,'LAB_L3SW2','switch',NULL,'other','192.168.200.3','VLAN 200 (SVI)','2026-02-07 17:46:19',322,331),(67,'Management_L2SW1','switch',NULL,'control',NULL,'FastEthernet 0/1','2026-02-07 17:46:19',-79,47),(68,'Management_L2SW1','switch',NULL,'control',NULL,'FastEthernet 0/2','2026-02-07 17:46:19',-79,47),(69,'Management_L2SW1','switch',NULL,'control',NULL,'FastEthernet 0/3','2026-02-07 17:46:19',-79,47),(70,'Management_L2SW1','switch',NULL,'control',NULL,'FastEthernet 0/13','2026-02-07 17:46:19',-79,47),(71,'Management_L2SW1','switch',NULL,'control','172.16.255.253','VLAN 255 (SVI)','2026-02-07 17:46:19',-79,47),(72,'Management_L2SW2','switch',NULL,'control',NULL,'FastEthernet 0/1','2026-02-07 17:46:19',-77,221),(73,'Management_L2SW2','switch',NULL,'control',NULL,'FastEthernet 0/2','2026-02-07 17:46:20',-77,221),(74,'Management_L2SW2','switch',NULL,'control',NULL,'FastEthernet 0/3','2026-02-07 17:46:20',-77,221),(75,'Management_L2SW2','switch',NULL,'control',NULL,'FastEthernet 0/13','2026-02-07 17:46:20',-77,221),(76,'Management_L2SW2','switch',NULL,'control',NULL,'FastEthernet 0/14','2026-02-07 17:46:20',-77,221),(77,'Management_L2SW2','switch',NULL,'control','172.16.255.254','VLAN 255 (SVI)','2026-02-07 17:46:20',-77,221),(78,'Research_L2SW1','switch',NULL,'research',NULL,'FastEthernet 0/1','2026-02-07 17:46:20',584,432),(79,'Research_L2SW1','switch',NULL,'research',NULL,'FastEthernet 0/2','2026-02-07 17:46:20',584,432),(80,'Research_L2SW1','switch',NULL,'research',NULL,'FastEthernet 0/13','2026-02-07 17:46:20',584,432),(81,'Research_L2SW1','switch',NULL,'research',NULL,'FastEthernet 0/14','2026-02-07 17:46:20',584,432),(82,'Research_L2SW1','switch',NULL,'research',NULL,'FastEthernet 0/15','2026-02-07 17:46:20',584,432),(83,'Research_L2SW1','switch',NULL,'research',NULL,'FastEthernet 0/16','2026-02-07 17:46:20',584,432),(84,'Research_L2SW1','switch',NULL,'research','10.6.10.254','VLAN 10 (SVI)','2026-02-07 17:46:20',584,432),(85,'Server_L2SW1','switch',NULL,'datacenter',NULL,'FastEthernet 0/1','2026-02-07 17:46:20',61,428),(86,'Server_L2SW1','switch',NULL,'datacenter',NULL,'FastEthernet 0/2','2026-02-07 17:46:20',61,428),(87,'Server_L2SW1','switch',NULL,'datacenter',NULL,'FastEthernet 0/3','2026-02-07 17:46:20',61,428),(88,'Server_L2SW1','switch',NULL,'datacenter',NULL,'FastEthernet 0/13','2026-02-07 17:46:20',61,428),(89,'Server_L2SW1','switch',NULL,'datacenter',NULL,'FastEthernet 0/14','2026-02-07 17:46:20',61,428),(90,'Server_L2SW1','switch',NULL,'datacenter','192.168.200.253','VLAN 200 (SVI)','2026-02-07 17:46:20',61,428),(91,'Server_L2SW2','switch',NULL,'datacenter',NULL,'FastEthernet 0/1','2026-02-07 17:46:20',326,430),(92,'Server_L2SW2','switch',NULL,'datacenter',NULL,'FastEthernet 0/2','2026-02-07 17:46:20',326,430),(93,'Server_L2SW2','switch',NULL,'datacenter',NULL,'FastEthernet 0/3','2026-02-07 17:46:20',326,430),(94,'Server_L2SW2','switch',NULL,'datacenter',NULL,'FastEthernet 0/13','2026-02-07 17:46:20',326,430),(95,'Server_L2SW2','switch',NULL,'datacenter',NULL,'FastEthernet 0/14','2026-02-07 17:46:20',326,430),(96,'Server_L2SW2','switch',NULL,'datacenter','192.168.200.254','VLAN 200 (SVI)','2026-02-07 17:46:20',326,430),(97,'AWS_CLOUD','other',NULL,'research','52.219.60.200',NULL,'2026-02-07 19:19:49',523,39),(98,'Server_Primary_server','other',NULL,'research','192.168.200.200',NULL,'2026-02-07 19:25:45',-91,440);
/*!40000 ALTER TABLE `assets` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `automation_logs`
--

DROP TABLE IF EXISTS `automation_logs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `automation_logs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `playbook_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `extra_vars_json` json DEFAULT NULL,
  `result_summary` varchar(512) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `executed_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_executed` (`executed_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `automation_logs`
--

LOCK TABLES `automation_logs` WRITE;
/*!40000 ALTER TABLE `automation_logs` DISABLE KEYS */;
/*!40000 ALTER TABLE `automation_logs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `mail_log`
--

DROP TABLE IF EXISTS `mail_log`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `mail_log` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `direction` enum('sent','received') NOT NULL DEFAULT 'sent',
  `from_address` varchar(255) NOT NULL DEFAULT '',
  `to_address` varchar(512) NOT NULL DEFAULT '',
  `subject` varchar(512) NOT NULL DEFAULT '',
  `body_text` text,
  `body_html` longtext,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_created` (`created_at`),
  KEY `idx_direction` (`direction`)
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `mail_log`
--

LOCK TABLES `mail_log` WRITE;
/*!40000 ALTER TABLE `mail_log` DISABLE KEYS */;
INSERT INTO `mail_log` VALUES (1,'sent','admin@aion.cisco.com','admin@aion.cisco.com','21','221',NULL,'2026-02-05 08:46:58'),(2,'sent','admin@aion.cisco.com','janghyunjun@aion.cisco.com','안녕?','하세요',NULL,'2026-02-05 08:47:16'),(3,'sent','janghyunjun@aion.cisco.com','admin@aion.cisco.com','안녕하세요','테스트 내용',NULL,'2026-02-05 08:47:51'),(4,'sent','admin@aion.cisco.com','janghyunjun@aion.cisco.com','131132','123213',NULL,'2026-02-05 09:09:59'),(5,'sent','admin@aion.cisco.com','janghyunjun@aion.cisco.com','안녕하세요 장현준님','01010101010110111',NULL,'2026-02-05 09:27:20'),(6,'sent','janghyunjun@aion.com','dlwoqja2996@aion.com','안녕하세\\요','21',NULL,'2026-02-07 18:46:48'),(7,'sent','dlwoqja2996@aion.com','janghyunjun@aion.com','cisco 기밀문서','북파공작원 침입 Warning!',NULL,'2026-02-07 18:47:39'),(8,'sent','zzic@aion.com','janghyunjun@aion.com','ㅋㅋ','ㅋㅋㅎㅇ',NULL,'2026-02-07 18:53:53'),(9,'sent','dlwoqja2996@aion.com','zzic@aion.com','cisco 기밀','북파공작원 침입',NULL,'2026-02-07 18:54:20'),(10,'sent','sicksick@aion.com','janghyunjun@aion.com','너무하네','고만하세요',NULL,'2026-02-07 19:39:48'),(11,'sent','sicksick@aion.com','janghyunjun@aion.com','너무하네','고만하세요',NULL,'2026-02-07 19:39:51'),(12,'sent','sicksick@aion.com','janghyunjun@aion.com','너무하네','고만하세요',NULL,'2026-02-07 19:39:51'),(13,'sent','sicksick@aion.com','janghyunjun@aion.com','너무하네','고만하세요',NULL,'2026-02-07 19:39:51'),(14,'sent','sicksick@aion.com','janghyunjun@aion.com','너무하네','고만하세요',NULL,'2026-02-07 19:39:52'),(15,'sent','sicksick@aion.com','janghyunjun@aion.com','너무하네','고만하세요',NULL,'2026-02-07 19:39:52'),(16,'sent','janghyunjun@aion.com','sicksick@aion.com','안녕하세요','반가워요!~',NULL,'2026-02-07 19:41:21');
/*!40000 ALTER TABLE `mail_log` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `services`
--

DROP TABLE IF EXISTS `services`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `services` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `version` varchar(32) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `role` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `services`
--

LOCK TABLES `services` WRITE;
/*!40000 ALTER TABLE `services` DISABLE KEYS */;
/*!40000 ALTER TABLE `services` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `syslog_events`
--

DROP TABLE IF EXISTS `syslog_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `syslog_events` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `asset_id` int unsigned DEFAULT NULL,
  `severity` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `facility` varchar(16) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `message` text COLLATE utf8mb4_unicode_ci,
  `raw` text COLLATE utf8mb4_unicode_ci,
  `host_from` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `received_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `indexed_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `asset_id` (`asset_id`),
  KEY `idx_received_asset` (`received_at`,`asset_id`),
  KEY `idx_severity` (`severity`),
  CONSTRAINT `syslog_events_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `syslog_events`
--

LOCK TABLES `syslog_events` WRITE;
/*!40000 ALTER TABLE `syslog_events` DISABLE KEYS */;
/*!40000 ALTER TABLE `syslog_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `telemetry_snapshots`
--

DROP TABLE IF EXISTS `telemetry_snapshots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `telemetry_snapshots` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `asset_id` int unsigned NOT NULL,
  `metric_type` enum('cpu','mem','temp','interface') COLLATE utf8mb4_unicode_ci NOT NULL,
  `value_json` json DEFAULT NULL,
  `collected_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asset_collected` (`asset_id`,`collected_at`),
  CONSTRAINT `telemetry_snapshots_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `telemetry_snapshots`
--

LOCK TABLES `telemetry_snapshots` WRITE;
/*!40000 ALTER TABLE `telemetry_snapshots` DISABLE KEYS */;
/*!40000 ALTER TABLE `telemetry_snapshots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_sessions`
--

DROP TABLE IF EXISTS `user_sessions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_sessions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `session_id` varchar(128) COLLATE utf8mb4_unicode_ci NOT NULL,
  `user_id` int NOT NULL,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `login_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `login_user_agent` text COLLATE utf8mb4_unicode_ci,
  `login_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_seen_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `last_seen_ip` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `last_seen_user_agent` text COLLATE utf8mb4_unicode_ci,
  `revoked_at` datetime DEFAULT NULL,
  `revoked_by` int DEFAULT NULL,
  `revoked_reason` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `session_id` (`session_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_username` (`username`),
  KEY `idx_revoked` (`revoked_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_sessions`
--

LOCK TABLES `user_sessions` WRITE;
/*!40000 ALTER TABLE `user_sessions` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_sessions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `username` varchar(64) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `display_name` varchar(128) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `can_use_mail` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  PRIMARY KEY (`id`),
  KEY `idx_username` (`username`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'admin','$2b$10$/kvs0D.2Guyi4piTe6xnRexFeLWSmX5BFT6KHV0QkKHDn6uCenlUW','AION Admin','admin@aion.com',1,'2026-02-04 16:50:55','admin'),(2,'user01','$2b$10$nRpXh1qxXtYXzsGlGKwyee3QMke6KvkHiUqQfLZ1AEBWfUtOvl5wa','유저1','user@aion.com',1,'2026-02-05 01:26:23','user'),(3,'janghyunjun','$2b$10$6H63jmaDV97NI7wPFtwViee3pznvI3wkSykzVF3nCel2Sq2Re4AcW','장현준','janghyunjun@aion.com',1,'2026-02-05 01:26:43','admin'),(4,'dlwoqja','$2b$10$Ox9/SoidjDyqFnXM3NYHWeqcU.EXQ9awNS/uQZge/GJRAkSW/Tu72','이재범','dlwoqja2996@aion.com',1,'2026-02-07 18:46:19','admin'),(5,'zzic','$2b$10$qJos3yLbZFH6Fky0UtlM1eepAJrTSzYoi6tO0zGv96FVu3Heb.yOW','임창열','zzic@aion.com',1,'2026-02-07 18:51:27','operator'),(6,'secer','$2b$10$CtOI5HMS2QVGynb25dKu9OQYXBHLcMtRP0WzpB19c7CPCa6/r/gRW','정지우','sicksick@aion.com',1,'2026-02-07 19:38:39','admin');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vlans`
--

DROP TABLE IF EXISTS `vlans`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vlans` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `vlan_id` int unsigned NOT NULL,
  `name` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subnet` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `zone` varchar(64) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `asset_id` int unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_asset` (`asset_id`),
  CONSTRAINT `vlans_ibfk_1` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vlans`
--

LOCK TABLES `vlans` WRITE;
/*!40000 ALTER TABLE `vlans` DISABLE KEYS */;
/*!40000 ALTER TABLE `vlans` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-02-08  1:34:07
