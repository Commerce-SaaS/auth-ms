// Must be before any imports — Jest hoists this to bypass env validation
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
    resetTokenSecret: 'secret',
    redisHost: 'localhost',
    redisPort: 6379,
    redisPass: 'pass',
    googleClientId: 'gid',
    resetPasswordUrl: 'http://localhost/reset',
    verifyEmailUrl: 'http://localhost/verify',
  },
  RMQ_SERVICE: 'RMQ_SERVICE',
}));

import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CustomerService } from './customer.service';
import { Customer } from './entities/customer.entity';
import { SessionService } from '../session/session.service';
import { CustomerAuthService } from '../auth/customer-auth/customer-auth.service';
import { AUTHZ_EVENTS_CLIENT } from '../config/services';

const ORG_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const ORG_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const CUST_A_ID = 'cust-a-active';
const CUST_A_DEL_ID = 'cust-a-deleted';
const CUST_B_ID = 'cust-b-active';

function matchesWhere(row: any, where: any): boolean {
  return Object.entries(where).every(
    ([k, v]) => v === undefined || row[k] === v,
  );
}

describe('CustomerService — admin IDOR regression', () => {
  let service: CustomerService;
  let rows: any[];
  let mockSessionService: { logoutAllSessions: jest.Mock };

  const fakeRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    softDelete: jest.fn(),
    restore: jest.fn(),
  };

  function makeRows() {
    return [
      {
        id: CUST_A_ID,
        organizationId: ORG_A,
        name: 'Alice',
        email: 'alice@a.com',
        createdAt: new Date(),
        deletedAt: null,
      },
      {
        id: CUST_A_DEL_ID,
        organizationId: ORG_A,
        name: 'Alice Deleted',
        email: 'alice-del@a.com',
        createdAt: new Date(),
        deletedAt: new Date('2025-01-01'),
      },
      {
        id: CUST_B_ID,
        organizationId: ORG_B,
        name: 'Bob',
        email: 'bob@b.com',
        createdAt: new Date(),
        deletedAt: null,
      },
    ];
  }

  beforeEach(async () => {
    rows = makeRows();
    mockSessionService = {
      logoutAllSessions: jest.fn().mockResolvedValue(undefined),
    };

    fakeRepo.findOne.mockImplementation(async ({ where }: any) =>
      rows.find((r) => matchesWhere(r, where)) ?? null,
    );
    fakeRepo.update.mockResolvedValue({ affected: 1 });
    fakeRepo.softDelete.mockResolvedValue({ affected: 1 });
    fakeRepo.restore.mockResolvedValue({ affected: 1 });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomerService,
        { provide: getRepositoryToken(Customer), useValue: fakeRepo },
        { provide: CustomerAuthService, useValue: {} },
        { provide: SessionService, useValue: mockSessionService },
        { provide: AUTHZ_EVENTS_CLIENT, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<CustomerService>(CustomerService);
  });

  afterEach(() => jest.clearAllMocks());

  // ─── getProfileByAdmin ───────────────────────────────────────────────────
  describe('getProfileByAdmin', () => {
    it('rejects when customer belongs to another org', async () => {
      await expect(
        service.getProfileByAdmin(CUST_B_ID, ORG_A),
      ).rejects.toThrow();
    });

    it('returns the customer profile for the correct org', async () => {
      const result = await service.getProfileByAdmin(CUST_A_ID, ORG_A);
      expect(result.id).toBe(CUST_A_ID);
    });
  });

  // ─── softDeleteByAdmin ───────────────────────────────────────────────────
  describe('softDeleteByAdmin', () => {
    it('rejects and does not call softDelete when customer belongs to another org', async () => {
      await expect(
        service.softDeleteByAdmin(CUST_B_ID, ORG_A),
      ).rejects.toThrow();
      expect(fakeRepo.softDelete).not.toHaveBeenCalled();
      expect(mockSessionService.logoutAllSessions).not.toHaveBeenCalled();
    });

    it('soft-deletes and logs out for the correct org', async () => {
      const result = await service.softDeleteByAdmin(CUST_A_ID, ORG_A);
      expect(fakeRepo.softDelete).toHaveBeenCalledTimes(1);
      expect(mockSessionService.logoutAllSessions).toHaveBeenCalledWith(
        CUST_A_ID,
      );
      expect(result).toHaveProperty('message');
    });
  });

  // ─── deleteByAdmin ───────────────────────────────────────────────────────
  describe('deleteByAdmin', () => {
    it('rejects and does not call update when customer belongs to another org', async () => {
      await expect(
        service.deleteByAdmin(CUST_B_ID, ORG_A),
      ).rejects.toThrow();
      expect(fakeRepo.update).not.toHaveBeenCalled();
      expect(mockSessionService.logoutAllSessions).not.toHaveBeenCalled();
    });

    it('permanently deletes and logs out for the correct org', async () => {
      const result = await service.deleteByAdmin(CUST_A_ID, ORG_A);
      expect(fakeRepo.update).toHaveBeenCalledTimes(1);
      expect(mockSessionService.logoutAllSessions).toHaveBeenCalledWith(
        CUST_A_ID,
      );
      expect(result).toHaveProperty('message');
    });
  });

  // ─── restoreCustomerByAdmin ──────────────────────────────────────────────
  describe('restoreCustomerByAdmin', () => {
    it('rejects when customer belongs to another org', async () => {
      await expect(
        service.restoreCustomerByAdmin(CUST_B_ID, ORG_A),
      ).rejects.toThrow();
      expect(fakeRepo.restore).not.toHaveBeenCalled();
    });

    it('restores a soft-deleted customer in the correct org', async () => {
      const result = await service.restoreCustomerByAdmin(
        CUST_A_DEL_ID,
        ORG_A,
      );
      expect(fakeRepo.restore).toHaveBeenCalledTimes(1);
      expect(result).toHaveProperty('message');
    });
  });
});
