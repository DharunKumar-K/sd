# GlowRush — Event Contract

> **Version:** 1.0 | **Status:** FROZEN | **Owner:** Student 1

---

## 1. Messaging Infrastructure

| Property         | Value                                             |
| ---------------- | ------------------------------------------------- |
| Broker           | RabbitMQ                                          |
| Exchange Type    | Topic exchange                                    |
| Exchange Name    | `glowrush.events`                                 |
| Message Format   | JSON                                              |
| Durability       | Durable queues, persistent messages               |
| Acknowledgement  | Manual ack (consumer confirms processing)         |
| Dead Letter      | `glowrush.events.dlx` exchange → `*.dlq` queues  |
| Retry Policy     | 3 retries with exponential backoff (1s, 5s, 25s)  |
| Idempotency      | Consumer-side deduplication via `eventId`          |

---

## 2. Standard Event Envelope

Every event published to RabbitMQ MUST use this envelope:

```json
{
  "eventId": "uuid-v4",
  "eventType": "PaymentConfirmed",
  "source": "payment-service",
  "timestamp": "2026-10-05T10:00:00.000Z",
  "correlationId": "uuid-v4",
  "version": "1.0",
  "data": {
    // event-specific payload
  }
}
```

| Field           | Type   | Required | Description                                    |
| --------------- | ------ | -------- | ---------------------------------------------- |
| `eventId`       | UUID   | Yes      | Unique per event instance (for deduplication)  |
| `eventType`     | String | Yes      | Event name (matches routing key)               |
| `source`        | String | Yes      | Publishing service name (kebab-case)           |
| `timestamp`     | ISO    | Yes      | When the event was created                     |
| `correlationId` | UUID   | Yes      | From original HTTP `X-Correlation-ID`          |
| `version`       | String | Yes      | Event schema version                           |
| `data`          | Object | Yes      | Event-specific payload                         |

---

## 3. Event Catalog

### 3.1 PaymentConfirmed

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `payment.confirmed`                                |
| Publisher        | Payment Service                                   |
| Consumers       | Order Service, Inventory & Reservation Service    |
| Trigger         | External payment gateway confirms success          |

```json
{
  "data": {
    "paymentId": "uuid",
    "reservationId": "uuid",
    "customerId": "uuid",
    "amount": 2999,
    "currency": "INR",
    "gatewayRef": "gateway_txn_id",
    "idempotencyKey": "uuid"
  }
}
```

### 3.2 PaymentFailed

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `payment.failed`                                   |
| Publisher        | Payment Service                                   |
| Consumers       | Inventory & Reservation Service, Notification     |
| Trigger         | Payment gateway rejects or max retries exceeded    |

```json
{
  "data": {
    "paymentId": "uuid",
    "reservationId": "uuid",
    "customerId": "uuid",
    "reason": "insufficient_funds",
    "idempotencyKey": "uuid"
  }
}
```

### 3.3 ReservationExpired

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `reservation.expired`                              |
| Publisher        | Inventory & Reservation Service                   |
| Consumers       | Notification Service                              |
| Trigger         | 5-minute TTL elapsed without payment               |

```json
{
  "data": {
    "reservationId": "uuid",
    "productId": "uuid",
    "customerId": "uuid",
    "quantity": 1,
    "expiredAt": "2026-10-05T10:05:00.000Z"
  }
}
```

### 3.4 ReservationReleased

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `reservation.released`                             |
| Publisher        | Inventory & Reservation Service                   |
| Consumers       | StormShield, Sale Service                         |
| Trigger         | Stock returned to available pool (expiry/cancel/fail)|

```json
{
  "data": {
    "reservationId": "uuid",
    "productId": "uuid",
    "quantityReleased": 1,
    "availableQuantity": 5,
    "reason": "expired | cancelled | payment_failed"
  }
}
```

### 3.5 InventoryDepleted

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `inventory.depleted`                               |
| Publisher        | Inventory & Reservation Service                   |
| Consumers       | StormShield, Sale Service                         |
| Trigger         | `available_quantity` reaches 0                     |

```json
{
  "data": {
    "productId": "uuid",
    "saleId": "uuid",
    "depletedAt": "2026-10-05T10:01:30.000Z"
  }
}
```

### 3.6 OrderCreated

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `order.created`                                    |
| Publisher        | Order Service                                     |
| Consumers       | Fulfilment Service                                |
| Trigger         | Order record persisted after `PaymentConfirmed`    |

```json
{
  "data": {
    "orderId": "uuid",
    "customerId": "uuid",
    "reservationId": "uuid",
    "paymentId": "uuid",
    "items": [
      {
        "productId": "uuid",
        "productName": "Vitamin C Serum",
        "quantity": 1,
        "unitPrice": 2999
      }
    ],
    "totalAmount": 2999,
    "shippingAddress": { }
  }
}
```

### 3.7 OrderConfirmed

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `order.confirmed`                                  |
| Publisher        | Order Service                                     |
| Consumers       | Notification Service, Inventory & Reservation     |
| Trigger         | Payment fully reconciled with order                |

```json
{
  "data": {
    "orderId": "uuid",
    "customerId": "uuid",
    "confirmedAt": "2026-10-05T10:02:00.000Z"
  }
}
```

### 3.8 ShipmentCreated

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `shipment.created`                                 |
| Publisher        | Fulfilment Service                                |
| Consumers       | Shipment Service                                  |
| Trigger         | Fulfilment completed, ready for shipping           |

```json
{
  "data": {
    "shipmentId": "uuid",
    "orderId": "uuid",
    "fulfilmentId": "uuid",
    "items": [],
    "shippingAddress": { }
  }
}
```

### 3.9 ShipmentDispatched

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `shipment.dispatched`                              |
| Publisher        | Shipment Service                                  |
| Consumers       | Notification Service, Order Service               |
| Trigger         | Carrier picks up package                           |

```json
{
  "data": {
    "shipmentId": "uuid",
    "orderId": "uuid",
    "trackingNumber": "TRACK123456",
    "carrier": "BlueDart",
    "estimatedDelivery": "2026-10-08T18:00:00.000Z"
  }
}
```

### 3.10 ShipmentDelivered

| Property        | Value                                              |
| --------------- | -------------------------------------------------- |
| Routing Key     | `shipment.delivered`                               |
| Publisher        | Shipment Service                                  |
| Consumers       | Order Service, Notification Service               |
| Trigger         | Delivery confirmed by carrier                      |

```json
{
  "data": {
    "shipmentId": "uuid",
    "orderId": "uuid",
    "deliveredAt": "2026-10-08T14:30:00.000Z",
    "signedBy": "Customer Name"
  }
}
```

---

## 4. Queue & Binding Configuration

| Queue Name                       | Routing Key            | Consumer                        | DLQ                              |
| -------------------------------- | ---------------------- | ------------------------------- | -------------------------------- |
| `order.payment-confirmed`        | `payment.confirmed`    | Order Service                   | `order.payment-confirmed.dlq`    |
| `inventory.payment-confirmed`    | `payment.confirmed`    | Inventory & Reservation Service | `inventory.payment-confirmed.dlq`|
| `inventory.payment-failed`       | `payment.failed`       | Inventory & Reservation Service | `inventory.payment-failed.dlq`   |
| `notification.reservation-expired`| `reservation.expired` | Notification Service            | `notification.reservation-expired.dlq` |
| `stormshield.reservation-released`| `reservation.released`| StormShield                     | `stormshield.reservation-released.dlq` |
| `stormshield.inventory-depleted` | `inventory.depleted`   | StormShield                     | `stormshield.inventory-depleted.dlq` |
| `fulfilment.order-created`       | `order.created`        | Fulfilment Service              | `fulfilment.order-created.dlq`   |
| `shipment.shipment-created`      | `shipment.created`     | Shipment Service                | `shipment.shipment-created.dlq`  |
| `notification.order-confirmed`   | `order.confirmed`      | Notification Service            | `notification.order-confirmed.dlq` |
| `notification.shipment-dispatched`| `shipment.dispatched` | Notification Service            | `notification.shipment-dispatched.dlq` |
| `order.shipment-delivered`       | `shipment.delivered`   | Order Service                   | `order.shipment-delivered.dlq`   |
| `notification.shipment-delivered` | `shipment.delivered`  | Notification Service            | `notification.shipment-delivered.dlq` |

---

## 5. Dead Letter Queue Policy

```
Original Queue
     ↓ (message rejected / max retries exceeded)
Dead Letter Exchange (glowrush.events.dlx)
     ↓
Dead Letter Queue (<service>.<event>.dlq)
     ↓
Alert triggered (Observability)
     ↓
Manual review / reconciliation job
```

- Max retries per message: **3**
- Backoff: **1s → 5s → 25s** (exponential)
- Messages in DLQ trigger alerts in monitoring
- Reconciliation job processes DLQ messages daily

---

## 6. Consumer Idempotency

Every consumer MUST:

1. Check if `eventId` has been processed (lookup in `processed_events` table or Redis set)
2. If already processed → ACK and skip
3. If new → process → record `eventId` → ACK
4. If processing fails → NACK with requeue (up to max retries)

```sql
-- Example: processed events tracking
CREATE TABLE processed_events (
    event_id   UUID PRIMARY KEY,
    event_type VARCHAR(100) NOT NULL,
    processed_at TIMESTAMPTZ DEFAULT NOW()
);
```
