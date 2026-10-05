# GlowRush — Inventory Event Contract

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL — Handoff to Student 3
> **References:** EVENT_CONTRACT.md, NAMING_RULES.md §4–5, ARCHITECTURE_CONTRACT.md §5.2

---

## Infrastructure

All events use the standard envelope defined in `00_SHARED/EVENT_CONTRACT.md`:

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "PascalCase event name",
  "source":        "inventory-reservation-service",
  "timestamp":     "ISO 8601",
  "correlationId": "uuid-v4 from X-Correlation-ID header",
  "version":       "1.0",
  "data":          { ... }
}
```

| Property | Value |
|----------|-------|
| Exchange | `glowrush.events` (topic) |
| Publisher | `inventory-reservation-service` |
| Message durability | Persistent |
| Acknowledgement | Manual ACK (consumer-side) |
| DLX | `glowrush.events.dlx` |
| Retry policy | 3 attempts: 1s, 5s, 25s backoff |

---

## 1. ReservationCreated

| Property | Value |
|----------|-------|
| **Event name** | `ReservationCreated` |
| **Routing key** | `reservation.created` |
| **Producer** | Inventory & Reservation Service |
| **Trigger** | Atomic UPDATE `affected_rows = 1`, reservation INSERT successful |
| **Consumers** | Checkout Service (to confirm session), Notification Service (optional confirmation) |
| **Idempotency** | Consumer must check `eventId` in `processed_events` before processing |

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "ReservationCreated",
  "source":        "inventory-reservation-service",
  "timestamp":     "2026-10-05T10:00:00.000Z",
  "correlationId": "uuid-v4",
  "version":       "1.0",
  "data": {
    "reservationId":  "uuid",
    "productId":      "uuid",
    "customerId":     "uuid",
    "saleId":         "uuid",
    "quantity":       1,
    "status":         "RESERVED",
    "expiresAt":      "2026-10-05T10:05:00.000Z",
    "idempotencyKey": "uuid"
  }
}
```

**When Published:** Post-commit (after both the inventory UPDATE and reservation INSERT have committed in the same transaction).

---

## 2. ReservationExpired

| Property | Value |
|----------|-------|
| **Event name** | `ReservationExpired` |
| **Routing key** | `reservation.expired` |
| **Producer** | Inventory & Reservation Service (`ReservationExpiryWorker`) |
| **Trigger** | Cron worker finds reservation where `expires_at < NOW()` and `status IN ('RESERVED', 'PAYMENT_PENDING')` |
| **Consumers** | Notification Service |
| **Queue** | `notification.reservation-expired` |
| **DLQ** | `notification.reservation-expired.dlq` |
| **Idempotency** | Consumer deduplicates via `eventId` |

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "ReservationExpired",
  "source":        "inventory-reservation-service",
  "timestamp":     "2026-10-05T10:05:01.000Z",
  "correlationId": "uuid-v4",
  "version":       "1.0",
  "data": {
    "reservationId": "uuid",
    "productId":     "uuid",
    "customerId":    "uuid",
    "quantity":      1,
    "expiredAt":     "2026-10-05T10:05:00.000Z",
    "reason":        "ttl_expired"
  }
}
```

**Consumer Action (Notification Service):** Send email/push: *"Your reservation for Vitamin C Serum has expired."*

---

## 3. ReservationReleased

| Property | Value |
|----------|-------|
| **Event name** | `ReservationReleased` |
| **Routing key** | `reservation.released` |
| **Producer** | Inventory & Reservation Service |
| **Trigger** | Any reservation transitions to `RELEASED` (expiry, explicit cancel, or payment failure) |
| **Consumers** | StormShield, Sale Service |
| **Queues** | `stormshield.reservation-released`, `sale.reservation-released` |
| **DLQ** | `stormshield.reservation-released.dlq` |
| **Idempotency** | Consumer deduplicates via `eventId`. StormShield must not double-admit for the same release. |

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "ReservationReleased",
  "source":        "inventory-reservation-service",
  "timestamp":     "2026-10-05T10:05:01.000Z",
  "correlationId": "uuid-v4",
  "version":       "1.0",
  "data": {
    "reservationId":      "uuid",
    "productId":          "uuid",
    "customerId":         "uuid",
    "quantityReleased":   1,
    "availableQuantity":  5,
    "reason":             "expired | cancelled | payment_failed",
    "releasedAt":         "2026-10-05T10:05:01.000Z"
  }
}
```

**`reason` values:**
- `expired` — TTL elapsed without payment
- `cancelled` — Customer explicitly cancelled
- `payment_failed` — Payment gateway rejected payment

**Consumer Action (StormShield):**
1. If `availableQuantity > 0`, clear depleted flag
2. Admit next N customers from queue (ZPOPMIN N, where N = quantityReleased)
3. Issue fresh admission tokens to admitted customers

**Consumer Action (Sale Service):** Update sale statistics (units released, units available).

---

## 4. ReservationConfirmed

| Property | Value |
|----------|-------|
| **Event name** | `ReservationConfirmed` |
| **Routing key** | `reservation.confirmed` |
| **Producer** | Inventory & Reservation Service (`EventConsumerHandler`) |
| **Trigger** | `PaymentConfirmed` event received; reservation transitions to `CONFIRMED` |
| **Consumers** | Checkout Service (session state update), Analytics |
| **Idempotency** | Consumer deduplicates via `eventId` |

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "ReservationConfirmed",
  "source":        "inventory-reservation-service",
  "timestamp":     "2026-10-05T10:02:00.000Z",
  "correlationId": "uuid-v4",
  "version":       "1.0",
  "data": {
    "reservationId": "uuid",
    "productId":     "uuid",
    "customerId":    "uuid",
    "paymentId":     "uuid",
    "confirmedAt":   "2026-10-05T10:02:00.000Z"
  }
}
```

---

## 5. ReservationFailed

| Property | Value |
|----------|-------|
| **Event name** | `ReservationFailed` |
| **Routing key** | `reservation.failed` |
| **Producer** | Inventory & Reservation Service (`ReservationController`) |
| **Trigger** | Atomic UPDATE returns `affected_rows = 0` (out of stock) |
| **Consumers** | StormShield (to update queue display), Notification Service |
| **Idempotency** | Consumer deduplicates via `eventId` |

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "ReservationFailed",
  "source":        "inventory-reservation-service",
  "timestamp":     "2026-10-05T10:01:30.000Z",
  "correlationId": "uuid-v4",
  "version":       "1.0",
  "data": {
    "productId":   "uuid",
    "customerId":  "uuid",
    "saleId":      "uuid",
    "reason":      "OUT_OF_STOCK",
    "attemptedAt": "2026-10-05T10:01:30.000Z"
  }
}
```

> [!NOTE]
> `ReservationFailed` is a best-effort event. The primary error signal is the synchronous `409` response. This event enables StormShield to update queue state and analytics to track failure rates.

---

## 6. InventoryDepleted

| Property | Value |
|----------|-------|
| **Event name** | `InventoryDepleted` |
| **Routing key** | `inventory.depleted` |
| **Producer** | Inventory & Reservation Service |
| **Trigger** | After a successful reservation, `available_quantity` drops to `0` |
| **Consumers** | StormShield, Sale Service |
| **Queues** | `stormshield.inventory-depleted`, `sale.inventory-depleted` |
| **DLQ** | `stormshield.inventory-depleted.dlq` |
| **Idempotency** | ⚠️ Critical: Consumer must be idempotent. Multiple `InventoryDepleted` events may be published in a burst (multiple requests completing simultaneously). Consumer must deduplicate via `eventId` AND check current state before acting. |

```json
{
  "eventId":       "uuid-v4",
  "eventType":     "InventoryDepleted",
  "source":        "inventory-reservation-service",
  "timestamp":     "2026-10-05T10:01:30.000Z",
  "correlationId": "uuid-v4",
  "version":       "1.0",
  "data": {
    "productId":   "uuid",
    "saleId":      "uuid",
    "depletedAt":  "2026-10-05T10:01:30.000Z",
    "totalSold":   100,
    "totalStock":  100
  }
}
```

**Consumer Action (StormShield):**
1. Set Redis flag: `SET ss:depleted:{saleId} 1 EX 3600`
2. Stop batch admission for this sale
3. Return "Currently Sold Out" to all queue status checks

**Consumer Action (Sale Service):** Mark sale as `STOCK_DEPLETED` (not ended — releases may occur).

---

## 7. Queue & Binding Summary

| Queue Name | Routing Key | Consumer | DLQ |
|-----------|-------------|---------|-----|
| `checkout.reservation-created` | `reservation.created` | Checkout Service | `checkout.reservation-created.dlq` |
| `notification.reservation-expired` | `reservation.expired` | Notification Service | `notification.reservation-expired.dlq` |
| `stormshield.reservation-released` | `reservation.released` | StormShield | `stormshield.reservation-released.dlq` |
| `sale.reservation-released` | `reservation.released` | Sale Service | `sale.reservation-released.dlq` |
| `stormshield.inventory-depleted` | `inventory.depleted` | StormShield | `stormshield.inventory-depleted.dlq` |
| `sale.inventory-depleted` | `inventory.depleted` | Sale Service | `sale.inventory-depleted.dlq` |

---

## 8. Events Consumed by Inventory & Reservation Service

| Event | Routing Key | Publisher | Action |
|-------|-------------|---------|--------|
| `PaymentConfirmed` | `payment.confirmed` | Payment Service | Transition reservation `PAYMENT_PENDING → CONFIRMED`. Mark inventory reserved_qty → sold_qty via `confirmSold()`. |
| `PaymentFailed` | `payment.failed` | Payment Service | Transition reservation `→ RELEASED`. Release stock via `releaseStock()`. Publish `ReservationReleased`. |
| `OrderConfirmed` | `order.confirmed` | Order Service | Transition reservation `CONFIRMED → SOLD`. Final stock accounting. |

---

## 9. Idempotency Rules for Event Consumers

```
ALGORITHM: Consumer idempotency

1. RECEIVE message from RabbitMQ
2. CHECK: SELECT 1 FROM processed_events WHERE event_id = message.eventId
   IF found → ACK message → RETURN (already processed)
3. BEGIN TRANSACTION
4. PROCESS event (update reservation status, update inventory)
5. INSERT INTO processed_events (event_id, event_type, processed_at)
6. COMMIT
7. ACK message

ON FAILURE (step 4–6):
  → ROLLBACK
  → NACK with requeue=true
  → RabbitMQ retries (up to 3 times with backoff)
  → After 3 failures: message → DLQ, alert triggered
```

> [!IMPORTANT]
> Steps 4 and 5 MUST be inside the same transaction. If `processed_events` INSERT fails after the business logic succeeds (split-brain), the consumer will re-process on retry and must handle idempotency of the business logic itself (e.g., `UPDATE ... WHERE status = 'PAYMENT_PENDING'` — no-op if already updated).
