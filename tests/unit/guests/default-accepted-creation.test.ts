import { describe, it, expect, vi } from 'vitest';
import { createGuestSchema } from '@/schemas/guests';
import { createGuest } from '@/lib/guests/guests.repository';
import * as schema from '@/db/schema';

const EVENT_ID = '00000000-0000-4000-8000-000000000011';

function buildMockTxDb(ageTier: 'adult' | 'child' | 'baby' = 'adult') {
  const now = new Date();
  const inserted: { invitations: any[]; invitationMembers: any[]; attendance: any[] } = {
    invitations: [],
    invitationMembers: [],
    attendance: [],
  };

  const guestRow = {
    id: '00000000-0000-4000-8000-000000000999',
    displayName: 'Khách Mặc Định',
    side: 'groom' as const,
    groupId: null,
    subTags: [],
    ageTier,
    phone: null,
    email: null,
    address: null,
    privateNotes: null,
    isArchived: false,
    archivedAt: null,
    isPlaceholder: false,
    placeholderFor: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  const txDb: any = {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table) => {
        if (table === schema.events) {
          return {
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([{ id: EVENT_ID }]),
            }),
          };
        }
        return { where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }) };
      }),
    })),
    insert: vi.fn().mockImplementation((table) => ({
      values: vi.fn().mockImplementation((val) => {
        if (table === schema.guests) {
          return { returning: vi.fn().mockResolvedValue([guestRow]) };
        }
        if (table === schema.invitations) {
          inserted.invitations.push(val);
          return {
            returning: vi.fn().mockResolvedValue([
              { id: '00000000-0000-4000-8000-000000000888', ...val },
            ]),
          };
        }
        if (table === schema.invitationMembers) {
          inserted.invitationMembers.push(val);
        }
        if (table === schema.attendance) {
          inserted.attendance.push(val);
        }
        return Promise.resolve();
      }),
    })),
  };

  return { txDb, inserted, guestRow };
}

describe('createGuest default accepted attendance behavior', () => {
  it('validates createGuestSchema with and without optional event_id', () => {
    expect(
      createGuestSchema.safeParse({ display_name: 'Anh Minh', side: 'groom' }).success
    ).toBe(true);
    expect(
      createGuestSchema.safeParse({
        display_name: 'Anh Minh',
        side: 'groom',
        event_id: EVENT_ID,
        initial_rsvp_status: 'accepted',
      }).success
    ).toBe(true);
  });

  it('keeps backward compatibility when event_id is omitted', async () => {
    const { txDb, inserted } = buildMockTxDb('adult');
    const created = await createGuest(
      txDb,
      createGuestSchema.parse({ display_name: 'Khách Mặc Định', side: 'groom' }),
      'user-1'
    );

    expect(created.display_name).toBe('Khách Mặc Định');
    expect(inserted.invitations).toHaveLength(0);
    expect(inserted.invitationMembers).toHaveLength(0);
    expect(inserted.attendance).toHaveLength(0);
  });

  it('auto-creates invitation and accepted attendance for adult when event_id is supplied', async () => {
    const { txDb, inserted } = buildMockTxDb('adult');
    await createGuest(
      txDb,
      createGuestSchema.parse({
        display_name: 'Khách Mặc Định',
        side: 'groom',
        event_id: EVENT_ID,
      }),
      'user-1'
    );

    expect(inserted.invitations).toHaveLength(1);
    expect(inserted.invitationMembers).toHaveLength(1);
    expect(inserted.attendance).toHaveLength(1);
    expect(inserted.attendance[0]).toMatchObject({
      eventId: EVENT_ID,
      rsvpStatus: 'accepted',
      needsSeat: true,
      needsMeal: true,
      mealDietaryTier: 'regular',
    });
  });

  it('respects baby and child seat/meal policies when auto-creating accepted attendance', async () => {
    const baby = buildMockTxDb('baby');
    await createGuest(
      baby.txDb,
      createGuestSchema.parse({
        display_name: 'Bé Bông',
        age_tier: 'baby',
        event_id: EVENT_ID,
        initial_rsvp_status: 'accepted',
      }),
      'user-1'
    );
    expect(baby.inserted.attendance[0]).toMatchObject({
      rsvpStatus: 'accepted',
      needsSeat: false,
      needsMeal: false,
    });

    const child = buildMockTxDb('child');
    await createGuest(
      child.txDb,
      createGuestSchema.parse({
        display_name: 'Bé Na',
        age_tier: 'child',
        event_id: EVENT_ID,
        initial_rsvp_status: 'accepted',
      }),
      'user-1'
    );
    expect(child.inserted.attendance[0]).toMatchObject({
      rsvpStatus: 'accepted',
      needsSeat: true,
      needsMeal: true,
      mealDietaryTier: 'child_portion',
    });
  });
});
