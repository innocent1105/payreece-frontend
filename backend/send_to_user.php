<?php
require_once __DIR__ . '/cors.php';
ipay_send_cors_headers();

require_once __DIR__ . '/connection.php';

$input = ipay_json_input();
ipay_require_post();

$senderPublicId   = trim((string)($input['sender_id'] ?? $input['token'] ?? ''));
$receiverPublicId = trim((string)($input['receiver_id'] ?? ''));
$amount           = round((float)($input['amount'] ?? 0), 2);
$password         = (string)($input['password'] ?? '');
$fee              = 0.85;

if ($senderPublicId === '' || $receiverPublicId === '' || $amount <= 0 || $password === '') {
    ipay_json(['success' => false, 'message' => 'Invalid transfer details.'], 400);
}

try {
    $stmt = $pdo->prepare("SELECT * FROM users WHERE public_id = ? LIMIT 1");
    $stmt->execute([$senderPublicId]);
    $sender = $stmt->fetch();

    if (!$sender) {
        ipay_json(['success' => false, 'message' => 'Sender not found.'], 404);
    }

    if (!password_verify($password, $sender['password'])) {
        ipay_json(['success' => false, 'message' => 'Incorrect password. Please try again.'], 401);
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE public_id = ? LIMIT 1");
    $stmt->execute([$receiverPublicId]);
    $receiver = $stmt->fetch();

    if (!$receiver) {
        ipay_json(['success' => false, 'message' => 'Receiver not found.'], 404);
    }

    if ((int)$sender['user_id'] === (int)$receiver['user_id']) {
        ipay_json(['success' => false, 'message' => 'Cannot transfer to yourself.'], 400);
    }

    $pdo->beginTransaction();

    $stmt = $pdo->prepare("SELECT * FROM wallets WHERE user_id = ? AND wallet_type = 'main' AND status = 'active' LIMIT 1 FOR UPDATE");
    $stmt->execute([$sender['user_id']]);
    $senderWallet = $stmt->fetch();

    $total = $amount + $fee;
    if (!$senderWallet || (float)$senderWallet['balance'] < $total) {
        throw new Exception('Insufficient balance.');
    }

    $stmt = $pdo->prepare("SELECT * FROM wallets WHERE user_id = ? AND wallet_type = 'main' AND status = 'active' LIMIT 1 FOR UPDATE");
    $stmt->execute([$receiver['user_id']]);
    $receiverWallet = $stmt->fetch();

    if (!$receiverWallet) {
        throw new Exception('Receiver wallet not found.');
    }

    $reference = 'TX_' . bin2hex(random_bytes(12));

    $stmt = $pdo->prepare("
        INSERT INTO transactions (user_id, wallet_id, t_type, sender_id, receiver_id, amount, status, reference)
        VALUES (?, ?, 'transfer', ?, ?, ?, 'pending', ?)
    ");
    $stmt->execute([
        $sender['user_id'],
        $senderWallet['wallet_id'],
        $sender['user_id'],
        $receiver['user_id'],
        $amount,
        $reference
    ]);
    $transactionId = $pdo->lastInsertId();

    $stmt = $pdo->prepare("
        INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_before, balance_after, description)
        VALUES (?, ?, 'debit', ?, ?, ?, ?)
    ");
    $stmt->execute([
        $transactionId,
        $senderWallet['wallet_id'],
        $total,
        $senderWallet['balance'],
        (float)$senderWallet['balance'] - $total,
        'Transfer to ' . $receiver['fullname']
    ]);

    $stmt = $pdo->prepare("
        INSERT INTO ledger_entries (transaction_id, wallet_id, entry_type, amount, balance_before, balance_after, description)
        VALUES (?, ?, 'credit', ?, ?, ?, ?)
    ");
    $stmt->execute([
        $transactionId,
        $receiverWallet['wallet_id'],
        $amount,
        $receiverWallet['balance'],
        (float)$receiverWallet['balance'] + $amount,
        'Transfer from ' . $sender['fullname']
    ]);

    $stmt = $pdo->prepare("UPDATE wallets SET balance = ? WHERE wallet_id = ?");
    $stmt->execute([(float)$senderWallet['balance'] - $total, $senderWallet['wallet_id']]);
    $stmt->execute([(float)$receiverWallet['balance'] + $amount, $receiverWallet['wallet_id']]);

    $stmt = $pdo->prepare("UPDATE transactions SET status = 'successful' WHERE t_id = ?");
    $stmt->execute([$transactionId]);

    $pdo->commit();

    ipay_json([
        'success' => true,
        'message' => 'Transfer successful.',
        'reference' => $reference
    ]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    ipay_json(['success' => false, 'message' => $e->getMessage()], 500);
}
