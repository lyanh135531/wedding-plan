import { describe, it, expect, vi } from 'vitest';
import {
  listQuotesByVendorId,
  getQuoteById,
  createInitialQuote,
  createNewQuoteVersion,
  selectQuote,
  getQuotesByIds,
  getQuoteVersionHistory,
  QuoteNotFoundError,
} from '../../../src/lib/vendors/quotes.repository';
import { VendorNotFoundError } from '../../../src/lib/vendors/vendors.repository';
import { quoteDtoSchema } from '../../../src/schemas/vendors';

describe('Quotes Repository & AT24 Version Immutability Tests', () => {
  const sampleVendorId = '11111111-1111-4111-8111-111111111111';
  const sampleQuoteIdV1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sampleQuoteIdV2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const samplePackageGroupId = '99999999-9999-4999-8999-999999999999';

  const baseQuoteV1Row = {
    id: sampleQuoteIdV1,
    vendorId: sampleVendorId,
    packageGroupId: samplePackageGroupId,
    versionNumber: 1,
    parentQuoteId: null,
    quoteName: 'Gói Tiệc Cưới Tiêu Chuẩn',
    receivedDate: '2026-11-01',
    validUntil: '2026-12-01',
    totalAmount: 150000000n,
    isEstimate: false,
    guestCountAssumption: 250,
    tableCountAssumption: 25,
    terms: 'Bao gồm nước ngọt suốt tiệc',
    includes: ['Bàn tiệc 8 món', 'Nước ngọt & nước suối suốt tiệc', 'Âm thanh ánh sáng cơ bản'],
    excludes: ['Bia', 'Màn hình LED'],
    depositConditions: 'Đặt cọc 30% khi ký',
    isSelected: false,
    createdBy: 'user-owner-1',
    createdAt: new Date('2026-11-01T10:00:00.000Z'),
    updatedAt: new Date('2026-11-01T10:00:00.000Z'),
  };

  function mockQueryResult<T>(data: T) {
    const p = Promise.resolve(data);
    return Object.assign(p, {
      limit: vi.fn().mockImplementation(() => Promise.resolve(data)),
    });
  }

  // ---------------------------------------------------------------------------
  // 1. AT24: Version Immutability & Revisions
  // ---------------------------------------------------------------------------
  describe('AT24: Version Immutability (Preserving Past Quote Versions)', () => {
    it('creates initial quote with version_number = 1 and parent_quote_id = null', async () => {
      let selectCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) return mockQueryResult([{ id: sampleVendorId, status: 'contacted' }]); // vendor
            return mockQueryResult([{ max: 0 }]); // max version
          }),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockReturnThis(),
          returning: vi.fn().mockImplementation((val) => Promise.resolve([baseQuoteV1Row])),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => Promise.resolve()),
        })),
      };

      const quote = await createInitialQuote(
        mockDb,
        sampleVendorId,
        {
          quote_name: 'Gói Tiệc Cưới Tiêu Chuẩn',
          received_date: '2026-11-01',
          valid_until: '2026-12-01',
          total_amount: '150000000',
          is_estimate: false,
          guest_count_assumption: 250,
          table_count_assumption: 25,
          terms: 'Bao gồm nước ngọt suốt tiệc',
          includes: ['Bàn tiệc 8 món', 'Nước ngọt & nước suối suốt tiệc', 'Âm thanh ánh sáng cơ bản'],
          excludes: ['Bia', 'Màn hình LED'],
          deposit_conditions: 'Đặt cọc 30% khi ký',
        },
        'user-owner-1'
      );

      expect(() => quoteDtoSchema.parse(quote)).not.toThrow();
      expect(quote.version_number).toBe(1);
      expect(quote.parent_quote_id).toBeNull();
      expect(quote.total_amount).toBe('150000000');
      // Vendor status upgraded to 'quoted'
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('createNewQuoteVersion creates a new revision with incremented version_number and links parent_quote_id without modifying base quote', async () => {
      const revisedQuoteV2Row = {
        ...baseQuoteV1Row,
        id: sampleQuoteIdV2,
        versionNumber: 2,
        parentQuoteId: sampleQuoteIdV1, // AT24 lineage link
        totalAmount: 165000000n, // Price adjusted
        terms: 'Bao gồm thêm bia Sapporo 2 giờ đầu',
        createdAt: new Date('2026-11-05T14:00:00.000Z'),
        updatedAt: new Date('2026-11-05T14:00:00.000Z'),
      };

      let selectCount = 0;
      let insertedValues: any = null;

      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) return mockQueryResult([baseQuoteV1Row]); // base quote lookup
            return mockQueryResult([{ max: 1 }]); // max version in vendor
          }),
        })),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation((val) => {
            if (!insertedValues) insertedValues = val;
            return {
              returning: vi.fn().mockImplementation(() => Promise.resolve([revisedQuoteV2Row])),
            };
          }),
        })),
        update: vi.fn(), // MUST NOT BE CALLED ON vendor_quotes!
      };

      const result = await createNewQuoteVersion(
        mockDb,
        sampleQuoteIdV1,
        {
          total_amount: '165000000',
          terms: 'Bao gồm thêm bia Sapporo 2 giờ đầu',
          revision_reason: 'Khách yêu cầu nâng cấp gói nước uống',
        },
        'user-owner-1'
      );

      expect(() => quoteDtoSchema.parse(result)).not.toThrow();

      // Verify new revision attributes
      expect(result.id).toBe(sampleQuoteIdV2);
      expect(result.version_number).toBe(2);
      expect(result.parent_quote_id).toBe(sampleQuoteIdV1);
      expect(result.package_group_id).toBe(samplePackageGroupId);
      expect(result.total_amount).toBe('165000000');

      // Crucial: Existing base quote record was NEVER overwritten or updated!
      expect(mockDb.update).not.toHaveBeenCalled();
      expect(insertedValues.parentQuoteId).toBe(sampleQuoteIdV1);
      expect(insertedValues.packageGroupId).toBe(samplePackageGroupId);
    });

    it('AT24: Unpriced quotes preserve total_amount as null, never default to 0n or "0"', async () => {
      const unpricedQuoteRow = {
        ...baseQuoteV1Row,
        totalAmount: null, // "Chưa báo"
      };

      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => mockQueryResult([unpricedQuoteRow])),
        })),
      };

      const quote = await getQuoteById(mockDb, sampleQuoteIdV1);

      expect(quote).not.toBeNull();
      expect(quote?.total_amount).toBeNull(); // Strictly null, NOT "0" or 0n!
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Quote Selection (selectQuote)
  // ---------------------------------------------------------------------------
  describe('Quote Selection & Contract Basis', () => {
    it('marks target quote as is_selected = true, unselects other vendor quotes, and updates vendor status', async () => {
      const selectedQuoteRow = {
        ...baseQuoteV1Row,
        isSelected: true,
      };

      let updateCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => mockQueryResult([baseQuoteV1Row])),
        })),
        update: vi.fn().mockImplementation(() => {
          updateCount++;
          return {
            set: vi.fn().mockImplementation(() => ({
              where: vi.fn().mockImplementation(() => {
                const p = Promise.resolve(updateCount === 2 ? [selectedQuoteRow] : []);
                return Object.assign(p, {
                  returning: vi.fn().mockImplementation(() => Promise.resolve([selectedQuoteRow])),
                });
              }),
            })),
          };
        }),
        insert: vi.fn().mockImplementation(() => ({
          values: vi.fn().mockImplementation(() => Promise.resolve()),
        })),
      };

      const result = await selectQuote(mockDb, sampleVendorId, sampleQuoteIdV1, 'user-owner-1');

      expect(result.is_selected).toBe(true);
      // update called 3 times: 1) unselect all vendor quotes, 2) select target quote, 3) update vendor.status = 'selected'
      expect(mockDb.update).toHaveBeenCalledTimes(3);
      expect(mockDb.insert).toHaveBeenCalled(); // Audit log
    });

    it('throws QuoteNotFoundError when selecting non-existent quote', async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => mockQueryResult([])),
        })),
      };

      await expect(
        selectQuote(mockDb, sampleVendorId, 'non-existent-quote', 'user-1')
      ).rejects.toThrow(QuoteNotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Multi-Quote Fetch for Comparison (getQuotesByIds)
  // ---------------------------------------------------------------------------
  describe('getQuotesByIds for Multi-Package Comparison', () => {
    it('returns combined quote and vendor details for requested quote IDs', async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() =>
            Promise.resolve([
              {
                quote: baseQuoteV1Row,
                vendor: {
                  id: sampleVendorId,
                  name: 'Trung tâm White Palace',
                  serviceType: 'venue',
                  status: 'quoted',
                  tablePrice: 6500000n,
                  rentalFee: 20000000n,
                  capacity: 500,
                  minGuests: 200,
                  seatsPerTable: 10,
                  feesInclusive: false,
                },
              },
            ])
          ),
        })),
      };

      const results = await getQuotesByIds(mockDb, [sampleQuoteIdV1]);

      expect(results).toHaveLength(1);
      expect(results[0].quote_name).toBe('Gói Tiệc Cưới Tiêu Chuẩn');
      expect(results[0].vendor_name).toBe('Trung tâm White Palace');
      expect(results[0].table_price).toBe('6500000');
      expect(results[0].rental_fee).toBe('20000000');
      expect(results[0].fees_inclusive).toBe(false);
    });
  });
});
