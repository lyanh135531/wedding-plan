import { eq, and, inArray, sql, desc, asc } from 'drizzle-orm';
import { guests, attendance, invitations } from '@/db/schema/guests';
import { tasks, appointments } from '@/db/schema/tasks';
import { events } from '@/db/schema/events';
import { costItems, paymentSchedules, payments, fundSettings, fundingEntries } from '@/db/schema/finance';
import { computeEffectiveDueDate, EventDateInfo } from './deadlines';
import { calculateCostItemMetrics, calculateOverallBudgetSummary, calculateCashLedger } from '@/lib/finance/calculator';
import { getUnifiedCalendarFeed } from './calendar.repository';
import { getFinanceOverview } from '@/lib/finance/funds.repository';
import { TxOrDb } from '@/lib/finance/costs.repository';
import { weddingDateKey, endOfWeddingDay } from '@/lib/dates';

export interface DashboardOverviewParams {
  role: 'owner' | 'family_view';
  allowedEventIds?: string[];
  currentDate?: Date;
}

/**
 * Aggregates live overview metrics from real database queries (0 stale cached figures).
 * Adheres to AT20: updating tasks or payment deadlines dynamically recalculates overdue figures immediately.
 */
export async function getDashboardOverview(
  txDb: TxOrDb,
  params: DashboardOverviewParams
) {
  const { role, allowedEventIds = [], currentDate = new Date() } = params;

  // 1. Fetch Events
  const allEvents = await txDb
    .select()
    .from(events);

  const eventsMap = new Map<string, EventDateInfo>();
  for (const e of allEvents) {
    const solarDateStr = e.startTime ? weddingDateKey(e.startTime) : null;
    eventsMap.set(e.id, {
      id: e.id,
      solarDate: solarDateStr,
      isDateConfirmed: e.status === 'confirmed' && Boolean(solarDateStr),
    });
  }

  // 2. Guest & Attendance Counts
  let attQuery = txDb.select().from(attendance).$dynamic();
  if (role === 'family_view') {
    attQuery = attQuery.where(inArray(attendance.eventId, allowedEventIds));
  }
  const allAttendances = await attQuery;

  let confirmedCount = 0;
  let declinedCount = 0;
  let uncertainCount = 0;
  let confirmedSeats = 0;

  for (const a of allAttendances) {
    if (a.rsvpStatus === 'accepted') {
      confirmedCount++;
      if (a.needsSeat) confirmedSeats++;
    } else if (a.rsvpStatus === 'declined') {
      declinedCount++;
    } else {
      uncertainCount++;
    }
  }

  // Unique guests count
  const allGuests = await txDb
    .select({ id: guests.id })
    .from(guests)
    .where(eq(guests.isArchived, false));

  const totalUniqueGuests = allGuests.length;

  // 3. Task Progress & Overdue Metrics (AT20)
  let taskQuery = txDb.select().from(tasks).$dynamic();
  if (role === 'family_view') {
    taskQuery = taskQuery.where(eq(tasks.sharedWithFamily, true));
  }
  const allTasks = await taskQuery;

  let totalTasks = 0;
  let completedTasks = 0;
  let inProgressTasks = 0;
  let overdueTasks = 0;

  for (const t of allTasks) {
    if (t.status === 'cancelled') continue;
    totalTasks++;

    if (t.status === 'completed') {
      completedTasks++;
    } else {
      if (t.status === 'in_progress') inProgressTasks++;
      const metrics = computeEffectiveDueDate(t, eventsMap, currentDate);
      if (metrics.isOverdue) {
        overdueTasks++;
      }
    }
  }

  // 4. Financial Metrics — STRICTLY NULL FOR FAMILY VIEW (AT03, UXT16)
  let financialMetrics: any = null;
  if (role === 'owner') {
    const allCostItems = await txDb.select().from(costItems);
    const allPayments = await txDb.select().from(payments);

    const paymentsByItem = new Map<string, Array<{ paymentType: 'outflow' | 'refund'; amount: bigint; isVoided: boolean }>>();
    for (const p of allPayments) {
      if (!paymentsByItem.has(p.costItemId)) {
        paymentsByItem.set(p.costItemId, []);
      }
      paymentsByItem.get(p.costItemId)!.push({
        paymentType: p.paymentType as 'outflow' | 'refund',
        amount: p.amount,
        isVoided: p.isVoided,
      });
    }

    const itemsWithMetrics: Array<{ item: typeof costItems.$inferSelect; metrics: ReturnType<typeof calculateCostItemMetrics> }> = allCostItems.map((item: typeof costItems.$inferSelect) => {
      const itemPayments = paymentsByItem.get(item.id) || [];
      const metrics = calculateCostItemMetrics(item, itemPayments);
      return { item, metrics };
    });

    const { budgetSummary, cashLedger } = await getFinanceOverview(txDb);

    // Overdue payments count
    const activeSchedules = await txDb
      .select()
      .from(paymentSchedules)
      .where(sql`${paymentSchedules.status} != 'cancelled'`);

    let overduePaymentsCount = 0;
    const nowEpoch = currentDate.getTime();
    for (const s of activeSchedules) {
      const dueEpoch = endOfWeddingDay(s.dueDate).getTime();
      if (nowEpoch > dueEpoch) {
        overduePaymentsCount++;
      }
    }

    financialMetrics = {
      budgetSummary,
      cashLedger,
      overduePaymentsCount,
      topExpenses: itemsWithMetrics.filter(({ metrics }) => metrics.forecastAmount !== null)
        .sort((a, b) => a.metrics.forecastAmount! > b.metrics.forecastAmount! ? -1 : a.metrics.forecastAmount! < b.metrics.forecastAmount! ? 1 : 0)
        .slice(0, 5).map(({ item, metrics }) => ({
          id: item.id, name: item.name, amount: metrics.forecastAmount,
          category: '', status: item.finalSettlementAmount !== null ? 'settled' : item.contractedAmount !== null ? 'contracted' : 'estimated',
        })),
    };
  }

  // 5. 7-Day Agenda Feed (AT62)
  const next7Days = new Date(currentDate.getTime() + 7 * 86400000);
  const agendaFeed = await getUnifiedCalendarFeed(txDb, {
    startDate: currentDate,
    endDate: next7Days,
    role,
    allowedEventIds,
  });

  return {
    guests: {
      totalUniqueGuests,
      totalAttendanceInstances: allAttendances.length,
      confirmedCount,
      declinedCount,
      uncertainCount,
      confirmedSeats,
    },
    tasks: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
    },
    finance: financialMetrics,
    agenda7Days: agendaFeed,
    events: allEvents.map((e: any) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      solarDate: e.startTime ? weddingDateKey(e.startTime) : null,
      isDateConfirmed: e.status === 'confirmed',
    })),
  };
}
