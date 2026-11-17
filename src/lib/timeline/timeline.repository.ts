import { eq, and, asc } from 'drizzle-orm';
import { timelineItems } from '@/db/schema/timeline';
import { TimelineItemDto, TimelineItemFamilyDto } from '@/schemas/timeline';
import { TxDb } from './types';
import { TimelineItemNotFoundError, OptimisticLockError } from './errors';

export function calculateDelayMinutes(item: any, now: Date = new Date()): number {
  if (item.status === 'not_started') {
    const scheduled = new Date(item.scheduledStartTime).getTime();
    const current = now.getTime();
    if (current > scheduled) {
      return Math.round((current - scheduled) / (1000 * 60));
    }
  }
  return 0;
}

export function mapToTimelineItemDto(raw: any, now: Date = new Date()): TimelineItemDto {
  return {
    id: raw.id,
    eventId: raw.eventId,
    title: raw.title,
    category: raw.category,
    scheduledStartTime: new Date(raw.scheduledStartTime).toISOString(),
    scheduledEndTime: new Date(raw.scheduledEndTime).toISOString(),
    actualStartTime: raw.actualStartTime ? new Date(raw.actualStartTime).toISOString() : null,
    actualEndTime: raw.actualEndTime ? new Date(raw.actualEndTime).toISOString() : null,
    locationName: raw.locationName ?? null,
    personInCharge: raw.personInCharge ?? null,
    inChargePhone: raw.inChargePhone ?? null,
    backupPerson: raw.backupPerson ?? null,
    backupPhone: raw.backupPhone ?? null,
    supportAssignmentId: raw.supportAssignmentId ?? null,
    assignedItemIds: Array.isArray(raw.assignedItemIds) ? raw.assignedItemIds : [],
    assignedTaskIds: Array.isArray(raw.assignedTaskIds) ? raw.assignedTaskIds : [],
    operationalNotes: raw.operationalNotes ?? null,
    isShared: Boolean(raw.isShared),
    status: raw.status,
    sortOrder: raw.sortOrder ?? 0,
    version: raw.version || 1,
    createdAt: raw.createdAt ? new Date(raw.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt).toISOString() : new Date().toISOString(),
    delayMinutes: calculateDelayMinutes(raw, now),
  };
}

export function mapToTimelineItemFamilyDto(raw: any, now: Date = new Date()): TimelineItemFamilyDto {
  const full = mapToTimelineItemDto(raw, now);
  const { operationalNotes, ...family } = full;
  return family;
}

export async function createTimelineItemRecord(
  db: TxDb,
  values: {
    eventId: string;
    title: string;
    category: any;
    scheduledStartTime: Date;
    scheduledEndTime: Date;
    locationName?: string | null;
    personInCharge?: string | null;
    inChargePhone?: string | null;
    backupPerson?: string | null;
    backupPhone?: string | null;
    supportAssignmentId?: string | null;
    assignedItemIds?: string[];
    assignedTaskIds?: string[];
    operationalNotes?: string | null;
    isShared?: boolean;
    sortOrder?: number;
  }
): Promise<TimelineItemDto> {
  const [created] = await db
    .insert(timelineItems)
    .values({
      eventId: values.eventId,
      title: values.title,
      category: values.category ?? 'other',
      scheduledStartTime: values.scheduledStartTime,
      scheduledEndTime: values.scheduledEndTime,
      locationName: values.locationName ?? null,
      personInCharge: values.personInCharge ?? null,
      inChargePhone: values.inChargePhone ?? null,
      backupPerson: values.backupPerson ?? null,
      backupPhone: values.backupPhone ?? null,
      supportAssignmentId: values.supportAssignmentId ?? null,
      assignedItemIds: values.assignedItemIds ?? [],
      assignedTaskIds: values.assignedTaskIds ?? [],
      operationalNotes: values.operationalNotes ?? null,
      isShared: values.isShared ?? true,
      sortOrder: values.sortOrder ?? 0,
      status: 'not_started',
      version: 1,
    })
    .returning();

  return mapToTimelineItemDto(created);
}

export async function getTimelineItemById(
  db: TxDb,
  id: string
): Promise<any | null> {
  const [item] = await db
    .select()
    .from(timelineItems)
    .where(eq(timelineItems.id, id))
    .limit(1);

  return item || null;
}

export async function updateTimelineItemRecord(
  db: TxDb,
  id: string,
  values: Partial<{
    title: string;
    category: any;
    scheduledStartTime: Date;
    scheduledEndTime: Date;
    actualStartTime: Date | null;
    actualEndTime: Date | null;
    locationName: string | null;
    personInCharge: string | null;
    inChargePhone: string | null;
    backupPerson: string | null;
    backupPhone: string | null;
    supportAssignmentId: string | null;
    assignedItemIds: string[];
    assignedTaskIds: string[];
    operationalNotes: string | null;
    isShared: boolean;
    status: any;
    sortOrder: number;
  }>,
  expectedVersion: number
): Promise<TimelineItemDto> {
  const current = await getTimelineItemById(db, id);
  if (!current) {
    throw new TimelineItemNotFoundError(id);
  }
  if (current.version !== expectedVersion) {
    throw new OptimisticLockError(
      `Mục lịch trình "${current.title}" đã được sửa đổi bởi người khác (version hiện tại: ${current.version}, gửi lên: ${expectedVersion}).`,
      current.version
    );
  }

  const [updated] = await db
    .update(timelineItems)
    .set({
      ...values,
      version: current.version + 1,
      updatedAt: new Date(),
    })
    .where(and(eq(timelineItems.id, id), eq(timelineItems.version, expectedVersion)))
    .returning();

  if (!updated) {
    throw new OptimisticLockError(
      `Cập nhật mục lịch trình thất bại do xung đột phiên bản.`,
      current.version
    );
  }

  return mapToTimelineItemDto(updated);
}

export async function deleteTimelineItemRecord(
  db: TxDb,
  id: string,
  expectedVersion?: number
): Promise<void> {
  const current = await getTimelineItemById(db, id);
  if (!current) {
    throw new TimelineItemNotFoundError(id);
  }
  if (expectedVersion !== undefined && current.version !== expectedVersion) {
    throw new OptimisticLockError(
      `Không thể xóa: Mục lịch trình đã bị sửa đổi (version hiện tại: ${current.version}, gửi lên: ${expectedVersion}).`,
      current.version
    );
  }

  await db.delete(timelineItems).where(eq(timelineItems.id, id));
}

export async function listTimelineItemsByEvent(
  db: TxDb,
  eventId: string,
  role?: string,
  now: Date = new Date()
): Promise<Array<TimelineItemDto | TimelineItemFamilyDto>> {
  const items = await db
    .select()
    .from(timelineItems)
    .where(eq(timelineItems.eventId, eventId))
    .orderBy(asc(timelineItems.scheduledStartTime), asc(timelineItems.sortOrder));

  if (role === 'family_view') {
    return items
      .filter((i: any) => i.isShared)
      .map((i: any) => mapToTimelineItemFamilyDto(i, now));
  }

  return items.map((i: any) => mapToTimelineItemDto(i, now));
}
