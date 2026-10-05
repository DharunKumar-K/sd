# GlowRush — Architecture Contract

> **Status:** FROZEN  
> **Version:** 1.0  
> **Last Updated:** 2026-10-05  
> **Authority:** Student 1 (System Architect)  
> **Audience:** All team members — read this BEFORE any design work

---

## 1. Purpose

This document freezes all cross-cutting architectural decisions. **No student may deviate** from this contract without explicit team-wide approval. It defines service names, technology stack, request paths, sync/async boundaries, state ownership, naming conventions, and failure-handling philosophy.

---

## 2. Technology Stack — LOCKED

| Layer              | Technology                   | Notes                                    |
| ------------------ | ---------------------------- | ---------------------------------------- |
| Frontend           | React + Vite + Tailwind CSS  | SPA served from CDN                      |
| Backend Runtime    | Node.js + Express.js         | All microservices                        |
| Primary Database   | PostgreSQL                   | Single source of truth for all business data |
| Cache              | Redis                        | Caching, rate limiting, admission tokens |
| Message Broker     | RabbitMQ                     | All async event communication            |
| API Style          | REST + OpenAPI 3.0           | Synchronous service-to-service           |
| Authentication     | JWT (RS256)                  | Stateless, short-lived tokens            |
| Containerization   | Docker                       | Every service is a container             |
| Load Testing       | Locust                       | Simulate 10K concurrent users            |
| Deployment         | AWS-style (ECS/EKS)          | Multi-AZ, auto-scaling                   |

> [!CAUTION]
> Do NOT introduce MongoDB, DynamoDB, Kafka, gRPC, or any technology not listed above.

---

## 3. Canonical Service Names — LOCKED

| #  | Service Name                    | Type        | Owner     |
| -- | ------------------------------- | ----------- | --------- |
| 1  | API Gateway                     | Infra       | Student 1 |
| 2  | StormShield                     | Admission   | Student 1 |
| 3  | Product Service                 | Business    | Student 1 |
| 4  | Cart Service                    | Business    | Student 1 |
| 5  | Sale Service                    | Business    | Student 1 |
| 6  | Inventory & Reservation Service | Business    | Student 2 |
| 7  | Checkout Service                | Business    | Student 3 |
| 8  | Payment Service                 | Business    | Student 3 |
| 9  | Order Service                   | Business    | Student 3 |
| 10 | Fulfilment Service              | Business    | Student 3 |
| 11 | Shipment Service                | Business    | Student 3 |
| 12 | Notification Service            | Infra       | Student 1 |

> [!IMPORTANT]
> These names are final. Use them exactly in code, diagrams, API paths, event names, and documentation.

---

## 4. Canonical Request Path

```
Customer
  → CDN / WAF
    → Load Balancer (ALB)
      → API Gateway
        → StormShield (admission control)
          → Product Service / Cart Service / Sale Service
            → Inventory & Reservation Service
              → Checkout Service
                → Payment Service
                  → Order Service
                    → Fulfilment Service
                      → Shipment Service
                        → Notification Service
                          → Delivery Tracking
```

---

## 5. Synchronous vs Asynchronous Boundaries

### 5.1 Synchronous (REST, request-response)

| From                            | To                              | Protocol | Why Synchronous                          |
| ------------------------------- | ------------------------------- | -------- | ---------------------------------------- |
| Client                          | API Gateway                     | HTTPS    | User-facing, needs immediate response    |
| API Gateway                     | StormShield                     | HTTP     | Admission decision must be instant       |
| API Gateway                     | Product Service                 | HTTP     | Product data for page render             |
| API Gateway                     | Cart Service                    | HTTP     | Cart CRUD is user-interactive            |
| API Gateway                     | Sale Service                    | HTTP     | Flash sale metadata                      |
| StormShield                     | Inventory & Reservation Service | HTTP     | Reservation attempt needs instant result |
| Checkout Service                | Inventory & Reservation Service | HTTP     | Validate reservation before checkout     |
| Checkout Service                | Payment Service                 | HTTP     | Initiate payment, return redirect/status |

### 5.2 Asynchronous (RabbitMQ Events)

| Event Name              | Publisher                       | Consumer(s)                  | Trigger                          |
| ----------------------- | ------------------------------- | ---------------------------- | -------------------------------- |
| `PaymentConfirmed`      | Payment Service                 | Order Service, Inventory     | Payment gateway confirms success |
| `PaymentFailed`         | Payment Service                 | Inventory & Reservation      | Payment gateway confirms failure |
| `ReservationExpired`    | Inventory & Reservation Service | Notification Service         | TTL (5 min) elapsed, no payment  |
| `ReservationReleased`   | Inventory & Reservation Service | StormShield, Sale Service    | Stock returned to available pool |
| `OrderCreated`          | Order Service                   | Fulfilment Service           | Order record persisted           |
| `OrderConfirmed`        | Order Service                   | Notification Service         | Payment matched to order         |
| `ShipmentCreated`       | Fulfilment Service              | Shipment Service             | Shipment label generated         |
| `ShipmentDispatched`    | Shipment Service                | Notification Service         | Carrier picked up package        |
| `ShipmentDelivered`     | Shipment Service                | Order Service, Notification  | Delivery confirmed               |
| `NotificationRequested` | Any service                     | Notification Service         | Email/SMS/push needed            |

> [!WARNING]
> If a consumer is unavailable, the message **stays in the queue** (RabbitMQ durable queues with manual ack). No message is silently dropped.

---

## 6. StormShield Responsibility — STRICT BOUNDARY

### StormShield IS responsible for:

- Virtual waiting room / queue management
- Controlled batch admission (e.g., batches of 20–50 users)
- Queue position tracking via Redis sorted sets
- Issuing short-lived **admission tokens** (JWT, 60-second TTL)
- Rate limiting at the admission layer
- Signalling "Currently Sold Out" when notified by Inventory service

### StormShield is NOT responsible for:

- Inventory counts
- Reservation creation
- Stock consistency
- Payment processing
- Order management

> [!CAUTION]
> **StormShield does NOT guarantee inventory availability.** A user with a valid admission token may still receive "Out of Stock" from Inventory & Reservation Service. StormShield controls *traffic*, not *stock*.

---

## 7. Inventory & Reservation Service — STRICT BOUNDARY

### Inventory & Reservation Service IS responsible for:

- The single source of truth for `available_quantity`, `reserved_quantity`, `sold_quantity`
- Atomic conditional reservation (`UPDATE ... WHERE available_quantity >= 1`)
- Reservation TTL enforcement (5-minute expiry)
- Releasing expired/failed reservations back to available pool
- Publishing `ReservationExpired` and `ReservationReleased` events
- Idempotent reservation creation via `idempotency_key`

### Inventory & Reservation Service is NOT responsible for:

- Traffic admission (StormShield's job)
- Payment processing
- Order management

### Canonical Inventory Update (FROZEN)

```sql
UPDATE inventory
SET
    available_quantity = available_quantity - :quantity,
    reserved_quantity  = reserved_quantity + :quantity,
    version            = version + 1,
    updated_at         = NOW()
WHERE product_id = :product_id
  AND available_quantity >= :quantity;
```

- `affected_rows = 1` → Reservation **successful**
- `affected_rows = 0` → **Out of stock** / reservation failed

> [!IMPORTANT]
> This is the **exact inventory consistency point**. No other service may modify `available_quantity` or `reserved_quantity` directly.

---

## 8. Canonical Data Models — FROZEN

### 8.1 Inventory Table

| Column             | Type        | Notes                          |
| ------------------ | ----------- | ------------------------------ |
| `inventory_id`     | UUID / PK   | Primary key                    |
| `product_id`       | UUID / FK   | References Product             |
| `available_quantity` | INTEGER   | Current available stock        |
| `reserved_quantity`  | INTEGER   | Currently reserved             |
| `sold_quantity`      | INTEGER   | Successfully sold              |
| `version`          | INTEGER     | Optimistic concurrency version |
| `updated_at`       | TIMESTAMPTZ | Last modification              |

**Invariant:** `available_quantity + reserved_quantity + sold_quantity = total_initial_stock`

### 8.2 Inventory Reservation Table

| Column             | Type        | Notes                                  |
| ------------------ | ----------- | -------------------------------------- |
| `reservation_id`   | UUID / PK   | Primary key                            |
| `product_id`       | UUID / FK   | References Product                     |
| `customer_id`      | UUID / FK   | References Customer                    |
| `quantity`         | INTEGER     | Units reserved                         |
| `status`           | ENUM        | See §9 Canonical States                |
| `idempotency_key`  | VARCHAR     | UNIQUE — prevents duplicate reservations |
| `expires_at`       | TIMESTAMPTZ | Created_at + 5 minutes                 |
| `created_at`       | TIMESTAMPTZ | Record creation                        |
| `updated_at`       | TIMESTAMPTZ | Last modification                      |

---

## 9. Canonical State Machines — FROZEN

### 9.1 Reservation States

```
AVAILABLE → RESERVED → PAYMENT_PENDING → CONFIRMED → SOLD
                 ↓              ↓
           PAYMENT_FAILED   TIMEOUT
                 ↓              ↓
              RELEASED       RELEASED
```

### 9.2 Order States

```
CREATED → PAYMENT_PENDING → CONFIRMED → PROCESSING → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
```

> [!WARNING]
> Do not invent new states or rename existing ones. Additional failure/cancellation states may be appended if justified and documented.

---

## 10. Reservation Policy — FROZEN

| Parameter                | Value       |
| ------------------------ | ----------- |
| Reservation TTL          | 5 minutes   |
| Browser Back behavior    | Reservation remains active |
| Reservation release on   | Payment success, explicit cancel, or TTL expiry |
| Released stock offered via | StormShield controlled admission (NOT reopened to all) |

---

## 11. Payment Recovery — FROZEN

| Scenario                              | Mechanism                                             |
| ------------------------------------- | ----------------------------------------------------- |
| Payment succeeds, Order Service down  | Persist `SUCCESS`, publish `PaymentConfirmed` via RabbitMQ, Order Service processes when available |
| Payment fails                         | Publish `PaymentFailed`, Inventory releases reservation |
| Payment timeout                       | Retry with idempotency key, then fail-safe to release  |
| Duplicate payment request             | Idempotency key returns existing result                |

Reliability mechanisms required:
- **Retry** with exponential backoff
- **Timeout** with circuit breaker
- **Dead Letter Queue** for poison messages
- **Idempotent event processing** (consumer-side deduplication)
- **Reconciliation** job for orphaned payments
- **Compensation** for confirmed payments with failed orders

---

## 12. Failure-Handling Philosophy

1. **Fail fast at the edge** — StormShield rejects overflow traffic immediately
2. **Fail safe at the core** — Inventory uses atomic updates; impossible to oversell
3. **Fail forward with events** — Async failures go to DLQ, never silently dropped
4. **Fail recoverable** — Every failure state has a defined recovery path
5. **Idempotent everywhere** — Every write operation supports safe retry

---

## 13. Correlation & Tracing

Every request receives a `X-Correlation-ID` (UUID v4) at the API Gateway. This ID is:

- Passed in HTTP headers for synchronous calls
- Embedded in RabbitMQ message properties for async events
- Logged in every service's structured log output
- Used for distributed trace correlation

---

## 14. High-Level Data Ownership

| Service                         | Owns                                      | Database        |
| ------------------------------- | ----------------------------------------- | --------------- |
| Product Service                 | Product catalog, images, descriptions     | PostgreSQL      |
| Cart Service                    | Shopping cart state                        | Redis + PostgreSQL |
| Sale Service                    | Flash sale config, schedules, pricing     | PostgreSQL      |
| Inventory & Reservation Service | Stock levels, reservations                | PostgreSQL      |
| Checkout Service                | Checkout session state                    | Redis           |
| Payment Service                 | Payment records, gateway interactions     | PostgreSQL      |
| Order Service                   | Orders, order items, order lifecycle      | PostgreSQL      |
| Fulfilment Service              | Fulfilment records, packing state         | PostgreSQL      |
| Shipment Service                | Shipment tracking, carrier integration    | PostgreSQL      |
| Notification Service            | Notification logs, templates              | PostgreSQL      |
| StormShield                     | Queue positions, admission tokens         | Redis           |

> [!IMPORTANT]
> Each service owns its data exclusively. No service reads another service's database tables directly. All cross-service data access is via REST APIs or RabbitMQ events.

---

## Changelog

| Date       | Change                  | Author    |
| ---------- | ----------------------- | --------- |
| 2026-10-05 | Initial contract frozen | Student 1 |
