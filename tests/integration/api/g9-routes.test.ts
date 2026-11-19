import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Route Handlers
import * as ideasRoute from '@/app/api/v1/preparation/ideas/route';
import * as ideaDetailRoute from '@/app/api/v1/preparation/ideas/[id]/route';
import * as ideaPreviewRoute from '@/app/api/v1/preparation/ideas/[id]/preview/route';

import * as itemsRoute from '@/app/api/v1/preparation/items/route';
import * as itemDetailRoute from '@/app/api/v1/preparation/items/[id]/route';

import * as musicRoute from '@/app/api/v1/preparation/music/route';
import * as musicDetailRoute from '@/app/api/v1/preparation/music/[id]/route';
import * as musicReorderRoute from '@/app/api/v1/preparation/music/reorder/route';

import * as shotsRoute from '@/app/api/v1/preparation/shots/route';
import * as shotDetailRoute from '@/app/api/v1/preparation/shots/[id]/route';
import * as shotHandoverRoute from '@/app/api/v1/preparation/shots/[id]/handover/route';

import * as supportMembersRoute from '@/app/api/v1/support/members/route';
import * as supportMemberDetailRoute from '@/app/api/v1/support/members/[id]/route';

import * as r2SignoffRoute from '@/app/api/v1/r2-signoff/route';

// Auth & DB
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';
import { createMockG9TxDb, MockG9Store } from '@tests/helpers/g9-mock-db';

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

describe('Gate G9 API Route Handlers Integration Tests (M9.1, AT03, AT26)', () => {
  const eventId = '00000000-0000-4000-8000-000000000001';

  beforeEach(() => {
    mockTxDb = createMockG9TxDb({
      events: [{ id: eventId, title: 'Đám cưới mẫu' }],
    });
    vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('owner') as any);
  });

  describe('1. Ideas API (/api/v1/preparation/ideas)', () => {
    it('creates and lists ideas', async () => {
      // POST
      const postReq = new NextRequest('http://localhost:3000/api/v1/preparation/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Ý tưởng trang trí sảnh',
          category: 'decor',
          status: 'reference',
          colorSwatches: ['#FFFFFF'],
          isShared: true,
        }),
      });

      const postRes = await ideasRoute.POST(postReq);
      expect(postRes.status).toBe(201);
      const postJson = await postRes.json();
      expect(postJson.data.title).toBe('Ý tưởng trang trí sảnh');
      const ideaId = postJson.data.id;

      // GET
      const getReq = new NextRequest(`http://localhost:3000/api/v1/preparation/ideas?eventId=${eventId}`);
      const getRes = await ideasRoute.GET(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.data).toHaveLength(1);

      // GET [id]/preview
      const prevReq = new NextRequest(`http://localhost:3000/api/v1/preparation/ideas/${ideaId}/preview`);
      const prevRes = await ideaPreviewRoute.GET(prevReq, { params: Promise.resolve({ id: ideaId }) });
      expect(prevRes.status).toBe(200);
      const prevJson = await prevRes.json();
      expect(prevJson.data.proposedTask.title).toContain('Ý tưởng trang trí sảnh');

      // PATCH [id]
      const patchReq = new NextRequest(`http://localhost:3000/api/v1/preparation/ideas/${ideaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'decided', version: 1 }),
      });
      const patchRes = await ideaDetailRoute.PATCH(patchReq, { params: Promise.resolve({ id: ideaId }) });
      expect(patchRes.status).toBe(200);

      // DELETE [id]
      const delReq = new NextRequest(`http://localhost:3000/api/v1/preparation/ideas/${ideaId}?version=2`, {
        method: 'DELETE',
      });
      const delRes = await ideaDetailRoute.DELETE(delReq, { params: Promise.resolve({ id: ideaId }) });
      expect(delRes.status).toBe(200);
    });

    it('denies write operations for family_view (403 Forbidden)', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);

      const postReq = new NextRequest('http://localhost:3000/api/v1/preparation/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Ý tưởng trái phép',
        }),
      });

      const res = await ideasRoute.POST(postReq);
      expect(res.status).toBe(403);
    });
  });

  describe('2. Preparation Items API (/api/v1/preparation/items)', () => {
    it('creates, updates, and validates rental item return dueDate', async () => {
      // Missing returnDueDate for rental item returns 422
      const invalidRentalReq = new NextRequest('http://localhost:3000/api/v1/preparation/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Váy cưới thuê',
          isRental: true,
        }),
      });
      const invalidRes = await itemsRoute.POST(invalidRentalReq);
      expect(invalidRes.status).toBe(400); // Zod refine error is 400

      // Valid rental item
      const validReq = new NextRequest('http://localhost:3000/api/v1/preparation/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Váy cưới thuê',
          isRental: true,
          returnDueDate: '2026-12-01T12:00:00Z',
          quantity: 1,
        }),
      });
      const validRes = await itemsRoute.POST(validReq);
      expect(validRes.status).toBe(201);
      const validJson = await validRes.json();
      expect(validJson.data.isRental).toBe(true);
      const itemId = validJson.data.id;

      // GET detail
      const detailReq = new NextRequest(`http://localhost:3000/api/v1/preparation/items/${itemId}`);
      const detailRes = await itemDetailRoute.GET(detailReq, { params: Promise.resolve({ id: itemId }) });
      expect(detailRes.status).toBe(200);

      // PATCH status to packed
      const patchReq = new NextRequest(`http://localhost:3000/api/v1/preparation/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'packed', version: 1 }),
      });
      const patchRes = await itemDetailRoute.PATCH(patchReq, { params: Promise.resolve({ id: itemId }) });
      expect(patchRes.status).toBe(200);
      const patchJson = await patchRes.json();
      expect(patchJson.data.status).toBe('packed');
    });
  });

  describe('3. Music Playlist API (/api/v1/preparation/music)', () => {
    it('creates, lists, and reorders music playlist', async () => {
      // POST Track 1
      const t1Req = new NextRequest('http://localhost:3000/api/v1/preparation/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Bài 1',
          moment: 'entrance',
          trackOrder: 0,
        }),
      });
      const t1Res = await musicRoute.POST(t1Req);
      const t1Json = await t1Res.json();
      const t1Id = t1Json.data.id;

      // POST Track 2
      const t2Req = new NextRequest('http://localhost:3000/api/v1/preparation/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Bài 2',
          moment: 'entrance',
          trackOrder: 1,
        }),
      });
      const t2Res = await musicRoute.POST(t2Req);
      const t2Json = await t2Res.json();
      const t2Id = t2Json.data.id;

      // POST Reorder: t2 -> t1
      const reorderReq = new NextRequest('http://localhost:3000/api/v1/preparation/music/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          trackIds: [t2Id, t1Id],
        }),
      });
      const reorderRes = await musicReorderRoute.POST(reorderReq);
      expect(reorderRes.status).toBe(200);
      const reorderJson = await reorderRes.json();
      expect(reorderJson.data[0].id).toBe(t2Id);
    });
  });

  describe('4. Photo Shots API (/api/v1/preparation/shots)', () => {
    it('creates shot and records manual handover', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/v1/preparation/shots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          title: 'Cắt bánh cưới',
          priority: 'must_have',
          subjectGroup: 'Cô dâu chú rể',
        }),
      });
      const createRes = await shotsRoute.POST(createReq);
      expect(createRes.status).toBe(201);
      const createJson = await createRes.json();
      const shotId = createJson.data.id;

      // Handover
      const handoverReq = new NextRequest(`http://localhost:3000/api/v1/preparation/shots/${shotId}/handover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: 'Thợ chụp ảnh chính',
          channel: 'direct_handover',
        }),
      });
      const handoverRes = await shotHandoverRoute.POST(handoverReq, { params: Promise.resolve({ id: shotId }) });
      expect(handoverRes.status).toBe(200);
      const handoverJson = await handoverRes.json();
      expect(handoverJson.data.success).toBe(true);

      // Subsequent handover attempt fails (Immutable invariant)
      const repeatHandoverRes = await shotHandoverRoute.POST(handoverReq, { params: Promise.resolve({ id: shotId }) });
      expect(repeatHandoverRes.status).toBe(400);
    });
  });

  describe('5. Support Members API (/api/v1/support/members)', () => {
    it('creates, lists, and sanitizes support members for family view', async () => {
      const createReq = new NextRequest('http://localhost:3000/api/v1/support/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventId,
          name: 'Bạn Thảo Phù Dâu',
          phone: '0901234567',
          roles: ['phu_dau'],
          attireNotes: 'Áo dài hồng phấn',
          isShared: true,
        }),
      });
      const createRes = await supportMembersRoute.POST(createReq);
      expect(createRes.status).toBe(201);
      const createJson = await createRes.json();
      const memberId = createJson.data.id;

      // GET for owner shows attireNotes
      const ownerGetReq = new NextRequest(`http://localhost:3000/api/v1/support/members?eventId=${eventId}`);
      const ownerGetRes = await supportMembersRoute.GET(ownerGetReq);
      const ownerJson = await ownerGetRes.json();
      expect(ownerJson.data[0].attireNotes).toBe('Áo dài hồng phấn');

      // GET for family_view redacts attireNotes to null (AT26)
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(createMockSession('family_view') as any);
      const familyGetReq = new NextRequest(`http://localhost:3000/api/v1/support/members?eventId=${eventId}`);
      const familyGetRes = await supportMembersRoute.GET(familyGetReq);
      const familyJson = await familyGetRes.json();
      expect(familyJson.data[0].attireNotes).toBeNull();
    });
  });

  describe('6. Milestone R2 Sign-off API (/api/v1/r2-signoff)', () => {
    it('evaluates without persisting and rejects sign-off when readiness gates fail', async () => {
      const getReq = new NextRequest(`http://localhost:3000/api/v1/r2-signoff?eventId=${eventId}`);
      const getRes = await r2SignoffRoute.GET(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.data.totalGates).toBe(8);
      expect(getJson.data.snapshot.checksum).toBeDefined();
      expect(getJson.data.snapshot.isImmutable).toBe(false);

      const postReq = new NextRequest('http://localhost:3000/api/v1/r2-signoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId }),
      });
      const postRes = await r2SignoffRoute.POST(postReq);
      expect(postRes.status).toBe(409);
      const postJson = await postRes.json();
      expect(postJson.message).toContain('chưa đạt');
    });
  });
});
