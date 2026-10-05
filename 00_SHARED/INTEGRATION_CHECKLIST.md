# GlowRush — Integration Checklist

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL
> **Purpose:** Verify that all contracts between Student 1, Student 2, and Student 3 are consistent.
> **Last Verified Against:** ARCHITECTURE_CONTRACT v1.0, SERVICE_CATALOG v1.0, INVENTORY_CONTRACT v1.0, NAMING_RULES v1.0, EVENT_CONTRACT v1.0, DOMAIN_STATES v1.0

---

## 1. Service Names

| Service | Architecture Contract | Student 3 Docs | Match? |
|---------|-----------------------|----------------|--------|
| API Gateway | API Gateway | API Gateway | ✅ |
| StormShield | StormShield | StormShield | ✅ |
| Product Service | Product Service | Product Service | ✅ |
| Cart Service | Cart Service | Cart Service | ✅ |
| Sale Service | Sale Service | Sale Service | ✅ |
| Inventory & Reservation Service | Inventory & Reservation Service | Inventory & Reservation Service | ✅ |
| Checkout Service | Checkout Service | Checkout Service | ✅ |
| Payment Service | Payment Service | Payment Service | ✅ |
| Order Service | Order Service | Order Service | ✅ |
| Fulfilment Service | Fulfilment Service | Fulfilment Service | ✅ |
| Shipment Service | Shipment Service | Shipment Service | ✅ |
| Notification Service | Notification Service | Notification Service | ✅ |

---

## 2. Entity Names

| Entity | Architecture Contract | Student 3 ER Diagram | Match? |
|--------|----------------------|---------------------|--------|
| Customer | CUSTOMER | `customers` collection | ✅ |
| Product | PRODUCT | `products` collection | ✅ |
| Category | CATEGORY | `categories` collection | ✅ |
| Inventory | INVENTORY | `inventory` collection | ✅ |
| Inventory Reservation | INVENTORY_RESERVATION | `inventory_reservation` collection | ✅ |
| Cart | CART | `carts` collection | ✅ |
| Cart Item | CART_ITEM | `cart_items` collection | ✅ |
| Sale | SALE | `sales` collection | ✅ |
| Deal | DEAL | `deals` collection | ✅ |
| Coupon | COUPON | `coupons` collection | ✅ |
| Order | ORDER | `orders` collection | ✅ |
| Order Item | ORDER_ITEM | `order_items` collection | ✅ |
| Payment | PAYMENT | `payments` collection | ✅ |
| Shipment | SHIPMENT | `shipments` collection | ✅ |
| Notification | NOTIFICATION | `notifications` collection | ✅ |

---

## 3. Inventory Fields (FROZEN — Student 2)

| Field | INVENTORY_CONTRACT | Student 3 ER / Schema | Match? |
|-------|-------------------|----------------------|--------|
| `inventory_id` | UUID PK | UUID PK | ✅ |
| `product_id` | UUID FK UNIQUE | UUID FK UNIQUE | ✅ |
| `available_quantity` | INTEGER NOT NULL | INTEGER NOT NULL | ✅ |
| `reserved_quantity` | INTEGER NOT NULL | INTEGER NOT NULL | ✅ |
| `sold_quantity` | INTEGER NOT NULL | INTEGER NOT NULL | ✅ |
| `version` | INTEGER NOT NULL | INTEGER NOT NULL | ✅ |
| `updated_at` | TIMESTAMPTZ NOT NULL | TIMESTAMPTZ NOT NULL | ✅ |

---

## 4. Inventory Reservation Fields (FROZEN — Student 2)

| Field | INVENTORY_CONTRACT | Student 3 ER / Schema | Match? |
|-------|-------------------|----------------------|--------|
| `reservation_id` | UUID PK | UUID PK | ✅ |
| `product_id` | UUID FK | UUID FK | ✅ |
| `customer_id` | UUID FK | UUID FK | ✅ |
| `quantity` | INTEGER | INTEGER | ✅ |
| `status` | ENUM reservation_status | ENUM reservation_status | ✅ |
| `idempotency_key` | VARCHAR UNIQUE | VARCHAR UNIQUE | ✅ |
| `expires_at` | TIMESTAMPTZ | TIMESTAMPTZ | ✅ |
| `created_at` | TIMESTAMPTZ | TIMESTAMPTZ | ✅ |
| `updated_at` | TIMESTAMPTZ | TIMESTAMPTZ | ✅ |

---

## 5. Reservation States

| State | INVENTORY_CONTRACT | DOMAIN_STATES | Student 3 Docs | Match? |
|-------|-------------------|--------------|----------------|--------|
| `RESERVED` | ✅ | ✅ | ✅ | ✅ |
| `PAYMENT_PENDING` | ✅ | ✅ | ✅ | ✅ |
| `CONFIRMED` | ✅ | ✅ | ✅ | ✅ |
| `SOLD` | ✅ | ✅ | ✅ | ✅ |
| `RELEASED` | ✅ | ✅ | ✅ | ✅ |

---

## 6. Payment States

| State | DOMAIN_STATES | Student 3 Payment Arch | Student 3 DB Schema | Match? |
|-------|--------------|----------------------|---------------------|--------|
| `INITIATED` | ✅ | ✅ | ✅ | ✅ |
| `PROCESSING` | ✅ | ✅ | ✅ | ✅ |
| `SUCCESS` | ✅ | ✅ | ✅ | ✅ |
| `FAILED` | ✅ | ✅ | ✅ | ✅ |
| `TIMEOUT` | ✅ | ✅ | ✅ | ✅ |

---

## 7. Order States

| State | ARCHITECTURE_CONTRACT §9.2 | DOMAIN_STATES §2 | Student 3 Order Arch | Match? |
|-------|--------------------------|-----------------|---------------------|--------|
| `CREATED` | ✅ | ✅ | ✅ | ✅ |
| `PAYMENT_PENDING` | ✅ | ✅ | ✅ | ✅ |
| `CONFIRMED` | ✅ | ✅ | ✅ | ✅ |
| `PROCESSING` | ✅ | ✅ | ✅ | ✅ |
| `SHIPPED` | ✅ | ✅ | ✅ | ✅ |
| `OUT_FOR_DELIVERY` | ✅ | ✅ | ✅ | ✅ |
| `DELIVERED` | ✅ | ✅ | ✅ | ✅ |
| `CANCELLED` | ✅ (implied) | ✅ | ✅ | ✅ |

---

## 8. Event Names

| Event | EVENT_CONTRACT | Student 3 Event Catalogue | Routing Key | Match? |
|-------|---------------|--------------------------|-------------|--------|
| `ReservationCreated` | (Student 2) | ✅ defined | `reservation.created` | ✅ |
| `ReservationConfirmed` | (Student 2) | ✅ defined | `reservation.confirmed` | ✅ |
| `ReservationExpired` | ✅ §3.3 | ✅ reproduced | `reservation.expired` | ✅ |
| `ReservationReleased` | ✅ §3.4 | ✅ reproduced | `reservation.released` | ✅ |
| `PaymentInitiated` | (Student 3 addition) | ✅ defined | `payment.initiated` | ✅ |
| `PaymentSucceeded` | (Student 3 addition) | ✅ defined | `payment.succeeded` | ✅ |
| `PaymentFailed` | ✅ §3.2 | ✅ reproduced | `payment.failed` | ✅ |
| `PaymentTimedOut` | (Student 3 addition) | ✅ defined | `payment.timed_out` | ✅ |
| `PaymentConfirmed` | ✅ §3.1 | ✅ reproduced | `payment.confirmed` | ✅ |
| `OrderCreated` | ✅ §3.6 | ✅ reproduced | `order.created` | ✅ |
| `OrderConfirmed` | ✅ §3.7 | ✅ reproduced | `order.confirmed` | ✅ |
| `ShipmentCreated` | ✅ §3.8 | ✅ reproduced | `shipment.created` | ✅ |
| `NotificationRequested` | (Student 3 addition) | ✅ defined | `notification.requested` | ✅ |
| `InventoryDepleted` | ✅ §3.5 | Not owned by S3 | `inventory.depleted` | ✅ |

**No duplicate event names. No conflicting routing keys.**

---

## 9. API Endpoints

| Endpoint | API_CONTRACT | Student 3 API Spec | Match? |
|----------|-------------|-------------------|--------|
| `POST /api/v1/auth/register` | Implied | ✅ defined | ✅ |
| `POST /api/v1/auth/login` | ✅ §6 | ✅ defined | ✅ |
| `GET /api/v1/products` | ✅ §4.1 | ✅ defined | ✅ |
| `GET /api/v1/products/:id` | ✅ §4.1 | ✅ defined | ✅ |
| `POST /api/v1/cart/items` | ✅ §4.2 | ✅ defined | ✅ |
| `GET /api/v1/cart` | ✅ §4.2 | ✅ defined | ✅ |
| `DELETE /api/v1/cart/items/:id` | ✅ §4.2 | ✅ defined | ✅ |
| `POST /api/v1/reservations` | ✅ §4.5 | ✅ defined | ✅ |
| `GET /api/v1/reservations/:id` | ✅ §4.5 | ✅ defined | ✅ |
| `POST /api/v1/reservations/:id/cancel` | ✅ §4.5 | ✅ defined | ✅ |
| `POST /api/v1/checkout` | ✅ §4.6 | ✅ defined | ✅ |
| `POST /api/v1/payments` | ✅ §4.7 | ✅ defined | ✅ |
| `GET /api/v1/payments/:id` | ✅ §4.7 | ✅ defined | ✅ |
| `POST /api/v1/orders` | ✅ §4.8 | ✅ defined | ✅ |
| `GET /api/v1/orders/:id` | ✅ §4.8 | ✅ defined | ✅ |
| `GET /api/v1/shipments/:id` | ✅ §4.10 | ✅ defined | ✅ |

**Base URL:** `/api/v1` — consistent across all documents.

---

## 10. RabbitMQ Configuration

| Item | EVENT_CONTRACT | Student 3 Docs | Match? |
|------|---------------|----------------|--------|
| Exchange name | `glowrush.events` | `glowrush.events` | ✅ |
| Exchange type | topic | topic | ✅ |
| DLX name | `glowrush.events.dlx` | `glowrush.events.dlx` | ✅ |
| Message format | JSON | JSON | ✅ |
| Durability | Durable, persistent | Durable, persistent | ✅ |
| Acknowledgement | Manual ack | Manual ack | ✅ |
| Retry count | 3 | 3 | ✅ |
| Retry backoff | 1s, 5s, 25s | 1s, 5s, 25s | ✅ |

---

## 11. Idempotency Mechanisms

| Mechanism | Spec | Implementation | Match? |
|-----------|------|---------------|--------|
| `X-Idempotency-Key` header | NAMING_RULES §7 | All write endpoints | ✅ |
| `payments.idempotency_key UNIQUE` | Task spec | DB schema | ✅ |
| `payments.transaction_reference UNIQUE` | Task spec | DB schema | ✅ |
| `orders.reservation_id UNIQUE` | Task spec | DB schema | ✅ |
| `processed_events` collection per service | EVENT_CONTRACT §6 | DB schema + consumer code | ✅ |
| Consumer-side deduplication | INVENTORY_CONTRACT §6 | Event handlers | ✅ |

---

## 12. Data Ownership Boundaries

| Data | Owner | Other Services Access Via | Verified? |
|------|-------|--------------------------|-----------|
| `inventory` | Inventory & Reservation Service | API only | ✅ |
| `inventory_reservation` | Inventory & Reservation Service | API only | ✅ |
| `payments` | Payment Service | API + events | ✅ |
| `orders` | Order Service | API + events | ✅ |
| `fulfilments` | Fulfilment Service | API + events | ✅ |
| `shipments` | Shipment Service | API + events | ✅ |

**No service in Student 3's design reads another service's database collection directly.**

---

## 13. Sync / Async Boundary Verification

| Call | Type | Matches Architecture Contract? |
|------|------|-------------------------------|
| Checkout → Inventory (validate reservation) | Synchronous HTTP | ✅ §5.1 |
| Checkout → Payment Service (initiate payment) | Synchronous HTTP | ✅ §5.1 |
| Payment → Order Service (payment confirmed) | Asynchronous RabbitMQ | ✅ §5.2 |
| Payment → Inventory (payment confirmed) | Asynchronous RabbitMQ | ✅ §5.2 |
| Order → Fulfilment (order created) | Asynchronous RabbitMQ | ✅ §5.2 |
| Fulfilment → Shipment (shipment created) | Asynchronous RabbitMQ | ✅ §5.2 |

---

## 14. Security Verification

| Security Feature | Required | Implemented | Match? |
|-----------------|----------|-------------|--------|
| JWT RS256 | ✅ Architecture Contract | ✅ Security doc | ✅ |
| Bearer token auth | ✅ | ✅ | ✅ |
| X-Correlation-ID | ✅ NAMING_RULES §7 | ✅ | ✅ |
| X-Idempotency-Key | ✅ NAMING_RULES §7 | ✅ | ✅ |
| X-Admission-Token | ✅ SERVICE_CATALOG §2 | ✅ | ✅ |
| Rate limiting (Redis) | ✅ SERVICE_CATALOG | ✅ | ✅ |
| No raw card storage | ✅ Task spec | ✅ | ✅ |
| HMAC webhook verification | Required for payment | ✅ | ✅ |

---

## 15. Open Issues / Risks

| Risk | Severity | Mitigation |
|------|---------|-----------|
| RabbitMQ single point of failure | HIGH | Clustered RabbitMQ (3 nodes); mirrored queues |
| MongoDB single-point write bottleneck on `inventory` | HIGH | Student 2's atomic MongoDB handles this; connection pooling |
| Payment gateway rate limits during 10K concurrent users | MEDIUM | Circuit breaker + StormShield admission batching |
| DLQ processing delay (orphaned payments) | MEDIUM | 5-minute reconciliation job; DLQ alert P1 |
| Student 2's TTL cron lag (30s max) | LOW | Accepcollection for 5-minute TTL |

---

## Sign-off Checklist

- [x] All 12 service names match exactly
- [x] All 15 entity names match exactly
- [x] All 7 inventory fields preserved (Student 2 contract)
- [x] All 9 inventory_reservation fields preserved
- [x] All 5 reservation states match
- [x] All 5 payment states match
- [x] All 8 order states match (including CANCELLED)
- [x] All 13 event names defined with no duplicates
- [x] All 16 API endpoints defined
- [x] RabbitMQ naming follows NAMING_RULES §4
- [x] No service reads another service's database directly
- [x] Idempotency implemented at DB and service levels
- [x] Payment timeout handled as TIMEOUT (not FAILED)
- [x] Order Service unavailability handled via DLQ + reconciliation
- [x] Raw card data never stored
