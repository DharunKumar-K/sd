# GlowRush — Security Design

> **Owner:** Student 3
> **Version:** 1.0 | **Status:** FINAL
> **Scope:** API Security, Payment Security, Auth, Observability Security

---

## 1. Authentication — JWT (RS256)

### Token Structure

GlowRush uses **asymmetric JWT (RS256)**:
- **Private key** signs tokens — held ONLY by Auth Service
- **Public key** verifies tokens — distributed to all services

```json
{
  "header": { "alg": "RS256", "typ": "JWT" },
  "payload": {
    "sub": "customer-uuid",
    "role": "customer",
    "email": "priya@example.com",
    "iat": 1696500000,
    "exp": 1696503600,
    "jti": "unique-token-id"
  }
}
```

| Token | TTL | Storage | Refresh |
|-------|-----|---------|---------|
| `access_token` | 1 hour | Memory / httpOnly cookie | Via `refresh_token` |
| `refresh_token` | 7 days | httpOnly Secure cookie only | POST /api/v1/auth/refresh |

### Why RS256 over HS256?

| Criterion | HS256 | RS256 (chosen) |
|-----------|-------|----------------|
| Key sharing | Shared secret across all services | Public key only — private key never leaves Auth Service |
| Compromise risk | Any service compromise exposes signing key | Only Auth Service can forge tokens |
| Microservice-safe | No | Yes |

### API Gateway JWT Validation

```javascript
async function validateJWT(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ title: 'Missing token' });
  try {
    const payload = jwt.verify(token, PUBLIC_KEY, { algorithms: ['RS256'] });
    const isRevoked = await redis.get(`revoked:${payload.jti}`);
    if (isRevoked) return res.status(401).json({ title: 'Token revoked' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ title: 'Invalid or expired token' });
  }
}
```

### Token Revocation (logout / password change)

```javascript
await redis.setex(`revoked:${jti}`, tokenTTL, '1');
```

---

## 2. Authorization (Role-Based + Resource-Level)

| Role | Permissions |
|------|-------------|
| `CUSTOMER` | Own profile, cart, orders, payments, reservations |
| `ADMIN` | All + product CRUD, sale management, coupon management |

```javascript
// Ownership check — example Order Service
async function getOrder(req, res) {
  const order = await orderRepo.findById(req.params.orderId);
  if (!order) return res.status(404).json({ title: 'Not found' });
  if (order.customerId !== req.user.sub && req.user.role !== 'ADMIN') {
    return res.status(403).json({ title: 'Forbidden' });
  }
  return res.json(order);
}
```

### Admission Token Validation

```javascript
async function validateAdmissionToken(req, res, next) {
  const token = req.headers['x-admission-token'];
  if (!token) return res.status(403).json({ title: 'Admission token required' });
  const payload = jwt.verify(token, STORMSHIELD_PUBLIC_KEY);
  const consumed = await redis.get(`admission:consumed:${payload.jti}`);
  if (consumed) return res.status(403).json({ title: 'Admission token already used' });
  req.admissionPayload = payload;
  next();
}
```

---

## 3. HTTPS / TLS

| Layer | Standard |
|-------|---------|
| Client to CDN | TLS 1.3 (1.0/1.1 disabled) |
| CDN to ALB | TLS 1.3 |
| ALB to API Gateway | TLS 1.3 |
| Microservice internal | TLS 1.2+ (mTLS for payment flows) |
| Webhook | TLS 1.3 + HMAC signature |

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 4. API Input Validation

```javascript
const reservationValidation = [
  body('productId').isUUID(4),
  body('saleId').isUUID(4),
  body('quantity').isInt({ min: 1, max: 1 }),
  header('x-idempotency-key').isUUID(4),
];
```

| Input Type | Rule |
|-----------|------|
| UUIDs | Format validated before any DB query |
| Amounts | Server-calculated — never trust client price |
| Strings | Max length enforced; special chars sanitized |
| Email | RFC 5322 regex + lowercase normalization |
| Webhook payloads | HMAC-SHA256 verified before parsing |

---

## 5. Rate Limiting — Redis Integration

```javascript
const flashSaleRateLimit = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 1,
  keyGenerator: (req) => `rate:reservation:${req.user.sub}`,
  store: new RedisStore({ client: redisClient }),
});
```

| Endpoint | Limit | Window |
|----------|-------|--------|
| POST /auth/login | 5 | 1 minute per IP |
| POST /auth/register | 3 | 1 minute per IP |
| POST /reservations | 1 | 5 minutes per customer |
| POST /checkout | 3 | 1 minute per customer |
| POST /payments | 5 | 1 minute per customer |
| Global authenticated | 100 | 1 minute per customer |
| Global anonymous | 30 | 1 minute per IP |

---

## 6. WAF Rules

| Rule | Protection |
|------|-----------|
| OWASP Core Rule Set | MongoDB injection, XSS, CSRF, path traversal |
| IP reputation | Block known malicious IPs |
| Bot detection | Challenge suspicious user agents |
| Request size | Max body: 64KB |
| HTTP method whitelist | GET, POST, PUT, DELETE, OPTIONS only |
| Geo-blocking | Configurable per region |

---

## 7. Payment Data Security — PCI-DSS Scope Minimization

> [!CAUTION]
> Raw card details (PAN, CVV, expiry) are NEVER stored in GlowRush's database.
> All card capture happens on the payment gateway's hosted page.

| Data | Storage | Protection |
|------|---------|-----------|
| Card number (PAN) | Never stored | Tokenized by Razorpay/Stripe vault |
| CVV | Never stored | One-time use on gateway only |
| Card expiry | Never stored | Gateway-side only |
| `transaction_reference` | payments collection | Gateway reference — safe |
| `gateway_response` JSONB | payments collection | Sanitized — no card data |
| `idempotency_key` | payments collection | UUID only |

### Webhook Signature Verification

```javascript
function verifyWebhookSignature(req, res, next) {
  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');
  if (signature !== expected) return res.status(400).json({ title: 'Invalid signature' });
  next();
}
```

---

## 8. Audit Logging

```json
{
  "timestamp": "2026-10-05T10:00:00.000Z",
  "correlationId": "corr-001",
  "service": "payment-service",
  "action": "PAYMENT_CREATED",
  "actorId": "customer-uuid",
  "actorRole": "CUSTOMER",
  "resourceType": "PAYMENT",
  "resourceId": "pay-uuid",
  "outcome": "SUCCESS",
  "metadata": { "amount": 2999, "currency": "INR", "provider": "razorpay" }
}
```

- Immucollection append-only log stream
- Retained minimum 2 years (financial compliance)
- Never log passwords, card numbers, JWT tokens

---

## 9. Secrets Management

| Secret | Storage | Access |
|--------|---------|--------|
| MongoDB credentials | AWS Secrets Manager | Injected at container start |
| Redis credentials | AWS Secrets Manager | Injected at container start |
| RabbitMQ credentials | AWS Secrets Manager | Injected at container start |
| JWT RS256 private key | AWS KMS | Auth Service only |
| JWT RS256 public key | Environment variable | All services (read-only) |
| Razorpay API key | AWS Secrets Manager | Payment Service only |
| Razorpay webhook secret | AWS Secrets Manager | Payment Service only |

Rotation: every 90 days, zero-downtime via dual-key support.

---

## 10. Security Headers

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: same-origin
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

---

## 11. Observability

### Key Metrics

| Metric | Alert Threshold |
|--------|----------------|
| `http_request_rate` | Baseline +300% |
| `http_latency_p99` | > 2s warning; > 5s critical |
| `http_error_rate_5xx` | > 1% warning; > 5% critical |
| `payment_failure_rate` | > 10% |
| `duplicate_payment_requests` | > 0 (audit) |
| `dlq_message_count` | > 0 CRITICAL |
| `rabbitmq_queue_depth` | > 1000 |
| `order_conversion_rate` | < 70% investigate |
| `payment_gateway_latency_p99` | > 5s |
| `order_service_recovery_time` | > 60s SLA breach |
| `circuit_breaker_state` | OPEN = immediate page |
| `reservation_failure_rate` | > 80% (expected near sale end) |
| `reservation_expiry_rate` | Track for UX optimization |

### Distributed Tracing

Every request gets `X-Correlation-ID` (UUID v4) at API Gateway.
Propagated through:
- HTTP headers on synchronous calls
- `correlationId` field in RabbitMQ event envelope
- Structured log field in every service

```json
{
  "timestamp": "2026-10-05T10:00:00.123Z",
  "level": "info",
  "service": "order-service",
  "correlationId": "corr-001",
  "eventId": "evt-001",
  "action": "order_created",
  "orderId": "ord-001",
  "duration_ms": 45
}
```

### Alert Tiers

| Tier | Criteria | Response |
|------|----------|----------|
| P1 Critical | DLQ > 0, Circuit Breaker OPEN, DB unavailable | Page immediately |
| P2 High | Error rate > 5%, Payment failures > 10% | Alert within 5 min |
| P3 Medium | Latency p99 > 2s, Queue depth > 1000 | Alert within 30 min |
| P4 Low | Reservation expiry spike | Daily digest |
