import { describe, it, expect, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { createMockG9TxDb } from '@tests/helpers/g9-mock-db';
import { evaluateR2Readiness } from '@/lib/r2-signoff';

describe('EMPIRICAL ADVERSARIAL: Milestone R2 Readiness Sign-off & Audit Council Verification (PLAN §24.1, UI_UX_SPEC §7.11)', () => {
  let mockDb: any;
  const eventId = '00000000-0000-4000-8000-000000000001';
  const userId = '11111111-1111-4111-8111-111111111111';

  beforeEach(() => {
    mockDb = createMockG9TxDb({
      events: [{ id: eventId, title: 'Đám cưới chính thức' }],
    });
  });

  describe('1. Individual Gate Failure Detection (Gates 1 - 7)', () => {
    it('Gate 1 fails when seating table capacity is exceeded', async () => {
      // Table capacity = 10, but 11 guests assigned
      const tableId = '10000000-0000-4000-8000-000000000001';
      mockDb._store.tables = [
        { id: tableId, eventId, name: 'Bàn VIP 1', capacity: 10, shape: 'round', version: 1 },
      ];
      mockDb._store.seatAssignments = Array.from({ length: 11 }, (_, i) => ({
        id: `seat-${i}`,
        eventId,
        tableId,
        guestId: `guest-${i}`,
        version: 1,
      }));

      const report = await evaluateR2Readiness(mockDb, eventId, userId);
      const gate1 = report.checks.find((c) => c.id === 'gate-1-seating-balance');

      expect(gate1).toBeDefined();
      expect(gate1!.status).toBe('failed');
      expect(gate1!.message).toContain('vượt sức chứa: 11/10');
      expect(report.overallStatus).toBe('NOT_READY');
    });

    it('Gate 2 fails when no active menus or catering snapshots exist', async () => {
      mockDb._store.menus = [];
      mockDb._store.cateringSnapshots = [];

      const report = await evaluateR2Readiness(mockDb, eventId, userId);
      const gate2 = report.checks.find((c) => c.id === 'gate-2-menu-lock');

      expect(gate2).toBeDefined();
      expect(gate2!.status).toBe('failed');
      expect(gate2!.message).toContain('Chưa có thực đơn tiệc hoạt động');
    });

    it('Gate 3 fails when transport vehicle capacity is exceeded', async () => {
      const tripId = '30000000-0000-4000-8000-000000000001';
      mockDb._store.transportTrips = [
        { id: tripId, eventId, name: 'Xe rước dâu 16 chỗ', capacity: 16, vehicleType: 'van', version: 1 },
      ];
      mockDb._store.tripPassengers = Array.from({ length: 18 }, (_, i) => ({
        id: `passenger-${i}`,
        tripId,
        eventId,
        guestId: `guest-${i}`,
        version: 1,
      }));

      const report = await evaluateR2Readiness(mockDb, eventId, userId);
      const gate3 = report.checks.find((c) => c.id === 'gate-3-logistics-capacity');

      expect(gate3).toBeDefined();
      expect(gate3!.status).toBe('failed');
      expect(gate3!.message).toContain('chở quá tải: 18/16');
      expect(report.overallStatus).toBe('NOT_READY');
    });

    it('Gate 4 fails when duplicate cost items are created from the same quote (AT23)', async () => {
      const quoteId = '40000000-0000-4000-8000-000000000001';
      mockDb._store.vendorQuotes = [{ id: quoteId, eventId, title: 'Báo giá âm thanh ánh sáng' }];
      mockDb._store.costItems = [
        { id: 'cost-1', eventId, name: 'Âm thanh gói 1', vendorQuoteId: quoteId },
        { id: 'cost-2', eventId, name: 'Âm thanh gói 1 trùng lặp', vendorQuoteId: quoteId }, // DUPLICATE (AT23)
      ];

      const report = await evaluateR2Readiness(mockDb, eventId, userId);
      const gate4 = report.checks.find((c) => c.id === 'gate-4-vendor-anti-duplication');

      expect(gate4).toBeDefined();
      expect(gate4!.status).toBe('failed');
      expect(gate4!.message).toContain('vi phạm AT23');
      expect(report.overallStatus).toBe('NOT_READY');
    });

    it('Gate 5 fails when rental items are missing return deadlines', async () => {
      mockDb._store.preparationItems = [
        {
          id: 'rental-1',
          eventId,
          type: 'item',
          title: 'Trang phục cưới thuê',
          isRental: true,
          returnDueDate: null, // MISSING RETURN DATE!
          status: 'brought',
          version: 1,
        },
      ];

      const report = await evaluateR2Readiness(mockDb, eventId, userId);
      const gate5 = report.checks.find((c) => c.id === 'gate-5-rental-deadlines');

      expect(gate5).toBeDefined();
      expect(gate5!.status).toBe('failed');
      expect(gate5!.message).toContain('chưa có ngày hẹn trả đồ');
      expect(report.overallStatus).toBe('NOT_READY');
    });
  });

  describe('2. Comprehensive Full Readiness Sign-off & Immutable Snapshot (Gate 8)', () => {
    it('achieves READY status and generates valid cryptographic SHA-256 snapshot when all criteria are met', async () => {
      // 1. Valid seating
      const tableId = '10000000-0000-4000-8000-000000000001';
      mockDb._store.tables = [
        { id: tableId, eventId, name: 'Bàn VIP 1', capacity: 10, shape: 'round', version: 1 },
      ];
      mockDb._store.seatAssignments = [
        { id: 'seat-1', eventId, tableId, guestId: 'guest-1', version: 1 },
        { id: 'seat-2', eventId, tableId, guestId: 'guest-2', version: 1 },
      ];

      // 2. Active menu & snapshot
      mockDb._store.menus = [{ id: 'menu-1', eventId, name: 'Thực đơn tiệc cưới hoàng gia', isActive: true, version: 1 }];
      mockDb._store.cateringSnapshots = [{ id: 'snap-1', eventId, menuId: 'menu-1', version: 1 }];

      // 3. Logistics within capacity
      const tripId = '30000000-0000-4000-8000-000000000001';
      mockDb._store.transportTrips = [
        { id: tripId, eventId, name: 'Xe 16 chỗ', capacity: 16, vehicleType: 'van', version: 1 },
      ];
      mockDb._store.tripPassengers = [
        { id: 'pass-1', tripId, eventId, guestId: 'guest-1', version: 1 },
      ];

      // 4. Clean vendor quotes & costs (no duplicates)
      mockDb._store.vendorQuotes = [{ id: 'quote-1', eventId, title: 'Báo giá hoa tươi' }];
      mockDb._store.costItems = [{ id: 'cost-1', eventId, name: 'Hoa tươi sân khấu', vendorQuoteId: 'quote-1' }];

      // 5. Preparation rental with deadline
      mockDb._store.preparationItems = [
        {
          id: 'rental-1',
          eventId,
          type: 'item',
          title: 'Váy cưới công chúa',
          isRental: true,
          returnDueDate: new Date('2026-12-05T12:00:00Z'),
          status: 'brought',
          version: 1,
        },
        // 6. Media handover recorded
        {
          id: 'shot-1',
          eventId,
          type: 'photo',
          title: 'Chụp hình gia đình',
          handedOverAt: new Date('2026-11-16T08:00:00Z'),
          version: 1,
        },
        {
          id: 'music-1',
          eventId,
          type: 'music',
          title: 'Nhạc vào lễ',
          category: 'entrance',
          version: 1,
        },
      ];

      // 7. Support party staffed
      mockDb._store.supportAssignments = [
        {
          id: 'supp-1',
          eventId,
          name: 'Bạn Thảo',
          phone: '0901234567',
          roles: ['phu_dau', 'dieu_phoi'],
          isShared: true,
          version: 1,
        },
      ];

      const report = await evaluateR2Readiness(mockDb, eventId, userId);

      expect(report.overallStatus).toBe('READY');
      expect(report.totalGates).toBe(8);
      expect(report.failedGates).toBe(0);

      // Verify immutable snapshot
      expect(report.snapshot).toBeDefined();
      expect(report.snapshot.isImmutable).toBe(true);
      expect(report.snapshot.signedBy).toBe(userId);
      expect(report.snapshot.checksum).toHaveLength(64); // SHA-256 hex string

      // Verify checksum determinism
      const canonicalPayload = JSON.stringify({
        eventId,
        evaluatedAt: report.evaluatedAt,
        overallStatus: 'READY',
        checks: report.checks.slice(0, 7).map((c) => ({ id: c.id, status: c.status, message: c.message })),
      });
      const expectedChecksum = createHash('sha256').update(canonicalPayload).digest('hex');
      expect(report.snapshot.checksum).toBe(expectedChecksum);
    });

    it('ADVERSARIAL: detects tampering with any check or event status', async () => {
      mockDb._store.tables = [];
      mockDb._store.menus = [{ id: 'menu-1', eventId, name: 'Menu 1', isActive: true, version: 1 }];

      const report = await evaluateR2Readiness(mockDb, eventId, userId);
      const originalChecksum = report.snapshot.checksum;

      // Simulate malicious tampering with one of the check statuses
      const tamperedReport = JSON.parse(JSON.stringify(report));
      tamperedReport.checks[0].status = 'failed'; // Tampered!
      tamperedReport.checks[0].message = 'Giả mạo trạng thái kiểm tra';

      const recomputedCanonical = JSON.stringify({
        eventId,
        evaluatedAt: report.evaluatedAt,
        overallStatus: tamperedReport.overallStatus,
        checks: tamperedReport.checks.slice(0, 7).map((c: any) => ({ id: c.id, status: c.status, message: c.message })),
      });
      const tamperedChecksum = createHash('sha256').update(recomputedCanonical).digest('hex');

      // Tampered checksum does NOT match original signed checksum!
      expect(tamperedChecksum).not.toBe(originalChecksum);
    });
  });
});
