# GlowRush — LLD Index: Inventory & Reservation Service

> **Author:** Student 2 (Inventory, Concurrency & LLD Engineer)
> **Version:** 1.0 | **Status:** FINAL
> **Date:** 2026-10-05

---

## Deliverable Index

| # | File | Contents | Jury relevance |
|---|------|----------|---------------|
| 1 | [01_INVENTORY_COMPONENT_DIAGRAM.md](./01_INVENTORY_COMPONENT_DIAGRAM.md) | All service components, interfaces, data flows | Architecture depth |
| 2 | [02_CLASS_DIAGRAMS.md](./02_CLASS_DIAGRAMS.md) | Inventory class diagram, Reservation class diagram, state classes | OOP design, SOLID |
| 3 | [03_SEQUENCE_DIAGRAMS.md](./03_SEQUENCE_DIAGRAMS.md) | Happy path, last-item race, idempotency, expiry worker, payment confirmed/failed | End-to-end flows |
| 4 | [04_RESERVATION_STATE_DIAGRAM.md](./04_RESERVATION_STATE_DIAGRAM.md) | Reservation state machine with all transitions, invariants, terminal states | Domain correctness |
| 5 | [05_CONCURRENCY_STRATEGY.md](./05_CONCURRENCY_STRATEGY.md) | Pessimistic vs Optimistic vs Atomic comparison with proof | Concurrency expertise |
| 6 | [06_CONCURRENCY_WALKTHROUGH.md](./06_CONCURRENCY_WALKTHROUGH.md) | 10,000→100 layer-by-layer walkthrough with timelines | Flash sale readiness |
| 7 | [07_SOLID_MAPPING.md](./07_SOLID_MAPPING.md) | Every class mapped to SOLID principle(s) with code examples | Software engineering |
| 8 | [08_DESIGN_PATTERNS.md](./08_DESIGN_PATTERNS.md) | Strategy, Repository, State, Observer, Facade — each with problem/solution/tradeoff | Design patterns |
| 9 | [09_INVENTORY_API_CONTRACT.md](./09_INVENTORY_API_CONTRACT.md) | Full API contract for all endpoints (for Student 3) | API design |
| 10 | [10_INVENTORY_EVENT_CONTRACT.md](./10_INVENTORY_EVENT_CONTRACT.md) | All inventory events with payloads and idempotency rules | Event-driven design |
| 11 | [11_CONCURRENCY_SIMULATION.md](./11_CONCURRENCY_SIMULATION.md) | Node.js simulation + Locust config proving 100-stock guarantee | Empirical evidence |

---

## Shared Handoff

| File | Purpose |
|------|---------|
| [00_SHARED/INVENTORY_CONTRACT.md](../00_SHARED/INVENTORY_CONTRACT.md) | Complete handoff document for Student 3 |

---

## Architecture Compliance Checklist

> Confirming no deviations from Student 1's frozen architecture.

| Constraint | Status |
|-----------|--------|
| Technology stack unchanged (PostgreSQL, Redis, RabbitMQ, Node.js, Express.js) | ✅ |
| Service names match SERVICE_CATALOG.md exactly | ✅ |
| `inventory` and `inventory_reservation` table schemas match ARCHITECTURE_CONTRACT.md §8 | ✅ |
| Reservation states match ARCHITECTURE_CONTRACT.md §9 and DOMAIN_STATES.md §1 | ✅ |
| Canonical atomic SQL used exactly as specified in ARCHITECTURE_CONTRACT.md §7 | ✅ |
| Reservation TTL = exactly 5 minutes | ✅ |
| StormShield boundaries not violated (no admission logic in Inventory Service) | ✅ |
| No new databases introduced | ✅ |
| No changes to Payment, Order, Checkout Service designs | ✅ |
| Event names and routing keys match EVENT_CONTRACT.md | ✅ |
| Naming conventions follow NAMING_RULES.md | ✅ |
| API paths use `/api/v1/` prefix per NAMING_RULES.md §2 | ✅ |

---

## Key Design Decisions (Quick Reference for Jury)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Concurrency mechanism | Atomic conditional SQL (`WHERE available_quantity >= qty`) | Fastest, simplest, no retry storms, PostgreSQL-native correctness guarantee |
| Idempotency | `X-Idempotency-Key` header + `processed_events` table | Standard REST idempotency pattern; survives network retries |
| Reservation TTL enforcement | Cron worker every 30s (database scan) | Simple, reliable, fits PostgreSQL-primary architecture; no extra infrastructure |
| Event publishing timing | Post-commit only | Prevents event consumers from acting on rolled-back reservations |
| Cache strategy | Redis for reads, invalidated on every write | Reduces DB load for availability checks during flash sale; writes always go to PostgreSQL |
| Service as authority | Inventory Service owns ALL stock writes | No other service can modify `available_quantity` or `reserved_quantity` |

---

## The Single Most Important Statement

> **The `WHERE available_quantity >= quantity` clause in the atomic SQL update is the mathematical guarantee that prevents overselling. It is evaluated by PostgreSQL after acquiring an exclusive row lock, against the committed value of `available_quantity` — not the value seen at the start of a transaction. No application-level check, no Redis lock, no optimistic version guard is needed or used. The database is the final arbiter of stock truth.**
