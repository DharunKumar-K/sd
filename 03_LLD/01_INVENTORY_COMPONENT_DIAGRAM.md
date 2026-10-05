# GlowRush — Inventory & Reservation Service: Component Diagram

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL
> **References:** ARCHITECTURE_CONTRACT.md §7, SERVICE_CATALOG.md §6

---

## Overview

The Inventory & Reservation Service is the single source of truth for stock counts and reservations in GlowRush. It receives admission-token-validated requests from StormShield, performs atomic inventory operations on MongoDB, and publishes lifecycle events to RabbitMQ.

---

## Component Diagram

```mermaid
graph TB
    subgraph "External Callers"
        SS[StormShield<br/>Admission Layer]
        COS[Checkout Service]
        PAY_MQ[RabbitMQ<br/>payment.confirmed / payment.failed]
    end

    subgraph "Inventory & Reservation Service"

        subgraph "HTTP Layer"
            IC[InventoryController<br/>GET /api/v1/inventory/:productId/availability]
            RC[ReservationController<br/>POST /api/v1/reservations<br/>GET /api/v1/reservations/:id<br/>POST /api/v1/reservations/:id/cancel]
        end

        subgraph "Facade Layer"
            CF[CheckoutFacade<br/>Orchestrates: idempotency check<br/>→ atomic reserve → event publish]
        end

        subgraph "Domain Services"
            IS[InventoryService]
            RS[ReservationService]
            IDS[IdempotencyService]
            IP[InventoryPolicy]
            RP[ReservationPolicy]
        end

        subgraph "Concurrency Strategy"
            CS_STRAT[ConcurrencyStrategy interface]
            ACS[AtomicConditionalStrategy<br/>UPDATE WHERE available_quantity >= qty]
        end

        subgraph "Repository Layer"
            IR[IInventoryRepository interface]
            RR[IReservationRepository interface]
            IRImpl[InventoryRepository PgPool]
            RRImpl[ReservationRepository PgPool]
            IdempImpl[IdempotencyRepository]
        end

        subgraph "Event Infrastructure"
            EP[IEventPublisher interface]
            REP[ReservationEventPublisher<br/>RabbitMQ channel wrapper]
        end

        subgraph "Background Workers"
            REW[ReservationExpiryWorker<br/>Cron every 30s]
            EH[EventConsumerHandler<br/>payment.confirmed / payment.failed]
        end

        subgraph "Cache Layer"
            RCACHE[RedisCache<br/>availability read cache]
        end

    end

    subgraph "Infrastructure"
        PG[(MongoDB)]
        REDIS[(Redis)]
        RMQOUT[RabbitMQ glowrush.events]
    end

    SS -->|POST /api/v1/reservations| RC
    COS -->|GET, cancel| RC
    COS -->|GET availability| IC

    RC -->|createReservation| CF
    RC -->|cancelReservation| RS
    IC -->|checkAvailability| IS

    CF --> IDS
    CF --> IP
    CF --> CS_STRAT
    CF --> RS
    CF --> REP

    CS_STRAT --> ACS
    ACS --> IRImpl

    IS --> IRImpl
    RS --> RRImpl
    IDS --> IdempImpl
    RP --> RRImpl

    IRImpl --> PG
    RRImpl --> PG
    IdempImpl --> PG

    IS --> RCACHE
    RCACHE --> REDIS

    REP --> RMQOUT

    PAY_MQ --> EH
    EH --> RS
    EH --> IS
    EH --> REP

    REW --> RRImpl
    REW --> IRImpl
    REW --> REP
```

---

## Component Responsibilities

| Component | Layer | Responsibility |
|-----------|-------|----------------|
| `InventoryController` | HTTP | Routes inventory availability checks |
| `ReservationController` | HTTP | Routes reservation CRUD, validates admission token |
| `CheckoutFacade` | Facade | Orchestrates the multi-step reservation creation flow |
| `InventoryService` | Domain | Stock checks, sold confirmation, stock release logic |
| `ReservationService` | Domain | Reservation lifecycle transitions |
| `IdempotencyService` | Domain | Deduplication via idempotency key lookup & record |
| `InventoryPolicy` | Domain | Business rules: max qty, valid product, sale active |
| `ReservationPolicy` | Domain | Valid state transitions, expiry check |
| `ConcurrencyStrategy` | Abstraction | Interface for pluggable locking strategies |
| `AtomicConditionalStrategy` | Implementation | The canonical `UPDATE … WHERE available_quantity >= 1` |
| `IInventoryRepository` | Interface | Port for stock persistence |
| `IReservationRepository` | Interface | Port for reservation persistence |
| `InventoryRepository` | Adapter | PgPool implementation of inventory port |
| `ReservationRepository` | Adapter | PgPool implementation of reservation port |
| `IdempotencyRepository` | Adapter | Processed-events collection for deduplication |
| `ReservationEventPublisher` | Infra | Wraps RabbitMQ channel, enforces event envelope |
| `ReservationExpiryWorker` | Worker | Cron every 30s: finds and releases expired reservations |
| `EventConsumerHandler` | Worker | Subscribes to PaymentConfirmed / PaymentFailed |
| `RedisCache` | Infra | Read-side availability cache; invalidated on every write |

---

## Key Interfaces

```typescript
// Concurrency Strategy (Strategy Pattern)
interface ConcurrencyStrategy {
  reserve(productId: string, quantity: number): Promise<ReservationResult>;
}

// Repository ports (Dependency Inversion)
interface IInventoryRepository {
  findByProductId(productId: string): Promise<Inventory | null>;
  atomicReserve(productId: string, quantity: number): Promise<number>; // affected rows
  releaseStock(productId: string, quantity: number): Promise<void>;
  confirmSold(productId: string, quantity: number): Promise<void>;
}

interface IReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findByIdempotencyKey(key: string): Promise<Reservation | null>;
  save(reservation: Reservation): Promise<Reservation>;
  findExpired(): Promise<Reservation[]>;
  updateStatus(id: string, status: ReservationStatus): Promise<void>;
}

// Event publisher port
interface IEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
```

---

> [!IMPORTANT]
> All writes to `inventory` and `inventory_reservation` collections happen inside a single MongoDB transaction in `CheckoutFacade`. If the reservation INSERT fails after the inventory UPDATE, the entire transaction rolls back.
