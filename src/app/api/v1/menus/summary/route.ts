import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { calculateMealSummary } from '@/lib/catering';
import { handleG8Error } from '../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã sự kiện eventId phải là UUID hợp lệ.' });

/**
 * GET /api/v1/menus/summary?eventId=<uuid>&bufferPercentage=0
 * Tính toán tổng hợp suất ăn (người lớn, trẻ em, chay, đặc biệt, suất ăn dự phòng)
 * đối chiếu với danh sách khách mời xác nhận tham dự (RSVP accepted).
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
    const parseEventId = uuidParamSchema.safeParse(eventId);
    if (!parseEventId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseEventId.error.issues?.[0]?.message || 'Thiếu hoặc sai eventId.' },
        { status: 400 }
      );
    }

    const bufferPercentageParam = searchParams.get('bufferPercentage');
    const bufferPercentage = bufferPercentageParam ? Math.max(parseFloat(bufferPercentageParam) || 0, 0) : 0;

    const summary = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return calculateMealSummary(scopedDb, parseEventId.data, bufferPercentage);
      }
    );

    return NextResponse.json({
      data: summary,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
