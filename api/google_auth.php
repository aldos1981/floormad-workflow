<?php
/**
 * google_auth.php - Google OAuth Flow (SDK-free, pure cURL)
 * PHP port of main.py OAuth endpoints
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

/**
 * Get OAuth client credentials from settings.
 */
function get_google_client_config()
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT `key`, `value` FROM settings WHERE `key` IN ('google_client_id', 'google_client_secret')");
    $stmt->execute();
    $rows = $stmt->fetchAll();
    $config = [];
    foreach ($rows as $row)
        $config[$row['key']] = $row['value'];
    return $config;
}

/**
 * Determine the redirect URI for OAuth callback.
 */
function get_redirect_uri()
{
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    return "{$scheme}://{$host}/api/auth/google/callback";
}

/**
 * GET /api/auth/google/url?project_id=xxx
 * Returns the Google OAuth authorization URL.
 */
function handle_get_auth_url($project_id)
{
    $config = get_google_client_config();
    $client_id = $config['google_client_id'] ?? '';
    $client_secret = $config['google_client_secret'] ?? '';

    if (!$client_id || !$client_secret) {
        return ['error' => 'Google Client ID and Secret not configured in Settings.'];
    }

    $redirect_uri = get_redirect_uri();
    $scopes = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly';

    $params = [
        'client_id' => $client_id,
        'redirect_uri' => $redirect_uri,
        'response_type' => 'code',
        'scope' => $scopes,
        'access_type' => 'offline',
        'prompt' => 'consent',
        'include_granted_scopes' => 'true',
        'state' => $project_id,
    ];

    $url = 'https://accounts.google.com/o/oauth2/auth?' . http_build_query($params);
    return ['url' => $url];
}

/**
 * GET /api/auth/google/callback?state=xxx&code=xxx
 * Exchanges the authorization code for tokens and saves to project.
 */
function handle_auth_callback()
{
    $state = $_GET['state'] ?? '';
    $code = $_GET['code'] ?? '';
    $project_id = $state;

    if (!$project_id || !$code) {
        echo '<h3>Error: Missing state or code parameter</h3>';
        exit;
    }

    $config = get_google_client_config();
    $client_id = $config['google_client_id'] ?? '';
    $client_secret = $config['google_client_secret'] ?? '';
    $redirect_uri = get_redirect_uri();

    // Exchange code for token
    $post_data = [
        'code' => $code,
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'redirect_uri' => $redirect_uri,
        'grant_type' => 'authorization_code',
    ];

    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $resp = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $data = json_decode($resp, true);

    if (empty($data['access_token'])) {
        $error = $data['error_description'] ?? $data['error'] ?? 'Unknown error';
        echo "<h3>Error: {$error}</h3>";
        exit;
    }

    // Build credentials object compatible with existing get_oauth_access_token()
    $creds = [
        'token' => $data['access_token'],
        'refresh_token' => $data['refresh_token'] ?? null,
        'token_uri' => 'https://oauth2.googleapis.com/token',
        'client_id' => $client_id,
        'client_secret' => $client_secret,
        'scopes' => ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
        'expiry' => date('c', time() + ($data['expires_in'] ?? 3600)),
    ];

    // Save to project
    try {
        $db = get_db_connection();
        $stmt = $db->prepare("UPDATE projects SET oauth_credentials = ? WHERE id = ?");
        $stmt->execute([json_encode($creds), $project_id]);
    } catch (Exception $e) {
        echo "<h3>Error saving credentials: {$e->getMessage()}</h3>";
        exit;
    }

    // Close popup and notify parent
    echo '<script>window.opener.postMessage("oauth_success", "*"); window.close();</script>';
    exit;
}
