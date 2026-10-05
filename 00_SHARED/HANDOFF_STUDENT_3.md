# GlowRush — Architecture Handoff Notes for Student 3

> **To:** Student 3 (LLD — Payment, Order, Database, API)  
> **From:** Student 1 (System Architect)  
> **Date:** 2026-10-05  

---

## 1. Your Mission

You are responsible for the Low-Level Design (LLD) of the **Checkout, Payment, Order, Fulfilment, and Shipment Services**. You are also responsible for the **Database Schemas** (across all services) and the detailed **API Contracts**.

## 2. Boundaries & Constraints (FROZEN)

You must design within the boundaries established in `00_SHARED/ARCHITECTURE_CONTRACT.md`.

*   **Database:** PostgreSQL. Define the schemas (DDL) for all domains.
*   **Communication:** 
    *   Checkout -> Payment is **Synchronous** (REST).
    *   Payment -> Order -> Fulfilment -> Shipment is **Asynchronous** (RabbitMQ).
*   **Idempotency:** Payment requests and Order creation must be strictly idempotent.

## 3. The Core Reliability Requirement

You must design for failure. The specific scenario you must solve in your LLD is:

> **Scenario:** The Payment Gateway returns "SUCCESS", but the Order Service crashes before the order can be created. 

Your LLD must clearly show how you use RabbitMQ to ensure **Eventual Consistency**. A confirmed payment MUST eventually result in a confirmed order, even if services are temporarily down.

## 4. Specific Deliverables Expected in Your LLD

1.  **Detailed Database Schemas:** ERD and DDL for all services (Product, Cart, Sale, Inventory, Payment, Order, etc.). Ensure logical separation (e.g., schemas or distinct table prefixes).
2.  **API Contracts:** Detailed OpenAPI/Swagger specifications for the endpoints listed in `00_SHARED/API_CONTRACT.md`. Include request/response bodies and error codes.
3.  **Payment Recovery Sequence:** A sequence diagram showing how a `PaymentConfirmed` event is published, consumed by the Order Service, and how Dead Letter Queues (DLQ) are handled if the Order Service fails to process it.
4.  **Idempotency Design:** How do you handle `X-Idempotency-Key` for Payment Initiation? How do you handle duplicate webhooks from the payment gateway?
5.  **Class Diagrams:** For Checkout, Payment, and Order services.

## 5. What You DO NOT Need to Design

*   StormShield (Virtual Waiting Room).
*   The internal logic of the atomic inventory update (Student 2 owns this).
*   Infrastructure deployment scaling policies.

## 6. Required Reading

Before you begin, you MUST read:
*   `00_SHARED/ARCHITECTURE_CONTRACT.md`
*   `00_SHARED/DOMAIN_STATES.md` (Order and Payment state machines)
*   `00_SHARED/EVENT_CONTRACT.md` (RabbitMQ event payloads)
*   `00_SHARED/API_CONTRACT.md` (API Standards)

Good luck! The post-sale reliability of the platform rests on your asynchronous event processing design.
