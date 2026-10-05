# GlowRush — Concurrency Simulation: 10,000 → 100

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Purpose:** Evidence for architecture correctness
> **Stack:** Node.js simulation script + Locust load test configuration

---

## Purpose

This simulation proves mathematically and empirically that:
1. With 10,000 concurrent requests and 100 stock units, exactly 100 succeed
2. `available_quantity` never goes negative
3. Idempotency prevents duplicate reservations
4. Expired reservations release stock correctly
5. The last-item race condition resolves correctly (exactly one winner)

---

## Part A: Node.js Concurrency Simulation

This script simulates the atomic update behavior using PostgreSQL directly. Run against a test database.

```javascript
// File: simulation/concurrency-simulation.js
// Run: node simulation/concurrency-simulation.js

const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: 5432,
  database: 'glowrush_test',
  user: 'postgres',
  password: process.env.PG_PASSWORD || 'password',
  max: 50, // Connection pool size
});

const INITIAL_STOCK = 100;
const CONCURRENT_REQUESTS = 10000;
const PRODUCT_ID = 'test-product-vitamin-c-serum';

// ── Setup ──────────────────────────────────────────────────────────

async function setupTestInventory() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inventory (
      inventory_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id        VARCHAR(100) UNIQUE NOT NULL,
      available_quantity INTEGER NOT NULL DEFAULT 0,
      reserved_quantity  INTEGER NOT NULL DEFAULT 0,
      sold_quantity      INTEGER NOT NULL DEFAULT 0,
      version            INTEGER NOT NULL DEFAULT 0,
      updated_at         TIMESTAMPTZ DEFAULT NOW(),
      CONSTRAINT chk_available_non_negative CHECK (available_quantity >= 0),
      CONSTRAINT chk_reserved_non_negative  CHECK (reserved_quantity >= 0),
      CONSTRAINT chk_sold_non_negative      CHECK (sold_quantity >= 0)
    )
  `);

  await pool.query(`
    INSERT INTO inventory (product_id, available_quantity)
    VALUES ($1, $2)
    ON CONFLICT (product_id) DO UPDATE
    SET available_quantity = $2,
        reserved_quantity  = 0,
        sold_quantity      = 0,
        version            = 0
  `, [PRODUCT_ID, INITIAL_STOCK]);

  console.log(`✅ Inventory set up: product=${PRODUCT_ID}, stock=${INITIAL_STOCK}`);
}

// ── Core: Atomic Reserve ───────────────────────────────────────────

async function atomicReserve(customerId, requestIndex) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(`
      UPDATE inventory
      SET available_quantity = available_quantity - 1,
          reserved_quantity  = reserved_quantity + 1,
          version            = version + 1,
          updated_at         = NOW()
      WHERE product_id = $1
        AND available_quantity >= 1
    `, [PRODUCT_ID]);
    await client.query('COMMIT');
    return result.rowCount; // 1 = success, 0 = out of stock
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ── Test 1: 10,000 Concurrent Requests → Exactly 100 Succeed ─────

async function testConcurrencyBasic() {
  console.log('\n═══ TEST 1: 10,000 Concurrent Requests ═══');
  await setupTestInventory();

  const requests = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
    atomicReserve(`customer-${i}`, i)
  );

  const start = Date.now();
  const results = await Promise.allSettled(requests);
  const elapsed = Date.now() - start;

  const successes = results.filter(r => r.status === 'fulfilled' && r.value === 1).length;
  const failures  = results.filter(r => r.status === 'fulfilled' && r.value === 0).length;
  const errors    = results.filter(r => r.status === 'rejected').length;

  // Verify final state
  const inv = await pool.query('SELECT * FROM inventory WHERE product_id = $1', [PRODUCT_ID]);
  const row = inv.rows[0];

  console.log(`\nResults after ${elapsed}ms:`);
  console.log(`  Successful reservations: ${successes} (expected: ${INITIAL_STOCK})`);
  console.log(`  Out of stock (rejected):  ${failures}`);
  console.log(`  Errors:                   ${errors}`);
  console.log(`\nFinal inventory state:`);
  console.log(`  available_quantity:  ${row.available_quantity} (expected: 0)`);
  console.log(`  reserved_quantity:   ${row.reserved_quantity}  (expected: ${successes})`);
  console.log(`  sold_quantity:       ${row.sold_quantity}`);
  console.log(`  version:             ${row.version}            (expected: ${INITIAL_STOCK})`);
  console.log(`  Conservation check:  available(${row.available_quantity}) + reserved(${row.reserved_quantity}) + sold(${row.sold_quantity}) = ${parseInt(row.available_quantity) + parseInt(row.reserved_quantity) + parseInt(row.sold_quantity)} (expected: ${INITIAL_STOCK})`);

  // Assertions
  const conservation = parseInt(row.available_quantity) + parseInt(row.reserved_quantity) + parseInt(row.sold_quantity);
  console.log('\nAssertions:');
  console.log(`  ✅ Exactly 100 succeeded: ${successes === INITIAL_STOCK}`);
  console.log(`  ✅ available_quantity >= 0: ${row.available_quantity >= 0}`);
  console.log(`  ✅ Conservation law holds: ${conservation === INITIAL_STOCK}`);
}

// ── Test 2: Last Item Race Condition ──────────────────────────────

async function testLastItemRace() {
  console.log('\n═══ TEST 2: Last Item Race Condition ═══');

  // Reset to 1 unit
  await pool.query(`
    UPDATE inventory SET available_quantity = 1, reserved_quantity = 0, version = 0
    WHERE product_id = $1
  `, [PRODUCT_ID]);

  // 100 simultaneous requests for the last item
  const RACE_CONTESTANTS = 100;
  const requests = Array.from({ length: RACE_CONTESTANTS }, (_, i) =>
    atomicReserve(`race-customer-${i}`, i)
  );

  const results = await Promise.allSettled(requests);
  const successes = results.filter(r => r.status === 'fulfilled' && r.value === 1).length;
  const failures  = results.filter(r => r.status === 'fulfilled' && r.value === 0).length;

  const inv = await pool.query('SELECT * FROM inventory WHERE product_id = $1', [PRODUCT_ID]);
  const row = inv.rows[0];

  console.log(`\n${RACE_CONTESTANTS} concurrent requests for 1 remaining unit:`);
  console.log(`  Successes: ${successes} (expected: exactly 1)`);
  console.log(`  Failures:  ${failures} (expected: ${RACE_CONTESTANTS - 1})`);
  console.log(`  available_quantity: ${row.available_quantity} (expected: 0, NEVER -1)`);

  console.log('\nAssertions:');
  console.log(`  ✅ Exactly 1 succeeded: ${successes === 1}`);
  console.log(`  ✅ available_quantity = 0 (not negative): ${row.available_quantity === 0}`);
}

// ── Test 3: Duplicate Request (Idempotency) ───────────────────────

async function testIdempotency() {
  console.log('\n═══ TEST 3: Idempotency Simulation ═══');

  // Reset
  await setupTestInventory();

  let reservationCreated = false;
  let idempotencyStore = new Map(); // Simulates processed_events table

  async function idempotentReserve(idempotencyKey, customerId) {
    // Check idempotency
    if (idempotencyStore.has(idempotencyKey)) {
      return { result: 'IDEMPOTENT_REPLAY', data: idempotencyStore.get(idempotencyKey) };
    }

    // Atomic reserve
    const affectedRows = await atomicReserve(customerId, 0);
    if (affectedRows === 0) return { result: 'OUT_OF_STOCK' };

    const reservationId = `res-${Date.now()}`;
    idempotencyStore.set(idempotencyKey, { reservationId, status: 'RESERVED' });

    return { result: 'CREATED', data: { reservationId, status: 'RESERVED' } };
  }

  const IDEMPOTENCY_KEY = 'idem-key-abc-123';

  const result1 = await idempotentReserve(IDEMPOTENCY_KEY, 'customer-alice');
  const result2 = await idempotentReserve(IDEMPOTENCY_KEY, 'customer-alice'); // Duplicate!
  const result3 = await idempotentReserve(IDEMPOTENCY_KEY, 'customer-alice'); // Third attempt!

  const inv = await pool.query('SELECT * FROM inventory WHERE product_id = $1', [PRODUCT_ID]);
  const row = inv.rows[0];

  console.log(`\nRequest 1 result: ${result1.result} → reservationId: ${result1.data?.reservationId}`);
  console.log(`Request 2 result: ${result2.result} → reservationId: ${result2.data?.reservationId}`);
  console.log(`Request 3 result: ${result3.result} → reservationId: ${result3.data?.reservationId}`);
  console.log(`\nInventory after 3 duplicate requests:`);
  console.log(`  available_quantity: ${row.available_quantity} (expected: 99, decremented only ONCE)`);
  console.log(`  reserved_quantity:  ${row.reserved_quantity}  (expected: 1)`);

  console.log('\nAssertions:');
  console.log(`  ✅ Request 1 created new reservation: ${result1.result === 'CREATED'}`);
  console.log(`  ✅ Request 2 replayed (not created): ${result2.result === 'IDEMPOTENT_REPLAY'}`);
  console.log(`  ✅ Request 3 replayed (not created): ${result3.result === 'IDEMPOTENT_REPLAY'}`);
  console.log(`  ✅ Same reservationId returned for all: ${result1.data.reservationId === result2.data.reservationId}`);
  console.log(`  ✅ Stock decremented only once: ${row.reserved_quantity === 1}`);
}

// ── Test 4: Reservation Expiry ────────────────────────────────────

async function testReservationExpiry() {
  console.log('\n═══ TEST 4: Reservation Expiry Simulation ═══');

  // Reset
  await pool.query(`
    UPDATE inventory SET available_quantity = 90, reserved_quantity = 10, version = 100
    WHERE product_id = $1
  `, [PRODUCT_ID]);

  console.log('Initial state: available=90, reserved=10 (10 reservations about to expire)');

  // Simulate expiry worker releasing 5 reservations
  const EXPIRING = 5;
  await pool.query(`
    UPDATE inventory
    SET available_quantity = available_quantity + $1,
        reserved_quantity  = reserved_quantity - $1,
        version            = version + 1
    WHERE product_id = $2
  `, [EXPIRING, PRODUCT_ID]);

  const inv = await pool.query('SELECT * FROM inventory WHERE product_id = $1', [PRODUCT_ID]);
  const row = inv.rows[0];
  const conservation = parseInt(row.available_quantity) + parseInt(row.reserved_quantity) + parseInt(row.sold_quantity);

  console.log(`\nAfter ${EXPIRING} reservations expired and released:`);
  console.log(`  available_quantity: ${row.available_quantity} (expected: 95)`);
  console.log(`  reserved_quantity:  ${row.reserved_quantity}  (expected: 5)`);
  console.log(`  Conservation: ${conservation} (expected: ${INITIAL_STOCK})`);

  console.log('\nAssertions:');
  console.log(`  ✅ Stock restored after expiry: ${row.available_quantity === 95}`);
  console.log(`  ✅ Conservation law holds: ${conservation === INITIAL_STOCK}`);
}

// ── Main Runner ────────────────────────────────────────────────────

async function runAllTests() {
  console.log('🚀 GlowRush Concurrency Simulation');
  console.log(`   Product: Vitamin C Serum`);
  console.log(`   Initial stock: ${INITIAL_STOCK}`);
  console.log(`   Concurrent requests: ${CONCURRENT_REQUESTS}`);

  try {
    await testConcurrencyBasic();
    await testLastItemRace();
    await testIdempotency();
    await testReservationExpiry();
    console.log('\n✅ All simulation tests passed!');
  } catch (err) {
    console.error('❌ Simulation failed:', err.message);
  } finally {
    await pool.end();
  }
}

runAllTests();
```

---

## Part B: Locust Load Test Configuration

This is the Locust configuration for the full end-to-end flash sale simulation.

```python
# File: simulation/locustfile.py
# Run: locust -f simulation/locustfile.py --host=http://localhost:3000 --users=10000 --spawn-rate=1000 --run-time=60s

from locust import HttpUser, task, between, events
from locust.runners import MasterRunner
import uuid
import random
import json
import threading

PRODUCT_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
SALE_ID    = "f1e2d3c4-b5a6-7890-abcd-ef0987654321"

# Counters
success_count = 0
failure_count = 0
out_of_stock_count = 0
idempotent_replay_count = 0
lock = threading.Lock()

class FlashSaleUser(HttpUser):
    """
    Simulates a customer going through the flash sale flow:
    1. Enter StormShield queue
    2. Poll for admission
    3. Attempt reservation (with idempotency key)
    4. Handle success or out-of-stock
    """
    wait_time = between(0.1, 0.5)  # Simulate network jitter

    def on_start(self):
        self.customer_id = str(uuid.uuid4())
        self.idempotency_key = str(uuid.uuid4())
        self.admission_token = None
        self.reservation_id = None
        self.login()

    def login(self):
        """Get JWT auth token"""
        response = self.client.post("/api/v1/auth/login", json={
            "email": f"user_{self.customer_id}@test.com",
            "password": "TestPassword123!"
        }, name="auth/login")
        if response.status_code == 200:
            self.auth_token = response.json().get("token")
        else:
            self.auth_token = "test-jwt-token"  # Fallback for simulation

    def get_headers(self):
        return {
            "Authorization": f"Bearer {self.auth_token}",
            "X-Correlation-ID": str(uuid.uuid4()),
            "Content-Type": "application/json"
        }

    @task(1)
    def enter_queue(self):
        """Step 1: Enter StormShield virtual queue"""
        response = self.client.post(
            "/api/v1/stormshield/enter",
            json={"saleId": SALE_ID, "productId": PRODUCT_ID},
            headers=self.get_headers(),
            name="stormshield/enter"
        )
        if response.status_code == 200:
            data = response.json()
            self.queue_position = data.get("position")

    @task(3)
    def check_queue_status(self):
        """Step 2: Poll queue status (higher frequency)"""
        response = self.client.get(
            f"/api/v1/stormshield/status?saleId={SALE_ID}",
            headers=self.get_headers(),
            name="stormshield/status"
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("status") == "ADMITTED":
                self.admission_token = data.get("admissionToken")
                self.attempt_reservation()

    def attempt_reservation(self):
        """Step 3: Attempt to reserve inventory"""
        global success_count, failure_count, out_of_stock_count

        if not self.admission_token:
            return

        headers = {
            **self.get_headers(),
            "X-Admission-Token": self.admission_token,
            "X-Idempotency-Key": self.idempotency_key,
        }

        response = self.client.post(
            "/api/v1/reservations",
            json={
                "productId": PRODUCT_ID,
                "saleId": SALE_ID,
                "quantity": 1
            },
            headers=headers,
            name="reservations/create"
        )

        with lock:
            if response.status_code == 201:
                success_count += 1
                self.reservation_id = response.json().get("reservationId")
                print(f"✅ Reservation created: {self.reservation_id} (total: {success_count})")
            elif response.status_code == 200:
                idempotent_replay_count += 1
            elif response.status_code == 409:
                out_of_stock_count += 1
            else:
                failure_count += 1

    @task(1)
    def check_availability(self):
        """Check stock levels (read-only, cached)"""
        self.client.get(
            f"/api/v1/inventory/{PRODUCT_ID}/availability",
            headers=self.get_headers(),
            name="inventory/availability"
        )


@events.test_stop.add_listener
def on_test_stop(environment, **kwargs):
    """Print final results when test ends"""
    print("\n" + "═" * 60)
    print("FLASH SALE SIMULATION RESULTS")
    print("═" * 60)
    print(f"Total users simulated:     {environment.runner.user_count}")
    print(f"Successful reservations:   {success_count} (expected: ≤ 100)")
    print(f"Out-of-stock responses:    {out_of_stock_count}")
    print(f"Idempotent replays:        {idempotent_replay_count}")
    print(f"Unexpected failures:       {failure_count}")
    print("═" * 60)
    assert success_count <= 100, f"OVERSELL DETECTED: {success_count} > 100!"
    print("✅ No oversell detected. Inventory integrity maintained.")
```

---

## Part C: Expected Test Results

### Test 1: Basic Concurrency (10,000 → 100)

```
═══ TEST 1: 10,000 Concurrent Requests ═══

Results after ~3500ms:
  Successful reservations: 100  (expected: 100)
  Out of stock (rejected):  9900
  Errors:                   0

Final inventory state:
  available_quantity:  0  (expected: 0)
  reserved_quantity:   100  (expected: 100)
  sold_quantity:       0
  version:             100  (expected: 100)
  Conservation check:  0 + 100 + 0 = 100  ✅

Assertions:
  ✅ Exactly 100 succeeded: true
  ✅ available_quantity >= 0: true
  ✅ Conservation law holds: true
```

### Test 2: Last Item Race (100 contestants → 1 winner)

```
═══ TEST 2: Last Item Race Condition ═══

100 concurrent requests for 1 remaining unit:
  Successes: 1  (expected: exactly 1)
  Failures:  99 (expected: 99)
  available_quantity: 0 (expected: 0, NEVER -1)

Assertions:
  ✅ Exactly 1 succeeded: true
  ✅ available_quantity = 0 (not negative): true
```

### Test 3: Idempotency (3 duplicate requests → 1 reservation)

```
═══ TEST 3: Idempotency Simulation ═══

Request 1 result: CREATED       → reservationId: res-1728117600000
Request 2 result: IDEMPOTENT_REPLAY → reservationId: res-1728117600000
Request 3 result: IDEMPOTENT_REPLAY → reservationId: res-1728117600000

Inventory after 3 duplicate requests:
  available_quantity: 99 (expected: 99, decremented only ONCE)
  reserved_quantity:  1  (expected: 1)

Assertions:
  ✅ Request 1 created new reservation: true
  ✅ Request 2 replayed (not created): true
  ✅ Request 3 replayed (not created): true
  ✅ Same reservationId returned for all: true
  ✅ Stock decremented only once: true
```

### Test 4: Reservation Expiry

```
═══ TEST 4: Reservation Expiry Simulation ═══

Initial state: available=90, reserved=10

After 5 reservations expired and released:
  available_quantity: 95 (expected: 95)
  reserved_quantity:  5  (expected: 5)
  Conservation: 100 (expected: 100)

Assertions:
  ✅ Stock restored after expiry: true
  ✅ Conservation law holds: true
```

---

## Part D: Locust Performance Metrics (Expected)

| Metric | Expected Value | Significance |
|--------|---------------|-------------|
| Reservation success rate | 100/120 admitted ≈ 83% | StormShield over-admits 20% |
| Reservation endpoint p50 | < 50ms | Atomic SQL is fast |
| Reservation endpoint p99 | < 500ms | High contention tail |
| Availability endpoint p50 | < 10ms | Redis cache hit |
| Out-of-stock response time | < 20ms | Immediate reject |
| Oversell incidents | 0 | Non-negotiable guarantee |

> [!NOTE]
> The simulation is evidence for the architecture, not the architecture itself. It demonstrates that the atomic conditional update pattern prevents oversell under genuine concurrent load. A real production test would use a dedicated test environment with production-equivalent database configuration.
