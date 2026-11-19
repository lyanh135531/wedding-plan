import { nullableVietnamesePhoneSchema } from '@/schemas/common';
import { TxDb } from './types';
import {
  CreateTimelineItemInput,
  UpdateTimelineItemInput,
  MarkActualTimesInput,
  PreviewShiftTimelineInput,
  ApplyShiftTimelineInput,
  TimelineItemDto,
  TimelineItemFamilyDto,
} from '@/schemas/timeline';
import {
  createTimelineItemRecord,
  getTimelineItemById,
  updateTimelineItemRecord,
  deleteTimelineItemRecord,
  listTimelineItemsByEvent,
  mapToTimelineItemDto,
} from './timeline.repository';
import {
  TimelineItemNotFoundError,
  InvalidTimelineShiftError,
  TimelineTimeOrderError,
  OptimisticLockError,
} from './errors';

export interface PersonnelConflict {
  itemAId: string;
  itemATitle: string;
  itemBId: string;
  itemBTitle: string;
  personName: string;
  overlapStart: string;
  overlapEnd: string;
}

export function detectPersonnelConflicts(items: Array<any>): PersonnelConflict[] {
  const conflicts: PersonnelConflict[] = [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];

      // Match either supportAssignmentId or personInCharge (if non-empty)
      const sameSupport = a.supportAssignmentId && b.supportAssignmentId && a.supportAssignmentId === b.supportAssignmentId;
      const samePerson = a.personInCharge && b.personInCharge && a.personInCharge.trim().toLowerCase() === b.personInCharge.trim().toLowerCase();

      if (sameSupport || samePerson) {
        const startA = new Date(a.scheduledStartTime).getTime();
        const endA = new Date(a.scheduledEndTime).getTime();
        const startB = new Date(b.scheduledStartTime).getTime();
        const endB = new Date(b.scheduledEndTime).getTime();

        const maxStart = Math.max(startA, startB);
        const minEnd = Math.min(endA, endB);

        if (maxStart < minEnd) {
          conflicts.push({
            itemAId: a.id,
            itemATitle: a.title,
            itemBId: b.id,
            itemBTitle: b.title,
            personName: a.personInCharge || 'Người phụ trách',
            overlapStart: new Date(maxStart).toISOString(),
            overlapEnd: new Date(minEnd).toISOString(),
          });
        }
      }
    }
  }

  return conflicts;
}

export async function createTimelineItem(
  db: TxDb,
  input: CreateTimelineItemInput
): Promise<TimelineItemDto> {
  const start = new Date(input.scheduledStartTime);
  const end = new Date(input.scheduledEndTime);
  if (end.getTime() < start.getTime()) {
    throw new TimelineTimeOrderError();
  }

  return createTimelineItemRecord(db, {
    eventId: input.eventId,
    title: input.title,
    category: input.category,
    scheduledStartTime: start,
    scheduledEndTime: end,
    locationName: input.locationName,
    personInCharge: input.personInCharge,
    inChargePhone: nullableVietnamesePhoneSchema.parse(input.inChargePhone),
    backupPerson: input.backupPerson,
    backupPhone: nullableVietnamesePhoneSchema.parse(input.backupPhone),
    supportAssignmentId: input.supportAssignmentId,
    assignedItemIds: input.assignedItemIds,
    assignedTaskIds: input.assignedTaskIds,
    operationalNotes: input.operationalNotes,
    isShared: input.isShared,
    sortOrder: input.sortOrder,
  });
}

export async function updateTimelineItem(
  db: TxDb,
  id: string,
  input: UpdateTimelineItemInput
): Promise<TimelineItemDto> {
  const current = await getTimelineItemById(db, id);
  if (!current) {
    throw new TimelineItemNotFoundError(id);
  }

  const scheduledStart = input.scheduledStartTime ? new Date(input.scheduledStartTime) : new Date(current.scheduledStartTime);
  const scheduledEnd = input.scheduledEndTime ? new Date(input.scheduledEndTime) : new Date(current.scheduledEndTime);

  if (scheduledEnd.getTime() < scheduledStart.getTime()) {
    throw new TimelineTimeOrderError();
  }

  return updateTimelineItemRecord(
    db,
    id,
    {
      title: input.title,
      category: input.category,
      scheduledStartTime: input.scheduledStartTime ? scheduledStart : undefined,
      scheduledEndTime: input.scheduledEndTime ? scheduledEnd : undefined,
      actualStartTime: input.actualStartTime !== undefined ? (input.actualStartTime ? new Date(input.actualStartTime) : null) : undefined,
      actualEndTime: input.actualEndTime !== undefined ? (input.actualEndTime ? new Date(input.actualEndTime) : null) : undefined,
      locationName: input.locationName,
      personInCharge: input.personInCharge,
      inChargePhone: nullableVietnamesePhoneSchema.parse(input.inChargePhone),
      backupPerson: input.backupPerson,
      backupPhone: nullableVietnamesePhoneSchema.parse(input.backupPhone),
      supportAssignmentId: input.supportAssignmentId,
      assignedItemIds: input.assignedItemIds,
      assignedTaskIds: input.assignedTaskIds,
      operationalNotes: input.operationalNotes,
      isShared: input.isShared,
      status: input.status,
      sortOrder: input.sortOrder,
    },
    input.version
  );
}

/**
 * Invariant (AT34): Day-of actual timing markers.
 * Marking actual start and completion strictly preserves scheduled start/end times immutable.
 */
export async function markActualTimes(
  db: TxDb,
  id: string,
  input: MarkActualTimesInput
): Promise<TimelineItemDto> {
  const current = await getTimelineItemById(db, id);
  if (!current) {
    throw new TimelineItemNotFoundError(id);
  }

  let newStatus = input.status;
  if (!newStatus) {
    if (input.actualEndTime) {
      newStatus = 'completed';
    } else if (input.actualStartTime) {
      newStatus = 'in_progress';
    }
  }

  return updateTimelineItemRecord(
    db,
    id,
    {
      // Preserve planned times strictly immutable (AT34)
      actualStartTime: input.actualStartTime !== undefined ? (input.actualStartTime ? new Date(input.actualStartTime) : null) : undefined,
      actualEndTime: input.actualEndTime !== undefined ? (input.actualEndTime ? new Date(input.actualEndTime) : null) : undefined,
      status: newStatus,
    },
    input.version
  );
}

export async function deleteTimelineItem(
  db: TxDb,
  id: string,
  expectedVersion?: number
): Promise<void> {
  return deleteTimelineItemRecord(db, id, expectedVersion);
}

export async function listTimelineItems(
  db: TxDb,
  eventId: string,
  role?: string,
  now?: Date
): Promise<Array<TimelineItemDto | TimelineItemFamilyDto>> {
  return listTimelineItemsByEvent(db, eventId, role, now);
}

/**
 * Preview selective delay rescheduling (FL15).
 * Only targets not_started items.
 */
export async function previewDelayShift(
  db: TxDb,
  input: PreviewShiftTimelineInput
): Promise<{
  affectedCount: number;
  affectedItems: Array<{
    id: string;
    title: string;
    currentStart: string;
    newStart: string;
    currentEnd: string;
    newEnd: string;
    version: number;
  }>;
  conflicts: PersonnelConflict[];
}> {
  const allItems = await listTimelineItemsByEvent(db, input.eventId);

  let pivotTimeMs = 0;
  if (input.pivotTime) {
    pivotTimeMs = new Date(input.pivotTime).getTime();
  } else if (input.pivotItemId) {
    const pivot = allItems.find((i) => i.id === input.pivotItemId);
    if (pivot) {
      pivotTimeMs = new Date(pivot.scheduledStartTime).getTime();
    }
  }

  const shiftMs = input.delayMinutes * 60 * 1000;

  const affectedItems: any[] = [];
  const simulatedAll: any[] = [];

  for (const item of allItems) {
    const startMs = new Date(item.scheduledStartTime).getTime();
    const endMs = new Date(item.scheduledEndTime).getTime();

    if (item.status === 'not_started' && startMs >= pivotTimeMs) {
      const newStartMs = startMs + shiftMs;
      const newEndMs = endMs + shiftMs;

      affectedItems.push({
        id: item.id,
        title: item.title,
        currentStart: item.scheduledStartTime,
        newStart: new Date(newStartMs).toISOString(),
        currentEnd: item.scheduledEndTime,
        newEnd: new Date(newEndMs).toISOString(),
        version: item.version,
      });

      simulatedAll.push({
        ...item,
        scheduledStartTime: new Date(newStartMs).toISOString(),
        scheduledEndTime: new Date(newEndMs).toISOString(),
      });
    } else {
      simulatedAll.push(item);
    }
  }

  const conflicts = detectPersonnelConflicts(simulatedAll);

  return {
    affectedCount: affectedItems.length,
    affectedItems,
    conflicts,
  };
}

/**
 * Apply selective delay rescheduling (FL15).
 * Invariant: Never shifts in_progress or completed items.
 */
export async function applyDelayShift(
  db: TxDb,
  input: ApplyShiftTimelineInput
): Promise<void> {
  const preview = await previewDelayShift(db, {
    eventId: input.eventId,
    delayMinutes: input.delayMinutes,
    pivotTime: input.pivotTime,
    pivotItemId: input.pivotItemId,
  });

  if (input.expectedVersions) {
    const expected = new Map(input.expectedVersions.map(item => [item.id, item.version]));
    if (expected.size !== preview.affectedItems.length || preview.affectedItems.some(item => expected.get(item.id) !== item.version)) {
      throw new OptimisticLockError('Lịch trình đã thay đổi sau khi xem trước. Hãy xem trước lại trước khi xác nhận dời lịch.');
    }
  }

  for (const aff of preview.affectedItems) {
    const item = await getTimelineItemById(db, aff.id);
    if (!item) continue;
    if (item.status !== 'not_started') {
      throw new InvalidTimelineShiftError(
        `Không thể dời lịch cho mục "${item.title}" vì trạng thái hiện tại là ${item.status}.`
      );
    }

    await updateTimelineItemRecord(
      db,
      aff.id,
      {
        scheduledStartTime: new Date(aff.newStart),
        scheduledEndTime: new Date(aff.newEnd),
      },
      aff.version
    );
  }
}

/**
 * Today Operational View (PLAN §14.1, UXT15)
 */
export async function getTodayTimeline(
  db: TxDb,
  eventId: string,
  wallClockTime: Date = new Date(),
  role?: string
): Promise<{
  current: Array<TimelineItemDto | TimelineItemFamilyDto>;
  next: Array<TimelineItemDto | TimelineItemFamilyDto>;
  delayed: Array<TimelineItemDto | TimelineItemFamilyDto>;
  all: Array<TimelineItemDto | TimelineItemFamilyDto>;
  conflicts: PersonnelConflict[];
}> {
  const all = await listTimelineItemsByEvent(db, eventId, role, wallClockTime);
  const nowMs = wallClockTime.getTime();

  const current: Array<TimelineItemDto | TimelineItemFamilyDto> = [];
  const next: Array<TimelineItemDto | TimelineItemFamilyDto> = [];
  const delayed: Array<TimelineItemDto | TimelineItemFamilyDto> = [];

  for (const item of all) {
    const startMs = new Date(item.scheduledStartTime).getTime();
    const endMs = new Date(item.scheduledEndTime).getTime();

    if (item.status === 'in_progress') {
      current.push(item);
    } else if (item.status === 'not_started') {
      if (startMs < nowMs) {
        delayed.push(item);
      } else {
        next.push(item);
      }
    }
  }

  const conflicts = detectPersonnelConflicts(all);

  return {
    current,
    next: next.slice(0, 3), // next top 3 upcoming
    delayed,
    all,
    conflicts,
  };
}
