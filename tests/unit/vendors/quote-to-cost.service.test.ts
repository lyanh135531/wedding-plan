import { describe, it, expect, vi } from 'vitest';
import {
  generateQuoteToCostPreview,
  convertQuoteToCostItem,
} from '../../../src/lib/vendors/quote-to-cost.service';
import { QuoteNotFoundError } from '../../../src/lib/vendors/quotes.repository';
import * as idempotencyService from '../../../src/lib/finance/idempotency.service';
import {
  quoteToCostPreviewResponseSchema,
  convertQuoteToCostResponseSchema,
} from '../../../src/schemas/vendors';

describe('Quote-To-Cost Service & 3-Tier Idempotency Guard (AT23)', () => {
  const sampleVendorId = '11111111-1111-4111-8111-111111111111';
  const sampleQuoteId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const sampleCategoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const sampleCostItemId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

  const mockVendorRow = {
    id: sampleVendorId,
    name: 'White Palace Convention Center',
    phone: '0901234567',
    contactPerson: 'Nguyễn Văn Quản Lý',
    rentalFee: 25000000n,
    status: 'quoted',
  };

  const mockQuoteRow = {
    id: sampleQuoteId,
    vendorId: sampleVendorId,
    packageGroupId: 'gggggggg-gggg-4ggg-8ggg-gggggggggggg',
    versionNumber: 1,
    quoteName: 'Gói Tiệc Bạc',
    totalAmount: 180000000n,
    isSelected: false,
  };

  // ---------------------------------------------------------------------------
  // 1. Preview Generation (generateQuoteToCostPreview)
  // ---------------------------------------------------------------------------
  describe('Preview Generation (FL14, AT23)', () => {
    it('generates preview with is_already_converted = false when not yet converted', async () => {
      let selectCount = 0;
      let orderCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              // Quote + vendor join
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    quote: mockQuoteRow,
                    vendor: mockVendorRow,
                  },
                ]),
              };
            }
            // Existing cost item check -> NOT FOUND
            return {
              limit: vi.fn().mockResolvedValue([]),
            };
          }),
          orderBy: vi.fn().mockImplementation(() => {
            orderCount++;
            if (orderCount === 1) {
              return Promise.resolve([{ id: sampleCategoryId, name: 'Tiệc cưới & Ẩm thực' }]);
            }
            return Promise.resolve([{ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', title: 'Lễ Thành Hôn' }]);
          }),
        })),
      };

      const preview = await generateQuoteToCostPreview(mockDb, { quoteId: sampleQuoteId });

      expect(() => quoteToCostPreviewResponseSchema.parse(preview)).not.toThrow();
      expect(preview.quote_id).toBe(sampleQuoteId);
      expect(preview.vendor_name).toBe('White Palace Convention Center');
      expect(preview.suggested_cost_item_name).toBe('White Palace Convention Center - Gói Tiệc Bạc');
      expect(preview.suggested_amount).toBe('180000000');
      expect(preview.is_price_missing).toBe(false);
      expect(preview.is_already_converted).toBe(false);
      expect(preview.existing_cost_item).toBeNull();
      expect(preview.available_categories).toHaveLength(1);
    });

    it('generates preview with is_already_converted = true and existing cost item info when already converted (AT23)', async () => {
      let selectCount = 0;
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => {
            selectCount++;
            if (selectCount === 1) {
              return {
                limit: vi.fn().mockResolvedValue([
                  {
                    quote: mockQuoteRow,
                    vendor: mockVendorRow,
                  },
                ]),
              };
            }
            // Existing cost item check -> FOUND!
            return {
              limit: vi.fn().mockResolvedValue([
                {
                  id: sampleCostItemId,
                  name: 'White Palace Convention Center - Gói Tiệc Bạc',
                  status: 'contracted',
                  contractedAmount: 180000000n,
                },
              ]),
            };
          }),
          orderBy: vi.fn().mockResolvedValue([]),
        })),
      };

      const preview = await generateQuoteToCostPreview(mockDb, { quoteId: sampleQuoteId });

      expect(preview.is_already_converted).toBe(true);
      expect(preview.existing_cost_item).not.toBeNull();
      expect(preview.existing_cost_item?.id).toBe(sampleCostItemId);
      expect(preview.existing_cost_item?.status).toBe('contracted');
    });

    it('throws QuoteNotFoundError when quote does not exist', async () => {
      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          innerJoin: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        })),
      };

      await expect(
        generateQuoteToCostPreview(mockDb, { quoteId: 'non-existent' })
      ).rejects.toThrow(QuoteNotFoundError);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Conversion & 3-Tier Idempotency Guard (AT23)
  // ---------------------------------------------------------------------------
  describe('AT23: 3-Tier Idempotency Guard on convertQuoteToCostItem', () => {
    it('creates new cost item on first conversion, selects quote, updates vendor, and does NOT auto-create payments (STRICT AT23)', async () => {
      let selectCount = 0;
      let costItemInsertedValues: any = null;

      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => ({
            for: vi.fn().mockImplementation(() => {
              // 1. Quote query with FOR UPDATE
              return Promise.resolve([mockQuoteRow]);
            }),
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              if (selectCount === 1) {
                // 2. Business check for existing cost item -> NOT FOUND
                return Promise.resolve([]);
              }
              // 3. Vendor query
              return Promise.resolve([mockVendorRow]);
            }),
          })),
        })),
        insert: vi.fn().mockImplementation((table) => ({
          values: vi.fn().mockImplementation((val) => {
            if (!costItemInsertedValues) {
              costItemInsertedValues = val;
            }
            return {
              returning: vi.fn().mockImplementation(() =>
                Promise.resolve([
                  {
                    id: sampleCostItemId,
                    name: val.name,
                    status: val.status,
                  },
                ])
              ),
            };
          }),
        })),
        update: vi.fn().mockImplementation(() => ({
          set: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => Promise.resolve()),
        })),
      };

      // Spy on withIdempotency to pass through to execution
      vi.spyOn(idempotencyService, 'withIdempotency').mockImplementation(async (opts: any) => {
        const result = await opts.execute();
        return { ...result, fromCache: false };
      });

      const response = await convertQuoteToCostItem(mockDb, {
        quoteId: sampleQuoteId,
        input: {
          category_id: sampleCategoryId,
        },
        userId: 'user-owner-1',
      });

      expect(() => convertQuoteToCostResponseSchema.parse(response)).not.toThrow();

      // 1. Response verification
      expect(response.is_already_converted).toBe(false);
      expect(response.action).toBe('created_new');
      expect(response.cost_item_id).toBe(sampleCostItemId);

      // 2. Cost item values verification
      expect(costItemInsertedValues.vendorQuoteId).toBe(sampleQuoteId);
      expect(costItemInsertedValues.vendorId).toBe(sampleVendorId);
      expect(costItemInsertedValues.contractedAmount).toBe(180000000n);

      // 3. STRICT AT23 REQUIREMENT:
      // Verify that NO payments or payment schedules were created!
      // (insert should only be called for costItems and auditLogs)
      expect(mockDb.insert).toHaveBeenCalledTimes(2);

      // 4. Vendor quote and vendor status updated to 'selected'
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('Tier 2 Business Guard: returns existing cost item without creating duplicate when quote was already converted (AT23)', async () => {
      let selectCount = 0;

      const mockDb: any = {
        select: vi.fn().mockImplementation(() => ({
          from: vi.fn().mockReturnThis(),
          where: vi.fn().mockImplementation(() => ({
            for: vi.fn().mockImplementation(() => {
              // 1. Quote query
              return Promise.resolve([mockQuoteRow]);
            }),
            limit: vi.fn().mockImplementation(() => {
              selectCount++;
              // 2. Business check -> EXISTING COST ITEM FOUND!
              return Promise.resolve([
                {
                  id: sampleCostItemId,
                  name: 'White Palace Convention Center - Gói Tiệc Bạc',
                },
              ]);
            }),
          })),
        })),
        insert: vi.fn(), // MUST NOT BE CALLED!
        update: vi.fn(),
      };

      vi.spyOn(idempotencyService, 'withIdempotency').mockImplementation(async (opts: any) => {
        const result = await opts.execute();
        return { ...result, fromCache: false };
      });

      const response = await convertQuoteToCostItem(mockDb, {
        quoteId: sampleQuoteId,
        input: {
          category_id: sampleCategoryId,
        },
        userId: 'user-owner-1',
      });

      // Returns existing item, flags already_converted
      expect(response.is_already_converted).toBe(true);
      expect(response.action).toBe('already_existed');
      expect(response.cost_item_id).toBe(sampleCostItemId);

      // Crucial: No insertion performed!
      expect(mockDb.insert).not.toHaveBeenCalled();
    });
  });
});
