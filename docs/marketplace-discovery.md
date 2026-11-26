# Marketplace discovery (Phase 0)

## Backend

- PHP 8.2.12 / MariaDB 10.4-compatible SQL, PDO only (`backend/connection.php`), `PDO::ATTR_EMULATE_PREPARES = false`.
- No router/framework. Each endpoint is a standalone PHP file under `backend/` (for example `login.php`, `dashboard.php`) that includes `cors.php` then `connection.php`.
- Response envelope: `{"success": bool, "message": string, "data"?: ...}`. Errors use HTTP 400/401/404/405/409/500 with the same shape. `ipay_json()` in `cors.php` terminates the request.
- Auth is not token storage: `login.php` returns `users.public_id` as the token. PHP resolves the current user by `SELECT ... FROM users WHERE public_id = ?` (see `lib_dashboard.php`). Mobile stores it in `expo-secure-store` as `payper-token` (`components/auth/auth.tsx`).
- Existing endpoints accept the token in the JSON body (`token`, sometimes `sender_id`/`public_id`). There is no `Authorization` header convention and no JWT/session/expiry. New endpoints will accept body `token` and also `Authorization: Bearer <public_id>` for compatibility; CORS must allow `Idempotency-Key`.
- No rate limiter, no queue, no cron, no admin panel, no file-upload helper. Defaults chosen: DB-backed `idempotency_keys` and `api_rate_limits`, one cron CLI script plus opportunistic expiry processing on polls, SQL/CLI admin tooling.
- Database config: env `IPAY_DB_HOST/NAME/USER/PASS`; defaults `localhost/payper/root/''`. MySQL service was not running during discovery; migrations will be applied once started.
- Relevant schema: `users(user_id BIGINT UNSIGNED PK AUTO_INCREMENT, public_id CHAR(36) UNIQUE, username, fullname, phone_number UNIQUE, password, email UNIQUE, avatar, expo_push_token, ...)`. `wallets(wallet_id, user_id, wallet_type, balance DECIMAL(15,2), currency ZMW)`. `transactions`, `ledger_entries`, `fees`, `avatars`. Engine InnoDB, charset/collation `utf8mb4` / `utf8mb4_general_ci`. No roles, KYC/NRC columns, notifications table, locations, or marketplace tables. No admin role column: admin access will be an env allowlist of `users.public_id` values, checked server-side.
- Money decision: all new monetary columns `DECIMAL(14,2)`; server arithmetic uses `bcmath` (available) with integer-ngwee helpers. Do not touch existing `DECIMAL(15,2)` wallet code.
- Image handling decision: PHP CLI has `bcmath/curl/fileinfo/pdo_mysql` but **not GD**. Enable `extension=gd` in the XAMPP PHP config for image re-encoding; `php_gd.dll` is present. Uploads go outside the web root (`backend/storage/private/mm/`) with an authenticated PHP download endpoint.

## Mobile

- Expo SDK 58 (`expo ~58.0.0`), React Native 0.88.1, React 19.3, Expo Router ~58.0.32 with file routes in `frontend/app/`, custom bottom tabs in `app/(tabs)/_layout.tsx`, theme colors `#2A2A68` / `#4A4AFF`.
- No central API client. Screens call `axios` directly with `BASE_URL` from `constants/api.ts` and `getToken()` from `components/auth/auth.tsx`. New code will add a thin shared marketplace API service/hook but will not refactor unrelated screens.
- Installed: `expo-location ~58.0.22`, `expo-notifications ~58.1.9`, `expo-image-picker ~58.0.10`, `expo-image`, `expo-router`, `axios`. `react-native-maps` is **not installed**; will install `react-native-maps` (recommended 1.29.11 for SDK 58).
- `expo-location` foreground APIs (`requestForegroundPermissionsAsync`, `watchPositionAsync`) work in Expo Go. Background location requires a dev build and is deliberately not used. Keep-app-open warning is required in the UI; server treats locations older than `AGENT_LOCATION_STALE_SECONDS` as undiscoverable.
- `react-native-maps` v58 docs confirm Expo Go support; Google Maps API key is only needed for standalone/dev builds. Routing will be server-side with a no-key straight-line fallback.
- `expo-notifications` remote push is unavailable in Expo Go on Android from SDK 53 (project's own `components/lib/notifications.ts` already skips it). In-app notifications + polling are primary; push behind config, fail silently.

## Defaults chosen (no blocking questions)

- One account/two capabilities; admin is an env allowlist, not a users-table column.
- Self-matching and concurrent customer request/agent job are disallowed by default (`allow_dual_role_activity = 0`).
- `react-native-maps` in Expo Go; routing provider configured server-side (`ROUTING_PROVIDER=none|google|openroute`), no key => straight line + configured average-speed ETA.
- All thresholds/weights/fees in `mm_settings` / `mm_fee_schedule`; no hidden constants on the client.
- Completion is human-confirmed only; no escrow, no mobile-money verification. Disclaimer shown on request review and transaction screens.
