<?php
/**
 * Floormad Workflow - Configuration
 * Carica variabili da .env o usa valori di default.
 */

// Carica .env se presente
$envFile = __DIR__ . '/../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#')
            continue;
        if (strpos($line, '=') !== false) {
            list($key, $value) = explode('=', $line, 2);
            $key = trim($key);
            $value = trim($value);
            // Rimuovi virgolette
            $value = trim($value, '"\'');
            if (!getenv($key)) {
                putenv("$key=$value");
                $_ENV[$key] = $value;
            }
        }
    }
}

// Database
define('DB_HOST', getenv('DB_HOST') ?: 'localhost');
define('DB_NAME', getenv('DB_NAME') ?: 'floormad');
define('DB_USER', getenv('DB_USER') ?: 'root');
define('DB_PASS', getenv('DB_PASS') ?: '');
define('DB_CHARSET', 'utf8mb4');

// Google
define('GOOGLE_API_KEY', getenv('GOOGLE_API_KEY') ?: getenv('GEMINI_API_KEY') ?: '');
define('GOOGLE_SHEET_ID', getenv('GOOGLE_SHEET_ID') ?: '');
define('GOOGLE_SHEETS_CREDENTIALS_JSON', getenv('GOOGLE_SHEETS_CREDENTIALS_JSON') ?: '');

// SMTP (defaults from .env)
define('SMTP_SERVER', getenv('SMTP_SERVER') ?: '');
define('SMTP_PORT', getenv('SMTP_PORT') ?: '587');
define('SMTP_USER', getenv('SMTP_USER') ?: '');
define('SMTP_PASSWORD', getenv('SMTP_PASSWORD') ?: '');
define('EMAIL_FROM', getenv('EMAIL_FROM') ?: '');

// WeSendit
define('WESENDIT_API_KEY', getenv('WESENDIT_API_KEY') ?: '');
define('WESENDIT_API_URL', getenv('WESENDIT_API_URL') ?: 'https://wasenderapi.com/api/send-message');

// Dashboard Security
define('DASHBOARD_USERNAME', getenv('DASHBOARD_USERNAME') ?: 'admin');
define('DASHBOARD_PASSWORD', getenv('DASHBOARD_PASSWORD') ?: 'secure_password_here');

// Paths
define('UPLOAD_DIR', __DIR__ . '/../uploads');
define('UPLOADS_DIR', UPLOAD_DIR); // alias for engine/projects modules
define('BASE_DIR', realpath(__DIR__ . '/..'));

// Version
define('APP_VERSION', trim(@file_get_contents(__DIR__ . '/../version.txt') ?: '0.0.0'));

// CORS Headers helper
function send_cors_headers()
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
    header('Content-Type: application/json; charset=utf-8');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// JSON response helpers
function json_response($data, $code = 200)
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error($message, $code = 400)
{
    json_response(['success' => false, 'error' => $message, 'detail' => $message], $code);
}

// Get JSON body from request
function get_json_body()
{
    $raw = file_get_contents('php://input');
    if (empty($raw))
        return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// cURL helper for external API calls
function http_request($method, $url, $data = null, $headers = [])
{
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $method = strtoupper($method);
    if ($method === 'POST') {
        curl_setopt($ch, CURLOPT_POST, true);
    } elseif ($method !== 'GET') {
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    }

    if ($data !== null) {
        $json = json_encode($data, JSON_UNESCAPED_UNICODE);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
        $headers[] = 'Content-Type: application/json';
    }

    if (!empty($headers)) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return ['success' => false, 'error' => "cURL error: $error", 'http_code' => 0];
    }

    $decoded = json_decode($response, true);
    return [
        'success' => $httpCode >= 200 && $httpCode < 400,
        'http_code' => $httpCode,
        'data' => $decoded,
        'raw' => $response
    ];
}
