<?php
/**
 * settings.php - Global Settings & System Info
 * PHP port of main.py settings endpoints
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

/**
 * GET /api/settings
 */
function handle_get_settings()
{
    $db = get_db_connection();
    $stmt = $db->query("SELECT `key`, `value` FROM settings");
    $rows = $stmt->fetchAll();
    $result = [];
    foreach ($rows as $row) {
        $result[$row['key']] = $row['value'];
    }
    return $result;
}

/**
 * POST /api/settings
 */
function handle_update_settings($data)
{
    $db = get_db_connection();
    $allowed_keys = ['service_account_json', 'google_api_key', 'default_sheet_id', 'google_client_id', 'google_client_secret'];

    try {
        foreach ($allowed_keys as $key) {
            if (isset($data[$key]) && $data[$key] !== null) {
                $stmt = $db->prepare("INSERT INTO settings (`key`, `value`) VALUES (?, ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)");
                $stmt->execute([$key, $data[$key]]);
            }
        }
        return ['success' => true, 'message' => 'Settings updated'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * GET /api/system/info
 */
function handle_system_info()
{
    $base_dir = dirname(__DIR__);

    // Version
    $version = '0.0.0';
    $version_file = $base_dir . '/version.txt';
    if (file_exists($version_file)) {
        $version = trim(file_get_contents($version_file));
    }

    // Changelog
    $changelog = 'Changelog not found.';
    $changelog_file = $base_dir . '/CHANGELOG.md';
    if (file_exists($changelog_file)) {
        $changelog = file_get_contents($changelog_file);
    }

    return ['version' => $version, 'changelog' => $changelog];
}

/**
 * POST /api/test_gemini
 */
function handle_test_gemini($data)
{
    $api_key = $data['api_key'] ?? '';
    if (!$api_key) {
        http_response_code(400);
        return ['success' => false, 'message' => 'Missing API Key'];
    }

    try {
        $url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={$api_key}";
        $payload = [
            'contents' => [['parts' => [['text' => "Reply with 'OK' if you receive this."]]]],
            'generationConfig' => ['maxOutputTokens' => 50],
        ];

        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $resp = curl_exec($ch);
        $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($http_code !== 200) {
            return ['success' => false, 'message' => "API returned HTTP {$http_code}", 'details' => $resp];
        }

        $result = json_decode($resp, true);
        $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';
        if ($text) {
            return ['success' => true, 'message' => 'Connection Successful!', 'response' => $text];
        }
        return ['success' => false, 'message' => 'No response text received.'];
    } catch (Exception $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * POST /api/test/email
 */
function handle_test_email($data)
{
    $host = $data['host'] ?? '';
    $port = intval($data['port'] ?? 587);
    $user = $data['user'] ?? '';
    $password = $data['password'] ?? '';
    $from_name = $data['from_name'] ?? 'Floormad Manager';
    $to_email = $data['to_email'] ?? $user;

    if (!$host || !$user || !$password) {
        http_response_code(400);
        return ['success' => false, 'message' => 'Missing SMTP parameters'];
    }

    $recipient = $to_email ?: $user;
    $subject = '✅ Floormad Automation Manager - SMTP Configuration Test';

    $html_body = '<html><head><style>body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; } .container { max-width: 600px; margin: 20px auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; } .header { background-color: #4CAF50; color: white; padding: 10px 20px; border-radius: 5px; text-align: center; } .content { padding: 20px; } .footer { font-size: 12px; color: #666; margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd; }</style></head><body><div class="container"><div class="header"><h2>✅ SMTP Connection Successful</h2></div><div class="content"><p>Hello,</p><p>This is a <strong>test message</strong> from your <strong>Floormad Automation Manager</strong> to confirm that SMTP email configuration is working correctly.</p><p><strong>Test Details:</strong></p><ul><li><strong>Recipient:</strong> ' . htmlspecialchars($recipient) . '</li><li><strong>From:</strong> ' . htmlspecialchars($from_name) . ' (' . htmlspecialchars($user) . ')</li><li><strong>Server:</strong> ' . htmlspecialchars($host) . ':' . $port . '</li></ul><p>If you received this email, your SMTP settings are configured correctly.</p></div><div class="footer"><p>Sent by Floormad Automation Manager</p></div></div></body></html>';

    $plain_text = "SMTP Connection Successful\n\nThis is a test message from your Floormad Automation Manager.\nRecipient: {$recipient}\nFrom: {$from_name} ({$user})\nServer: {$host}:{$port}";

    // SMTP via fsockopen
    try {
        $use_ssl = ($port == 465);
        $conn_host = $use_ssl ? "ssl://{$host}" : $host;

        $fp = @fsockopen($conn_host, $port, $errno, $errstr, 15);
        if (!$fp) {
            return ['success' => false, 'message' => "Connection failed: {$errstr} ({$errno})"];
        }

        $read_fn = function () use ($fp) {
            $data = '';
            while ($line = fgets($fp, 512)) {
                $data .= $line;
                if (substr($line, 3, 1) === ' ')
                    break;
            }
            return $data;
        };

        $read_fn(); // Banner
        fwrite($fp, "EHLO {$host}\r\n");
        $read_fn();

        if (!$use_ssl && $port == 587) {
            fwrite($fp, "STARTTLS\r\n");
            $resp = $read_fn();
            if (strpos($resp, '220') === false) {
                fclose($fp);
                return ['success' => false, 'message' => "STARTTLS failed: {$resp}"];
            }
            stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            fwrite($fp, "EHLO {$host}\r\n");
            $read_fn();
        }

        fwrite($fp, "AUTH LOGIN\r\n");
        $read_fn();
        fwrite($fp, base64_encode($user) . "\r\n");
        $read_fn();
        fwrite($fp, base64_encode($password) . "\r\n");
        $resp = $read_fn();
        if (strpos($resp, '235') === false) {
            fclose($fp);
            return ['success' => false, 'message' => "Auth failed: {$resp}"];
        }

        fwrite($fp, "MAIL FROM:<{$user}>\r\n");
        $read_fn();
        fwrite($fp, "RCPT TO:<{$recipient}>\r\n");
        $read_fn();
        fwrite($fp, "DATA\r\n");
        $read_fn();

        $boundary = md5(uniqid(time()));
        $msg = "To: {$recipient}\r\n";
        $msg .= "From: {$from_name} <{$user}>\r\n";
        $msg .= "Subject: {$subject}\r\n";
        $msg .= "MIME-Version: 1.0\r\n";
        $msg .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n\r\n";
        $msg .= "--{$boundary}\r\n";
        $msg .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
        $msg .= $plain_text . "\r\n\r\n";
        $msg .= "--{$boundary}\r\n";
        $msg .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
        $msg .= $html_body . "\r\n\r\n";
        $msg .= "--{$boundary}--\r\n.\r\n";

        fwrite($fp, $msg);
        $read_fn();
        fwrite($fp, "QUIT\r\n");
        fclose($fp);

        return ['success' => true];
    } catch (Exception $e) {
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * POST /api/test/whatsapp
 */
function handle_test_whatsapp($data)
{
    require_once __DIR__ . '/wesender_client.php';

    $api_key = $data['api_key'] ?? '';
    $api_url = $data['api_url'] ?? null;
    $phone = $data['phone'] ?? '';
    $message = $data['message'] ?? 'Test message from Floormad';

    if (!$api_key || !$phone) {
        http_response_code(400);
        return ['success' => false, 'message' => 'Missing api_key or phone'];
    }

    try {
        $client = new WeSenderClient($api_key, $api_url);
        $result = $client->send_message($phone, $message);
        if ($result['success'] ?? false) {
            return ['success' => true, 'api_response' => $result['data'] ?? null];
        } else {
            http_response_code(500);
            return ['success' => false, 'message' => 'WeSender Error: ' . ($result['details']['error'] ?? 'Unknown'), 'details' => $result['details'] ?? null];
        }
    } catch (Exception $e) {
        http_response_code(500);
        return ['success' => false, 'message' => $e->getMessage()];
    }
}

/**
 * POST /api/test/pipedrive
 */
function handle_test_pipedrive($data)
{
    require_once __DIR__ . '/pipedrive_client.php';

    $api_token = $data['api_token'] ?? '';
    $email = $data['email'] ?? 'test@example.com';

    if (!$api_token) {
        http_response_code(400);
        return ['success' => false, 'message' => 'Missing api_token'];
    }

    try {
        $client = new PipedriveClient($api_token);
        $person = $client->search_person($email);
        if ($person) {
            return ['success' => true, 'message' => 'Connected! Found: ' . ($person['name'] ?? 'Unknown'), 'person' => $person];
        } else {
            return ['success' => true, 'message' => 'Connected to Pipedrive! No person found with that email (this is OK).'];
        }
    } catch (Exception $e) {
        http_response_code(500);
        return ['success' => false, 'message' => $e->getMessage()];
    }
}
