# GlowRush — Design Patterns

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL
> **Scope:** Payment Service, Order Service, Checkout Service, Fulfilment Service

Each pattern addresses a real design problem in GlowRush. Patterns are not used for count — each solves a specific, named problem.

---

## 1. Strategy Pattern — Payment Provider Selection

### Real Problem

GlowRush must support multiple payment gateways (Razorpay, Stripe, Mock for testing). The core payment logic should not change when switching providers. During the flash sale, a gateway might go down and we need to switch providers without code changes.

### Classes

```javascript
// Strategy interface
class PaymentProvider {
  async initiatePayment(params) { throw new Error('abstract'); }
  async getPaymentStatus(gatewayRef) { throw new Error('abstract'); }
  async verifyWebhookSignature(payload, signature) { throw new Error('abstract'); }
  async processRefund(gatewayRef, amount) { throw new Error('abstract'); }
}

// Concrete Strategies
class RazorpayPaymentAdapter extends PaymentProvider {
  async initiatePayment({ amount, currency, idempotencyKey }) {
    return this.client.orders.create({ amount: amount * 100, currency, receipt: idempotencyKey });
  }
  async verifyWebhookSignature(payload, sig) {
    const expected = crypto.createHmac('sha256', this.webhookSecret).update(payload).digest('hex');
    return sig === expected;
  }
}

class StripePaymentAdapter extends PaymentProvider {
  async initiatePayment({ amount, currency, idempotencyKey }) {
    return this.stripe.paymentIntents.create({ amount, currency }, { idempotencyKey });
  }
}

class MockPaymentAdapter extends PaymentProvider {
  async initiatePayment(params) {
    return { sessionId: 'mock_session', status: 'created' };
  }
  async verifyWebhookSignature() { return true; }  // always valid in tests
}

// Context — uses the strategy
class PaymentService {
  constructor(provider /* PaymentProvider */) { this.provider = provider; }
  async charge(params) { return this.provider.initiatePayment(params); }
}
```

### Solution

`PaymentService` is configured at startup with the correct `PaymentProvider`. Switching from Razorpay to Stripe is a single environment variable change.

### Trade-off

All strategies must implement the full interface. Partial implementations cause runtime errors. Mitigated by base class throwing `Error('abstract')`.

---

## 2. Factory Pattern — Payment Provider Factory

### Real Problem

`PaymentService` needs a `PaymentProvider` but should not know which concrete class to instantiate. The provider is determined by configuration/environment.

### Classes

```javascript
class PaymentProviderFactory {
  static REGISTRY = {
    razorpay: RazorpayPaymentAdapter,
    stripe:   StripePaymentAdapter,
    mock:     MockPaymentAdapter,
  };

  static create(providerName) {
    const AdapterClass = this.REGISTRY[providerName];
    if (!AdapterClass) {
      throw new UnsupportedPaymentProviderError(`Unknown provider: ${providerName}`);
    }
    return new AdapterClass(this.getConfig(providerName));
  }

  static getConfig(providerName) {
    return {
      razorpay: { apiKey: process.env.RAZORPAY_KEY, webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET },
      stripe:   { apiKey: process.env.STRIPE_KEY, webhookSecret: process.env.STRIPE_WEBHOOK_SECRET },
      mock:     {},
    }[providerName];
  }

  static register(name, AdapterClass) {
    this.REGISTRY[name] = AdapterClass;  // extensible registry
  }
}

// Usage
const provider = PaymentProviderFactory.create(process.env.PAYMENT_PROVIDER);
const paymentService = new PaymentService(provider, ...);
```

### Solution

Adding PayU gateway = create `PayUAdapter extends PaymentProvider` + `PaymentProviderFactory.register('payu', PayUAdapter)`. Zero changes to `PaymentService`.

### Trade-off

Factory must be kept in sync with available adapters. Registry pattern (as above) reduces this risk.

---

## 3. State Pattern — Order Lifecycle Management

### Real Problem

Order status transitions must be controlled: you cannot ship a cancelled order, or deliver before shipping. Without a state machine, invalid transitions could corrupt order data during high-concurrency flash sale processing.

### Classes

```javascript
// State machine
class OrderStateMachine {
  static TRANSITIONS = {
    CREATED:           ['PAYMENT_PENDING', 'CANCELLED'],
    PAYMENT_PENDING:   ['CONFIRMED', 'CANCELLED'],
    CONFIRMED:         ['PROCESSING', 'CANCELLED'],
    PROCESSING:        ['SHIPPED'],
    SHIPPED:           ['OUT_FOR_DELIVERY'],
    OUT_FOR_DELIVERY:  ['DELIVERED'],
    DELIVERED:         [],
    CANCELLED:         [],
  };

  static canTransition(from, to) {
    return (this.TRANSITIONS[from] || []).includes(to);
  }

  static assertTransition(from, to) {
    if (!this.canTransition(from, to)) {
      throw new InvalidOrderTransitionError(`${from} → ${to} is not a valid order transition`);
    }
  }
}

// Order entity using the state machine
class Order {
  transitionTo(newStatus) {
    OrderStateMachine.assertTransition(this.status, newStatus);
    this.status = newStatus;
    this.updatedAt = new Date();
    return this;
  }

  isTerminal() {
    return OrderStateMachine.TRANSITIONS[this.status].length === 0;
  }
}

// Service usage
async function confirmOrder(orderId) {
  const order = await orderRepo.findById(orderId);
  order.transitionTo('CONFIRMED');  // throws if invalid
  await orderRepo.save(order);
}
```

### Solution

Every status change goes through `OrderStateMachine.assertTransition()`. Invalid transitions are caught before reaching the database.

### Trade-off

State machine must be updated when new states are added. This is by design — it forces explicit documentation of new transitions.

---

## 4. Observer Pattern — Event-Driven Service Communication

### Real Problem

When payment succeeds, multiple services need to react: Order Service creates an order, Inventory Service confirms the reservation, Notification Service emails the customer. Tight coupling (Payment Service calling all three) creates a brittle dependency chain.

### Classes

```javascript
// Publisher (Observable)
class PaymentEventPublisher {
  constructor(rabbitMQChannel, exchange) {
    this.channel = rabbitMQChannel;
    this.exchange = exchange;
  }

  async publish(routingKey, event) {
    const message = Buffer.from(JSON.stringify(event));
    await this.channel.publish(
      this.exchange,
      routingKey,
      message,
      { persistent: true, contentType: 'application/json' }
    );
  }

  async publishPaymentConfirmed(payment) {
    await this.publish('payment.confirmed', {
      eventId:       uuidv4(),
      eventType:     'PaymentConfirmed',
      source:        'payment-service',
      timestamp:     new Date().toISOString(),
      correlationId: payment.correlationId,
      version:       '1.0',
      data: {
        paymentId:      payment.paymentId,
        reservationId:  payment.reservationId,
        customerId:     payment.customerId,
        amount:         payment.amount,
        currency:       payment.currency,
        gatewayRef:     payment.transactionReference,
        idempotencyKey: payment.idempotencyKey,
      },
    });
  }
}

// Observers (Consumers)
class OrderEventConsumer {  // Observer 1
  async onPaymentConfirmed(event) { await orderService.createFromPaymentConfirmed(event); }
}

class InventoryEventConsumer {  // Observer 2
  async onPaymentConfirmed(event) { await inventoryService.confirmReservation(event.data.reservationId); }
}

class NotificationEventConsumer {  // Observer 3
  async onPaymentConfirmed(event) { await notificationService.sendOrderConfirmation(event.data.customerId); }
}
```

### Solution

Payment Service publishes one event. RabbitMQ fans it out to three independent queues. Each consumer processes independently and at its own pace. Payment Service has zero knowledge of Order, Inventory, or Notification Services.

### Trade-off

Eventual consistency — Order is created milliseconds after payment, not synchronously. Accepcollection for GlowRush (user sees "Order confirmed" notification shortly after payment).

---

## 5. Adapter Pattern — External Provider Integration

### Real Problem

Razorpay's API uses different parameter names and response shapes than Stripe. Without adapters, the entire payment flow would change when switching gateways.

### Classes

```javascript
// Common internal interface
class PaymentProvider {
  async initiatePayment({ amount, currency, idempotencyKey, metadata }) { }
  // Returns: { gatewaySessionId, redirectUrl, status }
}

// Razorpay has: orders.create({ amount_in_paise, currency, receipt })
class RazorpayPaymentAdapter extends PaymentProvider {
  async initiatePayment({ amount, currency, idempotencyKey }) {
    const order = await this.razorpay.orders.create({
      amount:   amount * 100,    // Razorpay uses paise
      currency: currency,
      receipt:  idempotencyKey,
    });
    return {
      gatewaySessionId: order.id,
      redirectUrl:      `https://checkout.razorpay.com/v1/checkout.js#${order.id}`,
      status:           'created',
    };
  }
}

// Stripe has: paymentIntents.create({ amount_in_cents, currency })
class StripePaymentAdapter extends PaymentProvider {
  async initiatePayment({ amount, currency, idempotencyKey }) {
    const intent = await this.stripe.paymentIntents.create(
      { amount: amount * 100, currency: currency.toLowerCase() },
      { idempotencyKey }
    );
    return {
      gatewaySessionId: intent.id,
      redirectUrl:      intent.next_action?.redirect_to_url?.url,
      status:           'created',
    };
  }
}
```

### Solution

`PaymentService` always calls `provider.initiatePayment({ amount, currency, idempotencyKey })`. The Adapter translates this to the gateway-specific format. Core business logic never changes.

### Trade-off

Adapter must keep pace with gateway API changes. Mitigated by gateway-specific test suites.

---

## 6. Repository Pattern — Database Abstraction

### Real Problem

Business logic (PaymentService, OrderService) should not contain raw MongoDB. If the database schema changes, all business logic would need updating. Testability requires database to be mockable.

### Classes

```javascript
// Repository interface
class PaymentRepository {
  async create(paymentData, client) { throw new Error('abstract'); }
  async findById(paymentId) { throw new Error('abstract'); }
  async findByIdempotencyKey(key) { throw new Error('abstract'); }
  async updateStatus(paymentId, status, extras, client) { throw new Error('abstract'); }
}

// MongoDB implementation
class mongodbPaymentRepository extends PaymentRepository {
  constructor(db) { super(); this.db = db; }

  async create(paymentData, client = this.db) {
    const result = await (client).query(
      `INSERT INTO payments (payment_id, idempotency_key, reservation_id, amount, currency, status, provider)
       VALUES ($1, $2, $3, $4, $5, 'INITIATED', $6)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [paymentData.paymentId, paymentData.idempotencyKey, ...]
    );
    return result.rows[0] || null;
  }

  async findByIdempotencyKey(key) {
    const result = await this.db.query(
      'SELECT * FROM payments WHERE idempotency_key = $1',
      [key]
    );
    return result.rows[0] || null;
  }
}

// Mock implementation for tests
class InMemoryPaymentRepository extends PaymentRepository {
  constructor() { super(); this.store = new Map(); }
  async create(data) { this.store.set(data.paymentId, data); return data; }
  async findById(id) { return this.store.get(id) || null; }
}
```

### Solution

`PaymentService` depends on `PaymentRepository` (abstraction). Tests inject `InMemoryPaymentRepository`. Production injects `mongodbPaymentRepository`. Zero MongoDB in service layer.

### Trade-off

Repository adds an abstraction layer. For complex queries, the repository may become large. Mitigated by keeping repositories focused on their own entity only.

---

## 7. Facade Pattern — Checkout Orchestration

### Real Problem

The checkout flow involves multiple services: validate reservation (Inventory Service), calculate pricing (Sale Service), apply coupon, initiate payment (Payment Service). The React frontend should not orchestrate all these calls.

### Classes

```javascript
// Facade — Checkout Service
class CheckoutFacade {
  constructor(inventoryClient, paymentService, couponService, sessionStore) {
    this.inventory   = inventoryClient;
    this.payment     = paymentService;
    this.coupons     = couponService;
    this.sessions    = sessionStore;
  }

  async initiateCheckout({ reservationId, customerId, shippingAddress, couponCode, provider }) {
    // Step 1: Validate reservation
    const reservation = await this.inventory.getReservation(reservationId);
    this.assertReservationValid(reservation, customerId);

    // Step 2: Calculate amount
    const amount = await this.calculateAmount(reservation, couponCode);

    // Step 3: Transition reservation to PAYMENT_PENDING
    await this.inventory.transitionReservation(reservationId, 'PAYMENT_PENDING');

    // Step 4: Initiate payment (synchronous — Checkout waits for redirect URL)
    const payment = await this.payment.initiatePayment({
      reservationId,
      customerId,
      amount,
      provider,
      idempotencyKey: this.sessions.getCheckoutIdempotencyKey(reservationId),
    });

    // Step 5: Store session
    await this.sessions.saveCheckoutSession({ reservationId, paymentId: payment.paymentId });

    return { paymentId: payment.paymentId, redirectUrl: payment.redirectUrl, amount };
  }

  assertReservationValid(reservation, customerId) {
    if (reservation.status !== 'RESERVED') throw new InvalidReservationStateError();
    if (reservation.expiresAt < new Date()) throw new ReservationExpiredError();
    if (reservation.customerId !== customerId) throw new ForbiddenError();
  }
}
```

### Solution

Frontend calls one endpoint (`POST /api/v1/checkout`). The `CheckoutFacade` orchestrates all sub-steps internally. Frontend never knows how many services are involved.

### Trade-off

Facade becomes a coordination point. If it grows too large, extract sub-orchestrators. For GlowRush's checkout flow, the current complexity is justified.

---

## 8. Circuit Breaker Pattern — Payment Gateway Protection

### Real Problem

During a flash sale, if the payment gateway is slow or unavailable, 10,000 concurrent requests will all wait for timeouts (30s × 10,000 = system overload). A circuit breaker short-circuits failed calls immediately.

### Classes

```javascript
class CircuitBreaker {
  constructor(fn, config) {
    this.fn = fn;
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.config = {
      failureThreshold:          config.failureThreshold || 5,
      resetTimeout:              config.resetTimeout || 30000,
      halfOpenSuccessThreshold:  config.halfOpenSuccessThreshold || 1,
    };
  }

  async execute(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new CircuitBreakerOpenError('Gateway temporarily unavailable — retry in 30s');
      }
    }

    try {
      const result = await this.fn(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
      metrics.increment('circuit_breaker_open', { service: 'payment-gateway' });
      logger.error('Circuit breaker OPEN — payment gateway failures exceeded threshold');
    }
  }
}

// Usage in Payment Service
const gatewayCircuitBreaker = new CircuitBreaker(
  (params) => razorpayAdapter.initiatePayment(params),
  { failureThreshold: 5, resetTimeout: 30000 }
);

async function initiatePayment(params) {
  try {
    return await gatewayCircuitBreaker.execute(params);
  } catch (err) {
    if (err instanceof CircuitBreakerOpenError) {
      return res.status(503).json({ title: 'Payment gateway temporarily unavailable' });
    }
    throw err;
  }
}
```

### Solution

After 5 consecutive gateway failures, the circuit breaker opens. All subsequent payment calls return 503 immediately — no wasted connections, no cascading timeouts. After 30 seconds, a probe request tests if the gateway recovered.

### Trade-off

During the OPEN state, legitimate payments are rejected. This is the correct trade-off: better to reject payments cleanly than to overload the gateway with timeout-inducing requests. Customers can retry after 30 seconds.

---

## Pattern Summary

| Pattern | Location | Problem Solved | Flash Sale Benefit |
|---------|----------|---------------|-------------------|
| Strategy | `PaymentService` + adapters | Multi-provider support | Switch gateway without code change |
| Factory | `PaymentProviderFactory` | Provider instantiation | Add providers without modifying core |
| State | `OrderStateMachine` | Order lifecycle control | Prevents invalid order states |
| Observer | `PaymentEventPublisher` + consumers | Decoupled service communication | Order Service failure doesn't block payment |
| Adapter | `RazorpayAdapter`, `StripeAdapter` | Gateway API translation | Uniform interface for all gateways |
| Repository | `PaymentRepository`, `OrderRepository` | DB abstraction | Tescollection without real DB |
| Facade | `CheckoutFacade` | Multi-step orchestration | Single endpoint hides complexity |
| Circuit Breaker | `CircuitBreaker` on gateway calls | Failure isolation | Prevents gateway overload during sale |
