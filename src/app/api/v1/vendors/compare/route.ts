import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  comparePackages,
  InvalidComparisonCountError,
} from '@/lib/vendors/comparison.service';
import { QuoteNotFoundError } from '@/lib/vendors/quotes.repository';
import { comparePackagesRequestSchema } from '@/schemas/vendors';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/vendors/compare
 * So sánh đa chiều 2–4 gói dịch vụ hoặc địa điểm cưới trên cùng kịch bản giả định (PLAN §11.1, §11.2, AT24).
 * Yêu cầu quyền chủ sở hữu (AT03).
 * Xác thực dữ liệu với comparePackagesRequestSchema:
 *  - quote_ids: mảng 2 đến 4 UUID
 *  - table_count: số bàn giả định (nguyên dương)
 *  - guest_count: số khách giả định (tùy chọn)
 *  - include_vat_and_service_fee: boolean
 * Báo giá thiếu giá hiển thị "Chưa báo" với is_missing_price: true, không tính 0 VND giả (AT24).
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
        { error: 'FORBIDDEN', message: 'Chỉ chủ sở hữu mới có quyền so sánh các gói báo giá.' },
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

    const parseResult = comparePackagesRequestSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu yêu cầu so sánh không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const comparison = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return comparePackages(scopedDb, {
          quoteIds: parseResult.data.quote_ids,
          tableCount: parseResult.data.table_count,
          guestCount: parseResult.data.guest_count,
          includeVatAndServiceFee: parseResult.data.include_vat_and_service_fee,
        });
      }
    );

    return NextResponse.json({
      data: comparison,
      ...comparison,
    });
  } catch (err: unknown) {
    if (err instanceof InvalidComparisonCountError) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: err.message },
        { status: 400 }
      );
    }

    if (err instanceof QuoteNotFoundError) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: err.message },
        { status: 404 }
      );
    }

    const message = err instanceof Error ? err.message : 'Lỗi hệ thống khi so sánh các gói báo giá.';
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message },
      { status: 500 }
    );
  }
}
