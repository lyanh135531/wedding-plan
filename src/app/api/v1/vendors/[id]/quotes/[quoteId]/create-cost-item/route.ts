import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  generateQuoteToCostPreview,
  convertQuoteToCostItem,
} from '@/lib/vendors/quote-to-cost.service';
import { QuoteNotFoundError } from '@/lib/vendors/quotes.repository';
import { VendorNotFoundError } from '@/lib/vendors/vendors.repository';
import { convertQuoteToCostRequestSchema } from '@/schemas/vendors';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã định danh không hợp lệ (phải là UUID).' });

type RouteContext = {
  params: { id: string; quoteId: string } | Promise<{ id: string; quoteId: string }>;
};

/**
 * GET /api/v1/vendors/[id]/quotes/[quoteId]/create-cost-item
 * Xem trước chuyển đổi báo giá thành khoản chi (Preview Modal - FL14, AT23).
 * Trả về:
 *  - suggested_cost_item_name
 *  - suggested_amount
 *  - is_already_converted (true nếu đã từng tạo khoản chi trước đó)
 *  - existing_cost_item (nếu có)
 *  - available_categories, available_events
 * Yêu cầu quyền chủ sở hữu (AT03).
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id: vendorId, quoteId } = await Promise.resolve(context.params);

    const parseVendorId = uuidParamSchema.safeParse(vendorId);
    const parseQuoteId = uuidParamSchema.safeParse(quoteId);

    if (!parseVendorId.success || !parseQuoteId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Mã nhà cung cấp hoặc mã báo giá không hợp lệ (phải là UUID).' },
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
        { error: 'FORBIDDEN', message: 'Chỉ chủ sở hữu mới có quyền truy cập thông tin chuyển đổi ngân sách.' },
        { status: 403 }
      );
    }

    const preview = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return generateQuoteToCostPreview(scopedDb, { quoteId });
      }
    );

    return NextResponse.json({
      data: preview,
    });
  } catch (err: unknown) {
    if (err instanceof QuoteNotFoundError || err instanceof VendorNotFoundError) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: err.message },
        { status: 404 }
      );
    }

    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi tải dữ liệu xem trước khoản chi.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v1/vendors/[id]/quotes/[quoteId]/create-cost-item
 * Thực hiện chuyển đổi báo giá thành khoản chi với 3-tier Idempotency Guard (AT23).
 * Nếu báo giá đã tạo khoản chi trước đó:
 *   Trả về { is_already_converted: true, action: 'already_existed', cost_item_id, cost_item_name }
 *   Tuyệt đối không nhân bản bản ghi làm sai lệch ngân sách.
 * STRICT AT23: Không tự động tạo bản ghi thanh toán (payments).
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id: vendorId, quoteId } = await Promise.resolve(context.params);

    const parseVendorId = uuidParamSchema.safeParse(vendorId);
    const parseQuoteId = uuidParamSchema.safeParse(quoteId);

    if (!parseVendorId.success || !parseQuoteId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Mã nhà cung cấp hoặc mã báo giá không hợp lệ (phải là UUID).' },
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
        { error: 'FORBIDDEN', message: 'Chỉ chủ sở hữu mới có quyền chuyển đổi báo giá thành khoản chi.' },
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

    const parseResult = convertQuoteToCostRequestSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu chuyển đổi khoản chi không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const idempotencyKey =
      req.headers.get('idempotency-key') ||
      req.headers.get('Idempotency-Key') ||
      undefined;

    const result = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return convertQuoteToCostItem(scopedDb, {
          quoteId,
          input: parseResult.data,
          userId: session.user.id,
          idempotencyKey,
        });
      }
    );

    const statusCode = result.action === 'already_existed' ? 200 : 201;

    return NextResponse.json(
      {
        data: result,
        ...result,
        message:
          result.action === 'already_existed'
            ? 'Khoản chi từ báo giá này đã được tạo trước đó.'
            : 'Đã tạo khoản chi thành công từ báo giá.',
      },
      { status: statusCode }
    );
  } catch (err: unknown) {
    if (err instanceof QuoteNotFoundError || err instanceof VendorNotFoundError) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: err.message },
        { status: 404 }
      );
    }

    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi chuyển đổi báo giá thành khoản chi.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
