import { eq, and, sql } from 'drizzle-orm';
import { supportAssignments, SupportRole } from '@/db/schema';
import {
  SupportAssignmentDto,
  SupportAssignmentFamilyDto,
} from '@/schemas/support';
import { TxDb } from './types';
import { SupportAssignmentNotFoundError, OptimisticLockError } from './errors';

export function mapToSupportAssignmentDto(
  record: typeof supportAssignments.$inferSelect,
  role?: string
): SupportAssignmentDto | SupportAssignmentFamilyDto {
  if (role === 'family_view') {
    return {
      id: record.id,
      eventId: record.eventId,
      contactId: record.contactId,
      name: record.name,
      phone: record.phone,
      roles: record.roles as SupportRole[],
      arrivalTime: record.arrivalTime,
      backupName: record.backupName,
      backupPhone: record.backupPhone,
      attireNotes: null, // Sanitized for family_view
      duties: record.duties,
      assignedTaskIds: (record.assignedTaskIds as string[]) || [],
      assignedItemIds: (record.assignedItemIds as string[]) || [],
      isShared: true as const,
      version: record.version,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }

  return {
    id: record.id,
    eventId: record.eventId,
    contactId: record.contactId,
    name: record.name,
    phone: record.phone,
    roles: record.roles as SupportRole[],
    arrivalTime: record.arrivalTime,
    backupName: record.backupName,
    backupPhone: record.backupPhone,
    attireNotes: record.attireNotes,
    duties: record.duties,
    assignedTaskIds: (record.assignedTaskIds as string[]) || [],
    assignedItemIds: (record.assignedItemIds as string[]) || [],
    isShared: record.isShared,
    version: record.version,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getSupportAssignmentById(
  db: TxDb,
  id: string
): Promise<typeof supportAssignments.$inferSelect | null> {
  const [record] = await db
    .select()
    .from(supportAssignments)
    .where(eq(supportAssignments.id, id));

  return record || null;
}

export async function listSupportAssignmentsByEvent(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<SupportAssignmentDto | SupportAssignmentFamilyDto>> {
  const conditions = [eq(supportAssignments.eventId, eventId)];

  if (role === 'family_view') {
    conditions.push(eq(supportAssignments.isShared, true));
  }

  const records = await db
    .select()
    .from(supportAssignments)
    .where(and(...conditions))
    .orderBy(supportAssignments.createdAt);

  return records.map((r) => mapToSupportAssignmentDto(r, role));
}

export async function createSupportAssignmentRecord(
  db: TxDb,
  data: {
    eventId: string;
    contactId?: string | null;
    name: string;
    phone: string;
    roles: string[];
    arrivalTime?: string | null;
    backupName?: string | null;
    backupPhone?: string | null;
    attireNotes?: string | null;
    duties?: string | null;
    assignedTaskIds?: string[];
    assignedItemIds?: string[];
    isShared?: boolean;
  }
): Promise<SupportAssignmentDto> {
  const [created] = await db
    .insert(supportAssignments)
    .values({
      eventId: data.eventId,
      contactId: data.contactId ?? null,
      name: data.name,
      phone: data.phone,
      roles: data.roles,
      arrivalTime: data.arrivalTime ?? null,
      backupName: data.backupName ?? null,
      backupPhone: data.backupPhone ?? null,
      attireNotes: data.attireNotes ?? null,
      duties: data.duties ?? null,
      assignedTaskIds: data.assignedTaskIds ?? [],
      assignedItemIds: data.assignedItemIds ?? [],
      isShared: data.isShared ?? false,
      version: 1,
    })
    .returning();

  return mapToSupportAssignmentDto(created, 'owner') as SupportAssignmentDto;
}

export async function updateSupportAssignmentRecord(
  db: TxDb,
  id: string,
  updates: {
    contactId?: string | null;
    name?: string;
    phone?: string;
    roles?: string[];
    arrivalTime?: string | null;
    backupName?: string | null;
    backupPhone?: string | null;
    attireNotes?: string | null;
    duties?: string | null;
    assignedTaskIds?: string[];
    assignedItemIds?: string[];
    isShared?: boolean;
  },
  expectedVersion?: number
): Promise<SupportAssignmentDto> {
  const existing = await getSupportAssignmentById(db, id);
  if (!existing) {
    throw new SupportAssignmentNotFoundError(id);
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
    .update(supportAssignments)
    .set({
      ...cleanedUpdates,
      version: existing.version + 1,
      updatedAt: sql`clock_timestamp()`,
    })
    .where(
      and(
        eq(supportAssignments.id, id),
        eq(supportAssignments.version, existing.version)
      )
    )
    .returning();

  if (!updated) {
    throw new OptimisticLockError(existing.version);
  }

  return mapToSupportAssignmentDto(updated, 'owner') as SupportAssignmentDto;
}

export async function deleteSupportAssignmentRecord(
  db: TxDb,
  id: string,
  expectedVersion?: number
): Promise<{ success: true; id: string }> {
  const existing = await getSupportAssignmentById(db, id);
  if (!existing) {
    throw new SupportAssignmentNotFoundError(id);
  }

  if (expectedVersion !== undefined && existing.version !== expectedVersion) {
    throw new OptimisticLockError(existing.version);
  }

  const [deleted] = await db
    .delete(supportAssignments)
    .where(
      and(
        eq(supportAssignments.id, id),
        expectedVersion !== undefined ? eq(supportAssignments.version, expectedVersion) : sql`true`
      )
    )
    .returning({ id: supportAssignments.id });

  if (!deleted) {
    throw new OptimisticLockError(existing.version);
  }

  return { success: true, id: deleted.id };
}
