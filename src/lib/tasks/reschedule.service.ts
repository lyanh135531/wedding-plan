import { eq, and, sql } from 'drizzle-orm';
import { events } from '@/db/schema/events';
import { tasks } from '@/db/schema/tasks';
import { costItems, paymentSchedules } from '@/db/schema/finance';
import { auditLogs } from '@/db/schema/system';
import {
  RescheduleImpactPreview,
  AffectedRelativeTask,
  PinnedTaskSkipped,
  FixedPaymentScheduleReview,
} from './types';
import { TxOrDb } from '@/lib/finance/costs.repository';
import { weddingDateKey, endOfWeddingDay } from '@/lib/dates';

export class EventNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(message = 'Không tìm thấy buổi lễ / sự kiện') {
    super(message);
    this.name = 'EventNotFoundError';
  }
}

/**
 * Generates impact diff preview when rescheduling an official wedding event date.
 *
 * Invariants:
 * - AT18: Relative tasks with offset days shift their deadlines accordingly.
 * - AT18: Pinned manual tasks and completed tasks are NOT modified.
 * - AT18: Tasks that would drift before today are flagged with prominent past drift warnings.
 * - AT18: Fixed payment schedules linked to the event are listed for manual review.
 */
export async function generateRescheduleImpactPreview(
  txDb: TxOrDb,
  eventId: string,
  newDateStr: string,
  currentDate = new Date()
): Promise<RescheduleImpactPreview> {
  // 1. Fetch target event
  const [event] = await txDb
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!event) {
    throw new EventNotFoundError();
  }

  const oldDateStr = event.startTime
    ? weddingDateKey(event.startTime)
    : null;
  const newBaseDate = endOfWeddingDay(newDateStr);

  // 2. Fetch all relative tasks tied to this event
  const relativeTasks = await txDb
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.relativeEventId, eventId),
        eq(tasks.deadlineType, 'relative_to_event')
      )
    );

  const affectedRelativeTasks: AffectedRelativeTask[] = [];
  const pinnedTasksSkipped: PinnedTaskSkipped[] = [];
  let hasPastDriftWarnings = false;

  for (const t of relativeTasks) {
    if (t.pinnedManual) {
      pinnedTasksSkipped.push({
        taskId: t.id,
        title: t.title,
        reason: 'Đã ghim thủ công (pinned manual)',
      });
      continue;
    }

    if (t.status === 'completed') {
      pinnedTasksSkipped.push({
        taskId: t.id,
        title: t.title,
        reason: 'Đã hoàn thành',
      });
      continue;
    }

    // Compute old due date if old event solar date was present
    let oldDueDateStr: string | null = null;
    if (oldDateStr) {
      const oldBase = endOfWeddingDay(oldDateStr);
      const offsetMs = (t.relativeOffsetDays || 0) * 86400000;
      const oldDueEpoch =
        t.relativeDirection === 'after'
          ? oldBase.getTime() + offsetMs
          : oldBase.getTime() - offsetMs;
      oldDueDateStr = new Date(oldDueEpoch).toISOString();
    }

    // Compute new due date
    const offsetMs = (t.relativeOffsetDays || 0) * 86400000;
    const newDueEpoch =
      t.relativeDirection === 'after'
        ? newBaseDate.getTime() + offsetMs
        : newBaseDate.getTime() - offsetMs;
    const newDueDate = new Date(newDueEpoch);

    const isDriftedPast = newDueDate.getTime() < currentDate.getTime();
    if (isDriftedPast) {
      hasPastDriftWarnings = true;
    }

    affectedRelativeTasks.push({
      taskId: t.id,
      title: t.title,
      oldDueDate: oldDueDateStr,
      newDueDate: newDueDate.toISOString(),
      offsetDays: t.relativeOffsetDays || 0,
      direction: t.relativeDirection as any,
      isDriftedPast,
    });
  }

  // 3. Fetch fixed payment schedules linked to cost items of this event
  const schedules = await txDb
    .select({
      scheduleId: paymentSchedules.id,
      costItemName: costItems.name,
      title: paymentSchedules.title,
      amountDue: paymentSchedules.amountDue,
      dueDate: paymentSchedules.dueDate,
    })
    .from(paymentSchedules)
    .innerJoin(costItems, eq(paymentSchedules.costItemId, costItems.id))
    .where(
      and(
        eq(costItems.eventId, eventId),
        sql`${paymentSchedules.status} != 'cancelled'`
      )
    );

  const fixedPaymentSchedulesRequiringManualReview: FixedPaymentScheduleReview[] = schedules.map(
    (s: any) => ({
      scheduleId: s.scheduleId,
      costItemName: s.costItemName,
      title: s.title,
      amountDue: s.amountDue,
      dueDate: s.dueDate,
    })
  );

  return {
    eventId,
    oldDate: oldDateStr,
    newDate: newDateStr,
    affectedRelativeTasks,
    pinnedTasksSkipped,
    fixedPaymentSchedulesRequiringManualReview,
    hasPastDriftWarnings,
  };
}

/**
 * Applies wedding event date rescheduling atomically in a single transaction.
 *
 * Invariants:
 * - AT18, AT62: Updates event date and maintains audit trail.
 */
export async function applyReschedule(
  txDb: TxOrDb,
  eventId: string,
  newDateStr: string,
  userId: string
) {
  const [existingEvent] = await txDb
    .select()
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  if (!existingEvent) {
    throw new EventNotFoundError();
  }

  const [updatedEvent] = await txDb
    .update(events)
    .set({
      startTime: new Date(`${newDateStr}T08:00:00.000Z`),
      status: 'confirmed',
      updatedAt: new Date(),
    })
    .where(eq(events.id, eventId))
    .returning();

  await txDb.insert(auditLogs).values({
    userId,
    action: 'RESCHEDULE_EVENT_DATE',
    entityType: 'events',
    entityId: eventId,
    beforeState: existingEvent,
    afterState: updatedEvent,
  });

  return updatedEvent;
}
