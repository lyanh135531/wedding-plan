import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getGiftWithDetails } from '@/lib/gifts';
import { enforceNoFamilyViewForGifts, handleG10Error } from '../../g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/gifts/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceNoFamilyViewForGifts(session);
    if (authError) return authError;

    const { id } = await params;
    const item = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return getGiftWithDetails(scopedDb, id);
      }
    );

    if (!item) {
      return NextResponse.json(
        { error: 'GIFT_NOT_FOUND', message: 'Không tìm thấy quà mừng.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
