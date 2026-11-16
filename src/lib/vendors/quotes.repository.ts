import { eq, and, sql, desc, asc, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import crypto from 'crypto';
import * as schema from '@/db/schema';
import { vendorQuotes, vendors, auditLogs } from '@/db/schema';
import {
  QuoteDto,
  CreateQuoteInput,
  ReviseQuoteInput,
} from '@/schemas/vendors';
import { VendorNotFoundError } from './vendors.repository';

export type TxDb = NodePgDatabase<typeof schema>;

// -----------------------------------------------------------------------------
// EXCEPTIONS
// -----------------------------------------------------------------------------

export class QuoteNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy báo giá') {
    super(message);
    this.name = 'QuoteNotFoundError';
  }
}

// -----------------------------------------------------------------------------
// DTOs & MAPPERS
// -----------------------------------------------------------------------------

export interface QuoteDetailDto extends QuoteDto {
  vendor_name: string;
  vendor_service_type: string;
  vendor_status: string;
  table_price: string | null;
  rental_fee: string | null;
  capacity: number | null;
  min_guests: number | null;
  seats_per_table: number | null;
  fees_inclusive: boolean;
}

function parseBigIntOrNull(val: string | null | undefined): bigint | null {
  if (val === null || val === undefined || val === '') return null;
  return BigInt(val);
}

function mapToQuoteDto(row: typeof vendorQuotes.$inferSelect): QuoteDto {
  return {
    id: row.id,
    vendor_id: row.vendorId,
    package_group_id: row.packageGroupId,
    version_number: row.versionNumber,
    parent_quote_id: row.parentQuoteId,
    quote_name: row.quoteName,
    received_date: row.receivedDate,
    valid_until: row.validUntil,
    // AT24: total_amount null represents "Chưa báo", never default to 0n / "0"
    total_amount: row.totalAmount !== null && row.totalAmount !== undefined ? row.totalAmount.toString() : null,
    is_estimate: row.isEstimate,
    guest_count_assumption: row.guestCountAssumption,
    table_count_assumption: row.tableCountAssumption,
    terms: row.terms,
    includes: row.includes ?? [],
    excludes: row.excludes ?? [],
    deposit_conditions: row.depositConditions,
    is_selected: row.isSelected,
    created_by: row.createdBy,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

// -----------------------------------------------------------------------------
// REPOSITORY METHODS
// -----------------------------------------------------------------------------

/**
 * 1. Lấy danh sách báo giá theo nhà cung cấp.
 * Nếu options.includeSuperseded === false (mặc định), chỉ lấy phiên bản mới nhất của mỗi package_group_id.
 */
export async function listQuotesByVendorId(
  txDb: TxDb,
  vendorId: string,
  options: { includeSuperseded?: boolean } = {}
): Promise<QuoteDto[]> {
  const { includeSuperseded = false } = options;

  const rows = await txDb
    .select()
    .from(vendorQuotes)
    .where(eq(vendorQuotes.vendorId, vendorId))
    .orderBy(desc(vendorQuotes.versionNumber));

  if (includeSuperseded) {
    return rows.map(mapToQuoteDto);
  }

  // Lọc chỉ giữ lại phiên bản versionNumber cao nhất cho mỗi packageGroupId
  const latestByGroup = new Map<string, typeof vendorQuotes.$inferSelect>();
  for (const row of rows) {
    const existing = latestByGroup.get(row.packageGroupId);
    if (!existing || row.versionNumber > existing.versionNumber) {
      latestByGroup.set(row.packageGroupId, row);
    }
  }

  return Array.from(latestByGroup.values()).map(mapToQuoteDto);
}

/**
 * 2. Lấy chi tiết báo giá theo ID.
 */
export async function getQuoteById(
  txDb: TxDb,
  quoteId: string
): Promise<QuoteDto | null> {
  const [row] = await txDb
    .select()
    .from(vendorQuotes)
    .where(eq(vendorQuotes.id, quoteId))
    .limit(1);

  if (!row) return null;
  return mapToQuoteDto(row);
}

/**
 * 3. Lấy toàn bộ lịch sử các phiên bản của một gói dịch vụ (AT24).
 * Sắp xếp theo version_number tăng dần từ phiên bản v1 đến mới nhất.
 */
export async function getQuoteVersionHistory(
  txDb: TxDb,
  packageGroupId: string
): Promise<QuoteDto[]> {
  const rows = await txDb
    .select()
    .from(vendorQuotes)
    .where(eq(vendorQuotes.packageGroupId, packageGroupId))
    .orderBy(asc(vendorQuotes.versionNumber));

  return rows.map(mapToQuoteDto);
}

/**
 * 4. Tạo báo giá lần đầu (version 1) cho nhà cung cấp.
 * AT24: total_amount là null nếu chưa có giá, không mặc định thành 0n.
 */
export async function createInitialQuote(
  txDb: TxDb,
  vendorId: string,
  input: CreateQuoteInput,
  userId: string
): Promise<QuoteDto> {
  const [vendor] = await txDb
    .select({ id: vendors.id, status: vendors.status })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    throw new VendorNotFoundError();
  }

  // Lấy version_number tiếp theo cho vendor này (thỏa mãn UNIQUE (vendor_id, version_number))
  const [maxVer] = await txDb
    .select({ max: sql<number>`COALESCE(MAX(${vendorQuotes.versionNumber}), 0)` })
    .from(vendorQuotes)
    .where(eq(vendorQuotes.vendorId, vendorId));

  const nextVersion = (maxVer?.max ?? 0) + 1;
  const packageGroupId = crypto.randomUUID();
  const totalAmount = parseBigIntOrNull(input.total_amount);

  const [created] = await txDb
    .insert(vendorQuotes)
    .values({
      vendorId,
      packageGroupId,
      versionNumber: nextVersion,
      parentQuoteId: null,
      quoteName: input.quote_name,
      receivedDate: input.received_date,
      validUntil: input.valid_until || null,
      totalAmount,
      isEstimate: input.is_estimate ?? false,
      guestCountAssumption: input.guest_count_assumption ?? null,
      tableCountAssumption: input.table_count_assumption ?? null,
      terms: input.terms || null,
      includes: input.includes ?? [],
      excludes: input.excludes ?? [],
      depositConditions: input.deposit_conditions || null,
      isSelected: false,
      createdBy: userId,
    })
    .returning();

  // Cập nhật trạng thái vendor thành 'quoted' nếu đang là 'researching' hoặc 'contacted'
  if (vendor.status === 'researching' || vendor.status === 'contacted') {
    await txDb
      .update(vendors)
      .set({ status: 'quoted', updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));
  }

  // Audit log
  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'vendor_quotes',
    entityId: created.id,
    afterState: {
      id: created.id,
      vendorId,
      quoteName: created.quoteName,
      versionNumber: created.versionNumber,
      totalAmount: created.totalAmount !== null ? created.totalAmount.toString() : null,
    },
  });

  return mapToQuoteDto(created);
}

/**
 * 5. Bất biến phiên bản báo giá (AT24):
 * Tạo phiên bản báo giá mới kế thừa từ phiên bản hiện tại, tăng version_number,
 * trỏ parent_quote_id = baseQuote.id. Bản ghi báo giá cũ TUYỆT ĐỐI không bị ghi đè.
 */
export async function createNewQuoteVersion(
  txDb: TxDb,
  baseQuoteId: string,
  input: ReviseQuoteInput,
  userId: string
): Promise<QuoteDto> {
  const [baseQuote] = await txDb
    .select()
    .from(vendorQuotes)
    .where(eq(vendorQuotes.id, baseQuoteId))
    .limit(1);

  if (!baseQuote) {
    throw new QuoteNotFoundError();
  }

  // Lấy version_number tiếp theo cho vendor này
  const [maxVer] = await txDb
    .select({ max: sql<number>`COALESCE(MAX(${vendorQuotes.versionNumber}), 0)` })
    .from(vendorQuotes)
    .where(eq(vendorQuotes.vendorId, baseQuote.vendorId));

  const nextVersion = (maxVer?.max ?? 0) + 1;

  // Xác định số tiền (nếu input có truyền thì dùng, nếu không kế thừa từ bản cũ)
  const totalAmount =
    input.total_amount !== undefined
      ? parseBigIntOrNull(input.total_amount)
      : baseQuote.totalAmount;

  const [newVersion] = await txDb
    .insert(vendorQuotes)
    .values({
      vendorId: baseQuote.vendorId,
      packageGroupId: baseQuote.packageGroupId,
      versionNumber: nextVersion,
      parentQuoteId: baseQuote.id, // Vết cha con phiên bản AT24
      quoteName: input.quote_name ?? baseQuote.quoteName,
      receivedDate: input.received_date ?? baseQuote.receivedDate,
      validUntil: input.valid_until !== undefined ? (input.valid_until || null) : baseQuote.validUntil,
      totalAmount,
      isEstimate: input.is_estimate !== undefined ? input.is_estimate : baseQuote.isEstimate,
      guestCountAssumption:
        input.guest_count_assumption !== undefined
          ? input.guest_count_assumption
          : baseQuote.guestCountAssumption,
      tableCountAssumption:
        input.table_count_assumption !== undefined
          ? input.table_count_assumption
          : baseQuote.tableCountAssumption,
      terms: input.terms !== undefined ? input.terms : baseQuote.terms,
      includes: input.includes ?? baseQuote.includes,
      excludes: input.excludes ?? baseQuote.excludes,
      depositConditions:
        input.deposit_conditions !== undefined
          ? input.deposit_conditions
          : baseQuote.depositConditions,
      isSelected: false,
      createdBy: userId,
    })
    .returning();

  // Audit log ghi nhận vết tạo phiên bản mới
  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE_VERSION',
    entityType: 'vendor_quotes',
    entityId: newVersion.id,
    beforeState: {
      parentQuoteId: baseQuote.id,
      previousVersionNumber: baseQuote.versionNumber,
      previousTotalAmount: baseQuote.totalAmount !== null ? baseQuote.totalAmount.toString() : null,
    },
    afterState: {
      newQuoteId: newVersion.id,
      newVersionNumber: newVersion.versionNumber,
      revisionReason: input.revision_reason || null,
      newTotalAmount: newVersion.totalAmount !== null ? newVersion.totalAmount.toString() : null,
    },
  });

  return mapToQuoteDto(newVersion);
}

/**
 * 6. Chọn báo giá làm cơ sở hợp đồng chính thức (selectQuote).
 * Đánh dấu quote được chọn is_selected = true, bỏ chọn các quote khác của vendor,
 * và cập nhật vendor.status = 'selected'.
 */
export async function selectQuote(
  txDb: TxDb,
  vendorId: string,
  quoteId: string,
  userId: string
): Promise<QuoteDto> {
  const [targetQuote] = await txDb
    .select()
    .from(vendorQuotes)
    .where(and(eq(vendorQuotes.id, quoteId), eq(vendorQuotes.vendorId, vendorId)))
    .limit(1);

  if (!targetQuote) {
    throw new QuoteNotFoundError();
  }

  // 1. Bỏ chọn tất cả báo giá khác của vendor này
  await txDb
    .update(vendorQuotes)
    .set({ isSelected: false, updatedAt: new Date() })
    .where(eq(vendorQuotes.vendorId, vendorId));

  // 2. Chọn báo giá này
  const [selected] = await txDb
    .update(vendorQuotes)
    .set({ isSelected: true, updatedAt: new Date() })
    .where(eq(vendorQuotes.id, quoteId))
    .returning();

  // 3. Cập nhật vendor.status = 'selected'
  await txDb
    .update(vendors)
    .set({ status: 'selected', updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));

  // Audit log
  await txDb.insert(auditLogs).values({
    userId,
    action: 'UPDATE',
    entityType: 'vendor_quotes',
    entityId: quoteId,
    afterState: {
      isSelected: true,
      vendorId,
      status: 'selected',
    },
  });

  return mapToQuoteDto(selected);
}

/**
 * 7. Lấy danh sách báo giá theo mảng IDs kèm thông tin cấu hình nhà cung cấp.
 * Dùng cho dịch vụ so sánh 2-4 gói (comparison.service.ts).
 */
export async function getQuotesByIds(
  txDb: TxDb,
  quoteIds: string[]
): Promise<QuoteDetailDto[]> {
  if (quoteIds.length === 0) return [];

  const rows = await txDb
    .select({
      quote: vendorQuotes,
      vendor: vendors,
    })
    .from(vendorQuotes)
    .innerJoin(vendors, eq(vendorQuotes.vendorId, vendors.id))
    .where(inArray(vendorQuotes.id, quoteIds));

  return rows.map(({ quote, vendor }) => {
    const baseDto = mapToQuoteDto(quote);
    return {
      ...baseDto,
      vendor_name: vendor.name,
      vendor_service_type: vendor.serviceType,
      vendor_status: vendor.status,
      table_price: vendor.tablePrice !== null && vendor.tablePrice !== undefined ? vendor.tablePrice.toString() : null,
      rental_fee: vendor.rentalFee !== null && vendor.rentalFee !== undefined ? vendor.rentalFee.toString() : null,
      capacity: vendor.capacity,
      min_guests: vendor.minGuests,
      seats_per_table: vendor.seatsPerTable,
      fees_inclusive: vendor.feesInclusive,
    };
  });
}
