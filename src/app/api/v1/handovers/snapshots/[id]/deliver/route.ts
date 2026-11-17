import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { deliverHandover } from '@/lib/handovers';
import { deliverHandoverPacketSchema } from '@/schemas/handovers';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/handovers/snapshots/[id]/deliver
 * Ghi nhận bàn giao bộ tài liệu cho nhà hàng/đối tác.
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

    const parseResult = deliverHandoverPacketSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu bàn giao không hợp lệ.',
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
        return deliverHandover(scopedDb, id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Ghi nhận bàn giao thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
