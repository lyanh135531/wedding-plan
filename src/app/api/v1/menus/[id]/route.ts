import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getMenuById,
  updateMenu,
  deleteMenu,
  MenuNotFoundError,
} from '@/lib/catering';
import { updateMenuSchema } from '@/schemas/catering';
import { enforceOwnerRole, handleG8Error } from '../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã thực đơn không hợp lệ.' });

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

/**
 * GET /api/v1/menus/[id]
 * Lấy chi tiết thông tin thực đơn.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã thực đơn không hợp lệ.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const menu = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getMenuById(scopedDb, id);
      }
    );

    if (!menu) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Không tìm thấy thực đơn.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: menu,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * PATCH /api/v1/menus/[id]
 * Cập nhật thông tin thực đơn.
 * - Khóa lạc quan (AT30): version mismatch -> HTTP 409 Conflict.
 * - Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
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

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu yêu cầu không hợp lệ (JSON invalid).' },
        { status: 400 }
      );
    }

    const parseResult = updateMenuSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật thực đơn không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return updateMenu(scopedDb, id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật thực đơn thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * DELETE /api/v1/menus/[id]
 * Xóa thực đơn.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
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

    await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        const deleted = await deleteMenu(scopedDb, id);
        if (!deleted) {
          throw new MenuNotFoundError();
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Xóa thực đơn thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
