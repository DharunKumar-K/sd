# GlowRush — Architecture Handoff Notes for Student 2

> **To:** Student 2 (LLD — Inventory & Reservation Service)  
> **From:** Student 1 (System Architect)  
> **Date:** 2026-10-05  

---

## 1. Your Mission

You are responsible for the Low-Level Design (LLD) of the **Inventory & Reservation Service**. 
This is the most critical service in the platform during a flash sale. It is the **single source of truth** for stock counts and the final barrier against overselling.

## 2. Boundaries & Constraints (FROZEN)

You must design within the boundaries established in `00_SHARED/ARCHITECTURE_CONTRACT.md`.

*   **Database:** PostgreSQL ONLY. Do not use Redis as the source of truth for stock counts.
*   **Concurrency Mechanism:** You must use **Atomic Conditional Updates** (not pessimistic locking, not optimistic locking version checks).
*   **Reservation TTL:** Exactly 5 minutes.
*   **Admission Control:** Do NOT build queueing or rate limiting into your service. Assume StormShield handles that. You will receive requests containing a validated Admission Token.

## 3. The Core Concurrency Requirement

You must design the exact SQL queries and repository layer logic to handle this scenario:
*   50 concurrent requests hit your service at the exact same millisecond.
*   They all attempt to reserve the same `product_id`.

Your LLD must feature this exact SQL pattern (or an ORM equivalent that compiles to this):

```sql
UPDATE inventory
SET
    available_quantity = available_quantity - 1,
    reserved_quantity  = reserved_quantity + 1,
    updated_at         = NOW()
WHERE product_id = :product_id
  AND available_quantity >= 1;
```

You need to clearly explain in your LLD how you evaluate `affected_rows`.

## 4. Specific Deliverables Expected in Your LLD

1.  **Class Diagram:** Showing Controllers, Services, Repositories, and Event Publishers.
2.  **Sequence Diagram (Reservation):** Showing the atomic update flow and idempotency check.
3.  **Sequence Diagram (Expiry):** Detailed design of the Cron/Scheduler that finds expired reservations (where `expires_at < NOW()` and `status = 'RESERVED'`) and releases them.
4.  **Idempotency Design:** How do you handle `X-Idempotency-Key` when creating a reservation?
5.  **Event Publishing:** You must publish `ReservationExpired`, `ReservationReleased`, and `InventoryDepleted` to RabbitMQ. Describe your transaction outbox pattern if you use one.

## 5. What You DO NOT Need to Design

*   StormShield (Virtual Waiting Room). I have designed this.
*   Payment integration. Student 3 handles this.
*   API Gateway or routing logic.

## 6. Required Reading

Before you begin, you MUST read:
*   `00_SHARED/ARCHITECTURE_CONTRACT.md`
*   `00_SHARED/DOMAIN_STATES.md` (Reservation state machine)
*   `08_Scalability_Reliability/FLASH_SALE_CONCURRENCY.md`

Good luck! The system's integrity relies entirely on your atomic update logic.
