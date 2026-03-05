<?php
/**
 * engine.php - Core Business Logic
 * PHP port of engine.py
 * 
 * Google Sheets integration via REST API (no SDK),
 * pricing calculations, AI email generation, price list sync.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/llm_utils.php';

// ============================================================
// Google Sheets REST API Functions (replaces google-auth SDK)
// ============================================================

/**
 * Get a valid OAuth access token, refreshing if expired.
 * Returns ['token' => ..., 'updated_creds' => ...] or null.
 */
function get_oauth_access_token($oauth_creds, $project_id = null)
{
    if (is_string($oauth_creds)) {
        $creds = json_decode($oauth_creds, true);
    } else {
        $creds = $oauth_creds;
    }
    if (!$creds)
        return null;

    $token = $creds['token'] ?? null;
    $refresh_token = $creds['refresh_token'] ?? null;
    $expiry = $creds['expiry'] ?? null;
    $client_id = $creds['client_id'] ?? '';
    $client_secret = $creds['client_secret'] ?? '';
    $token_uri = $creds['token_uri'] ?? 'https://oauth2.googleapis.com/token';

    // Check if token needs refresh
    $needs_refresh = false;
    if (!$token) {
        $needs_refresh = true;
    } elseif ($expiry) {
        $expiry_time = strtotime($expiry);
        if ($expiry_time && ($expiry_time - time()) < 300) {
            $needs_refresh = true;
        }
    }

    if ($needs_refresh && $refresh_token) {
        // Refresh the token
        $post_data = [
            'grant_type' => 'refresh_token',
            'refresh_token' => $refresh_token,
            'client_id' => $client_id,
            'client_secret' => $client_secret,
        ];

        $ch = curl_init($token_uri);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post_data));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        $resp = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($resp, true);
        if (!empty($data['access_token'])) {
            $token = $data['access_token'];
            $new_expiry = date('c', time() + ($data['expires_in'] ?? 3600));

            $creds['token'] = $token;
            $creds['expiry'] = $new_expiry;

            // Save refreshed token to DB
            if ($project_id) {
                try {
                    $db = get_db_connection();
                    $stmt = $db->prepare('UPDATE projects SET oauth_credentials = ? WHERE id = ?');
                    $stmt->execute([json_encode($creds), $project_id]);
                } catch (Exception $e) {
                    error_log("[OAuth] Token refreshed but failed to save: " . $e->getMessage());
                }
            }
        } else {
            error_log("[OAuth] Refresh failed: " . $resp);
            return null;
        }
    }

    return ['token' => $token, 'updated_creds' => $creds];
}

/**
 * Get a Service Account access token using JWT assertion.
 */
function get_service_account_token($sa_json_str)
{
    $sa = is_string($sa_json_str) ? json_decode($sa_json_str, true) : $sa_json_str;
    if (!$sa || empty($sa['client_email']) || empty($sa['private_key']))
        return null;

    $now = time();
    $header = json_encode(['alg' => 'RS256', 'typ' => 'JWT']);
    $claim = json_encode([
        'iss' => $sa['client_email'],
        'scope' => 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive',
        'aud' => $sa['token_uri'] ?? 'https://oauth2.googleapis.com/token',
        'iat' => $now,
        'exp' => $now + 3600,
    ]);

    $b64_header = rtrim(strtr(base64_encode($header), '+/', '-_'), '=');
    $b64_claim = rtrim(strtr(base64_encode($claim), '+/', '-_'), '=');
    $signing_input = $b64_header . '.' . $b64_claim;

    $private_key = openssl_pkey_get_private($sa['private_key']);
    if (!$private_key) {
        error_log("[SA] Invalid private key");
        return null;
    }
    openssl_sign($signing_input, $signature, $private_key, OPENSSL_ALGO_SHA256);
    $b64_signature = rtrim(strtr(base64_encode($signature), '+/', '-_'), '=');
    $jwt = $signing_input . '.' . $b64_signature;

    // Exchange JWT for access token
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query([
        'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        'assertion' => $jwt,
    ]));
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $resp = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($resp, true);
    return $data['access_token'] ?? null;
}

/**
 * Get a valid access token from project config (OAuth or Service Account).
 * Returns ['token' => string, 'type' => 'oauth'|'service_account'|'api_key'] or null.
 */
function get_sheets_auth($project, $project_id = null)
{
    // 1. Try OAuth credentials
    $oauth_creds = $project['oauth_credentials'] ?? null;
    if ($oauth_creds && strlen($oauth_creds) > 10) {
        $result = get_oauth_access_token($oauth_creds, $project_id ?? ($project['id'] ?? null));
        if ($result && !empty($result['token'])) {
            return ['token' => $result['token'], 'type' => 'oauth'];
        }
    }

    // 2. Try Service Account
    $sa_json = $project['service_account_json'] ?? null;
    if (!$sa_json || strlen($sa_json) < 10) {
        // Fallback to global settings
        $db = get_db_connection();
        $stmt = $db->prepare("SELECT value FROM settings WHERE `key` = 'service_account_json'");
        $stmt->execute();
        $row = $stmt->fetch();
        if ($row)
            $sa_json = $row['value'];
    }
    if ($sa_json && strlen($sa_json) > 10) {
        $token = get_service_account_token($sa_json);
        if ($token) {
            return ['token' => $token, 'type' => 'service_account'];
        }
    }

    // 3. Try API Key (for read-only)
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT value FROM settings WHERE `key` = 'google_api_key'");
    $stmt->execute();
    $row = $stmt->fetch();
    if ($row && !empty($row['value'])) {
        return ['token' => $row['value'], 'type' => 'api_key'];
    }

    return null;
}

// ============================================================
// Google Sheets REST API Calls
// ============================================================

/**
 * Read values from a Google Sheet range.
 */
function sheets_get_values($sheet_id, $range, $auth)
{
    $safe_range = rawurlencode($range);
    $url = "https://sheets.googleapis.com/v4/spreadsheets/{$sheet_id}/values/{$safe_range}";

    if ($auth['type'] === 'api_key') {
        $url .= '?key=' . $auth['token'] . '&majorDimension=ROWS';
        $headers = [];
    } else {
        $url .= '?majorDimension=ROWS';
        $headers = ['Authorization: Bearer ' . $auth['token']];
    }

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    if ($headers) {
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    }
    $resp = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code !== 200) {
        error_log("[Sheets] GET error {$http_code}: {$resp}");
        return null;
    }
    return json_decode($resp, true);
}

/**
 * Update a single cell in a Google Sheet.
 */
function sheets_update_cell($sheet_id, $cell_range, $value, $auth)
{
    $safe_range = rawurlencode($cell_range);
    $url = "https://sheets.googleapis.com/v4/spreadsheets/{$sheet_id}/values/{$safe_range}?valueInputOption=USER_ENTERED";

    if ($auth['type'] === 'api_key') {
        // API key is read-only
        error_log("[Sheets] Cannot write with API key");
        return false;
    }

    $body = json_encode(['values' => [[(string) $value]]]);
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
    curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Authorization: Bearer ' . $auth['token'],
        'Content-Type: application/json',
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 15);
    $resp = curl_exec($ch);
    $http_code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($http_code !== 200) {
        error_log("[Sheets] UPDATE error {$http_code}: {$resp}");
        return false;
    }
    return true;
}

// ============================================================
// Column Index ↔ Letter Utilities
// ============================================================

function col_to_letter($idx)
{
    $result = '';
    while ($idx >= 0) {
        $result = chr(65 + $idx % 26) . $result;
        $idx = intdiv($idx, 26) - 1;
    }
    return $result;
}

function find_col_index($col_name, $headers)
{
    // Exact match
    $idx = array_search($col_name, $headers);
    if ($idx !== false)
        return $idx;
    // Case-insensitive match
    $lower = array_map('strtolower', $headers);
    $idx = array_search(strtolower($col_name), $lower);
    if ($idx !== false)
        return $idx;
    // Not found — append position
    return count($headers);
}

// ============================================================
// Fetch Pending Rows from Google Sheet
// ============================================================

function fetch_pending_requests($project, $auth, $filter_config = null)
{
    $sheet_id = $project['google_sheet_id'] ?? '';
    $range = $project['google_sheet_range'] ?? 'Foglio1!A1:AZ500';

    $result = sheets_get_values($sheet_id, $range, $auth);
    if (!$result)
        return [];

    $rows = $result['values'] ?? [];
    if (empty($rows))
        return [];

    // Detect headerless sheet
    $first_row = array_map('trim', array_map('strval', $rows[0]));
    $is_headerless = false;
    foreach ($first_row as $h) {
        if (strlen($h) > 50 || preg_match('/^(l:|ag:|f:|as:|c:|p:)/', $h)) {
            $is_headerless = true;
            break;
        }
    }

    $max_cols = max(array_map('count', $rows));

    if ($is_headerless) {
        $headers = [];
        for ($i = 0; $i < $max_cols; $i++) {
            $letter = $i < 26 ? chr(65 + $i) : chr(64 + intdiv($i, 26)) . chr(65 + $i % 26);
            $headers[] = 'col_' . $letter;
        }
        $data_rows = $rows;
        $start_row = 1;
    } else {
        $headers = array_map('trim', $rows[0]);
        $data_rows = array_slice($rows, 1);
        $start_row = 2;
    }

    // Filter config
    $target_col = null;
    $target_val = '';
    if ($filter_config) {
        $target_col = $filter_config['column'] ?? null;
        $target_val = $filter_config['value'] ?? '';
    }

    // Find column index
    $status_idx = null;
    if ($target_col) {
        $status_idx = array_search($target_col, $headers);
        if ($status_idx === false) {
            $lower_headers = array_map('strtolower', $headers);
            $status_idx = array_search(strtolower($target_col), $lower_headers);
            if ($status_idx === false)
                $status_idx = null;
        }
    }

    $data = [];
    foreach ($data_rows as $i => $row) {
        $row_num = $start_row + $i;
        // Pad
        while (count($row) < count($headers)) {
            $row[] = '';
        }

        // Apply filter
        if ($status_idx !== null) {
            $cell_val = trim($row[$status_idx] ?? '');
            if ($target_val === '') {
                if ($cell_val !== '')
                    continue;
            } else {
                if ($cell_val !== $target_val)
                    continue;
            }
        }

        $item = array_combine($headers, array_slice($row, 0, count($headers)));
        $item['_row_number'] = $row_num;
        $data[] = $item;
    }

    return $data;
}

// ============================================================
// Update Sheet Cell
// ============================================================

function update_sheet_cell($auth, $sheet_id, $sheet_range_base, $row_number, $col_name, $value, $headers = null)
{
    $sheet_name = 'Foglio1';
    if ($sheet_range_base && strpos($sheet_range_base, '!') !== false) {
        $sheet_name = explode('!', $sheet_range_base)[0];
    }

    $col_idx = $headers ? find_col_index($col_name, $headers) : 0;
    $col_letter = col_to_letter($col_idx);
    $cell_range = "{$sheet_name}!{$col_letter}{$row_number}";

    return sheets_update_cell($sheet_id, $cell_range, $value, $auth);
}

// ============================================================
// Get Next Auto-Counter Value
// ============================================================

function get_next_counter($auth, $sheet_id, $sheet_range_base, $col_name, $headers = null)
{
    $sheet_name = 'Foglio1';
    if ($sheet_range_base && strpos($sheet_range_base, '!') !== false) {
        $sheet_name = explode('!', $sheet_range_base)[0];
    }

    $col_idx = $headers ? find_col_index($col_name, $headers) : 0;
    $col_letter = col_to_letter($col_idx);
    $col_range = "{$sheet_name}!{$col_letter}:{$col_letter}";

    $result = sheets_get_values($sheet_id, $col_range, $auth);
    $values = $result['values'] ?? [];

    $max_val = 0;
    foreach ($values as $row) {
        if (!empty($row[0])) {
            $num = intval(trim($row[0]));
            if ($num > $max_val)
                $max_val = $num;
        }
    }

    return $max_val + 1;
}

// ============================================================
// Get Sheet Headers
// ============================================================

function get_sheet_headers($project_id)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch();

    if (!$project)
        return ['success' => false, 'message' => 'Project not found'];

    $auth = get_sheets_auth($project, $project_id);
    if (!$auth)
        return ['success' => false, 'message' => 'No valid credentials'];

    $sheet_id = $project['google_sheet_id'] ?? '';
    if (!$sheet_id)
        return ['success' => false, 'message' => 'No Sheet ID configured'];

    $result = sheets_get_values($sheet_id, '1:1', $auth);
    if (!$result)
        return ['success' => false, 'message' => 'Failed to read sheet'];

    $rows = $result['values'] ?? [];
    return ['success' => true, 'headers' => $rows[0] ?? []];
}

// ============================================================
// AI Locality Normalizer
// ============================================================

function normalize_locality($row, $project)
{
    $system_prompt = $project['locality_normalization_prompt'] ?? '';
    if (!$system_prompt) {
        $system_prompt = "Sei un assistente che normalizza località italiane.\nRestituisci SOLO JSON valido con questi campi:\n{\n  \"località\": \"\",\n  \"provincia\": \"\",\n  \"regione\": \"\",\n  \"fascia_geografica\": \"\",\n  \"mq\": 0\n}\n\nMappa le regioni alle fasce geografiche:\n- Nord-est Italia: Veneto, Friuli-Venezia Giulia, Trentino-Alto Adige, Emilia-Romagna\n- Nord-ovest Italia: Piemonte, Valle d'Aosta, Liguria, Lombardia\n- Centro Italia: Toscana, Umbria, Marche, Lazio, Abruzzo\n- Sud Italia: Molise, Campania, Puglia, Basilicata, Calabria\n- Isole: Sicilia, Sardegna";
    }

    $locality = $row['località'] ?? $row['localita'] ?? $row['location'] ?? '';
    $mq = $row['mq'] ?? $row['metri_quadri'] ?? $row['square_meters'] ?? '';

    $user_prompt = "Dati da normalizzare:\nLocalità: {$locality}\nMetri quadri: {$mq}\n\nRestituisci SOLO il JSON richiesto.";

    return generate_json_llm($system_prompt, $user_prompt);
}

// ============================================================
// Pricing Calculator
// ============================================================

function calculate_pricing($row, $normalized_data, $project, $product_knowledge = null)
{
    $macro_zona = $normalized_data['macro_zona']
        ?? $normalized_data['fascia_geografica']
        ?? $normalized_data['regione'] ?? '';

    // Determine MQ
    $mq = null;
    foreach (['mq_richiesti_numero', 'mq', 'metri_quadri', 'square_meters', 'metratura'] as $key) {
        $val = $normalized_data[$key] ?? null;
        if ($val !== null && $val !== '') {
            if (is_numeric($val) && floatval($val) > 0) {
                $mq = floatval($val);
                break;
            }
            if (is_string($val)) {
                $parsed = floatval(str_replace(',', '.', trim($val)));
                if ($parsed > 0) {
                    $mq = $parsed;
                    break;
                }
            }
        }
    }

    // Fallback to raw row
    if (!$mq || $mq <= 0) {
        foreach (['mq', 'metri_quadri', 'metratura', 'square_meters'] as $key) {
            $val = $row[$key] ?? null;
            if ($val !== null && $val !== '') {
                $parsed = floatval(str_replace(',', '.', trim(strval($val))));
                if ($parsed > 0) {
                    $mq = $parsed;
                    break;
                }
            }
        }
    }
    if (!$mq || $mq <= 0)
        $mq = 35;
    if ($mq < 10)
        $mq = 10;

    // Price list
    $price_list_cache = $project['price_list_cache'] ?? null;
    $prezzo_unitario = 20.0;
    $fascia = 'Default';

    // Try product-specific price file override
    if ($product_knowledge && !empty($product_knowledge['price_list_file'])) {
        $file_name = $product_knowledge['price_list_file'];
        $file_path = UPLOADS_DIR . '/' . $project['id'] . '/' . $file_name;
        if (file_exists($file_path)) {
            if (pathinfo($file_path, PATHINFO_EXTENSION) === 'json') {
                $price_list_cache = file_get_contents($file_path);
            } elseif (pathinfo($file_path, PATHINFO_EXTENSION) === 'csv') {
                $rows_csv = [];
                if (($fh = fopen($file_path, 'r')) !== false) {
                    $csv_headers = fgetcsv($fh);
                    $csv_headers = array_map(function ($h) {
                        return strtolower(trim($h)); }, $csv_headers);
                    while (($csv_row = fgetcsv($fh)) !== false) {
                        if (count($csv_row) >= count($csv_headers)) {
                            $rows_csv[] = array_combine($csv_headers, $csv_row);
                        }
                    }
                    fclose($fh);
                }
                $price_list_cache = json_encode($rows_csv);
            }
        }
    }

    if ($price_list_cache) {
        $cache = json_decode($price_list_cache, true);
        if (is_array($cache)) {
            foreach ($cache as $item) {
                $sheet_region = trim($item['regione'] ?? '');
                $sheet_fascia = trim($item['fascia'] ?? '');

                if (strtolower($sheet_region) !== strtolower($macro_zona))
                    continue;

                // Parse range "10-20"
                $parts = explode('-', $sheet_fascia);
                if (count($parts) === 2) {
                    $min_v = floatval(str_replace(',', '.', trim($parts[0])));
                    $max_v = floatval(str_replace(',', '.', trim($parts[1])));
                    if ($mq >= $min_v && $mq <= $max_v) {
                        $price_str = $item['prezzo_finale'] ?? '20.0';
                        $prezzo_unitario = floatval(str_replace(['€', ','], ['', '.'], trim(strval($price_str))));
                        $fascia = $sheet_fascia;
                        break;
                    }
                }
            }
        }
    }

    // Calculate totals
    $totale_materiale = $mq * $prezzo_unitario;
    $piastrelle = (int) ceil($mq / 0.25);
    $peso_totale = $piastrelle * 6.7;
    $sconto_num = -0.31;
    $sconto_percentuale = abs($sconto_num) <= 1 ? abs($sconto_num * 100) : abs($sconto_num);

    return [
        'mq' => $mq,
        'fascia' => $fascia,
        'macro_zona' => $macro_zona,
        'prezzo_unitario' => $prezzo_unitario,
        'totale_materiale' => $totale_materiale,
        'piastrelle' => $piastrelle,
        'peso_totale' => $peso_totale,
        'sconto_percentuale' => sprintf("%.0f%%", $sconto_percentuale),
    ];
}

// ============================================================
// AI Content Generation (Email + WhatsApp)
// ============================================================

function generate_content($row, $pricing, $product_knowledge, $project)
{
    $product_name = 'Agrilock';
    $knowledge_text = '';

    if ($product_knowledge && !empty($product_knowledge['knowledge_base_file'])) {
        $file_path = UPLOADS_DIR . '/' . $project['id'] . '/' . $product_knowledge['knowledge_base_file'];
        if (file_exists($file_path) && !str_ends_with(strtolower($file_path), '.pdf')) {
            $knowledge_text = file_get_contents($file_path);
        }
    }

    if (!$knowledge_text) {
        $descriptions = $product_knowledge['descriptions'] ?? [];
        $knowledge_text = implode("\n", $descriptions);
    }

    // Email generation
    $nome = $row['nome'] ?? 'Cliente';
    $date = date('d/m/Y');
    $localita = $row['località_di_consegna?'] ?? '';
    $desc = $row['descrivi_il_tuo_progetto'] ?? '';
    $utilizzo = $row['utilizzo'] ?? '';

    $email_system = "Sei un consulente tecnico-commerciale di {$product_name}. Il tuo compito è creare un testo motivazionale professionale e convincente, personalizzato in base alla richiesta del cliente.\nUsa queste informazioni sul prodotto:\n{$knowledge_text}\n\nRestituisci la data nel formato italiano gg/mm/aaaa.";

    $email_user = "Genera un testo motivazionale di almeno 800 caratteri in italiano, formattato in HTML.\nIl testo deve essere diviso in due parti e separate da <!--DIVIDER-->:\n\nGentile {$nome}, come da sua richiesta effettuata giorno {$date}, con consegna a {$localita} le inviamo la nostra proposta per il prodotto {$product_name}.\n\nDescrizione progetto: {$desc}\nUtilizzo: {$utilizzo}\n\nDividi le due parti con <!--DIVIDER--> e nient'altro.";

    $email_html = call_llm($email_system, $email_user);

    // WhatsApp generation
    $totale_ivato = number_format($pricing['totale_materiale'] * 1.22, 2, '.', '');
    $wa_system = "Sei l'assistente virtuale di Agrilock.\nIl tuo compito è scrivere un messaggio WhatsApp basato sui dati JSON forniti.\nREGOLE CRUCIALI:\n1. NON INVENTARE DATI. Usa esattamente i numeri forniti.\n2. Usa la formattazione WhatsApp: *grassetto*, emoji.\n3. Restituisci ESCLUSIVAMENTE un JSON valido chiave: \"messaggio_whatsapp\".";

    $wa_user = "Genera un messaggio WhatsApp usando questi dati:\n- Nome Cliente: {$nome}\n- Utilizzo Progetto: {$utilizzo}\n- Mq Totali: {$pricing['mq']} mq\n- Totale IVATO: € {$totale_ivato}\n\nISTRUZIONI:\n1. Saluta il cliente per nome.\n2. Scrivi: \"Ti abbiamo appena inviato una mail 📧 con il preventivo completo...\"\n3. Riepilogo schematico.\n4. Prezzo Totale Ivato in *grassetto*.\n5. Chiudi con call to action.";

    $wa_resp = generate_json_llm($wa_system, $wa_user);

    return [
        'email_html' => $email_html,
        'whatsapp_text' => $wa_resp['messaggio_whatsapp'] ?? '',
    ];
}

// ============================================================
// Product Knowledge
// ============================================================

function get_product_knowledge($project, $product_name_query = null)
{
    $config = $project['products_config'] ?? '';
    if (!$config)
        return null;

    $products = json_decode($config, true);
    if (!$products || !is_array($products))
        return null;
    return $products[0] ?? null;
}

// ============================================================
// Price List Sync
// ============================================================

function sync_price_list($project_id, $sheet_id, $sheet_range = 'Foglio1!A:G')
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch();

    if (!$project)
        return ['success' => false, 'message' => 'Project not found'];

    if (!$sheet_id || strlen($sheet_id) < 5) {
        // Try uploaded file fallback
        $upload_dir = UPLOADS_DIR . '/' . $project_id;
        if (is_dir($upload_dir)) {
            $files = glob($upload_dir . '/*.{xlsx,xls,csv}', GLOB_BRACE);
            if (!empty($files)) {
                usort($files, function ($a, $b) {
                    return filemtime($b) - filemtime($a); });
                return process_price_list_file($project_id, $files[0]);
            }
        }
        return ['success' => false, 'message' => 'No Google Sheet ID configured and no uploaded file found.'];
    }

    $auth = get_sheets_auth($project, $project_id);
    if (!$auth)
        return ['success' => false, 'message' => 'No valid credentials'];

    $result = sheets_get_values($sheet_id, $sheet_range, $auth);
    if (!$result)
        return ['success' => false, 'message' => 'Failed to read sheet'];

    $rows = $result['values'] ?? [];
    if (empty($rows))
        return ['success' => false, 'message' => 'No data found in sheet'];

    $headers = array_map(function ($h) {
        return strtolower(trim(strval($h))); }, $rows[0]);
    $data = [];
    foreach (array_slice($rows, 1) as $row) {
        if (empty($row))
            continue;
        while (count($row) < count($headers))
            $row[] = '';
        $data[] = array_combine($headers, $row);
    }

    $cache_json = json_encode($data);
    $stmt = $db->prepare("UPDATE projects SET price_list_cache = ? WHERE id = ?");
    $stmt->execute([$cache_json, $project_id]);

    return ['success' => true, 'message' => "Synced " . count($data) . " rows using {$auth['type']}.", 'count' => count($data)];
}

function process_price_list_file($project_id, $file_path)
{
    $ext = strtolower(pathinfo($file_path, PATHINFO_EXTENSION));

    if ($ext === 'csv') {
        $data = [];
        if (($fh = fopen($file_path, 'r')) !== false) {
            $headers = fgetcsv($fh);
            $headers = array_map(function ($h) {
                return strtolower(trim($h)); }, $headers);
            while (($row = fgetcsv($fh)) !== false) {
                while (count($row) < count($headers))
                    $row[] = '';
                $data[] = array_combine($headers, $row);
            }
            fclose($fh);
        }
    } elseif ($ext === 'json') {
        $data = json_decode(file_get_contents($file_path), true) ?? [];
    } else {
        return ['success' => false, 'message' => 'Unsupported file format. Use CSV or JSON.'];
    }

    if (empty($data))
        return ['success' => false, 'message' => 'File is empty'];

    $db = get_db_connection();
    $stmt = $db->prepare("UPDATE projects SET price_list_cache = ? WHERE id = ?");
    $stmt->execute([json_encode($data), $project_id]);

    return ['success' => true, 'message' => "Uploaded & Cached " . count($data) . " rows.", 'count' => count($data)];
}

// ============================================================
// AI Price List Optimization
// ============================================================

function optimize_price_list_with_ai($project_id, $file_name)
{
    $file_path = UPLOADS_DIR . '/' . $project_id . '/' . $file_name;
    if (!file_exists($file_path)) {
        return ['success' => false, 'message' => "File not found: {$file_name}"];
    }

    // Read CSV file content
    $content = '';
    if (pathinfo($file_name, PATHINFO_EXTENSION) === 'csv') {
        $content = file_get_contents($file_path);
    } else {
        return ['success' => false, 'message' => 'Only CSV files supported for AI optimization'];
    }

    $row_count = count(explode("\n", trim($content)));
    if ($row_count > 200) {
        return ['success' => false, 'message' => 'File too large for AI direct conversion (Limit 200 rows).'];
    }

    $conversion_prompt = "Convert this Price List to a Standard JSON Array.\nOutput Format:\n[\n  { \"region\": \"...\", \"min_qty\": 0, \"max_qty\": 100, \"price\": 25.50 }\n]\nRules:\n- Normalize numbers (comma -> dot).\n- Parse ranges (e.g. \"10-20\") into min/max.\n- If no region, use \"Default\".\n- Return ONLY JSON.\n\nDATA:\n{$content}";

    $optimized_data = generate_json_llm("You are a Data Converter.", $conversion_prompt);

    if (isset($optimized_data['data'])) {
        $final_list = $optimized_data['data'];
    } elseif (is_array($optimized_data) && isset($optimized_data[0])) {
        $final_list = $optimized_data;
    } else {
        $final_list = [];
    }

    $optimized_filename = "optimized_{$file_name}.json";
    $optimized_path = UPLOADS_DIR . '/' . $project_id . '/' . $optimized_filename;
    file_put_contents($optimized_path, json_encode($final_list, JSON_PRETTY_PRINT));

    return [
        'success' => true,
        'optimized_file' => $optimized_filename,
        'preview' => array_slice($final_list, 0, 5),
        'count' => count($final_list),
    ];
}

// ============================================================
// AI Knowledge Base Optimization
// ============================================================

function optimize_knowledge_base_with_ai($project_id, $file_name)
{
    $file_path = UPLOADS_DIR . '/' . $project_id . '/' . $file_name;
    if (!file_exists($file_path)) {
        return ['success' => false, 'message' => 'File not found'];
    }

    $content = file_get_contents($file_path);
    $content = mb_substr($content, 0, 15000); // Limit chars

    $system_prompt = "You are a Technical Knowledge Manager.\nOrganize the following raw text into a structured Knowledge Base optimized for AI retrieval.\nStructure keys:\n- \"product_summary\": Brief description.\n- \"technical_specs\": Key specs list.\n- \"faqs\": List of Q&A.\n- \"selling_points\": Key persuasive points.\n- \"full_text_optimized\": The cleaned full text.";

    $optimized_json = generate_json_llm($system_prompt, "Raw Content:\n{$content}");

    $optimized_filename = "optimized_{$file_name}.json";
    $optimized_path = UPLOADS_DIR . '/' . $project_id . '/' . $optimized_filename;
    file_put_contents($optimized_path, json_encode($optimized_json, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

    return [
        'success' => true,
        'optimized_file' => $optimized_filename,
        'preview' => $optimized_json,
    ];
}

// ============================================================
// Main Workflow Processor
// ============================================================

function process_project_workflow($project_id)
{
    $db = get_db_connection();
    $stmt = $db->prepare("SELECT * FROM projects WHERE id = ?");
    $stmt->execute([$project_id]);
    $project = $stmt->fetch();

    if (!$project)
        return ['success' => false, 'message' => 'Project not found'];

    try {
        // Check for Dynamic Workflow
        $workflow_json = $project['workflow_json'] ?? '';
        if ($workflow_json && strlen($workflow_json) > 10) {
            $workflow_data = json_decode($workflow_json, true);
            if ($workflow_data) {
                require_once __DIR__ . '/workflow_engine.php';

                $ctx = ['project' => $project];

                // Get API key
                $api_key = null;
                $stmt2 = $db->prepare("SELECT value FROM settings WHERE `key` = 'google_api_key'");
                $stmt2->execute();
                $row_key = $stmt2->fetch();
                if ($row_key)
                    $api_key = $row_key['value'];

                $engine = new WorkflowEngine($workflow_data, $ctx, $api_key);
                $run_result = $engine->run();

                // Log run
                $run_id = generate_uuid();
                $details_json = json_encode($run_result['log'] ?? []);
                $output_json = json_encode($run_result['final_context'] ?? []);

                $stmt3 = $db->prepare("INSERT INTO runs (id, project_id, status, log_details, output_json) VALUES (?, ?, ?, ?, ?)");
                $stmt3->execute([$run_id, $project_id, 'completed', $details_json, $output_json]);

                return [
                    'success' => true,
                    'mode' => 'dynamic_workflow',
                    'message' => 'Workflow Completed successfully (Dynamic)',
                    'run_id' => $run_id,
                    'log' => $run_result['log'] ?? [],
                    'details' => $run_result['final_context'] ?? [],
                ];
            }
        }

        // Fallback: Hardcoded pipeline
        $auth = get_sheets_auth($project, $project_id);
        if (!$auth)
            return ['success' => false, 'message' => 'No valid credentials'];

        $pending_rows = fetch_pending_requests($project, $auth);
        $results = [];

        foreach ($pending_rows as $row) {
            $normalized = normalize_locality($row, $project);
            $product_knowledge = get_product_knowledge($project, $row['utilizzo'] ?? null);
            $pricing = calculate_pricing($row, $normalized, $project, $product_knowledge);
            $content = generate_content($row, $pricing, $product_knowledge, $project);

            $results[] = [
                'row' => $row['_row_number'],
                'status' => 'processed (dry run)',
                'normalized' => $normalized,
                'pricing' => $pricing,
                'content_preview_wa' => mb_substr($content['whatsapp_text'] ?? '', 0, 50) . '...',
            ];
        }

        return ['success' => true, 'processed' => count($results), 'details' => $results];

    } catch (Exception $e) {
        return ['success' => false, 'message' => $e->getMessage(), 'trace' => $e->getTraceAsString()];
    }
}

function test_project_connection($project_id)
{
    return process_project_workflow($project_id);
}
