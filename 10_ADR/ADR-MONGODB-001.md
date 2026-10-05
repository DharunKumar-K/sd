# ADR-MONGODB-001: MongoDB as transactional source of truth

**Context:** The system needs to store business-critical data (products, inventory, payments, orders) and handle high-concurrency updates during flash sales. Previously, MongoDB was considered, but we are switching to MongoDB.

**Alternatives Considered:**
1. MongoDB (MongoDB)
2. DynamoDB
3. Redis as primary store

**Decision:** We chose **MongoDB** as the durable transactional source of truth.

**Why MongoDB:**
- MongoDB handles unstructured or flexible schema structures natively, which is excellent for rapid e-commerce evolution.
- MongoDB Atlas provides robust horizontal scaling and replica sets, making it easier to scale read traffic.
- MongoDB supports multi-document ACID transactions when multiple documents must change atomically (e.g., reservation and related records).
- MongoDB's rich query language allows for atomic conditional updates without needing document-level locking deadlocks typical in MongoDB.

**Atomic Conditional Update (Inventory):**
Inventory remains the final stock authority. Redis is NOT the inventory authority. We will use an atomic conditional MongoDB update, conceptually:
```javascript
inventory.updateOne(
  {
    productId: productId,
    availableQuantity: { $gte: quantity }
  },
  {
    $inc: {
      availableQuantity: -quantity,
      reservedQuantity: quantity
    }
  }
)
```
- If a document is matched and modified: Reservation succeeds.
- If no matching document: OUT_OF_STOCK / RESERVATION_FAILED.

**Transaction Boundary:**
For reservation creation and related transactional writes (e.g., creating a Reservation document while decrementing Inventory), we use a MongoDB transaction. The transaction ensures that either all operations succeed or none do.

**Indexing Strategy:**
- Hot queries (e.g., product lookups, available inventory) will be covered by indexes.
- Unique indexes will be heavily utilized for idempotency (e.g., `reservations.idempotencyKey`, `payments.idempotencyKey`, `payments.transactionReference`) to ensure duplicate requests do not create duplicate business state.

**Limitations/Trade-offs:**
- Multi-document transactions in MongoDB have a performance overhead compared to single-document updates. We must keep transaction scopes small and fast.
- MongoDB transactions require a replica set deployment (cannot run standalone in production).

**Why Redis is not the inventory authority:**
- Redis is an in-memory data store. Reconciling a fast Redis counter with a durable database can lead to "split-brain" inconsistencies if a failure occurs mid-sync.
- The business requirement explicitly states inventory must NEVER be negative. MongoDB provides durable, atomic guarantees directly on the source of truth, avoiding race conditions inherent in async cache-to-DB syncs. Redis remains dedicated strictly to caching, rate limiting, and StormShield queue state.
