import { eq, and, sql } from 'drizzle-orm';
import { TxDb, VendorNotFoundError } from './vendors.repository';
import { QuoteNotFoundError } from './quotes.repository';
import {
  vendorQuotes,
  vendors,
  costItems,
  budgetCategories,
  events,
  auditLogs,
} from '@/db/schema';
import {
  QuoteToCostPreviewResponse,
  ConvertQuoteToCostInput,
  ConvertQuoteToCostResponse,
  CostStatus,
} from '@/schemas/vendors';
import { withIdempotency } from '@/lib/finance/idempotency.service';

// -----------------------------------------------------------------------------
// QUOTE TO COST SERVICE
// -----------------------------------------------------------------------------

export interface GeneratePreviewParams {
  quoteId: string;
}

export interface ConvertQuoteToCostParams {
  quoteId: string;
  input: ConvertQuoteToCostInput;
  userId: string;
  idempotencyKey?: string | null;
}

/**
 * 1. Tạo dữ liệu xem trước chuyển đổi báo giá thành khoản chi (PLAN §11.1, FL14).
 * - Kiểm tra trước xem báo giá đã được chuyển đổi thành khoản chi hay chưa (AT23).
 * - Nếu đã chuyển đổi: trả về is_already_converted = true kèm thông tin khoản chi đã có.
 * - Gợi ý tên khoản chi, số tiền, danh mục ngân sách và buổi lễ.
 */
export async function generateQuoteToCostPreview(
  txDb: TxDb,
  params: GeneratePreviewParams
): Promise<QuoteToCostPreviewResponse> {
  const { quoteId } = params;

  // 1. Lấy thông tin báo giá kèm nhà cung cấp
  const [record] = await txDb
    .select({
      quote: vendorQuotes,
      vendor: vendors,
    })
    .from(vendorQuotes)
    .innerJoin(vendors, eq(vendorQuotes.vendorId, vendors.id))
    .where(eq(vendorQuotes.id, quoteId))
    .limit(1);

  if (!record) {
    throw new QuoteNotFoundError();
  }

  const { quote, vendor } = record;

  // 2. AT23 Business Check: Kiểm tra xem quoteId này đã liên kết với cost_item nào chưa
  const [existingCostItem] = await txDb
    .select({
      id: costItems.id,
      name: costItems.name,
      status: costItems.status,
      contractedAmount: costItems.contractedAmount,
    })
    .from(costItems)
    .where(eq(costItems.vendorQuoteId, quoteId))
    .limit(1);

  // 3. Lấy danh sách hạng mục ngân sách khả dụng
  const categoriesList = await txDb
    .select({
      id: budgetCategories.id,
      name: budgetCategories.name,
    })
    .from(budgetCategories)
    .orderBy(budgetCategories.defaultOrder, budgetCategories.name);

  // 4. Lấy danh sách buổi lễ khả dụng
  const eventsList = await txDb
    .select({
      id: events.id,
      title: events.title,
    })
    .from(events)
    .orderBy(events.startTime);

  // 5. Xác định số tiền gợi ý (từ quote.totalAmount hoặc vendor.rentalFee)
  const suggestedAmountBigInt = quote.totalAmount ?? vendor.rentalFee ?? null;
  const suggestedAmount = suggestedAmountBigInt !== null ? suggestedAmountBigInt.toString() : null;
  const isPriceMissing = suggestedAmount === null;
  const suggestedCostItemName = `${vendor.name} - ${quote.quoteName}`;

  return {
    quote_id: quote.id,
    vendor_id: vendor.id,
    vendor_name: vendor.name,
    quote_name: quote.quoteName,
    version_number: quote.versionNumber,
    suggested_cost_item_name: suggestedCostItemName,
    suggested_amount: suggestedAmount,
    is_price_missing: isPriceMissing,
    is_already_converted: Boolean(existingCostItem),
    existing_cost_item: existingCostItem
      ? {
          id: existingCostItem.id,
          name: existingCostItem.name,
          status: existingCostItem.status as CostStatus,
          contracted_amount:
            existingCostItem.contractedAmount !== null
              ? existingCostItem.contractedAmount.toString()
              : null,
        }
      : null,
    available_categories: categoriesList,
    available_events: eventsList,
  };
}

/**
 * 2. Thực hiện chuyển đổi báo giá thành khoản chi với 3-tier Idempotency Guard (AT23).
 *
 * 3 Tầng Bảo Vệ Chống Tạo Trùng Lặp (AT23):
 *  - Tầng 1: Idempotency wrapper withIdempotency (chống double-click/mạng lặp lại cùng key).
 *  - Tầng 2: Nghiệp vụ trong giao dịch: kiểm tra cost_items.vendor_quote_id = quoteId.
 *            Nếu đã tồn tại, trả về ngay khoản chi hiện hữu ("Mở khoản chi"), KHÔNG tạo mới.
 *  - Tầng 3: Khóa duy nhất cơ sở dữ liệu: UNIQUE INDEX ON cost_items(vendor_quote_id) WHERE vendor_quote_id IS NOT NULL.
 *
 * YÊU CẦU NGHIÊM NGẶT AT23:
 *  - TUYỆT ĐỐI KHÔNG tự động tạo giao dịch thanh toán (payments) trong hàm này.
 */
export async function convertQuoteToCostItem(
  txDb: TxDb,
  params: ConvertQuoteToCostParams
): Promise<ConvertQuoteToCostResponse> {
  const { quoteId, input, userId, idempotencyKey } = params;

  const result = await withIdempotency<ConvertQuoteToCostResponse>({
    key: idempotencyKey,
    userId,
    operationType: 'convert_quote_to_cost',
    payload: { quoteId, input },
    execute: async () => {
      // 1. Khóa và lấy thông tin báo giá
      const [quote] = await txDb
        .select()
        .from(vendorQuotes)
        .where(eq(vendorQuotes.id, quoteId))
        .for('update');

      if (!quote) {
        throw new QuoteNotFoundError();
      }

      // 2. AT23 Tầng 2 (Business Check): Kiểm tra xem khoản chi đã được tạo từ quote này chưa
      const [existingCostItem] = await txDb
        .select({
          id: costItems.id,
          name: costItems.name,
        })
        .from(costItems)
        .where(eq(costItems.vendorQuoteId, quoteId))
        .limit(1);

      if (existingCostItem) {
        // Đã tồn tại -> Trả về khoản chi cũ ("Mở khoản chi"), ngăn chặn tạo trùng
        return {
          status: 200,
          body: {
            is_already_converted: true,
            cost_item_id: existingCostItem.id,
            cost_item_name: existingCostItem.name,
            action: 'already_existed' as const,
          },
        };
      }

      // 3. Lấy thông tin nhà cung cấp
      const [vendor] = await txDb
        .select()
        .from(vendors)
        .where(eq(vendors.id, quote.vendorId))
        .limit(1);

      if (!vendor) {
        throw new VendorNotFoundError();
      }

      const costItemName = input.name?.trim() || `${vendor.name} - ${quote.quoteName}`;
      const contractedAmount = quote.totalAmount ?? vendor.rentalFee ?? null;

      let createdCostItem: typeof costItems.$inferSelect;

      // 4. AT23 Tầng 3 (DB Guard): Bắt ngoại lệ duplicate key nếu có va chạm đồng thời
      try {
        const [inserted] = await txDb
          .insert(costItems)
          .values({
            name: costItemName,
            categoryId: input.category_id,
            eventId: input.event_id || null,
            vendorId: quote.vendorId,
            vendorQuoteId: quote.id, // AT23 Partial Unique Index
            vendorName: vendor.name,
            vendorPhone: vendor.phone,
            vendorContact: vendor.contactPerson,
            contractedAmount,
            estimatedAmount: contractedAmount,
            finalSettlementAmount: null,
            status: input.status || 'contracted',
            inChargeUserId: input.in_charge_user_id || null,
            notes:
              input.notes ||
              `Khởi tạo từ báo giá gói: ${quote.quoteName} (Phiên bản v${quote.versionNumber})`,
            version: 1,
          })
          .returning();

        createdCostItem = inserted;
      } catch (err: any) {
        // Nếu vi phạm partial unique index cost_items_vendor_quote_id_unique
        if (err?.code === '23505' || err?.message?.includes('cost_items_vendor_quote_id')) {
          const [found] = await txDb
            .select({
              id: costItems.id,
              name: costItems.name,
            })
            .from(costItems)
            .where(eq(costItems.vendorQuoteId, quoteId))
            .limit(1);

          if (found) {
            return {
              status: 200,
              body: {
                is_already_converted: true,
                cost_item_id: found.id,
                cost_item_name: found.name,
                action: 'already_existed' as const,
              },
            };
          }
        }
        throw err;
      }

      // 5. Cập nhật báo giá thành 'selected' và bỏ chọn các báo giá khác của vendor này
      await txDb
        .update(vendorQuotes)
        .set({ isSelected: false, updatedAt: new Date() })
        .where(eq(vendorQuotes.vendorId, quote.vendorId));

      await txDb
        .update(vendorQuotes)
        .set({ isSelected: true, updatedAt: new Date() })
        .where(eq(vendorQuotes.id, quote.id));

      // 6. Cập nhật trạng thái nhà cung cấp thành 'selected'
      await txDb
        .update(vendors)
        .set({ status: 'selected', updatedAt: new Date() })
        .where(eq(vendors.id, vendor.id));

      // 7. Ghi vết kiểm toán (Audit Trail)
      await txDb.insert(auditLogs).values({
        userId,
        action: 'CONVERT_QUOTE_TO_COST',
        entityType: 'cost_items',
        entityId: createdCostItem.id,
        afterState: {
          costItemId: createdCostItem.id,
          vendorQuoteId: quote.id,
          vendorId: vendor.id,
          amount: contractedAmount !== null ? contractedAmount.toString() : null,
        },
      });

      // STRICT AT23: TUYỆT ĐỐI KHÔNG TỰ ĐỘNG TẠO GIAO DỊCH THANH TOÁN (PAYMENTS)
      return {
        status: 201,
        body: {
          is_already_converted: false,
          cost_item_id: createdCostItem.id,
          cost_item_name: createdCostItem.name,
          action: 'created_new' as const,
        },
      };
    },
  });

  return result.body;
}
