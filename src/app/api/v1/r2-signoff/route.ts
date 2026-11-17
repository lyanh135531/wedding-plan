import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { evaluateR2Readiness } from '@/lib/r2-signoff';
import { enforceOwnerRole, handleG9Error } from '../g9-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/r2-signoff?eventId=<uuid>
 * Đánh giá tiến độ 8 cổng nghiệm thu Milestone R2 (PLAN §24.1, UI_UX_SPEC §7.11).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const { searchParams } = req.nextUrl;
    const eventId = searchParams.get('eventId');
    if (!eventId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Thiếu tham số bắt buộc: eventId.' },
        { status: 400 }
      );
    }

    const report = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return evaluateR2Readiness(scopedDb, eventId, session.user.id);
      }
    );

    return NextResponse.json({ data: report });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}

/**
 * POST /api/v1/r2-signoff
 * Ký xác nhận nghiệm thu cột mốc R2 và tạo bản chụp bất biến (Immutable Snapshot).
 * Phân quyền: Chỉ chủ sở hữu (owner).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    let bodyJson: any;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    const eventId = bodyJson?.eventId;
    if (!eventId) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Thiếu trường bắt buộc: eventId.' },
        { status: 400 }
      );
    }

    const report = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return evaluateR2Readiness(scopedDb, eventId, session!.user.id);
      }
    );

    return NextResponse.json({
      data: report,
      message: 'Nghiệm thu cột mốc R2 thành công và đã xuất bản chụp bất biến.',
    });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}
