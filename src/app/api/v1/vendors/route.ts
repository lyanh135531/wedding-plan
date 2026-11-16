import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  listVendors,
  createVendor,
  ListVendorsParams,
} from '@/lib/vendors/vendors.repository';
import {
  createVendorSchema,
  vendorServiceTypeEnum,
  vendorStatusEnum,
  VendorServiceType,
  VendorStatus,
} from '@/schemas/vendors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/vendors
 * Danh sách nhà cung cấp có lọc, phân trang, tìm kiếm unaccent Tiếng Việt.
 * Yêu cầu phiên đăng nhập.
 * AT03: Nếu vai trò là 'family_view', tự động ẩn các ghi chú mật và ghi chú phụ phí.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập để truy cập danh sách nhà cung cấp.' },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search')?.trim() || undefined;

    const rawServiceType = searchParams.get('serviceType') || searchParams.get('service_type');
    let serviceType: VendorServiceType | undefined;
    if (rawServiceType) {
      const parsedType = vendorServiceTypeEnum.safeParse(rawServiceType);
      if (!parsedType.success) {
        return NextResponse.json(
          { error: 'BAD_REQUEST', message: 'Loại dịch vụ không hợp lệ.' },
          { status: 400 }
        );
      }
      serviceType = parsedType.data;
    }

    const rawStatus = searchParams.get('status');
    let status: VendorStatus | undefined;
    if (rawStatus) {
      const parsedStatus = vendorStatusEnum.safeParse(rawStatus);
      if (!parsedStatus.success) {
        return NextResponse.json(
          { error: 'BAD_REQUEST', message: 'Trạng thái nhà cung cấp không hợp lệ.' },
          { status: 400 }
        );
      }
      status = parsedStatus.data;
    }

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 100) : 50;

    const offsetParam = searchParams.get('offset');
    const pageParam = searchParams.get('page');

    let page = 1;
    if (offsetParam !== null && offsetParam !== undefined) {
      const offset = Math.max(parseInt(offsetParam, 10) || 0, 0);
      page = Math.floor(offset / limit) + 1;
    } else if (pageParam) {
      page = Math.max(parseInt(pageParam, 10) || 1, 1);
    }

    const queryParams: ListVendorsParams = {
      serviceType,
      status,
      search,
      page,
      limit,
      role: session.role,
    };

    const vendorsList = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listVendors(scopedDb, queryParams);
      }
    );

    return NextResponse.json({
      data: vendorsList,
      pagination: {
        page,
        limit,
        total: vendorsList.length,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi tải danh sách nhà cung cấp.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/vendors
 * Tạo mới nhà cung cấp.
 * Yêu cầu phiên chủ sở hữu (requireOwnerSession - AT03).
 * Xác thực dữ liệu với createVendorSchema, thực thi trong withTransactionScopedContext.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    if (session.role !== 'owner') {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: 'Chỉ chủ sở hữu mới có quyền tạo nhà cung cấp.' },
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

    const parseResult = createVendorSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu nhà cung cấp không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return createVendor(scopedDb, parseResult.data, session.user.id);
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Tạo nhà cung cấp thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi tạo nhà cung cấp.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
