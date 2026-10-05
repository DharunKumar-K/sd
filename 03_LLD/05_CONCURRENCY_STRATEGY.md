# GlowRush — Concurrency Strategy Analysis

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL
> **Decision:** Atomic Conditional Update (justified below)

---

## The Problem

10,000 customers simultaneously click "Buy Now" for a product with **100 units** of stock.  
**Constraint:** `available_quantity` must never become negative. Maximum 100 successful reservations.

All 10,000 requests eventually reach the Inventory & Reservation Service and attempt to decrement the same `inventory` row. PostgreSQL is the single source of truth. Three classical strategies exist — we analyze all three.

---

## 1. Pessimistic Locking

### Mechanism

```sql
BEGIN;
SELECT * FROM inventory
WHERE product_id = :productId
FOR UPDATE;  -- Acquires exclusive row lock

-- Application reads available_quantity
-- Checks: IF available_quantity >= 1 THEN...

UPDATE inventory
SET available_quantity = available_quantity - 1,
    reserved_quantity  = reserved_quantity + 1
WHERE product_id = :productId;

COMMIT;
```

### Analysis

| Dimension | Assessment |
|-----------|-----------|
| **Correctness** | ✅ Fully correct — exclusive lock ensures no concurrent modification |
| **Performance** | ❌ Very poor under high concurrency. Each `FOR UPDATE` blocks all others on same row. |
| **Contention** | ❌ Extreme. 10,000 requests queue for the same lock. Lock hold time = SELECT + application logic + UPDATE + COMMIT. |
| **Complexity** | Medium. Requires explicit transaction management. Deadlock possible with multiple table locks. |
| **Failure Behaviour** | ❌ Lock holder crash leaves lock held until session timeout (typically 30s). All 9,999 others wait. |
| **Scalability** | ❌ Strictly serial. Adding more Inventory Service instances doesn't help — they all queue at the DB row. |

### Throughput Estimate (100-stock scenario)

```
Lock hold time per request ≈ 5ms (network + select + update + commit)
Throughput = 1000ms / 5ms = 200 req/s
Time to process 100 requests = 100 × 5ms = 500ms

But: Each of 9,900 failing requests ALSO holds the lock while reading 0 stock.
Worst case: 10,000 × 5ms = 50 seconds of sequential processing.
```

**Verdict: Correct but too slow for 10,000 concurrent users.**

---

## 2. Optimistic Locking (Version-based)

### Mechanism

```sql
-- Read with version number
SELECT *, version FROM inventory WHERE product_id = :productId;
-- Returns: available_quantity = 5, version = 42

-- Application checks: IF available_quantity >= 1 THEN...

-- Update with version guard
UPDATE inventory
SET available_quantity = available_quantity - 1,
    reserved_quantity  = reserved_quantity + 1,
    version            = version + 1
WHERE product_id = :productId
  AND version = 42;  -- Must match what we read

-- Check affected_rows:
-- affected_rows = 1 → success
-- affected_rows = 0 → version conflict → retry
```

### Analysis

| Dimension | Assessment |
|-----------|-----------|
| **Correctness** | ✅ Correct when retries are bounded. Prevents dirty writes. |
| **Performance** | ⚠️ Good in low-contention scenarios. Degrades badly under high contention (high retry rate). |
| **Contention** | ❌ Under flash sale (10,000 concurrent): almost all reads get version=42. All attempt UPDATE with version=42. Only one succeeds per version. The other 9,999 get version conflict and must retry. |
| **Complexity** | ❌ High. Requires retry logic, backoff strategy, max-retry limits, and handling of "retry storm." |
| **Failure Behaviour** | ⚠️ Retry storms can amplify load. If max retries exceeded, request fails — need clear error signalling. |
| **Scalability** | ⚠️ Scales well in low-contention. Catastrophic in high-contention (flash sale). Retry amplification makes it worse than pessimistic in worst case. |

### The Retry Storm Problem

```
T=0ms: 10,000 reads → all see version=42, available=100
T=1ms: 10,000 updates, all WHERE version=42
         → 1 succeeds (version→43), 9,999 fail
T=2ms: 9,999 retry reads → all see version=43, available=99
T=3ms: 9,999 updates, all WHERE version=43
         → 1 succeeds, 9,998 fail
...
At this rate, processing 100 units takes ~100 × round-trips with diminishing throughput.
```

**Verdict: Wrong tool for high-contention flash sales. Retry amplification is dangerous.**

---

## 3. Atomic Conditional Update ✅ CHOSEN

### Mechanism

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

**Evaluate `affected_rows`:**
- `affected_rows = 1` → Reservation granted ✅
- `affected_rows = 0` → Out of stock ❌

### Analysis

| Dimension | Assessment |
|-----------|-----------|
| **Correctness** | ✅ Perfect. The `WHERE available_quantity >= 1` is enforced by PostgreSQL atomically. Impossible to oversell. |
| **Performance** | ✅ Excellent. Single SQL statement. No application-level read → check → update cycle. Lock held only for UPDATE execution time (~1ms). |
| **Contention** | ✅ Minimal lock hold time means throughput is maximized even under contention. PostgreSQL serializes at the row level but hold time is tiny. |
| **Complexity** | ✅ Low. No retry logic needed. Simple `affected_rows` check. No version tracking required (version field retained for audit/observability only). |
| **Failure Behaviour** | ✅ If the transaction aborts, PostgreSQL rolls back automatically. No partial state. No orphaned decrements. |
| **Scalability** | ✅ Best possible for row-level contention. Adding DB read replicas handles read traffic. StormShield throttles write concurrency to manageable levels. |

### Why It Prevents Overselling (Proof)

```
PostgreSQL Row Lock Serialization:

State: available_quantity = 1

Thread A: UPDATE WHERE available_quantity >= 1 → ACQUIRES exclusive row lock
Thread B: UPDATE WHERE available_quantity >= 1 → WAITS for row lock

Thread A: Evaluates WHERE: 1 >= 1 → TRUE → available = 0, version++
Thread A: COMMIT, releases lock

Thread B: ACQUIRES row lock
Thread B: Evaluates WHERE: 0 >= 1 → FALSE
Thread B: No rows updated, affected_rows = 0
Thread B: COMMIT (no-op)

Result: Thread A succeeds. Thread B fails. available_quantity = 0. NEVER negative.
```

**Even if 10,000 threads execute simultaneously:**
- PostgreSQL's row-level locking serializes them
- Each thread sees the post-previous-transaction value of `available_quantity`
- The `WHERE` clause is re-evaluated after acquiring the lock against the current committed value
- Only the first N threads (where N = initial stock) will find `available_quantity >= 1`
- All remaining threads see `0 >= 1 = FALSE` and get `affected_rows = 0`

### Combined with Transaction + Idempotency

```sql
BEGIN;
  -- 1. Idempotency check (prevents duplicate reservations)
  SELECT 1 FROM processed_events WHERE event_id = :idempotency_key;
  -- If found → ROLLBACK, return existing result

  -- 2. Atomic reserve (prevents oversell)
  UPDATE inventory
  SET available_quantity = available_quantity - 1,
      reserved_quantity  = reserved_quantity + 1,
      version            = version + 1
  WHERE product_id = :productId AND available_quantity >= 1;
  -- affected_rows → 0 means ROLLBACK, return 409

  -- 3. Create reservation record
  INSERT INTO inventory_reservation
  (reservation_id, product_id, customer_id, quantity, status, idempotency_key, expires_at)
  VALUES (:id, :productId, :customerId, 1, 'RESERVED', :idempotencyKey, NOW() + INTERVAL '5 minutes')
  ON CONFLICT (idempotency_key) DO NOTHING;

  -- 4. Record processed event (for idempotency)
  INSERT INTO processed_events (event_id, event_type, processed_at)
  VALUES (:idempotencyKey, 'ReservationCreated', NOW());

COMMIT;
```

**Why this combination is the correct choice:**

1. **Atomic Update**: Prevents oversell with zero application-level coordination
2. **Transaction**: Ensures the inventory decrement and reservation INSERT are atomic — no partial state
3. **Idempotency**: Ensures retried requests (network failures, user double-clicks) produce exactly one reservation

---

## 4. Comparison Summary

| Criterion | Pessimistic Lock | Optimistic Lock | Atomic Conditional ✅ |
|-----------|-----------------|-----------------|----------------------|
| Correctness | ✅ | ✅ (with retries) | ✅ |
| Lock duration | Long (read+check+write) | Short (write only) | Minimal (write only) |
| Retry required | No | Yes (frequent) | No |
| Under 10K concurrency | ❌ Queue backup | ❌ Retry storm | ✅ Fail fast |
| Code complexity | Medium | High | Low |
| Crash resilience | Poor | Good | Excellent |
| Scales with instances | No | No (contention++) | No (DB is bottleneck) |
| StormShield synergy | Poor | Poor | ✅ Optimal |

---

## 5. Why StormShield + Atomic Update Is the Architecture

```
StormShield: Converts 10,000 concurrent → 30 controlled per 2-second batch
                ↓
Inventory: Handles 30 atomic UPDATEs per 2 seconds comfortably
           (not 10,000 all at once)
                ↓
Result: No retry storms, no lock queues, no timeouts
```

**StormShield throttles the arrival rate. Atomic update guarantees correctness at any arrival rate.**  
Together, they make the system both correct AND performant.

---

> [!IMPORTANT]
> The `version` field in the `inventory` table is retained for **observability** (audit, change detection) but is NOT used as an optimistic lock guard in our atomic update query. This is intentional. The `WHERE available_quantity >= quantity` is the correctness check, not the version comparison.
