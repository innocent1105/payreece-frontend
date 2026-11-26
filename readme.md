# Build: On-Demand Mobile Money Agent Marketplace (Zambia)

## Mission
Add an Uber/Yango-style marketplace to our **existing** fintech app. A customer who needs cash (withdrawal) or mobile money (deposit) requests a nearby verified agent, gets matched, tracks the agent on a map, meets, completes the exchange, and rates them.

**Stack (already in place):** PHP backend, MySQL, React Native + Expo (must run in **Expo Go**), existing auth and users table.
**Currency:** ZMW (Kwacha). **Networks:** MTN MoMo, Airtel Money, Zamtel Kwacha.

## Ground rules (non-negotiable)
1. **Inspect before you build.** Do not create a new app, new auth, or a second users table. Extend what exists and follow its conventions (routing, response envelope, error format, naming, folder layout, theme, navigation, API client).
2. **Do not break existing features.** Migrations must be additive and re-runnable (`CREATE TABLE IF NOT EXISTS`, guarded `ALTER`). Provide a rollback script.
3. **Real working code, no mock data, no placeholder screens.** If something needs external credentials (routing API key, push), build it behind a config value with a working fallback, and say so in the final report.
4. **We coordinate, we don't move money.** The app never sends or verifies mobile money. Do not claim escrow, auto-verification, or payment confirmation. Completion comes from human confirmation by both parties (see §6). Add a visible disclaimer in the UI.
5. **The server is the source of truth.** Never trust balances, prices, distances, roles, or statuses sent by the client.
6. **Money = `DECIMAL(14,2)`.** Never float, in PHP (use integer ngwee or `bcmath`) or JS.
7. **Prefer fast, working increments.** Don't write long planning docs. Work phase by phase, and stop at each phase gate (§9).

## Phase 0: Discovery (output a short `docs/marketplace-discovery.md`, then continue)
Record only what changes your decisions:
- Auth: how tokens/sessions work, how the current user id is resolved in PHP and in the RN API client.
- Backend conventions: router/controller pattern, validation helpers, DB access layer (PDO/mysqli), error format, any existing rate limiter, cron/queue support, admin panel (exists? where?).
- Existing schema relevant to us (users, wallets, notifications, kyc/NRC fields, roles). Reuse columns like phone and name; don't duplicate.
- RN: Expo SDK version, navigation lib, state/data fetching approach, theme/components, whether `expo-location`, `expo-notifications`, `react-native-maps` are installed.
- Platform limits that affect design (see "Expo constraints" below). Verify against the installed SDK version rather than assuming.

Ask the user questions **only if blocked**. Otherwise choose the sensible default, note it in the discovery file, and keep moving.

## 1. Roles
One account, two capabilities. No separate accounts.
- **Customer:** every registered user.
- **Agent:** any user who completes agent onboarding. A user can be both, but **cannot match with their own agent profile** and can't have an active request as customer and an active job as agent at the same time unless explicitly allowed by a config flag (default: not allowed).

Authorization is enforced server-side on every endpoint: "is this my request / my offer / my transaction?" Return 403/404 without leaking existence.

## 2. Agent onboarding and profile
- Reuse name and phone from the user record.
- Collect: agent/business name, business location (map pin + address text), NRC number, NRC photo(s), selfie/profile photo, supported networks (MTN/Airtel/Zamtel), optional agent codes per network.
- Store NRC and selfie images **outside the public web root** (or behind an authenticated PHP download endpoint). Validate type/size, re-encode images, random filenames.
- `verification_status`: `pending | verified | rejected | suspended` (+ `rejection_reason`, `reviewed_by`, `reviewed_at`).
- Only `verified` agents can go available or receive offers. Pending agents can edit their profile and see their status.

## 3. Liquidity (per agent, per network)
Each agent maintains `cash_balance` and `float_balance` per network, editable by the agent.
- Keep **`balance`** and **`reserved`** separately. `available = balance - reserved`.
- Every change (manual edit, reservation, release, completion settlement) writes an immutable row to a liquidity ledger with `before`, `after`, `delta`, `reason`, `ref_id`, `actor`.
- Manual edits are an agent-declared figure and are labeled as such. Add sane guards (non-negative, max cap from settings) and audit log them.

**Settlement semantics on completion** (state this explicitly in code comments):
- Withdrawal (customer takes cash, sends e-money to agent): agent `cash` decreases by amount, agent `float` increases by amount.
- Deposit (customer gives cash, receives e-money): agent `float` decreases by amount, agent `cash` increases by amount.
- Reservations: withdrawal reserves **cash**, deposit reserves **float**, on the requested network only. Release on cancel/reject/expiry. Convert reservation to settlement on completion.

**Concurrency:** acquire the reservation inside a DB transaction using `SELECT ... FOR UPDATE` on the agent's liquidity row, check `available >= amount`, insert reservation, update `reserved`. Always lock rows in a consistent order to avoid deadlocks. Add a reservation expiry job/sweep that releases stale reservations.

## 4. Availability and location
- Agent states: `available | busy | offline`. Server enforces transitions (can't go available if unverified, suspended, or has no liquidity configured; goes `busy` on accepting a job; returns to `available` only if they choose, or via config auto-return).
- Going available: request foreground location permission → get position → POST to backend → start periodic updates (default every 10-15 s while available or on an active job; configurable). Going offline or app unmounted: stop updates.
- **Expo constraint:** use `expo-location` foreground tracking only. Do **not** require background location, which needs a dev build and extra review. If the app is backgrounded, the agent shows as stale; the server treats locations older than `AGENT_LOCATION_STALE_SECONDS` (default 60) as not discoverable. Tell the agent this in the UI ("Keep the app open while available").
- Store latest location in `agent_locations` (one row per agent, upsert) with lat/lng `DECIMAL(10,7)`, accuracy, heading, `updated_at`. Keep a lightweight history only for the duration of an active job (for disputes), then purge by retention setting.
- Throttle location endpoints and validate coordinates (lat/lng ranges, reject impossible jumps).

## 5. Customer request flow and matching
**Customer UI:** a "Mobile Money Agents" entry point on the existing home screen. Flow: type (Withdraw/Deposit) → network → amount (big numeric input, quick-amount chips) → pickup location (GPS default, adjustable pin) → review (shows platform fee/agent commission estimate and the disclaimer) → confirm.

**Validation:** amount within platform min/max and `> 0`, network valid, coordinates valid, no other active request for this customer, `Idempotency-Key` header on creation (same key returns the same request, never a duplicate).

**Dispatch model: one offer at a time (no broadcast).**
1. Create `mm_request` with state `searching`.
2. Run the matcher (PHP). Hard filters:
   - agent `verified`, `available`, location fresh
   - supports network; `min_amount <= amount <= max_amount`
   - sufficient `available` liquidity of the right type (cash for withdrawal, float for deposit)
   - within radius; no active job; not the customer themself; not already offered this request; not blocked by customer
3. Rank by a configurable score (weights in settings): distance (Haversine, with a bounding-box prefilter in SQL using indexed lat/lng), liquidity headroom, acceptance rate, completion rate, average rating (with a Bayesian prior so new agents aren't punished or over-rewarded).
4. Create an `mm_offer` for the top agent with `expires_at = now + OFFER_TIMEOUT` (default 30 s). **Only one pending offer per request at any time.**
5. On reject or expiry, mark the offer, then offer to the next candidate. If candidates are exhausted at the current radius, expand (default 3 km → 5 → 10 km), up to `MAX_OFFER_ATTEMPTS` or `SEARCH_TOTAL_TIMEOUT` (default 3 min). Then set `expired` and notify the customer.
6. Accept uses an atomic compare-and-set (`UPDATE ... WHERE state='offered' AND offer_id=? AND expires_at > NOW()`), plus the liquidity reservation in the same DB transaction. If any step fails, nothing is committed.

**Expiry processing:** don't rely on a client to trigger timeouts. Implement a `process_expirations()` function called (a) by a cron script and (b) opportunistically on poll endpoints, so it works even without cron. Make it idempotent and safe to run concurrently.

All thresholds (radius steps, timeouts, weights, min/max amounts, stale seconds) live in a `mm_settings` table with defaults seeded by the migration, editable via admin.

## 6. Transaction lifecycle
States: `pending, searching, accepted, agent_en_route, arrived, processing, completed, cancelled, rejected, expired, disputed`.

Implement a single server-side transition table (`from → to`, who may trigger it, side effects). Every transition goes through one function that validates, applies side effects, writes an audit log row, and queues notifications. No endpoint updates status directly.

**Handover code:** on `accepted`, generate a short random code shown only to the customer. The agent must enter it at `arrived` to proceed to `processing`. This prevents agents from marking arrival or completing without meeting the customer, and ties the physical meeting to the digital record. Limit attempts.

**Withdrawal:** accepted → en route → arrived (code verified) → processing: customer sends e-money to the agent's wallet → agent confirms "payment received" (they check their own SMS/wallet) → agent hands over cash → customer confirms "I received cash" → completed.

**Deposit:** accepted → en route → arrived (code verified) → processing: customer hands over cash → agent confirms "cash received" → agent sends e-money → customer confirms "I received e-money" → completed.

**Completion rule:** `completed` only when **both** confirmations exist. If one party confirms and the other doesn't within `CONFIRM_TIMEOUT` (default 15 min) or one party reports a problem, move to `disputed`. Disputed transactions freeze the related reservation until an admin resolves them. Neither side can force `completed` alone.

**Cancellation:** customer can cancel before `processing`; agent can cancel before `processing` (counts against their reliability score); both release reservations. After `processing` starts, cancellation requires the dispute path.

**Fees:** compute at request time from a `mm_fee_schedule` (by network/type/amount band, configurable), store the quote on the transaction, and show it to both parties. Record agent earnings and platform fee as separate fields. State clearly in the UI that fees are settled outside the app unless a payment integration exists.

## 7. Maps and tracking
- `react-native-maps` (works in Expo Go; verify the installed version and platform behavior).
- **Privacy:** before acceptance, the agent sees only approximate distance and a coarsened customer location (round to roughly 300-500 m or show a radius circle). Exact coordinates are released only after `accepted`, and tracking data is not served after the transaction reaches a terminal state.
- **Customer map:** customer pin, agent marker moving live, route polyline, ETA, distance, agent name/photo/rating/plate-or-description if collected, status banner, call button (`tel:` link), cancel, and a "Report a problem" action.
- **Agent map:** customer pin, route, ETA, big "Navigate" (deep link to Google Maps/Apple Maps) and the next-status action button.
- **Routing:** put routing behind a PHP proxy endpoint or a single config-driven client (provider via env, e.g. OpenRouteService or Google Directions, key stored server-side). Cache identical requests briefly. **Fallback:** if the provider fails or no key is set, use straight-line distance and an estimated ETA (configurable average speed) and draw a straight line. Never crash the screen.
- Poll the counterpart location every 5-8 s while the screen is focused; pause when blurred.

## 8. Notifications and real-time
- Create `user_notifications` (type, title, body, payload JSON, `read_at`) as the in-app source of truth. Every lifecycle event writes one.
- **Primary transport: polling.** Provide `GET /api/mobile-money/updates?since=<cursor>` returning changed requests, offers, transactions and notifications since a monotonic cursor. Poll about every 3-5 s when a request/job is active or the agent is available, back off to 20-30 s otherwise, and stop when the app is backgrounded. Keep payloads small.
- **Push is an enhancement.** `expo-notifications` remote push **does not work in Expo Go on Android in recent SDK versions** (and needs credentials on iOS). Implement token registration and server-side sending via the Expo push API behind a config flag, make it fail silently, and make sure the entire flow works with polling alone. Report exactly what was and wasn't testable in Expo Go.
- Structure the code so an SSE/WebSocket layer can replace polling later without changing the screens (a single `useMarketplaceUpdates` hook/service).
- Agent notifications: new offer (with countdown), request cancelled, customer arrived/confirmed. Customer: searching, agent accepted, en route, arrived, completed, cancelled, expired.

## 9. Delivery plan with phase gates
After each phase: run it, test it, check DB state, confirm existing screens still work, then **print a 5-line gate report** (done / tested how / known issues / files touched / next). Don't proceed with failing tests.

1. **Discovery** (above).
2. **Schema + core backend:** migrations, settings seed, auth reuse, transition engine, audit log, idempotency, rate limiting, input validation (prepared statements everywhere).
3. **Agent onboarding + liquidity:** register/profile/networks/liquidity + ledger, admin verify/reject/suspend endpoints (and UI in the existing admin if one exists; otherwise a minimal protected admin screen or CLI/SQL script documented in the report).
4. **Availability + location updates.**
5. **Customer request + matcher + offers + expiry processing.**
6. **Accept/reject, lifecycle, handover code, dual confirmation, disputes, ratings.**
7. **Maps + live tracking + routing fallback.**
8. **Notifications + polling hook (+ optional push).**
9. **Hardening:** authorization sweep, rate limits, dispute tooling, admin monitoring (transactions, liquidity, reports, fee schedule), cleanup jobs.

## 10. Data model (extend as needed after inspecting the real schema)
`agent_profiles, agent_networks, agent_liquidity, liquidity_ledger, liquidity_reservations, agent_locations, mm_requests, mm_offers, mm_transactions, mm_ratings, mm_reports, mm_fee_schedule, mm_settings, transaction_audit_logs, user_notifications, user_push_tokens, idempotency_keys`.

Requirements: FKs to the existing users table (match its engine/charset/id type exactly), unique constraints (one agent profile per user, one liquidity row per agent+network, one active transaction per customer and per agent, unique idempotency key per user+endpoint), indexes on `(lat,lng)`, `(network, status)`, `(agent_id, state)`, `(customer_id, state)`, `expires_at`, `created_at`, timestamps on everything, soft-delete rather than hard-delete for financial records.

## 11. API
Follow the existing routing and response conventions. Suggested surface (adjust names to match the codebase):

- **Agent:** `POST /agents/register`, `GET|PUT /agents/profile`, `POST /agents/availability`, `PUT /agents/liquidity`, `POST /agents/location`, `GET /agents/offers`, `POST /agents/offers/{id}/accept|reject`, `GET /agents/transactions`, `GET /agents/earnings`.
- **Customer:** `POST /mobile-money/requests` (idempotent), `GET /mobile-money/requests/{id}`, `POST /mobile-money/requests/{id}/cancel`, `GET /mobile-money/nearby-agents` (anonymized: counts/approximate positions only), `GET /mobile-money/transactions`, `POST /mobile-money/transactions/{id}/confirm`, `POST /mobile-money/transactions/{id}/report`, `POST /mobile-money/transactions/{id}/rate`.
- **Shared:** `GET /mobile-money/networks`, `GET /mobile-money/updates?since=`, `POST /mobile-money/transactions/{id}/status` (agent-side steps only, validated by the transition table), `POST /devices/push-token`.
- **Admin:** agent review queue, verify/reject/suspend, transactions list/detail, dispute resolution, liquidity overview, settings and fee schedule, reports.

## 12. Security checklist
- Prepared statements only; strict server-side validation; consistent error codes.
- Authorization on every object (owner/participant checks); role checks for agent/admin endpoints.
- Rate limits on request creation, location updates, code attempts, and login-adjacent routes.
- Idempotency for create and confirm endpoints; duplicate-tap safety in the UI (disable buttons while in flight).
- Audit log for every state change, liquidity change, admin action; store actor, IP, timestamp, before/after.
- Minimal PII exposure: customers see agent name, photo, rating and business name only; agents see customer display name only. No phone numbers exposed until `accepted` (and then only for the call button).
- Safety features: report/dispute button, agent suspension, customer block list, meeting-place safety tips on the arrival screen.
- Fraud guards: block self-matching, cap agent liquidity declarations by setting, flag agents with high cancel/dispute rates, flag impossible location jumps.

## 13. UX standards
Match the existing design system. Minimal taps to request. Large amount input, clear Withdraw/Deposit toggle, network chips with brand colors, a prominent status banner, countdown on agent offers, and every screen with loading, empty, error and offline states. Keep the offer card scannable: name, type, network, amount, distance, ETA, expected earning, Accept/Reject. Don't touch unrelated screens.

## 14. Testing (do it, don't just describe it)
Write and run PHP scripts or feature tests for:
- Two customers racing for the same agent's last liquidity: exactly one succeeds.
- Double-tap/duplicate request with the same idempotency key: one request created.
- Offer expiry moves to the next agent; exhausted candidates yields `expired`; reservations are released in every terminal path.
- Accept after expiry or by a non-recipient agent is rejected.
- Wrong handover code lockout.
- One-sided confirmation moves to `disputed` after timeout; ledger stays consistent.
- Liquidity ledger sums equal balances after a randomized sequence of operations.
- Existing login/wallet/payment flows still pass.

## 15. Final report (required)
1. Files created/modified, grouped by backend / mobile / DB.
2. Migrations run (and rollback instructions).
3. Endpoints implemented.
4. New dependencies.
5. Features completed vs partial.
6. What needs external credentials/config (routing API key, Expo push, cron setup).
7. Tests run with results, known issues, and the manual QA script for two physical phones.
8. Recommended next steps (e.g., operator API integration for verified payments, background location via dev build, WebSocket/SSE upgrade).