import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getEventHeadcountSummary } from '@/lib/guests';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Tham số eventId là bắt buộc' },
      { status: 400 }
    );
  }

  if (session.role === 'family_view' && !session.allowedEventIds.includes(eventId)) {
    return NextResponse.json(
      { error: 'FORBIDDEN: You do not have access to this event' },
      { status: 403 }
    );
  }

  try {
    const summary = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return getEventHeadcountSummary(txDb, eventId);
      }
    );

    return NextResponse.json({ data: summary });
  } catch (error: any) {
    console.error('[GET /api/v1/attendance/summary error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
