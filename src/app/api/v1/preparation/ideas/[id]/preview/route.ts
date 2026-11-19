import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { previewIdeaPromotion } from '@/lib/preparation';
import { enforceOwnerRole, handleG9Error } from '../../../../g9-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/v1/preparation/ideas/[id]/preview
 * Xem trước tạo công việc và khoản chi từ ý tưởng (PLAN §15).
 * Thao tác này KHÔNG tự động tạo bản ghi trong DB.
 */
export async function GET(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    const preview = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return previewIdeaPromotion(scopedDb, params.id);
      }
    );

    return NextResponse.json({ data: preview });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}
