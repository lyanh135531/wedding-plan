import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { undoCheckIn } from '@/lib/attendance';
import { undoCheckInSchema } from '@/schemas/attendance';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/attendance/check-in/undo
 * Hoàn tác điểm danh khách mời.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
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

    const parseResult = undoCheckInSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu hoàn tác điểm danh không hợp lệ.',
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
        return undoCheckIn(scopedDb, parseResult.data, session!.user.id);
      }
    );

    return NextResponse.json({
      data: result,
      message: 'Hoàn tác điểm danh thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
