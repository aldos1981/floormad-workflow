<?php
/**
 * workflow_engine.php - Drawflow Graph Executor
 * PHP port of workflow_engine.py (WorkflowEngine class)
 *
 * Traverses Drawflow JSON, executes nodes (Trigger, AI, Google Sheet,
 * Email, WhatsApp, Pipedrive, Knowledge, HTML Template), and maintains
 * a flat accumulated context for variable resolution.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/database.php';
require_once __DIR__ . '/llm_utils.php';

class WorkflowEngine
{
    private $workflow_data;
    private $context;
    private $api_key;
    private $nodes;
    private $execution_log = [];

    public function __construct($workflow_data, $context = [], $api_key = null)
    {
        $this->workflow_data = $workflow_data;
        $this->context = $context ?: [];
        $this->api_key = $api_key;
        $this->nodes = $this->extractNodes();
    }

    // ============================================================
    // Node Extraction & Graph Traversal
    // ============================================================

    private function extractNodes()
    {
        if (isset($this->workflow_data['drawflow'])) {
            return $this->workflow_data['drawflow']['Home']['data'] ?? [];
        } elseif (isset($this->workflow_data['Home'])) {
            return $this->workflow_data['Home']['data'] ?? [];
        }
        return $this->workflow_data;
    }

    private function findTriggerNode()
    {
        foreach ($this->nodes as $id => $node) {
            if (($node['name'] ?? '') === 'TRIGGER')
                return $id;
        }
        return null;
    }

    private function getNextNodes($node_id)
    {
        $node = $this->nodes[$node_id] ?? null;
        if (!$node)
            return [];

        $next = [];
        $outputs = $node['outputs'] ?? [];
        foreach ($outputs as $out) {
            foreach ($out['connections'] ?? [] as $conn) {
                $next[] = $conn['node'];
            }
        }
        return $next;
    }

    private function getReachableNodes($start_id)
    {
        $visited = [];
        $queue = [$start_id];
        while (!empty($queue)) {
            $nid = array_shift($queue);
            if (in_array($nid, $visited))
                continue;
            $visited[] = $nid;
            foreach ($this->getNextNodes($nid) as $next) {
                if (!in_array($next, $visited))
                    $queue[] = $next;
            }
        }
        return $visited;
    }

    // ============================================================
    // Main Execution Loop (BFS)
    // ============================================================

    /**
     * Run the workflow. Optionally calls $status_callback($node_id, $status, $msg)
     * to update workflow_status table for polling.
     */
    public function run($status_callback = null)
    {
        $start_id = $this->findTriggerNode();
        if (!$start_id) {
            return ['status' => 'error', 'message' => 'No Trigger Node found'];
        }

        $reachable = $this->getReachableNodes($start_id);
        $queue = [[$start_id, $this->context]];
        $results = [];
        $accumulated = [];

        while (!empty($queue)) {
            [$current_id, $input_data] = array_shift($queue);
            $node = $this->nodes[$current_id] ?? null;
            if (!$node)
                continue;

            $config = $node['data']['config'] ?? [];

            // Notify start
            if ($status_callback) {
                $status_callback($current_id, 'running', 'Starting ' . ($node['name'] ?? ''));
            }

            // Skip disabled nodes
            if (!empty($config['disabled'])) {
                $this->execution_log[] = [
                    'node_id' => $current_id,
                    'type' => $node['name'] ?? '',
                    'status' => 'skipped',
                    'message' => 'Node is disabled',
                ];
                if ($status_callback)
                    $status_callback($current_id, 'skipped', 'Node disabled');
                continue;
            }

            // Skip unreachable
            if (!in_array($current_id, $reachable))
                continue;

            // Merged context for execution
            $merged = array_merge($results, $accumulated);

            try {
                $output = $this->executeNode($node, $input_data, $merged);
                $results[$current_id] = $output;

                // Flat merge output into accumulated context
                $node_name = $config['node_name'] ?? '';
                $output_var = $config['output_var'] ?? '';

                if (is_array($output)) {
                    foreach ($output as $key => $val) {
                        if (strpos($key, '_') === 0)
                            continue; // skip internal
                        if (is_scalar($val) || $val === null) {
                            $accumulated[$key] = $val;
                        } elseif (is_array($val)) {
                            $accumulated[$key] = json_decode(json_encode($val), true);
                        }
                    }
                    if ($node_name) {
                        $accumulated[$node_name] = json_decode(json_encode($output), true);
                    }
                    if ($output_var && $output_var !== $node_name) {
                        $accumulated[$output_var] = json_decode(json_encode($output), true);
                    }
                } elseif (is_string($output) && $output !== '') {
                    if ($output_var)
                        $accumulated[$output_var] = $output;
                    elseif ($node_name)
                        $accumulated[$node_name] = $output;
                    if (!isset($accumulated['content']))
                        $accumulated['content'] = $output;
                }

                $ctx_keys = array_keys(array_filter($accumulated, function ($k) {
                    return !is_numeric($k); }, ARRAY_FILTER_USE_KEY));
                $output_str = is_string($output) ? $output : json_encode($output);
                $this->execution_log[] = [
                    'node_id' => $current_id,
                    'type' => $node['name'] ?? '',
                    'node_name' => $node_name ?: $output_var,
                    'status' => 'success',
                    'output' => mb_substr($output_str, 0, 200) . (strlen($output_str) > 200 ? '...' : ''),
                    'context_keys' => $ctx_keys,
                ];
                if ($status_callback)
                    $status_callback($current_id, 'completed', 'Success');

            } catch (Exception $e) {
                $this->execution_log[] = [
                    'node_id' => $current_id,
                    'type' => $node['name'] ?? '',
                    'status' => 'error',
                    'error' => $e->getMessage(),
                ];
                if ($status_callback)
                    $status_callback($current_id, 'error', $e->getMessage());
                return ['status' => 'failed', 'log' => $this->execution_log, 'final_context' => $accumulated];
            }

            // Propagate to next nodes
            foreach ($this->getNextNodes($current_id) as $next_id) {
                $queue[] = [$next_id, $accumulated];
            }
        }

        return ['status' => 'completed', 'log' => $this->execution_log, 'final_context' => $accumulated];
    }

    // ============================================================
    // Node Dispatcher
    // ============================================================

    public function executeNode($node, $input_data, $execution_context = [])
    {
        $type = $node['name'] ?? '';
        $config = $node['data']['config'] ?? [];

        switch ($type) {
            case 'TRIGGER':
                return $this->executeTrigger($config, $input_data);
            case 'AI_COMPLETION':
                return $this->executeAI($config, $input_data, $execution_context);
            case 'GOOGLE_SHEET':
                return $this->executeGoogleSheet($config, $input_data);
            case 'SEND_EMAIL':
                return $this->executeEmail($config, $input_data, $execution_context);
            case 'SEND_WHATSAPP':
                return $this->executeWhatsApp($config, $input_data, $execution_context);
            case 'HTML_TEMPLATE':
                return $this->executeHtmlTemplate($config, $input_data, $execution_context);
            case 'KNOWLEDGE':
                return $this->executeKnowledge($config, $input_data);
            case 'HTML_PREVIEW':
                $src = $config['source_var'] ?? 'html_content';
                return $execution_context[$src] ?? $input_data;
            case 'PIPEDRIVE':
                return $this->executePipedrive($config, $input_data, $execution_context);
            default:
                return $input_data;
        }
    }

    // ============================================================
    // TRIGGER Node
    // ============================================================

    private function executeTrigger($config, $input_data)
    {
        return [
            'source' => 'trigger',
            'data' => $input_data,
            'timestamp' => date('c'),
        ];
    }

    // ============================================================
    // AI_COMPLETION Node (Gemini REST API)
    // ============================================================

    private function executeAI($config, $input_data, $execution_context)
    {
        if (!$this->api_key) {
            throw new Exception('No Google API Key provided for AI Node');
        }

        $system_prompt = $this->resolveVariables($config['system_prompt'] ?? 'You are a helpful assistant.', $execution_context);
        $user_prompt = $this->resolveVariables($config['user_prompt'] ?? '', $execution_context);
        $schema_instruction = $config['schema_instruction'] ?? '';
        $html_template = $config['html_template'] ?? '';
        $temperature = floatval($config['temperature'] ?? 0.3);
        $model = $config['model'] ?? 'gemini-2.0-flash';

        $context_str = json_encode($input_data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

        $full_prompt = "{$system_prompt}\n\nDATA CONTEXT:\n{$context_str}\n\nINSTRUCTIONS:\n{$schema_instruction}\n\nHTML TEMPLATE (For Reference):\n{$html_template}\n\nIMPORTANT: Return ONLY valid JSON matching the schema instruction.\nDo not include format markers like ```json.";

        // Call Gemini
        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$this->api_key}";
        $payload = [
            'contents' => [['parts' => [['text' => $full_prompt]]]],
            'generationConfig' => [
                'temperature' => $temperature,
                'responseMimeType' => 'application/json',
                'maxOutputTokens' => 8192,
            ],
        ];

        $result = http_request('POST', $url, $payload);
        $text = $result['candidates'][0]['content']['parts'][0]['text'] ?? '';

        // Parse JSON from response
        $ai_output = null;
        // Clean markdown code blocks
        if (strpos($text, '```') !== false) {
            if (preg_match('/```(?:json)?\s*(.*?)```/s', $text, $m)) {
                $text = trim($m[1]);
            }
        }

        $ai_output = json_decode($text, true);
        if ($ai_output === null) {
            // Fallback: extract JSON object
            if (preg_match('/(\{.*\})/s', $text, $m)) {
                $ai_output = json_decode($m[1], true);
            }
            if ($ai_output === null) {
                $ai_output = ['raw_output' => $text, 'error' => 'Failed to parse JSON'];
            }
        }

        // Apply HTML template
        if ($html_template && is_array($ai_output)) {
            $rendered = $html_template;
            if (isset($ai_output['content'])) {
                $rendered = str_replace('{{content}}', $ai_output['content'], $rendered);
            }
            foreach ($ai_output as $key => $val) {
                if (is_string($val)) {
                    $rendered = str_replace("{{{$key}}}", $val, $rendered);
                }
            }
            $ai_output['_html_rendered'] = $rendered;
        } elseif (is_array($ai_output) && isset($ai_output['content'])) {
            $ai_output['_html_rendered'] = $ai_output['content'];
        }

        return $ai_output;
    }

    // ============================================================
    // GOOGLE_SHEET Node
    // ============================================================

    private function executeGoogleSheet($config, $input_data)
    {
        require_once __DIR__ . '/engine.php';

        $project = $this->context['project'] ?? null;
        if (!$project)
            return ['error' => 'No project context found'];

        $auth = get_sheets_auth($project, $project['id'] ?? null);
        if (!$auth)
            return ['error' => 'No valid credentials'];

        // Override with node config
        $effective = $project;
        if (!empty($config['sheet_id']))
            $effective['google_sheet_id'] = $config['sheet_id'];
        if (!empty($config['sheet_range']))
            $effective['google_sheet_range'] = $config['sheet_range'];

        // Filter
        $filter = [];
        if (!empty($config['filter_column']))
            $filter['column'] = $config['filter_column'];
        if (isset($config['filter_value']))
            $filter['value'] = $config['filter_value'];

        $rows = fetch_pending_requests($effective, $auth, $filter ?: null);
        if (empty($rows))
            return ['_status' => 'no_data'];

        $row = $rows[0];
        $sheet_id = $effective['google_sheet_id'] ?? '';
        $sheet_range = $effective['google_sheet_range'] ?? 'Foglio1!A:AZ';
        $row_num = $row['_row_number'] ?? 0;

        // Get raw headers for correct column mapping
        $raw_headers = null;
        $sheet_name = 'Foglio1';
        if (strpos($sheet_range, '!') !== false)
            $sheet_name = explode('!', $sheet_range)[0];
        $hdr_result = sheets_get_values($sheet_id, "{$sheet_name}!1:1", $auth);
        if ($hdr_result && !empty($hdr_result['values'][0])) {
            $raw_headers = array_map('trim', array_map('strval', $hdr_result['values'][0]));
        } else {
            $raw_headers = array_keys(array_filter($row, function ($k) {
                return strpos($k, '_') !== 0; }, ARRAY_FILTER_USE_KEY));
        }

        // Auto-counter
        if (!empty($config['counter_column'])) {
            $counter_col = $config['counter_column'];
            $next_num = get_next_counter($auth, $sheet_id, $sheet_range, $counter_col, $raw_headers);
            update_sheet_cell($auth, $sheet_id, $sheet_range, $row_num, $counter_col, $next_num, $raw_headers);
            $row[$counter_col] = strval($next_num);
        }

        // Update status column
        if (!empty($config['update_column']) && !empty($config['update_value'])) {
            update_sheet_cell($auth, $sheet_id, $sheet_range, $row_num, $config['update_column'], $config['update_value'], $raw_headers);
            $row[$config['update_column']] = $config['update_value'];
        }

        // Return clean row
        $output = [];
        foreach ($row as $k => $v) {
            if (strpos($k, '_') !== 0)
                $output[$k] = $v;
        }
        $output['_row_number'] = $row_num;
        return $output;
    }

    // ============================================================
    // HTML_TEMPLATE Node
    // ============================================================

    private function executeHtmlTemplate($config, $input_data, $execution_context)
    {
        $template = $config['html_template'] ?? $config['template'] ?? '';
        return $this->resolveVariables($template, $execution_context);
    }

    // ============================================================
    // KNOWLEDGE Node
    // ============================================================

    private function executeKnowledge($config, $input_data)
    {
        return $config['knowledge_text'] ?? '';
    }

    // ============================================================
    // SEND_EMAIL Node (SMTP)
    // ============================================================

    private function executeEmail($config, $input_data, $execution_context)
    {
        $subject = $this->resolveVariables($config['subject'] ?? 'Preventivo', $execution_context);

        // Resolve recipient
        $raw_to = $config['email_to'] ?? $config['to_field'] ?? '';
        $recipient = $this->resolveVariables($raw_to, $execution_context);

        $project = $this->context['project'] ?? null;
        if (!$project)
            return ['error' => 'No project context for SMTP config'];

        $smtp_str = $project['smtp_config'] ?? '';
        if (!$smtp_str)
            return ['error' => 'No SMTP configuration found'];

        $smtp = is_string($smtp_str) ? json_decode($smtp_str, true) : $smtp_str;
        if (!$smtp || empty($smtp['host']))
            return ['error' => 'Incomplete SMTP config'];

        // Resolve email body
        $body_template = $config['email_body'] ?? $config['body'] ?? $config['body_var'] ?? '';
        if ($body_template) {
            $email_body = $this->resolveVariables($body_template, $execution_context);
        } else {
            $email_body = '';
            foreach (['_html_rendered', 'content', 'html', 'email_body', 'raw_output'] as $key) {
                if (!empty($execution_context[$key]) && is_string($execution_context[$key]) && strlen($execution_context[$key]) > 10) {
                    $email_body = $execution_context[$key];
                    break;
                }
            }
            if (!$email_body && is_array($input_data)) {
                $email_body = $input_data['_html_rendered'] ?? $input_data['content'] ?? $input_data['html'] ?? '';
            } elseif (!$email_body && is_string($input_data)) {
                $email_body = $input_data;
            }
        }
        if (!$email_body)
            $email_body = 'Nessun contenuto generato.';
        $email_body = $this->resolveVariables($email_body, $execution_context);

        // Resolve recipient fallbacks
        if (!$recipient && $execution_context) {
            foreach (['email', 'email_to', 'recipient', 'to'] as $key) {
                if (!empty($execution_context[$key]) && strpos($execution_context[$key], '@') !== false) {
                    $recipient = $execution_context[$key];
                    break;
                }
            }
        }
        if (!$recipient && is_array($input_data))
            $recipient = $input_data['email'] ?? '';
        if (!$recipient)
            return ['status' => 'skipped', 'reason' => 'No recipient found'];

        // Build header/footer
        $header_logo = $config['header_logo'] ?? '';
        $header_text = $config['header_text'] ?? '';
        $footer_html = $this->resolveVariables($config['footer_html'] ?? '', $execution_context);

        $header = '';
        if ($header_logo || $header_text) {
            $header = '<div style="text-align:center; padding:20px 0; border-bottom:2px solid #eee; margin-bottom:20px;">';
            if ($header_logo)
                $header .= "<img src=\"{$header_logo}\" alt=\"Logo\" style=\"max-width:200px; max-height:80px; margin-bottom:10px;\">";
            if ($header_text)
                $header .= "<div style=\"font-size:18px; font-weight:bold; color:#333; margin-top:5px;\">{$header_text}</div>";
            $header .= '</div>';
        }

        $footer = $footer_html ? "<div style=\"border-top:1px solid #eee; margin-top:30px; padding-top:15px; font-size:13px; color:#666;\">{$footer_html}</div>" : '';

        $full_html = "<div style=\"font-family: Arial, Helvetica, sans-serif; max-width:700px; margin:0 auto; color:#333;\">{$header}<div style=\"padding:10px 0;\">{$email_body}</div>{$footer}</div>";

        $plain_text = strip_tags($email_body);

        // SMTP send via PHP mail() or socket
        $from_email = $smtp['user'] ?? '';
        $from_name = $smtp['from_name'] ?? explode('@', $from_email)[0] ?? 'Notification';
        $host = $smtp['host'];
        $port = intval($smtp['port'] ?? 587);
        $user = $smtp['user'] ?? '';
        $password = $smtp['pass'] ?? $smtp['password'] ?? '';

        // Build MIME message
        $boundary = md5(uniqid(time()));
        $headers_mail = [];
        $headers_mail[] = "From: {$from_name} <{$from_email}>";
        $headers_mail[] = "Reply-To: {$from_email}";
        $headers_mail[] = "MIME-Version: 1.0";
        $headers_mail[] = "Content-Type: multipart/alternative; boundary=\"{$boundary}\"";
        $headers_mail[] = "Date: " . date('r');
        $headers_mail[] = "Message-ID: <" . uniqid() . "@{$host}>";

        $body_mime = "--{$boundary}\r\n";
        $body_mime .= "Content-Type: text/plain; charset=UTF-8\r\n\r\n";
        $body_mime .= $plain_text . "\r\n\r\n";
        $body_mime .= "--{$boundary}\r\n";
        $body_mime .= "Content-Type: text/html; charset=UTF-8\r\n\r\n";
        $body_mime .= $full_html . "\r\n\r\n";
        $body_mime .= "--{$boundary}--";

        // Use fsockopen for SMTP
        try {
            $smtp_result = $this->sendSmtp($host, $port, $user, $password, $from_email, $recipient, $subject, $headers_mail, $body_mime);
            if ($smtp_result === true) {
                return ['status' => 'sent', 'recipient' => $recipient];
            } else {
                return ['error' => $smtp_result];
            }
        } catch (Exception $e) {
            return ['error' => 'SMTP Error: ' . $e->getMessage()];
        }
    }

    /**
     * Simple SMTP send via fsockopen (works on shared hosting without additional extensions).
     */
    private function sendSmtp($host, $port, $user, $password, $from, $to, $subject, $headers, $body)
    {
        $use_ssl = ($port == 465);
        $conn_host = $use_ssl ? "ssl://{$host}" : $host;

        $fp = @fsockopen($conn_host, $port, $errno, $errstr, 20);
        if (!$fp)
            return "Connection failed: {$errstr} ({$errno})";

        $this->smtpRead($fp);
        $this->smtpWrite($fp, "EHLO {$host}");
        $this->smtpRead($fp);

        if (!$use_ssl && $port == 587) {
            $this->smtpWrite($fp, "STARTTLS");
            $resp = $this->smtpRead($fp);
            if (strpos($resp, '220') === false)
                return "STARTTLS failed: {$resp}";
            stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT);
            $this->smtpWrite($fp, "EHLO {$host}");
            $this->smtpRead($fp);
        }

        // Auth
        $this->smtpWrite($fp, "AUTH LOGIN");
        $this->smtpRead($fp);
        $this->smtpWrite($fp, base64_encode($user));
        $this->smtpRead($fp);
        $this->smtpWrite($fp, base64_encode($password));
        $resp = $this->smtpRead($fp);
        if (strpos($resp, '235') === false)
            return "Auth failed: {$resp}";

        $this->smtpWrite($fp, "MAIL FROM:<{$from}>");
        $this->smtpRead($fp);
        $this->smtpWrite($fp, "RCPT TO:<{$to}>");
        $this->smtpRead($fp);
        $this->smtpWrite($fp, "DATA");
        $this->smtpRead($fp);

        // Compose message
        $msg = "To: {$to}\r\n";
        $msg .= "Subject: {$subject}\r\n";
        $msg .= implode("\r\n", $headers) . "\r\n\r\n";
        $msg .= $body . "\r\n.\r\n";

        fwrite($fp, $msg);
        $this->smtpRead($fp);

        $this->smtpWrite($fp, "QUIT");
        fclose($fp);

        return true;
    }

    private function smtpWrite($fp, $cmd)
    {
        fwrite($fp, $cmd . "\r\n");
    }

    private function smtpRead($fp)
    {
        $data = '';
        while ($line = fgets($fp, 512)) {
            $data .= $line;
            if (substr($line, 3, 1) === ' ')
                break;
        }
        return $data;
    }

    // ============================================================
    // SEND_WHATSAPP Node
    // ============================================================

    private function executeWhatsApp($config, $input_data, $execution_context)
    {
        require_once __DIR__ . '/wesender_client.php';

        $phone_field = $config['phone_field'] ?? 'telefono';
        $phone = null;

        // Resolve phone
        $resolved = $this->resolveVariables($phone_field, $execution_context);
        if ($resolved && preg_match('/\d/', $resolved))
            $phone = $resolved;

        if (!$phone)
            $phone = $this->resolveVariables("{{{$phone_field}}}", $execution_context);
        if (!$phone && is_array($input_data))
            $phone = $input_data[$phone_field] ?? $input_data['phone'] ?? $input_data['telefono'] ?? null;
        if (!$phone && $execution_context)
            $phone = $execution_context[$phone_field] ?? $execution_context['phone'] ?? $execution_context['telefono'] ?? null;
        if (!$phone)
            return ['status' => 'skipped', 'reason' => 'No phone number found'];

        // Resolve message
        $message_var = $config['message_var'] ?? '';
        $message = $this->resolveVariables($message_var, $execution_context);
        if (!$message) {
            if (is_string($input_data))
                $message = $input_data;
            elseif (is_array($input_data))
                $message = $input_data['message'] ?? $input_data['content'] ?? $input_data['text'] ?? '';
        }
        if (!$message)
            return ['status' => 'skipped', 'reason' => 'No message content found'];

        $project = $this->context['project'] ?? null;
        if (!$project)
            return ['error' => 'No project context'];

        $ws_conf = $project['wesendit_config'] ?? '';
        $ws_conf = is_string($ws_conf) ? json_decode($ws_conf, true) : $ws_conf;
        $api_key = $ws_conf['api_key'] ?? '';
        if (!$api_key)
            return ['error' => 'Missing WeSender API Key'];

        $client = new WeSenderClient($api_key, $ws_conf['api_url'] ?? null);
        $result = $client->send_message($phone, $message);

        return $result['success'] ?? false
            ? ['status' => 'sent', 'recipient' => $phone, 'api_response' => $result['data'] ?? null]
            : ['status' => 'error', 'error' => $result['details'] ?? 'Unknown'];
    }

    // ============================================================
    // PIPEDRIVE Node
    // ============================================================

    private function executePipedrive($config, $input_data, $execution_context)
    {
        require_once __DIR__ . '/pipedrive_client.php';

        $email = $this->resolveVariables($config['email_field'] ?? '{{email}}', $execution_context);
        $name = $this->resolveVariables($config['name_field'] ?? '{{nome}}', $execution_context);
        $phone = $this->resolveVariables($config['phone_field'] ?? '{{telefono}}', $execution_context);
        $address = !empty($config['address_field']) ? $this->resolveVariables($config['address_field'], $execution_context) : '';
        $notes = !empty($config['notes_field']) ? $this->resolveVariables($config['notes_field'], $execution_context) : '';

        $project = $this->context['project'] ?? null;
        if (!$project)
            return ['error' => 'No project context'];

        $pd_str = $project['pipedrive_config'] ?? '';
        $pd_conf = is_string($pd_str) ? json_decode($pd_str, true) : $pd_str;
        $api_token = $pd_conf['api_token'] ?? '';
        if (!$api_token)
            return ['error' => 'Missing Pipedrive API Token'];

        $client = new PipedriveClient($api_token);
        $result = $client->sync_person($name, $email, $phone ?: null, $notes ?: null, $address ?: null);

        return $result;
    }

    // ============================================================
    // Variable Resolution: {{variable}} → value
    // ============================================================

    private function resolveVariables($text, $execution_context)
    {
        if (!$text || !is_string($text) || !$execution_context)
            return $text;

        preg_match_all('/\{\{([a-zA-Z0-9_. -]+)\}\}/', $text, $matches);
        if (empty($matches[1]))
            return $text;

        $result = $text;

        foreach ($matches[1] as $var_name) {
            $value = null;
            $found = false;

            $parts = explode('.', $var_name);
            $root = $parts[0];
            $props = array_slice($parts, 1);

            // Strategy 1: FLAT lookup
            if (isset($execution_context[$var_name])) {
                $value = $execution_context[$var_name];
                $found = true;
            }

            // Strategy 2: Root + dot property
            if (!$found && isset($execution_context[$root])) {
                $data = $execution_context[$root];
                if (!empty($props)) {
                    $current = $data;
                    $valid = true;
                    foreach ($props as $prop) {
                        if (is_array($current) && isset($current[$prop])) {
                            $current = $current[$prop];
                        } else {
                            $valid = false;
                            break;
                        }
                    }
                    if ($valid) {
                        $value = $current;
                        $found = true;
                    }
                } else {
                    $value = $data;
                    $found = true;
                }
            }

            // Strategy 3: Search nodes for matching output_var/node_name
            if (!$found) {
                foreach ($this->nodes as $nid => $node) {
                    $nc = $node['data']['config'] ?? [];
                    if (($nc['output_var'] ?? '') === $root || ($nc['node_name'] ?? '') === $root) {
                        if (isset($execution_context[$nid])) {
                            $data = $execution_context[$nid];
                            if (!empty($props)) {
                                $current = $data;
                                $valid = true;
                                foreach ($props as $prop) {
                                    if (is_array($current) && isset($current[$prop])) {
                                        $current = $current[$prop];
                                    } else {
                                        $valid = false;
                                        break;
                                    }
                                }
                                if ($valid) {
                                    $value = $current;
                                    $found = true;
                                }
                            } else {
                                $value = $data;
                                $found = true;
                            }
                        }
                        break;
                    }
                }
            }

            // Strategy 4: Fuzzy lookup (slug matching)
            if (!$found && empty($props)) {
                $norm_var = preg_replace('/[^a-z0-9]/', '', strtolower($var_name));
                foreach ($execution_context as $key => $v) {
                    $norm_key = preg_replace('/[^a-z0-9]/', '', strtolower($key));
                    if ($norm_key === $norm_var) {
                        $value = $v;
                        $found = true;
                        break;
                    }
                }
            }

            if ($found && $value !== null) {
                if (is_array($value)) {
                    $value = json_encode($value, JSON_UNESCAPED_UNICODE);
                }
                $result = str_replace("{{{$var_name}}}", strval($value), $result);
            }
        }

        return $result;
    }
}
