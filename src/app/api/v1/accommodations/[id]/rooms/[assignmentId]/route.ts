import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  unassignRoom,
  RoomAssignmentNotFoundError,
} from '@/lib/logistics';
import { enforceOwnerRole, handleG8Error } from '../../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid();

type RouteContext = {
  params: { id: string; assignmentId: string } | Promise<{ id: string; assignmentId: string }>;
};

/**
 * DELETE /api/v1/accommodations/[id]/rooms/[assignmentId]
 * Hủy phân bổ phòng của khách.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { assignmentId } = await Promise.resolve(context.params);
    const parseAssignmentId = uuidParamSchema.safeParse(assignmentId);
    if (!parseAssignmentId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Mã phân bổ phòng không hợp lệ.' },
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
        const deleted = await unassignRoom(scopedDb, assignmentId);
        if (!deleted) {
          throw new RoomAssignmentNotFoundError('Không tìm thấy thông tin phân bổ phòng để hủy.');
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Hủy phân bổ phòng thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
