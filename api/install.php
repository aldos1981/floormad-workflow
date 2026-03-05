<?php
/**
 * install.php - Installation & Health Check Script
 * Run this from browser or CLI to initialize database and verify requirements.
 * 
 * Usage (CLI):    php api/install.php
 * Usage (Browser): https://yourdomain.com/api/install.php
 */

// Prevent caching
header('Cache-Control: no-cache, no-store, must-revalidate');

$is_cli = php_sapi_name() === 'cli';
$br = $is_cli ? "\n" : "<br>";
$bold_start = $is_cli ? "\033[1m" : "<strong>";
$bold_end = $is_cli ? "\033[0m" : "</strong>";
$ok = $is_cli ? "✅" : "✅";
$fail = $is_cli ? "❌" : "❌";
$warn = $is_cli ? "⚠️" : "⚠️";

if (!$is_cli) {
    echo '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Floormad Install</title><style>body{font-family:monospace;padding:20px;max-width:800px;margin:0 auto;background:#1a1a2e;color:#eee;} h1{color:#00d4ff;} .ok{color:#4caf50;} .fail{color:#f44336;} .warn{color:#ff9800;} pre{background:#0d0d1a;padding:15px;border-radius:8px;border:1px solid #333;overflow-x:auto;}</style></head><body><h1>🔧 Floormad Installation</h1><pre>';
}

echo "{$bold_start}Floormad Workflow - PHP Backend Installer{$bold_end}{$br}{$br}";

$errors = [];
$warnings = [];

// ============================================================
// 1. Check PHP Version
// ============================================================
echo "{$bold_start}1. PHP Version{$bold_end}{$br}";
$php_version = PHP_VERSION;
if (version_compare($php_version, '7.4', '>=')) {
    echo "   {$ok} PHP {$php_version}{$br}";
} else {
    echo "   {$fail} PHP {$php_version} (requires 7.4+){$br}";
    $errors[] = "PHP version too old: {$php_version}";
}

// ============================================================
// 2. Check Required Extensions
// ============================================================
echo "{$br}{$bold_start}2. Required PHP Extensions{$bold_end}{$br}";
$required_ext = ['pdo', 'pdo_mysql', 'curl', 'json', 'openssl', 'mbstring'];
$optional_ext = ['fileinfo', 'gd'];

foreach ($required_ext as $ext) {
    if (extension_loaded($ext)) {
        echo "   {$ok} {$ext}{$br}";
    } else {
        echo "   {$fail} {$ext} (REQUIRED){$br}";
        $errors[] = "Missing extension: {$ext}";
    }
}
foreach ($optional_ext as $ext) {
    if (extension_loaded($ext)) {
        echo "   {$ok} {$ext} (optional){$br}";
    } else {
        echo "   {$warn} {$ext} (optional, missing){$br}";
        $warnings[] = "Missing optional extension: {$ext}";
    }
}

// ============================================================
// 3. Config File
// ============================================================
echo "{$br}{$bold_start}3. Configuration{$bold_end}{$br}";
$config_file = __DIR__ . '/config.php';
if (file_exists($config_file)) {
    echo "   {$ok} config.php found{$br}";
    require_once $config_file;

    // Check constants
    $required_constants = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASS'];
    foreach ($required_constants as $const) {
        if (defined($const) && constant($const) !== '') {
            $val = constant($const);
            $display = ($const === 'DB_PASS') ? str_repeat('*', min(strlen($val), 8)) : $val;
            echo "   {$ok} {$const} = {$display}{$br}";
        } else {
            echo "   {$fail} {$const} not configured{$br}";
            $errors[] = "{$const} not configured in config.php";
        }
    }
} else {
    echo "   {$fail} config.php NOT FOUND{$br}";
    $errors[] = "config.php not found. Copy config.php.example and configure.";
}

// ============================================================
// 4. Database Connection & Tables
// ============================================================
echo "{$br}{$bold_start}4. Database{$bold_end}{$br}";
if (empty($errors)) {
    try {
        require_once __DIR__ . '/database.php';
        $db = get_db_connection();
        echo "   {$ok} Connected to MySQL{$br}";

        // Init tables
        init_db();
        echo "   {$ok} Tables created/verified{$br}";

        // List tables
        $tables = $db->query("SHOW TABLES")->fetchAll(PDO::FETCH_COLUMN);
        echo "   {$ok} Tables: " . implode(', ', $tables) . "{$br}";

        // Projects count
        $count = $db->query("SELECT COUNT(*) FROM projects")->fetchColumn();
        echo "   {$ok} Projects in DB: {$count}{$br}";

    } catch (Exception $e) {
        echo "   {$fail} Database Error: {$e->getMessage()}{$br}";
        $errors[] = "Database: {$e->getMessage()}";
    }
} else {
    echo "   {$warn} Skipped (fix config errors first){$br}";
}

// ============================================================
// 5. Directories & Permissions
// ============================================================
echo "{$br}{$bold_start}5. Directories{$bold_end}{$br}";
$dirs_to_check = [
    UPLOADS_DIR ?? dirname(__DIR__) . '/uploads',
];

foreach ($dirs_to_check as $dir) {
    if (!is_dir($dir)) {
        if (@mkdir($dir, 0755, true)) {
            echo "   {$ok} Created: {$dir}{$br}";
        } else {
            echo "   {$fail} Cannot create: {$dir}{$br}";
            $errors[] = "Cannot create directory: {$dir}";
        }
    } else {
        echo "   {$ok} Exists: {$dir}{$br}";
    }
    if (is_dir($dir) && is_writable($dir)) {
        echo "   {$ok} Writable: {$dir}{$br}";
    } elseif (is_dir($dir)) {
        echo "   {$fail} Not writable: {$dir}{$br}";
        $errors[] = "Directory not writable: {$dir}";
    }
}

// ============================================================
// 6. .htaccess
// ============================================================
echo "{$br}{$bold_start}6. Apache Config{$bold_end}{$br}";
$htaccess_root = dirname(__DIR__) . '/.htaccess';
$htaccess_api = __DIR__ . '/.htaccess';
echo (file_exists($htaccess_root) ? "   {$ok}" : "   {$warn}") . " Root .htaccess: " . (file_exists($htaccess_root) ? 'present' : 'missing') . "{$br}";
echo (file_exists($htaccess_api) ? "   {$ok}" : "   {$warn}") . " API .htaccess: " . (file_exists($htaccess_api) ? 'present' : 'missing') . "{$br}";

// Check mod_rewrite
if (function_exists('apache_get_modules')) {
    $modules = apache_get_modules();
    echo (in_array('mod_rewrite', $modules) ? "   {$ok}" : "   {$fail}") . " mod_rewrite: " . (in_array('mod_rewrite', $modules) ? 'enabled' : 'DISABLED') . "{$br}";
} else {
    echo "   {$warn} Cannot detect mod_rewrite (not running under Apache module?){$br}";
}

// ============================================================
// 7. File List
// ============================================================
echo "{$br}{$bold_start}7. API Files{$bold_end}{$br}";
$expected_files = [
    'config.php',
    'database.php',
    'index.php',
    'engine.php',
    'workflow_engine.php',
    'llm_utils.php',
    'pipedrive_client.php',
    'wesender_client.php',
    'media_engine.php',
    'knowledge_parser.php',
    'settings.php',
    'projects.php',
    'google_auth.php',
];
foreach ($expected_files as $f) {
    $fp = __DIR__ . '/' . $f;
    if (file_exists($fp)) {
        $size = filesize($fp);
        echo "   {$ok} {$f} (" . number_format($size) . " bytes){$br}";
    } else {
        echo "   {$fail} {$f} MISSING{$br}";
        $errors[] = "Missing file: api/{$f}";
    }
}

// ============================================================
// Summary
// ============================================================
echo "{$br}{$bold_start}" . str_repeat('=', 50) . "{$bold_end}{$br}";
if (empty($errors)) {
    echo "{$ok} {$bold_start}INSTALLATION COMPLETE! All checks passed.{$bold_end}{$br}";
    echo "{$br}Next steps:{$br}";
    echo "  1. Open your domain in a browser{$br}";
    echo "  2. Go to Settings → add your Google API Key{$br}";
    echo "  3. Create your first project{$br}";
} else {
    echo "{$fail} {$bold_start}ERRORS FOUND ({" . count($errors) . "}){$bold_end}{$br}";
    foreach ($errors as $i => $e) {
        echo "  " . ($i + 1) . ". {$e}{$br}";
    }
}
if (!empty($warnings)) {
    echo "{$br}{$warn} {$bold_start}Warnings ({" . count($warnings) . "}){$bold_end}{$br}";
    foreach ($warnings as $w) {
        echo "  - {$w}{$br}";
    }
}

if (!$is_cli) {
    echo '</pre></body></html>';
}
