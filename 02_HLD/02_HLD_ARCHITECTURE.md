# GlowRush — High-Level Design (HLD) Architecture

> **Version:** 1.0 | **Owner:** Student 1 (System Architect)

---

## 1. Architecture Overview

GlowRush uses a **microservices architecture** with 12 canonical services, communicating via **synchronous REST** for user-facing flows and **asynchronous RabbitMQ events** for background workflows. The architecture is designed to handle a **10,000:100 contention ratio** during flash sales.

---

## 2. HLD Architecture Diagram

```mermaid
graph TB
    subgraph "External"
        Customer[👤 Customer]
        Admin[🔧 Admin]
        PayGW[💳 Payment Gateway]
        ShipProv[🚚 Shipping Provider]
        NotifProv[📧 Notification Provider]
    end

    subgraph "Edge Layer"
        CDN[☁️ CDN - CloudFront]
        WAF[🛡️ WAF]
        ALB[⚖️ Application Load Balancer]
    end

    subgraph "API Layer"
        GW[🚪 API Gateway<br/>JWT Auth · Rate Limit · Routing<br/>Correlation ID]
    end

    subgraph "Admission Layer"
        SS[🏰 StormShield<br/>Virtual Waiting Room<br/>Queue · Batch Admission · Token]
    end

    subgraph "Business Services"
        PS[📦 Product Service]
        CS[🛒 Cart Service]
        SAS[🔥 Sale Service]
        IRS[📊 Inventory &<br/>Reservation Service]
        COS[💰 Checkout Service]
        PAY[💳 Payment Service]
        OS[📋 Order Service]
        FS[📦 Fulfilment Service]
        SHS[🚚 Shipment Service]
        NS[🔔 Notification Service]
    end

    subgraph "Data Layer"
        PG[(🐘 PostgreSQL<br/>Primary + Read Replicas)]
        RD[(⚡ Redis Cluster<br/>Cache · Rate Limit · Queue)]
        RMQ[🐇 RabbitMQ<br/>Durable Queues · DLQ]
    end

    subgraph "Observability"
        PROM[📊 Prometheus]
        GRAF[📈 Grafana]
        LOKI[📝 Loki]
        JAEG[🔍 Jaeger]
    end

    Customer -->|HTTPS| CDN
    Admin -->|HTTPS| CDN
    CDN --> WAF --> ALB --> GW

    GW --> SS
    GW --> PS
    GW --> CS
    GW --> SAS

    SS -->|Admission Token| GW
    GW -->|With Token| IRS

    IRS --> COS
    COS --> PAY
    PAY --> PayGW

    PAY -->|async| RMQ
    RMQ --> OS
    RMQ --> IRS
    OS -->|async| RMQ
    RMQ --> FS
    FS -->|async| RMQ
    RMQ --> SHS
    SHS --> ShipProv
    SHS -->|async| RMQ
    RMQ --> NS
    NS --> NotifProv

    PS --> PG
    PS --> RD
    CS --> RD
    CS --> PG
    SAS --> PG
    SAS --> RD
    IRS --> PG
    IRS --> RD
    COS --> RD
    PAY --> PG
    OS --> PG
    FS --> PG
    SHS --> PG
    NS --> PG
    SS --> RD

    PROM -.->|scrape| GW
    PROM -.->|scrape| SS
    PROM -.->|scrape| IRS
    PROM -.->|scrape| PAY
    LOKI -.->|collect| GW
    JAEG -.->|traces| GW
```

---

## 3. Architectural Layers

### Layer 1 — Edge Layer
**Components:** CDN (CloudFront), WAF, Application Load Balancer

**Purpose:**
- **CDN**: Cache static assets (React SPA, images, CSS/JS), reduce origin load by ~80%
- **WAF**: Block OWASP Top 10 attacks, bot detection, geo-blocking, IP reputation
- **ALB**: Distribute traffic across API Gateway instances, health checks, SSL termination

**Flash Sale Impact:** CDN absorbs ~80% of page-load traffic. WAF rate-limits abusive IPs. ALB distributes remaining ~20% dynamic requests across API Gateway instances.

---

### Layer 2 — API Layer
**Components:** API Gateway (multiple instances)

**Purpose:**
- JWT authentication and validation
- Generate/propagate `X-Correlation-ID`
- Global rate limiting (Redis token bucket)
- Request routing to downstream services
- Request/response logging
- CORS enforcement

**Flash Sale Impact:** First line of defense against overload. Rejects unauthenticated requests before they reach StormShield.

---

### Layer 3 — Admission Layer
**Components:** StormShield (multiple instances)

**Purpose:**
- Virtual waiting room during flash sales
- Queue management via Redis sorted sets
- Controlled batch admission (20–50 users per batch)
- Issue short-lived admission tokens (JWT, 60s TTL)
- Observe `ReservationReleased` events to admit next batch

**Flash Sale Impact:** Converts the thundering herd (10,000 concurrent) into a manageable stream (~50 users per admission batch). This is the **critical traffic shaping** component.

---

### Layer 4 — Business Services Layer
**Components:** All 10 business microservices

**Synchronous Path (Flash Sale):**
```
StormShield → Inventory & Reservation → Checkout → Payment
```

**Asynchronous Path (Post-Payment):**
```
Payment → [RabbitMQ] → Order → [RabbitMQ] → Fulfilment → [RabbitMQ] → Shipment → [RabbitMQ] → Notification
```

---

### Layer 5 — Data Layer
**Components:** PostgreSQL, Redis, RabbitMQ

| Component   | Role                                                              |
| ----------- | ----------------------------------------------------------------- |
| PostgreSQL  | Source of truth for all business data; ACID transactions          |
| Redis       | Cache (products, sale config), rate limiting, StormShield queues, checkout sessions |
| RabbitMQ    | Durable async event bus; topic exchange; dead-letter queues       |

---

### Layer 6 — Observability Layer
**Components:** Prometheus, Grafana, Loki, Jaeger

| Component   | Purpose                                           |
| ----------- | ------------------------------------------------- |
| Prometheus  | Metrics collection (request rate, latency, errors)|
| Grafana     | Dashboards and alerting                           |
| Loki        | Structured log aggregation                        |
| Jaeger      | Distributed tracing with correlation IDs          |

---

## 4. Flash Sale Request Flow — Detailed

```mermaid
sequenceDiagram
    participant C as Customer
    participant CDN as CDN/WAF
    participant ALB as Load Balancer
    participant GW as API Gateway
    participant SS as StormShield
    participant IRS as Inventory & Reservation
    participant CO as Checkout
    participant PAY as Payment
    participant PGW as Payment Gateway
    participant RMQ as RabbitMQ
    participant OS as Order Service
    participant NS as Notification

    C->>CDN: Click "Buy Now" (HTTPS)
    CDN->>ALB: Forward dynamic request
    ALB->>GW: Route to API Gateway
    
    Note over GW: Validate JWT, generate Correlation ID
    GW->>SS: POST /stormshield/enter

    alt Queue Full or Sale Ended
        SS-->>GW: 503 - "Currently Sold Out"
        GW-->>C: "Currently Sold Out"
    else Queued
        SS-->>GW: 200 - Queue position, ETA
        GW-->>C: "You are #457, ~2 min wait"
    end

    Note over SS: Batch admission (every few seconds)
    SS->>SS: Admit next batch of 20-50 users
    SS-->>C: Admission Token (JWT, 60s TTL)
    
    C->>GW: POST /inventory/reserve (with Admission Token)
    Note over GW: Validate Admission Token
    GW->>IRS: POST /inventory/reserve

    Note over IRS: BEGIN TRANSACTION<br/>UPDATE inventory<br/>WHERE available_quantity >= 1<br/>affected_rows check
    
    alt affected_rows = 0
        IRS-->>GW: 409 - Out of Stock
        GW-->>C: "Sold Out"
    else affected_rows = 1
        IRS-->>GW: 201 - Reservation created (5 min TTL)
        GW-->>C: Reservation confirmed, proceed to checkout
    end

    C->>GW: POST /checkout/initiate (reservation_id)
    GW->>CO: Validate reservation, collect shipping
    CO->>PAY: POST /payments/initiate
    PAY->>PGW: Process payment (external)
    PGW-->>PAY: Payment SUCCESS
    PAY->>PAY: Persist SUCCESS
    PAY->>RMQ: Publish PaymentConfirmed

    RMQ->>OS: Consume PaymentConfirmed
    OS->>OS: Create Order (CONFIRMED)
    OS->>RMQ: Publish OrderConfirmed

    RMQ->>IRS: Consume PaymentConfirmed
    IRS->>IRS: Reservation → SOLD

    RMQ->>NS: Consume OrderConfirmed
    NS-->>C: "Order confirmed!" (Email/SMS)
```

---

## 5. Key Architectural Principles

| Principle                       | Application                                              |
| ------------------------------- | -------------------------------------------------------- |
| **Single Responsibility**       | Each service owns exactly one business domain            |
| **Database per Service**        | No shared database tables; data access via APIs/events   |
| **Fail Fast at the Edge**       | StormShield + API Gateway reject overflow immediately    |
| **Fail Safe at the Core**       | Atomic SQL ensures inventory can never go negative       |
| **Eventual Consistency**        | Post-payment flow is async; order creation is eventual   |
| **Idempotency Everywhere**      | Every write operation supports safe retry                |
| **Observability by Default**    | Correlation ID, structured logs, metrics, traces         |
| **Defense in Depth**            | CDN → WAF → Rate Limit → Auth → StormShield → Atomic SQL|
