# GlowRush — Requirements & Assumptions

> **Version:** 1.0 | **Owner:** Student 1 (System Architect)

---

## 1. Business Context

GlowRush is a skincare e-commerce platform that conducts **flash sales**. The defining scenario is:

- **Product:** A single flash-sale skincare product (e.g., Vitamin C Serum)
- **Available stock:** Exactly **100 units**
- **Concurrent demand:** **10,000 customers** click "Buy Now" simultaneously
- **Business goal:** Sell exactly 100 units — no more, no less — fairly and reliably

---

## 2. Functional Requirements

| ID      | Requirement                                                                | Priority  |
| ------- | -------------------------------------------------------------------------- | --------- |
| FR-01   | Customers can browse the skincare product catalog                          | Must Have |
| FR-02   | Customers can add products to a shopping cart                              | Must Have |
| FR-03   | Platform supports time-bound flash sales with configurable stock limits    | Must Have |
| FR-04   | System provides a virtual waiting room (StormShield) during flash sales    | Must Have |
| FR-05   | Customers receive queue position and estimated wait time                   | Must Have |
| FR-06   | Admitted customers can reserve inventory atomically                        | Must Have |
| FR-07   | Reservations expire after 5 minutes if not paid                           | Must Have |
| FR-08   | Customers can complete checkout and make payment                           | Must Have |
| FR-09   | Successful payment creates an order automatically                          | Must Have |
| FR-10   | Orders progress through fulfilment, shipping, and delivery                 | Must Have |
| FR-11   | Customers receive notifications at key lifecycle events                    | Must Have |
| FR-12   | Customers can track order and shipment status                              | Must Have |
| FR-13   | Released/expired inventory is offered to waiting customers via queue        | Must Have |
| FR-14   | Duplicate Buy requests are idempotently handled (no double reservations)   | Must Have |
| FR-15   | Duplicate payment requests return existing result (no double charges)       | Must Have |
| FR-16   | Admin can create and manage flash sales                                    | Should Have |
| FR-17   | Admin can view real-time inventory and sale analytics                      | Should Have |

---

## 3. Non-Functional Requirements

### 3.1 Performance

| Metric                       | Target                    | Classification    |
| ---------------------------- | ------------------------- | ----------------- |
| Normal API latency (p95)     | ≤ 200 ms                 | TARGET            |
| Flash sale API latency (p95) | ≤ 500 ms                 | TARGET            |
| StormShield admission latency| ≤ 100 ms                 | TARGET            |
| Inventory reservation latency| ≤ 50 ms                  | TARGET            |
| Product page load time       | ≤ 1 second               | TARGET            |
| Payment initiation latency   | ≤ 2 seconds              | TARGET            |

### 3.2 Throughput

| Metric                       | Target                    | Classification    |
| ---------------------------- | ------------------------- | ----------------- |
| Normal traffic               | ~10,000 req/sec           | TARGET            |
| Flash sale peak              | Up to 500,000 req/sec     | TARGET (with CDN) |
| StormShield admission rate   | 20–50 users/batch         | CONFIGURABLE      |
| Inventory write throughput   | ~1,000 reservations/sec   | TARGET            |
| RabbitMQ throughput          | ~10,000 events/sec        | TARGET            |

### 3.3 Availability

| Metric                       | Target                    | Classification    |
| ---------------------------- | ------------------------- | ----------------- |
| Overall system availability  | 99.9% (8.7h downtime/yr) | TARGET            |
| Inventory service SLA        | 99.95%                    | TARGET            |
| Payment service SLA          | 99.9%                     | TARGET            |
| Planned maintenance window   | < 30 min/month            | TARGET            |

### 3.4 Consistency

| Requirement                                  | Classification        |
| -------------------------------------------- | --------------------- |
| Inventory count must never be negative        | **STRICT GUARANTEE**  |
| 100 units must not create > 100 sales         | **STRICT GUARANTEE**  |
| Duplicate payments must not charge twice      | **STRICT GUARANTEE**  |
| Duplicate reservations must not reserve twice  | **STRICT GUARANTEE**  |
| `available + reserved + sold = initial_stock` | **STRICT GUARANTEE**  |
| Order eventually created after payment success| **STRICT GUARANTEE**  |
| Notifications are at-least-once               | TARGET                |
| Cart data is eventually consistent            | TARGET                |

### 3.5 Security

| Requirement                                  | Classification        |
| -------------------------------------------- | --------------------- |
| All traffic over HTTPS (TLS 1.3)             | **STRICT GUARANTEE**  |
| JWT-based stateless authentication           | **STRICT GUARANTEE**  |
| WAF protection against OWASP Top 10          | **STRICT GUARANTEE**  |
| No PCI-sensitive data stored in our systems  | **STRICT GUARANTEE**  |
| Secrets managed via secret manager (not env) | **STRICT GUARANTEE**  |
| Rate limiting at API Gateway and StormShield | **STRICT GUARANTEE**  |
| Input validation on all endpoints            | **STRICT GUARANTEE**  |
| Audit logging for admin operations           | TARGET                |

### 3.6 Recovery

| Requirement                                        | Target           |
| -------------------------------------------------- | ---------------- |
| Recovery Time Objective (RTO)                      | ≤ 15 minutes     |
| Recovery Point Objective (RPO)                     | ≤ 1 minute       |
| Database backup frequency                          | Every 6 hours    |
| WAL (Write-Ahead Log) streaming                    | Continuous       |
| Service restart time                               | ≤ 30 seconds     |
| Circuit breaker recovery                           | ≤ 60 seconds     |

---

## 4. Traffic Assumptions

| Parameter                      | Value                                   |
| ------------------------------ | --------------------------------------- |
| Registered users               | ~500,000                                |
| Daily active users (normal)    | ~50,000                                 |
| Flash sale participants        | ~10,000 concurrent                      |
| Flash sale duration            | 1–5 minutes (stock-dependent)           |
| Pre-sale page views            | ~100,000 in 10 min before sale          |
| Buy Now click rate at T=0      | ~10,000 within first 2 seconds          |
| Average session duration       | 5 minutes (flash), 15 minutes (normal)  |
| Read:Write ratio (normal)      | 90:10                                   |
| Read:Write ratio (flash sale)  | 30:70                                   |

---

## 5. Flash Sale Assumptions

| Assumption                                         | Value / Description                     |
| -------------------------------------------------- | --------------------------------------- |
| Stock per flash sale                               | 100 units (configurable)                |
| Reservation TTL                                    | 5 minutes                               |
| Admission batch size                               | 20–50 users (configurable)              |
| Admission token TTL                                | 60 seconds                              |
| Expected successful purchases                     | ≤ 100                                   |
| Expected reservation failures (out of stock)       | ~9,900                                  |
| Expected reservation expirations                   | ~5–10% of successful reservations       |
| Released stock re-enters queue                     | Yes, via StormShield                    |
| Sale opens exactly once                            | Not repeatedly reopened to all users    |

---

## 6. Failure Assumptions

| Failure Scenario                          | Expected Frequency | Recovery Mechanism                       |
| ----------------------------------------- | ------------------- | ---------------------------------------- |
| Single service instance crash             | Weekly              | Auto-restart, health check, load balancer removes |
| PostgreSQL primary failover               | Monthly             | Automatic failover to standby            |
| Redis eviction / restart                  | Monthly             | Rebuild from DB; admission tokens re-issued |
| RabbitMQ connection drop                  | Weekly              | Auto-reconnect with backoff              |
| Payment gateway timeout                   | Per-transaction 1%  | Retry with idempotency key               |
| Payment gateway full outage               | Quarterly           | Circuit breaker, hold reservations, retry when recovered |
| Network partition between services        | Rare                | Timeout + retry + eventual consistency   |
| DDoS attack during flash sale             | Possible            | WAF + rate limiting + StormShield        |
| Thundering herd on sale start             | Every flash sale    | StormShield controlled admission         |

---

## 7. Constraints

| Constraint                                                | Reason                                   |
| --------------------------------------------------------- | ---------------------------------------- |
| Technology stack is fixed (see Architecture Contract)     | Hackathon requirement                    |
| Service names are fixed (12 canonical services)           | Team agreement                           |
| PostgreSQL is the single source of truth                  | Consistency > availability for inventory |
| No eventual consistency for inventory counts              | Business-critical; must be strict        |
| At-most-once semantics for inventory reservation          | Prevent overselling                      |
| At-least-once semantics for notifications                 | Delivery guarantee > deduplication       |

---

## 8. Out of Scope

| Item                                    | Reason                                       |
| --------------------------------------- | -------------------------------------------- |
| Multi-region deployment                 | Hackathon scope (single region)              |
| Multi-currency support                  | Indian market only for MVP                   |
| Social login (OAuth)                    | JWT-based auth is sufficient                 |
| Real-time chat support                  | Not required for flash sale scenario         |
| Product reviews and ratings             | Not flash-sale critical                      |
| Wishlists                               | Not flash-sale critical                      |
| Advanced search (Elasticsearch)         | PostgreSQL full-text search is sufficient    |
| A/B testing infrastructure              | Post-MVP                                     |
| Mobile native apps                      | React SPA is responsive                      |
