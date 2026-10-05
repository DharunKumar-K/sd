# MongoDB Architecture & Transactional Source of Truth

## Architectural Decision Overview

In GlowRush, **MongoDB serves as the durable, transactional source of truth** for all business entities:
- `customers`
- `products`
- `inventory`
- `reservations`
- `orders` & `order_items`
- `payments`
- `shipments`

## The Critical Stock Reservation Primitive

Redis is strictly prohibited from serving as the authoritative stock decrementer. While Redis is ideal for high-throughput admission tokens and caching, network partitions or AOF/RDB sync delays can result in catastrophic overselling during high-concurrency flash sales.

MongoDB document-level ACID guarantees provide the exact consistency boundary needed:

```javascript
const result = await db.collection('inventory').updateOne(
  {
    productId: 'GLOW-VITC-100',
    availableQuantity: { $gte: quantity } // Atomic condition
  },
  {
    $inc: {
      availableQuantity: -quantity,
      reservedQuantity: quantity
    }
  }
);

if (result.matchedCount === 0 || result.modifiedCount === 0) {
  // Document condition was not met: stock is zero or insufficient
  return { success: false, reason: 'OUT_OF_STOCK' };
}

// Exactly one atomic reservation succeeded
return { success: true };
```

### Why This Prevents Race Conditions
1. **WiredTiger Document Locks:** When multiple concurrent requests attempt to reserve the same product document, WiredTiger applies an exclusive write intent lock on that single document.
2. **Deterministic Evaluation:** The condition `{ availableQuantity: { $gte: quantity } }` is evaluated against the most current committed document revision.
3. **No Phantom Overselling:** Once `availableQuantity` reaches 0, all concurrent updates immediately fail to match the condition and return `matchedCount === 0`.

---

## Collections & Indexing Strategy

| Collection | Key Fields | Indexes & Constraints |
| :--- | :--- | :--- |
| `inventory` | `productId`, `availableQuantity`, `reservedQuantity`, `soldQuantity` | `{ productId: 1 }` (Unique) |
| `reservations` | `reservationId`, `idempotencyKey`, `userId`, `status`, `expiresAt` | `{ reservationId: 1 }` (Unique)<br>`{ idempotencyKey: 1 }` (Unique)<br>`{ expiresAt: 1 }` (TTL Index) |
| `payments` | `paymentId`, `idempotencyKey`, `reservationId`, `status`, `amount` | `{ paymentId: 1 }` (Unique)<br>`{ idempotencyKey: 1 }` (Unique) |
| `orders` | `orderId`, `paymentId`, `reservationId`, `status` | `{ orderId: 1 }` (Unique)<br>`{ paymentId: 1 }` (Unique) |

---

## Multi-Document Transactions

Where multiple document updates must commit atomically (such as creating the order document and updating the reservation status to `SOLD`), GlowRush uses MongoDB Multi-Document Transactions with `readConcern: "majority"` and `writeConcern: { w: "majority" }`.
