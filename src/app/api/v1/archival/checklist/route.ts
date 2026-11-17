import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getPostWeddingChecklist } from '@/lib/archival';
import { handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/archival/checklist
 * 7 đầu việc đóng gói sau cưới liên kết trực tiếp với dữ liệu thực tế (PLAN §16, S35).
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

    const checklist = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getPostWeddingChecklist(scopedDb);
      }
    );

    return NextResponse.json({ data: checklist });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
