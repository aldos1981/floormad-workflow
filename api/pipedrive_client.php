<?php
/**
 * Floormad Workflow - Pipedrive CRM Client
 * Handles search, create, and update operations for Person contacts.
 */
require_once __DIR__ . '/config.php';

class PipedriveClient
{
    const BASE_URL = 'https://api.pipedrive.com/v1';
    private $api_token;

    public function __construct($api_token)
    {
        if (empty($api_token)) {
            throw new Exception("Pipedrive API token is required");
        }
        $this->api_token = $api_token;
    }

    /**
     * Make an authenticated request to Pipedrive API.
     */
    private function request($method, $endpoint, $params = [], $json_data = null)
    {
        $params['api_token'] = $this->api_token;
        $url = self::BASE_URL . '/' . $endpoint;

        if (!empty($params)) {
            $url .= '?' . http_build_query($params);
        }

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true);

        $method = strtoupper($method);
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
        } elseif ($method !== 'GET') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
        }

        if ($json_data !== null) {
            $json = json_encode($json_data);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $json);
            curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
        }

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            error_log("Pipedrive connection error: $error");
            return ['success' => false, 'error' => "Connection error: $error"];
        }

        $result = json_decode($response, true);
        if ($result === null) {
            return ['success' => false, 'error' => "Invalid JSON response"];
        }

        if ($httpCode >= 400) {
            $errMsg = $result['error'] ?? $result['error_info'] ?? "HTTP $httpCode";
            error_log("Pipedrive API error: $errMsg");
            return ['success' => false, 'error' => $errMsg];
        }

        return $result;
    }

    /**
     * Search for a person by email.
     */
    public function search_person($email)
    {
        if (empty($email))
            return null;

        $result = $this->request('GET', 'persons/search', [
            'term' => $email,
            'fields' => 'email',
            'limit' => 1
        ]);

        if (empty($result['success'])) {
            return null;
        }

        $items = $result['data']['items'] ?? [];
        if (!empty($items)) {
            $person = $items[0]['item'] ?? [];
            error_log("Pipedrive: Found person ID " . ($person['id'] ?? '?') . " for email $email");
            return $person;
        }

        return null;
    }

    /**
     * Create a new person in Pipedrive.
     */
    public function create_person($name, $email = null, $phone = null, $notes = null, $postal_address = null, $custom_fields = [])
    {
        $data = ['name' => $name];

        if ($email) {
            $data['email'] = [['value' => $email, 'primary' => true, 'label' => 'work']];
        }
        if ($phone) {
            $data['phone'] = [['value' => $phone, 'primary' => true, 'label' => 'work']];
        }
        if ($postal_address) {
            $data['postal_address'] = $postal_address;
        }
        if (!empty($custom_fields)) {
            $data = array_merge($data, $custom_fields);
        }

        $result = $this->request('POST', 'persons', [], $data);

        if (!empty($result['success'])) {
            $person = $result['data'] ?? [];
            error_log("Pipedrive: Created person ID " . ($person['id'] ?? '?') . " - $name");

            if ($notes && !empty($person['id'])) {
                $this->add_note($person['id'], $notes);
            }

            return [
                'success' => true,
                'action' => 'created',
                'person_id' => $person['id'] ?? null,
                'name' => $person['name'] ?? null,
                'data' => $person
            ];
        }

        return [
            'success' => false,
            'action' => 'create_failed',
            'error' => $result['error'] ?? 'Unknown error'
        ];
    }

    /**
     * Update an existing person.
     */
    public function update_person($person_id, $name = null, $email = null, $phone = null, $notes = null, $postal_address = null, $custom_fields = [])
    {
        $data = [];

        if ($name)
            $data['name'] = $name;
        if ($email) {
            $data['email'] = [['value' => $email, 'primary' => true, 'label' => 'work']];
        }
        if ($phone) {
            $data['phone'] = [['value' => $phone, 'primary' => true, 'label' => 'work']];
        }
        if ($postal_address)
            $data['postal_address'] = $postal_address;
        if (!empty($custom_fields)) {
            $data = array_merge($data, $custom_fields);
        }

        if (empty($data) && empty($notes)) {
            return ['success' => true, 'action' => 'no_update_needed', 'person_id' => $person_id];
        }

        $result = $this->request('PUT', "persons/$person_id", [], $data);

        if (!empty($result['success'])) {
            $person = $result['data'] ?? [];
            error_log("Pipedrive: Updated person ID $person_id");

            if ($notes) {
                $this->add_note($person_id, $notes);
            }

            return [
                'success' => true,
                'action' => 'updated',
                'person_id' => $person_id,
                'name' => $person['name'] ?? null,
                'data' => $person
            ];
        }

        return [
            'success' => false,
            'action' => 'update_failed',
            'error' => $result['error'] ?? 'Unknown error'
        ];
    }

    /**
     * Add a note to a person.
     */
    private function add_note($person_id, $content)
    {
        $result = $this->request('POST', 'notes', [], [
            'content' => $content,
            'person_id' => $person_id
        ]);
        if (!empty($result['success'])) {
            error_log("Pipedrive: Added note to person $person_id");
        }
        return $result;
    }

    /**
     * All-in-one: Search by email, create if not found, update if exists.
     */
    public function sync_person($name, $email, $phone = null, $notes = null, $postal_address = null, $custom_fields = [])
    {
        if (empty($email)) {
            return ['success' => false, 'error' => 'Email is required for sync'];
        }
        if (empty($name)) {
            return ['success' => false, 'error' => 'Name is required for sync'];
        }

        // Step 1: Search
        $existing = $this->search_person($email);

        if ($existing) {
            // Step 2a: Update
            $person_id = $existing['id'] ?? null;
            return $this->update_person($person_id, $name, $email, $phone, $notes, $postal_address, $custom_fields);
        } else {
            // Step 2b: Create
            return $this->create_person($name, $email, $phone, $notes, $postal_address, $custom_fields);
        }
    }
}
