<?php
/**
 * Floormad Workflow - WeSender Client (WhatsApp via WaSenderAPI)
 */
require_once __DIR__ . '/config.php';

class WeSenderClient
{
    private $api_key;
    private $api_url;

    const DEFAULT_API_URL = 'https://wasenderapi.com/api/send-message';

    public function __construct($api_key, $api_url = null)
    {
        $this->api_key = $api_key;
        $this->api_url = $api_url ? rtrim($api_url, '/') : self::DEFAULT_API_URL;
    }

    /**
     * Send a WhatsApp text message.
     */
    public function send_message($phone, $message)
    {
        $payload = [
            'to' => $phone,
            'text' => $message
        ];

        $ch = curl_init($this->api_url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
        curl_setopt($ch, CURLOPT_TIMEOUT, 15);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Authorization: Bearer ' . $this->api_key,
            'Content-Type: application/json',
            'Accept: application/json'
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("WaSenderAPI Error: $error");
            return ['success' => false, 'details' => ['error' => $error]];
        }

        if ($httpCode >= 400) {
            error_log("WaSenderAPI HTTP Error: $httpCode - $response");
            return [
                'success' => false,
                'details' => [
                    'error' => "HTTP $httpCode",
                    'status_code' => $httpCode,
                    'response_text' => $response
                ]
            ];
        }

        $decoded = json_decode($response, true);
        return [
            'success' => true,
            'data' => $decoded ?: [],
            'status_code' => $httpCode
        ];
    }
}
