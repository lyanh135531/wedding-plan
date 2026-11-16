import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  unassignPassenger,
  TripPassengerNotFoundError,
} from '@/lib/logistics';
import { enforceOwnerRole, handleG8Error } from '../../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid();

type RouteContext = {
  params: { id: string; guestId: string } | Promise<{ id: string; guestId: string }>;
};

/**
 * DELETE /api/v1/transport/[id]/passengers/[guestId]
 * Gỡ khách mời khỏi chuyến xe.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id, guestId } = await Promise.resolve(context.params);
    const parseTripId = uuidParamSchema.safeParse(id);
    const parseGuestId = uuidParamSchema.safeParse(guestId);

    if (!parseTripId.success || !parseGuestId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Mã chuyến xe hoặc mã khách mời không hợp lệ.' },
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
        const deleted = await unassignPassenger(scopedDb, id, guestId);
        if (!deleted) {
          throw new TripPassengerNotFoundError('Hành khách chưa được xếp lên chuyến xe này.');
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Gỡ hành khách khỏi chuyến xe thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
