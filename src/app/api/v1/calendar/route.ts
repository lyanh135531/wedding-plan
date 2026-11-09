import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getUnifiedCalendarFeed } from '@/lib/tasks/calendar.repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;

  try {
    const feed = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return getUnifiedCalendarFeed(txDb, {
          startDate,
          endDate,
          role: session.role,
          allowedEventIds: session.allowedEventIds,
        });
      }
    );

    const serialized = JSON.parse(
      JSON.stringify(feed, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized, total: serialized.length });
  } catch (error: any) {
    console.error('[GET /api/v1/calendar error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
