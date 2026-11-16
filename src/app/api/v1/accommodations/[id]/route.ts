import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getAccommodationById,
  updateAccommodation,
  deleteAccommodation,
  AccommodationNotFoundError,
} from '@/lib/logistics';
import { updateAccommodationSchema } from '@/schemas/logistics';
import { enforceOwnerRole, handleG8Error } from '../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã nơi lưu trú không hợp lệ.' });

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

/**
 * GET /api/v1/accommodations/[id]
 * Lấy chi tiết thông tin nơi lưu trú.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nơi lưu trú không hợp lệ.' },
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

    const accommodation = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getAccommodationById(scopedDb, id);
      }
    );

    if (!accommodation) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Không tìm thấy nơi lưu trú.' },
        { status: 404 }
      );
    }

    const data =
      session.role === 'family_view'
        ? { ...accommodation, contactPhone: null, notes: null }
        : accommodation;

    return NextResponse.json({
      data,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * PATCH /api/v1/accommodations/[id]
 * Cập nhật nơi lưu trú.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nơi lưu trú không hợp lệ.' },
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

    const parseResult = updateAccommodationSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật nơi lưu trú không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return updateAccommodation(scopedDb, id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật nơi lưu trú thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * DELETE /api/v1/accommodations/[id]
 * Xóa nơi lưu trú.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nơi lưu trú không hợp lệ.' },
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
        const deleted = await deleteAccommodation(scopedDb, id);
        if (!deleted) {
          throw new AccommodationNotFoundError();
        }
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Xóa nơi lưu trú thành công.',
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
