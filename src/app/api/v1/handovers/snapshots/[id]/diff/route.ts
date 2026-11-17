import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getHandoverDeltaDiff } from '@/lib/handovers';
import { handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/handovers/snapshots/[id]/diff
 * Phát hiện thay đổi giữa bản chốt bàn giao và dữ liệu thực tế (FL13).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const diff = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getHandoverDeltaDiff(scopedDb, id);
      }
    );

    return NextResponse.json({ data: diff });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
