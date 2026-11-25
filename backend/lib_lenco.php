<?php

function ipay_http_request(string $method, string $url, array $headers = [], ?array $json = null): array
{
    $ch = curl_init($url);

    $curlHeaders = [];
    foreach ($headers as $name => $value) {
        $curlHeaders[] = $name . ': ' . $value;
    }

    $options = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $curlHeaders,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2
    ];

    if ($json !== null) {
        $options[CURLOPT_POSTFIELDS] = json_encode($json, JSON_UNESCAPED_SLASHES);
    }

    curl_setopt_array($ch, $options);

    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($body === false) {
        throw new RuntimeException('Upstream request failed: ' . $error);
    }

    $decoded = json_decode($body, true);

    return [
        'status' => $status,
        'body'   => is_array($decoded) ? $decoded : [],
        'raw'    => $body
    ];
}

function ipay_lenco_secret(): string
{
    $secret = 'f23835ad81cf2bde4016e20b089ecd7994c493f123407bc11db5dfb7cac2ad10';
    return $secret;
}

function ipay_detect_telco(string $phone): string
{
    $phone = preg_replace('/\D/', '', $phone);

    if (strlen($phone) === 12 && str_starts_with($phone, '260')) {
        $phone = '0' . substr($phone, 3);
    }

    if (strlen($phone) !== 10) {
        return 'UNKNOWN';
    }

    return match (substr($phone, 0, 3)) {
        '096', '076' => 'MTN',
        '097', '077' => 'AIRTEL',
        '095', '075' => 'ZAMTEL',
        default      => 'UNKNOWN'
    };
}

function ipay_normalize_status($status): string
{
    $status = strtolower(trim((string)$status));

    return match ($status) {
        'success', 'successful', 'completed', 'complete' => 'successful',
        'failed', 'failure', 'declined', 'cancelled', 'canceled' => 'failed',
        default => 'pending'
    };
}
