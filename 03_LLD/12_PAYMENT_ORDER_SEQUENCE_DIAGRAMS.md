# GlowRush — Payment, Order & Recovery Sequence Diagrams

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL

---

## Diagram 1 — Payment Sequence (Happy Path)

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer (React)
    participant GW as API Gateway
    participant CS as Checkout Service
    participant IRS as Inventory & Reservation Service
    participant PS as Payment Service
    participant PG as Payment Gateway (Razorpay)
    participant MQ as RabbitMQ
    participant OS as Order Service
    participant DB_PS as Payments DB
    participant DB_OS as Orders DB

    Note over C,DB_OS: Correlation-ID: corr-001 | Idempotency-Key: ik-001

    %% ─── CHECKOUT INITIATION ───
    C->>+GW: POST /api/v1/checkout<br/>X-Correlation-ID: corr-001<br/>X-Idempotency-Key: ik-001<br/>{ reservationId, shippingAddress, provider }

    GW->>GW: Validate JWT (RS256)<br/>Inject X-Correlation-ID if missing

    GW->>+CS: Route to Checkout Service<br/>X-Correlation-ID: corr-001

    CS->>+IRS: GET /api/v1/reservations/:id<br/>X-Correlation-ID: corr-001
    IRS-->>-CS: { status: RESERVED, expiresAt: T+5min }

    CS->>CS: Validate: status=RESERVED AND expiresAt > NOW()

    CS->>+IRS: PATCH /api/v1/reservations/:id/status<br/>{ status: PAYMENT_PENDING }
    IRS-->>-CS: { status: PAYMENT_PENDING }

    %% ─── PAYMENT INITIATION ───
    CS->>+PS: POST /api/v1/payments/initiate<br/>X-Idempotency-Key: ik-001<br/>{ reservationId, amount, provider }

    PS->>+DB_PS: INSERT INTO payments (idempotency_key=ik-001)<br/>ON CONFLICT DO NOTHING
    DB_PS-->>-PS: payment_id: pay-001 (new record)

    PS->>+PG: Create Payment Session<br/>idempotency_ref: pay-001
    PG-->>-PS: { sessionId: sess-abc, redirectUrl }

    PS-->>-CS: { paymentId: pay-001, redirectUrl }
    CS-->>-GW: 202 Accepted { paymentId, redirectUrl, expiresAt }
    GW-->>-C: 202 { redirectUrl }

    %% ─── CUSTOMER COMPLETES PAYMENT ON GATEWAY ───
    C->>PG: Customer enters card details on Razorpay hosted page
    PG->>PG: Process payment
    PG-->>C: Payment captured

    %% ─── WEBHOOK ───
    PG->>+PS: POST /api/v1/payments/webhook<br/>{ event: payment.captured, id: rzp_abc123 }
    PS->>PS: Verify HMAC-SHA256 signature

    PS->>+DB_PS: UPDATE payments SET status=SUCCESS,<br/>transaction_reference=rzp_abc123
    DB_PS-->>-PS: 1 row updated

    Note over PS: POST-COMMIT: Publish event

    PS->>+MQ: Publish PaymentConfirmed<br/>{ eventId: evt-001, correlationId: corr-001,<br/>paymentId: pay-001, reservationId, customerId }

    PS-->>-PG: 200 { received: true }

    %% ─── ORDER CREATION (ASYNC) ───
    MQ->>+OS: Deliver PaymentConfirmed<br/>(queue: order.payment-confirmed)

    OS->>OS: Check processed_events: evt-001 → NOT FOUND

    OS->>+DB_OS: BEGIN TRANSACTION<br/>INSERT INTO orders (reservation_id UNIQUE)<br/>INSERT INTO order_items<br/>INSERT INTO processed_events(evt-001)
    DB_OS-->>-OS: order_id: ord-001

    Note over OS: POST-COMMIT: Publish events

    OS->>+MQ: Publish OrderCreated { orderId, customerId, items }
    OS->>MQ: Publish OrderConfirmed { orderId, customerId }
    MQ-->>-OS: Published

    OS-->>-MQ: ACK message

    %% ─── INVENTORY UPDATE (ASYNC) ───
    MQ->>+IRS: Deliver PaymentConfirmed<br/>(queue: inventory.payment-confirmed)
    IRS->>IRS: Transition reservation PAYMENT_PENDING → CONFIRMED
    IRS-->>-MQ: ACK
```

---

## Diagram 2 — Order Creation Sequence (With Full Actors)

```mermaid
sequenceDiagram
    autonumber
    participant C as Customer
    participant GW as API Gateway
    participant CS as Checkout Service
    participant PS as Payment Service
    participant IRS as Inventory & Reservation Service
    participant MQ as RabbitMQ
    participant OS as Order Service
    participant FS as Fulfilment Service
    participant NS as Notification Service
    participant DB as PostgreSQL

    Note over C,DB: Order creation is EVENT-DRIVEN, not synchronous

    %% ─── PAYMENT SUCCESS TRIGGERS ORDER ───
    PS->>MQ: Publish PaymentConfirmed<br/>routing key: payment.confirmed<br/>{ paymentId, reservationId, customerId, amount }

    %% ─── PARALLEL CONSUMERS ───
    par Order Service consumer
        MQ->>OS: Deliver to order.payment-confirmed queue
        OS->>DB: BEGIN<br/>INSERT orders ON CONFLICT(reservation_id) DO NOTHING<br/>INSERT order_items<br/>INSERT processed_events<br/>COMMIT
        OS->>MQ: Publish OrderCreated (routing: order.created)
        OS->>MQ: Publish OrderConfirmed (routing: order.confirmed)
        OS-->>MQ: ACK
    and Inventory consumer
        MQ->>IRS: Deliver to inventory.payment-confirmed queue
        IRS->>DB: UPDATE reservation status → CONFIRMED
        IRS-->>MQ: ACK
    end

    %% ─── FULFILMENT (ASYNC) ───
    MQ->>FS: Deliver to fulfilment.order-created queue<br/>{ orderId, items, shippingAddress }
    FS->>DB: INSERT INTO fulfilments
    FS->>MQ: Publish ShipmentCreated (routing: shipment.created)
    FS-->>MQ: ACK

    %% ─── NOTIFICATION (ASYNC) ───
    MQ->>NS: Deliver to notification.order-confirmed queue
    NS->>NS: Render order confirmation template
    NS->>NS: Send email + SMS to customer
    NS-->>MQ: ACK

    Note over C,NS: Customer receives "Order Confirmed" email/SMS
    Note over C,NS: No synchronous dependency on Order Service from customer request
```

---

## Diagram 3 — Order Recovery Sequence (Payment Succeeds + Order Service DOWN)

```mermaid
sequenceDiagram
    autonumber
    participant PS as Payment Service
    participant MQ as RabbitMQ
    participant OS as Order Service
    participant DB_PS as Payments DB (PostgreSQL)
    participant DB_OS as Orders DB (PostgreSQL)
    participant DLQ as Dead Letter Queue
    participant ALERT as Alert System

    Note over PS,ALERT: CRITICAL SCENARIO: Payment SUCCESS + Order Service unavailable 30 seconds

    %% ─── PAYMENT COMPLETES ───
    PS->>DB_PS: UPDATE payments SET status=SUCCESS<br/>[COMMIT — Payment is DURABLE]
    Note over DB_PS: Payment record is permanently safe

    PS->>MQ: Publish PaymentConfirmed<br/>{ eventId: evt-001, paymentId, reservationId }
    Note over MQ: Message stored in durable queue<br/>order.payment-confirmed<br/>persistent=true, manual-ack

    %% ─── ORDER SERVICE IS DOWN ───
    Note over OS: ⚠️ Order Service is UNAVAILABLE

    MQ->>OS: Attempt 1 — Deliver PaymentConfirmed
    OS-->>MQ: Connection refused (no consumer)
    Note over MQ: Message stays in queue<br/>No ACK received = message not lost

    MQ->>OS: Attempt 2 (after 1s backoff)
    OS-->>MQ: Connection refused

    MQ->>OS: Attempt 3 (after 5s backoff)
    OS-->>MQ: Connection refused

    Note over MQ: After 3 failures:<br/>Message → Dead Letter Exchange (glowrush.events.dlx)<br/>Queue: order.payment-confirmed.dlq
    MQ->>DLQ: Route to order.payment-confirmed.dlq
    DLQ->>ALERT: 🚨 ALERT: DLQ received message<br/>type=PaymentConfirmed<br/>Trigger PagerDuty / Slack alert

    %% ─── ORDER SERVICE RECOVERS ───
    Note over OS: ✅ Order Service RECOVERS after ~30 seconds

    OS->>DLQ: Reconciliation job: poll DLQ for unprocessed PaymentConfirmed events
    DLQ->>OS: Deliver PaymentConfirmed { eventId: evt-001 }

    OS->>DB_OS: SELECT FROM processed_events WHERE event_id = 'evt-001'
    DB_OS-->>OS: NOT FOUND (never processed)

    OS->>DB_OS: BEGIN TRANSACTION<br/>INSERT INTO orders (reservation_id) ON CONFLICT DO NOTHING<br/>INSERT INTO order_items<br/>INSERT INTO processed_events (evt-001, PaymentConfirmed)<br/>COMMIT
    DB_OS-->>OS: order_id: ord-001 created

    OS->>MQ: Publish OrderCreated + OrderConfirmed
    OS-->>DLQ: ACK (remove from DLQ)

    Note over OS,DB_OS: Order created EXACTLY ONCE<br/>Payment SUCCESS preserved throughout<br/>30-second outage = zero data loss

    %% ─── RECONCILIATION JOB (BACKGROUND) ───
    Note over ALERT: Scheduled reconciliation job (every 5 minutes):<br/>SELECT * FROM payments WHERE status='SUCCESS'<br/>AND payment_id NOT IN (SELECT payment_id FROM orders)<br/>→ For each orphaned payment → re-trigger order creation
```

---

## Diagram 4 — Payment Timeout & Reconciliation

```mermaid
sequenceDiagram
    autonumber
    participant PS as Payment Service
    participant PG as Payment Gateway
    participant DB as Payments DB
    participant MQ as RabbitMQ
    participant IRS as Inventory & Reservation Service

    PS->>PG: Initiate payment (payment_id: pay-001)
    Note over PG: Gateway slow / network issue

    PS->>PS: Wait 30 seconds — no webhook received
    PS->>DB: UPDATE payments SET status = 'TIMEOUT'<br/>[NOT FAILED — we don't know yet]

    Note over PS,IRS: Reservation TTL still ticking (5-minute safety net)<br/>Do NOT release reservation yet

    %% ─── RECONCILIATION RETRY ───
    PS->>PG: GET /v1/payments/pay-001 (poll gateway)
    
    alt Gateway returns 'captured'
        PG-->>PS: { status: captured, id: rzp_abc }
        PS->>DB: UPDATE payments SET status=SUCCESS,<br/>transaction_reference=rzp_abc
        PS->>MQ: Publish PaymentConfirmed
        Note over PS: Normal success flow continues
    else Gateway returns 'failed'
        PG-->>PS: { status: failed, error: insufficient_funds }
        PS->>DB: UPDATE payments SET status=FAILED,<br/>failure_reason=insufficient_funds
        PS->>MQ: Publish PaymentFailed
        MQ->>IRS: Release reservation
    else Gateway unreachable (circuit breaker)
        PG-->>PS: Connection timeout
        Note over PS: Retry: 5s → 25s → 125s
        PS->>PS: Circuit breaker OPENS after 3 failures
        Note over PS,IRS: Payment stays TIMEOUT<br/>Reservation expires via 5-minute TTL<br/>Customer NOT charged (gateway unreachable = no transaction)
        PS->>MQ: Publish PaymentTimedOut<br/>(for monitoring / reconciliation)
    end
```
