import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listTimelineItems, createTimelineItem } from '@/lib/timeline';
import { createTimelineItemSchema } from '@/schemas/timeline';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '../g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/timeline?eventId=<uuid>
 * Danh sách các mốc lịch trình theo sự kiện.
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

    const items = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listTimelineItems(scopedDb, eventId, session.role);
      }
    );

    return NextResponse.json({
      data: items,
      total: items.length,
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}

/**
 * POST /api/v1/timeline
 * Tạo mốc lịch trình mới.
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

    const parseResult = createTimelineItemSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu lịch trình không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        await checkArchivalFreezeGuard(scopedDb);
        return createTimelineItem(scopedDb, parseResult.data);
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Tạo mốc lịch trình thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
