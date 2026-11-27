<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/mm_core.php';
require_once __DIR__ . '/mm_agents.php';
require_once __DIR__ . '/mm_availability.php';
require_once __DIR__ . '/mm_matching.php';
require_once __DIR__ . '/mm_lifecycle.php';
require_once __DIR__ . '/mm_discovery.php';

function mm_require_method(string $expected): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== $expected) {
        mm_fail('Method not allowed.', 405, 'method_not_allowed');
    }
}

try {
    $user = mm_current_user($pdo);
    $input = array_merge($_POST, ipay_json_input());
    $action = trim((string)($_GET['action'] ?? $input['action'] ?? ''));

    switch ($action) {
        case 'account.role':
            $stmt = $pdo->prepare('SELECT marketplace_role FROM users WHERE user_id = ? LIMIT 1');
            $stmt->execute([(int)$user['user_id']]);
            $role = (string)($stmt->fetchColumn() ?: 'user');
            if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'PUT') {
                $requested = strtolower(trim((string)($input['role'] ?? '')));
                if (!in_array($requested, ['user', 'agent'], true)) {
                    mm_fail('Role must be user or agent.', 400, 'invalid_role');
                }
                if ($requested === 'agent' && !mm_agent_for_user($pdo, (int)$user['user_id'])) {
                    mm_fail('Complete the agent profile before switching roles.', 409, 'agent_profile_required');
                }
                if ($requested === 'user') {
                    $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
                    if ($agent && mm_has_active_job($pdo, (int)$agent['agent_id'])) {
                        mm_fail('Finish your active agent job before switching roles.', 409, 'active_job_exists');
                    }
                }
                $stmt = $pdo->prepare('UPDATE users SET marketplace_role = ? WHERE user_id = ?');
                $stmt->execute([$requested, (int)$user['user_id']]);
                $role = $requested;
            } else {
                mm_require_method('GET');
            }
            mm_ok([
                'role' => $role,
                'is_agent' => $role === 'agent' && mm_agent_for_user($pdo, (int)$user['user_id']) !== null,
            ]);
            break;

        case 'networks':
            mm_require_method('GET');
            mm_ok([
                'networks' => [
                    ['code' => 'MTN', 'name' => 'MTN MoMo', 'color' => '#FFCC00'],
                    ['code' => 'AIRTEL', 'name' => 'Airtel Money', 'color' => '#E4002B'],
                    ['code' => 'ZAMTEL', 'name' => 'Zamtel Kwacha', 'color' => '#0057A8'],
                ],
                'min_amount' => mm_ngwee_to_decimal(mm_setting_money($pdo, 'min_amount', 1000)),
                'max_amount' => mm_ngwee_to_decimal(mm_setting_money($pdo, 'max_amount', 500000)),
                'disclaimer' => mm_setting($pdo, 'disclaimer', 'Payreece coordinates agents only. We do not send, hold, verify, or confirm mobile money.'),
            ]);
            break;

        case 'request.history':
            mm_require_method('GET');
            mm_ok(mm_request_history($pdo, $user, (int)($_GET['limit'] ?? $input['limit'] ?? 50)));
            break;

        case 'notifications.list':
            mm_require_method('GET');
            mm_ok(mm_notification_list($pdo, (int)$user['user_id'], (int)($_GET['limit'] ?? $input['limit'] ?? 30)));
            break;

        case 'notifications.mark_read':
            if (!in_array(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), ['POST', 'PUT'], true)) {
                mm_require_method('POST');
            }
            mm_ok(mm_notification_mark_read($pdo, (int)$user['user_id'], $input), 'Notifications marked as read.');
            break;

        case 'customer.location':
            if (!in_array(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), ['POST', 'PUT'], true)) {
                mm_require_method('POST');
            }
            mm_ok(mm_update_customer_location($pdo, $user, $input), 'Location updated.');
            break;

        case 'customer.nearby_agents':
            mm_require_method('GET');
            mm_ok(mm_nearby_agents($pdo, $user, [
                'lat' => $_GET['lat'] ?? $input['lat'] ?? null,
                'lng' => $_GET['lng'] ?? $input['lng'] ?? null,
                'network' => $_GET['network'] ?? $input['network'] ?? '',
                'direction' => $_GET['direction'] ?? $input['direction'] ?? '',
                'amount' => $_GET['amount'] ?? $input['amount'] ?? null,
            ]));
            break;

        case 'agent.register':
            mm_require_method('POST');
            $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
            if ($agent) {
                mm_fail('An agent profile already exists for this account.', 409, 'agent_exists');
            }
            $profile = mm_save_agent_profile($pdo, $user, $input);
            $stmt = $pdo->prepare("UPDATE users SET marketplace_role = 'agent' WHERE user_id = ?");
            $stmt->execute([(int)$user['user_id']]);
            mm_ok($profile, 'Agent application submitted.');
            break;

        case 'agent.profile':
            $agent = mm_require_agent($pdo, $user);
            if ($action === 'agent.profile' && strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'PUT') {
                mm_ok(mm_save_agent_profile($pdo, $user, $input), 'Agent profile updated.');
            }
            mm_require_method('GET');
            mm_ok(mm_agent_payload($pdo, $agent, $user));
            break;

        case 'agent.liquidity':
            mm_require_method('PUT');
            $agent = mm_require_agent($pdo, $user);
            mm_ok(mm_update_liquidity($pdo, $user, $agent, $input), 'Liquidity updated (agent-declared).');
            break;

        case 'agent.availability':
            mm_require_method('PUT');
            $agent = mm_require_agent($pdo, $user);
            $result = mm_set_availability($pdo, $user, $agent, (string)($input['availability'] ?? ''));
            if (($result['availability'] ?? '') === 'available') {
                mm_dispatch_pending_requests($pdo, 10);
            }
            mm_ok($result);
            break;

        case 'agent.location':
            if (!in_array(strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'), ['POST', 'PUT'], true)) {
                mm_require_method('POST');
            }
            $agent = mm_require_agent($pdo, $user);
            $result = mm_update_location($pdo, $user, $agent, $input);
            mm_dispatch_pending_requests($pdo, 10);
            mm_ok($result);
            break;

        case 'agent.earnings':
            mm_require_method('GET');
            $agent = mm_require_agent($pdo, $user);
            mm_ok(mm_agent_earnings($pdo, $agent));
            break;

        case 'agent.document':
            mm_require_method('GET');
            mm_serve_private_image($pdo, $user, (string)($input['filename'] ?? $_GET['filename'] ?? ''));
            break;

        case 'admin.agents':
            mm_require_method('GET');
            mm_require_admin($user);
            mm_ok(['agents' => mm_admin_agents($pdo, trim((string)($_GET['status'] ?? '')))]);
            break;

        case 'admin.agent_decision':
            mm_require_method('POST');
            mm_ok(mm_admin_agent_decision($pdo, $user, $input), 'Agent decision recorded.');
            break;

        case 'customer.request.create':
            mm_require_method('POST');
            mm_create_request($pdo, $user, $input, mm_request_header('Idempotency-Key'));
            break;

        case 'customer.request.status':
            mm_require_method('GET');
            $requestId = (int)($_GET['request_id'] ?? $input['request_id'] ?? 0);
            $publicId = trim((string)($_GET['public_id'] ?? $input['public_id'] ?? ''));
            $request = $requestId > 0
                ? (function () use ($pdo, $requestId): ?array {
                    $stmt = $pdo->prepare('SELECT * FROM mm_requests WHERE request_id = ? AND deleted_at IS NULL LIMIT 1');
                    $stmt->execute([$requestId]);
                    $row = $stmt->fetch();
                    return $row ?: null;
                })()
                : ($publicId !== '' ? mm_request_by_public($pdo, $publicId) : null);
            if (!$request) {
                mm_fail('Request not found.', 404, 'request_not_found');
            }
            $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
            $assignedAgent = false;
            if ($agent) {
                $stmt = $pdo->prepare('SELECT 1 FROM mm_transactions WHERE request_id = ? AND agent_id = ? LIMIT 1');
                $stmt->execute([(int)$request['request_id'], (int)$agent['agent_id']]);
                $assignedAgent = (bool)$stmt->fetchColumn();
            }
            $allowed = (int)$request['customer_id'] === (int)$user['user_id']
                || mm_is_admin($user)
                || $assignedAgent;
            if (!$allowed) {
                mm_fail('You cannot view this request.', 403, 'forbidden');
            }
            if (($request['state'] ?? '') === 'searching') {
                mm_dispatch_pending_requests($pdo, 10);
            }
            mm_ok(mm_request_payload($pdo, $request, $user));
            break;

        case 'customer.request.cancel':
            mm_require_method('POST');
            mm_cancel_request($pdo, $user, $input, mm_request_header('Idempotency-Key'));
            break;

        case 'agent.offers':
            mm_require_method('GET');
            $agent = mm_require_agent($pdo, $user);
            mm_dispatch_pending_requests($pdo, 10);
            mm_ok(['offers' => mm_agent_offers($pdo, $agent)]);
            break;

        case 'agent.offer.respond':
            mm_require_method('POST');
            $agent = mm_require_agent($pdo, $user);
            mm_ok(mm_respond_offer($pdo, $user, $agent, $input));
            break;

        case 'cron.expire':
            mm_require_method('POST');
            $secret = (string)(getenv('IPAY_MM_CRON_SECRET') ?: '');
            $provided = mm_request_header('X-Cron-Secret');
            if ($secret === '' || !hash_equals($secret, $provided)) {
                mm_fail('Cron secret is invalid.', 403, 'forbidden');
            }
            $processed = mm_process_expirations($pdo);
            mm_dispatch_pending_requests($pdo, 25);
            mm_ok(['processed' => $processed]);
            break;

        case 'transaction.get':
            mm_require_method('GET');
            $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
            $tx = mm_require_transaction_access($pdo, (int)($_GET['transaction_id'] ?? $input['transaction_id'] ?? 0), $user, $agent);
            if (($tx['state'] ?? '') === 'searching') {
                mm_dispatch_pending_requests($pdo, 10);
            }
            mm_ok(mm_transaction_details($pdo, $tx, $user, $agent));
            break;

        case 'transaction.meet':
            mm_require_method('POST');
            mm_ok(mm_check_meeting($pdo, $user, $input));
            break;

        case 'transaction.transition':
            mm_require_method('POST');
            $agent = mm_require_agent($pdo, $user);
            mm_ok(mm_agent_transition($pdo, $user, $agent, $input));
            break;

        case 'transaction.confirm':
            mm_require_method('POST');
            $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
            mm_ok(mm_confirm_transaction($pdo, $user, $agent, $input));
            break;

        case 'transaction.cancel':
            mm_require_method('POST');
            $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
            mm_ok(mm_cancel_transaction($pdo, $user, $agent, $input));
            break;

        case 'transaction.dispute':
            mm_require_method('POST');
            $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
            mm_ok(mm_dispute_transaction($pdo, $user, $agent, $input));
            break;

        case 'transaction.rate':
            mm_require_method('POST');
            $agent = mm_agent_for_user($pdo, (int)$user['user_id']);
            mm_ok(mm_rate_transaction($pdo, $user, $agent, $input));
            break;

        case 'admin.transactions':
            mm_require_method('GET');
            mm_require_admin($user);
            mm_ok(['transactions' => mm_admin_transactions($pdo, trim((string)($_GET['status'] ?? '')))]);
            break;

        case 'admin.transaction.resolve':
            mm_require_method('POST');
            mm_ok(mm_admin_resolve_transaction($pdo, $user, $input));
            break;

        default:
            mm_fail('Unknown marketplace action.', 404, 'not_found');
    }
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('[marketplace] ' . $e->getMessage());
    mm_fail('An internal server error occurred.', 500, 'internal_error');
}
