# GlowRush — Master API Specification

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL
> **Base URL:** `/api/v1`
> **Auth:** `Authorization: Bearer <JWT>` (RS256, 1h TTL)
> **Error Format:** RFC 7807 Problem Details
> **Idempotency Header:** `X-Idempotency-Key: <UUID v4>` (required on all write operations)
> **Tracing Header:** `X-Correlation-ID: <UUID v4>` (set by API Gateway on every request)

---

## Standard Error Response

```json
{
  "type": "https://glowrush.com/errors/out-of-stock",
  "title": "Out of Stock",
  "status": 409,
  "detail": "Product abc-123 has no available inventory for this flash sale.",
  "instance": "/api/v1/reservations",
  "correlationId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-10-05T10:00:00.000Z"
}
```

---

## 1. Auth Endpoints

### POST /api/v1/auth/register

**Service:** Auth Service (via API Gateway)
**Auth:** None (public)
**Idempotency:** N/A

**Request:**
```json
{
  "firstName": "Priya",
  "lastName": "Sharma",
  "email": "priya@example.com",
  "password": "SecurePass123!",
  "phone": "+919876543210"
}
```

**Validation:**
- `email`: valid RFC 5322 format, max 255 chars
- `password`: min 8 chars, 1 uppercase, 1 number, 1 special char
- `firstName`, `lastName`: required, 1–100 chars
- `phone`: optional, E.164 format

**Response 201:**
```json
{
  "customerId": "uuid-v4",
  "email": "priya@example.com",
  "firstName": "Priya",
  "createdAt": "2026-10-05T10:00:00.000Z"
}
```

**Status Codes:**
| Code | Condition |
|------|-----------|
| 201 | Customer registered successfully |
| 400 | Validation error (missing fields, invalid format) |
| 409 | Email already registered |

---

### POST /api/v1/auth/login

**Service:** Auth Service
**Auth:** None (public)
**Idempotency:** N/A

**Request:**
```json
{
  "email": "priya@example.com",
  "password": "SecurePass123!"
}
```

**Response 200:**
```json
{
  "accessToken": "<JWT RS256 — 1h TTL>",
  "refreshToken": "<opaque token — 7d TTL>",
  "expiresIn": 3600,
  "tokenType": "Bearer"
}
```

**JWT Payload:**
```json
{
  "sub": "customer-uuid",
  "role": "customer",
  "email": "priya@example.com",
  "iat": 1696500000,
  "exp": 1696503600
}
```

**Status Codes:**
| Code | Condition |
|------|-----------|
| 200 | Login successful |
| 400 | Validation error |
| 401 | Invalid credentials |
| 429 | Too many login attempts (5 per minute per IP, Redis-backed) |

---

## 2. Product Endpoints

### GET /api/v1/products

**Service:** Product Service
**Auth:** Optional (anonymous browse allowed)
**Cache:** Redis, 5-minute TTL

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 20, max: 100) |
| `categoryId` | UUID | Filter by category |
| `search` | string | Text search in name/description |
| `sortBy` | string | `price_asc`, `price_desc`, `name` |

**Response 200:**
```json
{
  "data": [
    {
      "productId": "uuid",
      "name": "Vitamin C Brightening Serum",
      "slug": "vitamin-c-brightening-serum",
      "category": { "categoryId": "uuid", "name": "Serum" },
      "basePrice": 2999.00,
      "sku": "GR-SER-001",
      "imageUrl": "https://cdn.glowrush.com/products/serum-001.webp",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  }
}
```

**Status Codes:** `200`, `400` (invalid params), `503` (circuit breaker open)

---

### GET /api/v1/products/:productId

**Service:** Product Service
**Auth:** Optional
**Cache:** Redis, 5-minute TTL

**Path Parameters:**
- `productId`: UUID v4 — validated format

**Response 200:**
```json
{
  "productId": "uuid",
  "name": "Vitamin C Brightening Serum",
  "slug": "vitamin-c-brightening-serum",
  "description": "Powerful antioxidant serum with 15% Vitamin C...",
  "category": { "categoryId": "uuid", "name": "Serum" },
  "basePrice": 2999.00,
  "sku": "GR-SER-001",
  "imageUrl": "https://cdn.glowrush.com/products/serum-001.webp",
  "isActive": true,
  "createdAt": "2026-10-01T00:00:00.000Z"
}
```

**Status Codes:** `200`, `400` (invalid UUID), `404` (not found)

---

## 3. Cart Endpoints

### POST /api/v1/cart/items

**Service:** Cart Service
**Auth:** Required (Customer JWT)
**Idempotency:** `X-Idempotency-Key` required

**Request:**
```json
{
  "productId": "uuid",
  "quantity": 1
}
```

**Validation:**
- `productId`: valid UUID, product must exist and be active
- `quantity`: integer, 1 ≤ quantity ≤ 1 (flash sale: 1 per product per cart)

**Response 201:**
```json
{
  "cartItemId": "uuid",
  "cartId": "uuid",
  "productId": "uuid",
  "productName": "Vitamin C Brightening Serum",
  "quantity": 1,
  "unitPrice": 2999.00,
  "addedAt": "2026-10-05T10:00:00.000Z"
}
```

**Status Codes:** `201`, `400`, `401`, `404` (product not found), `409` (item already in cart)

---

### GET /api/v1/cart

**Service:** Cart Service
**Auth:** Required (Customer JWT)

**Response 200:**
```json
{
  "cartId": "uuid",
  "customerId": "uuid",
  "items": [
    {
      "cartItemId": "uuid",
      "productId": "uuid",
      "productName": "Vitamin C Brightening Serum",
      "quantity": 1,
      "unitPrice": 2999.00,
      "subtotal": 2999.00
    }
  ],
  "totalAmount": 2999.00,
  "updatedAt": "2026-10-05T10:00:00.000Z"
}
```

**Status Codes:** `200`, `401`

---

### DELETE /api/v1/cart/items/:cartItemId

**Service:** Cart Service
**Auth:** Required (Customer JWT)

**Response 204:** No content

**Status Codes:** `204`, `401`, `403` (not your item), `404`

---

## 4. Reservation Endpoints

### POST /api/v1/reservations

**Service:** Inventory & Reservation Service
**Auth:** Required (Customer JWT) + `X-Admission-Token` (StormShield JWT)
**Idempotency:** `X-Idempotency-Key` required (UUID v4, client-generated)

**Request:**
```json
{
  "productId": "uuid",
  "saleId": "uuid",
  "quantity": 1
}
```

**Validation:**
- `productId`: valid UUID, must match a live flash sale deal
- `saleId`: valid UUID, sale must be ACTIVE
- `quantity`: must equal 1 (flash sale policy)
- `X-Admission-Token`: valid StormShield JWT, not expired (60s TTL), not consumed

**Response 201:**
```json
{
  "reservationId": "uuid",
  "productId": "uuid",
  "customerId": "uuid",
  "quantity": 1,
  "status": "RESERVED",
  "expiresAt": "2026-10-05T10:05:00.000Z",
  "createdAt": "2026-10-05T10:00:00.000Z"
}
```

**Idempotency:** Same `X-Idempotency-Key` → 200 OK with original result (NO new gateway call, NO new reservation row)

**Status Codes:**
| Code | Condition |
|------|-----------|
| 201 | Reservation created |
| 200 | Duplicate request — original result returned |
| 400 | Validation error |
| 401 | Missing/invalid JWT |
| 403 | Missing/expired/consumed admission token |
| 409 | Out of stock (`available_quantity = 0`) |
| 422 | Quantity > 1 (flash sale policy violation) |

---

### GET /api/v1/reservations/:reservationId

**Service:** Inventory & Reservation Service
**Auth:** Required (Customer JWT — must own the reservation)

**Response 200:**
```json
{
  "reservationId": "uuid",
  "productId": "uuid",
  "customerId": "uuid",
  "quantity": 1,
  "status": "RESERVED",
  "expiresAt": "2026-10-05T10:05:00.000Z",
  "createdAt": "2026-10-05T10:00:00.000Z",
  "updatedAt": "2026-10-05T10:00:00.000Z"
}
```

**Status Codes:** `200`, `401`, `403` (not your reservation), `404`

---

### POST /api/v1/reservations/:reservationId/cancel

**Service:** Inventory & Reservation Service
**Auth:** Required (Customer JWT — must own the reservation)
**Idempotency:** Safe to call multiple times — cancelling RELEASED reservation returns 200

**Response 200:**
```json
{
  "reservationId": "uuid",
  "status": "RELEASED",
  "releasedAt": "2026-10-05T10:02:00.000Z"
}
```

**Status Codes:** `200`, `401`, `403`, `404`, `422` (cannot cancel SOLD reservation)

---

## 5. Checkout Endpoint

### POST /api/v1/checkout

**Service:** Checkout Service
**Auth:** Required (Customer JWT)
**Idempotency:** `X-Idempotency-Key` required

**Request:**
```json
{
  "reservationId": "uuid",
  "shippingAddress": {
    "fullName": "Priya Sharma",
    "line1": "42 Koramangala, 5th Block",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560034",
    "country": "IN"
  },
  "couponCode": "GLOW10",
  "paymentProvider": "razorpay"
}
```

**Checkout Service performs (synchronous):**
1. Validate JWT + reservation ownership
2. `GET /api/v1/reservations/:id` → confirm `status = RESERVED` and `expiresAt > NOW()`
3. Validate coupon (if provided)
4. Transition reservation → `PAYMENT_PENDING` (call Inventory Service)
5. Call Payment Service: `POST /api/v1/payments/initiate`
6. Return payment redirect/session to client

**Response 202:**
```json
{
  "checkoutSessionId": "uuid",
  "paymentId": "uuid",
  "paymentProvider": "razorpay",
  "paymentRedirectUrl": "https://razorpay.com/pay/session_abc123",
  "amount": 2699.10,
  "currency": "INR",
  "expiresAt": "2026-10-05T10:05:00.000Z"
}
```

**Status Codes:**
| Code | Condition |
|------|-----------|
| 202 | Checkout initiated, payment redirect provided |
| 400 | Validation error |
| 401 | Unauthorized |
| 404 | Reservation not found |
| 409 | Reservation expired or in wrong state |
| 422 | Invalid coupon |
| 503 | Payment Service unavailable |

---

## 6. Payment Endpoints

### POST /api/v1/payments

**Service:** Payment Service
**Auth:** Internal (Checkout Service → Payment Service)
**Idempotency:** `X-Idempotency-Key` required (same key as checkout)

**Request:**
```json
{
  "reservationId": "uuid",
  "customerId": "uuid",
  "amount": 2699.10,
  "currency": "INR",
  "provider": "razorpay",
  "idempotencyKey": "uuid-from-checkout"
}
```

**Idempotency Logic:**
```
1. INSERT INTO payments (idempotency_key, ...) ON CONFLICT (idempotency_key) DO NOTHING
2. If INSERT returned 0 rows → SELECT existing payment → return it (200)
3. If INSERT returned 1 row → proceed to gateway call (201)
```

**Response 201 (new payment):**
```json
{
  "paymentId": "uuid",
  "status": "INITIATED",
  "provider": "razorpay",
  "idempotencyKey": "uuid",
  "createdAt": "2026-10-05T10:00:00.000Z"
}
```

**Response 200 (duplicate — idempotent):**
```json
{
  "paymentId": "uuid",
  "status": "SUCCESS",
  "transactionReference": "rzp_live_abc123",
  "idempotencyKey": "uuid",
  "message": "Duplicate request — returning original payment result"
}
```

**Status Codes:** `201`, `200` (duplicate), `400`, `402` (gateway declined), `503` (gateway unavailable)

---

### GET /api/v1/payments/:paymentId

**Service:** Payment Service
**Auth:** Required (Customer JWT — ownership validated via `customerId` in payment → reservation → customer chain)

**Response 200:**
```json
{
  "paymentId": "uuid",
  "orderId": "uuid",
  "reservationId": "uuid",
  "transactionReference": "rzp_live_abc123",
  "amount": 2699.10,
  "currency": "INR",
  "status": "SUCCESS",
  "provider": "razorpay",
  "createdAt": "2026-10-05T10:00:00.000Z",
  "updatedAt": "2026-10-05T10:00:15.000Z"
}
```

**Status Codes:** `200`, `401`, `403`, `404`

---

### POST /api/v1/payments/webhook  *(External — Payment Gateway Callback)*

**Service:** Payment Service
**Auth:** HMAC-SHA256 signature verification (gateway secret — NOT Bearer JWT)
**Idempotency:** `transaction_reference` UNIQUE constraint prevents duplicate processing

**Request (Razorpay example):**
```json
{
  "event": "payment.captured",
  "payload": {
    "payment": {
      "entity": {
        "id": "rzp_live_abc123",
        "order_id": "order_xyz",
        "amount": 269910,
        "currency": "INR",
        "status": "captured",
        "notes": {
          "idempotencyKey": "uuid",
          "reservationId": "uuid"
        }
      }
    }
  }
}
```

**Response 200:** `{ "received": true }`

**Status Codes:** `200`, `400` (invalid signature), `422` (unknown payment)

---

## 7. Order Endpoints

### POST /api/v1/orders

**Service:** Order Service
**Auth:** Internal (event-driven — triggered by `PaymentConfirmed` event, NOT direct HTTP)
**Note:** This endpoint exists for admin/reconciliation use. Normal order creation is async via RabbitMQ.
**Idempotency:** `X-Idempotency-Key` required; `reservation_id` UNIQUE constraint prevents duplicate orders

**Request:**
```json
{
  "customerId": "uuid",
  "reservationId": "uuid",
  "paymentId": "uuid",
  "items": [
    { "productId": "uuid", "quantity": 1, "unitPrice": 2999.00 }
  ],
  "totalAmount": 2999.00,
  "shippingAddress": { ... }
}
```

**Response 201:**
```json
{
  "orderId": "uuid",
  "customerId": "uuid",
  "reservationId": "uuid",
  "paymentId": "uuid",
  "status": "CREATED",
  "totalAmount": 2999.00,
  "createdAt": "2026-10-05T10:00:30.000Z"
}
```

**Status Codes:** `201`, `200` (duplicate idempotent), `400`, `401`, `409` (order already exists for this reservation)

---

### GET /api/v1/orders/:orderId

**Service:** Order Service
**Auth:** Required (Customer JWT — must own the order)

**Response 200:**
```json
{
  "orderId": "uuid",
  "customerId": "uuid",
  "status": "CONFIRMED",
  "totalAmount": 2999.00,
  "discountAmount": 0,
  "items": [
    {
      "orderItemId": "uuid",
      "productId": "uuid",
      "productName": "Vitamin C Brightening Serum",
      "quantity": 1,
      "unitPrice": 2999.00,
      "subtotal": 2999.00
    }
  ],
  "shippingAddress": {
    "fullName": "Priya Sharma",
    "line1": "42 Koramangala, 5th Block",
    "city": "Bangalore",
    "state": "Karnataka",
    "pincode": "560034",
    "country": "IN"
  },
  "payment": {
    "paymentId": "uuid",
    "status": "SUCCESS",
    "provider": "razorpay",
    "transactionReference": "rzp_live_abc123"
  },
  "createdAt": "2026-10-05T10:00:30.000Z",
  "updatedAt": "2026-10-05T10:01:00.000Z"
}
```

**Status Codes:** `200`, `401`, `403`, `404`

---

## 8. Shipment Endpoint

### GET /api/v1/shipments/:shipmentId

**Service:** Shipment Service
**Auth:** Required (Customer JWT — validated via order ownership chain)

**Response 200:**
```json
{
  "shipmentId": "uuid",
  "orderId": "uuid",
  "trackingNumber": "BLUEDART123456789",
  "carrier": "BlueDart",
  "status": "IN_TRANSIT",
  "shippingAddress": { ... },
  "estimatedDelivery": "2026-10-08T18:00:00.000Z",
  "dispatchedAt": "2026-10-06T09:00:00.000Z",
  "deliveredAt": null,
  "createdAt": "2026-10-05T15:00:00.000Z",
  "updatedAt": "2026-10-06T09:05:00.000Z"
}
```

**Status Codes:** `200`, `401`, `403`, `404`

---

## 9. Rate Limiting

All endpoints enforce rate limiting via Redis token bucket, applied at API Gateway:

| Endpoint Category | Limit | Window |
|------------------|-------|--------|
| `POST /auth/login` | 5 | 1 minute per IP |
| `POST /auth/register` | 3 | 1 minute per IP |
| `GET /products*` | 200 | 1 minute per customer |
| `POST /reservations` | 1 | 5 minutes per customer (flash sale policy) |
| `POST /checkout` | 3 | 1 minute per customer |
| `POST /payments*` | 5 | 1 minute per customer |
| Global authenticated | 100 | 1 minute per customer |
| Global anonymous | 30 | 1 minute per IP |

**Rate limit response headers on every response:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1696500060
Retry-After: 30   (only on 429)
```
