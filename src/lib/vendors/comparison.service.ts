import { TxDb } from './vendors.repository';
import { getQuotesByIds, QuoteDetailDto, QuoteNotFoundError } from './quotes.repository';
import {
  ComparePackagesRequest,
  ComparePackagesResponse,
  ComparePackageItemDto,
  CapacityFit,
} from '@/schemas/vendors';

// -----------------------------------------------------------------------------
// EXCEPTIONS
// -----------------------------------------------------------------------------

export class InvalidComparisonCountError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Chỉ được so sánh từ 2 đến 4 gói báo giá cùng lúc') {
    super(message);
    this.name = 'InvalidComparisonCountError';
  }
}

// -----------------------------------------------------------------------------
// COMPARISON SERVICE
// -----------------------------------------------------------------------------

export interface ComparePackagesParams {
  quoteIds: string[];
  tableCount?: number;
  guestCount?: number;
  includeVatAndServiceFee?: boolean;
}

/**
 * Thuật toán so sánh gói dịch vụ & địa điểm (PLAN §11.1, §11.2, AT24)
 * - Nhận từ 2 đến 4 gói báo giá (ném InvalidComparisonCountError nếu vi phạm).
 * - Mô phỏng trên cùng kịch bản giả định: số bàn, số khách.
 * - Đánh giá sức chứa: below_min, optimal, exceeds_max.
 * - Bóc tách thuế VAT (10%) và phí dịch vụ (5%) nếu fees_inclusive === false.
 * - Báo giá thiếu giá hiển thị "Chưa báo" với is_missing_price: true, KHÔNG tính 0 VND giả (AT24).
 */
export async function comparePackages(
  txDb: TxDb,
  params: ComparePackagesParams
): Promise<ComparePackagesResponse> {
  const { quoteIds, tableCount = 20, includeVatAndServiceFee = true } = params;

  if (!quoteIds || quoteIds.length < 2 || quoteIds.length > 4) {
    throw new InvalidComparisonCountError();
  }

  // Lấy chi tiết các báo giá kèm cấu hình nhà cung cấp
  const quotes = await getQuotesByIds(txDb, quoteIds);

  if (quotes.length !== quoteIds.length) {
    throw new QuoteNotFoundError(
      `Không tìm thấy đầy đủ các báo giá yêu cầu (tìm thấy ${quotes.length}/${quoteIds.length})`
    );
  }

  // Sắp xếp lại danh sách kết quả theo đúng thứ tự quoteIds được yêu cầu
  const quotesMap = new Map<string, QuoteDetailDto>();
  for (const q of quotes) {
    quotesMap.set(q.id, q);
  }

  const sortedQuotes = quoteIds.map((id) => quotesMap.get(id)!);

  // Kịch bản mô phỏng số khách (mặc định lấy theo số bàn * số ghế/bàn hoặc 10)
  const defaultSeatsPerTable = 10;
  const effectiveGuestCount =
    params.guestCount && params.guestCount > 0
      ? params.guestCount
      : tableCount * defaultSeatsPerTable;

  const comparedPackages: ComparePackageItemDto[] = sortedQuotes.map((quote) => {
    const seatsPerTable = quote.seats_per_table || defaultSeatsPerTable;
    const packageGuestAssumption = tableCount * seatsPerTable;
    const guestCountForEvaluation = params.guestCount && params.guestCount > 0
      ? params.guestCount
      : packageGuestAssumption;

    // 1. Đánh giá sức chứa (Capacity Fit)
    let capacityFit: CapacityFit = 'optimal';
    let capacityWarning: string | null = null;

    if (quote.min_guests !== null && quote.min_guests !== undefined && guestCountForEvaluation < quote.min_guests) {
      capacityFit = 'below_min';
      capacityWarning = `Số khách giả định (${guestCountForEvaluation}) thấp hơn mức tối thiểu (${quote.min_guests} khách)`;
    } else if (quote.capacity !== null && quote.capacity !== undefined && guestCountForEvaluation > quote.capacity) {
      capacityFit = 'exceeds_max';
      capacityWarning = `Số khách giả định (${guestCountForEvaluation}) vượt quá sức chứa tối đa (${quote.capacity} khách) của sảnh tiệc`;
    } else if (quote.min_guests === null && quote.capacity === null) {
      capacityFit = 'unspecified';
      capacityWarning = null;
    }

    // 2. Thành phần chi phí
    const baseAmountBigInt = quote.total_amount ? BigInt(quote.total_amount) : null;
    const tablePriceBigInt = quote.table_price ? BigInt(quote.table_price) : null;
    const rentalFeeBigInt = quote.rental_fee ? BigInt(quote.rental_fee) : null;

    const tableCostsBigInt = tablePriceBigInt !== null ? BigInt(tableCount) * tablePriceBigInt : null;

    // AT24: Kiểm tra thiếu giá
    // Nếu cả baseAmount và tableCosts đều null, gói không thể tính toán tổng -> "Chưa báo"
    const isMissingPrice = baseAmountBigInt === null && tableCostsBigInt === null;

    let subtotalBigInt: bigint | null = null;
    let estimatedVatBigInt: bigint | null = null;
    let estimatedServiceChargeBigInt: bigint | null = null;
    let totalEstimatedBigInt: bigint | null = null;

    if (!isMissingPrice) {
      // Subtotal = base amount (nếu có) + table costs (nếu có) + rental fee (nếu có)
      subtotalBigInt = (baseAmountBigInt ?? 0n) + (tableCostsBigInt ?? 0n) + (rentalFeeBigInt ?? 0n);

      if (includeVatAndServiceFee) {
        if (!quote.fees_inclusive) {
          // Chưa gồm VAT và phí PV: VAT 10%, Phí phục vụ 5%
          estimatedVatBigInt = (subtotalBigInt * 10n) / 100n;
          estimatedServiceChargeBigInt = (subtotalBigInt * 5n) / 100n;
          totalEstimatedBigInt = subtotalBigInt + estimatedVatBigInt + estimatedServiceChargeBigInt;
        } else {
          // Đã gồm thuế và phí
          estimatedVatBigInt = 0n;
          estimatedServiceChargeBigInt = 0n;
          totalEstimatedBigInt = subtotalBigInt;
        }
      } else {
        estimatedVatBigInt = 0n;
        estimatedServiceChargeBigInt = 0n;
        totalEstimatedBigInt = subtotalBigInt;
      }
    }

    return {
      quote_id: quote.id,
      vendor_id: quote.vendor_id,
      vendor_name: quote.vendor_name,
      package_name: quote.quote_name,
      version_number: quote.version_number,
      received_date: quote.received_date,
      rental_fee: quote.rental_fee,
      table_price: quote.table_price,
      total_amount: quote.total_amount,
      capacity_fit: capacityFit,
      capacity_warning: capacityWarning,
      simulation: {
        table_count: tableCount,
        guest_count: guestCountForEvaluation,
        base_amount: baseAmountBigInt !== null ? baseAmountBigInt.toString() : null,
        table_costs: tableCostsBigInt !== null ? tableCostsBigInt.toString() : null,
        rental_fee: rentalFeeBigInt !== null ? rentalFeeBigInt.toString() : null,
        subtotal: subtotalBigInt !== null ? subtotalBigInt.toString() : null,
        estimated_vat: estimatedVatBigInt !== null ? estimatedVatBigInt.toString() : null,
        estimated_service_charge:
          estimatedServiceChargeBigInt !== null ? estimatedServiceChargeBigInt.toString() : null,
        total_estimated: totalEstimatedBigInt !== null ? totalEstimatedBigInt.toString() : null,
        is_missing_price: isMissingPrice,
        missing_price_label: isMissingPrice ? 'Chưa báo' : '',
      },
      fees_inclusive: quote.fees_inclusive,
      includes: quote.includes,
      excludes: quote.excludes,
      deposit_conditions: quote.deposit_conditions ?? null,
      terms: quote.terms ?? null,
    };
  });

  return {
    simulation_params: {
      table_count: tableCount,
      guest_count: effectiveGuestCount,
      include_vat_and_service_fee: includeVatAndServiceFee,
    },
    packages: comparedPackages,
  };
}
