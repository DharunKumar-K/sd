# GlowRush — API Contract (High-Level)

> **Version:** 1.0 | **Status:** FROZEN | **Owner:** Student 1  
> **Note:** Detailed request/response schemas are owned by Student 3. This document defines the contract boundaries.

---

## 1. API Conventions

| Convention           | Standard                                                  |
| -------------------- | --------------------------------------------------------- |
| Base URL             | `/api/v1`                                                 |
| Protocol             | HTTPS (TLS 1.3)                                           |
| Content Type         | `application/json`                                        |
| Authentication       | `Authorization: Bearer <JWT>`                             |
| Correlation ID       | `X-Correlation-ID: <UUID v4>` (set by API Gateway)       |
| Admission Token      | `X-Admission-Token: <JWT>` (required for flash sale ops)  |
| Idempotency Key      | `X-Idempotency-Key: <UUID v4>` (required for write ops)  |
| Pagination           | `?page=1&limit=20`                                        |
| Error Format         | RFC 7807 Problem Details                                  |
| Versioning           | URL path versioning (`/api/v1/`)                          |
| Date Format          | ISO 8601 (`2026-10-05T10:00:00Z`)                         |

---

## 2. Standard Error Response

```json
{
  "type": "https://glowrush.com/errors/out-of-stock",
  "title": "Out of Stock",
  "status": 409,
  "detail": "Product <product_id> has no available inventory",
  "instance": "/api/v1/inventory/reserve",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-10-05T10:00:00Z"
}
```

---

## 3. Standard HTTP Status Codes

| Code | Usage                                          |
| ---- | ---------------------------------------------- |
| 200  | Success (GET, PUT)                             |
| 201  | Created (POST)                                 |
| 202  | Accepted (async processing initiated)          |
| 204  | No Content (DELETE)                            |
| 400  | Bad Request (validation error)                 |
| 401  | Unauthorized (missing/invalid JWT)             |
| 403  | Forbidden (insufficient permissions)           |
| 404  | Not Found                                      |
| 409  | Conflict (out of stock, duplicate)             |
| 422  | Unprocessable Entity (business rule violation) |
| 429  | Too Many Requests (rate limited)               |
| 500  | Internal Server Error                          |
| 502  | Bad Gateway (downstream service unavailable)   |
| 503  | Service Unavailable (circuit breaker open)     |

---

## 4. Service API Summary

### 4.1 Product Service

| Method | Path                     | Auth     | Description            |
| ------ | ------------------------ | -------- | ---------------------- |
| GET    | `/api/v1/products`       | Optional | List/search products   |
| GET    | `/api/v1/products/:id`   | Optional | Product detail         |
| POST   | `/api/v1/products`       | Admin    | Create product         |
| PUT    | `/api/v1/products/:id`   | Admin    | Update product         |
| DELETE | `/api/v1/products/:id`   | Admin    | Delete product         |

### 4.2 Cart Service

| Method | Path                          | Auth     | Description         |
| ------ | ----------------------------- | -------- | ------------------- |
| GET    | `/api/v1/cart`                | Customer | View cart           |
| POST   | `/api/v1/cart/items`          | Customer | Add item            |
| PUT    | `/api/v1/cart/items/:id`      | Customer | Update quantity     |
| DELETE | `/api/v1/cart/items/:id`      | Customer | Remove item         |
| DELETE | `/api/v1/cart`                | Customer | Clear cart          |

### 4.3 Sale Service

| Method | Path                          | Auth     | Description            |
| ------ | ----------------------------- | -------- | ---------------------- |
| GET    | `/api/v1/sales/active`        | Public   | Current flash sale     |
| GET    | `/api/v1/sales/:id`           | Public   | Sale detail            |
| POST   | `/api/v1/sales`               | Admin    | Create flash sale      |
| PUT    | `/api/v1/sales/:id`           | Admin    | Update sale            |

### 4.4 StormShield

| Method | Path                              | Auth     | Description             |
| ------ | --------------------------------- | -------- | ----------------------- |
| POST   | `/api/v1/stormshield/enter`       | Customer | Join waiting room       |
| GET    | `/api/v1/stormshield/status`      | Customer | Queue position & ETA    |
| POST   | `/api/v1/stormshield/validate`    | Internal | Validate admission token|

### 4.5 Inventory & Reservation Service

| Method | Path                                      | Auth     | Description               |
| ------ | ----------------------------------------- | -------- | ------------------------- |
| GET    | `/api/v1/inventory/:productId`            | Internal | Check availability        |
| POST   | `/api/v1/inventory/reserve`               | Internal | Create reservation        |
| POST   | `/api/v1/inventory/release/:reservationId`| Internal | Release reservation       |
| POST   | `/api/v1/inventory/confirm/:reservationId`| Internal | Confirm (mark as sold)    |

### 4.6 Checkout Service

| Method | Path                              | Auth     | Description               |
| ------ | --------------------------------- | -------- | ------------------------- |
| POST   | `/api/v1/checkout/initiate`       | Customer | Start checkout            |
| POST   | `/api/v1/checkout/confirm`        | Customer | Confirm & pay             |
| GET    | `/api/v1/checkout/:sessionId`     | Customer | Checkout status           |

### 4.7 Payment Service

| Method | Path                              | Auth     | Description               |
| ------ | --------------------------------- | -------- | ------------------------- |
| POST   | `/api/v1/payments/initiate`       | Internal | Create payment            |
| GET    | `/api/v1/payments/:id`            | Customer | Payment status            |
| POST   | `/api/v1/payments/webhook`        | External | Gateway callback          |

### 4.8 Order Service

| Method | Path                              | Auth     | Description               |
| ------ | --------------------------------- | -------- | ------------------------- |
| GET    | `/api/v1/orders`                  | Customer | List customer orders      |
| GET    | `/api/v1/orders/:id`              | Customer | Order detail              |
| POST   | `/api/v1/orders`                  | Internal | Create order (event-driven)|

### 4.9 Fulfilment Service

| Method | Path                              | Auth     | Description               |
| ------ | --------------------------------- | -------- | ------------------------- |
| GET    | `/api/v1/fulfilment/:orderId`     | Internal | Fulfilment status         |
| POST   | `/api/v1/fulfilment/process`      | Internal | Start fulfilment          |

### 4.10 Shipment Service

| Method | Path                              | Auth     | Description               |
| ------ | --------------------------------- | -------- | ------------------------- |
| GET    | `/api/v1/shipments/:id`           | Customer | Tracking info             |
| POST   | `/api/v1/shipments/webhook`       | External | Carrier callback          |

### 4.11 Notification Service

| Method | Path                              | Auth     | Description               |
| ------ | --------------------------------- | -------- | ------------------------- |
| POST   | `/api/v1/notifications/send`      | Internal | Send notification         |
| GET    | `/api/v1/notifications`           | Customer | Notification history      |

---

## 5. Rate Limiting Headers

All responses include:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696500060
Retry-After: 30          (only on 429 responses)
```

---

## 6. Authentication Flow

```
1. Customer → POST /api/v1/auth/login → JWT (access_token + refresh_token)
2. Customer → GET /api/v1/products (Authorization: Bearer <access_token>)
3. API Gateway validates JWT signature, expiry, claims
4. If expired → 401 → Customer uses refresh_token
```

JWT Payload:
```json
{
  "sub": "customer_uuid",
  "role": "customer",
  "iat": 1696500000,
  "exp": 1696503600
}
```
