# GlowRush — Event Catalogue (Student 3 Additions)

> **Owner:** Student 3 (extending Student 1's EVENT_CONTRACT v1.0)
> **Version:** 2.0 | **Status:** FINAL
> **Note:** This document EXTENDS 00_SHARED/EVENT_CONTRACT.md with Student 3's additional events.
> All events from Student 1 (PaymentConfirmed, PaymentFailed, OrderCreated, etc.) remain unchanged.
> Do NOT duplicate events already defined in EVENT_CONTRACT.md.

---

## Infrastructure

All events use the same envelope and infrastructure defined in `EVENT_CONTRACT.md`:

- Exchange: `glowrush.events` (topic)
- Dead Letter Exchange: `glowrush.events.dlx`
- Retry policy: 3 attempts — 1s → 5s → 25s (exponential backoff)
- Idempotency: consumer-side deduplication via `processed_events` table

---

## Standard Event Envelope (from EVENT_CONTRACT.md)

```json
{
  "eventId": "uuid-v4",
  "eventType": "PaymentConfirmed",
  "source": "payment-service",
  "timestamp": "2026-10-05T10:00:00.000Z",
  "correlationId": "uuid-v4",
  "version": "1.0",
  "data": { }
}
```

---

## Complete Event Catalogue

### Event 1 — ReservationCreated  *(Publisher: Inventory & Reservation Service)*

| Property | Value |
|----------|-------|
| Routing Key | `reservation.created` |
| Publisher | Inventory & Reservation Service |
| Consumers | Checkout Service (session state) |
| Trigger | Atomic inventory UPDATE `affected_rows = 1` |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | Consumer checks `processed_events` for `eventId` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "ReservationCreated",
  "source": "inventory-reservation-service",
  "timestamp": "2026-10-05T10:00:00.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "reservationId": "uuid",
    "productId":     "uuid",
    "customerId":    "uuid",
    "quantity":      1,
    "status":        "RESERVED",
    "expiresAt":     "2026-10-05T10:05:00.000Z",
    "idempotencyKey":"uuid"
  }
}
```

---

### Event 2 — ReservationConfirmed  *(Publisher: Inventory & Reservation Service)*

| Property | Value |
|----------|-------|
| Routing Key | `reservation.confirmed` |
| Publisher | Inventory & Reservation Service |
| Consumers | Checkout Service |
| Trigger | `PaymentConfirmed` event processed — reservation → `CONFIRMED` |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | Consumer checks `processed_events` for `eventId` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "ReservationConfirmed",
  "source": "inventory-reservation-service",
  "timestamp": "2026-10-05T10:00:20.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "reservationId": "uuid",
    "productId":     "uuid",
    "customerId":    "uuid",
    "confirmedAt":   "2026-10-05T10:00:20.000Z"
  }
}
```

---

### Event 3 — ReservationExpired  *(Publisher: Inventory & Reservation Service)*

Already defined in `EVENT_CONTRACT.md §3.3`. Reproduced for completeness.

| Property | Value |
|----------|-------|
| Routing Key | `reservation.expired` |
| Publisher | Inventory & Reservation Service |
| Consumers | Notification Service |
| Trigger | 5-minute TTL elapsed without payment |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | Consumer checks `processed_events` for `eventId` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "ReservationExpired",
  "source": "inventory-reservation-service",
  "timestamp": "2026-10-05T10:05:00.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "reservationId": "uuid",
    "productId":     "uuid",
    "customerId":    "uuid",
    "quantity":      1,
    "expiredAt":     "2026-10-05T10:05:00.000Z"
  }
}
```

---

### Event 4 — ReservationReleased  *(Publisher: Inventory & Reservation Service)*

Already defined in `EVENT_CONTRACT.md §3.4`. Reproduced for completeness.

| Property | Value |
|----------|-------|
| Routing Key | `reservation.released` |
| Publisher | Inventory & Reservation Service |
| Consumers | StormShield, Sale Service |
| Trigger | Stock returned to available pool (expiry / cancel / payment failure) |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | Consumer checks `processed_events` for `eventId` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "ReservationReleased",
  "source": "inventory-reservation-service",
  "timestamp": "2026-10-05T10:05:05.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "reservationId":     "uuid",
    "productId":         "uuid",
    "quantityReleased":  1,
    "availableQuantity": 5,
    "reason":            "expired | cancelled | payment_failed"
  }
}
```

---

### Event 5 — PaymentInitiated  *(Publisher: Payment Service)*

| Property | Value |
|----------|-------|
| Routing Key | `payment.initiated` |
| Publisher | Payment Service |
| Consumers | Monitoring / Observability (audit trail) |
| Trigger | Payment record inserted into database |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | `eventId` checked against `processed_events` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "PaymentInitiated",
  "source": "payment-service",
  "timestamp": "2026-10-05T10:00:05.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "paymentId":      "uuid",
    "reservationId":  "uuid",
    "customerId":     "uuid",
    "amount":         2999,
    "currency":       "INR",
    "provider":       "razorpay",
    "idempotencyKey": "uuid"
  }
}
```

---

### Event 6 — PaymentSucceeded  *(Publisher: Payment Service — internal audit)*

| Property | Value |
|----------|-------|
| Routing Key | `payment.succeeded` |
| Publisher | Payment Service |
| Consumers | Monitoring / Observability |
| Trigger | Gateway confirms capture (pre-`PaymentConfirmed` internal event) |
| Retry Rule | 3 retries |
| Idempotency Rule | `eventId` checked against `processed_events` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "PaymentSucceeded",
  "source": "payment-service",
  "timestamp": "2026-10-05T10:00:15.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "paymentId":            "uuid",
    "reservationId":        "uuid",
    "customerId":           "uuid",
    "transactionReference": "rzp_live_abc123",
    "amount":               2999,
    "currency":             "INR",
    "provider":             "razorpay"
  }
}
```

---

### Event 7 — PaymentFailed  *(Publisher: Payment Service)*

Already defined in `EVENT_CONTRACT.md §3.2`. Extended payload below.

| Property | Value |
|----------|-------|
| Routing Key | `payment.failed` |
| Publisher | Payment Service |
| Consumers | Inventory & Reservation Service, Notification Service |
| Trigger | Gateway rejects OR max retries exceeded |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | Consumer deduplication via `eventId` in `processed_events` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "PaymentFailed",
  "source": "payment-service",
  "timestamp": "2026-10-05T10:00:20.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "paymentId":      "uuid",
    "reservationId":  "uuid",
    "customerId":     "uuid",
    "reason":         "insufficient_funds | card_declined | expired_card | gateway_error",
    "idempotencyKey": "uuid"
  }
}
```

---

### Event 8 — PaymentTimedOut  *(Publisher: Payment Service)*

| Property | Value |
|----------|-------|
| Routing Key | `payment.timed_out` |
| Publisher | Payment Service |
| Consumers | Monitoring / Alerting (NOT inventory — do not release on timeout) |
| Trigger | No webhook received within 30s threshold |
| Retry Rule | Not retried — informational only |
| Idempotency Rule | N/A (monitoring consumer is idempotent by design) |

```json
{
  "eventId": "uuid-v4",
  "eventType": "PaymentTimedOut",
  "source": "payment-service",
  "timestamp": "2026-10-05T10:00:45.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "paymentId":      "uuid",
    "reservationId":  "uuid",
    "customerId":     "uuid",
    "timedOutAt":     "2026-10-05T10:00:45.000Z",
    "provider":       "razorpay",
    "reconciliationScheduledAt": "2026-10-05T10:01:45.000Z"
  }
}
```

---

### Event 9 — PaymentConfirmed  *(Publisher: Payment Service)*

Already fully defined in `EVENT_CONTRACT.md §3.1`. Reproduced for reference.

| Property | Value |
|----------|-------|
| Routing Key | `payment.confirmed` |
| Publisher | Payment Service |
| Consumers | Order Service, Inventory & Reservation Service |
| Trigger | External gateway confirms payment success |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | Consumer deduplication via `eventId`; `orders.reservation_id UNIQUE` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "PaymentConfirmed",
  "source": "payment-service",
  "timestamp": "2026-10-05T10:00:15.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "paymentId":            "uuid",
    "reservationId":        "uuid",
    "customerId":           "uuid",
    "amount":               2999,
    "currency":             "INR",
    "gatewayRef":           "rzp_live_abc123",
    "idempotencyKey":       "uuid"
  }
}
```

---

### Event 10 — OrderCreated  *(Publisher: Order Service)*

Already defined in `EVENT_CONTRACT.md §3.6`. Reproduced for completeness.

| Property | Value |
|----------|-------|
| Routing Key | `order.created` |
| Publisher | Order Service |
| Consumers | Fulfilment Service |
| Trigger | Order record persisted after `PaymentConfirmed` |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | `fulfilments.order_id UNIQUE` prevents duplicate fulfilments |

```json
{
  "eventId": "uuid-v4",
  "eventType": "OrderCreated",
  "source": "order-service",
  "timestamp": "2026-10-05T10:00:30.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "orderId":         "uuid",
    "customerId":      "uuid",
    "reservationId":   "uuid",
    "paymentId":       "uuid",
    "items": [
      {
        "productId":   "uuid",
        "productName": "Vitamin C Serum",
        "quantity":    1,
        "unitPrice":   2999
      }
    ],
    "totalAmount":     2999,
    "shippingAddress": { }
  }
}
```

---

### Event 11 — OrderConfirmed  *(Publisher: Order Service)*

Already defined in `EVENT_CONTRACT.md §3.7`.

| Property | Value |
|----------|-------|
| Routing Key | `order.confirmed` |
| Publisher | Order Service |
| Consumers | Notification Service, Inventory & Reservation Service |
| Trigger | Payment fully reconciled with order |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | Consumer deduplication via `eventId` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "OrderConfirmed",
  "source": "order-service",
  "timestamp": "2026-10-05T10:01:00.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "orderId":      "uuid",
    "customerId":   "uuid",
    "confirmedAt":  "2026-10-05T10:01:00.000Z"
  }
}
```

---

### Event 12 — ShipmentCreated  *(Publisher: Fulfilment Service)*

Already defined in `EVENT_CONTRACT.md §3.8`. Reproduced for completeness.

| Property | Value |
|----------|-------|
| Routing Key | `shipment.created` |
| Publisher | Fulfilment Service |
| Consumers | Shipment Service |
| Trigger | Fulfilment completed — shipment label ready |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | `shipments.fulfilment_id` lookup before insert |

```json
{
  "eventId": "uuid-v4",
  "eventType": "ShipmentCreated",
  "source": "fulfilment-service",
  "timestamp": "2026-10-06T08:00:00.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "shipmentId":      "uuid",
    "orderId":         "uuid",
    "fulfilmentId":    "uuid",
    "items":           [],
    "shippingAddress": { }
  }
}
```

---

### Event 13 — NotificationRequested  *(Publisher: Any service)*

| Property | Value |
|----------|-------|
| Routing Key | `notification.requested` |
| Publisher | Any service that needs to notify a customer |
| Consumers | Notification Service |
| Trigger | Any business event requiring customer communication |
| Retry Rule | 3 retries — 1s, 5s, 25s |
| Idempotency Rule | `notifications` table deduplication by `event_type + customerId + correlationId` |

```json
{
  "eventId": "uuid-v4",
  "eventType": "NotificationRequested",
  "source": "order-service",
  "timestamp": "2026-10-05T10:01:00.000Z",
  "correlationId": "corr-001",
  "version": "1.0",
  "data": {
    "customerId":    "uuid",
    "channels":      ["email", "sms"],
    "templateId":    "order_confirmed",
    "templateData": {
      "orderId":     "uuid",
      "productName": "Vitamin C Serum",
      "totalAmount": 2999,
      "currency":    "INR"
    }
  }
}
```

---

## Queue & Binding Reference (Student 3 Additions)

| Queue Name | Routing Key | Consumer | DLQ |
|-----------|-------------|---------|-----|
| `order.payment-confirmed` | `payment.confirmed` | Order Service | `order.payment-confirmed.dlq` |
| `inventory.payment-confirmed` | `payment.confirmed` | Inventory & Reservation Service | `inventory.payment-confirmed.dlq` |
| `inventory.payment-failed` | `payment.failed` | Inventory & Reservation Service | `inventory.payment-failed.dlq` |
| `notification.payment-failed` | `payment.failed` | Notification Service | `notification.payment-failed.dlq` |
| `fulfilment.order-created` | `order.created` | Fulfilment Service | `fulfilment.order-created.dlq` |
| `inventory.order-confirmed` | `order.confirmed` | Inventory & Reservation Service | `inventory.order-confirmed.dlq` |
| `notification.order-confirmed` | `order.confirmed` | Notification Service | `notification.order-confirmed.dlq` |
| `shipment.shipment-created` | `shipment.created` | Shipment Service | `shipment.shipment-created.dlq` |
| `monitoring.payment-timed-out` | `payment.timed_out` | Monitoring/Alerting | `monitoring.payment-timed-out.dlq` |
| `notification.requested` | `notification.requested` | Notification Service | `notification.requested.dlq` |
