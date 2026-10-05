# GlowRush — System Context Diagram

> **Version:** 1.0 | **Owner:** Student 1 (System Architect)

---

## 1. Overview

The System Context diagram shows GlowRush as a single system box surrounded by its external actors and third-party systems. This is the highest level of abstraction — the C4 Level 0 view.

---

## 2. System Context Diagram

```mermaid
C4Context
    title GlowRush — System Context (C4 Level 0)

    Person(customer, "Customer", "Skincare buyer participating in flash sales")
    Person(admin, "Admin", "Platform administrator managing products and sales")

    System(glowrush, "GlowRush Platform", "High-scale skincare e-commerce flash sale system")

    System_Ext(payment_gw, "Payment Gateway", "External payment processor (Razorpay/Stripe)")
    System_Ext(shipping, "Shipping Provider", "Carrier API (BlueDart, Delhivery)")
    System_Ext(notification, "Notification Provider", "Email (SES), SMS (SNS), Push (FCM)")
    System_Ext(cdn, "CDN / WAF", "CloudFront + AWS WAF for static assets and DDoS protection")
    System_Ext(monitoring, "Monitoring Stack", "Prometheus + Grafana + Loki + Jaeger")

    Rel(customer, cdn, "Browses products, participates in flash sales", "HTTPS")
    Rel(cdn, glowrush, "Proxied dynamic requests", "HTTPS")
    Rel(admin, glowrush, "Manages products, creates flash sales", "HTTPS")
    Rel(glowrush, payment_gw, "Processes payments", "HTTPS REST")
    Rel(glowrush, shipping, "Creates shipments, gets tracking", "HTTPS REST")
    Rel(glowrush, notification, "Sends email, SMS, push", "HTTPS REST")
    Rel(monitoring, glowrush, "Scrapes metrics, collects logs/traces", "HTTP/gRPC")
```

---

## 3. External Actors

| Actor                | Type     | Interaction                                                |
| -------------------- | -------- | ---------------------------------------------------------- |
| **Customer**         | Person   | Browses products, joins flash sale queue, purchases items  |
| **Admin**            | Person   | Manages product catalog, creates flash sales, views analytics |
| **Payment Gateway**  | System   | Processes card/UPI payments, sends webhook confirmations   |
| **Shipping Provider**| System   | Generates shipping labels, provides tracking updates       |
| **Notification Provider** | System | Delivers email (SES), SMS (SNS), push (FCM)          |
| **CDN / WAF**        | System   | Caches static assets, blocks malicious traffic             |
| **Monitoring Stack** | System   | Collects metrics, logs, traces for observability           |

---

## 4. System Boundary

Everything inside the "GlowRush Platform" box:

- API Gateway
- StormShield (virtual waiting room)
- Product Service, Cart Service, Sale Service
- Inventory & Reservation Service
- Checkout Service, Payment Service, Order Service
- Fulfilment Service, Shipment Service, Notification Service
- PostgreSQL database cluster
- Redis cluster
- RabbitMQ cluster

---

## 5. Data Flow Summary

```mermaid
graph TD
    C[Customer] -->|HTTPS| CDN[CDN / WAF]
    A[Admin] -->|HTTPS| CDN
    CDN -->|Static assets| S3[S3 / Static Host]
    CDN -->|Dynamic API| ALB[Load Balancer]
    ALB -->|Routed| GR[GlowRush Platform]
    
    GR -->|Payment API| PG[Payment Gateway]
    GR -->|Shipping API| SP[Shipping Provider]
    GR -->|Email/SMS/Push| NP[Notification Provider]
    
    PG -->|Webhook| GR
    SP -->|Webhook| GR
    
    MON[Monitoring] -->|Scrape/Collect| GR
```

---

## 6. Trust Boundaries

| Boundary               | Inside                                          | Outside                          |
| ---------------------- | ----------------------------------------------- | -------------------------------- |
| Internet ↔ CDN/WAF     | CDN, WAF rules                                  | Customer browsers, bots          |
| CDN/WAF ↔ Load Balancer| Load Balancer, API Gateway                      | Public internet                  |
| API Gateway ↔ Services | All microservices, databases                    | Unauthenticated traffic          |
| Platform ↔ Payment GW  | Payment Service                                 | External payment processor       |
| Platform ↔ Shipping    | Shipment Service                                | External carrier                 |
| Platform ↔ Notification| Notification Service                            | External email/SMS/push provider |
