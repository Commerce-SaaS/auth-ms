// Must be before any imports — Jest hoists this to bypass env validation.
// Importing GoogleOAuthService (transitively, via SaaSAuthService/
// CustomerAuthService) pulls in `src/config`, whose envs.ts runs Zod
// validation against process.env at import time. Copied verbatim from the
// repo's established convention, src/customer/customer.service.spec.ts.
jest.mock('src/config', () => ({
  envs: {
    nodeEnv: 'test',
    port: 3000,
    dbPort: 5432,
    dbHost: 'localhost',
    postgresUser: 'user',
    postgresPassword: 'pass',
    postgresDb: 'db',
    rabbitmqUrl: 'amqp://localhost',
    rabbitmqQueue: 'queue',
    rabbitmqEventsQueue: 'events',
    rabbitmqAuthzEventQueue: 'authz',
    accessTokensecret: 'secret',
    refreshTokenSecret: 'secret',
    verifyEmailTokenSecret: 'secret',
    redisHost: 'localhost',
    redisPort: 6379,
    redisPass: 'pass',
    googleClientId: 'gid',
  },
  RMQ_SERVICE: 'RMQ_SERVICE',
}));

/**
 * Regression coverage for the fix to the `auth.google` @MessagePattern
 * collision (formerly pinned as buggy behavior in
 * auth-google-collision.characterization.spec.ts, now replaced by this
 * file). SaaSAuthController and CustomerAuthController now bind two
 * distinct patterns — SAAS_AUTH_PATTERNS.GOOGLE_AUTH = 'auth.saas.google'
 * and CUSTOMER_AUTH_PATTERNS.GOOGLE_AUTH = 'auth.customer.google' — so both
 * flows can coexist on the same RabbitMQ queue without one overwriting the
 * other's handler registration.
 *
 * This boots auth-ms's REAL module graph (real @Module/@Controller/
 * @MessagePattern decorators, real SaaSAuthModule/CustomerAuthModule import
 * order mirrored exactly) via `moduleRef.createNestMicroservice(...)` +
 * `app.init()`, which runs NestJS's real listener-registration code path
 * without connecting to a broker (ServerRMQ only connects inside
 * `.listen()`). Only leaf dependencies (TypeORM repositories,
 * SessionService, GoogleOAuthService, outbound ClientProxies) are mocked.
 */
import { INestMicroservice, Module, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RpcException, Transport } from '@nestjs/microservices';
import { getRepositoryToken } from '@nestjs/typeorm';
import { firstValueFrom, isObservable } from 'rxjs';

import { SaaSAuthController } from './saas-auth/saas-auth.controller';
import { SaaSAuthService } from './saas-auth/saas-auth.service';
import { SAAS_AUTH_PATTERNS } from './saas-auth/patterns/saas-auth.patterns';
import { CustomerAuthController } from './customer-auth/customer-auth.controller';
import { CustomerAuthService } from './customer-auth/customer-auth.service';
import { CUSTOMER_AUTH_PATTERNS } from './customer-auth/patterns/customer-auth.patterns';
import { GoogleOAuthService } from './oauth/google-oauth.service';
import { SessionService } from '../session/session.service';
import { SaasUser } from '../user/entities/saas-user.entity';
import { Customer } from '../customer/entities/customer.entity';
import { JwtToken } from '../jwt-provider/enum/jwt-token.enum';
import { NOTIFICATIONS_EVENTS_CLIENT, AUTHZ_EVENTS_CLIENT } from '../config/services';

// ─── Leaf-dependency fakes (DB / Redis-backed session / Google / RabbitMQ) ──

// findOne resolves to null (no existing user/customer) so googleLogin takes
// its "create new account" branch; save resolves to a plausible saved row
// (with an `id`) so the code past that point — which reads `.id` off the
// result — doesn't crash on an unmocked `undefined` return.
const fakeSaasUserRepo = {
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation(async (data: any) => ({ id: 'fake-saas-user-id', ...data })),
  update: jest.fn(),
};
const fakeCustomerRepo = {
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation(async (data: any) => ({ id: 'fake-customer-id', ...data })),
  update: jest.fn(),
};

const fakeSessionService = {
  signAccessToken: jest.fn().mockResolvedValue('fake-access-token'),
  signRefreshToken: jest.fn().mockResolvedValue('fake-refresh-token'),
  saveSession: jest.fn().mockResolvedValue(undefined),
};

const fakeGoogleOAuthService = {
  verifyIdToken: jest.fn().mockResolvedValue({
    email: 'user@example.com',
    email_verified: true,
    sub: 'google-sub-id',
    name: 'Test User',
  }),
};

const fakeEventsClient = { emit: jest.fn() };
const fakeAuthzClient = { emit: jest.fn() };
// Only used by SaaSAuthService.refresh, not googleLogin — but the constructor
// requires it regardless of which method a given test calls.
const fakeJwtRefreshService = { verifyAsync: jest.fn() };

// ─── Test modules — mirror the REAL SaaSAuthModule / CustomerAuthModule ────
// (controllers + providers), swapping their real `imports` (which pull in
// TypeORM/Redis/RabbitMQ connections) for direct fakes of the same tokens.
// Both controllers are the real, unmodified classes with their real
// @MessagePattern decorators.

@Module({
  controllers: [SaaSAuthController],
  providers: [
    SaaSAuthService,
    { provide: JwtToken.REFRESH, useValue: fakeJwtRefreshService },
    { provide: getRepositoryToken(SaasUser), useValue: fakeSaasUserRepo },
    { provide: SessionService, useValue: fakeSessionService },
    { provide: GoogleOAuthService, useValue: fakeGoogleOAuthService },
    { provide: NOTIFICATIONS_EVENTS_CLIENT, useValue: fakeEventsClient },
    { provide: AUTHZ_EVENTS_CLIENT, useValue: fakeAuthzClient },
  ],
})
class SaaSAuthTestModule {}

@Module({
  controllers: [CustomerAuthController],
  providers: [
    CustomerAuthService,
    { provide: getRepositoryToken(Customer), useValue: fakeCustomerRepo },
    { provide: SessionService, useValue: fakeSessionService },
    { provide: GoogleOAuthService, useValue: fakeGoogleOAuthService },
    { provide: NOTIFICATIONS_EVENTS_CLIENT, useValue: fakeEventsClient },
    { provide: AUTHZ_EVENTS_CLIENT, useValue: fakeAuthzClient },
  ],
})
class CustomerAuthTestModule {}

// Import order mirrors app.module.ts exactly: SaaSAuthModule (equivalent:
// SaaSAuthTestModule) is imported BEFORE CustomerAuthModule (equivalent:
// CustomerAuthTestModule). No longer load-bearing for correctness now that
// the two flows use distinct patterns, but kept for fidelity to production.
@Module({
  imports: [SaaSAuthTestModule, CustomerAuthTestModule],
})
class RootTestModule {}

// ─── Dispatch helper ─────────────────────────────────────────────────────
// Invokes the handler function NestJS actually bound to a pattern (the same
// function `Server.send()`/`handleEvent()` would call for a real inbound
// message), normalizing its Promise-or-Observable return shape.
async function dispatchRpc(server: any, pattern: string, payload: unknown): Promise<any> {
  const handler = server.getHandlerByPattern(pattern);
  if (!handler) {
    throw new Error(`No handler registered for pattern "${pattern}"`);
  }
  const result = await handler(payload);
  return isObservable(result) ? firstValueFrom(result) : result;
}

describe('auth-ms — SaaS and customer Google OAuth routes (post-collision-fix)', () => {
  let app: INestMicroservice;
  let server: any;
  let saasGoogleLoginSpy: jest.SpyInstance;
  let customerGoogleLoginSpy: jest.SpyInstance;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RootTestModule],
    }).compile();

    app = moduleRef.createNestMicroservice({
      transport: Transport.RMQ,
      options: {
        urls: ['amqp://localhost'],
        queue: 'auth_google_routes_test_queue',
        queueOptions: { durable: true },
      },
    });

    // Mirrors the global ValidationPipe registered in auth-ms/src/main.ts
    // exactly (whitelist + forbidNonWhitelisted + transform + the same
    // RpcException-wrapping exceptionFactory).
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const messages = errors.map((err) =>
            err.constraints ? Object.values(err.constraints).join(', ') : '',
          );
          return new RpcException({ statusCode: 400, message: messages });
        },
      }),
    );

    // app.init() runs NestJS's real handler-registration path
    // (MicroservicesModule.setupListeners) WITHOUT connecting to a broker —
    // ServerRMQ only opens a connection inside listen()/start().
    await app.init();

    // NestMicroservice keeps `serverInstance` as a private TS field; casting
    // to `any` is the only way to reach the real Server instance (and its
    // public getHandlers()/getHandlerByPattern() methods) from outside.
    server = (app as any).serverInstance;

    saasGoogleLoginSpy = jest.spyOn(SaaSAuthService.prototype, 'googleLogin');
    customerGoogleLoginSpy = jest.spyOn(CustomerAuthService.prototype, 'googleLogin');
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    saasGoogleLoginSpy.mockClear();
    customerGoogleLoginSpy.mockClear();
  });

  it('no handler is bound to the old, collided "auth.google" pattern anymore', () => {
    expect(server.getHandlerByPattern('auth.google')).toBeNull();
  });

  it('SAAS_AUTH_PATTERNS.GOOGLE_AUTH and CUSTOMER_AUTH_PATTERNS.GOOGLE_AUTH are distinct patterns', () => {
    expect(SAAS_AUTH_PATTERNS.GOOGLE_AUTH).toBe('auth.saas.google');
    expect(CUSTOMER_AUTH_PATTERNS.GOOGLE_AUTH).toBe('auth.customer.google');
    expect(SAAS_AUTH_PATTERNS.GOOGLE_AUTH).not.toBe(CUSTOMER_AUTH_PATTERNS.GOOGLE_AUTH);
  });

  it('dispatching the real SaaS oauth/google payload ({credentials, clientInfo}) on "auth.saas.google" reaches SaaSAuthService.googleLogin — no 400', async () => {
    // Exact payload shape client-gateway's POST /saas/users/oauth/google
    // route sends: SaaSUserService.googleLogin wraps the request body under
    // `credentials` and adds `clientInfo`, then does
    // `authClient.send(SAAS_AUTH_PATTERNS.GOOGLE_AUTH, { credentials, clientInfo })`.
    const saasShapedPayload = {
      credentials: { idToken: 'fake-id-token' },
      clientInfo: { ip: '127.0.0.1', userAgent: 'jest' },
    };

    const result = await dispatchRpc(
      server,
      SAAS_AUTH_PATTERNS.GOOGLE_AUTH,
      saasShapedPayload,
    );

    expect(saasGoogleLoginSpy).toHaveBeenCalledTimes(1);
    expect(customerGoogleLoginSpy).not.toHaveBeenCalled();
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('tokens');
  });

  it('dispatching a flat customer GoogleAuthDto payload on "auth.customer.google" reaches CustomerAuthService.googleLogin', async () => {
    const organizationId = '11111111-1111-4111-8111-111111111111';

    const result = await dispatchRpc(server, CUSTOMER_AUTH_PATTERNS.GOOGLE_AUTH, {
      idToken: 'fake-id-token',
      organizationId,
    });

    expect(customerGoogleLoginSpy).toHaveBeenCalledTimes(1);
    expect(saasGoogleLoginSpy).not.toHaveBeenCalled();
    expect(result).toHaveProperty('user');
    expect(result).toHaveProperty('tokens');
  });
});
