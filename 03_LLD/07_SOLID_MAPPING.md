# GlowRush — SOLID Mapping: Inventory & Reservation Service

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL

---

## Overview

This document maps every class and interface in the Inventory & Reservation Service to the SOLID principle(s) it embodies. This is not a textbook definition — every mapping references a specific class with a specific design decision that enforces the principle.

---

## S — Single Responsibility Principle

> *A class should have only one reason to change.*

### `ReservationService`

**One responsibility:** Managing reservation lifecycle transitions.

```
ReservationService:
  - createReservation()       ← creation logic only
  - cancelReservation()       ← cancellation only
  - confirmReservation()      ← payment confirmation only
  - processPaymentFailure()   ← payment failure only
  - transitionTo()            ← state machine only

NOT in ReservationService:
  - Inventory quantity updates → InventoryService
  - Event publishing          → ReservationEventPublisher
  - Idempotency logic         → IdempotencyService
  - Policy checks             → ReservationPolicy
```

**Why SRP matters here:** If business rules around reservation creation change (e.g., add loyalty hold), only `ReservationService` changes. If event format changes, only `ReservationEventPublisher` changes. These reasons to change are isolated.

---

### `InventoryService`

**One responsibility:** Stock quantity management — reads, decrements, increments.

```
InventoryService:
  - checkAvailability()  ← read stock (via cache then DB)
  - releaseStock()       ← increment available, decrement reserved
  - confirmSold()        ← decrement reserved, increment sold

NOT in InventoryService:
  - Creating reservations    → ReservationService
  - Publishing events        → ReservationEventPublisher
  - Admission decisions      → StormShield (external)
```

---

### `ReservationExpiryWorker`

**One responsibility:** Periodic scan for expired reservations and triggering release.

```
ReservationExpiryWorker:
  - run()                       ← cron trigger
  - scanExpired()               ← DB scan only
  - releaseInventoryBatch()     ← inventory restore only
  - publishExpiryEvents()       ← event publishing only

NOT in ReservationExpiryWorker:
  - Admission control
  - Payment processing
  - Notification logic
```

---

### `IdempotencyService`

**One responsibility:** Deduplication of write operations via key lookup and recording.

```
IdempotencyService:
  - check(key)       ← lookup
  - record(key, val) ← persist

Nothing else.
```

---

### `InventoryPolicy` / `ReservationPolicy`

**One responsibility each:** Encoding business rules as pure functions.

```
InventoryPolicy:  canReserve(), isValidQuantity(), isSaleActive()
ReservationPolicy: canTransition(), isExpired(), computeExpiresAt()
```

Policy classes change only when business rules change. They do not depend on infrastructure.

---

## O — Open/Closed Principle

> *A class should be open for extension but closed for modification.*

### `ConcurrencyStrategy` (Interface)

```typescript
interface ConcurrencyStrategy {
  reserve(productId: string, quantity: number): Promise<ReservationResult>;
}
```

**Current implementation:** `AtomicConditionalStrategy`

**Extension without modification:** If the team ever needs to test a different strategy (e.g., `PessimisticLockStrategy` for integration testing or `RedisLuaStrategy` for a future migration), they create a new class implementing `ConcurrencyStrategy`. `CheckoutFacade` does not change.

```typescript
// Adding a new strategy = new file, zero changes to CheckoutFacade
class TestPessimisticStrategy implements ConcurrencyStrategy {
  async reserve(productId, quantity) {
    // SELECT FOR UPDATE logic
  }
}
```

---

### `ReservationState` (Interface)

```typescript
interface ReservationState {
  getName(): ReservationStatus;
  onEnter(reservation: Reservation): void;
  canTransitionTo(next: ReservationStatus): boolean;
}
```

**Extension:** New states (e.g., `FRAUD_HOLD`) can be added as new classes without touching existing state classes.

---

### `IEventPublisher` (Interface)

If RabbitMQ is replaced with another broker in a future phase, a new `SomeOtherBrokerPublisher` is created implementing `IEventPublisher`. No consumer of the publisher changes.

---

## L — Liskov Substitution Principle

> *Subtypes must be substitucollection for their base types without altering program correctness.*

### `AtomicConditionalStrategy` implements `ConcurrencyStrategy`

```typescript
// CheckoutFacade depends on the interface:
class CheckoutFacade {
  constructor(private strategy: ConcurrencyStrategy) {}

  async reserve(dto) {
    const result = await this.strategy.reserve(dto.productId, dto.quantity);
    // Uses only the interface contract: result.success, result.affectedRows
  }
}
```

Any class implementing `ConcurrencyStrategy` can be substituted. `CheckoutFacade` does not inspect the concrete type. If `AtomicConditionalStrategy` is swapped for `TestPessimisticStrategy`, behavior is correct because both fulfil the contract: return a `ReservationResult` with `success: boolean`.

---

### `InventoryRepository` implements `IInventoryRepository`

```typescript
// InventoryService depends on the interface, not the implementation:
class InventoryService {
  constructor(private repo: IInventoryRepository) {}
}
```

A `MockInventoryRepository` used in unit tests substitutes `InventoryRepository` without any contract violation. All methods return the same shape.

---

### `ReservedState`, `PaymentPendingState`, … implement `ReservationState`

Each state implementation:
- Returns its own `getName()` → always a valid `ReservationStatus`
- Implements `canTransitionTo()` → always returns boolean
- Implements `onEnter()` → always side-effect-free (no exceptions thrown on entry)

Substituting any `ReservationState` implementation preserves program correctness.

---

## I — Interface Segregation Principle

> *No client should be forced to depend on methods it does not use.*

### `IInventoryRepository` (focused interface)

```typescript
interface IInventoryRepository {
  findByProductId(productId: string): Promise<Inventory | null>;
  atomicReserve(productId: string, quantity: number): Promise<number>;
  releaseStock(productId: string, quantity: number): Promise<void>;
  confirmSold(productId: string, quantity: number): Promise<void>;
}
```

This interface does not include:
- Reservation creation (that's `IReservationRepository`)
- Event publishing (that's `IEventPublisher`)
- Idempotency (that's `IdempotencyRepository`)

**Without ISP violation:** `InventoryService` only imports `IInventoryRepository`. It is not burdened with reservation or event methods it doesn't use.

---

### `IEventPublisher` (single-method interface)

```typescript
interface IEventPublisher {
  publish(event: DomainEvent): Promise<void>;
}
```

Clients that publish events depend only on this one method. They are not coupled to channel management, exchange declaration, or message encoding — those are internal to `ReservationEventPublisher`.

---

### `IReservationRepository` (focused interface)

```typescript
interface IReservationRepository {
  findById(id: string): Promise<Reservation | null>;
  findByIdempotencyKey(key: string): Promise<Reservation | null>;
  save(reservation: Reservation): Promise<Reservation>;
  findExpired(): Promise<Reservation[]>;
  updateStatus(id: string, status: ReservationStatus): Promise<void>;
}
```

`ReservationService` depends on this. It does not see MongoDB-level details, pgPool references, or any admin-level operations (truncate, etc.) that only a database admin might use.

---

## D — Dependency Inversion Principle

> *High-level modules should not depend on low-level modules. Both should depend on abstractions.*

### `InventoryRepository` interface → DIP

```
High-level: InventoryService, CheckoutFacade
                     ↓ depend on
Abstraction: IInventoryRepository (interface)
                     ↑ implemented by
Low-level: InventoryRepository (PgPool MongoDB)
```

`InventoryService` never `import`s `InventoryRepository` directly. It receives `IInventoryRepository` via constructor injection. Swapping MongoDB for another store only requires a new implementation, not a change to `InventoryService`.

---

### `ReservationEventPublisher` → DIP

```
High-level: CheckoutFacade, ReservationExpiryWorker
                     ↓ depend on
Abstraction: IEventPublisher (interface)
                     ↑ implemented by
Low-level: ReservationEventPublisher (RabbitMQ channel)
```

`CheckoutFacade` publishes events without knowing about RabbitMQ connection pooling, channel confirmations, or exchange bindings.

---

### Constructor Injection (DI Pattern)

```typescript
// All dependencies injected at construction time
class CheckoutFacade {
  constructor(
    private idempotencyService: IdempotencyService,
    private inventoryPolicy: InventoryPolicy,
    private strategy: ConcurrencyStrategy,          // ← abstraction
    private reservationService: ReservationService,
    private eventPublisher: IEventPublisher,         // ← abstraction
  ) {}
}
```

All five dependencies are interfaces or domain classes — never concrete infrastructure classes. This makes unit testing trivial (mock all five) and makes infrastructure swappable without touching the facade.

---

## SOLID Summary Collection

| Class | S | O | L | I | D |
|-------|---|---|---|---|---|
| `InventoryService` | ✅ | — | — | — | ✅ |
| `ReservationService` | ✅ | — | — | — | ✅ |
| `IdempotencyService` | ✅ | — | — | — | — |
| `InventoryPolicy` | ✅ | — | — | — | — |
| `ReservationPolicy` | ✅ | — | — | — | — |
| `ConcurrencyStrategy` (interface) | — | ✅ | — | ✅ | ✅ |
| `AtomicConditionalStrategy` | ✅ | — | ✅ | — | — |
| `IInventoryRepository` (interface) | — | ✅ | — | ✅ | ✅ |
| `IReservationRepository` (interface) | — | ✅ | — | ✅ | ✅ |
| `IEventPublisher` (interface) | — | ✅ | — | ✅ | ✅ |
| `ReservationRepository` | ✅ | — | ✅ | — | — |
| `InventoryRepository` | ✅ | — | ✅ | — | — |
| `CheckoutFacade` | ✅ | — | — | — | ✅ |
| `ReservationEventPublisher` | ✅ | — | ✅ | — | — |
| `ReservationExpiryWorker` | ✅ | — | — | — | ✅ |
| `EventConsumerHandler` | ✅ | — | — | — | ✅ |
| `ReservationState` (interface) | — | ✅ | — | ✅ | — |
| `ReservedState`, etc. | ✅ | — | ✅ | — | — |
