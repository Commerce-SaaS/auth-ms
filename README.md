# 🔐 Auth Microservice (`auth-ms`)

> NestJS authentication microservice responsible for user authentication, sessions, profiles, JWT management, OAuth login and account lifecycle events in a multi-tenant commerce platform.

---

# 📌 Purpose

`auth-ms` is a **message-driven authentication microservice** that manages authentication flows for two different user domains:

- 🏢 SaaS platform users (`SaasUser`)
- 👤 Organization customers (`Customer`)

The service communicates exclusively through **RabbitMQ message patterns** and does not expose an HTTP API.

---

# ✨ Main Responsibilities

## Authentication

- User registration
- Login with email/password
- Google OAuth authentication
- JWT access token generation
- JWT refresh token rotation
- Password reset flow
- Email verification flow
- Email change confirmation

## Session Management

- Redis-backed sessions
- Logout current session
- Logout all sessions
- List active sessions
- Revoke sessions

## User Management

### SaaS users

- Profile management
- Account activation/deactivation
- Profile restoration

### Customers

- Organization-based profiles
- Customer administration
- Soft delete / restore
- Customer anonymization events

---

# 🏗️ Architecture

```
                         RabbitMQ
                            │
                            │
        ┌───────────────────┴───────────────────┐
        │                                       │
        ▼                                       ▼

 Other Microservices                    Client Applications
        │
        │ RPC Messages
        ▼

 ┌──────────────────────────────────────────┐
 │                auth-ms                   │
 │                                          │
 │  NestJS Microservice                     │
 │                                          │
 │  ┌──────────┐  ┌──────────┐              │
 │  │  JWT     │  │ Redis    │              │
 │  │ Tokens   │  │ Sessions │              │
 │  └──────────┘  └──────────┘              │
 │                                          │
 │  ┌──────────┐  ┌──────────┐              │
 │  │Postgres │  │ Google   │              │
 │  │Database │  │ OAuth    │              │
 │  └──────────┘  └──────────┘              │
 │                                          │
 └──────────────────────────────────────────┘
```

---

# 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| NestJS 11 | Microservice framework |
| TypeScript | Programming language |
| RabbitMQ | Message transport |
| `@nestjs/microservices` | RMQ integration |
| PostgreSQL | Persistent storage |
| TypeORM 0.3 | ORM |
| Redis | Session/token storage |
| ioredis | Redis client |
| JWT | Authentication tokens |
| bcrypt | Password hashing |
| Google OAuth | Social authentication |
| class-validator | DTO validation |
| class-transformer | DTO transformation |
| Zod | Environment validation |
| Jest + ts-jest | Testing |

---

# 📦 Installation

```bash
npm install
```

Create environment file:

```bash
cp .env.example .env
```

Fill required values before starting the service.

---

# ▶️ Running Locally

## Development

```bash
npm run start:dev
```

## Debug

```bash
npm run start:debug
```

## Production

```bash
npm run build

npm run start:prod
```

---

# ⚠️ Important: No HTTP API

`auth-ms` is a pure RabbitMQ microservice.

The application starts with:

```ts
NestFactory.createMicroservice()
```

There are:

- ❌ No REST controllers
- ❌ No HTTP endpoints
- ❌ No HTTP listener

The `PORT` environment variable is only used in startup logs.

---

# 🐳 Docker

Docker configuration:

```
auth-ms

├── Docker image:
│   node:20-alpine3.19
│
├── Container port:
│   4002
│
└── Dependencies:
    └── PostgreSQL
```

The exposed port does not represent an HTTP server.

Communication happens through:

```
auth-ms
    |
    |
 RabbitMQ
```

---

# 🧪 Testing

Available scripts:

```bash
npm run test
```

```bash
npm run test:watch
```

```bash
npm run test:cov
```

```bash
npm run test:debug
```

```bash
npm run test:e2e
```

Current state:

```
✅ customer.service.spec.ts exists

❌ No test directory
❌ No jest-e2e.json
```

`npm run test:e2e` currently fails because the configuration file is missing.

---

# 🔐 Environment Variables

Validated using:

```
src/config/envs.ts
```

The application exits if required variables are missing.

| Variable | Required | Description |
|---|---|---|
| `NODE_ENV` | ✅ | Runtime environment |
| `PORT` | ❌ | Startup log only |
| `DB_HOST` | ✅ | PostgreSQL host |
| `DB_PORT` | ❌ | PostgreSQL port |
| `POSTGRES_USER` | ✅ | Database user |
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `POSTGRES_DB` | ✅ | Database name |
| `JWT_SECRET_ACCESS` | ✅ | Access token secret |
| `JWT_SECRET_REFRESH` | ✅ | Refresh token secret |
| `JWT_SECRET_VERIFY_EMAIL` | ✅ | Email verification secret |
| `RABBITMQ_URL` | ✅ | RabbitMQ connection |
| `RABBITMQ_QUEUE` | ✅ | Incoming queue |
| `REDIS_HOST` | ✅ | Redis host |
| `REDIS_PORT` | ❌ | Redis port |
| `REDIS_PASS` | ✅ | Redis password |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client |
| `VERIFY_EMAIL_URL` | ✅ | Email verification URL |
| `RESET_PASSWORD_URL` | ✅ | Password reset URL |

---

# Example `.env`

```env
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password
POSTGRES_DB=auth

JWT_SECRET_ACCESS=secret
JWT_SECRET_REFRESH=secret
JWT_SECRET_RESET=secret
JWT_SECRET_VERIFY_EMAIL=secret

RABBITMQ_URL=amqp://localhost:5672
RABBITMQ_QUEUE=auth_queue

REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASS=password

GOOGLE_CLIENT_ID=my-google-client

VERIFY_EMAIL_URL=https://app.com/verify
RESET_PASSWORD_URL=https://app.com/reset
```

---

# 📨 Incoming RabbitMQ Patterns

All incoming communication uses:

```ts
@MessagePattern()
```

No HTTP routes exist.

---

# 🏢 SaaS Authentication

Location:

```
src/auth/saas-auth
```

Patterns:

| Pattern | Description |
|---|---|
| `auth.saas.register` | Register SaaS user |
| `auth.saas.verify_email` | Verify email |
| `auth.saas.resend_verification` | Resend verification |
| `auth.saas.login` | Login |
| `auth.saas.refresh` | Refresh tokens |
| `auth.google` | Google OAuth login |
| `auth.saas.change_password` | Change password |
| `auth.saas.forgot_password` | Forgot password |
| `auth.saas.reset_password` | Reset password |
| `saas.auth.change-email.request` | Request email change |
| `saas.auth.change-email.confirm` | Confirm email change |

---

# 👤 Customer Authentication

Location:

```
src/auth/customer-auth
```

Patterns:

| Pattern | Description |
|---|---|
| `auth.customer.register` | Register customer |
| `auth.customer.login` | Login |
| `auth.customer.refresh` | Refresh token |
| `auth.google` | Google OAuth login |
| `auth.customer.change_password` | Change password |
| `auth.customer.forgot_password` | Forgot password |
| `auth.customer.reset_password` | Reset password |
| `customer.auth.verify-email` | Verify email |
| `customer.auth.resend-verification` | Resend verification |
| `customer.auth.change-email.request` | Request email change |
| `customer.auth.change-email.confirm` | Confirm email change |

---

# 🔑 Session Management

Location:

```
src/session
```

Patterns:

| Pattern | Description |
|---|---|
| `auth.session.logout` | Logout current session |
| `auth.session.logout-all` | Logout all sessions |
| `session.list` | List active sessions |
| `session.revoke` | Revoke session |

---

# 👥 SaaS User Profile

Location:

```
src/user
```

Patterns:

| Pattern | Description |
|---|---|
| `auth.saas.user.get_profile` | Get profile |
| `auth.saas.user.update` | Update user |
| `auth.saas.user.deactivate` | Soft delete |
| `auth.saas.user.restore` | Restore user |

---

# 👥 Customer Profile

Location:

```
src/customer
```

Patterns:

| Pattern | Description |
|---|---|
| `auth.customer.user.create` | Create customer |
| `auth.customer.user.get_all_profiles` | List customers |
| `auth.customer.user.get_profile` | Get profile |
| `auth.customer.user.update` | Update customer |
| `auth.customer.user.delete` | Delete customer |
| `auth.customer.user.soft-delete` | Soft delete |
| `auth.customer.user.restore` | Restore customer |
| `auth.customer.user.growth_by_admin` | Customer growth stats |

---

# 📤 Outgoing Events

The service publishes events using:

```ts
ClientProxy.emit()
```

---

## Notifications Events

Queue:

```
RMQ_EVENTS_QUEUE_NOTIFICATIONS
```

Events:

| Event |
|---|
| `verify_email.saas` |
| `forgot_password.saas` |
| `saas_mailer_email_changed` |
| `verify_email.customer` |
| `forgot_password.customer` |
| `customer_mailer_email_changed` |

Consumer:

```
notifications-ms
```

---

## Authorization Events

Queue:

```
RMQ_EVENTS_QUEUE_AUTHZ
```

Event:

```
userOrganization.user_authz_refresh
```

---

## Customer Anonymization Events

Published to:

```
RMQ_EVENTS_QUEUE_ORDERS
RMQ_EVENTS_QUEUE_PAYMENTS
RMQ_EVENTS_QUEUE_ORGANIZATION
```

Event:

```
customer.anonymized
```

Consumers:

```
orders-ms
payments-ms
organization-ms
```

---

# 🔌 External Dependencies

## PostgreSQL

Used by TypeORM.

Entities:

```
SaasUser
Customer
```

Development:

```ts
synchronize: true
```

Production requires migrations.

---

## Redis

Used for:

- Sessions
- Token storage
- Temporary authentication state

Client:

```
ioredis
```

---

## RabbitMQ

Used for:

- Incoming authentication requests
- Outgoing domain events

---

## Google OAuth

Implemented using:

```
google-auth-library
```

Flow:

```
Google ID Token
        |
        ▼
verifyIdToken()
        |
        ▼
User authentication
```

---

# 📁 Project Structure

```
auth-ms/

src/

├── auth/
│
│   ├── saas-auth/
│   ├── customer-auth/
│   └── oauth/
│
├── customer/
│
├── user/
│
├── session/
│
├── redis/
│
├── config/
│
├── database/
│
└── main.ts
```

---

# ⚠️ Known Limitations / TODO

## Environment variables

Missing from `.env.example`:

```
JWT_SECRET_VERIFY_EMAIL
REDIS_PASS
RMQ_EVENTS_QUEUE_ORDERS
RMQ_EVENTS_QUEUE_PAYMENTS
RMQ_EVENTS_QUEUE_ORGANIZATION
```

---

## Google OAuth pattern collision

Both controllers register:

```
auth.google
```

SaaS:

```
SaaSAuthController
```

Customer:

```
CustomerAuthController
```

This may create a routing conflict.

---

## Mailer dependencies

Installed:

```
@nestjs-modules/mailer
nodemailer
handlebars
```

However:

```
src/custom-mailer/
```

does not exist.

The build script references missing templates.

---

## Missing SaaS user handlers

Defined patterns:

```
GET_ALL_PROFILES
DELETE
```

do not currently have controller handlers.

---

## Database migrations

No migration files found.

Production migration strategy should be verified.

---

# ✅ Service Status

| Feature | Status |
|---|---|
| JWT authentication | ✅ |
| Refresh tokens | ✅ |
| Redis sessions | ✅ |
| PostgreSQL persistence | ✅ |
| Google OAuth | ✅ |
| RabbitMQ messaging | ✅ |
| SaaS authentication | ✅ |
| Customer authentication | ✅ |
| Event publishing | ✅ |
| HTTP API | ❌ Not exposed |
| Automated tests | ⚠️ Partial |