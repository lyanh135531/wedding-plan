import { describe, it, expect, vi } from 'vitest';
import { deleteGuest } from '@/lib/guests/guests.repository';
import * as schema from '@/db/schema';

const GUEST_A = '00000000-0000-4000-8000-000000000101';
const GUEST_B = '00000000-0000-4000-8000-000000000102';
const INV_1 = '00000000-0000-4000-8000-000000000201';
const USER_ID = '00000000-0000-4000-8000-000000000001';

describe('deleteGuest permanent hard delete', () => {
  it('returns false when the guest does not exist', async () => {
    const txDb: any = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      }),
    };

    const result = await deleteGuest(txDb, GUEST_A, USER_ID);
    expect(result).toBe(false);
  });

  it('deletes a solo guest along with its empty invitation card and logs DELETE audit', async () => {
    const guestRow = { id: GUEST_A, displayName: 'Khách Đơn', version: 1 };
    const deletedTables: unknown[] = [];
    const insertedAudits: any[] = [];
    let invSelectCount = 0;
    let memberSelectCount = 0;

    const txDb: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => ({
          where: vi.fn().mockImplementation(() => {
            if (table === schema.guests) return Promise.resolve([guestRow]);
            if (table === schema.invitationMembers) {
              memberSelectCount++;
              // 1st call: guest's memberships; 2nd call: remaining members on INV_1 -> none
              return Promise.resolve(memberSelectCount === 1 ? [{ invitationId: INV_1 }] : []);
            }
            if (table === schema.invitations) {
              invSelectCount++;
              return Promise.resolve([{ id: INV_1, version: 1, representativeGuestId: GUEST_A }]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
      delete: vi.fn().mockImplementation((table) => ({
        where: vi.fn().mockImplementation(() => {
          deletedTables.push(table);
          return Promise.resolve();
        }),
      })),
      update: vi.fn(),
      insert: vi.fn().mockImplementation((table) => ({
        values: vi.fn().mockImplementation((val) => {
          if (table === schema.auditLogs) insertedAudits.push(val);
          return Promise.resolve();
        }),
      })),
    };

    const result = await deleteGuest(txDb, GUEST_A, USER_ID);
    expect(result).toBe(true);
    expect(deletedTables).toEqual([schema.invitationMembers, schema.invitations, schema.guests]);
    expect(txDb.update).not.toHaveBeenCalled();
    expect(invSelectCount).toBe(2);
    expect(insertedAudits).toHaveLength(1);
    expect(insertedAudits[0]).toMatchObject({
      userId: USER_ID,
      action: 'DELETE',
      entityType: 'guest',
      entityId: GUEST_A,
      beforeState: guestRow,
      afterState: null,
    });
  });

  it('reassigns representativeGuestId to another household member before deleting representative', async () => {
    const guestRow = { id: GUEST_A, displayName: 'Tư', version: 1 };
    const deletedTables: unknown[] = [];
    const updates: any[] = [];
    let memberSelectCount = 0;

    const txDb: any = {
      select: vi.fn().mockImplementation(() => ({
        from: vi.fn().mockImplementation((table) => ({
          where: vi.fn().mockImplementation(() => {
            if (table === schema.guests) return Promise.resolve([guestRow]);
            if (table === schema.invitationMembers) {
              memberSelectCount++;
              return Promise.resolve(
                memberSelectCount === 1 ? [{ invitationId: INV_1 }] : [{ guestId: GUEST_B }]
              );
            }
            if (table === schema.invitations) {
              return Promise.resolve([{ id: INV_1, version: 2, representativeGuestId: GUEST_A }]);
            }
            return Promise.resolve([]);
          }),
        })),
      })),
      delete: vi.fn().mockImplementation((table) => ({
        where: vi.fn().mockImplementation(() => {
          deletedTables.push(table);
          return Promise.resolve();
        }),
      })),
      update: vi.fn().mockImplementation((table) => ({
        set: vi.fn().mockImplementation((payload) => ({
          where: vi.fn().mockImplementation(() => {
            if (table === schema.invitations) updates.push(payload);
            return Promise.resolve();
          }),
        })),
      })),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    };

    const result = await deleteGuest(txDb, GUEST_A, USER_ID);
    expect(result).toBe(true);
    expect(deletedTables).toEqual([schema.invitationMembers, schema.guests]);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      representativeGuestId: GUEST_B,
      version: 3,
    });
  });
});
