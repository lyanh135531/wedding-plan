import { NextRequest, NextResponse } from 'next/server';
import { eq, inArray, ne } from 'drizzle-orm';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getDashboardOverview } from '@/lib/tasks/dashboard.repository';
import { events } from '@/db/schema/events';
import { invitations } from '@/db/schema/guests';
import { seatAssignments, tables } from '@/db/schema/seating';
import { budgetCategories, costItems } from '@/db/schema/finance';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const overview = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        const baseOverview = await getDashboardOverview(txDb, {
          role: session.role,
          allowedEventIds: session.allowedEventIds,
        });

        const activeEventRows = await txDb
          .select({ id: events.id })
          .from(events)
          .where(ne(events.status, 'cancelled'));

        const activeIds = activeEventRows.map((e) => e.id);

        const [invRows, tableRows, seatRows, costCategoryRows] = activeIds.length
          ? await Promise.all([
              txDb
                .select({ status: invitations.status })
                .from(invitations)
                .where(inArray(invitations.eventId, activeIds)),
              txDb
                .select({ id: tables.id, capacity: tables.capacity })
                .from(tables)
                .where(inArray(tables.eventId, activeIds)),
              txDb
                .select({ tableId: seatAssignments.tableId })
                .from(seatAssignments)
                .where(inArray(seatAssignments.eventId, activeIds)),
              txDb
                .select({
                  costId: costItems.id,
                  categoryName: budgetCategories.name,
                })
                .from(costItems)
                .innerJoin(budgetCategories, eq(costItems.categoryId, budgetCategories.id)),
            ])
          : [[], [], [], []];

        let sentCards = 0;
        let preparingCards = 0;
        let saveTheDateCards = 0;
        for (const row of invRows) {
          if (row.status === 'sent') sentCards++;
          else if (row.status === 'preparing') preparingCards++;
          else saveTheDateCards++;
        }

        const totalCapacity = tableRows.reduce((sum, row) => sum + Number(row.capacity || 0), 0);
        const categoryByCostId = new Map(
          costCategoryRows.map((row) => [row.costId, row.categoryName])
        );

        const activeEventIdSet = new Set(activeIds);
        const enrichedFinance = baseOverview.finance
          ? {
              ...baseOverview.finance,
              topExpenses: (baseOverview.finance.topExpenses || []).map((item: any) => ({
                ...item,
                category: categoryByCostId.get(item.id) || item.category || '',
              })),
            }
          : null;

        return {
          ...baseOverview,
          events: (baseOverview.events || []).filter((ev: any) => activeEventIdSet.has(ev.id)),
          finance: enrichedFinance,
          invitations: {
            totalCards: invRows.length,
            sentCards,
            preparingCards,
            saveTheDateCards,
          },
          seating: {
            totalTables: tableRows.length,
            totalCapacity,
            seatedCount: seatRows.length,
          },
        };
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(overview, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error('[GET /api/v1/overview error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
