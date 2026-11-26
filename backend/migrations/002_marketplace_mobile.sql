-- Marketplace mobile flow: account roles, customer locations, meeting proof.

SET @role_column_exists = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'marketplace_role'
);
SET @role_sql = IF(
  @role_column_exists = 0,
  'ALTER TABLE users ADD COLUMN marketplace_role ENUM(''user'',''agent'') NOT NULL DEFAULT ''user'' AFTER account_type',
  'SELECT 1'
);
PREPARE role_stmt FROM @role_sql;
EXECUTE role_stmt;
DEALLOCATE PREPARE role_stmt;

CREATE TABLE IF NOT EXISTS user_locations (
  user_id BIGINT UNSIGNED NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  accuracy DECIMAL(8,2) DEFAULT NULL,
  heading DECIMAL(6,2) DEFAULT NULL,
  speed DECIMAL(8,2) DEFAULT NULL,
  mocked TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_location_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_meetings (
  meeting_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  agent_id BIGINT UNSIGNED NOT NULL,
  distance_m DECIMAL(10,2) NOT NULL,
  customer_lat DECIMAL(10,7) DEFAULT NULL,
  customer_lng DECIMAL(10,7) DEFAULT NULL,
  agent_lat DECIMAL(10,7) DEFAULT NULL,
  agent_lng DECIMAL(10,7) DEFAULT NULL,
  met_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (meeting_id),
  UNIQUE KEY uq_meeting_transaction (transaction_id),
  KEY idx_meeting_customer (customer_id, met_at),
  KEY idx_meeting_agent (agent_id, met_at),
  CONSTRAINT fk_meeting_transaction FOREIGN KEY (transaction_id) REFERENCES mm_transactions (transaction_id) ON DELETE CASCADE,
  CONSTRAINT fk_meeting_customer FOREIGN KEY (customer_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_meeting_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO mm_settings (setting_key, setting_value, description) VALUES
  ('meeting_radius_m', '1', 'Maximum distance in metres for recording a physical meeting'),
  ('nearby_search_radius_km', '10', 'Radius used to show available agents around a customer'),
  ('nearby_agent_limit', '12', 'Maximum number of nearby agents returned to a customer')
ON DUPLICATE KEY UPDATE setting_key = setting_key;
