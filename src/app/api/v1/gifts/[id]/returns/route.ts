import { withIdempotency } from '@/lib/finance/idempotency.service';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { recordGiftReturn } from '@/lib/gifts';
import { createGiftReturnSchema } from '@/schemas/gifts';
import { enforceOwnerRole, enforceNoFamilyViewForGifts, checkArchivalFreezeGuard, handleG10Error } from '../../../g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/gifts/[id]/returns
 * Ghi nhận trả lại tiền mừng (FL16).
 * Invariant: Số tiền trả lại không được vượt quá số tiền quà còn giữ.
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

    const parseResult = createGiftReturnSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu trả quà không hợp lệ.',
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
        return (await withIdempotency({ transactionDb: scopedDb, userId: session!.user.id, key: req.headers.get('idempotency-key'), operationType: 'RETURN_GIFT', payload: { id, ...parseResult.data }, execute: async () => ({ status: 200, body: { data: await recordGiftReturn(scopedDb, id, parseResult.data, session!.user.id) } }) })).body.data;
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Ghi nhận trả lại quà thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
