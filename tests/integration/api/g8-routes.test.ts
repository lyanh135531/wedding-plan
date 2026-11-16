import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Route Handlers
import * as tablesRoute from '@/app/api/v1/tables/route';
import * as tableDetailRoute from '@/app/api/v1/tables/[id]/route';
import * as tableSeatsRoute from '@/app/api/v1/tables/[id]/seats/route';
import * as tableSeatGuestRoute from '@/app/api/v1/tables/[id]/seats/[guestId]/route';
import * as tableExportRoute from '@/app/api/v1/tables/export/route';

import * as menusRoute from '@/app/api/v1/menus/route';
import * as menuDetailRoute from '@/app/api/v1/menus/[id]/route';
import * as menuItemsRoute from '@/app/api/v1/menus/[id]/items/route';
import * as menuItemDetailRoute from '@/app/api/v1/menus/[id]/items/[itemId]/route';
import * as menuSummaryRoute from '@/app/api/v1/menus/summary/route';
import * as menuLockRoute from '@/app/api/v1/menus/[id]/lock/route';

import * as transportRoute from '@/app/api/v1/transport/route';
import * as transportDetailRoute from '@/app/api/v1/transport/[id]/route';
import * as transportPassengersRoute from '@/app/api/v1/transport/[id]/passengers/route';
import * as transportPassengerGuestRoute from '@/app/api/v1/transport/[id]/passengers/[guestId]/route';

import * as accommodationsRoute from '@/app/api/v1/accommodations/route';
import * as accommodationDetailRoute from '@/app/api/v1/accommodations/[id]/route';
import * as accommodationRoomsRoute from '@/app/api/v1/accommodations/[id]/rooms/route';
import * as accommodationRoomDetailRoute from '@/app/api/v1/accommodations/[id]/rooms/[assignmentId]/route';

// Auth & DB
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';
import { createMockG8TxDb, MockG8Store } from '@tests/helpers/g8-mock-db';

let mockTxDb: any;

vi.mock('@/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/client')>();
  return {
    ...actual,
    withTransactionScopedContext: vi.fn(
      async (_userId: string, _role: string, callback: (client: any, db: any) => Promise<any>) => {
        return callback({} as any, mockTxDb);
      }
    ),
  };
});

function createMockSession(role: 'owner' | 'family_view' = 'owner') {
  const userId =
    role === 'owner'
      ? '11111111-1111-4111-8111-111111111111'
      : '33333333-3333-4333-8333-333333333333';
  return {
    user: {
      id: userId,
      name: role === 'owner' ? 'Nguyễn Văn Chú Rể' : 'Bác Ba (Người nhà)',
      email: role === 'owner' ? 'groom@example.com' : 'family@example.com',
      role,
    },
    session: {
      id: `session-${userId}`,
      userId,
      expiresAt: new Date(Date.now() + 86400000),
      token: `token-${userId}`,
    },
    role,
    allowedEventIds: ['00000000-0000-4000-8000-000000000001'],
  };
}

describe('Gate G8 API Route Handlers Integration Tests (M8.3, AT03, AT07, AT21, AT22, AT26, AT30, AT52)', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';
  const tableId = '11111111-1111-4111-8111-111111111111';
  const adultGuest1 = 'aaaaaaaa-1111-4111-8111-444444444444';
  const adultGuest2 = 'aaaaaaaa-2222-4222-8222-444444444444';
  const infantGuest = 'aaaaaaaa-9999-4999-8999-444444444444';
  const menuId = 'bbbbbbbb-1111-4111-8111-444444444444';
  const menuItemId = 'bbbbbbbb-9999-4999-8999-444444444444';
  const tripId = 'cccccccc-1111-4111-8111-444444444444';
  const accommodationId = 'dddddddd-1111-4111-8111-444444444444';
  const roomAssignmentId = 'dddddddd-9999-4999-8999-444444444444';

  beforeEach(() => {
    vi.restoreAllMocks();

    mockTxDb = createMockG8TxDb({
      tables: [
        {
          id: tableId,
          eventId,
          name: 'Bàn VIP 01',
          tableNumber: 'VIP-1',
          shape: 'round',
          capacity: 2,
          notes: 'Ghi chú mật nội bộ của chủ sở hữu',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      seatAssignments: [
        {
          id: 'eeeeeeee-1111-4111-8111-111111111111',
          eventId,
          tableId,
          guestId: adultGuest1,
          seatNumber: 1,
          notes: 'Gần lối đi',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      attendance: [
        {
          eventId,
          guestId: adultGuest1,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          dietaryNotes: 'Không cay',
          mealDietaryTier: 'standard',
        },
        {
          eventId,
          guestId: adultGuest2,
          rsvpStatus: 'accepted',
          needsSeat: true,
          needsMeal: true,
          dietaryNotes: 'Ăn chay',
          mealDietaryTier: 'vegetarian',
        },
        {
          eventId,
          guestId: infantGuest,
          rsvpStatus: 'accepted',
          needsSeat: false, // AT07 infant does not consume seat
          needsMeal: false,
          dietaryNotes: null,
          mealDietaryTier: null,
        },
      ],
      guests: [
        {
          id: adultGuest1,
          displayName: 'Nguyễn Văn Khách 1',
          ageTier: 'adult',
          phone: '0901111111',
          email: 'guest1@example.com',
          privateNotes: 'Ghi chú riêng khách 1',
        },
        {
          id: adultGuest2,
          displayName: 'Trần Thị Khách 2',
          ageTier: 'adult',
          phone: '0902222222',
          email: 'guest2@example.com',
          privateNotes: 'Ghi chú riêng khách 2',
        },
        {
          id: infantGuest,
          displayName: 'Bé Bi (Em bé)',
          ageTier: 'baby',
          phone: null,
          email: null,
          privateNotes: 'Em bé 6 tháng',
        },
      ],
      menus: [
        {
          id: menuId,
          eventId,
          name: 'Thực đơn Tiệc Mặn',
          mealType: 'banquet',
          description: 'Set menu 8 món cao cấp',
          isActive: true,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      menuItems: [
        {
          id: menuItemId,
          menuId,
          eventId,
          courseOrder: 1,
          courseType: 'appetizer',
          name: 'Súp Bào Ngư Vi Cá',
          dietaryFlags: [],
          allergens: 'Hải sản',
          notes: 'Món khai vị',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      guestMealSelections: [
        {
          id: '77777777-1111-4111-8111-111111111111',
          eventId,
          guestId: adultGuest1,
          mealTier: 'standard',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: '77777777-2222-4222-8222-222222222222',
          eventId,
          guestId: adultGuest2,
          mealTier: 'vegetarian',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      transportTrips: [
        {
          id: tripId,
          eventId,
          name: 'Chuyến Shuttle 01',
          vehicleType: 'shuttle_bus',
          capacity: 2,
          driverContact: '0988777666 (Bác Tài)',
          notes: 'Xe Ford Transit 16 chỗ đón ở trung tâm',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      tripPassengers: [
        {
          id: 'ffffffff-1111-4111-8111-111111111111',
          tripId,
          eventId,
          guestId: adultGuest1,
          pickupPoint: 'Nhà Hát Lớn',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      accommodations: [
        {
          id: accommodationId,
          eventId,
          name: 'Khách sạn Rex Hotel',
          locationAddress: '141 Nguyễn Huệ, Q.1',
          totalRooms: 10,
          contactPhone: '02838292185',
          notes: 'Phòng VIP dành cho họ hàng xa',
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      roomAssignments: [
        {
          id: roomAssignmentId,
          accommodationId,
          eventId,
          roomNumber: 'Suite 501',
          guestId: adultGuest1,
          version: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    });
  });

  // =========================================================================
  // 1. Tables & Seating Endpoints
  // =========================================================================
  describe('1. Tables & Seating Endpoints', () => {
    it('GET /api/v1/tables - returns 401 when unauthenticated', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);
      const req = new NextRequest('http://localhost:3000/api/v1/tables?eventId=' + eventId);
      const res = await tablesRoute.GET(req);
      expect(res.status).toBe(401);
    });

    it('GET /api/v1/tables - returns 400 when missing eventId', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables');
      const res = await tablesRoute.GET(req);
      expect(res.status).toBe(400);
    });

    it('GET /api/v1/tables - returns tables with private notes for Owner', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables?eventId=' + eventId);
      const res = await tablesRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].notes).toBe('Ghi chú mật nội bộ của chủ sở hữu');
    });

    it('GET /api/v1/tables - redacts notes (notes: null) for family_view (AT26)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables?eventId=' + eventId);
      const res = await tablesRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data[0].notes).toBeNull();
    });

    it('POST /api/v1/tables - returns 403 Forbidden for family_view (AT03)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          name: 'Bàn Mới',
          capacity: 10,
        }),
      });
      const res = await tablesRoute.POST(req);
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('POST /api/v1/tables - creates table for Owner', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          name: 'Bàn Số 2',
          tableNumber: 'T2',
          capacity: 10,
        }),
      });
      const res = await tablesRoute.POST(req);
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe('Bàn Số 2');
      expect(body.data.capacity).toBe(10);
    });

    it('GET /api/v1/tables/[id] - returns 404 for nonexistent table', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const nonExistent = '99999999-9999-4999-8999-999999999999';
      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + nonExistent);
      const res = await tableDetailRoute.GET(req, { params: { id: nonExistent } });
      expect(res.status).toBe(404);
    });

    it('PATCH /api/v1/tables/[id] - returns 403 for family_view', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + tableId, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Tên Sửa' }),
      });
      const res = await tableDetailRoute.PATCH(req, { params: { id: tableId } });
      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/tables/[id] - returns 409 OPTIMISTIC_LOCK_CONFLICT on stale version (AT30)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + tableId, {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Tên Sửa',
          version: 999, // Stale version
        }),
      });
      const res = await tableDetailRoute.PATCH(req, { params: { id: tableId } });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
    });

    it('PATCH /api/v1/tables/[id] - returns 422 INVALID_CAPACITY_REDUCTION when reducing below seated count (AT22)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      // Table currently has 1 adult seated. Attempting to reduce capacity to 0 (or below occupied)
      // Since schema enforces positive capacity (> 0), let's seat a second adult first so occupied = 2
      mockTxDb._store.seatAssignments.push({
        id: 'eeeeeeee-2222-4222-8222-222222222222',
        eventId,
        tableId,
        guestId: adultGuest2,
        seatNumber: 2,
        version: 1,
      });

      // Now occupied = 2. Reducing capacity to 1 is invalid!
      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + tableId, {
        method: 'PATCH',
        body: JSON.stringify({
          capacity: 1,
          version: 1,
        }),
      });
      const res = await tableDetailRoute.PATCH(req, { params: { id: tableId } });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe('INVALID_CAPACITY_REDUCTION');
      expect(body.currentAssigned).toBe(2);
      expect(body.requestedCapacity).toBe(1);
    });

    it('PATCH /api/v1/tables/[id] - successfully updates table for owner', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + tableId, {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Bàn VIP 01 Cập Nhật',
          capacity: 12,
          version: 1,
        }),
      });
      const res = await tableDetailRoute.PATCH(req, { params: { id: tableId } });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.name).toBe('Bàn VIP 01 Cập Nhật');
      expect(body.data.capacity).toBe(12);
      expect(body.data.version).toBe(2);
    });

    it('DELETE /api/v1/tables/[id] - returns 403 for family_view', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + tableId, {
        method: 'DELETE',
      });
      const res = await tableDetailRoute.DELETE(req, { params: { id: tableId } });
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/tables/[id]/seats - rejects seating when table capacity is exceeded (AT21)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      // Table capacity is 2. Adult 1 is already seated.
      // Seat adult 2 (table becomes 2/2 full):
      mockTxDb._store.seatAssignments.push({
        id: 'eeeeeeee-2222-4222-8222-222222222222',
        eventId,
        tableId,
        guestId: adultGuest2,
        seatNumber: 2,
        version: 1,
      });

      // Attempt to seat another adult guest 3:
      const thirdAdult = 'aaaaaaaa-3333-4333-8333-444444444444';
      mockTxDb._store.attendance.push({
        eventId,
        guestId: thirdAdult,
        rsvpStatus: 'accepted',
        needsSeat: true,
      });
      mockTxDb._store.guests.push({
        id: thirdAdult,
        displayName: 'Khách 3',
        ageTier: 'adult',
      });

      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + tableId + '/seats', {
        method: 'POST',
        body: JSON.stringify({
          guestId: thirdAdult,
        }),
      });
      const res = await tableSeatsRoute.POST(req, { params: { id: tableId } });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('CAPACITY_EXCEEDED');
    });

    it('POST /api/v1/tables/[id]/seats - allows baby/infant (needsSeat=false) even when table is full (AT07)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      // Table capacity is 2. Seat adult 2 so table is 2/2 full:
      mockTxDb._store.seatAssignments.push({
        id: 'eeeeeeee-2222-4222-8222-222222222222',
        eventId,
        tableId,
        guestId: adultGuest2,
        seatNumber: 2,
        version: 1,
      });

      // Infant does not need a seat (AT07)
      const req = new NextRequest('http://localhost:3000/api/v1/tables/' + tableId + '/seats', {
        method: 'POST',
        body: JSON.stringify({
          guestId: infantGuest,
        }),
      });
      const res = await tableSeatsRoute.POST(req, { params: { id: tableId } });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.guestId).toBe(infantGuest);
    });

    it('DELETE /api/v1/tables/[id]/seats/[guestId] - unassigns guest from table', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest(
        `http://localhost:3000/api/v1/tables/${tableId}/seats/${adultGuest1}`,
        { method: 'DELETE' }
      );
      const res = await tableSeatGuestRoute.DELETE(req, {
        params: { id: tableId, guestId: adultGuest1 },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });

    it('GET /api/v1/tables/export - redacts all private notes and contact info for family_view (AT26)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/tables/export?eventId=' + eventId);
      const res = await tableExportRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.role).toBe('family_view');
      const table = body.data.tables[0];
      expect(table.notes).toBeNull();
      const guest = table.guests[0];
      expect(guest.phone).toBeNull();
      expect(guest.email).toBeNull();
      expect(guest.privateNotes).toBeNull();
    });
  });

  // =========================================================================
  // 2. Menus & Catering Endpoints
  // =========================================================================
  describe('2. Menus & Catering Endpoints', () => {
    it('GET /api/v1/menus - lists menus for event', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/menus?eventId=' + eventId);
      const res = await menusRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Thực đơn Tiệc Mặn');
    });

    it('POST /api/v1/menus - returns 403 for family_view', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/menus', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          name: 'Thực đơn Mới',
        }),
      });
      const res = await menusRoute.POST(req);
      expect(res.status).toBe(403);
    });

    it('PATCH /api/v1/menus/[id] - returns 409 OPTIMISTIC_LOCK_CONFLICT on version mismatch', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/menus/' + menuId, {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Sửa Tên Menu',
          version: 999,
        }),
      });
      const res = await menuDetailRoute.PATCH(req, { params: { id: menuId } });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('OPTIMISTIC_LOCK_CONFLICT');
    });

    it('POST /api/v1/menus/[id]/items - adds menu item', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest(`http://localhost:3000/api/v1/menus/${menuId}/items`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'Gà Hấp Lá Chanh',
          courseType: 'main',
          courseOrder: 2,
        }),
      });
      const res = await menuItemsRoute.POST(req, { params: { id: menuId } });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe('Gà Hấp Lá Chanh');
    });

    it('GET /api/v1/menus/summary - calculates exact meal counts against confirmed RSVP', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest(
        `http://localhost:3000/api/v1/menus/summary?eventId=${eventId}&bufferPercentage=10`
      );
      const res = await menuSummaryRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.eventId).toBe(eventId);
      expect(body.data.adultMeals).toBe(1);
      expect(body.data.vegetarianMeals).toBe(1);
      expect(body.data.confirmedMeals).toBe(2);
      expect(body.data.bufferMeals).toBe(1); // ceil(2 * 10%) = 1
      expect(body.data.totalMeals).toBe(3);
    });

    it('POST /api/v1/menus/[id]/lock - freezes snapshot with catering breakdown (AT52)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest(`http://localhost:3000/api/v1/menus/${menuId}/lock`, {
        method: 'POST',
        body: JSON.stringify({
          bufferPercentage: 10,
          notes: 'Chốt số lượng chính thức với nhà hàng',
        }),
      });
      const res = await menuLockRoute.POST(req, { params: { id: menuId } });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.isLocked).toBe(true);
      expect(body.data.totalMeals).toBe(3);
      expect(body.data.lockedBy).toBe(createMockSession('owner').user.id);
    });
  });

  // =========================================================================
  // 3. Transport & Logistics Endpoints
  // =========================================================================
  describe('3. Transport & Logistics Endpoints', () => {
    it('GET /api/v1/transport - returns trips list', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/transport?eventId=' + eventId);
      const res = await transportRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].driverContact).toBe('0988777666 (Bác Tài)');
    });

    it('GET /api/v1/transport - redacts driver contact and notes for family_view (AT26)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/transport?eventId=' + eventId);
      const res = await transportRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data[0].driverContact).toBeNull();
      expect(body.data[0].notes).toBeNull();
    });

    it('PATCH /api/v1/transport/[id] - returns 422 INVALID_CAPACITY_REDUCTION when reducing below passenger count (AT22)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      // Trip has 1 passenger assigned. Capacity reduction to 0 is invalid!
      // Seat another passenger so passenger count = 2
      mockTxDb._store.tripPassengers.push({
        id: 'ffffffff-2222-4222-8222-222222222222',
        tripId,
        eventId,
        guestId: adultGuest2,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const req = new NextRequest('http://localhost:3000/api/v1/transport/' + tripId, {
        method: 'PATCH',
        body: JSON.stringify({
          capacity: 1, // < 2 assigned passengers
          version: 1,
        }),
      });
      const res = await transportDetailRoute.PATCH(req, { params: { id: tripId } });
      expect(res.status).toBe(422);
      const body = await res.json();
      expect(body.error).toBe('INVALID_CAPACITY_REDUCTION');
      expect(body.currentAssigned).toBe(2);
      expect(body.requestedCapacity).toBe(1);
    });

    it('POST /api/v1/transport/[id]/passengers - rejects when vehicle capacity is reached (AT21)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      // Capacity is 2. Passenger 1 is already assigned. Add passenger 2:
      mockTxDb._store.tripPassengers.push({
        id: 'ffffffff-2222-4222-8222-222222222222',
        tripId,
        eventId,
        guestId: adultGuest2,
        version: 1,
      });

      // Now vehicle is 2/2 full. Assigning passenger 3 fails:
      const req = new NextRequest(`http://localhost:3000/api/v1/transport/${tripId}/passengers`, {
        method: 'POST',
        body: JSON.stringify({
          guestId: infantGuest,
        }),
      });
      const res = await transportPassengersRoute.POST(req, { params: { id: tripId } });
      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('CAPACITY_EXCEEDED');
    });

    it('DELETE /api/v1/transport/[id]/passengers/[guestId] - unassigns passenger', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest(
        `http://localhost:3000/api/v1/transport/${tripId}/passengers/${adultGuest1}`,
        { method: 'DELETE' }
      );
      const res = await transportPassengerGuestRoute.DELETE(req, {
        params: { id: tripId, guestId: adultGuest1 },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  // =========================================================================
  // 4. Accommodations Endpoints
  // =========================================================================
  describe('4. Accommodations Endpoints', () => {
    it('GET /api/v1/accommodations - returns list (redacting phone/notes for family_view)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/accommodations?eventId=' + eventId);
      const res = await accommodationsRoute.GET(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data[0].contactPhone).toBeNull();
      expect(body.data[0].notes).toBeNull();
    });

    it('POST /api/v1/accommodations - returns 403 for family_view', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const req = new NextRequest('http://localhost:3000/api/v1/accommodations', {
        method: 'POST',
        body: JSON.stringify({
          eventId,
          name: 'Khách sạn Caravelle',
        }),
      });
      const res = await accommodationsRoute.POST(req);
      expect(res.status).toBe(403);
    });

    it('POST /api/v1/accommodations/[id]/rooms - assigns room to guest', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest(`http://localhost:3000/api/v1/accommodations/${accommodationId}/rooms`, {
        method: 'POST',
        body: JSON.stringify({
          roomNumber: 'Room 602',
          guestId: adultGuest2,
        }),
      });
      const res = await accommodationRoomsRoute.POST(req, { params: { id: accommodationId } });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.roomNumber).toBe('Room 602');
      expect(body.data.guestId).toBe(adultGuest2);
    });

    it('DELETE /api/v1/accommodations/[id]/rooms/[assignmentId] - unassigns room', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
      const req = new NextRequest(
        `http://localhost:3000/api/v1/accommodations/${accommodationId}/rooms/${roomAssignmentId}`,
        { method: 'DELETE' }
      );
      const res = await accommodationRoomDetailRoute.DELETE(req, {
        params: { id: accommodationId, assignmentId: roomAssignmentId },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });
});
