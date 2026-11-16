import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  updateMenuItem,
  deleteMenuItem,
  MenuItemNotFoundError,
} from '@/lib/catering';
import { updateMenuItemSchema } from '@/schemas/catering';
import { enforceOwnerRole, handleG8Error } from '../../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid();

type RouteContext = {
  params: { id: string; itemId: string } | Promise<{ id: string; itemId: string }>;
};

/**
 * PATCH /api/v1/menus/[id]/items/[itemId]
 * Cập nhật món ăn trong thực đơn.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { itemId } = await Promise.resolve(context.params);
    const parseItemId = uuidParamSchema.safeParse(itemId);
    if (!parseItemId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Mã món ăn không hợp lệ.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu yêu cầu không hợp lệ (JSON invalid).' },
        { status: 400 }
      );
    }

    const parseResult = updateMenuItemSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật món ăn không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return updateMenuItem(scopedDb, itemId, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật món ăn thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * DELETE /api/v1/menus/[id]/items/[itemId]
 * Xóa món ăn khỏi thực đơn.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { itemId } = await Promise.resolve(context.params);
    const parseItemId = uuidParamSchema.safeParse(itemId);
    if (!parseItemId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Mã món ăn không hợp lệ.' },
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
        const deleted = await deleteMenuItem(scopedDb, itemId);
        if (!deleted) {
          throw new MenuItemNotFoundError();
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Xóa món ăn thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
