import { eq, and, sql, desc, asc, not, ne, inArray } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '@/db/schema';
import { vendors, contacts, vendorQuotes, costItems, auditLogs } from '@/db/schema';
import {
  VendorDto,
  VendorSummaryDto,
  CreateVendorInput,
  UpdateVendorInput,
  ContactDto,
  CreateContactInput,
  ListVendorsQuery,
  VendorServiceType,
  VendorStatus,
} from '@/schemas/vendors';

export type TxDb = NodePgDatabase<typeof schema>;

// -----------------------------------------------------------------------------
// EXCEPTIONS
// -----------------------------------------------------------------------------

export class VendorNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy nhà cung cấp') {
    super(message);
    this.name = 'VendorNotFoundError';
  }
}

export class VendorHasActiveCostItemsError extends Error {
  readonly statusCode = 400;
  constructor(message = 'Không thể xóa nhà cung cấp đã có khoản chi hoặc hợp đồng liên kết') {
    super(message);
    this.name = 'VendorHasActiveCostItemsError';
  }
}

export class ContactNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy người liên hệ của nhà cung cấp') {
    super(message);
    this.name = 'ContactNotFoundError';
  }
}

export class VersionConflictError extends Error {
  readonly statusCode = 409;
  constructor(message = 'Dữ liệu đã bị thay đổi bởi người khác, vui lòng tải lại') {
    super(message);
    this.name = 'VersionConflictError';
  }
}

// -----------------------------------------------------------------------------
// HELPER MAPPERS
// -----------------------------------------------------------------------------

function parseBigIntOrNull(val: string | null | undefined): bigint | null {
  if (val === null || val === undefined || val === '') return null;
  return BigInt(val);
}

function mapToVendorDto(row: typeof vendors.$inferSelect, role: 'owner' | 'family_view' = 'owner'): VendorDto {
  const isFamilyView = role === 'family_view';

  return {
    id: row.id,
    name: row.name,
    service_type: row.serviceType as VendorServiceType,
    status: row.status as VendorStatus,
    contact_person: row.contactPerson,
    phone: row.phone,
    email: row.email,
    address: row.address,
    map_url: row.mapUrl,
    website: row.website,
    // AT03, AT41: Mask private notes & confidential fee notes for family_view
    notes: isFamilyView ? null : row.notes,
    rating: row.rating,
    capacity: row.capacity,
    min_guests: row.minGuests,
    table_price: row.tablePrice !== null && row.tablePrice !== undefined ? row.tablePrice.toString() : null,
    seats_per_table: row.seatsPerTable,
    rental_fee: row.rentalFee !== null && row.rentalFee !== undefined ? row.rentalFee.toString() : null,
    fees_inclusive: row.feesInclusive,
    prep_time: row.prepTime,
    end_time: row.endTime,
    parking_notes: row.parkingNotes,
    rain_plan: row.rainPlan,
    decor_audio_rules: row.decorAudioRules,
    extra_fees_notes: isFamilyView ? null : row.extraFeesNotes,
    version: row.version,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

function mapToContactDto(row: typeof contacts.$inferSelect): ContactDto {
  return {
    id: row.id,
    vendor_id: row.vendorId,
    name: row.name,
    role: row.role,
    phone: row.phone,
    email: row.email,
    is_primary: row.isPrimary,
    notes: row.notes,
    created_at: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
    updated_at: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : String(row.updatedAt),
  };
}

// -----------------------------------------------------------------------------
// VENDOR REPOSITORY METHODS
// -----------------------------------------------------------------------------

export interface ListVendorsParams {
  serviceType?: VendorServiceType;
  status?: VendorStatus;
  search?: string;
  page?: number;
  limit?: number;
  role?: 'owner' | 'family_view';
}

/**
 * 1. Danh sách nhà cung cấp có lọc, phân trang và tìm kiếm unaccent Tiếng Việt.
 * AT03, AT41: Tự động che giấu ghi chú mật nếu role === 'family_view'.
 */
export async function listVendors(
  txDb: TxDb,
  params: ListVendorsParams = {}
): Promise<VendorDto[]> {
  const {
    serviceType,
    status,
    search,
    page = 1,
    limit = 50,
    role = 'owner',
  } = params;

  const offset = (page - 1) * limit;
  const conditions = [];

  if (serviceType) {
    conditions.push(eq(vendors.serviceType, serviceType));
  }
  if (status) {
    conditions.push(eq(vendors.status, status));
  }
  if (search && search.trim() !== '') {
    const clean = search.trim();
    conditions.push(
      sql`public.immutable_unaccent(${vendors.name}) ILIKE public.immutable_unaccent(${'%' + clean + '%'}) OR public.immutable_unaccent(COALESCE(${vendors.contactPerson}, '')) ILIKE public.immutable_unaccent(${'%' + clean + '%'}) OR public.immutable_unaccent(COALESCE(${vendors.address}, '')) ILIKE public.immutable_unaccent(${'%' + clean + '%'})`
    );
  }

  let query = txDb.select().from(vendors).$dynamic();

  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }

  const rows = await query
    .orderBy(desc(vendors.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => mapToVendorDto(r, role));
}

/**
 * 2. Lấy chi tiết nhà cung cấp theo ID.
 * AT03, AT41: Che giấu ghi chú nội bộ nếu role === 'family_view'.
 */
export async function getVendorById(
  txDb: TxDb,
  id: string,
  role: 'owner' | 'family_view' = 'owner'
): Promise<VendorDto | null> {
  const [row] = await txDb
    .select()
    .from(vendors)
    .where(eq(vendors.id, id))
    .limit(1);

  if (!row) return null;
  return mapToVendorDto(row, role);
}

/**
 * 3. Tạo mới hồ sơ nhà cung cấp kèm ghi vết audit log.
 */
export async function createVendor(
  txDb: TxDb,
  input: CreateVendorInput,
  userId: string
): Promise<VendorDto> {
  const tablePrice = parseBigIntOrNull(input.table_price);
  const rentalFee = parseBigIntOrNull(input.rental_fee);

  const [created] = await txDb
    .insert(vendors)
    .values({
      name: input.name,
      serviceType: input.service_type || 'other',
      status: input.status || 'researching',
      contactPerson: input.contact_person || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      mapUrl: input.map_url || null,
      website: input.website || null,
      notes: input.notes || null,
      rating: input.rating ?? null,
      capacity: input.capacity ?? null,
      minGuests: input.min_guests ?? null,
      tablePrice,
      seatsPerTable: input.seats_per_table ?? null,
      rentalFee,
      feesInclusive: input.fees_inclusive ?? false,
      prepTime: input.prep_time || null,
      endTime: input.end_time || null,
      parkingNotes: input.parking_notes || null,
      rainPlan: input.rain_plan || null,
      decorAudioRules: input.decor_audio_rules || null,
      extraFeesNotes: input.extra_fees_notes || null,
      version: 1,
    })
    .returning();

  // Audit log
  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'vendors',
    entityId: created.id,
    afterState: {
      id: created.id,
      name: created.name,
      serviceType: created.serviceType,
      status: created.status,
    },
  });

  return mapToVendorDto(created, 'owner');
}

/**
 * 4. Cập nhật hồ sơ nhà cung cấp với khóa lạc quan (Optimistic Locking).
 */
export async function updateVendor(
  txDb: TxDb,
  id: string,
  input: UpdateVendorInput,
  userId: string
): Promise<VendorDto> {
  // Lock row for update
  const [existing] = await txDb
    .select()
    .from(vendors)
    .where(eq(vendors.id, id))
    .for('update');

  if (!existing) {
    throw new VendorNotFoundError();
  }

  if (existing.version !== input.version) {
    throw new VersionConflictError();
  }

  const updates: Record<string, unknown> = {
    version: existing.version + 1,
    updatedAt: new Date(),
  };

  if (input.name !== undefined) updates.name = input.name;
  if (input.service_type !== undefined) updates.serviceType = input.service_type;
  if (input.status !== undefined) updates.status = input.status;
  if (input.contact_person !== undefined) updates.contactPerson = input.contact_person;
  if (input.phone !== undefined) updates.phone = input.phone;
  if (input.email !== undefined) updates.email = input.email;
  if (input.address !== undefined) updates.address = input.address;
  if (input.map_url !== undefined) updates.mapUrl = input.map_url;
  if (input.website !== undefined) updates.website = input.website;
  if (input.notes !== undefined) updates.notes = input.notes;
  if (input.rating !== undefined) updates.rating = input.rating;
  if (input.capacity !== undefined) updates.capacity = input.capacity;
  if (input.min_guests !== undefined) updates.minGuests = input.min_guests;
  if (input.table_price !== undefined) updates.tablePrice = parseBigIntOrNull(input.table_price);
  if (input.seats_per_table !== undefined) updates.seatsPerTable = input.seats_per_table;
  if (input.rental_fee !== undefined) updates.rentalFee = parseBigIntOrNull(input.rental_fee);
  if (input.fees_inclusive !== undefined) updates.feesInclusive = input.fees_inclusive;
  if (input.prep_time !== undefined) updates.prepTime = input.prep_time;
  if (input.end_time !== undefined) updates.endTime = input.end_time;
  if (input.parking_notes !== undefined) updates.parkingNotes = input.parking_notes;
  if (input.rain_plan !== undefined) updates.rainPlan = input.rain_plan;
  if (input.decor_audio_rules !== undefined) updates.decorAudioRules = input.decor_audio_rules;
  if (input.extra_fees_notes !== undefined) updates.extraFeesNotes = input.extra_fees_notes;

  const [updated] = await txDb
    .update(vendors)
    .set(updates)
    .where(eq(vendors.id, id))
    .returning();

  // Audit log
  await txDb.insert(auditLogs).values({
    userId,
    action: 'UPDATE',
    entityType: 'vendors',
    entityId: updated.id,
    beforeState: {
      version: existing.version,
      name: existing.name,
      status: existing.status,
    },
    afterState: {
      version: updated.version,
      name: updated.name,
      status: updated.status,
    },
  });

  return mapToVendorDto(updated, 'owner');
}

/**
 * 5. Xóa nhà cung cấp với chốt chặn an toàn:
 * Ngăn chặn xóa nếu đã có khoản chi hoạt động (status != 'cancelled') hoặc báo giá đã chọn.
 */
export async function deleteVendor(
  txDb: TxDb,
  id: string,
  userId: string
): Promise<void> {
  const [existing] = await txDb
    .select()
    .from(vendors)
    .where(eq(vendors.id, id))
    .limit(1);

  if (!existing) {
    throw new VendorNotFoundError();
  }

  // Chốt chặn 1: Kiểm tra cost_items liên kết có đang hoạt động hay không
  const activeCostItems = await txDb
    .select({ id: costItems.id, status: costItems.status })
    .from(costItems)
    .where(and(eq(costItems.vendorId, id), ne(costItems.status, 'cancelled')))
    .limit(1);

  if (activeCostItems.length > 0) {
    throw new VendorHasActiveCostItemsError(
      'Không thể xóa nhà cung cấp đã có khoản chi hoặc hợp đồng liên kết đang hoạt động'
    );
  }

  // Chốt chặn 2: Kiểm tra xem có báo giá nào đang được chọn (is_selected) không
  const selectedQuotes = await txDb
    .select({ id: vendorQuotes.id })
    .from(vendorQuotes)
    .where(and(eq(vendorQuotes.vendorId, id), eq(vendorQuotes.isSelected, true)))
    .limit(1);

  if (selectedQuotes.length > 0) {
    throw new VendorHasActiveCostItemsError(
      'Không thể xóa nhà cung cấp đang có gói báo giá được chọn làm cơ sở hợp đồng'
    );
  }

  // Xóa vendor (cascade sẽ tự dọn contacts và vendor_quotes chưa chọn)
  await txDb.delete(vendors).where(eq(vendors.id, id));

  // Audit log
  await txDb.insert(auditLogs).values({
    userId,
    action: 'DELETE',
    entityType: 'vendors',
    entityId: id,
    beforeState: {
      id: existing.id,
      name: existing.name,
      serviceType: existing.serviceType,
      status: existing.status,
    },
  });
}

// -----------------------------------------------------------------------------
// CONTACT REPOSITORY METHODS
// -----------------------------------------------------------------------------

/**
 * 6. Thêm đầu mối liên hệ cho nhà cung cấp.
 */
export async function addVendorContact(
  txDb: TxDb,
  vendorId: string,
  input: CreateContactInput,
  userId: string
): Promise<ContactDto> {
  const [vendor] = await txDb
    .select({ id: vendors.id })
    .from(vendors)
    .where(eq(vendors.id, vendorId))
    .limit(1);

  if (!vendor) {
    throw new VendorNotFoundError();
  }

  // Nếu đặt là primary, bỏ primary của các liên hệ cũ
  if (input.is_primary) {
    await txDb
      .update(contacts)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(eq(contacts.vendorId, vendorId));
  }

  const [created] = await txDb
    .insert(contacts)
    .values({
      vendorId,
      name: input.name,
      role: input.role || null,
      phone: input.phone || null,
      email: input.email || null,
      isPrimary: input.is_primary ?? false,
      notes: input.notes || null,
    })
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'CREATE',
    entityType: 'contacts',
    entityId: created.id,
    afterState: {
      id: created.id,
      vendorId,
      name: created.name,
      isPrimary: created.isPrimary,
    },
  });

  return mapToContactDto(created);
}

/**
 * 7. Lấy danh sách đầu mối liên hệ của nhà cung cấp.
 */
export async function listVendorContacts(
  txDb: TxDb,
  vendorId: string
): Promise<ContactDto[]> {
  const rows = await txDb
    .select()
    .from(contacts)
    .where(eq(contacts.vendorId, vendorId))
    .orderBy(desc(contacts.isPrimary), asc(contacts.createdAt));

  return rows.map(mapToContactDto);
}

/**
 * 8. Xóa đầu mối liên hệ.
 */
export async function deleteVendorContact(
  txDb: TxDb,
  contactId: string,
  userId: string
): Promise<void> {
  const [existing] = await txDb
    .select()
    .from(contacts)
    .where(eq(contacts.id, contactId))
    .limit(1);

  if (!existing) {
    throw new ContactNotFoundError();
  }

  await txDb.delete(contacts).where(eq(contacts.id, contactId));

  await txDb.insert(auditLogs).values({
    userId,
    action: 'DELETE',
    entityType: 'contacts',
    entityId: contactId,
    beforeState: {
      id: existing.id,
      vendorId: existing.vendorId,
      name: existing.name,
    },
  });
}
