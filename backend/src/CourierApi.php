<?php

declare(strict_types=1);

namespace App;

use RuntimeException;

final class CourierApi extends BaseService
{
    private OperationsApi $operations;

    public function __construct(Database $database, Auth $auth, Config $config, OperationsApi $operations)
    {
        parent::__construct($database, $auth, $config);
        $this->operations = $operations;
    }

    /**
     * @return array<string, mixed>
     */
    private function courierSystemActor(): array
    {
        $actor = $this->database->fetchOne(
            "SELECT id, name, phone, role
             FROM users
             WHERE deleted_at IS NULL AND role IN ('Admin', 'Developer')
             ORDER BY CASE WHEN role = 'Developer' THEN 0 ELSE 1 END, created_at ASC
             LIMIT 1"
        );

        if ($actor === null) {
            throw new RuntimeException('No admin-access user is available for courier sync.');
        }

        return $actor;
    }

    /**
     * @param array<string, mixed> $params
     * @return array<string, mixed>|null
     */
    private function updateOrderAsCourierSystem(array $params): ?array
    {
        $actor = $this->courierSystemActor();
        $token = $this->auth->issueToken($actor);
        $previousAuthorization = $_SERVER['HTTP_AUTHORIZATION'] ?? null;
        $previousAuthorizationAlt = $_SERVER['Authorization'] ?? null;
        $headerValue = 'Bearer ' . $token;

        $_SERVER['HTTP_AUTHORIZATION'] = $headerValue;
        $_SERVER['Authorization'] = $headerValue;

        try {
            return $this->operations->updateOrder($params);
        } finally {
            if ($previousAuthorization !== null) {
                $_SERVER['HTTP_AUTHORIZATION'] = $previousAuthorization;
            } else {
                unset($_SERVER['HTTP_AUTHORIZATION']);
            }

            if ($previousAuthorizationAlt !== null) {
                $_SERVER['Authorization'] = $previousAuthorizationAlt;
            } else {
                unset($_SERVER['Authorization']);
            }
        }
    }

    /**
     * @return array{status:int, body:string, json:mixed}
     */
    private function request(string $method, string $url, array $headers = [], ?array $jsonBody = null): array
    {
        $body = $jsonBody !== null ? json_encode($jsonBody, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null;

        if (function_exists('curl_init')) {
            $handle = curl_init($url);
            if ($handle === false) {
                throw new RuntimeException('Failed to initialize HTTP request.');
            }

            $headerList = [];
            foreach ($headers as $name => $value) {
                $headerList[] = $name . ': ' . $value;
            }
            if ($body !== null) {
                $headerList[] = 'Content-Type: application/json';
            }

            curl_setopt_array($handle, [
                CURLOPT_CUSTOMREQUEST => strtoupper($method),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_HTTPHEADER => $headerList,
                CURLOPT_TIMEOUT => 30,
                CURLOPT_CONNECTTIMEOUT => 15,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2,
            ]);

            if ($body !== null) {
                curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
            }

            $responseBody = curl_exec($handle);
            if ($responseBody === false) {
                $message = curl_error($handle) ?: 'Unknown cURL error';
                curl_close($handle);
                throw new RuntimeException($message);
            }

            $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
            curl_close($handle);
        } else {
            $headerList = [];
            foreach ($headers as $name => $value) {
                $headerList[] = $name . ': ' . $value;
            }
            if ($body !== null) {
                $headerList[] = 'Content-Type: application/json';
            }

            $context = stream_context_create([
                'http' => [
                    'method' => strtoupper($method),
                    'header' => implode("\r\n", $headerList),
                    'content' => $body ?? '',
                    'timeout' => 30,
                    'ignore_errors' => true,
                ],
            ]);

            $responseBody = file_get_contents($url, false, $context);
            if ($responseBody === false) {
                throw new RuntimeException('HTTP request failed.');
            }

            $status = 200;
            foreach (($http_response_header ?? []) as $headerLine) {
                if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $headerLine, $matches) === 1) {
                    $status = (int) $matches[1];
                    break;
                }
            }
        }

        $decoded = json_decode($responseBody, true);
        return [
            'status' => $status,
            'body' => $responseBody,
            'json' => $decoded,
        ];
    }

    private function carryBeeHeaders(array $params): array
    {
        return [
            'Client-ID' => trim((string) ($params['clientId'] ?? '')),
            'Client-Secret' => trim((string) ($params['clientSecret'] ?? '')),
            'Client-Context' => trim((string) ($params['clientContext'] ?? '')),
        ];
    }

    private function trimBaseUrl(array $params, string $field = 'baseUrl'): string
    {
        return rtrim(trim((string) ($params[$field] ?? '')), '/');
    }

    /**
     * @return array<int, array{id:string, name:string}>
     */
    private function carryBeeCollectionResponse(array $response, string $collectionKey): array
    {
        if ($response['status'] < 200 || $response['status'] >= 300) {
            return [];
        }

        $payload = $response['json'];
        $collection = [];
        if (is_array($payload['data'][$collectionKey] ?? null)) {
            $collection = $payload['data'][$collectionKey];
        } elseif (is_array($payload[$collectionKey] ?? null)) {
            $collection = $payload[$collectionKey];
        } elseif (is_array($payload)) {
            $collection = $payload;
        }

        $mapped = [];
        foreach ($collection as $row) {
            if (!is_array($row)) {
                continue;
            }
            $mapped[] = [
                'id' => (string) ($row['id'] ?? ''),
                'name' => (string) ($row['name'] ?? ''),
            ];
        }

        return $mapped;
    }

    public function fetchCarryBeeStores(array $params): array
    {
        if ($this->trimBaseUrl($params) === '' || trim((string) ($params['clientId'] ?? '')) === '' || trim((string) ($params['clientSecret'] ?? '')) === '' || trim((string) ($params['clientContext'] ?? '')) === '') {
            return [];
        }

        $response = $this->request(
            'GET',
            $this->trimBaseUrl($params) . '/api/v2/stores',
            $this->carryBeeHeaders($params)
        );

        return $this->carryBeeCollectionResponse($response, 'stores');
    }

    public function fetchCarryBeeCities(array $params): array
    {
        if ($this->trimBaseUrl($params) === '' || trim((string) ($params['clientId'] ?? '')) === '' || trim((string) ($params['clientSecret'] ?? '')) === '' || trim((string) ($params['clientContext'] ?? '')) === '') {
            return [];
        }

        $response = $this->request(
            'GET',
            $this->trimBaseUrl($params) . '/api/v2/cities',
            $this->carryBeeHeaders($params)
        );

        return $this->carryBeeCollectionResponse($response, 'cities');
    }

    public function fetchCarryBeeZones(array $params): array
    {
        $cityId = trim((string) ($params['cityId'] ?? ''));
        if ($this->trimBaseUrl($params) === '' || $cityId === '') {
            return [];
        }

        $response = $this->request(
            'GET',
            $this->trimBaseUrl($params) . '/api/v2/cities/' . rawurlencode($cityId) . '/zones',
            $this->carryBeeHeaders($params)
        );

        return $this->carryBeeCollectionResponse($response, 'zones');
    }

    public function fetchCarryBeeAreas(array $params): array
    {
        $cityId = trim((string) ($params['cityId'] ?? ''));
        $zoneId = trim((string) ($params['zoneId'] ?? ''));
        if ($this->trimBaseUrl($params) === '' || $cityId === '' || $zoneId === '') {
            return [];
        }

        $response = $this->request(
            'GET',
            $this->trimBaseUrl($params) . '/api/v2/cities/' . rawurlencode($cityId) . '/zones/' . rawurlencode($zoneId) . '/areas',
            $this->carryBeeHeaders($params)
        );

        return $this->carryBeeCollectionResponse($response, 'areas');
    }

    public function submitCarryBeeOrder(array $params): array
    {
        $baseUrl = $this->trimBaseUrl($params);
        if (
            $baseUrl === '' ||
            trim((string) ($params['clientId'] ?? '')) === '' ||
            trim((string) ($params['clientSecret'] ?? '')) === '' ||
            trim((string) ($params['clientContext'] ?? '')) === '' ||
            trim((string) ($params['storeId'] ?? '')) === '' ||
            trim((string) ($params['recipientPhone'] ?? '')) === '' ||
            trim((string) ($params['recipientName'] ?? '')) === '' ||
            trim((string) ($params['recipientAddress'] ?? '')) === '' ||
            trim((string) ($params['cityId'] ?? '')) === '' ||
            trim((string) ($params['zoneId'] ?? '')) === ''
        ) {
            return ['error' => 'Missing required parameters'];
        }

        $payload = [
            'store_id' => trim((string) ($params['storeId'] ?? '')),
            'delivery_type' => (int) ($params['deliveryType'] ?? 0),
            'product_type' => (int) ($params['productType'] ?? 0),
            'recipient_phone' => trim((string) ($params['recipientPhone'] ?? '')),
            'recipient_name' => trim((string) ($params['recipientName'] ?? '')),
            'recipient_address' => trim((string) ($params['recipientAddress'] ?? '')),
            'city_id' => trim((string) ($params['cityId'] ?? '')),
            'zone_id' => trim((string) ($params['zoneId'] ?? '')),
            'item_weight' => (float) ($params['itemWeight'] ?? 0),
            'collectable_amount' => (float) ($params['collectableAmount'] ?? 0),
        ];
        if (!empty($params['areaId'])) {
            $payload['area_id'] = trim((string) $params['areaId']);
        }

        $response = $this->request(
            'POST',
            $baseUrl . '/api/v2/orders',
            $this->carryBeeHeaders($params),
            $payload
        );

        if ($response['status'] < 200 || $response['status'] >= 300) {
            return ['error' => 'HTTP ' . $response['status']];
        }

        $payload = is_array($response['json']) ? $response['json'] : [];
        if (!empty($payload['error'])) {
            return ['error' => (string) $payload['error']];
        }

        return $payload;
    }

    public function fetchCarryBeeOrderDetails(array $params): array
    {
        $consignmentId = trim((string) ($params['consignmentId'] ?? ''));
        if ($this->trimBaseUrl($params) === '' || $consignmentId === '') {
            return ['error' => 'Missing required parameters'];
        }

        $response = $this->request(
            'GET',
            $this->trimBaseUrl($params) . '/api/v2/orders/' . rawurlencode($consignmentId) . '/details',
            $this->carryBeeHeaders($params)
        );

        if ($response['status'] < 200 || $response['status'] >= 300) {
            return ['error' => 'HTTP ' . $response['status']];
        }

        return ['data' => $response['json']];
    }

    private function classifyCarryBeeStatus(array $payload): array
    {
        $rawStatus = '';
        foreach ([
            $payload['data']['data']['transfer_status'] ?? null,
            $payload['data']['transfer_status'] ?? null,
            $payload['transfer_status'] ?? null,
        ] as $candidate) {
            if ($candidate !== null && trim((string) $candidate) !== '') {
                $rawStatus = trim((string) $candidate);
                break;
            }
        }

        $normalized = strtolower($rawStatus);
        $pickedOrBeyond = [
            'at the sorting hub',
            'at central warehouse',
            'at the destination hub',
            'assigned for delivery',
            'out for delivery',
            'in transit',
            'on the way to central warehouse',
            'on the way to last mile hub',
            'received at last mile hub',
            'delivered',
            'exchange',
            'partial delivery',
            'return',
            'paid return',
        ];

        return [
            'rawStatus' => $rawStatus,
            'normalizedStatus' => $normalized,
            'isPickedOrBeyond' => in_array($normalized, $pickedOrBeyond, true),
        ];
    }

    public function syncCarryBeeTransferStatuses(array $params = []): array
    {
        $settings = $this->database->fetchOne('SELECT * FROM courier_settings LIMIT 1');
        $baseUrl = rtrim(trim((string) ($settings['carrybee_base_url'] ?? '')), '/');
        $clientId = trim((string) ($settings['carrybee_client_id'] ?? ''));
        $clientSecret = trim((string) ($settings['carrybee_client_secret'] ?? ''));
        $clientContext = trim((string) ($settings['carrybee_client_context'] ?? ''));
        if ($baseUrl === '' || $clientId === '' || $clientSecret === '' || $clientContext === '') {
            return ['checked' => 0, 'updated' => 0, 'hasMore' => false, 'nextCursorCreatedAt' => null, 'statusCounts' => [], 'errors' => [], 'updatedOrders' => []];
        }

        $mode = ($params['mode'] ?? '') === 'backfill' ? 'backfill' : 'incremental';
        $limit = max(1, min(500, (int) ($params['limit'] ?? ($mode === 'backfill' ? 100 : 250))));
        $sql = "SELECT id, order_number, status, history, items, carrybee_consignment_id, created_at
                FROM orders
                WHERE deleted_at IS NULL
                  AND carrybee_consignment_id IS NOT NULL
                  AND carrybee_consignment_id <> ''
                  AND status IN ('On Hold', 'Processing')";
        $bindings = [];
        if (!empty($params['orderId'])) {
            $sql .= ' AND id = :id';
            $bindings[':id'] = trim((string) $params['orderId']);
        } elseif ($mode === 'backfill' && !empty($params['cursorCreatedAt'])) {
            $sql .= ' AND created_at > :cursor';
            $bindings[':cursor'] = $this->normalizeDateTimeInput((string) $params['cursorCreatedAt']);
        }
        $sql .= $mode === 'backfill' ? ' ORDER BY created_at ASC' : ' ORDER BY created_at DESC';
        $sql .= ' LIMIT ' . $limit;

        $rows = $this->database->fetchAll($sql, $bindings);
        $statusCounts = [];
        $errors = [];
        $updatedOrders = [];
        $updated = 0;

        foreach ($rows as $row) {
            try {
                $details = $this->fetchCarryBeeOrderDetails([
                    'baseUrl' => $baseUrl,
                    'clientId' => $clientId,
                    'clientSecret' => $clientSecret,
                    'clientContext' => $clientContext,
                    'consignmentId' => (string) ($row['carrybee_consignment_id'] ?? ''),
                ]);
                if (!empty($details['error']) || !is_array($details['data'] ?? null)) {
                    $errors[] = ['orderId' => $row['id'], 'orderNumber' => $row['order_number'], 'error' => $details['error'] ?? 'Unknown error'];
                    continue;
                }

                $statusInfo = $this->classifyCarryBeeStatus($details['data']);
                $statusKey = (string) ($statusInfo['normalizedStatus'] ?? 'unknown');
                $statusCounts[$statusKey] = ($statusCounts[$statusKey] ?? 0) + 1;

                if (empty($statusInfo['rawStatus']) || empty($statusInfo['isPickedOrBeyond'])) {
                    continue;
                }

                $history = is_array(json_decode((string) ($row['history'] ?? ''), true)) ? json_decode((string) $row['history'], true) : [];
                $history['picked'] = $history['picked'] ?? ('Marked picked automatically from CarryBee transfer status "' . $statusInfo['rawStatus'] . '" on ' . gmdate('c'));

                $this->updateOrderAsCourierSystem([
                    'id' => (string) $row['id'],
                    'updates' => [
                        'status' => 'Picked',
                        'history' => $history,
                    ],
                ]);
                $updated += 1;
                $updatedOrders[] = [
                    'orderId' => $row['id'],
                    'orderNumber' => $row['order_number'],
                    'rawStatus' => $statusInfo['rawStatus'],
                ];
            } catch (\Throwable $exception) {
                $errors[] = [
                    'orderId' => $row['id'],
                    'orderNumber' => $row['order_number'],
                    'error' => $exception->getMessage(),
                ];
            }
        }

        $lastRow = $rows === [] ? null : $rows[count($rows) - 1];
        return [
            'checked' => count($rows),
            'updated' => $updated,
            'hasMore' => empty($params['orderId']) && count($rows) === $limit,
            'nextCursorCreatedAt' => $lastRow['created_at'] ?? null,
            'statusCounts' => $statusCounts,
            'errors' => $errors,
            'updatedOrders' => $updatedOrders,
        ];
    }

    public function submitSteadfastOrder(array $params): array
    {
        $baseUrl = $this->trimBaseUrl($params);
        if ($baseUrl === '' || trim((string) ($params['apiKey'] ?? '')) === '' || trim((string) ($params['secretKey'] ?? '')) === '' || trim((string) ($params['invoice'] ?? '')) === '') {
            return ['error' => 'Missing required parameters'];
        }

        $response = $this->request(
            'POST',
            $baseUrl . '/create_order',
            [
                'Api-Key' => trim((string) ($params['apiKey'] ?? '')),
                'Secret-Key' => trim((string) ($params['secretKey'] ?? '')),
            ],
            [
                'invoice' => trim((string) ($params['invoice'] ?? '')),
                'recipient_name' => trim((string) ($params['recipientName'] ?? '')),
                'recipient_phone' => trim((string) ($params['recipientPhone'] ?? '')),
                'recipient_address' => trim((string) ($params['recipientAddress'] ?? '')),
                'cod_amount' => (float) ($params['codAmount'] ?? 0),
            ]
        );

        if ($response['status'] < 200 || $response['status'] >= 300) {
            return ['error' => 'HTTP ' . $response['status']];
        }

        return is_array($response['json']) ? $response['json'] : ['error' => 'Invalid response'];
    }

    public function fetchSteadfastStatusByTrackingCode(array $params): array
    {
        $baseUrl = $this->trimBaseUrl($params);
        $trackingCode = trim((string) ($params['trackingCode'] ?? ''));
        if ($baseUrl === '' || trim((string) ($params['apiKey'] ?? '')) === '' || trim((string) ($params['secretKey'] ?? '')) === '' || $trackingCode === '') {
            return ['error' => 'Missing required parameters'];
        }

        $response = $this->request(
            'GET',
            $baseUrl . '/status_by_trackingcode/' . rawurlencode($trackingCode),
            [
                'Api-Key' => trim((string) ($params['apiKey'] ?? '')),
                'Secret-Key' => trim((string) ($params['secretKey'] ?? '')),
            ]
        );

        if ($response['status'] < 200 || $response['status'] >= 300) {
            return ['error' => 'HTTP ' . $response['status']];
        }

        return ['data' => $response['json']];
    }

    public function submitPaperflyOrder(array $params): array
    {
        $baseUrl = $this->trimBaseUrl($params);
        $username = trim((string) ($params['username'] ?? ''));
        $password = trim((string) ($params['password'] ?? ''));
        $paperflyKey = trim((string) ($params['paperflyKey'] ?? ''));
        if ($baseUrl === '' || $username === '' || $password === '' || $paperflyKey === '') {
            return ['error' => 'Missing required parameters'];
        }

        $response = $this->request(
            'POST',
            $baseUrl . '/merchant/api/service/new_order_v2.php',
            [
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password),
                'paperflykey' => $paperflyKey,
            ],
            [
                'merchantOrderReference' => trim((string) ($params['merchantOrderReference'] ?? '')),
                'storeName' => trim((string) ($params['storeName'] ?? '')),
                'productBrief' => trim((string) ($params['productBrief'] ?? '')),
                'packagePrice' => (string) ($params['packagePrice'] ?? ''),
                'max_weight' => (string) ($params['maxWeightKg'] ?? ''),
                'customerName' => trim((string) ($params['customerName'] ?? '')),
                'customerAddress' => trim((string) ($params['customerAddress'] ?? '')),
                'customerPhone' => trim((string) ($params['customerPhone'] ?? '')),
            ]
        );

        if ($response['status'] < 200 || $response['status'] >= 300) {
            return ['error' => 'HTTP ' . $response['status']];
        }

        return is_array($response['json']) ? $response['json'] : ['error' => 'Invalid response'];
    }

    public function fetchPaperflyOrderTracking(array $params): array
    {
        $baseUrl = $this->trimBaseUrl($params);
        $username = trim((string) ($params['username'] ?? ''));
        $password = trim((string) ($params['password'] ?? ''));
        $referenceNumber = trim((string) ($params['referenceNumber'] ?? ''));
        if ($baseUrl === '' || $username === '' || $password === '' || $referenceNumber === '') {
            return ['error' => 'Missing required parameters'];
        }

        $response = $this->request(
            'POST',
            $baseUrl . '/API-Order-Tracking',
            [
                'Authorization' => 'Basic ' . base64_encode($username . ':' . $password),
            ],
            ['ReferenceNumber' => $referenceNumber]
        );

        if ($response['status'] < 200 || $response['status'] >= 300) {
            return ['error' => 'HTTP ' . $response['status']];
        }

        return ['data' => $response['json']];
    }

    private function extractPaperflyTrackingStatusEntry(array $payload): ?array
    {
        foreach ([
            $payload['success']['trackingStatus'] ?? null,
            $payload['trackingStatus'] ?? null,
            $payload['data']['trackingStatus'] ?? null,
        ] as $candidate) {
            if (is_array($candidate) && isset($candidate[0]) && is_array($candidate[0])) {
                return $candidate[0];
            }
        }

        return null;
    }

    private function classifySteadfastDeliveryStatus(array $payload): array
    {
        $rawStatus = '';
        foreach ([
            $payload['data']['delivery_status'] ?? null,
            $payload['delivery_status'] ?? null,
        ] as $candidate) {
            if ($candidate !== null && trim((string) $candidate) !== '') {
                $rawStatus = trim((string) $candidate);
                break;
            }
        }

        $normalized = strtolower($rawStatus);
        $nonPickedStatuses = ['pending', 'in_review', 'cancelled'];

        return [
            'rawStatus' => $rawStatus,
            'normalizedStatus' => $normalized,
            'isPickedOrBeyond' => $rawStatus !== '' && !in_array($normalized, $nonPickedStatuses, true),
        ];
    }

    public function syncPaperflyOrderStatuses(array $params = []): array
    {
        $settings = $this->database->fetchOne('SELECT * FROM courier_settings LIMIT 1');
        $baseUrl = rtrim(trim((string) ($settings['paperfly_base_url'] ?? '')), '/');
        $username = trim((string) ($settings['paperfly_username'] ?? ''));
        $password = trim((string) ($settings['paperfly_password'] ?? ''));
        if ($baseUrl === '' || $username === '' || $password === '') {
            return ['checked' => 0, 'updated' => 0];
        }

        $rows = $this->database->fetchAll(
            "SELECT id, status, history, paperfly_tracking_number
             FROM orders
             WHERE deleted_at IS NULL
               AND paperfly_tracking_number IS NOT NULL
               AND paperfly_tracking_number <> ''
               AND status IN ('On Hold', 'Processing')"
        );

        $checked = 0;
        $updated = 0;
        foreach ($rows as $row) {
            $trackingNumber = trim((string) ($row['paperfly_tracking_number'] ?? ''));
            if ($trackingNumber === '') {
                continue;
            }
            $checked += 1;

            $details = $this->fetchPaperflyOrderTracking([
                'baseUrl' => $baseUrl,
                'username' => $username,
                'password' => $password,
                'referenceNumber' => $trackingNumber,
            ]);

            if (!empty($details['error']) || !is_array($details['data'] ?? null)) {
                continue;
            }

            $entry = $this->extractPaperflyTrackingStatusEntry($details['data']);
            if (!is_array($entry) || trim((string) ($entry['Pick'] ?? '')) === '') {
                continue;
            }

            $history = is_array(json_decode((string) ($row['history'] ?? ''), true)) ? json_decode((string) $row['history'], true) : [];
            $history['picked'] = 'Marked picked automatically from Paperfly tracking status on ' . gmdate('c');
            $this->updateOrderAsCourierSystem([
                'id' => (string) $row['id'],
                'updates' => [
                    'status' => 'Picked',
                    'history' => $history,
                ],
            ]);
            $updated += 1;
        }

        return ['checked' => $checked, 'updated' => $updated];
    }

    public function syncSteadfastDeliveryStatuses(array $params = []): array
    {
        $settings = $this->database->fetchOne('SELECT * FROM courier_settings LIMIT 1');
        $baseUrl = rtrim(trim((string) ($settings['steadfast_base_url'] ?? '')), '/');
        $apiKey = trim((string) ($settings['steadfast_api_key'] ?? ''));
        $secretKey = trim((string) ($settings['steadfast_secret_key'] ?? ''));
        if ($baseUrl === '' || $apiKey === '' || $secretKey === '') {
            return ['checked' => 0, 'updated' => 0];
        }

        $rows = $this->database->fetchAll(
            "SELECT id, status, history, steadfast_consignment_id
             FROM orders
             WHERE deleted_at IS NULL
               AND steadfast_consignment_id IS NOT NULL
               AND steadfast_consignment_id <> ''
               AND status IN ('On Hold', 'Processing')"
        );

        $checked = 0;
        $updated = 0;
        foreach ($rows as $row) {
            $trackingCode = trim((string) ($row['steadfast_consignment_id'] ?? ''));
            if ($trackingCode === '') {
                continue;
            }
            $checked += 1;

            $details = $this->fetchSteadfastStatusByTrackingCode([
                'baseUrl' => $baseUrl,
                'apiKey' => $apiKey,
                'secretKey' => $secretKey,
                'trackingCode' => $trackingCode,
            ]);
            if (!empty($details['error']) || !is_array($details['data'] ?? null)) {
                continue;
            }

            $statusInfo = $this->classifySteadfastDeliveryStatus($details['data']);
            if (empty($statusInfo['rawStatus']) || empty($statusInfo['isPickedOrBeyond'])) {
                continue;
            }

            $history = is_array(json_decode((string) ($row['history'] ?? ''), true)) ? json_decode((string) $row['history'], true) : [];
            $history['picked'] = 'Marked picked automatically from Steadfast delivery status "' . $statusInfo['rawStatus'] . '" on ' . gmdate('c');
            $this->updateOrderAsCourierSystem([
                'id' => (string) $row['id'],
                'updates' => [
                    'status' => 'Picked',
                    'history' => $history,
                ],
            ]);
            $updated += 1;
        }

        return ['checked' => $checked, 'updated' => $updated];
    }
}
