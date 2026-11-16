import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { exportSeatingChartA4 } from '@/lib/seating';
import { handleG8Error } from '../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã sự kiện eventId phải là UUID hợp lệ.' });

/**
 * GET /api/v1/tables/export?eventId=<uuid>
 * Xuất sơ đồ bàn và danh sách khách A4 đã được làm sạch bảo mật (AT26).
 * - Vai trò 'owner': hiển thị đầy đủ thông tin liên hệ và ghi chú riêng.
 * - Vai trò 'family_view': ẩn 100% ghi chú mật, email, số điện thoại (0 private notes/contact info).
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

    const exportData = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return exportSeatingChartA4(scopedDb, parseEventId.data, session.role);
      }
    );

    return NextResponse.json({
      data: exportData,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
