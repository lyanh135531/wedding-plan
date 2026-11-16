import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getTableById,
  updateTable,
  deleteTable,
  countOccupyingSeats,
  TableNotFoundError,
  OptimisticLockError,
  InvalidCapacityReductionError,
} from '@/lib/seating';
import { updateTableSchema } from '@/schemas/seating';
import { enforceOwnerRole, handleG8Error } from '../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã định danh bàn không hợp lệ (phải là UUID).' });

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

/**
 * GET /api/v1/tables/[id]
 * Lấy chi tiết thông tin một bàn.
 * AT26: Ẩn ghi chú riêng với vai trò 'family_view' (notes: null).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã bàn không hợp lệ.' },
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

    const table = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getTableById(scopedDb, id);
      }
    );

    if (!table) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Không tìm thấy thông tin bàn.' },
        { status: 404 }
      );
    }

    if (session.role === 'family_view') {
      return NextResponse.json({
        data: {
          ...table,
          notes: null,
        },
      });
    }

    return NextResponse.json({
      data: table,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * PATCH /api/v1/tables/[id]
 * Cập nhật thông tin bàn.
 * - Khóa lạc quan (AT30): Nếu version gửi lên khác version DB -> HTTP 409 Conflict.
 * - Giảm sức chứa (AT22): Nếu capacity mới nhỏ hơn số khách đang ngồi bàn -> HTTP 422 Unprocessable Entity.
 * - Phân quyền (AT03): family_view -> HTTP 403 Forbidden.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã bàn không hợp lệ.' },
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

    const parseResult = updateTableSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật bàn không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        const existing = await getTableById(scopedDb, id, true);
        if (!existing) {
          throw new TableNotFoundError();
        }

        if (parseResult.data.version !== undefined && existing.version !== parseResult.data.version) {
          throw new OptimisticLockError(
            'Dữ liệu bàn đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
            existing.version
          );
        }

        // Capacity reduction check (AT22)
        if (parseResult.data.capacity !== undefined) {
          const occupyingSeats = await countOccupyingSeats(scopedDb, existing.eventId, id);
          if (parseResult.data.capacity < occupyingSeats) {
            throw new InvalidCapacityReductionError(
              `Không thể giảm sức chứa dưới số khách đã xếp (${occupyingSeats} khách đang ngồi bàn).`,
              occupyingSeats,
              parseResult.data.capacity
            );
          }
        }

        return updateTable(scopedDb, id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật thông tin bàn thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * DELETE /api/v1/tables/[id]
 * Xóa bàn.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã bàn không hợp lệ.' },
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
        const existing = await getTableById(scopedDb, id);
        if (!existing) {
          throw new TableNotFoundError();
        }
        await deleteTable(scopedDb, id);
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Xóa bàn thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
