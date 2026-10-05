# GlowRush — Hackathon Jury Demo Guide

## Welcome to GlowRush (SALESTORM | SYSCRAFTERS 2026)

GlowRush delivers a **dual-narrative engineering presentation**:
1. **The Customer Story:** An Apple/Aesop-grade D2C luxury skincare store where users experience frictionless flash drops, virtual queues, and multi-step checkout.
2. **The Engineering Story:** A real-time operations control center demonstrating how our distributed architecture handles **10,000 concurrent buyers** competing for **100 units** of inventory without a single oversell or race condition.

---

## 5-Minute Jury Demonstration Script

### Step 1: Launch & Visual Quality Verification
1. Open `http://localhost:3000/` in Chrome or Edge.
2. Note the **warm alabaster/ivory palette**, champagne accents, custom typography (`Playfair Display` & `Plus Jakarta Sans`), and floating hero card for **GlowShield Vitamin C Serum (₹599 / ₹899)** with a live animated stock meter.
3. Observe the top navigation bar featuring the dual-experience toggle:
   `[ ⚡ Engineering Center ]`

### Step 2: Experience the Shopper Journey
1. Click **"BUY NOW — ENTER QUEUE"** on the floating hero card.
2. The **StormShield Waiting Room Modal** opens:
   - Displays position `#1,208` with `12,438 shoppers ahead`.
   - Simulates token admission in Redis with an estimated countdown.
3. Once admitted:
   - Displays **"YOU'RE IN!"** with a 5-minute reservation timer holding tentative stock.
4. Click **"CONTINUE TO CHECKOUT"**:
   - The multi-step checkout opens (Address › Delivery › Payment › Confirmed).
   - Select **UPI** or **Credit Card** and click **"Pay ₹599 Now"**.
5. Watch the payment processing animation transition to:
   - **✓ ORDER CONFIRMED (Order #GR-2026-00124)**
   - Displays the real-time order lifecycle timeline (Payment Confirmed › Order Created › Processing › Shipped).

### Step 3: Switch to the Engineering Control Center
1. Click the **"⚡ Engineering Center"** button in the navbar.
2. The UI smoothly transitions to the fintech-grade **Operations Control Center**.
3. Point out the hero KPIs:
   - **10,000 Concurrent Buyers**
   - **100 Flash-Sale Units**
   - **0 Oversold**
   - **0 Duplicate Payments**
   - **MongoDB (Connected - Atomic Update Authority)**
   - **Redis (Connected - Queue & Cache)**
   - **RabbitMQ (Connected - Async Decoupling)**

### Step 4: Inspect the Live Pipeline & Inventory Meters
1. Review the **End-to-End Request Pipeline**:
   `CUSTOMERS → STORMSHIELD → API GATEWAY → INVENTORY → CHECKOUT → PAYMENT → ORDER → FULFILMENT`
   Notice request particle animations pulsing through healthy services.
2. Observe the **3-way Segmented Inventory Meter**:
   - `Available: 100` (Emerald)
   - `Reserved: 0` (Amber)
   - `Sold: 0` (Charcoal)
   - Verified accounting equation: $\text{Available} + \text{Reserved} + \text{Sold} = 100$.

### Step 5: Execute Key Failure & Stress Scenarios
Click any scenario card to trigger live backend logic:

1. **Card 2: Last Item Race (Stock = 1)**
   - Elena & Aria request 1 unit simultaneously.
   - Shows Elena winning via MongoDB atomic update, while Aria is cleanly rejected with `OUT_OF_STOCK`.
2. **Card 3: Duplicate Buy (Idempotency)**
   - Request `BUY-REQ-1001` sent twice rapidly.
   - Shows stock decremented **only once**.
3. **Card 6: Order Service Down (10s)**
   - Pipeline flashes **RED** on Order Service.
   - Payments succeed and buffer inside RabbitMQ.
   - When Order Service recovers, orders flush and status updates to **Order Service Recovered ✓**.
4. **Card 1: Start Flash Sale (10,000 Users)**
   - Watch StormShield admit batches of 50.
   - Watch available inventory deplete to 0.
   - Invariant card confirms: **DESIGN VALIDATION PASSED — Zero Overselling**.

### Step 6: Architecture Lab
1. Click **"Architecture Lab"** in the top right.
2. Explore the role-based design artifacts:
   - **Student 1:** Perimeter HLD, StormShield token queues.
   - **Student 2:** MongoDB conditional atomic update state machine.
   - **Student 3:** RabbitMQ event bus, idempotency keys, and DLQ retries.
