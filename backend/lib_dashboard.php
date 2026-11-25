<?php

function ipay_transaction_payload(PDO $pdo, string $token, int $limit = 0): array
{
    $stmt = $pdo->prepare("
        SELECT user_id, public_id, username, fullname, email, phone_number, student_id, account_type, gender, avatar
        FROM users
        WHERE public_id = ?
        LIMIT 1
    ");
    $stmt->execute([$token]);
    $user = $stmt->fetch();

    if (!$user) {
        ipay_json(['success' => false, 'message' => 'User not found'], 404);
    }

    $stmt = $pdo->prepare("
        SELECT w.balance, w.currency, w.wallet_type
        FROM wallets w
        WHERE w.user_id = ? AND w.wallet_type = 'main' AND w.status = 'active'
        LIMIT 1
    ");
    $stmt->execute([$user['user_id']]);
    $wallet = $stmt->fetch();

    if (!$wallet) {
        ipay_json(['success' => false, 'message' => 'User data or wallet not found.'], 404);
    }

    $sql = "
        SELECT t.t_id, t.t_type, t.sender_id, t.receiver_id, t.amount, t.status, t.reference, t.created_at,
               u.fullname AS other_sender_name, u.phone_number AS other_sender_number
        FROM transactions t
        LEFT JOIN users u
          ON u.user_id = CASE WHEN t.sender_id = ? THEN t.receiver_id ELSE t.sender_id END
        WHERE (t.sender_id = ? OR t.receiver_id = ?)
          AND t.status = 'successful'
        ORDER BY t.created_at DESC, t.t_id DESC
    ";
    $params = [$user['user_id'], $user['user_id'], $user['user_id']];

    if ($limit > 0) {
        $sql .= ' LIMIT ' . $limit;
    }

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $transactions = [];
    foreach ($rows as $row) {
        $isSender = (int)$row['sender_id'] === (int)$user['user_id'];
        $type = $row['t_type'] === 'deposit' ? 'deposit' : ($isSender ? 'sent' : 'received');
        $fee = ($type === 'sent') ? 0.85 : 0.0;

        $transactions[] = [
            'transaction_id'      => $row['t_id'],
            'amount'              => $row['amount'],
            'fee'                 => $fee,
            'total'               => ($isSender ? (float)$row['amount'] + $fee : (float)$row['amount']),
            'status'              => $row['status'],
            'date'                => $row['created_at'],
            'sender_id'           => $row['sender_id'],
            'receiver_id'         => $row['receiver_id'],
            'reference'           => $row['reference'],
            'type'                => $type,
            'from_me'             => $isSender,
            'other_sender_name'   => $row['other_sender_name'] ?? '',
            'other_sender_number' => $row['other_sender_number'] ?? ''
        ];
    }

    return [
        'public_id'    => $user['public_id'],
        'phone_number' => $user['phone_number'],
        'full_name'    => $user['fullname'],
        'fullname'     => $user['fullname'],
        'username'     => $user['username'],
        'email'        => $user['email'],
        'student_id'   => $user['student_id'] ?? '',
        'account_type' => $user['account_type'],
        'gender'       => $user['gender'],
        'avatar'       => $user['avatar'] ?: 'avatar1.jpg',
        'wallet' => [
            'type'    => $wallet['wallet_type'],
            'main'    => $wallet['wallet_type'],
            'balance' => $wallet['balance'],
            'currency'=> $wallet['currency']
        ],
        'transactions' => $transactions
    ];
}
