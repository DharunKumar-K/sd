# GlowRush Flash Sale Simulation Guide

## Overview
GlowRush is a high-scale skincare flash sale platform engineered to handle **10,000 concurrent shoppers** competing for **100 units** of our flagship formulation: **GlowShield Vitamin C 15% Serum**.

The simulation engine models asynchronous concurrent traffic, distributed admission queues (StormShield), atomic reservation updates in MongoDB, payment gateway idempotency and circuit breaking, and asynchronous order fulfillment over RabbitMQ.

---

## 10 Automated Stress & Failure Scenarios

### 1. Normal Flash Sale
- **Scale:** 10,000 shoppers competing for 100 flash sale units.
- **StormShield Admission:** Requests are queued at the edge (Redis token bucket) and admitted in controlled batches of 50 to the reservation authority.
- **Consistency Point:** MongoDB atomic conditional update `updateOne({ productId, availableQuantity: { $gte: 1 } }, { $inc: { availableQuantity: -1, reservedQuantity: 1 } })`.
- **Outcome:** Exactly 100 units reserved. Zero overselling.

### 2. Last Item Race
- **Scenario:** Initial Stock = 1 unit. Customer A (Elena) and Customer B (Aria) fire simultaneous checkout requests within microseconds of each other.
- **Outcome:** MongoDB document-level write lock ensures exactly **one** customer receives `RESERVED`, and the other receives `OUT_OF_STOCK`.
- **Validation:** Proves absence of dirty reads, race conditions, or phantom reservations.

### 3. Duplicate Buy (Idempotency Key Protection)
- **Scenario:** A user frantically double-clicks or re-submits the identical request (`BUY-REQ-1001`).
- **Outcome:** The first request successfully claims the reservation. The second request matches the unique `idempotencyKey` in the reservation collection and returns the existing reservation without decrementing stock a second time.
- **Validation:** Stock decremented **exactly once**.

### 4. High Payment Failure & Auto-Release
- **Scenario:** 50% card decline rate injected into payment gateway responses.
- **Outcome:** When a payment fails (`PaymentFailed`), an asynchronous compensation event (`ReservationReleased`) restores the held units back to `availableQuantity`.
- **Validation:** No stock leakage or orphaned reservations.

### 5. Payment Gateway Timeout & Reconciliation
- **Scenario:** The payment provider does not respond within the 3000ms threshold.
- **Outcome:** Payment is marked `TIMED_OUT` rather than failed, placing the transaction in a reconciliation queue for status lookup or webhook polling to prevent customer double-charging.

### 6. Order Service Outage & Recovery
- **Scenario:** Order Service is forced offline for 10–30 seconds.
- **Outcome:** Payments succeed and are persisted to MongoDB. `PaymentConfirmed` events buffer safely inside the RabbitMQ queue. Once the Order Service comes back online, consumers flush the buffer and create all orders without data loss.

### 7. Database Partition / Failure
- **Scenario:** MongoDB cluster becomes temporarily unreachable.
- **Outcome:** Fail-fast semantics. The platform applies bounded retries with exponential backoff and cleanly rejects requests once the retry threshold is exceeded without inventing fake reservations.

### 8. Payment Gateway Circuit Breaker
- **Scenario:** Multiple consecutive gateway failures trigger the Circuit Breaker:
  - **CLOSED:** Normal traffic passes.
  - **OPEN:** After 3 consecutive failures, subsequent payments are failed immediately without hitting the broken gateway.
  - **HALF_OPEN:** After timeout, a single canary request tests provider health before closing the circuit.

### 9. Reservation Expiry (TTL Cleanup)
- **Scenario:** Customer abandons their cart during the reservation window (accelerated 20s demo TTL).
- **Outcome:** Background worker detects expired TTL, flips reservation status to `EXPIRED`, and emits `ReservationExpired` to RabbitMQ, restoring 1 unit to available stock.

### 10. Traffic Surge ×50
- **Scenario:** 50,000 requests hit the perimeter in 5 seconds.
- **Outcome:** StormShield virtual queue absorbs the traffic surge at the edge, maintaining backend concurrency within safe limits and preventing database saturation.

---

## Verifying Hard Invariants

The simulation platform continuously validates these accounting laws on every state change:

$$\text{Available Quantity} + \text{Reserved Quantity} + \text{Sold Quantity} = \text{Initial Stock}$$

$$\text{Sold Quantity} \le \text{Initial Stock}$$

$$\text{Available Quantity} \ge 0, \quad \text{Reserved Quantity} \ge 0$$
