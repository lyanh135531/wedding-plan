import { eq } from 'drizzle-orm';
import { events } from '@/db/schema/events';
import { timelineItems } from '@/db/schema/timeline';
import { tables, seatAssignments } from '@/db/schema/seating';
import { menus, menuItems } from '@/db/schema/catering';
import { supportAssignments } from '@/db/schema/support';
import { preparationItems } from '@/db/schema/preparation';
import { attendance } from '@/db/schema/guests';
import {
  CreateHandoverPacketInput,
  createHandoverPacketSchema,
  DeliverHandoverPacketInput,
  HandoverPacketDto,
  HandoverPacketFamilyDto,
} from '@/schemas/handovers';
import { TxDb } from './types';
import {
  createHandoverPacketRecord,
  getHandoverPacketById,
  listHandoverPacketsByEvent,
  updateHandoverDelivery,
  mapToHandoverPacketDto,
  mapToHandoverPacketFamilyDto,
} from './handovers.repository';
import { HandoverPacketNotFoundError, HandoverOutdatedError } from './errors';

export async function assembleLiveEventData(
  db: TxDb,
  eventId: string,
  scope: {
    includeTimeline?: boolean;
    includeSeating?: boolean;
    includeCatering?: boolean;
    includeSupport?: boolean;
    includeChecklist?: boolean;
  }
) {
  const result: Record<string, any> = {};

  if (scope.includeTimeline) {
    const items = await db
      .select()
      .from(timelineItems)
      .where(eq(timelineItems.eventId, eventId));
    result.timeline = items.map((i: any) => ({
      id: i.id,
      title: i.title,
      scheduledStartTime: new Date(i.scheduledStartTime).toISOString(),
      scheduledEndTime: new Date(i.scheduledEndTime).toISOString(),
      locationName: i.locationName,
      personInCharge: i.personInCharge,
      status: i.status,
      isShared: i.isShared === true,
    }));
  }

  if (scope.includeSeating) {
    const tableList = await db
      .select()
      .from(tables)
      .where(eq(tables.eventId, eventId));
    const seatList = await db
      .select()
      .from(seatAssignments)
      .where(eq(seatAssignments.eventId, eventId));

    result.seating = {
      tablesCount: tableList.length,
      assignedSeatsCount: seatList.length,
      assignments: seatList.map((seat: any) => ({ guestId: seat.guestId, tableId: seat.tableId, seatNumber: seat.seatNumber })),
      tables: tableList.map((t: any) => ({
        id: t.id,
        name: t.name,
        tableNumber: t.tableNumber,
        capacity: t.capacity,
      })),
    };
  }

  if (scope.includeCatering) {
    const menuList = await db
      .select()
      .from(menus)
      .where(eq(menus.eventId, eventId));
    const attList = await db
      .select()
      .from(attendance)
      .where(eq(attendance.eventId, eventId));

    const totalMeals = attList.filter((a: any) => a.needsMeal && a.rsvpStatus === 'accepted').length;

    result.catering = {
      menusCount: menuList.length,
      totalMealsNeeded: totalMeals,
    };
  }

  if (scope.includeSupport) {
    const supportList = await db
      .select()
      .from(supportAssignments)
      .where(eq(supportAssignments.eventId, eventId));

    result.support = supportList.map((s: any) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      roles: s.roles,
      arrivalTime: s.arrivalTime,
      isShared: s.isShared === true,
    }));
  }

  if (scope.includeChecklist) {
    const prepList = await db
      .select()
      .from(preparationItems)
      .where(eq(preparationItems.eventId, eventId));

    result.checklist = prepList.map((p: any) => ({
      id: p.id,
      title: p.title,
      type: p.type,
      status: p.status,
      isRental: p.isRental,
      isShared: p.isShared === true,
    }));
  }

  return result;
}

/**
 * Creates an immutable versioned snapshot of the event's operational state.
 */
export async function createHandoverSnapshot(
  db: TxDb,
  input: CreateHandoverPacketInput,
  userId?: string | null
): Promise<HandoverPacketDto> {
  // Serialize snapshot versions for this event inside the request transaction.
  const [event] = await db.select().from(events).where(eq(events.id, input.eventId)).for('update');
  if (!event) throw new Error('Buổi lễ không tồn tại.');
  const existing = await listHandoverPacketsByEvent(db, input.eventId);
  const nextVersion = existing.length > 0 ? Math.max(...existing.map((e) => e.version)) + 1 : 1;

  const scope = createHandoverPacketSchema.shape.scope.parse(input.scope);
  const liveSnapshot = await assembleLiveEventData(db, input.eventId, scope);

  return createHandoverPacketRecord(db, {
    eventId: input.eventId,
    version: nextVersion,
    title: input.title,
    scope,
    snapshotData: liveSnapshot,
    isSharedWithFamily: input.isSharedWithFamily ?? false,
    createdByUserId: userId ?? null,
  });
}

/**
 * Detects differences between the frozen snapshot and current live state (FL13).
 * Triggers alert banner "Chưa bàn giao lại" if modifications occurred post-snapshot.
 */
export async function getHandoverDeltaDiff(
  db: TxDb,
  snapshotId: string,
  role?: string
): Promise<{
  hasChanges: boolean;
  modifiedSections: string[];
  diffSummary: string;
  details: Record<string, any>;
}> {
  const snapshot = await getHandoverPacketById(db, snapshotId);
  if (!snapshot) {
    throw new HandoverPacketNotFoundError(snapshotId);
  }

  const liveData = await assembleLiveEventData(db, snapshot.eventId, snapshot.scope);
  const frozen = role === 'family_view' ? mapToHandoverPacketFamilyDto(snapshot).snapshotData : snapshot.snapshotData;

  const modifiedSections: string[] = [];
  const details: Record<string, any> = {};

  if (snapshot.scope.includeTimeline && frozen.timeline && liveData.timeline) {
    const frozenCount = frozen.timeline.length;
    const liveCount = liveData.timeline.length;
    if (frozenCount !== liveCount) {
      modifiedSections.push('timeline');
      details.timeline = { message: `Số lượng mục lịch trình thay đổi (bản chốt: ${frozenCount}, hiện tại: ${liveCount})` };
    }
  }

  if (snapshot.scope.includeSeating && frozen.seating && liveData.seating) {
    const frozenSeats = frozen.seating.assignedSeatsCount;
    const liveSeats = liveData.seating.assignedSeatsCount;
    if (frozenSeats !== liveSeats) {
      modifiedSections.push('seating');
      const diff = liveSeats - frozenSeats;
      details.seating = {
        message: `Số lượng ghế đã xếp thay đổi (${diff > 0 ? `+${diff}` : diff} khách)`,
        frozenCount: frozenSeats,
        liveCount: liveSeats,
      };
    }
  }

  if (snapshot.scope.includeCatering && frozen.catering && liveData.catering) {
    const frozenMeals = frozen.catering.totalMealsNeeded;
    const liveMeals = liveData.catering.totalMealsNeeded;
    if (frozenMeals !== liveMeals) {
      modifiedSections.push('catering');
      details.catering = {
        message: `Số lượng suất ăn cần phục vụ thay đổi (${liveMeals - frozenMeals} phần)`,
        frozenCount: frozenMeals,
        liveCount: liveMeals,
      };
    }
  }

  if (snapshot.scope.includeChecklist && frozen.checklist && liveData.checklist) {
    if (frozen.checklist.length !== liveData.checklist.length) {
      modifiedSections.push('checklist');
      details.checklist = { message: `Đầu việc chuẩn bị thay đổi` };
    }
  }

  // Counts alone miss moved seats, renamed tables and changed times/people.
  const canonical = (value: unknown): string => {
    const normalize = (item: any): any => {
      if (item instanceof Date) return item.toISOString();
      if (Array.isArray(item)) return item.map(normalize).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
      if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map((key) => [key, normalize(item[key])]));
      return item;
    };
    return JSON.stringify(normalize(value));
  };
  const sections = { timeline: 'includeTimeline', seating: 'includeSeating', catering: 'includeCatering', support: 'includeSupport', checklist: 'includeChecklist' } as const;
  for (const [section, flag] of Object.entries(sections)) {
    if (snapshot.scope[flag] && !modifiedSections.includes(section) && canonical(frozen[section]) !== canonical(liveData[section])) {
      modifiedSections.push(section);
      details[section] = { message: 'Nội dung đã thay đổi sau bản chốt' };
    }
  }

  const hasChanges = modifiedSections.length > 0;
  const diffSummary = hasChanges
    ? `Đã có thay đổi sau bản chốt v${snapshot.version} (${modifiedSections.join(', ')}). Chưa bàn giao lại cho nhà hàng/đối tác.`
    : `Bản chốt hoàn toàn khớp với dữ liệu thực tế hiện tại.`;

  return {
    hasChanges,
    modifiedSections,
    diffSummary,
    details,
  };
}

export async function deliverHandover(
  db: TxDb,
  snapshotId: string,
  input: DeliverHandoverPacketInput
): Promise<HandoverPacketDto> {
  const diff = await getHandoverDeltaDiff(db, snapshotId);
  if (diff.hasChanges) throw new HandoverOutdatedError();
  return updateHandoverDelivery(db, snapshotId, input.handedOverTo, input.handedOverChannel);
}

export async function listHandoverPackets(
  db: TxDb,
  eventId: string,
  role?: string
): Promise<Array<HandoverPacketDto | HandoverPacketFamilyDto>> {
  return listHandoverPacketsByEvent(db, eventId, role);
}

export async function getHandoverPacket(
  db: TxDb,
  snapshotId: string,
  role?: string
): Promise<HandoverPacketDto | HandoverPacketFamilyDto> {
  const snapshot = await getHandoverPacketById(db, snapshotId);
  if (!snapshot) {
    throw new HandoverPacketNotFoundError(snapshotId);
  }

  if (role === 'family_view') {
    return mapToHandoverPacketFamilyDto(snapshot);
  }

  return mapToHandoverPacketDto(snapshot);
}
