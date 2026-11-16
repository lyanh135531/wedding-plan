import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getTransportTripById,
  updateTransportTrip,
  deleteTransportTrip,
  listTripPassengers,
  TripNotFoundError,
  OptimisticLockError,
  InvalidCapacityReductionError,
} from '@/lib/logistics';
import { updateTransportTripSchema } from '@/schemas/logistics';
import { enforceOwnerRole, handleG8Error } from '../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã chuyến xe không hợp lệ.' });

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

/**
 * GET /api/v1/transport/[id]
 * Lấy chi tiết thông tin chuyến xe.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã chuyến xe không hợp lệ.' },
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

    const trip = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getTransportTripById(scopedDb, id);
      }
    );

    if (!trip) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Không tìm thấy chuyến xe.' },
        { status: 404 }
      );
    }

    const data =
      session.role === 'family_view'
        ? { ...trip, driverContact: null, notes: null }
        : trip;

    return NextResponse.json({
      data,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * PATCH /api/v1/transport/[id]
 * Cập nhật thông tin chuyến xe.
 * - Giảm sức chứa xe (AT22): Nếu capacity mới nhỏ hơn số khách đã gán -> HTTP 422 Unprocessable Entity.
 * - Khóa lạc quan (AT30): version mismatch -> HTTP 409 Conflict.
 * - Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã chuyến xe không hợp lệ.' },
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

    const parseResult = updateTransportTripSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật chuyến xe không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        const existing = await getTransportTripById(scopedDb, id, true);
        if (!existing) {
          throw new TripNotFoundError();
        }

        if (parseResult.data.version !== undefined && existing.version !== parseResult.data.version) {
          throw new OptimisticLockError(
            'Dữ liệu chuyến xe đã bị thay đổi bởi người dùng khác. Vui lòng tải lại trang.',
            existing.version
          );
        }

        // Capacity reduction check (AT22)
        if (parseResult.data.capacity !== undefined) {
          const passengers = await listTripPassengers(scopedDb, id);
          if (parseResult.data.capacity < passengers.length) {
            throw new InvalidCapacityReductionError(
              `Không thể giảm sức chứa dưới số hành khách đã phân bổ (${passengers.length} khách đã gán).`,
              passengers.length,
              parseResult.data.capacity
            );
          }
        }

        return updateTransportTrip(scopedDb, id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật chuyến xe thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * DELETE /api/v1/transport/[id]
 * Xóa chuyến xe.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã chuyến xe không hợp lệ.' },
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
        const deleted = await deleteTransportTrip(scopedDb, id);
        if (!deleted) {
          throw new TripNotFoundError();
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Xóa chuyến xe thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
