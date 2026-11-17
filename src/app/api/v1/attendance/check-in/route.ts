import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { checkInGuest, searchGuests, getSummary } from '@/lib/attendance';
import { checkInGuestSchema } from '@/schemas/attendance';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/attendance/check-in?eventId=<uuid>&q=<search>
 * Tìm kiếm nhanh khách mời để điểm danh bằng tên không dấu hoặc số điện thoại.
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

    const query = searchParams.get('q') || '';

    const results = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return searchGuests(scopedDb, eventId, query);
      }
    );

    return NextResponse.json({
      data: results,
      total: results.length,
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}

/**
 * POST /api/v1/attendance/check-in
 * Điểm danh khách mời (Check-in).
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

    const parseResult = checkInGuestSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu điểm danh không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const result = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        await checkArchivalFreezeGuard(scopedDb);
        return checkInGuest(scopedDb, parseResult.data, session!.user.id);
      }
    );

    return NextResponse.json({
      data: result,
      message: 'Điểm danh khách mời thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
