import { eq, and, sql } from 'drizzle-orm';
import { preparationItems, PreparationType } from '@/db/schema';
import { PreparationItemDto, PreparationItemFamilyDto } from '@/schemas/preparation';
import { TxDb } from './types';
import { PreparationItemNotFoundError, OptimisticLockError } from './errors';

export function mapToPreparationItemDto(
  record: typeof preparationItems.$inferSelect,
  role?: string
): PreparationItemDto | PreparationItemFamilyDto {
  const metadata = (record.metadata as Record<string, unknown>) || {};

  if (role === 'family_view') {
    // For family_view, sanitize private notes
    const sanitizedMetadata = { ...metadata };
    delete sanitizedMetadata.linkedCostItemId;
    if ('notes' in sanitizedMetadata) {
      sanitizedMetadata.notes = null;
    }
    return {
      id: record.id,
      eventId: record.eventId,
      type: record.type as PreparationType,
      title: record.title,
      category: record.category,
      status: record.status,
      priority: record.priority,
      metadata: sanitizedMetadata,
      isRental: record.isRental,
      returnDueDate: record.returnDueDate ? record.returnDueDate.toISOString() : null,
      isBlacklisted: record.isBlacklisted,
      isShared: true as const,
      version: record.version,
      handedOverAt: record.handedOverAt ? record.handedOverAt.toISOString() : null,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  return {
    id: record.id,
    eventId: record.eventId,
    type: record.type as PreparationType,
    title: record.title,
    category: record.category,
    status: record.status,
    priority: record.priority,
    metadata,
    isRental: record.isRental,
    returnDueDate: record.returnDueDate ? record.returnDueDate.toISOString() : null,
    isBlacklisted: record.isBlacklisted,
    isShared: record.isShared,
    version: record.version,
    handedOverAt: record.handedOverAt ? record.handedOverAt.toISOString() : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getPreparationItemById(
  db: TxDb,
  id: string
): Promise<typeof preparationItems.$inferSelect | null> {
  const [item] = await db
    .select()
    .from(preparationItems)
    .where(eq(preparationItems.id, id));

  return item || null;
}

export async function listPreparationItemsByEvent(
  db: TxDb,
  eventId: string,
  type?: PreparationType,
  role?: string
): Promise<Array<PreparationItemDto | PreparationItemFamilyDto>> {
  const conditions = [eq(preparationItems.eventId, eventId)];

  if (type) {
    conditions.push(eq(preparationItems.type, type));
  }

  if (role === 'family_view') {
    conditions.push(eq(preparationItems.isShared, true));
  }

  const records = await db
    .select()
    .from(preparationItems)
    .where(and(...conditions))
    .orderBy(preparationItems.createdAt);

  return records.map((r) => mapToPreparationItemDto(r, role));
}

export async function createPreparationItemRecord(
  db: TxDb,
  data: {
    eventId: string;
    type: PreparationType;
    title: string;
    category?: string | null;
    status: string;
    priority?: string | null;
    metadata?: Record<string, unknown>;
    isRental?: boolean;
    returnDueDate?: Date | null;
    isBlacklisted?: boolean;
    isShared?: boolean;
    handedOverAt?: Date | null;
  }
): Promise<PreparationItemDto> {
  const [created] = await db
    .insert(preparationItems)
    .values({
      eventId: data.eventId,
      type: data.type,
      title: data.title,
      category: data.category ?? null,
      status: data.status,
      priority: data.priority ?? null,
      metadata: data.metadata ?? {},
      isRental: data.isRental ?? false,
      returnDueDate: data.returnDueDate ?? null,
      isBlacklisted: data.isBlacklisted ?? false,
      isShared: data.isShared ?? false,
      handedOverAt: data.handedOverAt ?? null,
      version: 1,
    })
    .returning();

  return mapToPreparationItemDto(created, 'owner') as PreparationItemDto;
}

export async function updatePreparationItemRecord(
  db: TxDb,
  id: string,
  updates: {
    title?: string;
    category?: string | null;
    status?: string;
    priority?: string | null;
    metadata?: Record<string, unknown>;
    isRental?: boolean;
    returnDueDate?: Date | null;
    isBlacklisted?: boolean;
    isShared?: boolean;
    handedOverAt?: Date | null;
  },
  expectedVersion?: number
): Promise<PreparationItemDto> {
  const existing = await getPreparationItemById(db, id);
  if (!existing) {
    throw new PreparationItemNotFoundError(id);
  }

  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new OptimisticLockError(existing.version);
  }

  const cleanedUpdates: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) {
      cleanedUpdates[k] = v;
    }
  }

  const [updated] = await db
    .update(preparationItems)
    .set({
      ...cleanedUpdates,
      version: existing.version + 1,
      updatedAt: sql`clock_timestamp()`,
    })
    .where(
      and(
        eq(preparationItems.id, id),
        eq(preparationItems.version, existing.version)
      )
    )
    .returning();

  if (!updated) {
    throw new OptimisticLockError(existing.version);
  }

  return mapToPreparationItemDto(updated, 'owner') as PreparationItemDto;
}

export async function deletePreparationItemRecord(
  db: TxDb,
  id: string,
  expectedVersion?: number
): Promise<{ success: true; id: string }> {
  const existing = await getPreparationItemById(db, id);
  if (!existing) {
    throw new PreparationItemNotFoundError(id);
  }

  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new OptimisticLockError(existing.version);
  }

  const [deleted] = await db
    .delete(preparationItems)
    .where(
      and(
        eq(preparationItems.id, id),
        expectedVersion !== undefined ? eq(preparationItems.version, expectedVersion) : sql`true`
      )
    )
    .returning({ id: preparationItems.id });

  if (!deleted) {
    throw new OptimisticLockError(existing.version);
  }

  return { success: true, id: deleted.id };
}
