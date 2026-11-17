import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { previewDelayShift, applyDelayShift } from '@/lib/timeline';
import { previewShiftTimelineSchema, applyShiftTimelineSchema } from '@/schemas/timeline';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/timeline/shift
 * Xem trước hoặc thực hiện dời lịch các mốc sau (FL15).
 * Body: { eventId, delayMinutes, pivotTime?, pivotItemId?, confirmed?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    let bodyJson: any;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    if (bodyJson?.confirmed === true) {
      const parseResult = applyShiftTimelineSchema.safeParse(bodyJson);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: parseResult.error.issues?.[0]?.message || 'Dữ liệu dời lịch không hợp lệ.',
            details: parseResult.error.flatten(),
          },
          { status: 400 }
        );
      }

      await withTransactionScopedContext(
        session!.user.id,
        session!.role,
        async (_client, scopedDb) => {
          await checkArchivalFreezeGuard(scopedDb);
          await applyDelayShift(scopedDb, parseResult.data);
        }
      );

      return NextResponse.json({
        message: `Đã dời lịch các mục chưa diễn ra thêm ${parseResult.data.delayMinutes} phút thành công.`,
      });
    } else {
      const parseResult = previewShiftTimelineSchema.safeParse(bodyJson);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: parseResult.error.issues?.[0]?.message || 'Dữ liệu xem trước dời lịch không hợp lệ.',
            details: parseResult.error.flatten(),
          },
          { status: 400 }
        );
      }

      const preview = await withTransactionScopedContext(
        session!.user.id,
        session!.role,
        async (_client, scopedDb) => {
          return previewDelayShift(scopedDb, parseResult.data);
        }
      );

      return NextResponse.json({ data: preview });
    }
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
