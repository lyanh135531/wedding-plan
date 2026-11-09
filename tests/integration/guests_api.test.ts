import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as sessionModule from '@/lib/auth/session';
import * as dbClient from '@/db/client';
import * as guestsRoute from '@/app/api/v1/guests/route';
import * as householdRoute from '@/app/api/v1/guests/household/route';
import * as attendanceRoute from '@/app/api/v1/attendance/route';
import * as summaryRoute from '@/app/api/v1/attendance/summary/route';
import * as duplicatesRoute from '@/app/api/v1/duplicate-candidates/route';
import * as mergeRoute from '@/app/api/v1/merge/route';
import { FX01_FAMILY_GROUP } from '@tests/fixtures/fx01-family';

describe('Gate G3 Guests API Endpoints Integration Test Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const ownerSession = {
    user: { id: 'owner_user_uuid', email: 'owner@wedding.local', name: 'Owner' },
    role: 'owner' as const,
    allowedEventIds: ['e0000000-0000-4000-8000-000000000001', 'e0000000-0000-4000-8000-000000000002'],
    session: { id: 'session_1', createdAt: new Date(), updatedAt: new Date(), userId: 'owner_user_uuid', expiresAt: new Date(Date.now() + 86400000), token: 'token' },
  };

  const familySession = {
    user: { id: 'family_user_uuid', email: 'family@wedding.local', name: 'Family' },
    role: 'family_view' as const,
    allowedEventIds: ['e0000000-0000-4000-8000-000000000001'], // Only morning ceremony
    session: { id: 'session_2', createdAt: new Date(), updatedAt: new Date(), userId: 'family_user_uuid', expiresAt: new Date(Date.now() + 86400000), token: 'token' },
  };

  describe('1. GET & POST /api/v1/guests', () => {
    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/guests');
      const res = await guestsRoute.GET(req);
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('returns full guest DTOs for Owner including private notes, phone, and email', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, callback) => {
          return [
            {
              id: FX01_FAMILY_GROUP.guests.father.id,
              display_name: FX01_FAMILY_GROUP.guests.father.displayName,
              side: 'groom',
              group_id: FX01_FAMILY_GROUP.guestGroup.id,
              sub_tags: ['Họ nội', 'Trưởng họ'],
              age_tier: 'adult',
              phone: '0901234567',
              email: 'bacba@example.com',
              address: '12 Võ Văn Tần',
              private_notes: 'Uống trà nóng',
              is_archived: false,
              is_placeholder: false,
              version: 1,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ];
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/guests');
      const res = await guestsRoute.GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      const guest = body.data[0];
      expect(guest.phone).toBe('0901234567');
      expect(guest.email).toBe('bacba@example.com');
      expect(guest.private_notes).toBe('Uống trà nóng');
    });

    it('blocks Family View from calling POST /api/v1/guests with 403 FORBIDDEN', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: 'Khách Mới' }),
      });
      const res = await guestsRoute.POST(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('Owner role required');
    });

    it('validates required fields on POST /api/v1/guests and returns 400 on empty name', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: '   ' }), // Empty name
      });
      const res = await guestsRoute.POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('successfully creates guest for Owner on POST /api/v1/guests', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            id: '10000000-0000-4000-8000-000000000099',
            display_name: 'Nguyễn Văn Mới',
            side: 'groom',
            group_id: null,
            sub_tags: [],
            age_tier: 'adult',
            phone: '0901234567',
            email: null,
            address: null,
            private_notes: null,
            is_archived: false,
            is_placeholder: false,
            version: 1,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/guests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: 'Nguyễn Văn Mới',
          side: 'groom',
          phone: '0901234567',
        }),
      });
      const res = await guestsRoute.POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.display_name).toBe('Nguyễn Văn Mới');
    });
  });

  describe('2. POST /api/v1/guests/household', () => {
    it('blocks Family View with 403 FORBIDDEN', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/guests/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: 'Gia đình Bác Ba',
          eventId: 'e0000000-0000-4000-8000-000000000001',
          members: [{ displayName: 'Bác Ba' }],
        }),
      });
      const res = await householdRoute.POST(req);
      expect(res.status).toBe(403);
    });

    it('returns 400 when members list is empty', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/guests/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: 'Gia đình Rỗng',
          eventId: 'e0000000-0000-4000-8000-000000000001',
          members: [],
        }),
      });
      const res = await householdRoute.POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('creates 1 card and multiple members atomically in transaction', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            groupId: FX01_FAMILY_GROUP.guestGroup.id,
            groupName: 'Gia đình Bác Ba & Các Cháu',
            invitation: FX01_FAMILY_GROUP.invitation,
            guests: Object.values(FX01_FAMILY_GROUP.guests),
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/guests/household', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupName: 'Gia đình Bác Ba & Các Cháu',
          eventId: 'e0000000-0000-4000-8000-000000000002',
          side: 'groom',
          members: [
            { displayName: 'Nguyễn Văn Ba', ageTier: 'adult', isRepresentative: true },
            { displayName: 'Trần Thị Mẹ', ageTier: 'adult' },
            { displayName: 'Bé Bi', ageTier: 'child' },
            { displayName: 'Bé Bông', ageTier: 'baby' },
          ],
        }),
      });

      const res = await householdRoute.POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.guests).toHaveLength(4);
      expect(body.data.invitation.cardName).toBe('Gia đình Bác Ba & Các Cháu');
    });
  });

  describe('3. GET & PATCH /api/v1/attendance and GET /api/v1/attendance/summary', () => {
    it('returns attendance list and event headcount summary for valid event', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return FX01_FAMILY_GROUP.expectedEveningAggregations;
        }
      );

      const req = new NextRequest(
        'http://localhost:3000/api/v1/attendance/summary?eventId=e0000000-0000-4000-8000-000000000002'
      );
      const res = await summaryRoute.GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data.totalInvited).toBe(4);
      expect(body.data.confirmedSeats).toBe(3);
    });

    it('blocks Family View from viewing summary of an unshared event (403 FORBIDDEN)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      // Family session only has access to morning ceremony '...0001', not evening '...0002'
      const req = new NextRequest(
        'http://localhost:3000/api/v1/attendance/summary?eventId=e0000000-0000-4000-8000-000000000002'
      );
      const res = await summaryRoute.GET(req);
      expect(res.status).toBe(403);
    });

    it('blocks Family View from PATCH /api/v1/attendance with 403 FORBIDDEN', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/attendance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guest_id: FX01_FAMILY_GROUP.guests.father.id,
          event_id: FX01_FAMILY_GROUP.events.morningCeremony.id,
          rsvp_status: 'declined',
          needs_seat: false,
          needs_meal: false,
          meal_dietary_tier: 'regular',
          accommodation_needed: false,
          transport_needed: false,
          version: 1,
        }),
      });
      const res = await attendanceRoute.PATCH(req);
      expect(res.status).toBe(403);
    });
  });

  describe('4. GET /api/v1/duplicate-candidates and POST /api/v1/merge', () => {
    it('blocks Family View from GET /api/v1/duplicate-candidates with 403', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/duplicate-candidates');
      const res = await duplicatesRoute.GET(req);
      expect(res.status).toBe(403);
    });

    it('returns duplicate candidate list for Owner', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return [
            {
              guest_a: FX01_FAMILY_GROUP.guests.father,
              guest_b: { ...FX01_FAMILY_GROUP.guests.father, id: '10000000-0000-4000-8000-000000000088' },
              match_reasons: ['Trùng tên chuẩn hóa và số điện thoại'],
              similarity_score: 0.95,
            },
          ];
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/duplicate-candidates');
      const res = await duplicatesRoute.GET(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].similarity_score).toBe(0.95);
    });

    it('blocks self-merge on POST /api/v1/merge with 400 VALIDATION_ERROR', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const id = '10000000-0000-4000-8000-000000000001';
      const req = new NextRequest('http://localhost:3000/api/v1/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retained_guest_id: id,
          merged_guest_id: id, // Self merge
        }),
      });

      const res = await mergeRoute.POST(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('successfully executes merge for Owner on POST /api/v1/merge', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(dbClient, 'withTransactionScopedContext').mockImplementation(
        async (_userId, _role, _callback) => {
          return {
            success: true,
            retainedGuest: {
              ...FX01_FAMILY_GROUP.guests.father,
              phone: '0901234567',
              sub_tags: ['Họ nội', 'Bác ruột', 'Trưởng họ', 'Bạn bè'],
            },
            mergedGuestId: '10000000-0000-4000-8000-000000000088',
          };
        }
      );

      const req = new NextRequest('http://localhost:3000/api/v1/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          retained_guest_id: '10000000-0000-4000-8000-000000000001',
          merged_guest_id: '10000000-0000-4000-8000-000000000088',
          resolved_phone: '0901234567',
        }),
      });

      const res = await mergeRoute.POST(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.success).toBe(true);
      expect(body.data.retainedGuest.phone).toBe('0901234567');
    });
  });
});
