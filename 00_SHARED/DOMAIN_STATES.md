# GlowRush — Domain States

> **Version:** 1.0 | **Status:** FROZEN | **Owner:** Student 1

---

## Purpose

This document defines all canonical state machines for the GlowRush platform. All students must use these exact states and transitions. Additional failure/cancellation states may be appended with team approval, but the successful lifecycle paths are **immucollection**.

---

## 1. Reservation States

```mermaid
stateDiagram-v2
    [*] --> RESERVED : Atomic UPDATE succeeds
    RESERVED --> PAYMENT_PENDING : Checkout initiated
    PAYMENT_PENDING --> CONFIRMED : PaymentConfirmed event
    CONFIRMED --> SOLD : Order confirmed

    RESERVED --> RELEASED : TTL expired (5 min)
    RESERVED --> RELEASED : Customer cancels
    PAYMENT_PENDING --> RELEASED : PaymentFailed event
    PAYMENT_PENDING --> RELEASED : TTL expired (5 min)

    RELEASED --> [*]
    SOLD --> [*]
```

### State Definitions

| State             | Description                                                  | Owner Service                   |
| ----------------- | ------------------------------------------------------------ | ------------------------------- |
| `RESERVED`        | Stock decremented, reservation active, awaiting checkout     | Inventory & Reservation Service |
| `PAYMENT_PENDING` | Checkout initiated, payment in progress                      | Inventory & Reservation Service |
| `CONFIRMED`       | Payment confirmed, stock transfer pending                    | Inventory & Reservation Service |
| `SOLD`            | Order created, stock permanently allocated                   | Inventory & Reservation Service |
| `RELEASED`        | Reservation cancelled/expired, stock returned to available   | Inventory & Reservation Service |

### Transition Rules

| From              | To                | Trigger                          | Side Effects                          |
| ----------------- | ----------------- | -------------------------------- | ------------------------------------- |
| — → RESERVED      | RESERVED          | Atomic MongoDB `affected_rows = 1`   | `available_quantity -= 1`, `reserved_quantity += 1` |
| RESERVED          | PAYMENT_PENDING   | Checkout confirms reservation    | None (status update only)             |
| PAYMENT_PENDING   | CONFIRMED         | `PaymentConfirmed` event         | None (status update only)             |
| CONFIRMED         | SOLD              | `OrderConfirmed` event           | `reserved_quantity -= 1`, `sold_quantity += 1` |
| RESERVED          | RELEASED          | TTL expiry / customer cancel     | `available_quantity += 1`, `reserved_quantity -= 1`, publish `ReservationReleased` |
| PAYMENT_PENDING   | RELEASED          | `PaymentFailed` event / TTL      | `available_quantity += 1`, `reserved_quantity -= 1`, publish `ReservationReleased` |

---

## 2. Order States

```mermaid
stateDiagram-v2
    [*] --> CREATED : PaymentConfirmed → Order created
    CREATED --> PAYMENT_PENDING : Awaiting payment reconciliation
    PAYMENT_PENDING --> CONFIRMED : Payment verified
    CONFIRMED --> PROCESSING : Fulfilment started
    PROCESSING --> SHIPPED : Carrier picked up
    SHIPPED --> OUT_FOR_DELIVERY : Last mile delivery
    OUT_FOR_DELIVERY --> DELIVERED : Customer received

    CREATED --> CANCELLED : Admin / system cancellation
    PAYMENT_PENDING --> CANCELLED : Payment timeout
    CONFIRMED --> CANCELLED : Pre-fulfilment cancellation

    DELIVERED --> [*]
    CANCELLED --> [*]
```

### State Definitions

| State              | Description                                              | Owner Service    |
| ------------------ | -------------------------------------------------------- | ---------------- |
| `CREATED`          | Order record persisted, pending payment reconciliation   | Order Service    |
| `PAYMENT_PENDING`  | Awaiting final payment confirmation                      | Order Service    |
| `CONFIRMED`        | Payment verified, ready for fulfilment                   | Order Service    |
| `PROCESSING`       | Fulfilment in progress (picking, packing)                | Order Service    |
| `SHIPPED`          | Handed to carrier, tracking number assigned              | Order Service    |
| `OUT_FOR_DELIVERY` | Last-mile delivery in progress                           | Order Service    |
| `DELIVERED`        | Customer received the package                            | Order Service    |
| `CANCELLED`        | Order cancelled (only from pre-shipment states)          | Order Service    |

---

## 3. Payment States

```mermaid
stateDiagram-v2
    [*] --> INITIATED : Payment request created
    INITIATED --> PROCESSING : Sent to gateway
    PROCESSING --> SUCCESS : Gateway confirms
    PROCESSING --> FAILED : Gateway rejects
    PROCESSING --> TIMEOUT : No response within threshold

    TIMEOUT --> PROCESSING : Retry attempt
    TIMEOUT --> FAILED : Max retries exceeded

    SUCCESS --> [*]
    FAILED --> [*]
```

### State Definitions

| State        | Description                                        | Owner Service    |
| ------------ | -------------------------------------------------- | ---------------- |
| `INITIATED`  | Payment record created with idempotency key        | Payment Service  |
| `PROCESSING` | Request sent to external payment gateway           | Payment Service  |
| `SUCCESS`    | Gateway confirmed payment                          | Payment Service  |
| `FAILED`     | Gateway rejected or max retries exceeded           | Payment Service  |
| `TIMEOUT`    | No gateway response within threshold               | Payment Service  |

---

## 4. Shipment States

```mermaid
stateDiagram-v2
    [*] --> CREATED : Fulfilment hands off to shipping
    CREATED --> LABEL_GENERATED : Shipping label created
    LABEL_GENERATED --> DISPATCHED : Carrier picked up
    DISPATCHED --> IN_TRANSIT : In carrier network
    IN_TRANSIT --> OUT_FOR_DELIVERY : Last mile
    OUT_FOR_DELIVERY --> DELIVERED : Delivery confirmed
    
    IN_TRANSIT --> RETURNED : Delivery failed
    OUT_FOR_DELIVERY --> RETURNED : Delivery failed

    DELIVERED --> [*]
    RETURNED --> [*]
```

---

## 5. StormShield Queue States

```mermaid
stateDiagram-v2
    [*] --> QUEUED : Customer enters flash sale
    QUEUED --> ADMITTED : Batch admission
    ADMITTED --> TOKEN_ISSUED : Admission token generated
    TOKEN_ISSUED --> EXPIRED : Token TTL (60s) elapsed
    TOKEN_ISSUED --> CONSUMED : Used for reservation attempt

    QUEUED --> REJECTED : Sale ended / sold out
    
    CONSUMED --> [*]
    EXPIRED --> [*]
    REJECTED --> [*]
```

| State          | Description                                    | Storage |
| -------------- | ---------------------------------------------- | ------- |
| `QUEUED`       | Customer in waiting room, has queue position    | Redis   |
| `ADMITTED`     | Selected for current batch                      | Redis   |
| `TOKEN_ISSUED` | Short-lived JWT issued (60s TTL)               | Redis   |
| `CONSUMED`     | Token used to attempt inventory reservation    | Redis   |
| `EXPIRED`      | Token TTL elapsed without use                  | Redis   |
| `REJECTED`     | Sale ended or all stock depleted               | Redis   |

---

## 6. Invariants

These must hold true at ALL times:

```
available_quantity >= 0                          -- NEVER negative
reserved_quantity >= 0                           -- NEVER negative
sold_quantity >= 0                               -- NEVER negative
available_quantity + reserved_quantity + sold_quantity = initial_stock
count(successful_sales) <= initial_stock         -- NEVER oversold
```

---

## 7. Cross-State Dependencies

```mermaid
graph TD
    RS[Reservation: RESERVED] -->|checkout| RS2[Reservation: PAYMENT_PENDING]
    RS2 -->|PaymentConfirmed| RS3[Reservation: CONFIRMED]
    RS3 -->|OrderConfirmed| RS4[Reservation: SOLD]
    
    RS2 -->|PaymentFailed| RS5[Reservation: RELEASED]
    
    PS[Payment: INITIATED] --> PS2[Payment: PROCESSING]
    PS2 -->|success| PS3[Payment: SUCCESS]
    PS3 -->|event| RS3
    
    PS2 -->|failure| PS4[Payment: FAILED]
    PS4 -->|event| RS5
    
    RS3 --> OS[Order: CREATED]
    OS --> OS2[Order: CONFIRMED]
    OS2 --> OS3[Order: PROCESSING]
    OS3 --> OS4[Order: SHIPPED]
```
