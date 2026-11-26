<?php

define('IPAY_ALLOWED_ORIGIN', getenv('IPAY_CORS_ORIGIN') ?: '*');

function ipay_send_cors_headers(): void
{
    header('Access-Control-Allow-Origin: ' . IPAY_ALLOWED_ORIGIN);
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With, Idempotency-Key');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Max-Age: 86400');
    header('Access-Control-Allow-Credentials: false');
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function ipay_json(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function ipay_json_input(): array
{
    static $input = null;

    if ($input !== null) {
        return $input;
    }

    $raw = file_get_contents('php://input');
    $decoded = json_decode($raw ?: '[]', true);
    $input = is_array($decoded) ? $decoded : [];

    return $input;
}

function ipay_require_post(): void
{
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

    if ($method !== 'POST') {
        ipay_json(['success' => false, 'message' => 'Method not allowed'], 405);
    }
}
