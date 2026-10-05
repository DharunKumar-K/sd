# GlowRush — SOLID Principles Mapping

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL
> **Scope:** Payment Service, Order Service, Checkout Service, Fulfilment Service

---

## Overview

SOLID principles are applied to real classes in GlowRush's payment and order domain. Each principle is mapped to a concrete problem it solves, the class that demonstrates it, and the trade-off involved.

---

## S — Single Responsibility Principle

**Definition:** A class should have only one reason to change.

### Problem

Without SRP, a `PaymentService` class could:
- Process gateway charges
- Send email confirmations
- Update inventory
- Create orders

Any change to email templates would require modifying the payment processing class — dangerous during a flash sale.

### Application

| Class | Single Responsibility |
|-------|----------------------|
| `PaymentGatewayClient` | Communicate with external gateway only |
| `PaymentRepository` | Database CRUD for payment records only |
| `PaymentEventPublisher` | Publish payment events to RabbitMQ only |
| `WebhookSignatureVerifier` | Verify HMAC-SHA256 signatures only |
| `IdempotencyStore` | Check/record processed events only |
| `OrderStateMachine` | Enforce valid order state transitions only |
| `OrderRepository` | Database CRUD for order records only |

```javascript
// BAD — multiple responsibilities
class PaymentService {
  async charge(params) { /* gateway call */ }
  async sendEmail(customer) { /* email */ }         // ← wrong responsibility
  async updateInventory(productId) { /* DB */ }     // ← wrong responsibility
}

// GOOD — single responsibility
class PaymentService {
  constructor(gatewayClient, paymentRepo, eventPublisher, idempotencyStore) { ... }
  async initiatePayment(params) { ... }
  async handleWebhook(payload) { ... }
}
```

**Trade-off:** More classes to wire together — mitigated by dependency injection.

---

## O — Open/Closed Principle

**Definition:** Software entities should be open for extension, closed for modification.

### Problem

Adding a new payment provider (e.g., PayU) should NOT require modifying `PaymentService` core logic.

### Application

```javascript
// PaymentProvider interface (closed for modification)
class PaymentProvider {
  async initiatePayment(params) { throw new Error('Not implemented'); }
  async getPaymentStatus(ref) { throw new Error('Not implemented'); }
  async verifyWebhook(payload, sig) { throw new Error('Not implemented'); }
}

// Open for extension — new providers added without touching core
class RazorpayAdapter extends PaymentProvider { ... }
class StripeAdapter    extends PaymentProvider { ... }
class MockAdapter      extends PaymentProvider { ... }  // test
class PayUAdapter      extends PaymentProvider { ... }  // new provider — zero core changes
```

**Trade-off:** Requires discipline — every new provider must implement the full interface.

---

## L — Liskov Substitution Principle

**Definition:** Subtypes must be substitucollection for their base types without breaking correctness.

### Problem

If `MockPaymentAdapter` is used in tests but behaves differently from `RazorpayAdapter` (e.g., throws different exception types), tests won't reflect production behavior.

### Application

All `PaymentProvider` adapters:
- Return the same `PaymentResult` shape on success
- Throw the same `PaymentGatewayError` on failure
- Are fully substitucollection in the `PaymentService` constructor

```javascript
// PaymentService works with ANY PaymentProvider subtype
class PaymentService {
  constructor(provider) {
    if (!(provider instanceof PaymentProvider)) throw new Error('Invalid provider');
    this.provider = provider;
  }
  async charge(params) {
    return this.provider.initiatePayment(params);
    // Works identically with Razorpay, Stripe, or Mock
  }
}
```

**Trade-off:** All adapters must handle the full contract — cannot partially implement the interface.

---

## I — Interface Segregation Principle

**Definition:** No client should be forced to depend on methods it does not use.

### Problem

If `DeliveryProvider` had both `createShipment()` and `processPayment()` methods, shipping services would depend on payment methods they never use.

### Application

Separate, focused interfaces:

```javascript
// Payment domain
class PaymentProvider {
  initiatePayment(params) { }
  getPaymentStatus(ref) { }
  verifyWebhook(payload, sig) { }
}

// Delivery domain — completely separate
class DeliveryProvider {
  createShipment(params) { }
  getTrackingStatus(trackingId) { }
  cancelShipment(shipmentId) { }
}

// Notification — separate
class NotificationProvider {
  sendEmail(params) { }
  sendSms(params) { }
  sendPush(params) { }
}
```

Each service only depends on the interface it needs. Adding a `getRefundStatus()` to `PaymentProvider` does NOT affect `DeliveryProvider`.

**Trade-off:** More interface files to maintain — accepcollection for clarity.

---

## D — Dependency Inversion Principle

**Definition:** High-level modules should not depend on low-level modules. Both should depend on abstractions.

### Problem

If `PaymentService` directly instantiates `RazorpayClient`, switching providers requires code changes throughout the service.

### Application

```javascript
// HIGH-LEVEL MODULE (PaymentService) depends on ABSTRACTION (PaymentProvider)
class PaymentService {
  constructor(
    provider,          // PaymentProvider (abstraction)
    paymentRepo,       // PaymentRepository (abstraction)
    eventPublisher,    // EventPublisher (abstraction)
    idempotencyStore,  // IdempotencyStore (abstraction)
  ) {
    this.provider = provider;
    this.repo     = paymentRepo;
    this.events   = eventPublisher;
    this.idempotency = idempotencyStore;
  }
}

// COMPOSITION ROOT — only here does concrete implementation appear
const paymentService = new PaymentService(
  PaymentProviderFactory.create(process.env.PAYMENT_PROVIDER),
  new mongodbPaymentRepository(db),
  new RabbitMQEventPublisher(channel),
  new mongodbIdempotencyStore(db),
);
```

**Trade-off:** Requires a dependency injection container or manual wiring at startup — worth it for testability.

---

## SOLID Summary Collection

| Principle | Class/Component | Problem Solved | Flash Sale Impact |
|-----------|----------------|---------------|-------------------|
| SRP | `PaymentGatewayClient`, `PaymentRepository`, `PaymentEventPublisher` | Prevents blast radius of changes | Safer deploys during sale |
| OCP | `PaymentProvider` interface + adapters | New providers without core changes | Zero-risk provider switch |
| LSP | All `PaymentProvider` subclasses | Tests reflect production behavior | Mock adapter reliable in CI |
| ISP | Separate `PaymentProvider`, `DeliveryProvider` | Services don't depend on unused methods | Cleaner service boundaries |
| DIP | `PaymentService` depends on interfaces | Easy testing, swappable components | Mock in load tests |
