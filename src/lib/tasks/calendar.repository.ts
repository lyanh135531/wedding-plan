import { eq, and, sql, gte, lte, asc } from 'drizzle-orm';
import { tasks, appointments } from '@/db/schema/tasks';
import { paymentSchedules, costItems } from '@/db/schema/finance';
import { events } from '@/db/schema/events';
import { computeEffectiveDueDate, EventDateInfo } from './deadlines';
import { UnifiedCalendarItem } from './types';
import { TxOrDb } from '@/lib/finance/costs.repository';

export interface CalendarFeedParams {
  startDate?: Date | string;
  endDate?: Date | string;
  role: 'owner' | 'family_view';
  allowedEventIds?: string[];
}

/**
 * Aggregates unified calendar feed across tasks, payments, appointments, and event milestones.
 *
 * Invariants:
 * - AT62: Unified chronological feed. Modifying task deadline or payment installment due date
 *   immediately synchronizes in the calendar without requiring duplicate records.
 * - AT03, UXT16: Family View role receives ZERO payment schedule items.
 */
export async function getUnifiedCalendarFeed(
  txDb: TxOrDb,
  params: CalendarFeedParams
): Promise<UnifiedCalendarItem[]> {
  const { role, allowedEventIds = [] } = params;

  const startEpoch = params.startDate ? new Date(params.startDate).getTime() : 0;
  const endEpoch = params.endDate
    ? new Date(params.endDate).getTime()
    : Date.now() + 365 * 86400000; // 1 year forward default

  // 1. Fetch events to build map
  const allEvents = await txDb
    .select()
    .from(events);

  const eventsMap = new Map<string, EventDateInfo>();
  for (const e of allEvents) {
    const solarDateStr = e.startTime ? new Date(e.startTime).toISOString().slice(0, 10) : null;
    eventsMap.set(e.id, {
      id: e.id,
      solarDate: solarDateStr,
      isDateConfirmed: e.status === 'confirmed' && Boolean(solarDateStr),
    });
  }

  const items: UnifiedCalendarItem[] = [];

  // 2. Event ceremony milestones
  for (const e of allEvents) {
    if (role === 'family_view' && allowedEventIds.length > 0 && !allowedEventIds.includes(e.id)) {
      continue;
    }
    if (e.startTime) {
      const dt = new Date(e.startTime);
      const solarDateStr = dt.toISOString().slice(0, 10);
      if (dt.getTime() >= startEpoch && dt.getTime() <= endEpoch) {
        items.push({
          id: `event-${e.id}`,
          itemType: 'event_ceremony',
          title: `Lễ cưới: ${e.title}`,
          dateTime: dt,
          dateString: solarDateStr,
          status: e.status,
          location: e.locationName || undefined,
          sourceId: e.id,
          sharedWithFamily: true,
        });
      }
    }
  }

  // 3. Tasks
  let taskQuery = txDb.select().from(tasks).$dynamic();
  if (role === 'family_view') {
    taskQuery = taskQuery.where(eq(tasks.sharedWithFamily, true));
  }
  const allTasks = await taskQuery;

  for (const t of allTasks) {
    if (role === 'family_view' && t.eventId && allowedEventIds.length > 0 && !allowedEventIds.includes(t.eventId)) {
      continue;
    }

    const metrics = computeEffectiveDueDate(t, eventsMap);
    if (metrics.effectiveDueDate) {
      const taskEpoch = metrics.effectiveDueDate.getTime();
      if (taskEpoch >= startEpoch && taskEpoch <= endEpoch) {
        const title =
          role === 'family_view'
            ? t.sharedPublicTitle || 'Công việc chung'
            : t.title;

        items.push({
          id: `task-${t.id}`,
          itemType: 'task',
          title: `Việc: ${title}`,
          dateTime: metrics.effectiveDueDate,
          dateString: metrics.effectiveDueDate.toISOString().slice(0, 10),
          status: t.status,
          priority: t.priority as any,
          sourceId: t.id,
          sharedWithFamily: t.sharedWithFamily,
        });
      }
    }
  }

  // 4. Appointments
  let apptQuery = txDb.select().from(appointments).$dynamic();
  if (role === 'family_view') {
    apptQuery = apptQuery.where(eq(appointments.sharedWithFamily, true));
  }
  const allAppts = await apptQuery;

  for (const a of allAppts) {
    if (role === 'family_view' && a.eventId && allowedEventIds.length > 0 && !allowedEventIds.includes(a.eventId)) {
      continue;
    }

    const apptEpoch = new Date(a.startTime).getTime();
    if (apptEpoch >= startEpoch && apptEpoch <= endEpoch) {
      items.push({
        id: `appt-${a.id}`,
        itemType: 'appointment',
        title: `Hẹn: ${a.title}`,
        dateTime: new Date(a.startTime),
        dateString: new Date(a.startTime).toISOString().slice(0, 10),
        status: 'scheduled',
        location: a.location || undefined,
        sourceId: a.id,
        sharedWithFamily: a.sharedWithFamily,
      });
    }
  }

  // 5. Payment Schedules — STRICTLY OWNER ONLY (AT03, UXT16)
  if (role === 'owner') {
    const schedules = await txDb
      .select({
        id: paymentSchedules.id,
        title: paymentSchedules.title,
        amountDue: paymentSchedules.amountDue,
        dueDate: paymentSchedules.dueDate,
        status: paymentSchedules.status,
        costItemName: costItems.name,
      })
      .from(paymentSchedules)
      .innerJoin(costItems, eq(paymentSchedules.costItemId, costItems.id))
      .where(sql`${paymentSchedules.status} != 'cancelled'`);

    for (const s of schedules) {
      const dt = new Date(`${s.dueDate}T12:00:00.000Z`);
      const schedEpoch = dt.getTime();
      if (schedEpoch >= startEpoch && schedEpoch <= endEpoch) {
        items.push({
          id: `payment-${s.id}`,
          itemType: 'payment_schedule',
          title: `Hạn thanh toán: ${s.costItemName} (${s.title})`,
          dateTime: dt,
          dateString: s.dueDate,
          status: s.status,
          amountDue: s.amountDue,
          sourceId: s.id,
          sharedWithFamily: false,
        });
      }
    }
  }

  // Sort unified feed chronologically
  return items.sort((a, b) => a.dateTime.getTime() - b.dateTime.getTime());
}
