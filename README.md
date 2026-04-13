# 🧩 Auth Microservice (auth-ms)

## Overview

The **Auth Microservice** is a robust, production-ready authentication and authorization service built with **NestJS** that handles user authentication for both **SaaS platform staff** and **end customers** in a distributed commerce system.

### Key Responsibilities

- **User Authentication**: Supports traditional email/password and OAuth 2.0 (Google) authentication
- **Session Management**: Redis-based session storage with JWT tokens (access & refresh)
- **Password Recovery**: Secure password reset and change functionality
- **Multi-User Type Support**: Separate authentication flows for SaaS users and customers
- **Email Verification**: Event-driven email verification system
- **Authorization Events**: Integration with authorization microservice for role management
- **Event Publishing**: Emits authentication-related events via RabbitMQ

---

## 🏗️ Architecture

### Architectural Pattern: Microservices with Event-Driven Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Applications                        │
└──────────────────────┬──────────────────────────────────────┘
                       │ RabbitMQ Messages
┌──────────────────────▼──────────────────────────────────────┐
│              Auth Microservice (NestJS)                       │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Controllers (Message Patterns)                       │   │
│  │  ├─ SaaSAuthController                               │   │
│  │  └─ CustomerAuthController                           │   │
│  └─────────────────────┬─────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────────┐   │
│  │  Services                                             │   │
│  │  ├─ SaaSAuthService                                  │   │
│  │  ├─ CustomerAuthService                              │   │
│  │  ├─ SessionService                                   │   │
│  │  └─ GoogleOAuthService                               │   │
│  └──────┬──────────────────┬──────────────────┬──────────┘   │
└─────────┼──────────────────┼──────────────────┼───────────────┘
          │                  │                  │
    ┌─────▼──┐        ┌──────▼──────┐    ┌─────▼──┐
    │ PostgreSQL    │   Redis      │    │ RabbitMQ │
    │ (Users DB)    │  (Sessions)  │    │ (Events) │
    └────────┘      └──────────────┘    └──────────┘
```

### Module Structure

- **SaaSAuthModule**: Authentication for platform staff/administrators
- **CustomerAuthModule**: Authentication for end customers
- **SessionModule**: JWT token generation and session management
- **JwtProvidersModule**: JWT service configuration for access/refresh tokens
- **RedisModule**: Session and token storage
- **RabbitMQModule**: Event publishing and microservice communication
- **OAuthModule**: Third-party OAuth provider integration (Google)

### Design Patterns

- **Separation of Concerns**: Distinct modules for SaaS and customer authentication
- **Message-Driven**: RabbitMQ-based communication (event emission, not HTTP)
- **JWT-Based Sessions**: Access tokens (30m) + Refresh tokens (7d)
- **Soft Delete**: Users can be deactivated but not permanently deleted
- **Event-Driven Authorization**: Integration with authorization microservice via events

---

## ⚙️ Tech Stack

| Technology | Purpose | Version |
|------------|---------|---------|
| **NestJS** | Framework | ^11.0.1 |
| **TypeORM** | Database ORM | ^0.3.27 |
| **PostgreSQL** | Primary database | (via pg ^8.16.3) |
| **Redis** | Session/token storage | (via ioredis ^5.8.0) |
| **RabbitMQ** | Message queue | (via amqplib ^0.10.9) |
| **JWT** | Token generation/validation | @nestjs/jwt ^11.0.0 |
| **bcrypt** | Password hashing | ^6.0.0 |
| **Google Auth Library** | OAuth 2.0 verification | ^10.6.1 |
| **class-validator** | DTO validation | ^0.14.2 |
| **Zod** | Environment validation | ^4.1.11 |
| **Jest** | Testing framework | ^29.7.0 |

---

## 📁 Project Structure

```
src/
├── auth/                          # Authentication logic
│   ├── customer-auth/             # Customer authentication
│   │   ├── customer-auth.controller.ts
│   │   ├── customer-auth.service.ts
│   │   ├── customer-auth.module.ts
│   │   ├── dto/
│   │   │   └── register-customer.dto.ts
│   │   └── patterns/
│   │       └── customer-auth.patterns.ts
│   ├── saas-auth/                 # SaaS user authentication
│   │   ├── saas-auth.controller.ts
│   │   ├── saas-auth.service.ts
│   │   ├── saas-auth.module.ts
│   │   └── patterns/
│   │       └── saas-auth.patterns.ts
│   ├── oauth/                     # OAuth provider integration
│   │   ├── google-oauth.service.ts
│   │   └── oauth.module.ts
│   └── shared/                    # Shared DTOs and enums
│       ├── dto/
│       │   ├── login.dto.ts
│       │   ├── register-user.dto.ts
│       │   ├── change-password.dto.ts
│       │   ├── forgot-password.dto.ts
│       │   ├── reset-password.dto.ts
│       │   └── google-auth.dto.ts
│       └── enums/
│           ├── platform-roles.enum.ts
│           └── user_authz_refresh_reason.enum.ts
├── customer/                      # Customer profile management
│   ├── customer.controller.ts
│   ├── customer.service.ts
│   ├── customer.module.ts
│   ├── entities/
│   │   └── customer.entity.ts
│   └── patterns/
│       └── customer_patterns.ts
├── user/                          # SaaS user profile management
│   ├── saas-user.controller.ts
│   ├── saas-user.service.ts
│   ├── saas-user.module.ts
│   ├── entities/
│   │   └── saas-user.entity.ts
│   └── patterns/
│       └── saas_user_patterns.ts
├── session/                       # Session and token management
│   ├── session.service.ts
│   ├── session.controller.ts
│   ├── session.module.ts
│   ├── interfaces/
│   │   └── session-data.interface.ts
│   └── patterns/
│       └── session_patterns.ts
├── jwt-provider/                  # JWT service configuration
│   └── jwt-provider.module.ts
├── redis/                         # Redis client setup
│   ├── redis.module.ts
│   └── providers/
│       └── redis.provider.ts
├── transports/                    # RabbitMQ transport
│   └── rabbitmq.module.ts
├── config/                        # Configuration
│   ├── envs.ts                    # Environment variables & validation
│   └── services.ts                # Service constants
├── common/                        # Shared utilities
│   ├── helpers/
│   │   └── rpc-exception.helper.ts
│   ├── interfaces/
│   │   ├── jwt-data.interface.ts
│   │   └── jwt-payload.interface.ts
│   ├── exceptions/
│   │   └── rpc-custom-exception.filter.ts
│   └── dto/
│       └── pagination.dto.ts
├── app.module.ts                  # Root module
└── main.ts                        # Entry point
```

---

## 🔌 Environment Variables

### Required Environment Variables

All variables are validated with **Zod** on startup. Missing or invalid variables will cause the application to fail.

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `NODE_ENV` | enum | Execution environment | `development \| production \| test` |
| `PORT` | number | Service port (default: 3000) | `3000` |
| **Database** | | | |
| `DB_HOST` | string | PostgreSQL host | `localhost` |
| `DB_PORT` | number | PostgreSQL port (default: 5432) | `5432` |
| `POSTGRES_USER` | string | PostgreSQL username | `auth_user` |
| `POSTGRES_PASSWORD` | string | PostgreSQL password | `secure_password` |
| `POSTGRES_DB` | string | PostgreSQL database name | `auth_db` |
| **JWT Tokens** | | | |
| `JWT_SECRET_ACCESS` | string | Secret for access tokens (30m expiry) | `your-access-secret-key` |
| `JWT_SECRET_REFRESH` | string | Secret for refresh tokens (7d expiry) | `your-refresh-secret-key` |
| `JWT_SECRET_RESET` | string | Secret for password reset tokens (15m expiry) | `your-reset-secret-key` |
| **Redis** | | | |
| `REDIS_HOST` | string | Redis server host | `localhost` |
| `REDIS_PORT` | number | Redis server port (default: 6379) | `6379` |
| **RabbitMQ** | | | |
| `RABBITMQ_URL` | string | RabbitMQ connection URL | `amqp://user:pass@localhost:5672` |
| `RABBITMQ_QUEUE` | string | Main service queue name | `auth_queue` |
| `RMQ_EVENTS_QUEUE_NOTIFICATIONS` | string | Events queue for notifications | `notifications_queue` |
| `RMQ_EVENTS_QUEUE_AUTHZ` | string | Events queue for authorization | `authz_queue` |
| **OAuth** | | | |
| `GOOGLE_CLIENT_ID` | string | Google OAuth 2.0 Client ID | `123456789.apps.googleusercontent.com` |
| **URLs** | | | |
| `VERIFY_EMAIL_URL` | string | Frontend URL for email verification | `https://app.example.com/verify-email` |
| `RESET_PASSWORD_URL` | string | Frontend URL for password reset | `https://app.example.com/reset-password` |

### Environment Validation (Zod Schema)

```typescript
// Zod validates all environment variables with specific rules:
- RABBITMQ_URL must match regex: ^amqps?:\/\/
- RABBITMQ_QUEUE, RMQ_EVENTS_QUEUE_* cannot be empty
- GOOGLE_CLIENT_ID cannot be empty
- VERIFY_EMAIL_URL and RESET_PASSWORD_URL must be valid URLs
```

---

## 🚀 Installation & Running

### Prerequisites

- **Node.js**: v18+ (v22 recommended)
- **PostgreSQL**: v14+
- **Redis**: v7+
- **RabbitMQ**: v3.12+
- **npm** or **yarn**

### 1. Install Dependencies

```bash
npm install
# or
yarn install
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Copy from provided example
cp .env.example .env

# Edit with your configuration
nano .env
```

### 3. Database Setup

The service uses TypeORM with **auto-sync in development**:

```bash
# TypeORM will automatically create tables on startup (development only)
# For production, run migrations manually (if available)
```

### 4. Start the Service

#### Development Mode (with hot reload)

```bash
npm run start:dev
```

#### Production Mode (optimized)

```bash
npm run build
npm run start:prod
```

#### Debug Mode

```bash
npm run start:debug
# Debugger will listen on port 9229
```

### 5. Verify Service is Running

```bash
# Check service is listening on RabbitMQ
# Logs should show: "Auth Microservice is running on port 3000"
```

---

## 📡 API Endpoints (Message Patterns)

The service uses **RabbitMQ message patterns** instead of HTTP REST endpoints. Clients communicate through the message broker.

### SaaS User Authentication

| Pattern | Payload | Response | Description |
|---------|---------|----------|-------------|
| `auth.saas.register` | `RegisterUserDto` | `{user, tokens}` | Register new SaaS user |
| `auth.saas.login` | `LoginDto` | `{user, tokens}` | Login SaaS user |
| `auth.saas.refresh` | `refreshToken: string` | `{accessToken, refreshToken}` | Refresh access token |
| `auth.saas.change_password` | `{id, data: ChangePasswordDto}` | `{message}` | Change password |
| `auth.saas.forgot_password` | `ForgotPasswordDto` | `{message}` | Request password reset |
| `auth.saas.reset_password` | `ResetPasswordDto` | `{message}` | Reset password with token |

### Customer Authentication

| Pattern | Payload | Response | Description |
|---------|---------|----------|-------------|
| `auth.customer.register` | `RegisterCustomerDto` | `{user, tokens}` | Register new customer |
| `auth.customer.login` | `LoginDto` | `{user, tokens}` | Login customer |
| `auth.customer.refresh` | `refreshToken: string` | `{accessToken, refreshToken}` | Refresh access token |
| `auth.customer.change_password` | `{id, data: ChangePasswordDto}` | `{message}` | Change customer password |
| `auth.customer.forgot_password` | `ForgotPasswordDto` | `{message}` | Request customer password reset |
| `auth.customer.reset_password` | `ResetPasswordDto` | `{message}` | Reset customer password |
| `auth.google` | `GoogleAuthDto` | `{user, tokens}` | Google OAuth login |

### DTOs (Data Transfer Objects)

#### LoginDto
```typescript
{
  email: string;        // Valid email format
  password: string;     // Strong password (8+ chars, uppercase, lowercase, number, symbol)
}
```

#### RegisterUserDto (SaaS)
```typescript
{
  email: string;        // Valid email, must be unique
  password: string;     // Strong password requirements
  name: string;         // User full name
}
```

#### RegisterCustomerDto
```typescript
{
  email: string;        // Valid email, unique per organization
  password: string;     // Strong password requirements
  name: string;         // Customer name
  organizationId: string;  // Organization UUID
}
```

#### ChangePasswordDto
```typescript
{
  oldPassword: string;  // Current password (for verification)
  newPassword: string;  // New password (must be strong)
}
```

#### ForgotPasswordDto
```typescript
{
  email: string;        // Email to send reset link
}
```

#### ResetPasswordDto
```typescript
{
  token: string;        // Reset token from email link
  password: string;     // New password (must be strong)
}
```

#### GoogleAuthDto
```typescript
{
  idToken: string;      // Google OAuth ID token
  organizationId?: string;  // (Customer only) Organization UUID
}
```

---

## 🔐 Security

### Authentication Mechanisms

1. **JWT Tokens**
   - **Access Token**: 30-minute expiry, for API request authorization
   - **Refresh Token**: 7-day expiry, for obtaining new access tokens
   - **Reset Token**: 15-minute expiry, for password reset operations
   - Token structure: `{jti, sub, type, platformRole, iat, exp}`

2. **Password Security**
   - **Bcrypt Hashing**: 10 rounds salt
   - **Strong Password Requirements**:
     - Minimum 8 characters
     - At least 1 uppercase letter
     - At least 1 lowercase letter
     - At least 1 number
     - At least 1 special symbol

3. **Session Management**
   - **Redis Storage**: Sessions stored with TTL (24h for auth, 15m for refresh)
   - **JTI Invalidation**: Each token has unique JTI for revocation support
   - **Logout Support**: Can invalidate single or all user sessions

4. **OAuth 2.0 Integration**
   - **Google OAuth**: ID token verification using Google Auth Library
   - **Email Auto-Verification**: Users authenticated via Google are auto-verified
   - **Automatic Account Creation**: First-time OAuth users auto-registered

5. **Input Validation**
   - **Global ValidationPipe**: All DTOs validated with class-validator
   - **Whitelist Mode**: Unknown properties rejected
   - **Strong Type Coercion**: Type transformation enabled

6. **Error Handling**
   - **RPC Custom Exceptions**: Standardized error responses
   - **No User Enumeration**: Generic error messages for security
   - **Token Consumption**: Reset tokens consumed after first use

### Security Headers & Best Practices

- **Environment Separation**: Different configs for dev/prod/test
- **Secret Management**: All secrets loaded from environment variables
- **Soft Deletes**: Deactivated users can be restored but not permanently deleted
- **Audit Trail**: Creation and update timestamps on all entities
- **Unique Constraints**: Email unique per user type (SaaS uses email globally, customers use email+organizationId)

---

## 🧠 Core Logic

### Authentication Flow

#### 1. User Registration (SaaS)

```
Client → Message[auth.saas.register] → Controller
                                           ↓
                                    Validate DTO
                                           ↓
                              Check email not exists
                                           ↓
                         Hash password (bcrypt, 10 rounds)
                                           ↓
                           Save user to PostgreSQL
                                           ↓
                        Generate JWT tokens (access + refresh)
                                           ↓
                          Save session to Redis (24h TTL)
                                           ↓
               Emit event: verify_email (to Notifications service)
                                           ↓
           Emit event: user_authz_refresh (to Authorization service)
                                           ↓
                      Return {user, tokens}
```

#### 2. User Login

```
Client → Message[auth.saas.login] → Controller
                                       ↓
                              Validate email exists
                                       ↓
                        Verify password (bcrypt.compare)
                                       ↓
                     Check account not deleted (deletedAt null)
                                       ↓
                    Generate new JWT tokens + session
                                       ↓
                 Emit authorization refresh event
                                       ↓
                    Return {user, tokens}
```

#### 3. Token Refresh

```
Client → refresh_token → SessionService.signAuthTokens()
                                    ↓
                        Verify existing refresh token
                                    ↓
                     Extract userId from token payload
                                    ↓
                     Generate new access + refresh tokens
                                    ↓
                     Save new session to Redis (15m TTL)
                                    ↓
                     Emit authorization refresh event
                                    ↓
                 Return {accessToken, refreshToken}
```

#### 4. Password Reset

```
1. forgotPassword(email)
   ↓
   Find user in DB
   ↓
   Invalidate all existing reset tokens
   ↓
   Generate new reset token (15m expiry)
   ↓
   Store token in Redis with user ID
   ↓
   Emit event: forgot_password (send email with reset link)
   ↓
   Return: "If the email exists, reset instructions were sent"

2. resetPassword(token, newPassword)
   ↓
   Verify reset token signature + structure
   ↓
   Consume token from Redis (one-time use)
   ↓
   Validate userId matches token
   ↓
   Hash new password
   ↓
   Update password in PostgreSQL
   ↓
   Invalidate all user's reset tokens
   ↓
   Return: "Password reset successfully"
```

#### 5. Google OAuth Flow

```
Client → GoogleAuth(idToken) → GoogleOAuthService.verifyIdToken()
                                          ↓
                          Verify token with Google API
                                          ↓
                       Extract: email, name, googleId
                                          ↓
                     Check if customer already exists
                          ↓                ↓
                      YES:              NO:
                      Use existing     Create new
                                          ↓
                         Generate JWT tokens
                                          ↓
                         Save session to Redis
                                          ↓
                    Emit authorization refresh event
                                          ↓
                       Return {user, tokens}
```

### Session Storage (Redis)

```typescript
// Session structure:
session:{jti} → {userId: string, ...metadata}  (TTL: 24h or 15m)

// User sessions index:
user-sessions:{userId} → Set<jti>  (TTL: same as session)

// Reset tokens:
reset-token:{jti} → userId  (TTL: 15m)
user-reset-tokens:{userId} → Set<jti>  (for invalidation)

// Logout (single session):
DELETE session:{jti}
SREM user-sessions:{userId} {jti}

// Logout All (user):
SMEMBERS user-sessions:{userId}  → List of jti
DELETE all session:{jti}
DELETE user-sessions:{userId}
```

### Event Publishing (RabbitMQ)

The service emits the following events:

| Event | Queue | Payload | Consumer |
|-------|-------|---------|----------|
| `verify_email` | notifications_queue | `{email, verifyUrl}` | Notifications Service |
| `forgot_password` | notifications_queue | `{email, resetUrl}` | Notifications Service |
| `userOrganization.user_authz_refresh` | authz_queue | `{userId, reason, organizationId?}` | Authorization Service |

---

## 🔄 Integrations

### 1. PostgreSQL Database Integration

- **ORM**: TypeORM with entity auto-sync (development)
- **Entities**: `SaasUser`, `Customer`
- **Features**: Unique indexes, soft deletes, timestamps

### 2. Redis Integration

- **Session Storage**: JWT session state with TTL
- **Token Management**: Reset token one-time-use guarantee
- **Data Structure**: Sets, strings with expiration
- **Client**: ioredis library

### 3. RabbitMQ Integration

- **Transport**: NestJS Microservices RabbitMQ transport
- **Queue Configuration**: Durable queues with acknowledgments
- **Event Types**:
  - Notifications (email events)
  - Authorization (user role refresh events)
- **Emit Pattern**: Fire-and-forget (no guaranteed delivery)

### 4. Google OAuth 2.0

- **Library**: google-auth-library
- **Flow**: OAuth 2.0 ID token verification
- **Payload**: Email, name, subject (sub = Google ID)

### 5. Notification Service (RabbitMQ)

Receives events for sending:
- Email verification links
- Password reset links
- Account update notifications

### 6. Authorization Service (RabbitMQ)

Receives events when:
- New user registers
- User logs in / refreshes token
- Password changes

---

## 🧪 Testing

### Available Test Commands

```bash
# Run tests once
npm run test

# Watch mode (re-run on changes)
npm run test:watch

# Coverage report
npm run test:cov

# Debug mode
npm run test:debug

# E2E tests
npm run test:e2e
```

### Test Configuration

- **Framework**: Jest
- **Root Directory**: `src`
- **Test Pattern**: `**/*.spec.ts`
- **Transform**: ts-jest
- **Coverage Directory**: `../coverage`
- **Test Environment**: Node.js

### Testing Guide

Tests are located alongside source files with `.spec.ts` extension. Example:
```
src/auth/saas-auth/saas-auth.service.ts
src/auth/saas-auth/saas-auth.service.spec.ts
```

---

## 📌 Additional Notes

### Important Implementation Details

1. **Email Uniqueness**
   - SaaS users: Email must be globally unique
   - Customers: Email must be unique per organization
   - Validated at DB level with unique indexes

2. **Soft Delete Behavior**
   - Deleted users cannot login
   - Forgot password operations include deleted users
   - Users can be restored by re-authenticating if credentials match

3. **Token Expiry Strategy**
   - **Access Tokens**: 30 minutes (short-lived, for API calls)
   - **Refresh Tokens**: 7 days (for obtaining new access tokens)
   - **Reset Tokens**: 15 minutes (for one-time password reset)

4. **User Types (Platform Roles)**
   - `STAFF`: SaaS platform users (admin, members)
   - `CUSTOMER`: End users of organizations

5. **Strong Password Requirement**
   - Applied to all password fields (registration, change, reset)
   - Validated at DTO level with class-validator
   - Message: "Password must be at least 8 characters long and include uppercase, lowercase, number and symbol"

6. **Error Handling**
   - All errors converted to RPC exceptions
   - Validation errors show field-level messages
   - Database errors wrapped with business-friendly messages

7. **Database Synchronization**
   - **Development**: TypeORM auto-sync enabled (`synchronize: true`)
   - **Production**: Manual migrations required (auto-sync disabled)
   - Entities: `SaasUser`, `Customer`

### Performance Considerations

- **JWT Validation**: Every request validates token signature
- **Session Lookup**: Minimal Redis lookups (optional, mainly for revocation)
- **Password Hashing**: Bcrypt 10 rounds (intentionally slow for security)
- **Google OAuth**: External API call (verify on request, no caching)

### Scalability

- **Stateless Design**: Services can run in parallel (no state sharing)
- **RabbitMQ Distribution**: Microservices communicate asynchronously
- **Redis Clustering**: Can use Redis Cluster for session distribution
- **Database Replication**: PostgreSQL replication for HA

### Monitoring & Logging

- Logger instances in services for operation tracking
- RPC exceptions bubble to clients with error details
- Consider implementing:
  - Centralized logging (ELK, Datadog, etc.)
  - Distributed tracing (Jaeger, Zipkin)
  - Metrics collection (Prometheus)

### Development Workflow

1. **Linting & Formatting**
   ```bash
   npm run lint      # Fix ESLint issues
   npm run format    # Format with Prettier
   ```

2. **Build Process**
   ```bash
   npm run build     # Compile TypeScript to JavaScript
   npm run postbuild # Copy template files (if any)
   ```

3. **Common Debugging**
   - Enable debug logs: `DEBUG=auth-ms:* npm run start:dev`
   - Check RabbitMQ messages: Use RabbitMQ Management UI
   - Verify Redis keys: `redis-cli KEYS "*"`
   - PostgreSQL queries: Enable TypeORM logging in envs.ts

---

## 📊 Microservice Communication Diagram

```
┌──────────────────────┐
│  API Gateway         │
│  (HTTP → RMQ)        │
└──────────┬───────────┘
           │ RabbitMQ
    ┌──────▼──────────────────┐
    │  Auth Microservice       │
    │  ├─ SaaSAuthService     │
    │  ├─ CustomerAuthService │
    │  └─ SessionService      │
    └──────┬──────────────────┘
           │
    ┌──────┴──────┬──────────────┐
    │              │              │
  RMQ            RMQ            RMQ
 Events         Events         Events
    │              │              │
┌───▼────────┐ ┌──▼───────────┐ ┌──▼──────┐
│Notifications│ │Authorization │ │ Redis   │
│ Service    │ │   Service    │ │ Cache   │
└────────────┘ └──────────────┘ └─────────┘
```

---

## 🔗 Service Dependencies

```
auth-ms
├── PostgreSQL (user data persistence)
├── Redis (session & token storage)
├── RabbitMQ (event publishing)
├── Google APIs (OAuth verification)
├── Notifications Service (consumed events)
└── Authorization Service (consumed events)
```

---

## ✅ Deployment Checklist

- [ ] All environment variables configured
- [ ] PostgreSQL database created and accessible
- [ ] Redis server running and accessible
- [ ] RabbitMQ broker running with queues defined
- [ ] Google OAuth credentials obtained
- [ ] Frontend URLs configured for email verification/reset
- [ ] Service built: `npm run build`
- [ ] Logs monitored during startup
- [ ] Health check endpoints accessible
- [ ] Microservice communication tested
- [ ] Database backups configured
- [ ] SSL/TLS certificates for RabbitMQ (if prod)

---

## 📝 License

UNLICENSED (proprietary)

---

**Last Updated**: 2026-04-13  
**Version**: 0.0.1
