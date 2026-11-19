import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getVendorById,
  updateVendor,
  deleteVendor,
  VendorNotFoundError,
  VendorHasActiveCostItemsError,
  VersionConflictError,
} from '@/lib/vendors/vendors.repository';
import { updateVendorSchema } from '@/schemas/vendors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã định danh nhà cung cấp không hợp lệ (phải là UUID).' });

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/vendors/[id]
 * Lấy chi tiết thông tin hồ sơ nhà cung cấp.
 * AT03: Tự động ẩn ghi chú nội bộ và phụ phí mật với vai trò 'family_view'.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nhà cung cấp không hợp lệ.' },
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

    const vendor = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getVendorById(scopedDb, id, session.role);
      }
    );

    if (!vendor) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: 'Không tìm thấy nhà cung cấp.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: vendor,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi tải thông tin nhà cung cấp.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/v1/vendors/[id]
 * Cập nhật thông tin nhà cung cấp với khóa lạc quan (Optimistic Locking - version).
 * Yêu cầu phiên chủ sở hữu (requireOwnerSession).
 * Nếu version không khớp với phiên bản hiện hành trên server -> HTTP 409 CONFLICT (AT30).
 */
export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nhà cung cấp không hợp lệ.' },
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

    if (session.role !== 'owner') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Chỉ chủ sở hữu mới có quyền cập nhật nhà cung cấp.' },
        { status: 403 }
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu yêu cầu không hợp lệ (JSON invalid).' },
        { status: 400 }
      );
    }

    const parseResult = updateVendorSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return updateVendor(scopedDb, id, parseResult.data, session.user.id);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật nhà cung cấp thành công.',
    });
  } catch (err: unknown) {
    if (err instanceof VersionConflictError) {
      return NextResponse.json(
        { error: 'CONFLICT', message: err.message },
        { status: 409 }
      );
    }

    if (err instanceof VendorNotFoundError) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: err.message },
        { status: 404 }
      );
    }

    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi cập nhật nhà cung cấp.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/vendors/[id]
 * Xóa nhà cung cấp.
 * Yêu cầu phiên chủ sở hữu (requireOwnerSession).
 * Nếu nhà cung cấp đã có khoản chi hoạt động hoặc hợp đồng liên kết -> HTTP 400 BAD_REQUEST.
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nhà cung cấp không hợp lệ.' },
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

    if (session.role !== 'owner') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Chỉ chủ sở hữu mới có quyền xóa nhà cung cấp.' },
        { status: 403 }
      );
    }

    await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return deleteVendor(scopedDb, id, session.user.id);
      }
    );

    return NextResponse.json({
      message: 'Đã xóa nhà cung cấp thành công.',
    });
  } catch (err: unknown) {
    if (err instanceof VendorHasActiveCostItemsError) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: err.message },
        { status: 400 }
      );
    }

    if (err instanceof VendorNotFoundError) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: err.message },
        { status: 404 }
      );
    }

    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi xóa nhà cung cấp.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
