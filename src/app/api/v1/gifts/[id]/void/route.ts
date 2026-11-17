import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { voidGift } from '@/lib/gifts';
import { voidGiftSchema } from '@/schemas/gifts';
import { enforceOwnerRole, enforceNoFamilyViewForGifts, checkArchivalFreezeGuard, handleG10Error } from '../../../g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/gifts/[id]/void
 * Hủy bỏ quà mừng sai sót (kèm lý do bắt buộc).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session) || enforceNoFamilyViewForGifts(session);
    if (authError) return authError;

    const { id } = await params;
    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    const parseResult = voidGiftSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu hủy quà không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        await checkArchivalFreezeGuard(scopedDb);
        return voidGift(scopedDb, id, parseResult.data, session!.user.id);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Hủy quà mừng thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
