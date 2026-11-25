<?php
// db_connection.php

require_once __DIR__ . '/connection.php';

$host    = $pdo->getAttribute(PDO::ATTR_CONNECTION_STATUS);
$db      = getenv('IPAY_DB_NAME') ?: 'payper';
$user    = getenv('IPAY_DB_USER') ?: 'root';
$pass    = getenv('IPAY_DB_PASS') !== false ? getenv('IPAY_DB_PASS') : '';
$charset = 'utf8mb4';
