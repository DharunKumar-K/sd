# GlowRush — Inventory & Reservation Service: Sequence Diagrams

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL

---

## 1. Purchase / Reservation Sequence — Happy Path

This diagram shows a single successful reservation through the full system, from the customer's "Buy Now" click to a confirmed reservation with TTL.

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant GW as API Gateway
    participant SS as StormShield
    participant RC as ReservationController
    participant CF as CheckoutFacade
    participant IDS as IdempotencyService
    participant IP as InventoryPolicy
    participant ACS as AtomicConditionalStrategy
    participant RS as ReservationService
    participant REP as ReservationEventPublisher
    participant PG as PostgreSQL
    participant REDIS as Redis
    participant RMQOUT as RabbitMQ

    Customer->>GW: POST /api/v1/reservations<br/>Authorization: Bearer JWT<br/>X-Idempotency-Key: idem-key-A<br/>{ productId, quantity: 1 }

    GW->>GW: Validate JWT, add X-Correlation-ID
    GW->>SS: Validate admission token (X-Admission-Token)
    SS-->>GW: 200 OK — token valid, not used

    GW->>RC: forward request

    RC->>CF: reserve(CreateReservationDTO)

    Note over CF: Step 1 — Idempotency Check
    CF->>IDS: check("idem-key-A")
    IDS->>PG: SELECT * FROM processed_events WHERE event_id = 'idem-key-A'
    PG-->>IDS: null (not found — first request)
    IDS-->>CF: MISS

    Note over CF: Step 2 — Policy Enforcement
    CF->>IP: canReserve(qty=1, productId)
    IP-->>CF: OK

    Note over CF: Step 3 — Atomic Inventory Reserve (BEGIN TRANSACTION)
    CF->>PG: BEGIN TRANSACTION
    CF->>ACS: reserve(productId, qty=1)
    ACS->>PG: UPDATE inventory<br/>SET available_quantity = available_quantity - 1,<br/>    reserved_quantity = reserved_quantity + 1,<br/>    version = version + 1,<br/>    updated_at = NOW()<br/>WHERE product_id = :productId<br/>AND available_quantity >= 1
    PG-->>ACS: affected_rows = 1 ✓ (stock decremented)

    Note over CF: Step 4 — Create Reservation Record
    CF->>RS: createReservation(dto)
    RS->>PG: INSERT INTO inventory_reservation<br/>(reservation_id, product_id, customer_id,<br/> quantity, status='RESERVED',<br/> idempotency_key, expires_at=NOW()+5min,<br/> created_at=NOW())<br/>ON CONFLICT (idempotency_key) DO NOTHING<br/>RETURNING *
    PG-->>RS: Reservation { reservationId, status: RESERVED, expiresAt }
    RS-->>CF: reservation

    Note over CF: Step 5 — Record Idempotency
    CF->>IDS: record("idem-key-A", reservationId)
    IDS->>PG: INSERT INTO processed_events (event_id, event_type, processed_at)
    PG-->>IDS: OK

    CF->>PG: COMMIT TRANSACTION

    Note over CF: Step 6 — Cache Invalidate
    CF->>REDIS: DEL inventory:availability:{productId}

    Note over CF: Step 7 — Publish Event (post-commit)
    CF->>REP: publish(ReservationCreated)
    REP->>RMQOUT: exchange=glowrush.events<br/>routingKey=reservation.created<br/>{ eventId, reservationId, productId, customerId, expiresAt }

    CF-->>RC: ReservationResponseDTO
    RC-->>GW: 201 Created<br/>{ reservationId, status: "RESERVED", expiresAt: "+5min" }
    GW-->>Customer: 201 Created
```

---

## 2. Reservation Sequence — Sold Out (Last Item Race)

This is the critical failure scenario: **Customer A and Customer B** simultaneously attempt to reserve the **last remaining unit** (available_quantity = 1).

```mermaid
sequenceDiagram
    autonumber
    participant A_RC as Request A<br/>ReservationController
    participant B_RC as Request B<br/>ReservationController
    participant A_ACS as Request A<br/>AtomicConditionalStrategy
    participant B_ACS as Request B<br/>AtomicConditionalStrategy
    participant PG as PostgreSQL<br/>Row Lock Manager

    Note over A_ACS, PG: available_quantity = 1 at this moment

    par Request A and Request B arrive simultaneously
        A_ACS->>PG: UPDATE inventory<br/>SET available_quantity = available_quantity - 1,<br/>    reserved_quantity = reserved_quantity + 1<br/>WHERE available_quantity >= 1
    and
        B_ACS->>PG: UPDATE inventory<br/>SET available_quantity = available_quantity - 1,<br/>    reserved_quantity = reserved_quantity + 1<br/>WHERE available_quantity >= 1
    end

    Note over PG: PostgreSQL serializes both UPDATEs at the row lock level.<br/>One acquires the exclusive lock first. The other WAITS.

    PG-->>A_ACS: LOCK ACQUIRED → WHERE available_quantity(1) >= 1 → TRUE<br/>available_quantity = 0, version++<br/>affected_rows = 1 ✓ COMMIT

    Note over PG: Request A committed. available_quantity is now 0.

    PG-->>B_ACS: LOCK ACQUIRED → WHERE available_quantity(0) >= 1 → FALSE<br/>No rows updated<br/>affected_rows = 0 ✗

    A_ACS-->>A_RC: ReservationResult { success: true }
    A_RC-->>A_RC: INSERT reservation, status=RESERVED
    A_RC->>A_RC: 201 Created { reservationId, expiresAt }

    B_ACS-->>B_RC: ReservationResult { success: false, reason: "OUT_OF_STOCK" }
    B_RC->>B_RC: No reservation created
    B_RC-->>B_RC: 409 Conflict { error: "OUT_OF_STOCK", message: "Currently Sold Out" }

    Note over A_RC: Exactly ONE reservation created.<br/>available_quantity never went negative.
```

---

## 3. Duplicate Request (Idempotency) Sequence

```mermaid
sequenceDiagram
    autonumber
    actor Customer
    participant RC as ReservationController
    participant CF as CheckoutFacade
    participant IDS as IdempotencyService
    participant PG as PostgreSQL

    Note over Customer: Network glitch — customer re-sends the same request

    Customer->>RC: POST /api/v1/reservations<br/>X-Idempotency-Key: idem-key-A (same key, 2nd attempt)

    RC->>CF: reserve(dto)

    CF->>IDS: check("idem-key-A")
    IDS->>PG: SELECT result FROM processed_events WHERE event_id = 'idem-key-A'
    PG-->>IDS: { reservationId: "res-001", status: "RESERVED" }
    IDS-->>CF: HIT — return cached result

    Note over CF: Short-circuit! No inventory update. No new INSERT.
    CF-->>RC: existing ReservationResponseDTO (same data as first request)
    RC-->>Customer: 200 OK (not 201)<br/>{ reservationId: "res-001", status: "RESERVED" }<br/>X-Idempotent-Replayed: true

    Note over Customer: Customer receives identical response.<br/>Only ONE reservation exists in the database.
```

---

## 4. Reservation Expiry Worker Sequence

```mermaid
sequenceDiagram
    autonumber
    participant CRON as ReservationExpiryWorker<br/>(runs every 30 seconds)
    participant PG as PostgreSQL
    participant REP as ReservationEventPublisher
    participant RMQOUT as RabbitMQ
    participant NS as Notification Service
    participant SS as StormShield

    loop Every 30 seconds
        CRON->>PG: BEGIN TRANSACTION

        CRON->>PG: UPDATE inventory_reservation<br/>SET status = 'RELEASED', updated_at = NOW()<br/>WHERE status IN ('RESERVED', 'PAYMENT_PENDING')<br/>AND expires_at < NOW()<br/>RETURNING reservation_id, product_id, customer_id, quantity

        PG-->>CRON: [{ reservationId: R1, productId: P1, qty: 1 },<br/>             { reservationId: R2, productId: P1, qty: 1 }]

        loop For each expired reservation
            CRON->>PG: UPDATE inventory<br/>SET available_quantity = available_quantity + :qty,<br/>    reserved_quantity = reserved_quantity - :qty,<br/>    version = version + 1,<br/>    updated_at = NOW()<br/>WHERE product_id = :productId
            PG-->>CRON: OK
        end

        CRON->>PG: COMMIT TRANSACTION

        loop For each released reservation (post-commit)
            CRON->>REP: publish(ReservationExpired { reservationId, customerId, expiredAt })
            REP->>RMQOUT: routingKey=reservation.expired
            RMQOUT->>NS: Notify customer "Your reservation expired"

            CRON->>REP: publish(ReservationReleased { reservationId, productId, availableQuantity, reason: "expired" })
            REP->>RMQOUT: routingKey=reservation.released
            RMQOUT->>SS: Stock returned — admit next queued user
        end
    end

    Note over CRON: If available_quantity reaches > 0<br/>after releases, publish InventoryAvailable event.<br/>StormShield re-admits from queue.
```

---

## 5. Payment Confirmed — Reservation → SOLD

```mermaid
sequenceDiagram
    autonumber
    participant PAY as Payment Service
    participant RMQIN as RabbitMQ
    participant EH as EventConsumerHandler
    participant IDS as IdempotencyService
    participant RS as ReservationService
    participant IS as InventoryService
    participant PG as PostgreSQL
    participant REP as ReservationEventPublisher

    PAY->>RMQIN: publish PaymentConfirmed<br/>{ eventId, paymentId, reservationId, customerId }
    RMQIN->>EH: deliver message (manual ack)

    EH->>IDS: check(eventId)
    IDS->>PG: SELECT FROM processed_events WHERE event_id = eventId
    PG-->>IDS: null (first time)
    IDS-->>EH: MISS

    EH->>RS: confirmReservation(reservationId)
    RS->>PG: UPDATE inventory_reservation<br/>SET status = 'CONFIRMED'<br/>WHERE reservation_id = :id AND status = 'PAYMENT_PENDING'
    PG-->>RS: OK

    EH->>IS: confirmSold(productId, qty)
    IS->>PG: UPDATE inventory<br/>SET reserved_quantity = reserved_quantity - 1,<br/>    sold_quantity = sold_quantity + 1,<br/>    version = version + 1<br/>WHERE product_id = :productId
    PG-->>IS: OK

    EH->>RS: transitionTo(SOLD)
    RS->>PG: UPDATE inventory_reservation SET status = 'SOLD'
    PG-->>RS: OK

    EH->>IDS: record(eventId, "processed")
    EH->>RMQIN: ACK message
```

---

## 6. Payment Failed — Stock Released

```mermaid
sequenceDiagram
    autonumber
    participant PAY as Payment Service
    participant RMQIN as RabbitMQ
    participant EH as EventConsumerHandler
    participant RS as ReservationService
    participant IS as InventoryService
    participant PG as PostgreSQL
    participant REP as ReservationEventPublisher
    participant RMQOUT as RabbitMQ Out

    PAY->>RMQIN: publish PaymentFailed<br/>{ eventId, reservationId, reason: "insufficient_funds" }
    RMQIN->>EH: deliver

    EH->>RS: processPaymentFailure(reservationId)
    RS->>PG: UPDATE inventory_reservation<br/>SET status = 'RELEASED'<br/>WHERE reservation_id = :id<br/>AND status IN ('RESERVED', 'PAYMENT_PENDING')
    PG-->>RS: Reservation { productId, quantity }

    EH->>IS: releaseStock(productId, quantity)
    IS->>PG: UPDATE inventory<br/>SET available_quantity = available_quantity + :qty,<br/>    reserved_quantity = reserved_quantity - :qty,<br/>    version = version + 1<br/>WHERE product_id = :productId
    PG-->>IS: OK

    EH->>REP: publish(ReservationReleased { reservationId, productId, availableQuantity, reason: "payment_failed" })
    REP->>RMQOUT: routingKey=reservation.released
    RMQOUT-->>SS: Admit next customer from queue

    EH->>RMQIN: ACK message
```
