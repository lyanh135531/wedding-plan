import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getMenuById,
  createAndLockCateringSnapshot,
  MenuNotFoundError,
} from '@/lib/catering';
import { enforceOwnerRole, handleG8Error } from '../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã thực đơn không hợp lệ.' });

const lockBodySchema = z.object({
  eventId: z.string().uuid().optional(),
  bufferPercentage: z.number().min(0).default(0),
  notes: z.string().optional().nullable(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * POST /api/v1/menus/[id]/lock
 * Đóng băng và chốt số lượng suất ăn với nhà hàng (AT52 Catering Snapshot).
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã thực đơn không hợp lệ.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    let bodyJson: unknown = {};
    try {
      bodyJson = await req.json();
    } catch {
      // Body may be empty
    }

    const parseResult = lockBodySchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu chốt suất ăn không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const snapshot = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        let eventId = parseResult.data.eventId;
        if (!eventId) {
          const menu = await getMenuById(scopedDb, id);
          if (!menu) {
            throw new MenuNotFoundError();
          }
          eventId = menu.eventId;
        }

        return createAndLockCateringSnapshot(
          scopedDb,
          eventId,
          id,
          session!.user.id,
          parseResult.data.bufferPercentage,
          parseResult.data.notes ?? undefined
        );
      }
    );

    return NextResponse.json(
      {
        data: snapshot,
        message: 'Chốt số lượng suất ăn với nhà hàng thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
