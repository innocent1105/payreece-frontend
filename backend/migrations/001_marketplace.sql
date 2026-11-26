-- Marketplace migration 001 — additive, re-runnable.
-- Target: existing Payreece `payper` schema (InnoDB, utf8mb4_general_ci, BIGINT UNSIGNED users).

CREATE TABLE IF NOT EXISTS mm_settings (
  setting_key VARCHAR(80) NOT NULL,
  setting_value TEXT NOT NULL,
  description VARCHAR(255) DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_fee_schedule (
  fee_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  network ENUM('ALL','MTN','AIRTEL','ZAMTEL') NOT NULL DEFAULT 'ALL',
  direction ENUM('withdrawal','deposit') NOT NULL,
  min_amount DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  max_amount DECIMAL(14,2) NOT NULL DEFAULT 999999999999.99,
  flat_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  percent_fee DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  agent_flat DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  agent_percent DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (fee_id),
  UNIQUE KEY uq_mm_fee_band (network, direction, min_amount, max_amount),
  KEY idx_mm_fee_lookup (network, direction, active, min_amount)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS agent_profiles (
  agent_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  business_name VARCHAR(150) NOT NULL,
  address_text VARCHAR(255) NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  nrc_number VARCHAR(50) NOT NULL,
  nrc_front_path VARCHAR(255) DEFAULT NULL,
  nrc_back_path VARCHAR(255) DEFAULT NULL,
  selfie_path VARCHAR(255) DEFAULT NULL,
  vehicle_description VARCHAR(120) DEFAULT NULL,
  verification_status ENUM('pending','verified','rejected','suspended') NOT NULL DEFAULT 'pending',
  rejection_reason VARCHAR(255) DEFAULT NULL,
  reviewed_by BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at TIMESTAMP NULL DEFAULT NULL,
  availability ENUM('available','busy','offline') NOT NULL DEFAULT 'offline',
  acceptance_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  rating_avg DECIMAL(3,2) NOT NULL DEFAULT 0.00,
  rating_count INT UNSIGNED NOT NULL DEFAULT 0,
  completed_count INT UNSIGNED NOT NULL DEFAULT 0,
  cancelled_count INT UNSIGNED NOT NULL DEFAULT 0,
  dispute_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (agent_id),
  UNIQUE KEY uq_agent_user (user_id),
  KEY idx_agent_verification (verification_status, availability),
  KEY idx_agent_location (lat, lng),
  CONSTRAINT fk_agent_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_agent_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS agent_networks (
  network_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id BIGINT UNSIGNED NOT NULL,
  network ENUM('MTN','AIRTEL','ZAMTEL') NOT NULL,
  agent_code VARCHAR(100) DEFAULT NULL,
  min_amount DECIMAL(14,2) NOT NULL DEFAULT 10.00,
  max_amount DECIMAL(14,2) NOT NULL DEFAULT 5000.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (network_id),
  UNIQUE KEY uq_agent_network (agent_id, network),
  KEY idx_agent_network_lookup (network, deleted_at),
  CONSTRAINT fk_agent_networks_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS agent_liquidity (
  liquidity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id BIGINT UNSIGNED NOT NULL,
  network ENUM('MTN','AIRTEL','ZAMTEL') NOT NULL,
  cash_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  cash_reserved DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  float_balance DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  float_reserved DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (liquidity_id),
  UNIQUE KEY uq_agent_liquidity (agent_id, network),
  CONSTRAINT fk_liquidity_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS liquidity_ledger (
  ledger_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id BIGINT UNSIGNED NOT NULL,
  network ENUM('MTN','AIRTEL','ZAMTEL') NOT NULL,
  side ENUM('cash','float') NOT NULL,
  before_amount DECIMAL(14,2) NOT NULL,
  after_amount DECIMAL(14,2) NOT NULL,
  delta_amount DECIMAL(14,2) NOT NULL,
  reserved_before DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  reserved_after DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  reserved_delta DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  reason VARCHAR(80) NOT NULL,
  ref_type VARCHAR(40) DEFAULT NULL,
  ref_id BIGINT UNSIGNED DEFAULT NULL,
  actor_type ENUM('agent','customer','system','admin') NOT NULL DEFAULT 'system',
  actor_id BIGINT UNSIGNED DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ledger_id),
  KEY idx_ledger_agent_created (agent_id, created_at),
  KEY idx_ledger_ref (ref_type, ref_id),
  CONSTRAINT fk_ledger_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS agent_locations (
  agent_id BIGINT UNSIGNED NOT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  accuracy DECIMAL(8,2) DEFAULT NULL,
  heading DECIMAL(6,2) DEFAULT NULL,
  speed DECIMAL(8,2) DEFAULT NULL,
  mocked TINYINT(1) NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (agent_id),
  KEY idx_agent_loc_coords (lat, lng),
  CONSTRAINT fk_agent_location_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS agent_location_history (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  agent_id BIGINT UNSIGNED NOT NULL,
  transaction_id BIGINT UNSIGNED DEFAULT NULL,
  lat DECIMAL(10,7) NOT NULL,
  lng DECIMAL(10,7) NOT NULL,
  accuracy DECIMAL(8,2) DEFAULT NULL,
  heading DECIMAL(6,2) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id),
  KEY idx_agent_hist_agent_created (agent_id, created_at),
  KEY idx_agent_hist_tx (transaction_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS liquidity_reservations (
  reservation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  agent_id BIGINT UNSIGNED NOT NULL,
  network ENUM('MTN','AIRTEL','ZAMTEL') NOT NULL,
  side ENUM('cash','float') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  state ENUM('active','settled','released','expired') NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP NULL DEFAULT NULL,
  settled_at TIMESTAMP NULL DEFAULT NULL,
  released_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (reservation_id),
  UNIQUE KEY uq_reservation_request (request_id),
  KEY idx_reservation_state_expires (state, expires_at),
  KEY idx_reservation_agent_state (agent_id, state),
  CONSTRAINT fk_reservation_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_requests (
  request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  public_id CHAR(36) NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  direction ENUM('withdrawal','deposit') NOT NULL,
  network ENUM('MTN','AIRTEL','ZAMTEL') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  pickup_lat DECIMAL(10,7) NOT NULL,
  pickup_lng DECIMAL(10,7) NOT NULL,
  pickup_address VARCHAR(255) NOT NULL,
  state ENUM('searching','matched','cancelled','expired','completed','disputed') NOT NULL DEFAULT 'searching',
  platform_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  agent_commission DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  search_deadline TIMESTAMP NOT NULL,
  active_flag TINYINT(1) AS (CASE WHEN state IN ('searching','matched') THEN 1 ELSE NULL END) VIRTUAL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (request_id),
  UNIQUE KEY uq_mm_request_public (public_id),
  UNIQUE KEY uq_mm_request_active_customer (customer_id, active_flag),
  KEY idx_mm_request_state_created (state, created_at),
  CONSTRAINT fk_mm_request_customer FOREIGN KEY (customer_id) REFERENCES users (user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_offers (
  offer_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  agent_id BIGINT UNSIGNED NOT NULL,
  attempt_no INT UNSIGNED NOT NULL DEFAULT 1,
  state ENUM('offered','accepted','rejected','expired','cancelled') NOT NULL DEFAULT 'offered',
  distance_m DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  eta_minutes INT UNSIGNED NOT NULL DEFAULT 0,
  expected_earning DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  visible_lat DECIMAL(10,7) DEFAULT NULL,
  visible_lng DECIMAL(10,7) DEFAULT NULL,
  expires_at TIMESTAMP NOT NULL,
  responded_at TIMESTAMP NULL DEFAULT NULL,
  pending_flag TINYINT(1) AS (CASE WHEN state = 'offered' THEN 1 ELSE NULL END) VIRTUAL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (offer_id),
  UNIQUE KEY uq_offer_pending_request (request_id, pending_flag),
  KEY idx_offer_agent_state (agent_id, state, expires_at),
  KEY idx_offer_expires (state, expires_at),
  CONSTRAINT fk_offer_request FOREIGN KEY (request_id) REFERENCES mm_requests (request_id) ON DELETE CASCADE,
  CONSTRAINT fk_offer_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_transactions (
  transaction_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  agent_id BIGINT UNSIGNED DEFAULT NULL,
  reservation_id BIGINT UNSIGNED DEFAULT NULL,
  direction ENUM('withdrawal','deposit') NOT NULL,
  network ENUM('MTN','AIRTEL','ZAMTEL') NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  state ENUM('pending','searching','accepted','agent_en_route','arrived','processing','completed','cancelled','rejected','expired','disputed') NOT NULL DEFAULT 'searching',
  platform_fee DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  agent_earning DECIMAL(14,2) NOT NULL DEFAULT 0.00,
  handover_code VARCHAR(6) DEFAULT NULL,
  handover_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  handover_locked_until TIMESTAMP NULL DEFAULT NULL,
  customer_confirmed_at TIMESTAMP NULL DEFAULT NULL,
  agent_confirmed_at TIMESTAMP NULL DEFAULT NULL,
  confirm_deadline TIMESTAMP NULL DEFAULT NULL,
  cancel_reason VARCHAR(255) DEFAULT NULL,
  dispute_reason VARCHAR(255) DEFAULT NULL,
  resolved_by BIGINT UNSIGNED DEFAULT NULL,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL,
  accepted_at TIMESTAMP NULL DEFAULT NULL,
  en_route_at TIMESTAMP NULL DEFAULT NULL,
  arrived_at TIMESTAMP NULL DEFAULT NULL,
  processing_at TIMESTAMP NULL DEFAULT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  active_customer_flag TINYINT(1) AS (CASE WHEN state IN ('searching','accepted','agent_en_route','arrived','processing') THEN 1 ELSE NULL END) VIRTUAL,
  active_agent_flag TINYINT(1) AS (CASE WHEN agent_id IS NOT NULL AND state IN ('accepted','agent_en_route','arrived','processing') THEN 1 ELSE NULL END) VIRTUAL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (transaction_id),
  UNIQUE KEY uq_tx_request (request_id),
  UNIQUE KEY uq_tx_active_customer (customer_id, active_customer_flag),
  UNIQUE KEY uq_tx_active_agent (agent_id, active_agent_flag),
  KEY idx_tx_customer_state (customer_id, state),
  KEY idx_tx_agent_state (agent_id, state),
  KEY idx_tx_state_created (state, created_at),
  CONSTRAINT fk_tx_request FOREIGN KEY (request_id) REFERENCES mm_requests (request_id) ON DELETE CASCADE,
  CONSTRAINT fk_tx_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE RESTRICT,
  CONSTRAINT fk_tx_reservation FOREIGN KEY (reservation_id) REFERENCES liquidity_reservations (reservation_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_ratings (
  rating_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  agent_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rating_id),
  UNIQUE KEY uq_rating_transaction (transaction_id),
  KEY idx_rating_agent (agent_id, rating),
  CONSTRAINT fk_rating_tx FOREIGN KEY (transaction_id) REFERENCES mm_transactions (transaction_id) ON DELETE CASCADE,
  CONSTRAINT fk_rating_customer FOREIGN KEY (customer_id) REFERENCES users (user_id) ON DELETE RESTRICT,
  CONSTRAINT fk_rating_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_reports (
  report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  transaction_id BIGINT UNSIGNED NOT NULL,
  reporter_id BIGINT UNSIGNED NOT NULL,
  reported_user_id BIGINT UNSIGNED DEFAULT NULL,
  reason ENUM('no_show','wrong_amount','payment_not_received','cash_not_received','unsafe_behaviour','other') NOT NULL,
  details TEXT DEFAULT NULL,
  status ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
  resolved_by BIGINT UNSIGNED DEFAULT NULL,
  resolved_at TIMESTAMP NULL DEFAULT NULL,
  resolution_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (report_id),
  KEY idx_report_status_created (status, created_at),
  KEY idx_report_tx (transaction_id),
  CONSTRAINT fk_report_tx FOREIGN KEY (transaction_id) REFERENCES mm_transactions (transaction_id) ON DELETE CASCADE,
  CONSTRAINT fk_report_reporter FOREIGN KEY (reporter_id) REFERENCES users (user_id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS mm_blocks (
  block_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_id BIGINT UNSIGNED NOT NULL,
  agent_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (block_id),
  UNIQUE KEY uq_customer_agent_block (customer_id, agent_id),
  CONSTRAINT fk_block_customer FOREIGN KEY (customer_id) REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_block_agent FOREIGN KEY (agent_id) REFERENCES agent_profiles (agent_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS transaction_audit_logs (
  audit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  entity_type VARCHAR(40) NOT NULL,
  entity_id BIGINT UNSIGNED DEFAULT NULL,
  transaction_id BIGINT UNSIGNED DEFAULT NULL,
  action VARCHAR(80) NOT NULL,
  from_state VARCHAR(40) DEFAULT NULL,
  to_state VARCHAR(40) DEFAULT NULL,
  actor_type ENUM('agent','customer','system','admin') NOT NULL DEFAULT 'system',
  actor_id BIGINT UNSIGNED DEFAULT NULL,
  before_json TEXT DEFAULT NULL,
  after_json TEXT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (audit_id),
  KEY idx_audit_entity (entity_type, entity_id),
  KEY idx_audit_tx (transaction_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS user_notifications (
  notification_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  type VARCHAR(60) NOT NULL,
  title VARCHAR(150) NOT NULL,
  body VARCHAR(255) NOT NULL,
  payload_json TEXT DEFAULT NULL,
  push_sent TINYINT(1) NOT NULL DEFAULT 0,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (notification_id),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_read (user_id, read_at),
  CONSTRAINT fk_notification_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS user_push_tokens (
  token_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  expo_token VARCHAR(255) NOT NULL,
  device_id VARCHAR(100) DEFAULT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (token_id),
  UNIQUE KEY uq_user_push_token (user_id, expo_token),
  CONSTRAINT fk_push_token_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  idempotency_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  endpoint VARCHAR(80) NOT NULL,
  idempotency_key VARCHAR(120) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  response_json TEXT DEFAULT NULL,
  status_code SMALLINT UNSIGNED DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (idempotency_id),
  UNIQUE KEY uq_idempotency (user_id, endpoint, idempotency_key),
  KEY idx_idempotency_expiry (expires_at),
  CONSTRAINT fk_idempotency_user FOREIGN KEY (user_id) REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS api_rate_limits (
  rate_limit_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  bucket VARCHAR(80) NOT NULL,
  actor_key VARCHAR(120) NOT NULL,
  window_start DATETIME NOT NULL,
  hits INT UNSIGNED NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (rate_limit_id),
  UNIQUE KEY uq_rate_window (bucket, actor_key, window_start),
  KEY idx_rate_cleanup (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
ALTER TABLE api_rate_limits MODIFY window_start DATETIME NOT NULL;

CREATE TABLE IF NOT EXISTS mm_route_cache (
  cache_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  cache_key CHAR(64) NOT NULL,
  provider VARCHAR(40) NOT NULL,
  polyline_json TEXT NOT NULL,
  distance_m DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  duration_s INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (cache_id),
  UNIQUE KEY uq_route_cache_key (cache_key),
  KEY idx_route_cache_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

INSERT INTO mm_settings (setting_key, setting_value, description) VALUES
  ('min_amount', '10.00', 'Minimum marketplace transaction amount in ZMW'),
  ('max_amount', '5000.00', 'Maximum marketplace transaction amount in ZMW'),
  ('offer_timeout_seconds', '30', 'How long an agent has to accept an offer'),
  ('search_total_timeout_seconds', '180', 'Maximum total search time'),
  ('max_offer_attempts', '12', 'Maximum number of sequential offers per request'),
  ('radius_steps_km', '3,5,10', 'Sequential discovery radius steps'),
  ('agent_location_stale_seconds', '60', 'Locations older than this are not discoverable'),
  ('agent_auto_return_available', '0', 'Automatically return agents to available after completion'),
  ('location_update_seconds', '12', 'Requested foreground location update interval'),
  ('route_poll_seconds', '7', 'Counterpart location poll interval while focused'),
  ('updates_poll_fast_seconds', '4', 'Updates poll interval with an active request/job'),
  ('updates_poll_slow_seconds', '25', 'Updates poll interval when idle'),
  ('confirm_timeout_seconds', '900', 'Time after first confirmation before dispute'),
  ('liquidity_max_declaration', '500000.00', 'Maximum agent-declared cash or float per network'),
  ('allow_dual_role_activity', '0', 'Allow active customer request and agent job together'),
  ('routing_provider', 'none', 'none|google|openroute'),
  ('routing_api_key', '', 'Server-side routing API key'),
  ('routing_cache_seconds', '300', 'Routing response cache duration'),
  ('average_speed_kmh', '25', 'Fallback ETA average speed'),
  ('handover_max_attempts', '5', 'Maximum handover code attempts'),
  ('handover_lock_seconds', '300', 'Lockout after too many bad handover codes'),
  ('location_history_retention_hours', '72', 'Retention for active-job location history'),
  ('max_location_jump_meters', '1500', 'Reject impossible location jumps'),
  ('bayesian_prior_rating', '4.2', 'Prior rating used in agent ranking'),
  ('bayesian_prior_weight', '10', 'Weight of Bayesian prior'),
  ('weight_distance', '0.40', 'Matching weight: distance'),
  ('weight_liquidity', '0.20', 'Matching weight: liquidity headroom'),
  ('weight_acceptance', '0.15', 'Matching weight: acceptance rate'),
  ('weight_completion', '0.15', 'Matching weight: completion rate'),
  ('weight_rating', '0.10', 'Matching weight: rating'),
  ('push_enabled', '0', 'Enable best-effort Expo push sending'),
  ('disclaimer', 'Payreece coordinates agents only. We do not send, hold, verify, or confirm mobile money. Confirm payments yourself and settle fees outside the app.', 'Required marketplace disclaimer')
ON DUPLICATE KEY UPDATE setting_key = setting_key;

INSERT INTO mm_fee_schedule (network, direction, min_amount, max_amount, flat_fee, percent_fee, agent_flat, agent_percent, active) VALUES
  ('ALL', 'withdrawal', 0.00, 999999999999.99, 0.50, 0.0050, 1.00, 0.0100, 1),
  ('ALL', 'deposit',    0.00, 999999999999.99, 0.50, 0.0050, 1.00, 0.0100, 1)
ON DUPLICATE KEY UPDATE active = VALUES(active);
