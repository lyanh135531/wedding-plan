import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import * as vendorsRoute from '@/app/api/v1/vendors/route';
import * as vendorDetailRoute from '@/app/api/v1/vendors/[id]/route';
import * as sessionModule from '@/lib/auth/session';
import * as dbModule from '@/db/client';
import * as vendorsRepo from '@/lib/vendors/vendors.repository';
import {
  VendorNotFoundError,
  VendorHasActiveCostItemsError,
  VersionConflictError,
} from '@/lib/vendors/vendors.repository';
import { VendorDto } from '@/schemas/vendors';

// Mock DB context wrapper to execute callback directly
vi.mock('@/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/db/client')>();
  return {
    ...actual,
    withTransactionScopedContext: vi.fn(
      async (userId: string, role: string, callback: (client: any, db: any) => Promise<any>) => {
        return callback({} as any, {} as any);
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
      name: role === 'owner' ? 'Nguyễn Văn Chú Rể' : 'Bác Ba',
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
    allowedEventIds: [],
  };
}

describe('Vendors API Route Handlers Integration Tests (M8.3, AT03, AT30)', () => {
  const validVendorId = '11111111-1111-4111-8111-111111111111';

  const mockVendorDto: VendorDto = {
    id: validVendorId,
    name: 'Riverside Palace',
    service_type: 'venue',
    status: 'shortlisted',
    contact_person: 'Nguyễn Văn Quản Lý',
    phone: '0912345678',
    email: 'contact@riverside.vn',
    address: '360 Bến Vân Đồn, Q.4, TP.HCM',
    map_url: 'https://maps.google.com/?q=riverside',
    website: 'https://riverside.vn',
    notes: 'Ghi chú mật nội bộ của chủ sở hữu',
    rating: 5,
    capacity: 500,
    min_guests: 150,
    table_price: '5500000',
    seats_per_table: 10,
    rental_fee: '20000000',
    fees_inclusive: false,
    prep_time: '2h',
    end_time: '22:00',
    parking_notes: 'Bãi đỗ xe rộng rãi',
    rain_plan: 'Sảnh trong nhà dự phòng',
    decor_audio_rules: 'Không dùng pháo sáng',
    extra_fees_notes: 'Phí phục vụ 5% chưa gồm VAT',
    version: 1,
    created_at: new Date('2026-11-12T08:00:00.000Z').toISOString(),
    updated_at: new Date('2026-11-12T08:00:00.000Z').toISOString(),
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(dbModule, 'withTransactionScopedContext').mockImplementation(
      async (_userId, _role, callback) => callback({} as any, {} as any)
    );
  });

  // ===========================================================================
  // 1. GET /api/v1/vendors
  // ===========================================================================
  describe('GET /api/v1/vendors', () => {
    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors');
      const res = await vendorsRoute.GET(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('returns 200 with list of vendors for Owner session', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'listVendors').mockResolvedValue([mockVendorDto]);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors?limit=10&page=1');
      const res = await vendorsRoute.GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Riverside Palace');
      expect(body.data[0].notes).toBe('Ghi chú mật nội bộ của chủ sở hữu');
      expect(body.pagination).toEqual({ page: 1, limit: 10, total: 1 });
    });

    it('supports query filtering by serviceType and status', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      const listVendorsSpy = vi.spyOn(vendorsRepo, 'listVendors').mockResolvedValue([mockVendorDto]);

      const req = new NextRequest(
        'http://localhost:3000/api/v1/vendors?serviceType=venue&status=shortlisted&search=Riverside'
      );
      const res = await vendorsRoute.GET(req);

      expect(res.status).toBe(200);
      expect(listVendorsSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          serviceType: 'venue',
          status: 'shortlisted',
          search: 'Riverside',
        })
      );
    });

    it('returns 400 when invalid serviceType is provided', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors?serviceType=INVALID_TYPE');
      const res = await vendorsRoute.GET(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('returns 400 when invalid status is provided', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors?status=UNKNOWN_STATUS');
      const res = await vendorsRoute.GET(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('AT03: Sanitizes confidential notes when accessed by family_view', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const sanitizedVendor: VendorDto = {
        ...mockVendorDto,
        notes: null, // AT03 sanitized
        extra_fees_notes: null, // AT03 sanitized
      };
      const listVendorsSpy = vi.spyOn(vendorsRepo, 'listVendors').mockResolvedValue([sanitizedVendor]);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors');
      const res = await vendorsRoute.GET(req);

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data[0].notes).toBeNull();
      expect(body.data[0].extra_fees_notes).toBeNull();
      expect(listVendorsSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          role: 'family_view',
        })
      );
    });

    it('correctly calculates page from offset parameter', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      const listVendorsSpy = vi.spyOn(vendorsRepo, 'listVendors').mockResolvedValue([]);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors?limit=20&offset=40');
      const res = await vendorsRoute.GET(req);

      expect(res.status).toBe(200);
      expect(listVendorsSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          page: 3, // Math.floor(40/20) + 1 = 3
          limit: 20,
        })
      );
    });
  });

  // ===========================================================================
  // 2. POST /api/v1/vendors
  // ===========================================================================
  describe('POST /api/v1/vendors', () => {
    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Vendor' }),
      });
      const res = await vendorsRoute.POST(req);

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('AT03: returns 403 FORBIDDEN when family_view tries to create vendor', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors', {
        method: 'POST',
        body: JSON.stringify({ name: 'New Vendor', service_type: 'venue' }),
      });
      const res = await vendorsRoute.POST(req);

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 400 BAD_REQUEST when JSON body is invalid', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors', {
        method: 'POST',
        body: 'invalid-json{{{',
      });
      const res = await vendorsRoute.POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('returns 400 VALIDATION_ERROR when required fields are missing (e.g. empty name)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors', {
        method: 'POST',
        body: JSON.stringify({ name: '', service_type: 'venue' }),
      });
      const res = await vendorsRoute.POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 VALIDATION_ERROR when phone format is invalid for VN', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors', {
        method: 'POST',
        body: JSON.stringify({ name: 'Valid Vendor', phone: '12345' }),
      });
      const res = await vendorsRoute.POST(req);

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 201 Created when valid input is submitted by Owner', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'createVendor').mockResolvedValue(mockVendorDto);

      const payload = {
        name: 'Riverside Palace',
        service_type: 'venue',
        status: 'shortlisted',
        phone: '0912345678',
        email: 'contact@riverside.vn',
        address: '360 Bến Vân Đồn, Q.4, TP.HCM',
        rating: 5,
        capacity: 500,
        table_price: '5500000',
        rental_fee: '20000000',
      };

      const req = new NextRequest('http://localhost:3000/api/v1/vendors', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      const res = await vendorsRoute.POST(req);

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.name).toBe('Riverside Palace');
      expect(body.message).toContain('thành công');
    });
  });

  // ===========================================================================
  // 3. GET /api/v1/vendors/[id]
  // ===========================================================================
  describe('GET /api/v1/vendors/[id]', () => {
    it('returns 400 BAD_REQUEST for invalid UUID', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors/not-a-uuid');
      const res = await vendorDetailRoute.GET(req, { params: { id: 'not-a-uuid' } });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('returns 401 UNAUTHORIZED when no session exists', async () => {
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`);
      const res = await vendorDetailRoute.GET(req, { params: { id: validVendorId } });

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('UNAUTHORIZED');
    });

    it('returns 404 NOT_FOUND when vendor does not exist', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'getVendorById').mockResolvedValue(null);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`);
      const res = await vendorDetailRoute.GET(req, { params: { id: validVendorId } });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 200 with vendor details for Owner session', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'getVendorById').mockResolvedValue(mockVendorDto);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`);
      const res = await vendorDetailRoute.GET(req, { params: { id: validVendorId } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.id).toBe(validVendorId);
      expect(body.data.notes).toBe('Ghi chú mật nội bộ của chủ sở hữu');
    });

    it('AT03: Sanitizes notes for family_view', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);
      vi.spyOn(vendorsRepo, 'getVendorById').mockResolvedValue({
        ...mockVendorDto,
        notes: null,
        extra_fees_notes: null,
      });

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`);
      const res = await vendorDetailRoute.GET(req, { params: { id: validVendorId } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.notes).toBeNull();
      expect(body.data.extra_fees_notes).toBeNull();
    });
  });

  // ===========================================================================
  // 4. PATCH /api/v1/vendors/[id]
  // ===========================================================================
  describe('PATCH /api/v1/vendors/[id]', () => {
    it('returns 400 BAD_REQUEST for invalid UUID', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors/bad-id', {
        method: 'PATCH',
        body: JSON.stringify({ version: 1, name: 'Updated' }),
      });
      const res = await vendorDetailRoute.PATCH(req, { params: { id: 'bad-id' } });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('AT03: returns 403 FORBIDDEN when family_view tries to update vendor', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: 1, name: 'Hacked Vendor' }),
      });
      const res = await vendorDetailRoute.PATCH(req, { params: { id: validVendorId } });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 400 VALIDATION_ERROR when version is missing (Optimistic Locking requirement)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Updated Name Without Version' }),
      });
      const res = await vendorDetailRoute.PATCH(req, { params: { id: validVendorId } });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('AT30: returns 409 CONFLICT when VersionConflictError is thrown (Optimistic Locking collision)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'updateVendor').mockRejectedValue(new VersionConflictError());

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: 1, name: 'Stale Update' }),
      });
      const res = await vendorDetailRoute.PATCH(req, { params: { id: validVendorId } });

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toBe('CONFLICT');
      expect(body.message).toContain('thay đổi bởi người khác');
    });

    it('returns 404 NOT_FOUND when vendor does not exist', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'updateVendor').mockRejectedValue(new VendorNotFoundError());

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: 1, name: 'Missing Vendor' }),
      });
      const res = await vendorDetailRoute.PATCH(req, { params: { id: validVendorId } });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 200 with updated vendor on successful update', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      const updatedDto = { ...mockVendorDto, version: 2, name: 'Riverside Palace New Name' };
      vi.spyOn(vendorsRepo, 'updateVendor').mockResolvedValue(updatedDto);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, {
        method: 'PATCH',
        body: JSON.stringify({ version: 1, name: 'Riverside Palace New Name' }),
      });
      const res = await vendorDetailRoute.PATCH(req, { params: { id: validVendorId } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.version).toBe(2);
      expect(body.data.name).toBe('Riverside Palace New Name');
    });
  });

  // ===========================================================================
  // 5. DELETE /api/v1/vendors/[id]
  // ===========================================================================
  describe('DELETE /api/v1/vendors/[id]', () => {
    it('returns 400 BAD_REQUEST for invalid UUID', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);

      const req = new NextRequest('http://localhost:3000/api/v1/vendors/not-uuid', { method: 'DELETE' });
      const res = await vendorDetailRoute.DELETE(req, { params: { id: 'not-uuid' } });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
    });

    it('AT03: returns 403 FORBIDDEN when family_view tries to delete vendor', async () => {
      const familySession = createMockSession('family_view');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(familySession as any);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, { method: 'DELETE' });
      const res = await vendorDetailRoute.DELETE(req, { params: { id: validVendorId } });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 400 BAD_REQUEST when vendor has active cost items (VendorHasActiveCostItemsError)', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'deleteVendor').mockRejectedValue(new VendorHasActiveCostItemsError());

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, { method: 'DELETE' });
      const res = await vendorDetailRoute.DELETE(req, { params: { id: validVendorId } });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe('BAD_REQUEST');
      expect(body.message).toContain('khoản chi');
    });

    it('returns 404 NOT_FOUND when vendor does not exist', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'deleteVendor').mockRejectedValue(new VendorNotFoundError());

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, { method: 'DELETE' });
      const res = await vendorDetailRoute.DELETE(req, { params: { id: validVendorId } });

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 200 with success message when vendor is deleted', async () => {
      const ownerSession = createMockSession('owner');
      vi.spyOn(sessionModule, 'getCurrentSession').mockResolvedValue(ownerSession as any);
      vi.spyOn(vendorsRepo, 'deleteVendor').mockResolvedValue(undefined);

      const req = new NextRequest(`http://localhost:3000/api/v1/vendors/${validVendorId}`, { method: 'DELETE' });
      const res = await vendorDetailRoute.DELETE(req, { params: { id: validVendorId } });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toContain('thành công');
    });
  });
});
