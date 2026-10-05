# GlowRush — Naming Rules

> **Version:** 1.0 | **Status:** FROZEN | **Owner:** Student 1

---

## 1. Service Names

| Convention     | Format          | Example                         |
| -------------- | --------------- | ------------------------------- |
| Documentation  | Title Case      | Inventory & Reservation Service |
| Code / Docker  | kebab-case      | `inventory-reservation-service` |
| Environment    | SCREAMING_SNAKE | `INVENTORY_RESERVATION_SERVICE` |
| Database       | snake_case      | `inventory_reservation_service` |

---

## 2. API Paths

| Rule                 | Format                              | Example                       |
| -------------------- | ----------------------------------- | ----------------------------- |
| Base                 | `/api/v1/<resource>`                | `/api/v1/products`            |
| Resource (plural)    | lowercase, plural nouns             | `products`, `orders`, `sales` |
| Path params          | camelCase                           | `:productId`, `:orderId`      |
| Query params         | camelCase                           | `?pageSize=20&sortBy=price`   |
| Nested resources     | `/api/v1/<parent>/:id/<child>`      | `/api/v1/orders/:id/items`    |

---

## 3. Database Objects

| Object               | Format          | Example                         |
| -------------------- | --------------- | ------------------------------- |
| Table names          | snake_case, plural | `inventory_reservations`     |
| Column names         | snake_case      | `available_quantity`            |
| Primary keys         | `<table_singular>_id` | `reservation_id`          |
| Foreign keys         | `<referenced_table_singular>_id` | `product_id`    |
| Indexes              | `idx_<table>_<columns>` | `idx_reservations_product_id` |
| Unique constraints   | `uq_<table>_<columns>` | `uq_reservations_idempotency_key` |
| Enums                | SCREAMING_SNAKE | `PAYMENT_PENDING`, `CONFIRMED` |

---

## 4. RabbitMQ

| Object               | Format                              | Example                       |
| -------------------- | ----------------------------------- | ----------------------------- |
| Exchange             | `glowrush.events`                   | (single topic exchange)       |
| Routing key          | `<domain>.<action>`                 | `payment.confirmed`           |
| Queue                | `<consumer>.<routing-key>`          | `order.payment-confirmed`     |
| Dead letter exchange | `glowrush.events.dlx`              |                               |
| Dead letter queue    | `<consumer>.<routing-key>.dlq`      | `order.payment-confirmed.dlq` |

---

## 5. Event Names

| Convention     | Format          | Example                         |
| -------------- | --------------- | ------------------------------- |
| Event type     | PascalCase      | `PaymentConfirmed`              |
| Routing key    | dot.separated   | `payment.confirmed`             |
| Source field   | kebab-case      | `payment-service`               |

---

## 6. Code Conventions

| Item                  | Format          | Example                         |
| --------------------- | --------------- | ------------------------------- |
| Variables / functions | camelCase       | `reserveInventory()`            |
| Classes               | PascalCase      | `InventoryReservationService`   |
| Constants             | SCREAMING_SNAKE | `MAX_RESERVATION_TTL_MS`        |
| File names            | kebab-case      | `inventory-reservation.service.js` |
| Test files            | kebab-case      | `inventory-reservation.service.test.js` |
| Environment variables | SCREAMING_SNAKE | `DATABASE_URL`, `REDIS_HOST`    |
| Docker image tags     | kebab + semver  | `inventory-reservation-service:1.0.0` |

---

## 7. HTTP Headers

| Header                | Usage                                |
| --------------------- | ------------------------------------ |
| `X-Correlation-ID`    | Request tracing (UUID v4)            |
| `X-Admission-Token`   | StormShield admission JWT            |
| `X-Idempotency-Key`   | Write operation deduplication (UUID) |
| `X-Request-ID`        | Per-hop request identifier           |
| `Authorization`       | `Bearer <JWT>`                       |

---

## 8. Docker & Deployment

| Item                  | Format                              | Example                       |
| --------------------- | ----------------------------------- | ----------------------------- |
| Container names       | `glowrush-<service>`                | `glowrush-api-gateway`        |
| Docker network        | `glowrush-network`                  |                               |
| Docker volumes        | `glowrush-<service>-data`           | `glowrush-postgres-data`      |
| Compose service names | kebab-case                          | `inventory-reservation-service` |
| Port mapping          | `<host>:<container>`                | `3001:3000`                   |

---

## 9. Documentation

| Item                  | Format                              | Example                       |
| --------------------- | ----------------------------------- | ----------------------------- |
| File names            | SCREAMING_SNAKE.md                  | `ARCHITECTURE_CONTRACT.md`    |
| ADR files             | `ADR-NNN_TITLE.md`                  | `ADR-001_SQL_VS_NOSQL.md`     |
| Diagram files         | kebab-case + extension              | `system-context.mmd`          |

---

## 10. Git

| Item                  | Format                                    | Example                         |
| --------------------- | ----------------------------------------- | ------------------------------- |
| Branch naming         | `<type>/<ticket>-<description>`           | `feat/GR-42-stormshield-queue`  |
| Commit messages       | Conventional Commits                      | `feat(stormshield): add batch admission logic` |
| Types                 | `feat`, `fix`, `docs`, `refactor`, `test` |                                 |
