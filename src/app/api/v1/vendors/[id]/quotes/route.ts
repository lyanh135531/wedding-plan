import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  listQuotesByVendorId,
  createInitialQuote,
  createNewQuoteVersion,
  QuoteNotFoundError,
} from '@/lib/vendors/quotes.repository';
import {
  getVendorById,
  VendorNotFoundError,
} from '@/lib/vendors/vendors.repository';
import {
  createQuoteSchema,
  reviseQuoteSchema,
} from '@/schemas/vendors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã định danh nhà cung cấp không hợp lệ (phải là UUID).' });

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/vendors/[id]/quotes
 * Lấy danh sách báo giá của nhà cung cấp.
 * AT03, AT41: Chỉ dành riêng cho Chủ sở hữu (Owner). Người nhà bị chặn 100% với mã HTTP 403.
 * Hỗ trợ tham số query includeSuperseded: boolean (nếu true: trả về mọi phiên bản lịch sử; nếu false: chỉ lấy bản mới nhất).
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

    // AT03, AT41: Ngăn chặn triệt để Người nhà truy cập báo giá và số tiền hợp đồng mật
    if (session.role !== 'owner') {
      return NextResponse.json(
        {
          error: 'FORBIDDEN',
          message: 'Tài khoản Người nhà không có quyền truy cập báo giá chi tiết và số tiền thương thảo.',
        },
        { status: 403 }
      );
    }

    const { searchParams } = req.nextUrl;
    const includeSuperseded =
      searchParams.get('includeSuperseded') === 'true' ||
      searchParams.get('include_superseded') === 'true';

    const quotes = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        const vendor = await getVendorById(scopedDb, id, 'owner');
        if (!vendor) {
          throw new VendorNotFoundError();
        }
        return listQuotesByVendorId(scopedDb, id, { includeSuperseded });
      }
    );

    return NextResponse.json({
      data: quotes,
    });
  } catch (err: unknown) {
    if (err instanceof VendorNotFoundError) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: err.message },
        { status: 404 }
      );
    }

    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi tải danh sách báo giá.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/vendors/[id]/quotes
 * Tạo báo giá lần đầu (version 1) HOẶC tạo phiên bản báo giá mới kế thừa (AT24).
 * Yêu cầu quyền chủ sở hữu.
 * Nếu body chứa parent_quote_id (hoặc base_quote_id): thực hiện tạo phiên bản mới bất biến (createNewQuoteVersion).
 * Ngược lại: thực hiện tạo báo giá ban đầu (createInitialQuote).
 */
export async function POST(req: NextRequest, context: RouteContext) {
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
        { error: 'FORBIDDEN', message: 'Chỉ chủ sở hữu mới có quyền tạo hoặc chỉnh sửa báo giá.' },
        { status: 403 }
      );
    }

    let bodyJson: Record<string, any>;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu yêu cầu không hợp lệ (JSON invalid).' },
        { status: 400 }
      );
    }

    const parentQuoteId = bodyJson.parent_quote_id || bodyJson.base_quote_id;

    if (parentQuoteId) {
      // 1. Phân nhánh tạo phiên bản kế thừa (AT24)
      const parseRevise = reviseQuoteSchema.safeParse(bodyJson);
      if (!parseRevise.success) {
        return NextResponse.json(
          {
            error: 'VALIDATION_ERROR',
            message: parseRevise.error.issues?.[0]?.message || 'Dữ liệu phiên bản báo giá không hợp lệ.',
            details: parseRevise.error.flatten(),
          },
          { status: 400 }
        );
      }

      const newVersion = await withTransactionScopedContext(
        session.user.id,
        session.role,
        async (_client, scopedDb) => {
          return createNewQuoteVersion(scopedDb, String(parentQuoteId), parseRevise.data, session.user.id);
        }
      );

      return NextResponse.json(
        {
          data: newVersion,
          message: 'Tạo phiên bản báo giá mới thành công.',
        },
        { status: 201 }
      );
    }

    // 2. Phân nhánh tạo báo giá lần đầu
    const parseCreate = createQuoteSchema.safeParse(bodyJson);
    if (!parseCreate.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseCreate.error.issues?.[0]?.message || 'Dữ liệu báo giá không hợp lệ.',
          details: parseCreate.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return createInitialQuote(scopedDb, id, parseCreate.data, session.user.id);
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Tạo báo giá thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof VendorNotFoundError || err instanceof QuoteNotFoundError) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: err.message },
        { status: 404 }
      );
    }

    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi lưu báo giá.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
