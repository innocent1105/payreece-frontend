-- Marketplace migration rollback — removes only marketplace tables.
-- Does not touch users, wallets, transactions, ledger_entries, fees, or avatars.
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS mm_route_cache;
DROP TABLE IF EXISTS api_rate_limits;
DROP TABLE IF EXISTS idempotency_keys;
DROP TABLE IF EXISTS user_push_tokens;
DROP TABLE IF EXISTS user_notifications;
DROP TABLE IF EXISTS transaction_audit_logs;
DROP TABLE IF EXISTS mm_blocks;
DROP TABLE IF EXISTS mm_reports;
DROP TABLE IF EXISTS mm_ratings;
DROP TABLE IF EXISTS mm_transactions;
DROP TABLE IF EXISTS mm_offers;
DROP TABLE IF EXISTS mm_requests;
DROP TABLE IF EXISTS liquidity_reservations;
DROP TABLE IF EXISTS agent_location_history;
DROP TABLE IF EXISTS agent_locations;
DROP TABLE IF EXISTS liquidity_ledger;
DROP TABLE IF EXISTS agent_liquidity;
DROP TABLE IF EXISTS agent_networks;
DROP TABLE IF EXISTS agent_profiles;
DROP TABLE IF EXISTS mm_fee_schedule;
DROP TABLE IF EXISTS mm_settings;
SET FOREIGN_KEY_CHECKS = 1;
