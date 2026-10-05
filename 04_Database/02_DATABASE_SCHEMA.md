# GlowRush — Database Schema Specification

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL
> **DB Engine:** PostgreSQL 15+

---

## 1. ENUM Types

```sql
-- Reservation lifecycle (FROZEN — Student 2)
CREATE TYPE reservation_status AS ENUM (
    'RESERVED',
    'PAYMENT_PENDING',
    'CONFIRMED',
    'SOLD',
    'RELEASED'
);

-- Payment lifecycle
CREATE TYPE payment_status AS ENUM (
    'INITIATED',
    'PROCESSING',
    'SUCCESS',
    'FAILED',
    'TIMEOUT'
);

-- Order lifecycle (FROZEN — Student 1 + Architecture Contract)
CREATE TYPE order_status AS ENUM (
    'CREATED',
    'PAYMENT_PENDING',
    'CONFIRMED',
    'PROCESSING',
    'SHIPPED',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'CANCELLED'
);

-- Sale lifecycle
CREATE TYPE sale_status AS ENUM (
    'SCHEDULED',
    'ACTIVE',
    'ENDED'
);

-- Fulfilment lifecycle
CREATE TYPE fulfilment_status AS ENUM (
    'PENDING',
    'PROCESSING',
    'PACKED',
    'DISPATCHED'
);

-- Shipment lifecycle
CREATE TYPE shipment_status AS ENUM (
    'CREATED',
    'LABEL_GENERATED',
    'DISPATCHED',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'RETURNED'
);

-- Notification channels
CREATE TYPE notification_channel AS ENUM ('EMAIL', 'SMS', 'PUSH');
CREATE TYPE notification_status  AS ENUM ('PENDING', 'SENT', 'FAILED');

-- Coupon discount type
CREATE TYPE discount_type AS ENUM ('PERCENTAGE', 'FIXED');

-- User role
CREATE TYPE customer_role AS ENUM ('CUSTOMER', 'ADMIN');
```

---

## 2. CUSTOMER

```sql
CREATE TABLE customers (
    customer_id    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(255) NOT NULL,
    password_hash  VARCHAR(255) NOT NULL,
    phone          VARCHAR(20),
    role           customer_role NOT NULL DEFAULT 'CUSTOMER',
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_customers_email UNIQUE (email),
    CONSTRAINT chk_customers_email_format CHECK (email ~* '^[^@]+@[^@]+\.[^@]+$')
);

CREATE INDEX idx_customers_email ON customers(email);
```

**Notes:**
- `password_hash` stores bcrypt (cost 12) — NEVER plaintext
- `role` distinguishes customers from admins
- PK: `customer_id` (UUID v4)
- UNIQUE: `email`

---

## 3. CATEGORY

```sql
CREATE TABLE categories (
    category_id  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL,
    slug         VARCHAR(100) NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_categories_name UNIQUE (name),
    CONSTRAINT uq_categories_slug UNIQUE (slug)
);
```

**Seeded categories (GlowRush skincare):**
`Cleanser`, `Serum`, `Moisturizer`, `Sunscreen`, `Toner`, `Face Mask`, `Lip Care`

---

## 4. PRODUCT

```sql
CREATE TABLE products (
    product_id   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id  UUID         NOT NULL REFERENCES categories(category_id),
    name         VARCHAR(255) NOT NULL,
    slug         VARCHAR(255) NOT NULL,
    description  TEXT,
    base_price   DECIMAL(10,2) NOT NULL,
    sku          VARCHAR(100) NOT NULL,
    image_url    VARCHAR(500),
    is_active    BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_products_slug UNIQUE (slug),
    CONSTRAINT uq_products_sku  UNIQUE (sku),
    CONSTRAINT chk_products_base_price CHECK (base_price > 0)
);

CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_is_active   ON products(is_active);
CREATE INDEX idx_products_sku         ON products(sku);
```

---

## 5. INVENTORY  *(Schema FROZEN — Student 2)*

```sql
CREATE TABLE inventory (
    inventory_id        UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID         NOT NULL REFERENCES products(product_id),
    available_quantity  INTEGER      NOT NULL DEFAULT 0,
    reserved_quantity   INTEGER      NOT NULL DEFAULT 0,
    sold_quantity       INTEGER      NOT NULL DEFAULT 0,
    version             INTEGER      NOT NULL DEFAULT 0,
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_inventory_product_id    UNIQUE (product_id),
    CONSTRAINT chk_available_non_negative CHECK (available_quantity >= 0),
    CONSTRAINT chk_reserved_non_negative  CHECK (reserved_quantity  >= 0),
    CONSTRAINT chk_sold_non_negative      CHECK (sold_quantity      >= 0)
);

CREATE INDEX idx_inventory_product_id ON inventory(product_id);
```

**Invariant (enforced by atomic UPDATE):**
```
available_quantity + reserved_quantity + sold_quantity = initial_stock
```

**Canonical atomic reservation UPDATE (FROZEN — do NOT change):**
```sql
UPDATE inventory
SET
    available_quantity = available_quantity - :quantity,
    reserved_quantity  = reserved_quantity  + :quantity,
    version            = version + 1,
    updated_at         = NOW()
WHERE product_id = :product_id
  AND available_quantity >= :quantity;
-- affected_rows = 1 → success; 0 → out of stock
```

---

## 6. INVENTORY_RESERVATION  *(Schema FROZEN — Student 2)*

```sql
CREATE TABLE inventory_reservation (
    reservation_id   UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id       UUID               NOT NULL REFERENCES products(product_id),
    customer_id      UUID               NOT NULL REFERENCES customers(customer_id),
    quantity         INTEGER            NOT NULL DEFAULT 1,
    status           reservation_status NOT NULL DEFAULT 'RESERVED',
    idempotency_key  VARCHAR(255)       NOT NULL,
    expires_at       TIMESTAMPTZ        NOT NULL,
    created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_reservation_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT chk_quantity_positive           CHECK (quantity > 0),
    CONSTRAINT chk_quantity_max_one            CHECK (quantity <= 1)  -- flash sale: 1 per customer
);

CREATE INDEX idx_reservation_customer_id ON inventory_reservation(customer_id);
CREATE INDEX idx_reservation_product_id  ON inventory_reservation(product_id);
CREATE INDEX idx_reservation_status      ON inventory_reservation(status);
CREATE INDEX idx_reservation_expires_at  ON inventory_reservation(expires_at)
    WHERE status IN ('RESERVED', 'PAYMENT_PENDING');
```

---

## 7. CART

```sql
CREATE TABLE carts (
    cart_id      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id  UUID        NOT NULL REFERENCES customers(customer_id),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_carts_customer_id UNIQUE (customer_id)
);

CREATE INDEX idx_carts_customer_id ON carts(customer_id);
```

## 8. CART_ITEM

```sql
CREATE TABLE cart_items (
    cart_item_id  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id       UUID          NOT NULL REFERENCES carts(cart_id) ON DELETE CASCADE,
    product_id    UUID          NOT NULL REFERENCES products(product_id),
    quantity      INTEGER       NOT NULL DEFAULT 1,
    unit_price    DECIMAL(10,2) NOT NULL,
    added_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_cart_items_cart_product UNIQUE (cart_id, product_id),
    CONSTRAINT chk_cart_item_quantity CHECK (quantity > 0)
);

CREATE INDEX idx_cart_items_cart_id    ON cart_items(cart_id);
CREATE INDEX idx_cart_items_product_id ON cart_items(product_id);
```

---

## 9. SALE

```sql
CREATE TABLE sales (
    sale_id     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    start_time  TIMESTAMPTZ  NOT NULL,
    end_time    TIMESTAMPTZ  NOT NULL,
    status      sale_status  NOT NULL DEFAULT 'SCHEDULED',
    total_units INTEGER      NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_sale_time_range  CHECK (end_time > start_time),
    CONSTRAINT chk_sale_total_units CHECK (total_units > 0)
);

CREATE INDEX idx_sales_status     ON sales(status);
CREATE INDEX idx_sales_start_time ON sales(start_time);
```

## 10. DEAL

```sql
CREATE TABLE deals (
    deal_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id         UUID          NOT NULL REFERENCES sales(sale_id),
    product_id      UUID          NOT NULL REFERENCES products(product_id),
    sale_price      DECIMAL(10,2) NOT NULL,
    units_available INTEGER       NOT NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_deals_sale_product   UNIQUE (sale_id, product_id),
    CONSTRAINT chk_deal_sale_price     CHECK (sale_price > 0),
    CONSTRAINT chk_deal_units          CHECK (units_available > 0)
);

CREATE INDEX idx_deals_sale_id    ON deals(sale_id);
CREATE INDEX idx_deals_product_id ON deals(product_id);
```

## 11. COUPON

```sql
CREATE TABLE coupons (
    coupon_id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    code              VARCHAR(50)   NOT NULL,
    discount_type     discount_type NOT NULL,
    discount_value    DECIMAL(10,2) NOT NULL,
    min_order_amount  DECIMAL(10,2) NOT NULL DEFAULT 0,
    max_uses          INTEGER       NOT NULL DEFAULT 1,
    used_count        INTEGER       NOT NULL DEFAULT 0,
    valid_from        TIMESTAMPTZ   NOT NULL,
    valid_until       TIMESTAMPTZ   NOT NULL,
    is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_coupons_code         UNIQUE (code),
    CONSTRAINT chk_coupon_time_range   CHECK (valid_until > valid_from),
    CONSTRAINT chk_coupon_used_count   CHECK (used_count <= max_uses),
    CONSTRAINT chk_coupon_discount_val CHECK (discount_value > 0)
);

CREATE INDEX idx_coupons_code       ON coupons(code);
CREATE INDEX idx_coupons_is_active  ON coupons(is_active);
```

---

## 12. PAYMENT  *(dual-unique-constraint idempotency design)*

```sql
CREATE TABLE payments (
    payment_id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id               UUID           REFERENCES orders(order_id),  -- nullable initially
    reservation_id         UUID           NOT NULL REFERENCES inventory_reservation(reservation_id),
    transaction_reference  VARCHAR(255),                                -- set by gateway
    idempotency_key        VARCHAR(255)   NOT NULL,
    amount                 DECIMAL(10,2)  NOT NULL,
    currency               VARCHAR(3)     NOT NULL DEFAULT 'INR',
    status                 payment_status NOT NULL DEFAULT 'INITIATED',
    provider               VARCHAR(50)    NOT NULL,                     -- 'stripe'|'razorpay'|'mock'
    failure_reason         VARCHAR(500),
    gateway_response       JSONB,
    created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_payments_transaction_reference UNIQUE (transaction_reference),
    CONSTRAINT uq_payments_idempotency_key       UNIQUE (idempotency_key),
    CONSTRAINT chk_payments_amount               CHECK (amount > 0),
    CONSTRAINT chk_payments_currency_length      CHECK (char_length(currency) = 3)
);

CREATE INDEX idx_payments_order_id        ON payments(order_id);
CREATE INDEX idx_payments_reservation_id  ON payments(reservation_id);
CREATE INDEX idx_payments_status          ON payments(status);
CREATE INDEX idx_payments_idempotency_key ON payments(idempotency_key);
```

### Why Two Unique Constraints on PAYMENT?

| Constraint | Purpose | What it prevents |
|-----------|---------|-----------------|
| `UNIQUE (idempotency_key)` | **Client-side deduplication** — the key is generated by the client/checkout before calling Payment Service. A retry with the same key hits the DB constraint before any gateway call. | Creating two payment records for the same checkout attempt. Even if the client retries 100 times during a flash sale, only ONE payment record is ever inserted. |
| `UNIQUE (transaction_reference)` | **Gateway-side deduplication** — the `transaction_reference` is assigned by the external payment gateway on success. Two different client requests that somehow both reach the gateway and succeed would produce the same gateway reference, violating this constraint. | Double-charging a customer even if the idempotency key somehow differed (e.g., client bug generating two keys for one checkout). |

Together they form a two-layer safety net: the `idempotency_key` stops duplicates at our application layer; `transaction_reference` stops them at the gateway layer.

---

## 13. ORDER

```sql
CREATE TABLE orders (
    order_id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id       UUID         NOT NULL REFERENCES customers(customer_id),
    reservation_id    UUID         NOT NULL REFERENCES inventory_reservation(reservation_id),
    payment_id        UUID         REFERENCES payments(payment_id),   -- set after payment confirmed
    coupon_id         UUID         REFERENCES coupons(coupon_id),     -- nullable
    status            order_status NOT NULL DEFAULT 'CREATED',
    total_amount      DECIMAL(10,2) NOT NULL,
    discount_amount   DECIMAL(10,2) NOT NULL DEFAULT 0,
    shipping_address  JSONB        NOT NULL,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_orders_reservation_id UNIQUE (reservation_id),   -- 1 order per reservation
    CONSTRAINT uq_orders_payment_id     UNIQUE (payment_id),       -- 1 order per payment
    CONSTRAINT chk_orders_total_amount  CHECK (total_amount > 0),
    CONSTRAINT chk_orders_discount      CHECK (discount_amount >= 0)
);

CREATE INDEX idx_orders_customer_id    ON orders(customer_id);
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_orders_reservation_id ON orders(reservation_id);
CREATE INDEX idx_orders_payment_id     ON orders(payment_id);
CREATE INDEX idx_orders_created_at     ON orders(created_at DESC);
```

## 14. ORDER_ITEM

```sql
CREATE TABLE order_items (
    order_item_id  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID          NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id     UUID          NOT NULL REFERENCES products(product_id),
    quantity       INTEGER       NOT NULL,
    unit_price     DECIMAL(10,2) NOT NULL,
    subtotal       DECIMAL(10,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,

    CONSTRAINT chk_order_item_quantity  CHECK (quantity > 0),
    CONSTRAINT chk_order_item_price     CHECK (unit_price > 0)
);

CREATE INDEX idx_order_items_order_id   ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);
```

---

## 15. FULFILMENT

```sql
CREATE TABLE fulfilments (
    fulfilment_id  UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id       UUID              NOT NULL REFERENCES orders(order_id),
    status         fulfilment_status NOT NULL DEFAULT 'PENDING',
    packed_by      VARCHAR(100),
    packed_at      TIMESTAMPTZ,
    created_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_fulfilments_order_id UNIQUE (order_id)   -- 1 fulfilment per order
);

CREATE INDEX idx_fulfilments_order_id ON fulfilments(order_id);
CREATE INDEX idx_fulfilments_status   ON fulfilments(status);
```

## 16. SHIPMENT

```sql
CREATE TABLE shipments (
    shipment_id        UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id           UUID            NOT NULL REFERENCES orders(order_id),
    fulfilment_id      UUID            NOT NULL REFERENCES fulfilments(fulfilment_id),
    tracking_number    VARCHAR(100),
    carrier            VARCHAR(100),
    status             shipment_status NOT NULL DEFAULT 'CREATED',
    shipping_address   JSONB           NOT NULL,
    estimated_delivery TIMESTAMPTZ,
    dispatched_at      TIMESTAMPTZ,
    delivered_at       TIMESTAMPTZ,
    created_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_shipments_tracking_number UNIQUE (tracking_number)
);

CREATE INDEX idx_shipments_order_id      ON shipments(order_id);
CREATE INDEX idx_shipments_fulfilment_id ON shipments(fulfilment_id);
CREATE INDEX idx_shipments_status        ON shipments(status);
```

## 17. NOTIFICATION

```sql
CREATE TABLE notifications (
    notification_id  UUID                 PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id      UUID                 NOT NULL REFERENCES customers(customer_id),
    channel          notification_channel NOT NULL,
    event_type       VARCHAR(100)         NOT NULL,
    subject          VARCHAR(255),
    body             TEXT                 NOT NULL,
    status           notification_status  NOT NULL DEFAULT 'PENDING',
    retry_count      INTEGER              NOT NULL DEFAULT 0,
    sent_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ          NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_notifications_retry CHECK (retry_count >= 0)
);

CREATE INDEX idx_notifications_customer_id ON notifications(customer_id);
CREATE INDEX idx_notifications_status      ON notifications(status);
CREATE INDEX idx_notifications_event_type  ON notifications(event_type);
```

## 18. PROCESSED_EVENTS  *(idempotency fence — each service has own copy)*

```sql
CREATE TABLE processed_events (
    event_id     UUID         PRIMARY KEY,
    event_type   VARCHAR(100) NOT NULL,
    result       JSONB,
    processed_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Auto-purge events older than 24h via maintenance job
-- Prevents unbounded table growth
CREATE INDEX idx_processed_events_processed_at ON processed_events(processed_at);
```

---

## 19. Transaction Boundaries

### Boundary 1 — Reservation Creation (Inventory Service)
```sql
BEGIN;
  -- 1. Idempotency check
  SELECT event_id FROM processed_events WHERE event_id = :idempotency_key;
  -- 2. Atomic inventory update
  UPDATE inventory SET available_quantity = available_quantity - 1,
         reserved_quantity = reserved_quantity + 1, version = version + 1
  WHERE product_id = :product_id AND available_quantity >= 1;
  -- 3. Reservation insert
  INSERT INTO inventory_reservation (...) ON CONFLICT DO NOTHING;
  -- 4. Record idempotency
  INSERT INTO processed_events (event_id, event_type) VALUES (:idempotency_key, 'RESERVE');
COMMIT;
-- POST-COMMIT: Redis cache invalidation + RabbitMQ publish
```

### Boundary 2 — Payment Creation (Payment Service)
```sql
BEGIN;
  -- 1. Idempotency check (UNIQUE constraint will reject duplicate)
  INSERT INTO payments (payment_id, reservation_id, idempotency_key, amount, ...)
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING *;
  -- 2. If INSERT returned nothing → fetch existing record and return it
COMMIT;
-- POST-COMMIT: Call payment gateway (outside DB transaction)
```

### Boundary 3 — Order Creation (Order Service)
```sql
BEGIN;
  -- 1. Check processed_events for PaymentConfirmed event_id
  SELECT event_id FROM processed_events WHERE event_id = :payment_confirmed_event_id;
  -- 2. Insert order (UNIQUE reservation_id prevents duplicate orders)
  INSERT INTO orders (order_id, customer_id, reservation_id, payment_id, ...)
  ON CONFLICT (reservation_id) DO NOTHING
  RETURNING *;
  -- 3. Insert order items
  INSERT INTO order_items (...) VALUES (...);
  -- 4. Record event as processed
  INSERT INTO processed_events VALUES (:payment_confirmed_event_id, 'PaymentConfirmed');
COMMIT;
-- POST-COMMIT: Publish OrderCreated, OrderConfirmed to RabbitMQ
```

### Boundary 4 — Payment Webhook Handling (Payment Service)
```sql
BEGIN;
  UPDATE payments
  SET status = :new_status,
      transaction_reference = :gateway_ref,
      gateway_response = :raw_response,
      failure_reason = :reason,
      updated_at = NOW()
  WHERE payment_id = :payment_id
    AND status IN ('INITIATED', 'PROCESSING', 'TIMEOUT');  -- guard: only update open states
COMMIT;
-- POST-COMMIT: Publish PaymentConfirmed or PaymentFailed to RabbitMQ
```

---

## 20. Index Strategy Summary

| Table | Index | Type | Purpose |
|-------|-------|------|---------|
| `customers` | `email` | UNIQUE B-tree | Login lookup |
| `products` | `category_id`, `is_active` | B-tree | Browse / filter |
| `inventory` | `product_id` | UNIQUE B-tree | Availability check |
| `inventory_reservation` | `customer_id`, `product_id`, `status`, `expires_at` (partial) | B-tree | TTL cron, status checks |
| `payments` | `idempotency_key`, `status`, `reservation_id` | B-tree | Idempotency, reconciliation |
| `orders` | `customer_id`, `status`, `reservation_id`, `created_at DESC` | B-tree | Customer history, lifecycle |
| `order_items` | `order_id`, `product_id` | B-tree | Order detail, analytics |
| `notifications` | `customer_id`, `status` | B-tree | Retry jobs, history |
| `processed_events` | `processed_at` | B-tree | Retention purge job |
