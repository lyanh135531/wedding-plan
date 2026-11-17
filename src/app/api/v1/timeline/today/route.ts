import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getTodayTimeline } from '@/lib/timeline';
import { handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/timeline/today?eventId=<uuid>&currentTime=<iso>
 * Dữ liệu màn hình vận hành ngày cưới "Hôm nay" (PLAN §14.1, UXT15).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Thiếu tham số bắt buộc: eventId.' },
        { status: 400 }
      );
    }

    const currentTimeParam = searchParams.get('currentTime');
    const wallClockTime = currentTimeParam ? new Date(currentTimeParam) : new Date();

    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getTodayTimeline(scopedDb, eventId, wallClockTime, session.role);
      }
    );

    return NextResponse.json({ data });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
