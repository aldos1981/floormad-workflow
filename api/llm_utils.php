<?php
/**
 * Floormad Workflow - LLM Utilities (Google Gemini via REST API)
 */
require_once __DIR__ . '/config.php';

/**
 * Get the Google API key from settings DB or config constant.
 */
function get_api_key()
{
    // Try from DB settings first
    try {
        $db = get_db_connection();
        $stmt = $db->prepare("SELECT `value` FROM settings WHERE `key` = 'google_api_key'");
        $stmt->execute();
        $row = $stmt->fetch();
        if ($row && !empty($row['value'])) {
            return $row['value'];
        }
    } catch (Exception $e) {
        // DB not available yet, use config
    }

    return GOOGLE_API_KEY;
}

/**
 * Call Google Gemini API.
 * 
 * @param string $system_prompt System instruction
 * @param string $user_prompt User message content
 * @param string $model Model name (default: gemini-2.0-flash)
 * @return string Response text
 */
function call_llm($system_prompt, $user_prompt, $model = 'gemini-2.0-flash')
{
    $api_key = get_api_key();
    if (empty($api_key)) {
        return "Error: API Key missing. Please add GOOGLE_API_KEY to settings.";
    }

    $url = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$api_key}";

    $payload = [
        'system_instruction' => [
            'parts' => [['text' => $system_prompt]]
        ],
        'contents' => [
            [
                'parts' => [['text' => $user_prompt]]
            ]
        ],
        'generationConfig' => [
            'temperature' => 0.7,
            'maxOutputTokens' => 8192
        ]
    ];

    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    curl_setopt($ch, CURLOPT_TIMEOUT, 60);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $error = curl_error($ch);
    curl_close($ch);

    if ($error) {
        return "Error calling LLM: cURL error - $error";
    }

    if ($httpCode >= 400) {
        $decoded = json_decode($response, true);
        $errMsg = $decoded['error']['message'] ?? "HTTP $httpCode";
        return "Error calling LLM: $errMsg";
    }

    $decoded = json_decode($response, true);

    // Extract text from response
    $candidates = $decoded['candidates'] ?? [];
    if (empty($candidates)) {
        return "Error: No response from LLM";
    }

    $parts = $candidates[0]['content']['parts'] ?? [];
    $text = '';
    foreach ($parts as $part) {
        $text .= $part['text'] ?? '';
    }

    return $text;
}

/**
 * Alias for compatibility
 */
function generate_text($system_prompt, $user_prompt, $model = 'gemini-2.0-flash')
{
    return call_llm($system_prompt, $user_prompt, $model);
}

/**
 * Call LLM and parse JSON response.
 */
function generate_json_llm($system_prompt, $user_prompt, $model = 'gemini-2.0-flash')
{
    // Force JSON mode in prompt
    if (stripos($system_prompt, 'json') === false && stripos($user_prompt, 'json') === false) {
        $system_prompt .= "\nRespond in JSON format.";
    }

    $response_text = call_llm($system_prompt, $user_prompt, $model);

    // Strip markdown code blocks
    $response_text = str_replace(['```json', '```'], '', $response_text);
    $response_text = trim($response_text);

    // Find JSON object
    $start = strpos($response_text, '{');
    $end = strrpos($response_text, '}');

    if ($start !== false && $end !== false && $end >= $start) {
        $json_str = substr($response_text, $start, $end - $start + 1);
        $decoded = json_decode($json_str, true);
        if ($decoded !== null) {
            return $decoded;
        }
    }

    // Try array format
    $start = strpos($response_text, '[');
    $end = strrpos($response_text, ']');
    if ($start !== false && $end !== false && $end >= $start) {
        $json_str = substr($response_text, $start, $end - $start + 1);
        $decoded = json_decode($json_str, true);
        if ($decoded !== null) {
            return $decoded;
        }
    }

    error_log("Failed to parse JSON from LLM response: $response_text");
    return [];
}
