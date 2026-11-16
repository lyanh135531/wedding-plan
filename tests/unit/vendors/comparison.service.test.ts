import { describe, it, expect, vi } from 'vitest';
import {
  comparePackages,
  InvalidComparisonCountError,
} from '../../../src/lib/vendors/comparison.service';
import * as quotesRepo from '../../../src/lib/vendors/quotes.repository';
import { comparePackagesResponseSchema } from '../../../src/schemas/vendors';

describe('Comparison Service & Simulation Engine Unit Tests (AT24)', () => {
  const quote1Id = '11111111-1111-4111-8111-111111111111';
  const quote2Id = '22222222-2222-4222-8222-222222222222';
  const quote3Id = '33333333-3333-4333-8333-333333333333';
  const quote4Id = '44444444-4444-4444-8444-444444444444';
  const quote5Id = '55555555-5555-4555-8555-555555555555';

  const mockQuote1: quotesRepo.QuoteDetailDto = {
    id: quote1Id,
    vendor_id: '11111111-2222-4222-8222-111111111111',
    vendor_name: 'White Palace Hoàng Văn Thụ',
    vendor_service_type: 'venue',
    vendor_status: 'quoted',
    package_group_id: '99999999-9999-4999-8999-999999999999',
    version_number: 1,
    parent_quote_id: null,
    quote_name: 'Gói Tiệc Kim Cương',
    received_date: '2026-11-01',
    valid_until: '2026-12-01',
    total_amount: '50000000', // Base package: 50.000.000đ
    is_estimate: false,
    guest_count_assumption: 250,
    table_count_assumption: 25,
    terms: 'Bao gồm nước ngọt',
    includes: ['Bàn tiệc', 'Âm thanh'],
    excludes: ['Bia'],
    deposit_conditions: 'Cọc 30%',
    is_selected: false,
    created_by: 'user-1',
    created_at: '2026-11-01T10:00:00.000Z',
    updated_at: '2026-11-01T10:00:00.000Z',
    table_price: '6000000', // 6.000.000đ / bàn
    rental_fee: '15000000', // 15.000.000đ phí thuê sảnh
    capacity: 400, // Sức chứa max: 400 khách
    min_guests: 150, // Tối thiểu: 150 khách
    seats_per_table: 10,
    fees_inclusive: false, // Chưa gồm VAT 10% & phí PV 5%
  };

  const mockQuote2: quotesRepo.QuoteDetailDto = {
    ...mockQuote1,
    id: quote2Id,
    vendor_id: '22222222-3333-4333-8333-222222222222',
    vendor_name: 'The Adora Center',
    quote_name: 'Gói Tiệc Ruby',
    total_amount: '0', // 0 base amount
    table_price: '5500000', // 5.500.000đ / bàn
    rental_fee: '10000000', // 10.000.000đ
    capacity: 600,
    min_guests: 200,
    fees_inclusive: true, // ĐÃ GỒM THUẾ VÀ PHÍ PHỤC VỤ!
  };

  const mockQuoteUnpriced: quotesRepo.QuoteDetailDto = {
    ...mockQuote1,
    id: quote3Id,
    vendor_id: '33333333-4444-4444-8444-333333333333',
    vendor_name: 'Gala Center',
    quote_name: 'Gói Tiệc Mẫu (Chưa Chốt Giá)',
    total_amount: null, // "Chưa báo" (AT24)
    table_price: null, // Chưa có đơn giá bàn
    rental_fee: null,
  };

  // ---------------------------------------------------------------------------
  // 1. Comparison Count Validation (2 to 4 packages)
  // ---------------------------------------------------------------------------
  describe('Comparison Count Validation (PLAN §11.1)', () => {
    it('throws InvalidComparisonCountError (400) when less than 2 packages are selected', async () => {
      const mockDb: any = {};
      await expect(
        comparePackages(mockDb, { quoteIds: [quote1Id] })
      ).rejects.toThrow(InvalidComparisonCountError);
    });

    it('throws InvalidComparisonCountError (400) when more than 4 packages are selected', async () => {
      const mockDb: any = {};
      await expect(
        comparePackages(mockDb, {
          quoteIds: [quote1Id, quote2Id, quote3Id, quote4Id, quote5Id],
        })
      ).rejects.toThrow(InvalidComparisonCountError);
    });

    it('succeeds with 2, 3, or 4 packages', async () => {
      vi.spyOn(quotesRepo, 'getQuotesByIds').mockResolvedValue([mockQuote1, mockQuote2]);

      const mockDb: any = {};
      const result = await comparePackages(mockDb, {
        quoteIds: [quote1Id, quote2Id],
        tableCount: 20,
      });

      expect(result.packages).toHaveLength(2);
      expect(result.simulation_params.table_count).toBe(20);
      expect(() => comparePackagesResponseSchema.parse(result)).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Financial Simulation & Fee Transparency
  // ---------------------------------------------------------------------------
  describe('Fee Transparency & VAT / Service Charge Breakdown', () => {
    it('calculates transparent breakdown for non-inclusive package (fees_inclusive === false)', async () => {
      vi.spyOn(quotesRepo, 'getQuotesByIds').mockResolvedValue([mockQuote1, mockQuote2]);

      const mockDb: any = {};
      // Simulation: 20 tables
      const result = await comparePackages(mockDb, {
        quoteIds: [quote1Id, quote2Id],
        tableCount: 20,
        includeVatAndServiceFee: true,
      });

      const p1 = result.packages.find((p) => p.quote_id === quote1Id)!;

      // Table cost = 20 * 6.000.000 = 120.000.000đ
      expect(p1.simulation.table_costs).toBe('120000000');
      // Rental fee = 15.000.000đ
      expect(p1.simulation.rental_fee).toBe('15000000');
      // Base package = 50.000.000đ
      expect(p1.simulation.base_amount).toBe('50000000');

      // Subtotal = 50M + 120M + 15M = 185.000.000đ
      expect(p1.simulation.subtotal).toBe('185000000');

      // VAT 10% = 18.500.000đ
      expect(p1.simulation.estimated_vat).toBe('18500000');
      // Service charge 5% = 9.250.000đ
      expect(p1.simulation.estimated_service_charge).toBe('9250000');

      // Total gross = 185M + 18.5M + 9.25M = 212.750.000đ
      expect(p1.simulation.total_estimated).toBe('212750000');
      expect(p1.simulation.is_missing_price).toBe(false);
      expect(p1.simulation.missing_price_label).toBe('');
    });

    it('does NOT add extra VAT and service charge if package is already inclusive (fees_inclusive === true)', async () => {
      vi.spyOn(quotesRepo, 'getQuotesByIds').mockResolvedValue([mockQuote1, mockQuote2]);

      const mockDb: any = {};
      const result = await comparePackages(mockDb, {
        quoteIds: [quote1Id, quote2Id],
        tableCount: 20,
        includeVatAndServiceFee: true,
      });

      const p2 = result.packages.find((p) => p.quote_id === quote2Id)!;

      // Table cost = 20 * 5.500.000 = 110.000.000đ
      expect(p2.simulation.table_costs).toBe('110000000');
      // Subtotal = 0 + 110M + 10M = 120.000.000đ
      expect(p2.simulation.subtotal).toBe('120000000');

      // Already inclusive: VAT = 0, Service charge = 0
      expect(p2.simulation.estimated_vat).toBe('0');
      expect(p2.simulation.estimated_service_charge).toBe('0');
      // Total = subtotal
      expect(p2.simulation.total_estimated).toBe('120000000');
    });
  });

  // ---------------------------------------------------------------------------
  // 3. AT24: Missing Price Handling ("Chưa báo")
  // ---------------------------------------------------------------------------
  describe('AT24: Missing Prices Preserved as "Chưa báo", Not Fake 0 VND', () => {
    it('renders "Chưa báo" with is_missing_price: true and total_estimated: null when price is missing', async () => {
      vi.spyOn(quotesRepo, 'getQuotesByIds').mockResolvedValue([mockQuote1, mockQuoteUnpriced]);

      const mockDb: any = {};
      const result = await comparePackages(mockDb, {
        quoteIds: [quote1Id, quote3Id],
        tableCount: 20,
      });

      const unpricedPkg = result.packages.find((p) => p.quote_id === quote3Id)!;

      // AT24 Invariant Check
      expect(unpricedPkg.simulation.is_missing_price).toBe(true);
      expect(unpricedPkg.simulation.missing_price_label).toBe('Chưa báo');
      expect(unpricedPkg.simulation.total_estimated).toBeNull(); // NEVER 0n or "0"!
      expect(unpricedPkg.simulation.table_costs).toBeNull();
      expect(unpricedPkg.simulation.subtotal).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Capacity Evaluation
  // ---------------------------------------------------------------------------
  describe('Capacity Fit Evaluation (below_min, optimal, exceeds_max)', () => {
    it('evaluates below_min when simulated guests is less than min_guests', async () => {
      vi.spyOn(quotesRepo, 'getQuotesByIds').mockResolvedValue([mockQuote1, mockQuote2]);

      const mockDb: any = {};
      // 10 tables * 10 seats = 100 guests < min_guests (150 for mockQuote1)
      const result = await comparePackages(mockDb, {
        quoteIds: [quote1Id, quote2Id],
        tableCount: 10,
      });

      const p1 = result.packages.find((p) => p.quote_id === quote1Id)!;
      expect(p1.capacity_fit).toBe('below_min');
      expect(p1.capacity_warning).toContain('thấp hơn mức tối thiểu');
    });

    it('evaluates optimal when simulated guests falls within capacity range', async () => {
      vi.spyOn(quotesRepo, 'getQuotesByIds').mockResolvedValue([mockQuote1, mockQuote2]);

      const mockDb: any = {};
      // 25 tables * 10 seats = 250 guests (within [150, 400] for mockQuote1)
      const result = await comparePackages(mockDb, {
        quoteIds: [quote1Id, quote2Id],
        tableCount: 25,
      });

      const p1 = result.packages.find((p) => p.quote_id === quote1Id)!;
      expect(p1.capacity_fit).toBe('optimal');
      expect(p1.capacity_warning).toBeNull();
    });

    it('evaluates exceeds_max when simulated guests exceeds venue capacity', async () => {
      vi.spyOn(quotesRepo, 'getQuotesByIds').mockResolvedValue([mockQuote1, mockQuote2]);

      const mockDb: any = {};
      // 45 tables * 10 seats = 450 guests > capacity (400 for mockQuote1)
      const result = await comparePackages(mockDb, {
        quoteIds: [quote1Id, quote2Id],
        tableCount: 45,
      });

      const p1 = result.packages.find((p) => p.quote_id === quote1Id)!;
      expect(p1.capacity_fit).toBe('exceeds_max');
      expect(p1.capacity_warning).toContain('vượt quá sức chứa tối đa');
    });
  });
});
