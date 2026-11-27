
<?php
// SmartFore Lending Bulk SMS API Test

$apiUrl = "https://bulksms.smartforelending.com/api/bulk/v1/sms";

// Replace with your actual API key
$apiKey = "s4_live_2c2e47521ddc3a52971885e00759f84f35c7a889";

// API response
$response = null;
$httpCode = null;
$error = null;

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $to = "0960883940";
    $senderId = "hey";
    $message = "hello";
    $reference = "";

    $payload = [
        "to" => array_map("trim", explode(",", $to)),
        "sender_id" => $senderId,
        "message" => $message,
        "reference" => $reference
    ];

    $payload = array_filter(
        $payload,
        fn($value) => $value !== "" && $value !== []
    );

    $ch = curl_init($apiUrl);

    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            "Authorization: Bearer " . $apiKey,
            "Content-Type: application/json",
            "Accept: application/json"
        ],
        CURLOPT_POSTFIELDS => json_encode($payload),
        CURLOPT_TIMEOUT => 30
    ]);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

    if (curl_errno($ch)) {
        $error = curl_error($ch);
    }

    curl_close($ch);
}
?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bulk SMS API Tester</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background: #f4f4f4;
            padding: 30px;
        }

        .container {
            max-width: 600px;
            margin: auto;
            background: white;
            padding: 25px;
            border-radius: 10px;
        }

        input, textarea, button {
            width: 100%;
            padding: 12px;
            margin: 8px 0 15px;
            box-sizing: border-box;
        }

        button {
            background: #008075;
            color: white;
            border: none;
            cursor: pointer;
            font-weight: bold;
        }

        pre {
            background: #222;
            color: #00ff90;
            padding: 15px;
            overflow-x: auto;
            white-space: pre-wrap;
        }

        label {
            font-weight: bold;
        }
    </style>
</head>
<body>

<div class="container">

    <h2>Bulk SMS API Tester</h2>

    <form method="POST">

        <label>Recipient Numbers</label>
        <input
            type="text"
            name="to"
            placeholder="0971234567,0961234567"
            required
        >

        <label>Sender ID</label>
        <input
            type="text"
            name="sender_id"
            placeholder="YOURSHOP"
            required
        >

        <label>Message</label>
        <textarea
            name="message"
            rows="5"
            placeholder="Enter your SMS message"
            required
        ></textarea>

        <label>Reference (Optional)</label>
        <input
            type="text"
            name="reference"
            placeholder="test-001"
        >

        <button type="submit">Send Test SMS</button>

    </form>

    <?php if ($error): ?>
        <h3>cURL Error</h3>
        <pre><?= htmlspecialchars($error) ?></pre>
    <?php endif; ?>

    <?php if ($response !== null): ?>
        <h3>API Response</h3>
        <p>HTTP Status: <?= htmlspecialchars((string)$httpCode) ?></p>
        <pre><?= htmlspecialchars(
            json_encode(
                json_decode($response),
                JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES
            ) ?: $response
        ) ?></pre>
    <?php endif; ?>

</div>

</body>
</html>
