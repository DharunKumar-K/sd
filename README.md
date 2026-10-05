# GlowRush — High-Scale Skincare E-Commerce Flash Sale Platform

> **SALESTORM | SYSCRAFTERS 2026** — System Design Hackathon Submission

---

## Business Scenario

A skincare e-commerce platform conducts **flash sales** where a single product has **exactly 100 units** available and **10,000 customers** simultaneously click **"Buy Now"**.

The system must **guarantee**:

- Maximum successful sales = **100**
- Inventory can **NEVER** become negative
- Duplicate Buy requests do **NOT** create duplicate reservations
- Duplicate payment requests do **NOT** create duplicate payments
- Expired/unpaid reservations are **released**
- Successful payment eventually produces a **valid order**

---

## Technology Stack

| Layer              | Technology                     |
| ------------------ | ------------------------------ |
| Frontend           | React + Vite + Tailwind CSS    |
| Backend            | Node.js + Express.js           |
| Primary Database   | MongoDB                     |
| Cache              | Redis                          |
| Message Broker     | RabbitMQ                       |
| API Documentation  | OpenAPI / Swagger              |
| Diagrams           | Mermaid                        |
| Load Testing       | Locust                         |
| Containerization   | Docker                         |
| Authentication     | JWT                            |
| Deployment         | AWS-style cloud architecture   |

---

## Folder Structure

```
GlowRush/
│
├── 00_SHARED/                          ← Cross-team contracts (START HERE)
│   ├── ARCHITECTURE_CONTRACT.md
│   ├── SERVICE_CATALOG.md
│   ├── DOMAIN_STATES.md
│   ├── API_CONTRACT.md
│   ├── EVENT_CONTRACT.md
│   └── NAMING_RULES.md
│
├── 01_Requirements/                    ← Functional & non-functional requirements
│
├── 02_HLD/                             ← System Context, HLD, Container, Deployment
│
├── 03_LLD/                             ← Low-Level Designs (Students 2 & 3)
│
├── 04_Database/                        ← Schema design (Student 3)
│
├── 05_API/                             ← API contracts & OpenAPI specs (Student 3)
│
├── 06_SOLID/                           ← SOLID principle application
│
├── 07_Design_Patterns/                 ← Design patterns used
│
├── 08_Scalability_Reliability/         ← Scalability, StormShield, Concurrency
│
├── 09_Security_Observability/          ← Security & Observability architecture
│
├── 10_ADR/                             ← Architecture Decision Records
│
├── 11_AI_Assisted_Validation/          ← AI-assisted testing & validation
│
├── 12_Presentation/                    ← Final presentation materials
│
└── README.md                           ← This file
```

---

## Team Responsibilities

| Student   | Role              | Scope                                                         |
| --------- | ----------------- | ------------------------------------------------------------- |
| Student 1 | System Architect  | Requirements, HLD, Deployment, Scalability, Security, ADRs    |
| Student 2 | LLD — Inventory   | Inventory & Reservation Service detailed design               |
| Student 3 | LLD — Payment/Order | Payment, Order, Database schema, API contracts               |

---

## Reading Order

1. **`00_SHARED/ARCHITECTURE_CONTRACT.md`** — Read this first
2. **`00_SHARED/SERVICE_CATALOG.md`** — Understand every service
3. **`00_SHARED/DOMAIN_STATES.md`** — Canonical state machines
4. **`00_SHARED/NAMING_RULES.md`** — Naming conventions
5. **`01_Requirements/`** — What the system must do
6. **`02_HLD/`** — How the system is structured
7. **`08_Scalability_Reliability/`** — How it scales under flash-sale load
8. **`10_ADR/`** — Why we made the decisions we did
