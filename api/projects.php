<?php
/**
 * projects.php - Projects CRUD, Workflow Versions, Media, Price Lists
 * PHP port of main.py project endpoints
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

/**
 * GET /api/projects
 */
function handle_list_projects()
{
    $db = get_db_connection();
    $stmt = $db->query("SELECT * FROM projects ORDER BY created_at DESC");
    return ['projects' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
}

/**
 * POST /api/projects
 */
function handle_create_project($data)
{
    $project_id = generate_uuid();
    $db = get_db_connection();

    try {
        $stmt = $db->prepare("INSERT INTO projects (id, name, description, google_sheet_id, service_account_json, smtp_config, wesendit_config, pipedrive_config, cron_expression, price_list_url, locality_prompt, products_config, workflow_json, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')");
        $stmt->execute([
            $project_id,
            $data['name'] ?? 'Untitled',
            $data['description'] ?? '',
            $data['google_sheet_id'] ?? '',
            $data['service_account_json'] ?? '',
            isset($data['smtp_config']) ? json_encode($data['smtp_config']) : null,
            isset($data['wesendit_config']) ? json_encode($data['wesendit_config']) : null,
            isset($data['pipedrive_config']) ? json_encode($data['pipedrive_config']) : null,
            $data['cron_expression'] ?? null,
            $data['price_list_url'] ?? null,
            $data['locality_prompt'] ?? null,
            isset($data['products_config']) ? json_encode($data['products_config']) : null,
            isset($data['workflow_json']) ? json_encode($data['workflow_json']) : null,
        ]);
        return ['id' => $project_id, 'message' => 'Project created successfully'];
    } catch (Exception $e) {
        http_response_code(500);
        return ['error' => $e->getMessage()];
    }
}

/**
 * GET /api/projects/{id}
 */
function handle_get_project($project_id)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$project) {
        http_response_code(404);
        return ['error' => 'Project not found'];
    }
    return $project;
}

/**
 * PUT /api/projects/{id}
 */
function handle_update_project($project_id, $data)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        return ['error' => 'Project not found'];
    }

    // Dynamic update
    $allowed = [
        'name',
        'description',
        'status',
        'google_sheet_id',
        'service_account_json',
        'cron_expression',
        'price_list_url',
        'locality_prompt',
        'google_sheet_range',
        'oauth_credentials',
    ];
    $json_fields = ['products_config', 'workflow_json', 'smtp_config', 'wesendit_config', 'pipedrive_config'];

    $fields = [];
    $values = [];

    foreach ($allowed as $key) {
        if (array_key_exists($key, $data)) {
            $fields[] = "`{$key}` = ?";
            $values[] = $data[$key];
        }
    }
    foreach ($json_fields as $key) {
        if (array_key_exists($key, $data) && $data[$key] !== null) {
            $fields[] = "`{$key}` = ?";
            $values[] = is_string($data[$key]) ? $data[$key] : json_encode($data[$key]);
        }
    }

    if (empty($fields)) {
        return ['message' => 'No changes to update'];
    }

    $values[] = $project_id;
    $query = "UPDATE projects SET " . implode(', ', $fields) . " WHERE id = ?";

    try {
        $db->prepare($query)->execute($values);

        // Auto-snapshot workflow version
        if (array_key_exists('workflow_json', $data) && $data['workflow_json'] !== null) {
            $wf_json_str = is_string($data['workflow_json']) ? $data['workflow_json'] : json_encode($data['workflow_json']);
            $count_stmt = $db->prepare("SELECT COUNT(*) FROM workflow_versions WHERE project_id = ?");
            $count_stmt->execute([$project_id]);
            $count = $count_stmt->fetchColumn();
            $version_label = 'v' . ($count + 1);

            $db->prepare("INSERT INTO workflow_versions (id, project_id, workflow_json, label) VALUES (?, ?, ?, ?)")
                ->execute([generate_uuid(), $project_id, $wf_json_str, $version_label]);

            // Keep only last 20
            $db->prepare("DELETE FROM workflow_versions WHERE project_id = ? AND id NOT IN (SELECT id FROM (SELECT id FROM workflow_versions WHERE project_id = ? ORDER BY created_at DESC LIMIT 20) AS t)")
                ->execute([$project_id, $project_id]);
        }

        return ['message' => 'Project updated successfully'];
    } catch (Exception $e) {
        http_response_code(500);
        return ['error' => $e->getMessage()];
    }
}

/**
 * DELETE /api/projects/{id}
 */
function handle_delete_project($project_id)
{
    $db = get_db_connection();
    $db->prepare("DELETE FROM projects WHERE id = ?")->execute([$project_id]);
    return ['message' => 'Project deleted'];
}

/**
 * POST /api/projects/{id}/duplicate
 */
function handle_duplicate_project($project_id)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$project) {
        http_response_code(404);
        return ['error' => 'Project not found'];
    }

    $new_id = generate_uuid();
    $new_name = ($project['name'] ?? 'Unnamed') . ' (Copy)';

    $db->prepare("INSERT INTO projects (id, name, description, google_sheet_id, service_account_json, cron_expression, price_list_url, locality_prompt, products_config, workflow_json, smtp_config, wesendit_config, pipedrive_config, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([
            $new_id,
            $new_name,
            $project['description'] ?? '',
            $project['google_sheet_id'] ?? '',
            $project['service_account_json'] ?? '',
            $project['cron_expression'] ?? '',
            $project['price_list_url'] ?? '',
            $project['locality_prompt'] ?? '',
            $project['products_config'] ?? '',
            $project['workflow_json'] ?? '',
            $project['smtp_config'] ?? '',
            $project['wesendit_config'] ?? '',
            $project['pipedrive_config'] ?? '',
            'active'
        ]);

    return ['id' => $new_id, 'name' => $new_name, 'message' => 'Project duplicated'];
}

// ============================================================
// Workflow Version History
// ============================================================

function handle_list_versions($project_id)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT id, label, created_at FROM workflow_versions WHERE project_id = ? ORDER BY created_at DESC");
    $stmt->execute([$project_id]);
    return ['versions' => $stmt->fetchAll(PDO::FETCH_ASSOC)];
}

function handle_create_snapshot($project_id, $data = [])
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT workflow_json FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch();
    if (!$project || !$project['workflow_json']) {
        http_response_code(404);
        return ['error' => 'No workflow to snapshot'];
    }

    $count_stmt = $db->prepare("SELECT COUNT(*) FROM workflow_versions WHERE project_id = ?");
    $count_stmt->execute([$project_id]);
    $count = $count_stmt->fetchColumn();
    $label = $data['label'] ?? ('Snapshot ' . ($count + 1));

    $version_id = generate_uuid();
    $db->prepare("INSERT INTO workflow_versions (id, project_id, workflow_json, label) VALUES (?, ?, ?, ?)")
        ->execute([$version_id, $project_id, $project['workflow_json'], $label]);

    return ['success' => true, 'id' => $version_id, 'label' => $label];
}

function handle_restore_version($project_id, $version_id)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT workflow_json FROM workflow_versions WHERE id = ? AND project_id = ?");
    $stmt->execute([$version_id, $project_id]);
    $version = $stmt->fetch();
    if (!$version) {
        http_response_code(404);
        return ['error' => 'Version not found'];
    }

    $db->prepare("UPDATE projects SET workflow_json = ? WHERE id = ?")
        ->execute([$version['workflow_json'], $project_id]);

    return ['success' => true, 'message' => 'Workflow restored'];
}

// ============================================================
// Workflow Execution
// ============================================================

function handle_run_workflow($project_id)
{
    require_once __DIR__ . '/engine.php';
    require_once __DIR__ . '/workflow_engine.php';

    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$project) {
        http_response_code(404);
        return ['error' => 'Project not found'];
    }

    $workflow_json = $project['workflow_json'] ?? '';
    if (!$workflow_json) {
        return ['success' => false, 'message' => 'No workflow defined'];
    }

    // Global API key
    $stmt2 = $db->prepare("SELECT `key`, `value` FROM settings");
    $stmt2->execute();
    $settings = [];
    foreach ($stmt2->fetchAll() as $row)
        $settings[$row['key']] = $row['value'];

    // Create workflow_status record for polling
    $run_id = generate_uuid();
    $db->prepare("INSERT INTO workflow_status (id, project_id, status, progress) VALUES (?, ?, 'running', ?)")
        ->execute([$run_id, $project_id, json_encode([])]);

    try {
        $workflow_data = json_decode($workflow_json, true);

        // Status callback — writes to DB for polling
        $status_callback = function ($node_id, $status, $message = '') use ($db, $run_id) {
            try {
                // Get current progress
                $stmt = $db->prepare("SELECT progress FROM workflow_status WHERE id = ?");
                $stmt->execute([$run_id]);
                $row = $stmt->fetch();
                $progress = $row ? json_decode($row['progress'], true) : [];
                $progress[] = ['node_id' => $node_id, 'status' => $status, 'message' => $message, 'ts' => date('c')];
                $db->prepare("UPDATE workflow_status SET progress = ?, updated_at = NOW() WHERE id = ?")
                    ->execute([json_encode($progress), $run_id]);
            } catch (Exception $e) {
                error_log("[WF Status] DB write failed: " . $e->getMessage());
            }
        };

        $engine = new WorkflowEngine(
            $workflow_data,
            ['project' => $project],
            $settings['google_api_key'] ?? null
        );
        $result = $engine->run($status_callback);

        // Update status to completed
        $db->prepare("UPDATE workflow_status SET status = 'completed', updated_at = NOW() WHERE id = ?")
            ->execute([$run_id]);

        // Log run
        $details_json = json_encode($result['log'] ?? [], JSON_UNESCAPED_UNICODE);
        $output_json = json_encode($result['final_context'] ?? [], JSON_UNESCAPED_UNICODE);
        $db->prepare("INSERT INTO runs (id, project_id, status, log_details, output_json) VALUES (?, ?, ?, ?, ?)")
            ->execute([$run_id, $project_id, $result['status'] ?? 'completed', $details_json, $output_json]);

        // Sanitize for JSON output
        return json_decode(json_encode($result, JSON_INVALID_UTF8_SUBSTITUTE), true) ?: $result;

    } catch (Exception $e) {
        $db->prepare("UPDATE workflow_status SET status = 'error', progress = ?, updated_at = NOW() WHERE id = ?")
            ->execute([json_encode(['error' => $e->getMessage()]), $run_id]);

        return [
            'status' => 'failed',
            'success' => false,
            'message' => $e->getMessage(),
            'traceback' => $e->getTraceAsString(),
        ];
    }
}

/**
 * GET /api/workflow-status/{run_id}
 * Polling endpoint replacing WebSocket
 */
function handle_workflow_status($run_id)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM workflow_status WHERE id = ?");
    $stmt->execute([$run_id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        http_response_code(404);
        return ['error' => 'Run not found'];
    }
    $row['progress'] = json_decode($row['progress'] ?? '[]', true);
    return $row;
}

// ============================================================
// Media Routes
// ============================================================

function handle_list_media($project_id)
{
    require_once __DIR__ . '/media_engine.php';
    return get_media_files($project_id);
}

function handle_upload_media($project_id)
{
    require_once __DIR__ . '/media_engine.php';
    if (empty($_FILES['file'])) {
        http_response_code(400);
        return ['success' => false, 'message' => 'No file uploaded'];
    }
    $file = $_FILES['file'];
    return save_uploaded_file($project_id, $file['tmp_name'], $file['name']);
}

function handle_delete_media($project_id, $filename)
{
    require_once __DIR__ . '/media_engine.php';
    return delete_media_file($project_id, $filename);
}

function handle_get_media_file($project_id, $filename)
{
    $dir = UPLOADS_DIR . '/' . $project_id;
    $file_path = $dir . '/' . $filename;
    if (!file_exists($file_path)) {
        http_response_code(404);
        return ['error' => 'File not found'];
    }
    // Serve file
    $mime = mime_content_type($file_path);
    header('Content-Type: ' . $mime);
    header('Content-Disposition: inline; filename="' . $filename . '"');
    readfile($file_path);
    exit;
}

// ============================================================
// Price List Routes
// ============================================================

function handle_upload_price_list($project_id)
{
    require_once __DIR__ . '/engine.php';

    if (empty($_FILES['file'])) {
        http_response_code(400);
        return ['success' => false, 'message' => 'No file uploaded'];
    }
    $file = $_FILES['file'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
        return ['success' => false, 'message' => 'Only Excel (.xlsx, .xls) or CSV files are allowed.'];
    }

    $upload_dir = UPLOADS_DIR . '/' . $project_id;
    if (!is_dir($upload_dir))
        mkdir($upload_dir, 0755, true);
    $file_path = $upload_dir . '/' . $file['name'];
    move_uploaded_file($file['tmp_name'], $file_path);

    return process_price_list_file($project_id, $file_path);
}

function handle_sync_prices($project_id, $data)
{
    require_once __DIR__ . '/engine.php';
    $sheet_id = $data['sheet_id'] ?? '';
    $sheet_range = $data['sheet_range'] ?? 'Foglio1!A:G';
    $result = sync_price_list($project_id, $sheet_id, $sheet_range);
    if (empty($result['success'])) {
        http_response_code(400);
    }
    return $result;
}

function handle_get_headers($project_id)
{
    require_once __DIR__ . '/engine.php';
    $result = get_sheet_headers($project_id);
    if (empty($result['success'])) {
        http_response_code(400);
    }
    return $result;
}

function handle_test_connection($project_id)
{
    require_once __DIR__ . '/engine.php';
    return test_project_connection($project_id);
}

function handle_upload_product_price_list($project_id, $product_index)
{
    if (empty($_FILES['file'])) {
        http_response_code(400);
        return ['success' => false, 'message' => 'No file uploaded'];
    }
    $file = $_FILES['file'];
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['xlsx', 'xls', 'csv'])) {
        http_response_code(400);
        return ['success' => false, 'message' => 'Only Excel or CSV allowed'];
    }

    $upload_dir = UPLOADS_DIR . '/' . $project_id . '/products';
    if (!is_dir($upload_dir))
        mkdir($upload_dir, 0755, true);

    $filename = "prod_{$product_index}_{$file['name']}";
    $file_path = $upload_dir . '/' . $filename;
    move_uploaded_file($file['tmp_name'], $file_path);

    return ['success' => true, 'filename' => $filename, 'path' => $file_path];
}

// ============================================================
// File Optimization & Read
// ============================================================

function handle_optimize_file($project_id, $data)
{
    require_once __DIR__ . '/engine.php';

    $file_name = $data['file_name'] ?? '';
    $file_type = $data['type'] ?? '';
    if (!$file_name || !$file_type) {
        http_response_code(400);
        return ['error' => 'Missing file_name or type'];
    }

    if ($file_type === 'price_list') {
        return optimize_price_list_with_ai($project_id, $file_name);
    } elseif ($file_type === 'knowledge_base') {
        return optimize_knowledge_base_with_ai($project_id, $file_name);
    }
    return ['success' => false, 'message' => 'Unknown type'];
}

function handle_read_file($project_id, $file)
{
    if (!$file || strpos($file, '..') !== false || strpos($file, '/') !== false) {
        http_response_code(400);
        return ['error' => 'Invalid filename'];
    }

    $file_path = UPLOADS_DIR . '/' . $project_id . '/' . $file;
    if (!file_exists($file_path)) {
        http_response_code(404);
        return ['error' => "File not found: {$file}"];
    }

    return file_get_contents($file_path);
}

// ============================================================
// Knowledge File Parsing
// ============================================================

function handle_parse_knowledge()
{
    require_once __DIR__ . '/knowledge_parser.php';

    if (empty($_FILES['file'])) {
        http_response_code(400);
        return ['success' => false, 'error' => 'No file uploaded'];
    }
    $file = $_FILES['file'];
    $filename = strtolower($file['name']);
    $tmp_path = $file['tmp_name'];

    try {
        $result = parse_knowledge_file($tmp_path, $filename);
        if (!($result['success'] ?? false)) {
            http_response_code(400);
            return $result;
        }
        return $result;
    } catch (Exception $e) {
        http_response_code(500);
        return ['success' => false, 'error' => $e->getMessage()];
    }
}

// ============================================================
// Auth Status
// ============================================================

function handle_auth_status($project_id)
{
    require_once __DIR__ . '/engine.php';

    $db = get_db_connection();
    $stmt = $db->prepare("SELECT oauth_credentials FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch();

    if (!$project || !$project['oauth_credentials']) {
        return ['connected' => false];
    }

    try {
        $creds = json_decode($project['oauth_credentials'], true);
        if (!$creds)
            return ['connected' => false];

        $result = get_oauth_access_token($creds, $project_id);
        if ($result && !empty($result['token'])) {
            return ['connected' => true];
        }
        return ['connected' => false, 'error' => 'Token expired. Please reconnect.'];
    } catch (Exception $e) {
        // Clear corrupted token
        $db->prepare("UPDATE projects SET oauth_credentials = NULL WHERE id = ?")->execute([$project_id]);
        return ['connected' => false, 'error' => "Token invalid: {$e->getMessage()}. Please reconnect."];
    }
}

function handle_disconnect_google($project_id)
{
    $db = get_db_connection();
    $db->prepare("UPDATE projects SET oauth_credentials = NULL WHERE id = ?")
        ->execute([$project_id]);
    return ['success' => true, 'message' => 'Google Account disconnected.'];
}

function handle_picker_token($project_id)
{
    require_once __DIR__ . '/engine.php';

    $db = get_db_connection();
    $stmt = $db->prepare("SELECT `value` FROM settings WHERE `key` = 'google_client_id'");
    $stmt->execute();
    $row = $stmt->fetch();
    $client_id = $row ? $row['value'] : null;

    $stmt2 = $db->prepare("SELECT oauth_credentials FROM projects WHERE id = ?");
    $stmt2->execute([$project_id]);
    $project = $stmt2->fetch();

    if (!$project || !$project['oauth_credentials']) {
        return ['token' => null];
    }

    try {
        $creds = json_decode($project['oauth_credentials'], true);
        $result = get_oauth_access_token($creds, $project_id);
        if ($result && !empty($result['token'])) {
            return ['token' => $result['token'], 'app_id' => $client_id];
        }
        return ['token' => null, 'error' => 'Token expired. Please reconnect Google Account.'];
    } catch (Exception $e) {
        return ['token' => null, 'error' => $e->getMessage()];
    }
}
