# GlowRush — Master ER Diagram

> **Owner:** Student 3 (Data, API, Payment, Order & Reliability Engineer)
> **Version:** 1.0 | **Status:** FINAL
> **Contracts followed:** ARCHITECTURE_CONTRACT v1.0, INVENTORY_CONTRACT v1.0, NAMING_RULES v1.0

---

## 1. Entity Relationship Diagram

```mermaid
erDiagram

    %% ────────────────────────── CUSTOMER DOMAIN ──────────────────────────
    customers {
        UUID        customer_id    PK
        VARCHAR     first_name
        VARCHAR     last_name
        VARCHAR     email          "UNIQUE"
        VARCHAR     password_hash
        VARCHAR     phone
        VARCHAR     role
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    %% ────────────────────────── PRODUCT DOMAIN ──────────────────────────
    categories {
        UUID        category_id   PK
        VARCHAR     name          "UNIQUE"
        VARCHAR     slug          "UNIQUE"
        TEXT        description
        TIMESTAMPTZ created_at
    }

    products {
        UUID        product_id    PK
        UUID        category_id   FK
        VARCHAR     name
        VARCHAR     slug          "UNIQUE"
        TEXT        description
        DECIMAL     base_price
        VARCHAR     sku           "UNIQUE"
        VARCHAR     image_url
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    %% ──────── INVENTORY DOMAIN (FROZEN — Student 2 owns semantics) ────────
    inventory {
        UUID        inventory_id        PK
        UUID        product_id          FK "UNIQUE"
        INTEGER     available_quantity
        INTEGER     reserved_quantity
        INTEGER     sold_quantity
        INTEGER     version
        TIMESTAMPTZ updated_at
    }

    inventory_reservation {
        UUID        reservation_id   PK
        UUID        product_id       FK
        UUID        customer_id      FK
        INTEGER     quantity
        VARCHAR     status           "ENUM: RESERVED|PAYMENT_PENDING|CONFIRMED|SOLD|RELEASED"
        VARCHAR     idempotency_key  "UNIQUE"
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    %% ────────────────────────── CART DOMAIN ──────────────────────────
    carts {
        UUID        cart_id       PK
        UUID        customer_id   FK "UNIQUE"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    cart_items {
        UUID        cart_item_id  PK
        UUID        cart_id       FK
        UUID        product_id    FK
        INTEGER     quantity
        DECIMAL     unit_price
        TIMESTAMPTZ added_at
    }

    %% ────────────────────────── SALE DOMAIN ──────────────────────────
    sales {
        UUID        sale_id        PK
        VARCHAR     name
        TIMESTAMPTZ start_time
        TIMESTAMPTZ end_time
        VARCHAR     status         "ENUM: SCHEDULED|ACTIVE|ENDED"
        INTEGER     total_units
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    deals {
        UUID        deal_id         PK
        UUID        sale_id         FK
        UUID        product_id      FK
        DECIMAL     sale_price
        INTEGER     units_available
        TIMESTAMPTZ created_at
    }

    coupons {
        UUID        coupon_id        PK
        VARCHAR     code             "UNIQUE"
        VARCHAR     discount_type    "ENUM: PERCENTAGE|FIXED"
        DECIMAL     discount_value
        DECIMAL     min_order_amount
        INTEGER     max_uses
        INTEGER     used_count
        TIMESTAMPTZ valid_from
        TIMESTAMPTZ valid_until
        BOOLEAN     is_active
        TIMESTAMPTZ created_at
    }

    %% ────────────────────────── PAYMENT DOMAIN ──────────────────────────
    payments {
        UUID        payment_id              PK
        UUID        order_id                FK "nullable — set after order created"
        UUID        reservation_id          FK
        VARCHAR     transaction_reference   "UNIQUE"
        VARCHAR     idempotency_key         "UNIQUE"
        DECIMAL     amount
        VARCHAR     currency
        VARCHAR     status                  "ENUM: INITIATED|PROCESSING|SUCCESS|FAILED|TIMEOUT"
        VARCHAR     provider
        VARCHAR     failure_reason
        JSONB       gateway_response
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    %% ────────────────────────── ORDER DOMAIN ──────────────────────────
    orders {
        UUID        order_id         PK
        UUID        customer_id      FK
        UUID        reservation_id   FK "UNIQUE"
        UUID        payment_id       FK "UNIQUE"
        UUID        coupon_id        FK "nullable"
        VARCHAR     status           "ENUM: CREATED|PAYMENT_PENDING|CONFIRMED|PROCESSING|SHIPPED|OUT_FOR_DELIVERY|DELIVERED|CANCELLED"
        DECIMAL     total_amount
        DECIMAL     discount_amount
        JSONB       shipping_address
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    order_items {
        UUID        order_item_id  PK
        UUID        order_id       FK
        UUID        product_id     FK
        INTEGER     quantity
        DECIMAL     unit_price
        DECIMAL     subtotal
    }

    %% ────────────────────────── FULFILMENT DOMAIN ──────────────────────────
    fulfilments {
        UUID        fulfilment_id  PK
        UUID        order_id       FK "UNIQUE"
        VARCHAR     status         "ENUM: PENDING|PROCESSING|PACKED|DISPATCHED"
        VARCHAR     packed_by
        TIMESTAMPTZ packed_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    %% ────────────────────────── SHIPMENT DOMAIN ──────────────────────────
    shipments {
        UUID        shipment_id        PK
        UUID        order_id           FK
        UUID        fulfilment_id      FK
        VARCHAR     tracking_number    "UNIQUE"
        VARCHAR     carrier
        VARCHAR     status             "ENUM: CREATED|LABEL_GENERATED|DISPATCHED|IN_TRANSIT|OUT_FOR_DELIVERY|DELIVERED|RETURNED"
        JSONB       shipping_address
        TIMESTAMPTZ estimated_delivery
        TIMESTAMPTZ dispatched_at
        TIMESTAMPTZ delivered_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    %% ────────────────────────── NOTIFICATION DOMAIN ──────────────────────────
    notifications {
        UUID        notification_id  PK
        UUID        customer_id      FK
        VARCHAR     channel          "ENUM: EMAIL|SMS|PUSH"
        VARCHAR     event_type
        VARCHAR     subject
        TEXT        body
        VARCHAR     status           "ENUM: PENDING|SENT|FAILED"
        INTEGER     retry_count
        TIMESTAMPTZ sent_at
        TIMESTAMPTZ created_at
    }

    %% ────────────────────────── IDEMPOTENCY COLLECTION ──────────────────────────
    processed_events {
        UUID        event_id      PK
        VARCHAR     event_type
        JSONB       result
        TIMESTAMPTZ processed_at
    }

    %% ────────────────────────── RELATIONSHIPS ──────────────────────────

    customers            ||--o{ inventory_reservation : "makes"
    customers            ||--o|  carts                : "has one"
    customers            ||--o{ orders                : "places"
    customers            ||--o{ notifications         : "receives"

    categories           ||--o{ products              : "classifies"

    products             ||--||  inventory            : "tracked by"
    products             ||--o{ inventory_reservation : "reserved in"
    products             ||--o{ cart_items            : "added to"
    products             ||--o{ deals                 : "featured in"
    products             ||--o{ order_items           : "ordered as"

    carts                ||--o{ cart_items            : "contains"

    sales                ||--o{ deals                 : "comprises"

    inventory_reservation ||--o{ orders               : "anchors"
    inventory_reservation ||--||  payments            : "linked to"

    orders               ||--o{ order_items           : "contains"
    orders               ||--o|  payments             : "paid by"
    orders               ||--o|  fulfilments          : "fulfilled by"
    orders               ||--o{ notifications         : "generates"

    fulfilments          ||--o{ shipments             : "dispatched as"

    coupons              ||--o{ orders                : "applied to"
```

---

## 2. Data Ownership Map

| Entity | Owning Service | Storage | Consistency Model |
|--------|---------------|---------|-------------------|
| `customers` | Auth Service (API Gateway) | MongoDB | **Strong — ACID** |
| `categories` | Product Service | MongoDB + Redis cache | Strong |
| `products` | Product Service | MongoDB + Redis cache (5 min TTL) | Strong write, Eventually consistent read |
| `inventory` | **Inventory & Reservation Service** | MongoDB | **Strongly consistent — atomic conditional UPDATE** |
| `inventory_reservation` | **Inventory & Reservation Service** | MongoDB | **Strongly consistent — idempotency key UNIQUE** |
| `carts` | Cart Service | Redis (hot) + MongoDB (persist) | **Eventually consistent** |
| `cart_items` | Cart Service | Redis (hot) + MongoDB (persist) | **Eventually consistent** |
| `sales` | Sale Service | MongoDB + Redis cache | Strong write, Eventually consistent read |
| `deals` | Sale Service | MongoDB + Redis cache | Strong write, Eventually consistent read |
| `coupons` | Sale Service | MongoDB | **Strong** |
| `payments` | **Payment Service** | MongoDB | **Strongly consistent — dual UNIQUE constraint** |
| `orders` | **Order Service** | MongoDB | **Strongly consistent** |
| `order_items` | **Order Service** | MongoDB | **Strongly consistent** |
| `fulfilments` | Fulfilment Service | MongoDB | **Eventually consistent** |
| `shipments` | Shipment Service | MongoDB | **Eventually consistent** |
| `notifications` | Notification Service | MongoDB | **Eventually consistent** |
| `processed_events` | Every service (own copy) | MongoDB | **Strong — idempotency fence** |

---

## 3. Strongly Consistent vs Eventually Consistent

### Strongly Consistent (ACID Transactions Required)

These entities represent money, stock, and legal records. Any failure must roll back completely.

| Entity | Why Strong Consistency |
|--------|----------------------|
| `inventory` | Oversell prevention — atomic MongoDB is the single consistency point |
| `inventory_reservation` | Guarantees one-reservation-per-idempotency-key |
| `payments` | Financial record — duplicate gateway charges are catastrophic |
| `orders` | Business contract with customer |
| `order_items` | Legal record of what was sold |
| `coupons.used_count` | Prevents coupon abuse |

### Eventually Consistent (Accepcollection Lag)

| Entity | Why Eventual Consistency OK |
|--------|---------------------------|
| `carts` | Shopping cart state is reconstructible; brief staleness accepcollection |
| `notifications` | Best-effort delivery; user accepts retries |
| `fulfilments` | Warehouse ops don't require real-time accuracy |
| `shipments` | Carrier updates are inherently delayed |
| Product/Sale Redis caches | Stale catalog data accepcollection for seconds |

---

## 4. Cross-Service Access Rules

> [!IMPORTANT]
> No service reads or writes another service's database collections directly.
> All cross-service access is via REST APIs or RabbitMQ events.

| Accessing Service | Target Data | Mechanism |
|------------------|-------------|-----------|
| Checkout Service | Reservation status | `GET /api/v1/reservations/:id` |
| Payment Service | Reservation ID | Passed in request body at checkout |
| Order Service | Payment confirmation | `PaymentConfirmed` RabbitMQ event |
| Fulfilment Service | Order details | `GET /api/v1/orders/:orderId` |
| Shipment Service | Fulfilment info | `ShipmentCreated` RabbitMQ event |
| Notification Service | Customer info | Event payload carries `customerId` |
| Inventory Service | Payment result | `PaymentConfirmed` / `PaymentFailed` events |

---

## 5. Audit & Concurrency Fields

| Field | Collections | Purpose |
|-------|--------|---------|
| `created_at` | All business entities | Immucollection creation timestamp |
| `updated_at` | All mucollection entities | Tracks last modification (trigger-maintained) |
| `version` | `inventory` only | Optimistic concurrency version (incremented on every UPDATE) |
| `idempotency_key` | `inventory_reservation`, `payments` | Prevents duplicate operations |
| `transaction_reference` | `payments` | Gateway's unique reference; prevents double-charge |
