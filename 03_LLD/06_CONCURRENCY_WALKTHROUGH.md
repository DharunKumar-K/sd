# GlowRush — 10,000 → 100: Detailed Concurrency Walkthrough

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL

---

## Scenario

| Parameter | Value |
|-----------|-------|
| Product | Vitamin C Serum |
| Initial stock | 100 units |
| Concurrent customers | 10,000 |
| Goal | Exactly 100 successful reservations. No more. |

---

## Layer-by-Layer Flow

```
10,000 customers click "Buy Now"
         │
         ▼
┌─────────────────────────────────────┐
│  Layer 1: CDN / WAF                 │
│  Bot detection, IP rate limiting    │
│  ~500 bots blocked                  │
│  ~9,500 requests reach ALB          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Layer 2: Load Balancer (ALB)       │
│  Distributes to 10 API GW instances │
│  ~950 req/s per instance            │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Layer 3: API Gateway               │
│  JWT validation                     │
│  User-level rate limit: 10 req/min  │
│  Rejects repeat rapid clicks        │
│  Passes validated requests to SS    │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Layer 4: StormShield               │
│  Virtual waiting room               │
│  Batches of 30 every 2 seconds      │
│  Issues 60s admission tokens        │
│  ~9,870 customers held in queue     │
└─────────────────────────────────────┘
         │ controlled stream of ~30 req/batch
         ▼
┌─────────────────────────────────────┐
│  Layer 5: Inventory Service         │
│  Atomic conditional update          │
│  WHERE available_quantity >= 1      │
│  Only 100 can ever succeed          │
└─────────────────────────────────────┘
```

---

## Timeline Walkthrough

### T=0s — Sale Starts

```
10,000 customers simultaneously call POST /stormshield/enter
StormShield: ZADD glowrush:queue:sale-001 {timestamp} {customerId} × 10,000
Queue size = 10,000
```

### T=2s — Batch 1 Admitted (30 customers)

```
StormShield ZPOPMIN 30 → Customers #1–#30 admitted
Each receives: Admission Token JWT { sub: customerId, type: "admission", exp: +60s }

30 customers call POST /api/v1/reservations simultaneously
                    ↓
ReservationController receives 30 concurrent requests

CheckoutFacade for each:
  1. IdempotencyService.check(key) → MISS (all new)
  2. InventoryPolicy.canReserve(1, ...) → OK
  3. AtomicConditionalStrategy.reserve()

MongoDB receives 30 concurrent UPDATE statements:
  UPDATE inventory SET available_quantity -= 1, reserved_quantity += 1
  WHERE available_quantity >= 1;

MongoDB row lock serializes them:
  Request #1 → acquires lock → available=100 → 100 >= 1 → TRUE → available=99 → COMMIT
  Request #2 → acquires lock → available=99  → 99 >= 1  → TRUE → available=98 → COMMIT
  ...
  Request #30 → acquires lock → available=70 → 70 >= 1 → TRUE → available=70 → COMMIT

All 30 succeed. 30 reservations created. available_quantity = 70.
```

### T=4s — Batch 2 (30 customers)

```
30 more admitted → 30 reservations → available = 40
```

### T=6s — Batch 3 (30 customers)

```
30 admitted → 30 reservations → available = 10
```

### T=8s — Batch 4 (30 customers, 20 over-admission)

```
30 admitted (StormShield over-admits by ~20% to account for failures)
10 requests: available = 10 → 9 → ... → 1 → 0 → all succeed
20 requests: available = 0  → WHERE 0 >= 1 → FALSE → affected_rows = 0
20 customers get: 409 { error: "OUT_OF_STOCK" }

Total successful: 30+30+30+10 = 100 ✓
available_quantity = 0
```

### T=8s — Inventory Depleted

```
After the 100th successful UPDATE:
InventoryService detects available_quantity = 0
Publishes: InventoryDepleted { productId, saleId, depletedAt }
            ↓ RabbitMQ routing key: inventory.depleted
            ↓ Consumer: StormShield

StormShield: sets Redis flag ss:depleted:sale-001 = "true"
StormShield: stops batch admission
StormShield: responds to remaining 9,870 queue members with:
             "Currently Sold Out — your queue position is retained"
```

---

## Request A and Request B — The Race Condition (Last Item)

This is the critical microsecond-level scenario. `available_quantity = 1` when both arrive.

```
            ┌──────────────────────────────────────────────────────┐
            │  MongoDB inventory row: available_quantity = 1    │
            └──────────────────────────────────────────────────────┘

Request A (Customer alice-001)              Request B (Customer bob-002)
     │                                              │
     ▼                                              ▼
UPDATE inventory                         UPDATE inventory
SET available_quantity -= 1,             SET available_quantity -= 1,
    reserved_quantity += 1               reserved_quantity += 1
WHERE available_quantity >= 1            WHERE available_quantity >= 1
     │                                              │
     └──────────────── SAME MOMENT ────────────────┘
                              │
                              ▼
                    MongoDB Lock Manager
                    
    ┌───────────────────────────────────────────────────────────────┐
    │  Both UPDATEs target the same row.                           │
    │  MongoDB acquires exclusive row lock for ONE of them.     │
    │  The other WAITS in MongoDB's lock queue.                 │
    └───────────────────────────────────────────────────────────────┘

Request A acquires lock first (arbitrary, timestamp-based internally):
  Evaluates WHERE: available_quantity(1) >= 1 → TRUE
  Sets: available_quantity = 0, reserved_quantity += 1, version++
  COMMIT
  affected_rows = 1 → SUCCESS ✓
  └→ Reservation R-A created, status=RESERVED, expiresAt=+5min

Request B acquires lock (after A committed):
  Evaluates WHERE: available_quantity(0) >= 1 → FALSE
  No rows updated
  COMMIT (no-op)
  affected_rows = 0 → FAILURE ✗
  └→ No reservation created
  └→ 409 { error: "OUT_OF_STOCK", message: "Currently Sold Out" }

available_quantity = 0 (never became -1)
```

**The `WHERE available_quantity >= 1` clause is the mathematical guarantee. It is evaluated AFTER the row lock is acquired, against the COMMITTED value, not the value seen at read time.**

---

## The Sold Out UX — No Flickering

### Problem

```
If sold out is re-opened to ALL users when a reservation expires:
  → "SOLD OUT" banner disappears → thousands rush again
  → "SOLD OUT" reappears → thousands get false hope
  → Cycle repeats → terrible UX, thundering herd on every release
```

### Solution: Queue-Based Controlled Release

```
available_quantity = 0 → InventoryDepleted event → StormShield depleted flag

Customer in queue (position #101):
  Sees: "Sold Out — You're #1 in queue for released stock"
  Stays in queue (still in Redis sorted set)

Customer NOT in queue (random visitor):
  Sees: "Sold Out" (no queue option shown during active release cycle)

T=5min: Reservation expires (5 reservations expire together)
  └→ ReservationExpiryWorker releases 5 reservations
  └→ available_quantity += 5
  └→ publish ReservationReleased × 5
  └→ publish (if available_quantity > 0): InventoryAvailable

StormShield receives ReservationReleased:
  └→ Clears depleted flag (only if available_quantity > 0)
  └→ Admits NEXT 5 customers from queue (ZPOPMIN 5)
  └→ These 5 get fresh admission tokens
  └→ They attempt reservation → may succeed or fail
  └→ The GENERAL PUBLIC still sees "Sold Out"
  └→ NO banner flip-flop for general public
```

**Key distinction:**
- General public UX: "Sold Out" (static, scollection)
- Queue members UX: "You're #N in line — waiting for releases"
- No public flickering between available/sold-out

---

## Duplicate Request Handling

```
Scenario: Customer alice-001 clicks "Buy Now" twice (double-click / network retry)

Request 1: POST /api/v1/reservations
  Headers: X-Idempotency-Key: idem-abc-123
  
  CheckoutFacade:
    IdempotencyService.check("idem-abc-123") → MISS
    AtomicConditionalStrategy.reserve() → affected_rows = 1
    INSERT reservation R-001 (status=RESERVED)
    INSERT processed_events (event_id="idem-abc-123", result={reservationId: "R-001"})
    COMMIT
  Response: 201 { reservationId: "R-001", status: "RESERVED" }

Request 2: POST /api/v1/reservations (duplicate, same key)
  Headers: X-Idempotency-Key: idem-abc-123  ← same key
  
  CheckoutFacade:
    IdempotencyService.check("idem-abc-123") → HIT { reservationId: "R-001" }
    SHORT CIRCUIT: no atomicReserve(), no INSERT
    Return existing reservation R-001
  Response: 200 { reservationId: "R-001", status: "RESERVED" }
             X-Idempotent-Replayed: true

Result: Only ONE reservation exists. Stock decremented only ONCE.
```

---

## Reservation TTL and Expiry

```
Chosen mechanism: Scheduled Database Scan (cron worker)

Justification:
  - Redis delayed mechanism: Redis is not the source of truth for stock; TTL expiry in Redis
    could race with DB writes. Not chosen.
  - MongoDB native expiry: Does not exist as a feature in MongoDB.
  - Message queue delayed messages: RabbitMQ does not natively support per-message TTL
    with action triggering. Plugins exist but add complexity.
  - Scheduled worker + DB scan: Simple, reliable, fits our MongoDB-first architecture.
    Scans every 30 seconds. Maximum delay before expiry processing = 30 seconds.
    Accepcollection for a 5-minute TTL window.

Implementation:

Every 30 seconds, ReservationExpiryWorker:

BEGIN TRANSACTION;

UPDATE inventory_reservation
SET status = 'RELEASED', updated_at = NOW()
WHERE status IN ('RESERVED', 'PAYMENT_PENDING')
  AND expires_at < NOW()
RETURNING reservation_id, product_id, customer_id, quantity;

-- For each returned row:
UPDATE inventory
SET available_quantity = available_quantity + :quantity,
    reserved_quantity  = reserved_quantity - :quantity,
    version            = version + 1
WHERE product_id = :productId;

COMMIT;

-- Post-commit (events cannot be inside transaction):
FOR EACH released reservation:
  publish ReservationExpired  → Notification Service
  publish ReservationReleased → StormShield, Sale Service
```

---

## Final Numbers

| Metric | Value |
|--------|-------|
| Total requests | 10,000 |
| Blocked by WAF | ~500 |
| Held in StormShield queue | ~9,380 |
| Admitted (Batches 1-4) | 120 (30+30+30+30) |
| Successful reservations | 100 ✓ |
| Failed (OUT_OF_STOCK from inventory) | 20 |
| In queue waiting for releases | ~9,380 |
| `available_quantity` minimum | 0 (NEVER < 0) |
| `available_quantity + reserved_quantity + sold_quantity` | Always = 100 |
