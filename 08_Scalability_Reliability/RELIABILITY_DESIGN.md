# GlowRush — Reliability & Recovery Design

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL
> **Scope:** Checkout Service, Payment Service, Order Service, Fulfilment Service, Shipment Service

---

## 1. Reliability Principles

1. **Fail fast at the edge** — StormShield rejects traffic overload before it reaches business logic
2. **Fail safe at the core** — Atomic SQL prevents oversell; UNIQUE constraints prevent duplicates
3. **Fail forward with events** — Async failures go to DLQ, never silently dropped
4. **Fail recoverable** — Every failure state has a documented recovery path
5. **Idempotent everywhere** — Every write operation is safe to retry

---

## 2. Timeout Configuration

| Service Call | Timeout | Behaviour on Timeout |
|-------------|---------|---------------------|
| API Gateway → downstream | 5s | 503 returned to client |
| Checkout → Inventory Service | 3s | Checkout fails; client retries |
| Checkout → Payment Service | 5s | Checkout fails; same idempotency key retry is safe |
| Payment → Gateway (initial) | 10s | Mark PROCESSING; start webhook wait |
| Payment webhook wait | 30s | Mark TIMEOUT; start reconciliation |
| Gateway reconciliation poll | 10s per attempt | Exponential backoff: 5s, 25s, 125s |
| Order Service → DB | 5s | Transaction rolls back; consumer NACKs |
| RabbitMQ publish | 3s | Retry 3x; if fails, use outbox pattern |

---

## 3. Retry Strategy

### 3.1 HTTP Retries (synchronous)

```
Strategy: Exponential backoff with jitter
  Attempt 1: immediate
  Attempt 2: 1s + jitter(0-500ms)
  Attempt 3: 5s + jitter(0-1000ms)
  → Give up → return error to caller

Retry-eligible HTTP status codes: 429, 502, 503, 504
Never retry: 400, 401, 403, 404, 409, 422 (client errors — retrying changes nothing)
```

### 3.2 RabbitMQ Message Retries

```
Per EVENT_CONTRACT.md:
  Attempt 1: immediate
  Attempt 2: after 1s (x-message-ttl on retry queue)
  Attempt 3: after 5s
  Attempt 4: after 25s
  → Move to DLQ → alert

RabbitMQ configuration:
  x-dead-letter-exchange: glowrush.events.dlx
  x-dead-letter-routing-key: <original-routing-key>.dlq
  x-max-retries: 3 (tracked via x-death header count)
```

### 3.3 Payment Gateway Reconciliation Retries

```
After TIMEOUT (30s no webhook):
  Poll gateway: immediate
  If still pending:
    Poll gateway: +60s
    Poll gateway: +5 min
    Poll gateway: +25 min
  After 4 polls with no terminal status:
    Mark FAILED (conservative after ~30 min total)
    Release reservation via PaymentFailed event
```

---

## 4. Circuit Breaker

Applied to: Payment Service → External Payment Gateway

```
Configuration:
  Failure threshold:     5 failures in 60 seconds
  Recovery probe:        1 request every 30 seconds
  Open state action:     Return 503 immediately (no gateway call)
  Half-open:             Allow 1 request; if success → Close; if fail → stay Open

States:
  CLOSED  → normal operation
  OPEN    → short-circuit; return error immediately
  HALF_OPEN → test probe request

Implementation (Node.js):
  Use opossum library or custom implementation
```

```javascript
const circuitBreaker = new CircuitBreaker(gatewayAdapter.charge, {
  timeout:          10000,   // 10s per call
  errorThresholdPercentage: 50,
  resetTimeout:     30000,   // probe after 30s
  volumeThreshold:  5,
});

circuitBreaker.fallback(() => ({
  status: 'circuit_open',
  message: 'Payment gateway temporarily unavailable — please retry',
}));
```

---

## 5. Dead Letter Queue (DLQ)

### DLQ Architecture

```
glowrush.events (topic exchange)
    ↓ message rejected after 3 retries
glowrush.events.dlx (dead letter exchange)
    ↓ routes to DLQ by routing key
<consumer>.<routing-key>.dlq  (durable queue)
    ↓
DLQ Consumer (monitoring job):
    → Alert (PagerDuty / Slack)
    → Log for manual review
    → Reconciliation job may re-process
```

### DLQ-Specific Queues

| DLQ Queue | Severity | Action |
|-----------|----------|--------|
| `order.payment-confirmed.dlq` | **CRITICAL** | Alert immediately; run reconciliation job |
| `inventory.payment-confirmed.dlq` | **HIGH** | Alert; stock stays in reserved state safely via TTL |
| `inventory.payment-failed.dlq` | **HIGH** | Alert; stock auto-releases via 5-min TTL safety net |
| `fulfilment.order-created.dlq` | **MEDIUM** | Alert; retry in next batch |
| `notification.*.dlq` | **LOW** | Log; retry next day |

---

## 6. Idempotent Consumers

Every RabbitMQ consumer in Order Service, Inventory Service, Fulfilment Service, Notification Service MUST:

```javascript
async function idempotentConsumer(message) {
  const event = JSON.parse(message.content.toString());
  const { eventId, eventType, data } = event;

  // Step 1: Check idempotency fence
  const alreadyProcessed = await db.query(
    'SELECT event_id FROM processed_events WHERE event_id = $1',
    [eventId]
  );

  if (alreadyProcessed.rows.length > 0) {
    // Already processed — safe to ACK and skip
    channel.ack(message);
    logger.info({ eventId, eventType }, 'Duplicate event — skipped');
    return;
  }

  // Step 2: Process within transaction
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // Do business logic (insert order, update reservation, etc.)
    await processEvent(client, event);

    // Record as processed
    await client.query(
      'INSERT INTO processed_events (event_id, event_type, processed_at) VALUES ($1, $2, NOW())',
      [eventId, eventType]
    );

    await client.query('COMMIT');
    channel.ack(message);

    // POST-COMMIT: publish downstream events
    await publishDownstreamEvents(event);

  } catch (err) {
    await client.query('ROLLBACK');
    logger.error({ eventId, eventType, err }, 'Event processing failed');

    // NACK with requeue (up to max retries)
    const deathCount = getDeathCount(message);
    if (deathCount < 3) {
      channel.nack(message, false, false);  // → retry queue
    } else {
      channel.nack(message, false, false);  // → DLQ after 3 retries
    }
  } finally {
    client.release();
  }
}
```

---

## 7. Reconciliation Jobs

### 7.1 Orphaned Payment Reconciliation (every 5 minutes)

```sql
-- Find payments marked SUCCESS that have no corresponding order
SELECT p.payment_id, p.reservation_id, p.customer_id, p.amount
FROM payments p
LEFT JOIN orders o ON o.payment_id = p.payment_id
WHERE p.status = 'SUCCESS'
  AND o.order_id IS NULL
  AND p.created_at < NOW() - INTERVAL '2 minutes';  -- grace period
```

**Action:** Re-publish `PaymentConfirmed` event for each orphaned payment.
This is safe because Order Service is idempotent — it will only create the order once.

### 7.2 Payment Timeout Reconciliation (every 5 minutes)

```sql
-- Find payments in TIMEOUT state older than 5 minutes
SELECT payment_id, reservation_id, provider
FROM payments
WHERE status = 'TIMEOUT'
  AND updated_at < NOW() - INTERVAL '5 minutes';
```

**Action:** Poll gateway for each payment; update status accordingly.

### 7.3 Reservation TTL Cleanup (every 30 seconds — Inventory Service)

```sql
-- Already Student 2's responsibility — documented here for completeness
UPDATE inventory_reservation
SET status = 'RELEASED', updated_at = NOW()
WHERE status IN ('RESERVED', 'PAYMENT_PENDING')
  AND expires_at < NOW();
-- Then update inventory: available_quantity += quantity, reserved_quantity -= quantity
-- Then publish ReservationExpired + ReservationReleased events
```

### 7.4 DLQ Reconciliation (daily batch)

```
Scheduled job: 02:00 AM UTC daily
1. Read all messages from each DLQ
2. For each message:
   a. If PaymentConfirmed + no order → re-queue to order.payment-confirmed
   b. If PaymentFailed + reservation still active → re-queue to inventory.payment-failed
   c. If Notification → retry send
3. Log outcome; alert if DLQ still has messages after reconciliation
```

---

## 8. Compensation

### 8.1 Order Cancellation Compensation

```
Order CANCELLED (pre-shipment):
    ↓
If payment.status = 'SUCCESS':
    Payment Service → initiate refund to gateway
    → UPDATE payments SET status = 'REFUNDED'
    → Publish PaymentRefunded event
    ↓
Inventory Service:
    Transition reservation → RELEASED
    (via PaymentFailed event reuse or dedicated PaymentRefunded handler)
    available_quantity += 1
    ↓
Notification Service:
    Send refund confirmation email/SMS
```

### 8.2 Stock Compensation on Payment Gateway Failure

```
Payment gateway returns error mid-charge (charge attempted but not confirmed):
    ↓
Payment Service waits for webhook (30s timeout)
    ↓ No webhook
Mark payment TIMEOUT
    ↓ Poll gateway 3 times
    ↓ Gateway confirms: no charge
Mark payment FAILED
    ↓
Publish PaymentFailed
    ↓
Inventory Service releases reservation
```

---

## 9. Failure Scenario Playbook

### Scenario 1 — Database Unavailable

**Affected service:** Any service with PostgreSQL dependency

| Phase | Behaviour |
|-------|-----------|
| Short outage (< 5s) | Connection pool holds requests; retry on reconnect |
| DB for Inventory Service | Reservation attempt returns 503; client retries with same idempotency key |
| DB for Payment Service | Payment INSERT fails; client retries safely (idempotency key prevents duplicate) |
| DB for Order Service | Consumer NACKs; RabbitMQ retries; message stays in queue until DB recovers |
| DB for Notification | Notifications queue up; delivered when DB recovers |
| Long outage (> 60s) | Circuit breaker opens; 503 returned; DLQ fills; reconciliation runs on recovery |

---

### Scenario 2 — Payment Gateway Unavailable

| Phase | Behaviour |
|-------|-----------|
| Immediate | Circuit breaker detects failures |
| After 5 failures | Circuit breaker OPENS |
| While OPEN | `POST /payments` returns 503 immediately; no gateway call |
| Reservation status | Stays `PAYMENT_PENDING`; TTL safety net (5-min) will release it |
| Customer UX | "Payment service temporarily unavailable — please retry in a moment" |
| Recovery | Circuit breaker half-opens; probe request tests gateway; if success → CLOSE |
| Payment records | Payments created with status `INITIATED` can be retried with same idempotency key |

---

### Scenario 3 — Order Service Unavailable

| Phase | Behaviour |
|-------|-----------|
| Payment succeeds | Payment record persisted with `status = SUCCESS` |
| Event published | `PaymentConfirmed` in `order.payment-confirmed` queue (durable) |
| Order Service down | Message sits in queue — no consumer, no ack, no loss |
| After 30s outage | Order Service restarts; reconnects to RabbitMQ |
| Recovery | Consumes `PaymentConfirmed`; idempotent order creation |
| If 3 delivery failures | Message goes to DLQ; alert fires; reconciliation job re-queues |
| Final safety | Nightly DLQ reconciliation catches any remaining orphaned payments |

---

### Scenario 4 — RabbitMQ Unavailable

| Phase | Behaviour |
|-------|-----------|
| Payment Service cannot publish | Retry 3x (1s, 5s, 25s) |
| Still unavailable | Use **Outbox Pattern**: write event to `outbox_events` table within same DB transaction |
| Outbox processor | Background job polls `outbox_events` every 5s; publishes to RabbitMQ when available |
| Inventory stays `PAYMENT_PENDING` | TTL safety net releases stock within 5 minutes |
| Order not created | Reconciliation job detects orphaned payment → creates order on recovery |

**Outbox Table:**
```sql
CREATE TABLE outbox_events (
    outbox_id    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    routing_key  VARCHAR(100) NOT NULL,
    payload      JSONB        NOT NULL,
    published    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

---

### Scenario 5 — Duplicate Events

**Protection:** `processed_events` table in each consumer service.
Every consumer checks `event_id` before processing. If already processed → ACK and skip.
Database UNIQUE constraint on `orders.reservation_id` provides a second layer.

---

### Scenario 6 — Duplicate API Requests

**Protection:** `X-Idempotency-Key` header + `payments.idempotency_key UNIQUE` constraint.
Second identical POST with same key returns the original result without creating a new record or calling the gateway.

---

### Scenario 7 — Payment Timeout

See `02_PAYMENT_ARCHITECTURE.md §4` for the full playbook.

**Summary:**
1. Mark `TIMEOUT` (not `FAILED`) — we don't know the gateway's decision
2. Poll gateway 3 times with exponential backoff
3. If gateway confirms success → `SUCCESS` → events flow normally
4. If gateway confirms failure → `FAILED` → release reservation
5. If gateway unreachable → stay `TIMEOUT` → 5-min TTL releases reservation safely
6. Reservation TTL is the universal safety net

---

## 10. Flash Sale Specific Reliability

For 10,000 concurrent purchase attempts for 100 units:

| Layer | Protection |
|-------|-----------|
| CDN/WAF | Block bots; rate limit per IP |
| StormShield | Admission control — batch 20-50 at a time |
| API Gateway | Global rate limiting via Redis |
| Inventory Service | Atomic conditional UPDATE — mathematically impossible to oversell |
| Payment Service | Idempotency key — 10,000 retries still create 1 payment |
| Order Service | `reservation_id UNIQUE` — 100 payments → exactly 100 orders |
| RabbitMQ | Durable queues handle burst of 100 `PaymentConfirmed` events trivially |
| PostgreSQL | Connection pooling (pg-pool, max 20 connections per service instance) |
