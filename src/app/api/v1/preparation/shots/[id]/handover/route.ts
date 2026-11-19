import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { recordShotListHandover } from '@/lib/preparation';
import { handoverShotListSchema } from '@/schemas/preparation';
import { enforceOwnerRole, handleG9Error } from '../../../../g9-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/v1/preparation/shots/[id]/handover
 * Ghi nhận bàn giao cảnh chụp cho ekip ảnh (PLAN §15).
 * Invariant: Bản ghi thời điểm bàn giao (handedOverAt) là bất biến (immutable) sau khi đã thiết lập.
 */
export async function POST(req: NextRequest, props: RouteContext) {
  const params = await props.params;
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

    const parseResult = handoverShotListSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu bàn giao cảnh chụp không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return recordShotListHandover(scopedDb, params.id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: result,
      message: 'Ghi nhận bàn giao cảnh chụp cho ekip thành công.',
    });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}
