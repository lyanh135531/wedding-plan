import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getSupportAssignmentDetails,
  updateSupportAssignment,
  deleteSupportAssignment,
} from '@/lib/support';
import { updateSupportAssignmentSchema } from '@/schemas/support';
import { enforceOwnerRole, handleG9Error } from '../../../g9-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const member = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return getSupportAssignmentDetails(scopedDb, params.id, session.role);
      }
    );

    return NextResponse.json({ data: member });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}

export async function PATCH(req: NextRequest, props: RouteContext) {
  const params = await props.params;
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

    const parseResult = updateSupportAssignmentSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật thành viên hỗ trợ không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return updateSupportAssignment(scopedDb, params.id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật thành viên đội hỗ trợ thành công.',
    });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}

export async function DELETE(req: NextRequest, props: RouteContext) {
  const params = await props.params;
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    const { searchParams } = req.nextUrl;
    const versionParam = searchParams.get('version');
    const version = versionParam ? parseInt(versionParam, 10) : undefined;

    const result = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return deleteSupportAssignment(scopedDb, params.id, version);
      }
    );

    return NextResponse.json({
      data: result,
      message: 'Xóa thành viên khỏi đội hỗ trợ thành công.',
    });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}
