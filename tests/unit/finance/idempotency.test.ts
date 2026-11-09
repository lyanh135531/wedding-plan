import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  hashPayload,
  withIdempotency,
  IdempotencyConflictError,
  IdempotencyForbiddenError,
} from '../../../src/lib/finance/idempotency.service';

vi.mock('@/db/client', () => {
  return {
    db: {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    },
  };
});

import { db } from '@/db/client';

describe('Idempotency Service (AT13, AT54)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('hashPayload deterministic canonical sorting', () => {
    it('produces identical hashes regardless of object key insertion order', () => {
      const obj1 = { name: 'Thanh toan 1', amount: '5000000', notes: 'Coc dot 1' };
      const obj2 = { amount: '5000000', notes: 'Coc dot 1', name: 'Thanh toan 1' };

      const hash1 = hashPayload(obj1);
      const hash2 = hashPayload(obj2);

      expect(hash1).toBe(hash2);
      expect(hash1.length).toBe(64); // SHA-256 hex string
    });

    it('produces different hashes for different payloads', () => {
      const obj1 = { name: 'Thanh toan 1', amount: '5000000' };
      const obj2 = { name: 'Thanh toan 1', amount: '6000000' };

      expect(hashPayload(obj1)).not.toBe(hashPayload(obj2));
    });
  });

  describe('withIdempotency logic flows', () => {
    it('executes directly if no key is provided', async () => {
      const executeMock = vi.fn().mockResolvedValue({ status: 201, body: { success: true } });

      const result = await withIdempotency({
        key: null,
        userId: 'user-1',
        operationType: 'CREATE_PAYMENT',
        payload: { amount: '1000' },
        execute: executeMock,
      });

      expect(result.fromCache).toBe(false);
      expect(result.status).toBe(201);
      expect(executeMock).toHaveBeenCalledTimes(1);
    });

    it('AT54: throws IdempotencyForbiddenError if user role is not owner', async () => {
      // Mock db.select for user check returning family_view role
      const mockSelect = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 'user-1', role: 'family_view' }]),
          }),
        }),
      });
      (db.select as any) = mockSelect;

      await expect(
        withIdempotency({
          key: 'key-123',
          userId: 'user-1',
          operationType: 'CREATE_PAYMENT',
          payload: { amount: '1000' },
          execute: vi.fn(),
        })
      ).rejects.toThrow(IdempotencyForbiddenError);
    });

    it('AT54: throws IdempotencyConflictError if key matches existing record but payload hash differs', async () => {
      let callCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                // User check: owner
                return Promise.resolve([{ id: 'user-1', role: 'owner' }]);
              }
              // Idempotency check: existing record with different hash
              return Promise.resolve([
                {
                  id: 'rec-1',
                  requestHash: 'different-hash',
                  status: 'completed',
                  responseStatus: 200,
                  responseBody: { old: true },
                },
              ]);
            }),
          }),
        }),
      }));
      (db.select as any) = mockSelect;

      await expect(
        withIdempotency({
          key: 'key-123',
          userId: 'user-1',
          operationType: 'CREATE_PAYMENT',
          payload: { amount: '1000' },
          execute: vi.fn(),
        })
      ).rejects.toThrow(IdempotencyConflictError);
    });

    it('AT13: returns cached response without calling execute if key and payload match', async () => {
      const payload = { amount: '1000' };
      const expectedHash = hashPayload(payload);

      let callCount = 0;
      const mockSelect = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              callCount++;
              if (callCount === 1) {
                return Promise.resolve([{ id: 'user-1', role: 'owner' }]);
              }
              return Promise.resolve([
                {
                  id: 'rec-1',
                  requestHash: expectedHash,
                  status: 'completed',
                  responseStatus: 201,
                  responseBody: { paymentId: 'pay-cached' },
                },
              ]);
            }),
          }),
        }),
      }));
      (db.select as any) = mockSelect;

      const executeMock = vi.fn();

      const result = await withIdempotency({
        key: 'key-123',
        userId: 'user-1',
        operationType: 'CREATE_PAYMENT',
        payload,
        execute: executeMock,
      });

      expect(result.fromCache).toBe(true);
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ paymentId: 'pay-cached' });
      expect(executeMock).not.toHaveBeenCalled();
    });
  });
});
