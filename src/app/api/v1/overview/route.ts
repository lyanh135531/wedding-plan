import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getDashboardOverview } from '@/lib/tasks/dashboard.repository';

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
        return getDashboardOverview(txDb, {
          role: session.role,
          allowedEventIds: session.allowedEventIds,
        });
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
