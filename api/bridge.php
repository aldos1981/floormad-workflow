<?php
/**
 * Bridge.php — Email relay for Floormad Workflow
 * Deploy this file to: http://workflow.floormad.com/bridge.php
 * 
 * This allows the Railway app to send emails via cPanel's SMTP
 * since Railway blocks direct SMTP connections.
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'POST only']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$action = $input['action'] ?? '';

switch ($action) {
    case 'send_test_email':
        echo json_encode(sendTestEmail($input));
        break;
    case 'send_email':
        echo json_encode(sendEmail($input));
        break;
    case 'ping':
        echo json_encode(['success' => true, 'message' => 'Bridge is alive']);
        break;
    default:
        echo json_encode(['success' => false, 'message' => "Unknown action: {$action}"]);
}

function sendTestEmail($input)
{
    $host = $input['host'] ?? '';
    $port = intval($input['port'] ?? 465);
    $user = $input['user'] ?? '';
    $password = $input['password'] ?? '';
    $from_name = $input['from_name'] ?? 'Floormad Manager';
    $to_email = $input['to_email'] ?? $user;

    if (!$host || !$user || !$password) {
        return ['success' => false, 'message' => 'Missing SMTP credentials'];
    }

    $subject = "✅ Floormad Automation Manager - SMTP Test";
    $html_body = "
    <html>
    <body style='font-family: Arial, sans-serif;'>
        <div style='max-width:600px; margin:20px auto; padding:20px; border:1px solid #ddd; border-radius:8px;'>
            <div style='background:#4CAF50; color:white; padding:10px 20px; border-radius:5px; text-align:center;'>
                <h2>✅ SMTP Connection Successful</h2>
            </div>
            <div style='padding:20px;'>
                <p>This is a <strong>test message</strong> from your <strong>Floormad Automation Manager</strong>.</p>
                <ul>
                    <li><strong>Recipient:</strong> {$to_email}</li>
                    <li><strong>From:</strong> {$from_name} ({$user})</li>
                    <li><strong>Server:</strong> {$host}:{$port}</li>
                    <li><strong>Method:</strong> Bridge relay (cPanel)</li>
                </ul>
                <p>If you received this email, your SMTP settings are working correctly! 🎉</p>
            </div>
        </div>
    </body>
    </html>";

    $plain_text = strip_tags($html_body);

    return smtpSend($host, $port, $user, $password, $from_name, $user, $to_email, $subject, $html_body, $plain_text);
}

function sendEmail($input)
{
    $host = $input['host'] ?? '';
    $port = intval($input['port'] ?? 465);
    $user = $input['user'] ?? '';
    $password = $input['password'] ?? '';
    $from_name = $input['from_name'] ?? 'Notification';
    $to_email = $input['to_email'] ?? '';
    $subject = $input['subject'] ?? 'Notification';
    $html_body = $input['html_body'] ?? '';
    $plain_text = $input['plain_text'] ?? strip_tags($html_body);

    if (!$host || !$user || !$password || !$to_email) {
        return ['success' => false, 'message' => 'Missing required fields'];
    }

    return smtpSend($host, $port, $user, $password, $from_name, $user, $to_email, $subject, $html_body, $plain_text);
}

function smtpSend($host, $port, $user, $password, $from_name, $from_email, $to, $subject, $html_body, $plain_text)
{
    $use_ssl = ($port == 465);
    $conn_host = $use_ssl ? "ssl://{$host}" : $host;
    $debug = [];

    $fp = @fsockopen($conn_host, $port, $errno, $errstr, 20);
    if (!$fp) {
        return ['success' => false, 'message' => "Connection failed: {$errstr} ({$errno})"];
    }

    $debug[] = "Connected to {$conn_host}:{$port}";
    $resp = smtpRead($fp);
    $debug[] = "GREETING: " . trim($resp);

    smtpWrite($fp, "EHLO {$host}");
    $resp = smtpRead($fp);
    $debug[] = "EHLO: " . trim(explode("\n", $resp)[0]);

    if (!$use_ssl && $port == 587) {
        smtpWrite($fp, "STARTTLS");
        $resp = smtpRead($fp);
        if (strpos($resp, '220') === false) {
            fclose($fp);
            return ['success' => false, 'message' => "STARTTLS failed: {$resp}", 'debug' => $debug];
        }
        stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
        smtpWrite($fp, "EHLO {$host}");
        smtpRead($fp);
        $debug[] = "STARTTLS OK";
    }

    // Auth
    smtpWrite($fp, "AUTH LOGIN");
    smtpRead($fp);
    smtpWrite($fp, base64_encode($user));
    smtpRead($fp);
    smtpWrite($fp, base64_encode($password));
    $resp = smtpRead($fp);
    if (strpos($resp, '235') === false) {
        fclose($fp);
        return ['success' => false, 'message' => "Auth failed: " . trim($resp), 'debug' => $debug];
    }
    $debug[] = "AUTH OK";

    smtpWrite($fp, "MAIL FROM:<{$from_email}>");
    $resp = smtpRead($fp);
    if (strpos($resp, '250') === false) {
        fclose($fp);
        return ['success' => false, 'message' => "MAIL FROM rejected: " . trim($resp), 'debug' => $debug];
    }

    smtpWrite($fp, "RCPT TO:<{$to}>");
    $resp = smtpRead($fp);
    if (strpos($resp, '250') === false) {
        fclose($fp);
        return ['success' => false, 'message' => "RCPT TO rejected: " . trim($resp), 'debug' => $debug];
    }

    smtpWrite($fp, "DATA");
    $resp = smtpRead($fp);
    if (strpos($resp, '354') === false) {
        fclose($fp);
        return ['success' => false, 'message' => "DATA rejected: " . trim($resp), 'debug' => $debug];
    }

    $boundary = md5(uniqid(time()));
    $msg = "To: {$to}\r\n";
    $msg .= "Subject: {$subject}\r\n";
    $msg .= "From: {$from_name} <{$from_email}>\r\n";
    $msg .= "MIME-Version: 1.0\r\n";
    $msg .= "Content-Type: multipart/alternative; boundary=\"{$boundary}\"\r\n";
    $msg .= "Date: " . date('r') . "\r\n\r\n";
    $msg .= "--{$boundary}\r\n";
    $msg .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
    $msg .= $plain_text . "\r\n\r\n";
    $msg .= "--{$boundary}\r\n";
    $msg .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
    $msg .= $html_body . "\r\n\r\n";
    $msg .= "--{$boundary}--\r\n.\r\n";

    fwrite($fp, $msg);
    $resp = smtpRead($fp);
    $debug[] = "DATA SEND: " . trim($resp);

    if (strpos($resp, '250') === false) {
        fclose($fp);
        return ['success' => false, 'message' => "Message rejected: " . trim($resp), 'debug' => $debug];
    }

    smtpWrite($fp, "QUIT");
    fclose($fp);

    return ['success' => true, 'message' => 'Email sent successfully', 'debug' => $debug];
}

function smtpWrite($fp, $cmd)
{
    fwrite($fp, $cmd . "\r\n");
}

function smtpRead($fp)
{
    $data = '';
    while ($line = fgets($fp, 512)) {
        $data .= $line;
        if (substr($line, 3, 1) === ' ')
            break;
    }
    return $data;
}
