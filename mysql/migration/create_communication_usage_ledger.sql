-- Migration: Create communication usage ledger and (optional) daily rollup tables
-- Purpose: Measure and expose practitioner–patient communication effort as UCs
-- Notes:
-- - Immutable ledger per message recipient for transparency and auditability
-- - No message content is stored
-- - JSON breakdown (calc_json) documents the calculation inputs and result

-- Ledger table (immutable)
CREATE TABLE IF NOT EXISTS communication_usage_ledger (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ts_utc DATETIME NOT NULL,
  org_id VARCHAR(64) NULL,
  practitioner_email VARCHAR(255) NOT NULL,
  patient_email VARCHAR(255) NOT NULL,
  thread_id VARCHAR(64) NOT NULL,
  message_id VARCHAR(64) NOT NULL,
  direction ENUM('practitioner_to_patient','patient_to_practitioner') NOT NULL,
  units INT NOT NULL,
  base_units INT NOT NULL,
  char_count INT NOT NULL DEFAULT 0,
  attachments_count INT NOT NULL DEFAULT 0,
  attachments_size_bytes BIGINT NOT NULL DEFAULT 0,
  type ENUM('text','shared_record','attachment','system') NOT NULL DEFAULT 'text',
  priority ENUM('normal','high') NOT NULL DEFAULT 'normal',
  app ENUM('patient','practitioner') NOT NULL,
  source ENUM('web','mobile') NOT NULL,
  rule_version SMALLINT NOT NULL DEFAULT 1,
  cap_applied TINYINT(1) NOT NULL DEFAULT 0,
  calc_json JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_message_direction_recipient (message_id, direction, patient_email),
  KEY idx_pp_ts (practitioner_email, patient_email, ts_utc),
  KEY idx_thread_ts (thread_id, ts_utc),
  KEY idx_patient_ts (patient_email, ts_utc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional V1.1: daily rollup for dashboards and fast range queries
CREATE TABLE IF NOT EXISTS communication_usage_daily (
  `date` DATE NOT NULL,
  practitioner_email VARCHAR(255) NOT NULL,
  patient_email VARCHAR(255) NOT NULL,
  units INT NOT NULL,
  messages INT NOT NULL,
  attachments_count INT NOT NULL,
  last_rolled_at DATETIME NOT NULL,
  PRIMARY KEY (`date`, practitioner_email, patient_email),
  KEY idx_pract_date (practitioner_email, `date`),
  KEY idx_patient_date (patient_email, `date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

