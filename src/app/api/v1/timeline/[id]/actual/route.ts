import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { markActualTimes } from '@/lib/timeline';
import { markActualTimesSchema } from '@/schemas/timeline';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '../../../g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/timeline/[id]/actual
 * Ghi nhận thời gian bắt đầu hoặc kết thúc thực tế của mốc lịch trình (AT34).
 * Bắt buộc giữ nguyên thời gian dự kiến (scheduled times) không đổi.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
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

    const parseResult = markActualTimesSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu thời gian thực tế không hợp lệ.',
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
        return markActualTimes(scopedDb, id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Ghi nhận thời gian thực tế thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
