# GlowRush — Container Diagram (C4 Level 2)

> **Version:** 1.0 | **Owner:** Student 1 (System Architect)

---

## 1. Overview

This document provides the C4 Container-level view of the GlowRush platform, showing every deployable container, the technology it uses, and its connections. Each box represents a separately deployable unit (Docker container).

---

## 2. Container Diagram

```mermaid
graph TB
    subgraph "Client Tier"
        SPA["🌐 React SPA<br/>(React + Vite + Tailwind CSS)<br/>Static files served from CDN"]
    end

    subgraph "Edge Tier"
        CDN["☁️ CloudFront CDN"]
        WAF["🛡️ AWS WAF"]
        ALB["⚖️ Application Load Balancer<br/>(AWS ALB, Multi-AZ)"]
    end

    subgraph "Gateway Tier"
        AGW["🚪 API Gateway<br/>Node.js + Express.js<br/>Port: 3000<br/>JWT · Rate Limit · Routing · Correlation ID"]
    end

    subgraph "Admission Tier"
        SSA["🏰 StormShield<br/>Node.js + Express.js<br/>Port: 3001<br/>Queue · Batch Admission · Token"]
    end

    subgraph "Business Tier"
        PROD["📦 Product Service<br/>Node.js + Express.js<br/>Port: 3002"]
        CART["🛒 Cart Service<br/>Node.js + Express.js<br/>Port: 3003"]
        SALE["🔥 Sale Service<br/>Node.js + Express.js<br/>Port: 3004"]
        INV["📊 Inventory & Reservation Service<br/>Node.js + Express.js<br/>Port: 3005"]
        CHECK["💰 Checkout Service<br/>Node.js + Express.js<br/>Port: 3006"]
        PAYM["💳 Payment Service<br/>Node.js + Express.js<br/>Port: 3007"]
        ORD["📋 Order Service<br/>Node.js + Express.js<br/>Port: 3008"]
        FULF["📦 Fulfilment Service<br/>Node.js + Express.js<br/>Port: 3009"]
        SHIP["🚚 Shipment Service<br/>Node.js + Express.js<br/>Port: 3010"]
        NOTIF["🔔 Notification Service<br/>Node.js + Express.js<br/>Port: 3011"]
    end

    subgraph "Data Tier"
        PG_PRI["🐘 PostgreSQL Primary<br/>Port: 5432<br/>ACID · WAL Streaming"]
        PG_REP["🐘 PostgreSQL Read Replica<br/>Port: 5433<br/>Read-only queries"]
        REDIS["⚡ Redis Cluster<br/>Port: 6379<br/>Cache · Rate Limit · Queues"]
        RMQ["🐇 RabbitMQ Cluster<br/>Port: 5672 / 15672<br/>Durable Queues · DLQ"]
    end

    subgraph "External Services"
        EXTPAY["💳 External Payment Gateway"]
        EXTSHIP["🚚 External Shipping Provider"]
        EXTEMAIL["📧 AWS SES"]
        EXTSMS["📱 AWS SNS"]
    end

    subgraph "Observability Tier"
        PROM["📊 Prometheus<br/>Port: 9090"]
        GRAF["📈 Grafana<br/>Port: 3100"]
        LOKI["📝 Loki<br/>Log Aggregation"]
        JAEG["🔍 Jaeger<br/>Port: 16686<br/>Distributed Tracing"]
    end

    SPA -->|HTTPS| CDN
    CDN --> WAF
    WAF --> ALB
    ALB --> AGW

    AGW -->|HTTP| SSA
    AGW -->|HTTP| PROD
    AGW -->|HTTP| CART
    AGW -->|HTTP| SALE
    AGW -->|HTTP + Admission Token| INV
    AGW -->|HTTP| CHECK

    CHECK -->|HTTP| INV
    CHECK -->|HTTP| PAYM
    PAYM -->|HTTPS| EXTPAY

    PAYM -->|Publish| RMQ
    INV -->|Publish| RMQ
    ORD -->|Publish| RMQ
    FULF -->|Publish| RMQ
    SHIP -->|Publish| RMQ

    RMQ -->|Consume| ORD
    RMQ -->|Consume| INV
    RMQ -->|Consume| FULF
    RMQ -->|Consume| SHIP
    RMQ -->|Consume| NOTIF
    RMQ -->|Consume| SSA

    SHIP -->|HTTPS| EXTSHIP
    NOTIF -->|HTTPS| EXTEMAIL
    NOTIF -->|HTTPS| EXTSMS

    PROD --> PG_PRI
    PROD --> PG_REP
    PROD --> REDIS
    CART --> PG_PRI
    CART --> REDIS
    SALE --> PG_PRI
    SALE --> REDIS
    INV --> PG_PRI
    INV --> REDIS
    CHECK --> REDIS
    PAYM --> PG_PRI
    ORD --> PG_PRI
    FULF --> PG_PRI
    SHIP --> PG_PRI
    NOTIF --> PG_PRI
    SSA --> REDIS

    PROM -.-> AGW
    PROM -.-> SSA
    PROM -.-> INV
    PROM -.-> PAYM
    PROM -.-> ORD
    LOKI -.-> AGW
    JAEG -.-> AGW
    GRAF -.-> PROM
    GRAF -.-> LOKI
```

---

## 3. Container Inventory

| #  | Container                       | Technology           | Port  | Instances (Normal) | Instances (Flash) | Database Access      |
| -- | ------------------------------- | -------------------- | ----- | ------------------- | ------------------- | -------------------- |
| 1  | React SPA                       | React + Vite         | —     | CDN (static)        | CDN (static)        | None                 |
| 2  | API Gateway                     | Node.js + Express    | 3000  | 3                   | 10                  | Redis (rate limit)   |
| 3  | StormShield                     | Node.js + Express    | 3001  | 2                   | 5                   | Redis (queue)        |
| 4  | Product Service                 | Node.js + Express    | 3002  | 2                   | 3                   | PG (R/W), Redis      |
| 5  | Cart Service                    | Node.js + Express    | 3003  | 2                   | 3                   | PG (R/W), Redis      |
| 6  | Sale Service                    | Node.js + Express    | 3004  | 2                   | 3                   | PG (R/W), Redis      |
| 7  | Inventory & Reservation Service | Node.js + Express    | 3005  | 2                   | 5                   | PG (R/W), Redis      |
| 8  | Checkout Service                | Node.js + Express    | 3006  | 2                   | 5                   | Redis                |
| 9  | Payment Service                 | Node.js + Express    | 3007  | 2                   | 5                   | PG (R/W)             |
| 10 | Order Service                   | Node.js + Express    | 3008  | 2                   | 3                   | PG (R/W)             |
| 11 | Fulfilment Service              | Node.js + Express    | 3009  | 2                   | 2                   | PG (R/W)             |
| 12 | Shipment Service                | Node.js + Express    | 3010  | 2                   | 2                   | PG (R/W)             |
| 13 | Notification Service            | Node.js + Express    | 3011  | 2                   | 5                   | PG (R/W)             |
| 14 | PostgreSQL Primary              | PostgreSQL 16        | 5432  | 1                   | 1                   | —                    |
| 15 | PostgreSQL Read Replica         | PostgreSQL 16        | 5433  | 1                   | 2                   | —                    |
| 16 | Redis Cluster                   | Redis 7              | 6379  | 3 nodes             | 6 nodes             | —                    |
| 17 | RabbitMQ Cluster                | RabbitMQ 3.13        | 5672  | 3 nodes             | 3 nodes             | —                    |
| 18 | Prometheus                      | Prometheus           | 9090  | 1                   | 1                   | —                    |
| 19 | Grafana                         | Grafana              | 3100  | 1                   | 1                   | —                    |
| 20 | Loki                            | Grafana Loki         | 3200  | 1                   | 1                   | —                    |
| 21 | Jaeger                          | Jaeger               | 16686 | 1                   | 1                   | —                    |

---

## 4. Container Communication Protocols

| From                     | To                        | Protocol  | Port  | Auth            |
| ------------------------ | ------------------------- | --------- | ----- | --------------- |
| CDN                      | ALB                       | HTTPS     | 443   | TLS             |
| ALB                      | API Gateway               | HTTP      | 3000  | Internal VPC    |
| API Gateway              | All services              | HTTP      | 300x  | Internal + JWT  |
| Any service              | PostgreSQL                | TCP       | 5432  | Username/Pass   |
| Any service              | Redis                     | TCP       | 6379  | AUTH password   |
| Any service              | RabbitMQ                  | AMQP      | 5672  | Username/Pass   |
| Payment Service          | Payment Gateway           | HTTPS     | 443   | API Key         |
| Shipment Service         | Shipping Provider         | HTTPS     | 443   | API Key         |
| Notification Service     | SES/SNS                   | HTTPS     | 443   | IAM Role        |

---

## 5. Data Storage Allocation

### 5.1 PostgreSQL Schemas (Logical Separation)

Each service operates on its own schema within PostgreSQL. No cross-schema queries are permitted.

| Schema                    | Service                         | Key Tables                              |
| ------------------------- | ------------------------------- | --------------------------------------- |
| `product`                 | Product Service                 | `products`, `categories`                |
| `cart`                    | Cart Service                    | `carts`, `cart_items`                   |
| `sale`                    | Sale Service                    | `sales`, `sale_products`                |
| `inventory`               | Inventory & Reservation Service | `inventory`, `inventory_reservations`   |
| `payment`                 | Payment Service                 | `payments`, `payment_events`            |
| `ordering`                | Order Service                   | `orders`, `order_items`, `order_history`|
| `fulfilment`              | Fulfilment Service              | `fulfilments`, `fulfilment_items`       |
| `shipment`                | Shipment Service                | `shipments`, `tracking_events`          |
| `notification`            | Notification Service            | `notifications`, `templates`            |

### 5.2 Redis Key Namespaces

| Namespace                | Service                  | Purpose                     | TTL          |
| ------------------------ | ------------------------ | --------------------------- | ------------ |
| `rl:*`                   | API Gateway              | Rate limiting counters      | 60s          |
| `ss:queue:*`             | StormShield              | Queue positions (sorted set)| Sale duration|
| `ss:token:*`             | StormShield              | Admission tokens            | 60s          |
| `ss:admitted:*`          | StormShield              | Admitted user set           | 300s         |
| `cache:product:*`        | Product Service          | Product detail cache        | 300s         |
| `cache:sale:*`           | Sale Service             | Active sale config cache    | 60s          |
| `cart:*`                 | Cart Service             | Active cart state           | 24h          |
| `checkout:session:*`     | Checkout Service         | Checkout session            | 300s         |
| `inv:available:*`        | Inventory & Reservation  | Stock count cache (read)    | 10s          |
