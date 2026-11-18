import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getTableById,
  unassignGuest,
  TableNotFoundError,
  SeatAssignmentNotFoundError,
} from '@/lib/seating';
import { enforceOwnerRole, handleG8Error } from '../../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid();

type RouteContext = {
  params: { id: string; guestId: string } | Promise<{ id: string; guestId: string }>;
};

/**
 * DELETE /api/v1/tables/[id]/seats/[guestId]
 * Gỡ phân bổ khách mời khỏi bàn.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id, guestId } = await Promise.resolve(context.params);
    const parseTableId = uuidParamSchema.safeParse(id);
    const parseGuestId = uuidParamSchema.safeParse(guestId);

    if (!parseTableId.success || !parseGuestId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Mã bàn hoặc mã khách mời không hợp lệ.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        const table = await getTableById(scopedDb, id);
        if (!table) {
          throw new TableNotFoundError();
        }

        const unseated = await unassignGuest(scopedDb, table.eventId, guestId, session!.user.id, id);
        if (!unseated) {
          throw new SeatAssignmentNotFoundError('Khách mời chưa được xếp vào bàn này.');
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Gỡ chỗ ngồi thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
