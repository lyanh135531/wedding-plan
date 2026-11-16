import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listTablesByEvent, createTable } from '@/lib/seating';
import { createTableSchema } from '@/schemas/seating';
import { enforceOwnerRole, handleG8Error } from '../g8-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/tables?eventId=<uuid>
 * Danh sách bàn của buổi lễ.
 * Phân quyền (AT26): Vai trò 'family_view' tự động ẩn ghi chú nhạy cảm (notes = null).
 */
export async function GET(req: NextRequest) {
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập để truy cập danh sách bàn.' },
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

    const tables = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listTablesByEvent(scopedDb, eventId, session.role);
      }
    );

    return NextResponse.json({
      data: tables,
      total: tables.length,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * POST /api/v1/tables
 * Tạo bàn mới trong sự kiện.
 * Phân quyền: Chỉ chủ sở hữu (owner) có quyền tạo (AT03: 403 Forbidden đối với family_view).
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
        { error: 'BAD_REQUEST', message: 'Dữ liệu yêu cầu không hợp lệ (JSON invalid).' },
        { status: 400 }
      );
    }

    const parseResult = createTableSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu bàn không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return createTable(scopedDb, parseResult.data);
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Tạo bàn thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
