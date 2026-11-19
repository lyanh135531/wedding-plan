import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Route Handlers
import * as timelineRoute from '@/app/api/v1/timeline/route';
import * as timelineDetailRoute from '@/app/api/v1/timeline/[id]/route';
import * as timelineActualRoute from '@/app/api/v1/timeline/[id]/actual/route';
import * as timelineShiftRoute from '@/app/api/v1/timeline/shift/route';
import * as timelineTodayRoute from '@/app/api/v1/timeline/today/route';

import * as checkInRoute from '@/app/api/v1/attendance/check-in/route';
import * as checkInUndoRoute from '@/app/api/v1/attendance/check-in/undo/route';
import * as walkInRoute from '@/app/api/v1/attendance/walk-in/route';
import * as attendanceToggleRoute from '@/app/api/v1/attendance/toggle/route';

import * as giftsRoute from '@/app/api/v1/gifts/route';
import * as giftDetailRoute from '@/app/api/v1/gifts/[id]/route';
import * as giftReturnsRoute from '@/app/api/v1/gifts/[id]/returns/route';
import * as giftVoidRoute from '@/app/api/v1/gifts/[id]/void/route';
import * as giftThankRoute from '@/app/api/v1/gifts/[id]/thank/route';
import * as giftReconcileRoute from '@/app/api/v1/gifts/reconcile/route';

import * as handoverPacketRoute from '@/app/api/v1/handovers/packet/route';
import * as handoverSnapshotsRoute from '@/app/api/v1/handovers/snapshots/route';
import * as handoverDiffRoute from '@/app/api/v1/handovers/snapshots/[id]/diff/route';
import * as handoverDeliverRoute from '@/app/api/v1/handovers/snapshots/[id]/deliver/route';

import * as archivalChecklistRoute from '@/app/api/v1/archival/checklist/route';
import * as archivalFreezeRoute from '@/app/api/v1/archival/freeze/route';
import * as archivalUnarchiveRoute from '@/app/api/v1/archival/unarchive/route';

// Auth & DB
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';
import { createMockG10TxDb } from '@tests/helpers/g10-mock-db';

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
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    role,
    allowedEventIds: ['00000000-0000-4000-8000-000000000001'],
  };
}

describe('Gate G10 API Integration Routes Suite', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';
  const guest1Id = '00000000-0000-4000-8000-000000000010';

  beforeEach(() => {
    mockTxDb = createMockG10TxDb({
      events: [{ id: eventId, isCheckInEnabled: true }],
      weddingSettings: [
        {
          id: '00000000-0000-4000-8000-000000000099',
          brideName: 'Cô Dâu',
          groomName: 'Chú Rể',
          isArchived: false,
        },
      ],
      guests: [
        { id: guest1Id, displayName: 'Đặng Tuấn Anh', phone: '0909090909' },
      ],
      attendance: [
        {
          eventId,
          guestId: guest1Id,
          rsvpStatus: 'accepted',
          isCheckedIn: false,
          version: 1,
        },
      ],
    });
  });

  describe('1. Timeline API Endpoints', () => {
    it('creates, lists, and marks actual time on timeline items (AT34)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);

      // POST create
      const createReq = new NextRequest('http://localhost:3000/api/v1/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Nghi thức cắt bánh cưới',
          scheduledStartTime: '2028-11-20T19:00:00Z',
          scheduledEndTime: '2028-11-20T19:30:00Z',
          locationName: 'Sân khấu chính',
        }),
      });
      const createRes = await timelineRoute.POST(createReq);
      expect(createRes.status).toBe(201);
      const createdData = (await createRes.json()).data;
      const itemId = createdData.id;

      // GET list
      const listReq = new NextRequest(`http://localhost:3000/api/v1/timeline?eventId=${eventId}`);
      const listRes = await timelineRoute.GET(listReq);
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()).data;
      expect(listData.length).toBe(1);

      // POST actual times (AT34)
      const actualReq = new NextRequest(`http://localhost:3000/api/v1/timeline/${itemId}/actual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actualStartTime: '2028-11-20T19:10:00Z',
          version: 1,
        }),
      });
      const actualRes = await timelineActualRoute.POST(actualReq, { params: Promise.resolve({ id: itemId }) });
      expect(actualRes.status).toBe(200);
      const actualData = (await actualRes.json()).data;
      // Invariant: scheduled times must stay intact!
      expect(actualData.scheduledStartTime).toBe(new Date('2028-11-20T19:00:00Z').toISOString());
      expect(actualData.actualStartTime).toBe(new Date('2028-11-20T19:10:00Z').toISOString());
      expect(actualData.status).toBe('in_progress');
    });

    it('previews and applies delay shift via /shift endpoint', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);

      mockTxDb._store.timelineItems.push({
        id: 'tl-10',
        eventId,
        title: 'Chụp hình kỷ niệm',
        scheduledStartTime: new Date('2028-11-20T20:00:00Z'),
        scheduledEndTime: new Date('2028-11-20T20:30:00Z'),
        status: 'not_started',
        version: 1,
      });

      // Preview shift +20 mins
      const previewReq = new NextRequest('http://localhost:3000/api/v1/timeline/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          delayMinutes: 20,
        }),
      });
      const previewRes = await timelineShiftRoute.POST(previewReq);
      expect(previewRes.status).toBe(200);
      const previewData = (await previewRes.json()).data;
      expect(previewData.affectedCount).toBe(1);

      // Apply shift +20 mins
      const applyReq = new NextRequest('http://localhost:3000/api/v1/timeline/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          delayMinutes: 20,
          confirmed: true,
        }),
      });
      const applyRes = await timelineShiftRoute.POST(applyReq);
      expect(applyRes.status).toBe(200);

      const shiftedItem = mockTxDb._store.timelineItems[0];
      expect(shiftedItem.scheduledStartTime.toISOString()).toBe(new Date('2028-11-20T20:20:00Z').toISOString());
    });
  });

  describe('2. Attendance API Endpoints', () => {
    it('searches, checks in, and undos attendance check-in', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);

      // Search
      const searchReq = new NextRequest(`http://localhost:3000/api/v1/attendance/check-in?eventId=${eventId}&q=Dang`);
      const searchRes = await checkInRoute.GET(searchReq);
      expect(searchRes.status).toBe(200);
      const searchList = (await searchRes.json()).data;
      expect(searchList.length).toBe(1);
      expect(searchList[0].fullName).toBe('Đặng Tuấn Anh');

      // Check-in
      const checkInReq = new NextRequest('http://localhost:3000/api/v1/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestId: guest1Id,
          checkInNotes: 'Đến đúng giờ',
        }),
      });
      const checkInRes = await checkInRoute.POST(checkInReq);
      expect(checkInRes.status).toBe(200);
      const checkedData = (await checkInRes.json()).data;
      expect(checkedData.isCheckedIn).toBe(true);

      // Undo check-in
      const undoReq = new NextRequest('http://localhost:3000/api/v1/attendance/check-in/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestId: guest1Id,
          undoReason: 'Nhầm lẫn',
        }),
      });
      const undoRes = await checkInUndoRoute.POST(undoReq);
      expect(undoRes.status).toBe(200);
      const undoneData = (await undoRes.json()).data;
      expect(undoneData.isCheckedIn).toBe(false);
    });

    it('creates walk-in guest and sets isOriginOnsite: true', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);

      const walkInReq = new NextRequest('http://localhost:3000/api/v1/attendance/walk-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          fullName: 'Khách Phát Sinh A',
          phone: '0911223344',
        }),
      });
      const walkInRes = await walkInRoute.POST(walkInReq);
      expect(walkInRes.status).toBe(201);
      const walkInData = (await walkInRes.json()).data;
      expect(walkInData.isOriginOnsite).toBe(true);
      expect(walkInData.isCheckedIn).toBe(true);
    });
  });

  describe('3. Gifts API Endpoints & Family View Barrier (AT03, AT25)', () => {
    it('strictly returns 403 Forbidden when family_view attempts to access gifts (AT03, AT25)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);

      // GET gifts as family_view
      const getReq = new NextRequest(`http://localhost:3000/api/v1/gifts?eventId=${eventId}`);
      const getRes = await giftsRoute.GET(getReq);
      expect(getRes.status).toBe(403);

      // POST gift as family_view
      const postReq = new NextRequest('http://localhost:3000/api/v1/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          giftType: 'cash',
          amount: '1000000',
          contributors: [{ contributorName: 'Người gửi' }],
        }),
      });
      const postRes = await giftsRoute.POST(postReq);
      expect(postRes.status).toBe(403);
    });

    it('allows owner to record gifts, returns, and reconcile safe cash', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);

      // Record gift
      const postReq = new NextRequest('http://localhost:3000/api/v1/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          giftType: 'cash',
          amount: '5000000',
          contributors: [{ contributorName: 'Bác Năm' }],
        }),
      });
      const postRes = await giftsRoute.POST(postReq);
      expect(postRes.status).toBe(201);
      const giftId = (await postRes.json()).data.id;

      // Record partial return
      const returnReq = new NextRequest(`http://localhost:3000/api/v1/gifts/${giftId}/returns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: '1000000',
          returnReason: 'Hoàn lại 1 phần',
        }),
      });
      const returnRes = await giftReturnsRoute.POST(returnReq, { params: Promise.resolve({ id: giftId }) });
      expect(returnRes.status).toBe(200);

      // Reconcile safe cash
      const reconReq = new NextRequest('http://localhost:3000/api/v1/gifts/reconcile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          countedCashAmount: '4000000', // 5M - 1M return = 4M net
        }),
      });
      const reconRes = await giftReconcileRoute.POST(reconReq);
      expect(reconRes.status).toBe(200);
      const reconData = (await reconRes.json()).data;
      expect(reconData.isBalanced).toBe(true);
    });
  });

  describe('4. Archival Freeze Guard (AT35, FL20)', () => {
    it('blocks all mutations with 403 Forbidden when wedding is archived', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);

      // Freeze the wedding archive
      const freezeReq = new NextRequest('http://localhost:3000/api/v1/archival/freeze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archiveReason: 'Khóa lưu trữ sau cưới',
          confirmed: true,
        }),
      });
      const freezeRes = await archivalFreezeRoute.POST(freezeReq);
      expect(freezeRes.status).toBe(200);

      // Attempt to create a timeline item while archived -> 403 Forbidden!
      const timelineReq = new NextRequest('http://localhost:3000/api/v1/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Mục mới khi đã khóa',
          scheduledStartTime: '2028-11-20T19:00:00Z',
          scheduledEndTime: '2028-11-20T19:30:00Z',
        }),
      });
      const timelineRes = await timelineRoute.POST(timelineReq);
      expect(timelineRes.status).toBe(403);
      expect((await timelineRes.json()).error).toBe('WEDDING_ARCHIVED_READ_ONLY');

      // Attempt to check-in while archived -> 403 Forbidden!
      const checkInReq = new NextRequest('http://localhost:3000/api/v1/attendance/check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          guestId: guest1Id,
        }),
      });
      const checkInRes = await checkInRoute.POST(checkInReq);
      expect(checkInRes.status).toBe(403);

      // Attempt to add gift while archived -> 403 Forbidden!
      const giftReq = new NextRequest('http://localhost:3000/api/v1/gifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          giftType: 'cash',
          amount: '1000000',
          contributors: [{ contributorName: 'Ai đó' }],
        }),
      });
      const giftRes = await giftsRoute.POST(giftReq);
      expect(giftRes.status).toBe(403);

      // Owner Unarchive -> succeeds and unblocks mutations
      const unarchiveReq = new NextRequest('http://localhost:3000/api/v1/archival/unarchive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unarchiveReason: 'Cần sửa đổi bổ sung',
        }),
      });
      const unarchiveRes = await archivalUnarchiveRoute.POST(unarchiveReq);
      expect(unarchiveRes.status).toBe(200);

      // Now timeline create works again
      const timelineRetryReq = new NextRequest('http://localhost:3000/api/v1/timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Mục mới sau khi mở lại',
          scheduledStartTime: '2028-11-20T19:00:00Z',
          scheduledEndTime: '2028-11-20T19:30:00Z',
        }),
      });
      const timelineRetryRes = await timelineRoute.POST(timelineRetryReq);
      expect(timelineRetryRes.status).toBe(201);
    });
  });
});
