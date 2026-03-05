<?php
/**
 * index.php - Centralized API Router
 * PHP port of main.py FastAPI routes
 *
 * All API requests are routed here via .htaccess RewriteRule.
 * Routes are dispatched based on REQUEST_URI and REQUEST_METHOD.
 */

// Error reporting for development (disable in production)
error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';

// ============================================================
// CORS Headers
// ============================================================
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ============================================================
// Init Database on first run
// ============================================================
try {
    init_db();
} catch (Exception $e) {
    // Database may already be initialized
}

// ============================================================
// Parse Request
// ============================================================
$method = $_SERVER['REQUEST_METHOD'];
$request_uri = $_SERVER['REQUEST_URI'] ?? '/';

// Remove query string and /api prefix
$path = parse_url($request_uri, PHP_URL_PATH);
$path = preg_replace('#^/api#', '', $path); // Remove /api prefix
$path = rtrim($path, '/');
if ($path === '')
    $path = '/';

// Read JSON body for POST/PUT
$json_input = null;
if (in_array($method, ['POST', 'PUT']) && empty($_FILES)) {
    $raw = file_get_contents('php://input');
    if ($raw)
        $json_input = json_decode($raw, true);
}

// ============================================================
// Router
// ============================================================

$response = null;

try {
    // --- System ---
    if ($path === '/system/info' && $method === 'GET') {
        require_once __DIR__ . '/settings.php';
        $response = handle_system_info();
    }

    // --- Settings ---
    elseif ($path === '/settings' && $method === 'GET') {
        require_once __DIR__ . '/settings.php';
        $response = handle_get_settings();
    } elseif ($path === '/settings' && $method === 'POST') {
        require_once __DIR__ . '/settings.php';
        $response = handle_update_settings($json_input ?? []);
    }

    // --- Test Gemini ---
    elseif ($path === '/test_gemini' && $method === 'POST') {
        require_once __DIR__ . '/settings.php';
        $response = handle_test_gemini($json_input ?? []);
    }

    // --- Integration Tests ---
    elseif ($path === '/test/email' && $method === 'POST') {
        require_once __DIR__ . '/settings.php';
        $response = handle_test_email($json_input ?? []);
    } elseif ($path === '/test/whatsapp' && $method === 'POST') {
        require_once __DIR__ . '/settings.php';
        $response = handle_test_whatsapp($json_input ?? []);
    } elseif ($path === '/test/pipedrive' && $method === 'POST') {
        require_once __DIR__ . '/settings.php';
        $response = handle_test_pipedrive($json_input ?? []);
    }

    // --- Google OAuth ---
    elseif ($path === '/auth/google/url' && $method === 'GET') {
        require_once __DIR__ . '/google_auth.php';
        $project_id = $_GET['project_id'] ?? '';
        $response = handle_get_auth_url($project_id);
    } elseif ($path === '/auth/google/callback' && $method === 'GET') {
        require_once __DIR__ . '/google_auth.php';
        handle_auth_callback(); // Exits internally (HTML response)
    }

    // --- Knowledge File Parse ---
    elseif ($path === '/knowledge/parse' && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_parse_knowledge();
    }

    // --- Workflow Status Polling (replaces WebSocket) ---
    elseif (preg_match('#^/workflow-status/([^/]+)$#', $path, $m) && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        $response = handle_workflow_status($m[1]);
    }

    // --- Projects CRUD ---
    elseif ($path === '/projects' && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        $response = handle_list_projects();
    } elseif ($path === '/projects' && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_create_project($json_input ?? []);
    } elseif (preg_match('#^/projects/([^/]+)$#', $path, $m)) {
        require_once __DIR__ . '/projects.php';
        $project_id = $m[1];
        if ($method === 'GET') {
            $response = handle_get_project($project_id);
        } elseif ($method === 'PUT') {
            $response = handle_update_project($project_id, $json_input ?? []);
        } elseif ($method === 'DELETE') {
            $response = handle_delete_project($project_id);
        }
    }

    // --- Project Sub-routes (order matters: more specific first) ---
    elseif (preg_match('#^/projects/([^/]+)/versions/([^/]+)/restore$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_restore_version($m[1], $m[2]);
    } elseif (preg_match('#^/projects/([^/]+)/versions$#', $path, $m)) {
        require_once __DIR__ . '/projects.php';
        if ($method === 'GET')
            $response = handle_list_versions($m[1]);
        elseif ($method === 'POST')
            $response = handle_create_snapshot($m[1], $json_input ?? []);
    } elseif (preg_match('#^/projects/([^/]+)/duplicate$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_duplicate_project($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/run$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_run_workflow($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/test$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_test_connection($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/sync-prices$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_sync_prices($m[1], $json_input ?? []);
    } elseif (preg_match('#^/projects/([^/]+)/headers$#', $path, $m) && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        $response = handle_get_headers($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/upload-price-list$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_upload_price_list($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/product-price-list$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $product_index = intval($_GET['product_index'] ?? $_POST['product_index'] ?? 0);
        $response = handle_upload_product_price_list($m[1], $product_index);
    } elseif (preg_match('#^/projects/([^/]+)/optimize_file$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_optimize_file($m[1], $json_input ?? []);
    } elseif (preg_match('#^/projects/([^/]+)/read_file$#', $path, $m) && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        $file = $_GET['file'] ?? '';
        $raw = handle_read_file($m[1], $file);
        if (is_string($raw)) {
            header('Content-Type: text/plain; charset=UTF-8');
            echo $raw;
            exit;
        }
        $response = $raw;
    }

    // --- Auth Status ---
    elseif (preg_match('#^/projects/([^/]+)/auth_status$#', $path, $m) && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        $response = handle_auth_status($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/disconnect_google$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_disconnect_google($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/picker_token$#', $path, $m) && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        $response = handle_picker_token($m[1]);
    }

    // --- Media ---
    elseif (preg_match('#^/projects/([^/]+)/media/upload$#', $path, $m) && $method === 'POST') {
        require_once __DIR__ . '/projects.php';
        $response = handle_upload_media($m[1]);
    } elseif (preg_match('#^/projects/([^/]+)/media/file/([^/]+)$#', $path, $m) && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        handle_get_media_file($m[1], $m[2]); // Exits internally
    } elseif (preg_match('#^/projects/([^/]+)/media/([^/]+)$#', $path, $m) && $method === 'DELETE') {
        require_once __DIR__ . '/projects.php';
        $response = handle_delete_media($m[1], $m[2]);
    } elseif (preg_match('#^/projects/([^/]+)/media$#', $path, $m) && $method === 'GET') {
        require_once __DIR__ . '/projects.php';
        $response = handle_list_media($m[1]);
    }

    // --- 404 ---
    else {
        http_response_code(404);
        $response = ['error' => 'Not found', 'path' => $path, 'method' => $method];
    }
} catch (Exception $e) {
    http_response_code(500);
    $response = ['error' => $e->getMessage()];
    error_log("[API] Error: " . $e->getMessage());
}

// ============================================================
// Output JSON Response
// ============================================================
if ($response !== null) {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
}
