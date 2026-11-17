import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { assembleLiveEventData, createHandoverSnapshot } from '@/lib/handovers';
import { createHandoverPacketSchema } from '@/schemas/handovers';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '@/app/api/v1/g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/handovers/packet?eventId=<uuid>
 * Dữ liệu bộ tài liệu bàn giao ngày cưới (PLAN §14.4, UXT22).
 * Invariant (AT26): Đối với family_view, toàn bộ dữ liệu tài chính bị loại bỏ.
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

    const liveData = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return assembleLiveEventData(scopedDb, eventId, {
          includeTimeline: true,
          includeSeating: true,
          includeCatering: true,
          includeSupport: true,
          includeChecklist: true,
        });
      }
    );

    return NextResponse.json({ data: liveData });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}

/**
 * POST /api/v1/handovers/packet
 * Tạo bản chốt (snapshot) bàn giao mới cho sự kiện.
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

    const parseResult = createHandoverPacketSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu bản chốt bàn giao không hợp lệ.',
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
        return createHandoverSnapshot(scopedDb, parseResult.data, session!.user.id);
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Tạo bản chốt bàn giao thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
