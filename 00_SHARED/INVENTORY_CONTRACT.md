# GlowRush — Inventory Contract for Student 3

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL — READ BEFORE DESIGNING ER DIAGRAM OR APIs
> **Audience:** Student 3 (Checkout, Payment, Order, Fulfilment, Shipment)

---

## 1. Purpose

This document is the **definitive contract** between the Inventory & Reservation Service (Student 2) and everything Student 3 builds. Read every section before designing:

- The unified ER diagram
- The Checkout Service
- The Payment Service (reservation confirmation flow)
- The Order Service (sold quantity update)

Do NOT design anything that conflicts with the schemas, states, or API semantics defined here.

---

## 2. Database Schema (PostgreSQL)

### 2.1 `inventory` Table

```sql
CREATE TABLE inventory (
    inventory_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID         NOT NULL REFERENCES products(product_id),
    available_quantity  INTEGER      NOT NULL DEFAULT 0,
    reserved_quantity   INTEGER      NOT NULL DEFAULT 0,
    sold_quantity       INTEGER      NOT NULL DEFAULT 0,
    version             INTEGER      NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_inventory_product_id UNIQUE (product_id),
    CONSTRAINT chk_available_non_negative CHECK (available_quantity >= 0),
    CONSTRAINT chk_reserved_non_negative  CHECK (reserved_quantity >= 0),
    CONSTRAINT chk_sold_non_negative      CHECK (sold_quantity >= 0)
);

CREATE INDEX idx_inventory_product_id ON inventory(product_id);
```

**Invariant enforced at all times:**
```
available_quantity + reserved_quantity + sold_quantity = initial_stock
available_quantity >= 0
reserved_quantity  >= 0
sold_quantity      >= 0
```

### 2.2 `inventory_reservation` Table

```sql
CREATE TYPE reservation_status AS ENUM (
    'RESERVED',
    'PAYMENT_PENDING',
    'CONFIRMED',
    'SOLD',
    'RELEASED'
);

CREATE TABLE inventory_reservation (
    reservation_id   UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID              NOT NULL REFERENCES products(product_id),
    customer_id      UUID              NOT NULL REFERENCES customers(customer_id),
    quantity         INTEGER           NOT NULL DEFAULT 1,
    status           reservation_status NOT NULL DEFAULT 'RESERVED',
    idempotency_key  VARCHAR(255)      NOT NULL,
    expires_at       TIMESTAMPTZ       NOT NULL,
    created_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_reservation_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT chk_quantity_positive CHECK (quantity > 0),
    CONSTRAINT chk_quantity_max_one  CHECK (quantity <= 1)  -- Flash sale: 1 per customer
);

CREATE INDEX idx_reservation_customer_id    ON inventory_reservation(customer_id);
CREATE INDEX idx_reservation_product_id     ON inventory_reservation(product_id);
CREATE INDEX idx_reservation_status         ON inventory_reservation(status);
CREATE INDEX idx_reservation_expires_at     ON inventory_reservation(expires_at)
    WHERE status IN ('RESERVED', 'PAYMENT_PENDING');
```

### 2.3 `processed_events` Table (Idempotency)

```sql
CREATE TABLE processed_events (
    event_id     UUID         PRIMARY KEY,
    event_type   VARCHAR(100) NOT NULL,
    result       JSONB,
    processed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Retention: auto-purge events older than 24 hours via maintenance job
```

---

## 3. Reservation States

### State Enum

```
RESERVED → PAYMENT_PENDING → CONFIRMED → SOLD
RESERVED → RELEASED
PAYMENT_PENDING → RELEASED
```

### State Definitions

| State | Description | `inventory` effect |
|-------|-------------|-------------------|
| `RESERVED` | Stock held, awaiting checkout | `available -= qty`, `reserved += qty` |
| `PAYMENT_PENDING` | Checkout initiated | None |
| `CONFIRMED` | Payment confirmed | None |
| `SOLD` | Order confirmed | `reserved -= qty`, `sold += qty` |
| `RELEASED` | Cancelled / expired / payment failed | `available += qty`, `reserved -= qty` |

### Transition Triggers

| From → To | Trigger |
|-----------|---------|
| `→ RESERVED` | Inventory Service atomic SQL `affected_rows = 1` |
| `RESERVED → PAYMENT_PENDING` | Checkout Service HTTP call |
| `PAYMENT_PENDING → CONFIRMED` | `PaymentConfirmed` RabbitMQ event |
| `CONFIRMED → SOLD` | `OrderConfirmed` RabbitMQ event |
| `RESERVED → RELEASED` | TTL expiry (cron) or customer cancel |
| `PAYMENT_PENDING → RELEASED` | `PaymentFailed` event or TTL expiry |

> [!CAUTION]
> `SOLD` and `RELEASED` are **terminal states**. No further transitions are possible. Do not attempt to reverse them.

---

## 4. Reservation API Semantics

### POST /api/v1/reservations

- **Called by:** StormShield (after admission token issued) → through API Gateway
- **Requires:** `X-Admission-Token`, `X-Idempotency-Key`, valid `Authorization: Bearer JWT`
- **Returns:** `201 Created` with `{ reservationId, status: "RESERVED", expiresAt }`
- **Idempotent:** Same `X-Idempotency-Key` returns `200 OK` with original result

### GET /api/v1/reservations/:reservationId

- **Called by:** Checkout Service to validate reservation before checkout
- **Auth check:** `customerId` in JWT must match `reservation.customerId`

### POST /api/v1/reservations/:reservationId/cancel

- **Called by:** Checkout Service on user cancellation or checkout timeout
- **Idempotent:** Cancelling already-cancelled reservation returns `200 OK`
- **Effect:** `RESERVED` or `PAYMENT_PENDING` → `RELEASED`, stock restored immediately

### For Checkout Service — Reservation Validation Rules

Before initiating payment, Checkout Service MUST:
1. `GET /api/v1/reservations/:id` — confirm status = `RESERVED`
2. Confirm `expiresAt > NOW()` — not expired
3. Confirm `customerId` matches authenticated user
4. Call internal endpoint to transition to `PAYMENT_PENDING`

> [!WARNING]
> Checkout Service must **not** attempt payment if reservation is not in `RESERVED` status. An expired or released reservation must show the customer an error and redirect to StormShield queue.

---

## 5. Inventory Events (Published by Student 2's Service)

| Event | Routing Key | Trigger | Student 3 Consumer? |
|-------|-------------|---------|---------------------|
| `ReservationCreated` | `reservation.created` | Successful reservation | ✅ Checkout Service (session state) |
| `ReservationExpired` | `reservation.expired` | TTL elapsed | ❌ (Notification Service only) |
| `ReservationReleased` | `reservation.released` | Any release | ❌ (StormShield, Sale Service) |
| `ReservationConfirmed` | `reservation.confirmed` | PaymentConfirmed processed | ✅ Checkout Service |
| `ReservationFailed` | `reservation.failed` | Out of stock | ❌ (StormShield only) |
| `InventoryDepleted` | `inventory.depleted` | Stock hits 0 | ❌ (StormShield, Sale Service) |

### Events That TRIGGER Student 2's Service

| Event | Routing Key | Publisher | What Student 2 does |
|-------|-------------|---------|---------------------|
| `PaymentConfirmed` | `payment.confirmed` | **Payment Service** (Student 3) | Transition `PAYMENT_PENDING → CONFIRMED`, then `CONFIRMED → SOLD` via `confirmSold()` |
| `PaymentFailed` | `payment.failed` | **Payment Service** (Student 3) | Transition `→ RELEASED`, call `releaseStock()` |
| `OrderConfirmed` | `order.confirmed` | **Order Service** (Student 3) | Transition `CONFIRMED → SOLD`, call `confirmSold()` |

> [!IMPORTANT]
> **Payment Service (Student 3) is responsible for publishing `PaymentConfirmed` and `PaymentFailed` events.** These events are what cause inventory state to advance from `PAYMENT_PENDING`. If the Payment Service fails to publish, the inventory stays in `PAYMENT_PENDING` until TTL expiry. This is by design — TTL is the safety net.

---

## 6. Idempotency Rules

### For Reservation Creation (Student 3's Checkout calls back to Student 2)

- The `X-Idempotency-Key` must be a UUID v4 generated by the client (React app)
- The Checkout Service must forward this key when calling Inventory Service
- Idempotency window: **24 hours**

### For Event Processing (Student 2 consuming Student 3's events)

```
Algorithm:
  1. Receive PaymentConfirmed / PaymentFailed / OrderConfirmed
  2. Check processed_events table for event_id
  3. IF found → ACK and skip (already processed)
  4. IF new → process in transaction → record event_id → ACK
  5. ON failure → NACK with requeue → retry up to 3 times
  6. After 3 failures → DLQ, alert
```

### For Student 3's Event Consumers (consuming Student 2's events)

Same algorithm. Consumer-side deduplication using `eventId` in `processed_events`.

---

## 7. Concurrency Decision

**Selected mechanism:** Atomic Conditional Update

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

- `affected_rows = 1` → success
- `affected_rows = 0` → out of stock

**This is the ONLY place in the entire system where `available_quantity` is decremented.** No service — including Checkout, Payment, or Order Service — may modify `available_quantity` or `reserved_quantity` directly.

---

## 8. Transaction Boundaries

### What is in ONE PostgreSQL transaction (inside Inventory Service):

```
BEGIN
  → Idempotency check (SELECT from processed_events)
  → Atomic inventory UPDATE (WHERE available_quantity >= 1)
  → Reservation INSERT (ON CONFLICT DO NOTHING)
  → Idempotency record INSERT
COMMIT
```

### What is NOT in that transaction (post-commit):

```
→ Redis cache invalidation (DEL inventory:availability:{productId})
→ RabbitMQ event publish (post-commit, best-effort with retry)
```

**Why post-commit for events?** If events are published inside the transaction and the transaction rolls back, the event would be consumed by downstream services even though no reservation exists. Post-commit publishing means the event only goes out if the DB change is permanent.

**Implication for Student 3:** There may be a brief window (milliseconds) between a reservation being committed and `ReservationCreated` arriving. The Checkout Service should not rely on the event for its primary flow — it should use the synchronous HTTP response from the reservation endpoint.

---

## 9. Failure Cases

| Failure | Behaviour | Recovery |
|---------|-----------|---------|
| DB unavailable during reservation | 500 returned, no inventory change | Client retries with same idempotency key |
| DB unavailable during expiry cron | Cron retries on next 30s cycle | Max 30s delay — acceptable for 5min TTL |
| PaymentConfirmed event not received | Reservation stays PAYMENT_PENDING until TTL | TTL expiry cron releases after 5min |
| PaymentFailed event not received | Reservation stays PAYMENT_PENDING until TTL | TTL expiry releases after 5min |
| RabbitMQ publish fails post-commit | Event retried (outbox pattern or at-least-once) | StormShield may not get ReservationReleased; fallback: StormShield polls availability |
| Expiry cron crashes mid-batch | Incomplete release. Next cron cycle handles remaining. | Idempotent: UPDATE WHERE status IN (...) AND expires_at < NOW() |

### The TTL is the universal safety net

If any async mechanism fails, the 5-minute TTL guarantee means stock is always returned within 5 minutes + 30 seconds (max cron delay). No stock is permanently locked by a failed payment or failed event.

---

## 10. Quantities Per Customer

**For GlowRush flash sales: maximum 1 unit per customer per sale.**

This is enforced by:
1. `InventoryPolicy.isValidQuantity(qty)` — rejects any request with `quantity > 1`
2. Database constraint: `CHECK (quantity <= 1)`
3. Admission token: single-use (StormShield marks token as `CONSUMED` after first use)

Student 3's Checkout Service does not need to enforce this — it is enforced before checkout.

---

## 11. Checklist for Student 3

Before finalising your designs, confirm:

- [ ] ER diagram includes `inventory` and `inventory_reservation` tables with exact column names above
- [ ] No service other than Inventory & Reservation Service has a foreign key or write access to `inventory` or `inventory_reservation`
- [ ] Checkout Service reads reservation via `GET /api/v1/reservations/:id` before initiating payment
- [ ] Payment Service publishes `PaymentConfirmed` and `PaymentFailed` to `payment.confirmed` and `payment.failed` routing keys
- [ ] Order Service publishes `OrderConfirmed` to `order.confirmed` routing key after confirming order
- [ ] Unified API spec uses `/api/v1/reservations` prefix (not `/reservations` or `/api/reservations`)
- [ ] Event consumer implementations include idempotency check against `processed_events`
