import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getFinanceOverview } from '@/lib/finance/funds.repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // AT03, UXT16: Family View role is 100% blocked from financial endpoints
  if (session.role !== 'owner') {
    return NextResponse.json(
      { error: 'FORBIDDEN: Family role cannot view financial overview' },
      { status: 403 }
    );
  }

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return getFinanceOverview(txDb);
      }
    );

    // Convert BigInts for JSON serialization
    const serialized = JSON.parse(
      JSON.stringify(data, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({ data: serialized });
  } catch (error: any) {
    console.error('[GET /api/v1/finance/overview error]:', error);
    return NextResponse.json(
      { error: error?.message || 'INTERNAL_ERROR' },
      { status: error?.statusCode || 500 }
    );
  }
}
