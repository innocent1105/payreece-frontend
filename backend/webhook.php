<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';
require_once __DIR__ . '/lib_lenco.php';

$input = ipay_json_input();
$reference = trim((string)($input['reference'] ?? ''));
$status = ipay_normalize_status($input['status'] ?? 'pending');

if ($reference === '') {
    ipay_json(['success' => false, 'message' => 'Missing reference'], 400);
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT t_id, wallet_id, amount, status FROM transactions WHERE reference = ? LIMIT 1 FOR UPDATE");
    $stmt->execute([$reference]);
    $tx = $stmt->fetch();

    if (!$tx) {
        throw new RuntimeException('Transaction not found');
    }

    if ($tx['status'] !== $status && in_array($status, ['successful', 'failed'], true)) {
        if ($status === 'successful') {
            $stmt = $pdo->prepare("SELECT balance FROM wallets WHERE wallet_id = ? AND status = 'active' LIMIT 1 FOR UPDATE");
            $stmt->execute([$tx['wallet_id']]);
            $balance = $stmt->fetchColumn();

            if ($balance === false) {
                throw new RuntimeException('Wallet not found');
            }

            $stmt = $pdo->prepare("UPDATE wallets SET balance = balance + ? WHERE wallet_id = ?");
            $stmt->execute([$tx['amount'], $tx['wallet_id']]);

            $stmt = $pdo->prepare("
                INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_before, balance_after, description)
                VALUES (?, ?, 'credit', ?, ?, ?, ?)
            ");
            $stmt->execute([
                $tx['t_id'],
                $tx['wallet_id'],
                $tx['amount'],
                $balance,
                (float)$balance + (float)$tx['amount'],
                'Mobile money deposit'
            ]);
        }

        $stmt = $pdo->prepare("UPDATE transactions SET status = ? WHERE t_id = ?");
        $stmt->execute([$status, $tx['t_id']]);
    }

    $pdo->commit();

    ipay_json(['success' => true]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ipay_json(['success' => false, 'message' => $e->getMessage()], 500);
}
