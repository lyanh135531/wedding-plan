import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { freezeWeddingArchive } from '@/lib/archival';
import { archiveWeddingSchema } from '@/schemas/archival';
import { enforceOwnerRole, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/archival/freeze
 * Khóa chuyển sang trạng thái lưu trữ (chỉ đọc) (AT35, FL20).
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

    const parseResult = archiveWeddingSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu khóa lưu trữ không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return freezeWeddingArchive(scopedDb, parseResult.data, session!.user.id);
      }
    );

    return NextResponse.json({
      message: 'Đã chuyển đám cưới sang trạng thái lưu trữ (chỉ đọc) thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
