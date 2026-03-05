<?php
/**
 * Floormad Workflow - Database Layer (PDO MySQL)
 */
require_once __DIR__ . '/config.php';

$_db_instance = null;

function get_db_connection()
{
    global $_db_instance;
    if ($_db_instance !== null) {
        return $_db_instance;
    }

    try {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        $options = [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ];
        $_db_instance = new PDO($dsn, DB_USER, DB_PASS, $options);
        return $_db_instance;
    } catch (PDOException $e) {
        error_log("Database connection failed: " . $e->getMessage());
        json_error("Database connection failed: " . $e->getMessage(), 500);
    }
}

function init_db()
{
    $db = get_db_connection();

    // Projects Table
    $db->exec("
        CREATE TABLE IF NOT EXISTS projects (
            id VARCHAR(36) PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            status VARCHAR(50) DEFAULT 'active',
            google_sheet_id VARCHAR(255) NOT NULL DEFAULT '',
            service_account_json LONGTEXT NOT NULL DEFAULT '',
            smtp_config JSON,
            wesendit_config JSON,
            pipedrive_config JSON,
            cron_expression VARCHAR(100),
            price_list_url TEXT,
            locality_prompt TEXT,
            products_config JSON,
            workflow_json LONGTEXT,
            oauth_credentials JSON,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Runs Table
    $db->exec("
        CREATE TABLE IF NOT EXISTS runs (
            id VARCHAR(36) PRIMARY KEY,
            project_id VARCHAR(36),
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            leads_processed INT DEFAULT 0,
            status VARCHAR(50),
            log_details LONGTEXT,
            output_json LONGTEXT,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Settings Table
    $db->exec("
        CREATE TABLE IF NOT EXISTS settings (
            `key` VARCHAR(100) PRIMARY KEY,
            `value` TEXT
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Workflow Versions Table
    $db->exec("
        CREATE TABLE IF NOT EXISTS workflow_versions (
            id VARCHAR(36) PRIMARY KEY,
            project_id VARCHAR(36) NOT NULL,
            workflow_json LONGTEXT NOT NULL,
            label VARCHAR(100),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    // Workflow run status tracking (replaces WebSocket with polling)
    $db->exec("
        CREATE TABLE IF NOT EXISTS workflow_status (
            id VARCHAR(36) PRIMARY KEY,
            project_id VARCHAR(36) NOT NULL,
            status VARCHAR(50) DEFAULT 'running',
            progress LONGTEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_project (project_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    return true;
}

/**
 * Genera un UUID v4
 */
function generate_uuid()
{
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0xffff)
    );
}
