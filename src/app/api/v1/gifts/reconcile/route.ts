import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { reconcileSafeCash } from '@/lib/gifts';
import { reconcileSafeCashSchema } from '@/schemas/gifts';
import { enforceOwnerRole, enforceNoFamilyViewForGifts, checkArchivalFreezeGuard, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/gifts/reconcile
 * Đối soát két tiền thực tế với sổ quà trên phần mềm.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session) || enforceNoFamilyViewForGifts(session);
    if (authError) return authError;

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    const parseResult = reconcileSafeCashSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu đối soát không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        await checkArchivalFreezeGuard(scopedDb);
        return reconcileSafeCash(scopedDb, parseResult.data);
      }
    );

    return NextResponse.json({
      data: result,
      message: result.isBalanced
        ? 'Đối soát khớp hoàn toàn giữa két tiền thực tế và sổ quà.'
        : `Phát hiện chênh lệch: ${result.variance} ₫.`,
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
