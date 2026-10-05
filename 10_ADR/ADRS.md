# GlowRush — Architecture Decision Records (ADR)

> **Version:** 1.0 | **Owner:** Student 1 (System Architect)

---

## ADR 1: SQL vs NoSQL for Primary Database

**Context:** The system needs to store business-critical data (products, inventory, payments, orders) and handle high-concurrency updates during flash sales.

**Options:**
1. SQL (PostgreSQL)
2. NoSQL (MongoDB, DynamoDB)

**Decision:** We chose **SQL (PostgreSQL)**.

**Reasons:**
- Strict ACID properties are mandatory to guarantee inventory is never negative.
- Relational mapping is natural for e-commerce (Orders -> Items, Customers -> Reservations).
- PostgreSQL provides powerful row-level locking and atomic update mechanisms essential for our concurrency strategy.

**Trade-offs & Consequences:**
- *Trade-off:* Relational databases are harder to scale horizontally for writes compared to NoSQL.
- *Consequence:* We must use StormShield to throttle write concurrency to a level PostgreSQL can comfortably handle on a single primary node. We will use read replicas to scale read traffic.

---

## ADR 2: Synchronous vs Asynchronous Communication

**Context:** We need a communication strategy between 12 microservices. The checkout flow requires immediate validation, while order fulfillment does not.

**Options:**
1. 100% Synchronous (REST/gRPC everywhere)
2. 100% Asynchronous (Event-driven everywhere)
3. Hybrid (Sync for hot-path user interactions, Async for post-decision processing)

**Decision:** We chose the **Hybrid approach**.

**Reasons:**
- User experience demands immediate feedback during checkout (reservation success, payment initiation). These must be synchronous (REST).
- Post-payment actions (Order Creation, Fulfilment, Notifications) do not require immediate user feedback and should not block the payment thread. Async events decouple these systems.

**Trade-offs & Consequences:**
- *Trade-off:* Hybrid systems are more complex to trace and reason about.
- *Consequence:* We require a strict correlation ID strategy across both HTTP headers and RabbitMQ message payloads to ensure end-to-end traceability.

---

## ADR 3: Atomic Update vs Pessimistic vs Optimistic Locking

**Context:** 10,000 users are trying to claim 100 inventory units simultaneously. We need a concurrency control mechanism to prevent overselling.

**Options:**
1. Pessimistic Locking (`SELECT FOR UPDATE`)
2. Optimistic Locking (Version columns)
3. Atomic Conditional Update (`UPDATE ... WHERE available_quantity >= 1`)

**Decision:** We chose **Atomic Conditional Update** as the primary mechanism.

**Reasons:**
- *Pessimistic Locking:* Causes massive transaction blocking and potential deadlocks when 10K users hit the same row.
- *Optimistic Locking:* Causes high failure rates (9,999 aborts for 1 success if they all read the same version). Requires application-level retry logic.
- *Atomic Update:* Pushes the condition to the database engine. It locks the row only for the split-second of the update, evaluates the condition, and commits instantly.

**Trade-offs & Consequences:**
- *Trade-off:* We lose the ability to perform complex application-level validation *before* the update within the same lock.
- *Consequence:* We must design the schema so the conditional logic can be entirely expressed in the SQL `WHERE` clause.

---

## ADR 4: Redis Caching Strategy

**Context:** API Gateway and Business Services need low-latency access to rate limits, active sale metadata, and queue positions.

**Options:**
1. No caching (hit PostgreSQL for everything)
2. In-memory caching per Node.js process (e.g., node-cache)
3. Distributed cache (Redis)

**Decision:** We chose a **Distributed Cache (Redis)**.

**Reasons:**
- Flash sales create massive read spikes on identical data (Product info, Sale config). A distributed cache protects PostgreSQL.
- StormShield requires shared state across all its instances for the waiting room queue (Sorted Sets). Local memory caches cannot do this.
- Rate limiting at the API Gateway requires a centralized counter.

**Trade-offs & Consequences:**
- *Trade-off:* Introduces another infrastructural dependency and potential single point of failure.
- *Consequence:* Redis must be deployed in Cluster mode for HA. If Redis fails, StormShield fails open (with extreme rate limits applied at the Gateway).

---

## ADR 5: RabbitMQ vs Direct Service-to-Service

**Context:** The Payment Service needs to inform the Order, Inventory, and Notification services that a payment succeeded.

**Options:**
1. Direct REST calls (Payment Service calls Order, Inventory, Notif APIs)
2. Message Broker (RabbitMQ)

**Decision:** We chose a **Message Broker (RabbitMQ)**.

**Reasons:**
- *Decoupling:* Payment Service should not fail or wait if the Notification Service is temporarily down.
- *Durability:* RabbitMQ durable queues ensure messages are not lost during service restarts.
- *Fan-out:* One event (`PaymentConfirmed`) needs to reach multiple independent consumers. Topic exchanges handle this natively.

**Trade-offs & Consequences:**
- *Trade-off:* Eventual consistency. The customer's order might not appear instantly after payment.
- *Consequence:* The UI must be designed to handle pending states (e.g., "Payment successful, generating order...").

---

## ADR 6: StormShield Virtual Waiting Room

**Context:** 10,000 concurrent requests will overwhelm PostgreSQL's connection pool and row-lock limits if allowed through simultaneously.

**Options:**
1. Scale up the database massively for 5 minutes.
2. Let requests queue in the Load Balancer/TCP backlog.
3. Build a Virtual Waiting Room (StormShield) to throttle admission.

**Decision:** We chose to build **StormShield (Virtual Waiting Room)**.

**Reasons:**
- Scaling the DB to handle 10,000 concurrent writes to a single row is fundamentally impossible due to row-level locking, regardless of hardware size.
- TCP queueing leads to random timeouts, poor UX, and unfairness.
- StormShield provides fair (FIFO) queueing, clear UX (wait times), and protects the database by only admitting traffic at a rate it can digest (~20-50 per batch).

**Trade-offs & Consequences:**
- *Trade-off:* Adds significant architectural complexity and a critical path dependency.
- *Consequence:* The StormShield logic must be kept extremely lightweight, leaning heavily on Redis native commands (ZADD, ZPOPMIN) rather than Node.js CPU.

---

## ADR 7: PostgreSQL as Source of Truth

**Context:** During a flash sale, Redis could be used as an in-memory inventory counter for extreme speed.

**Options:**
1. Redis as Source of Truth (decrement in Redis, sync to PG later).
2. PostgreSQL as Source of Truth (decrement in PG directly).

**Decision:** We chose **PostgreSQL as Source of Truth**.

**Reasons:**
- **Strict Guarantee:** The business requirement explicitly states inventory must NEVER be negative and orders must not be lost.
- Redis, while fast, is an in-memory data store where edge-case data loss (e.g., during a master-replica failover or crash before AOF sync) is possible.
- Reconciling an asynchronous Redis counter with a relational order database leads to severe "split-brain" scenarios if failures occur mid-transaction.

**Trade-offs & Consequences:**
- *Trade-off:* Lower raw write throughput compared to a pure Redis counter.
- *Consequence:* We mitigate the throughput limit using StormShield (ADR 6) to ensure the load reaching PostgreSQL never exceeds its safe operational limits.
