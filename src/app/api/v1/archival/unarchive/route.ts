import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { unfreezeWeddingArchive } from '@/lib/archival';
import { unarchiveWeddingSchema } from '@/schemas/archival';
import { enforceOwnerRole, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/archival/unarchive
 * Mở lại đám cưới đã lưu trữ để tiếp tục chỉnh sửa (AT35, FL20).
 * Bắt buộc lý do mở lại và ghi nhận vào nhật ký kiểm toán (audit log).
 * Phân quyền: Chỉ chủ sở hữu (owner).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    const parseResult = unarchiveWeddingSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu mở lại đám cưới không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return unfreezeWeddingArchive(scopedDb, parseResult.data, session!.user.id);
      }
    );

    return NextResponse.json({
      message: 'Mở lại đám cưới thành công. Thao tác đã được ghi nhận vào nhật ký kiểm toán.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
