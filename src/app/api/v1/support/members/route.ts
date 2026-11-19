import { runIdempotentCreate } from '@/lib/api/mutation';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listSupportAssignments, createSupportAssignment } from '@/lib/support';
import { createSupportAssignmentSchema } from '@/schemas/support';
import { enforceOwnerRole, handleG9Error } from '../../g9-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/support/members?eventId=<uuid>
 * Danh sách thành viên đội hỗ trợ (S24). Phân quyền: family_view chỉ thấy thành viên isShared=true và bị ẩn ghi chú nhạy cảm (attireNotes=null).
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

    const members = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listSupportAssignments(scopedDb, eventId, session.role);
      }
    );

    return NextResponse.json({
      data: members,
      total: members.length,
    });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}

/**
 * POST /api/v1/support/members
 * Thêm thành viên vào đội hỗ trợ (S24). Phân quyền: Chỉ chủ sở hữu (owner).
 * Invariant (PLAN §14.2): Vai trò hỗ trợ không tự cấp tài khoản hoặc quyền chỉnh sửa hệ thống.
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

    const parseResult = createSupportAssignmentSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu thành viên hỗ trợ không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return runIdempotentCreate(req, scopedDb, session!.user.id, bodyJson, async () => createSupportAssignment(scopedDb, parseResult.data));
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Thêm thành viên đội hỗ trợ thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}
