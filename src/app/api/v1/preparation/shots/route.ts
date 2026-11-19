import { runIdempotentCreate } from '@/lib/api/mutation';
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listPhotoShots, createPhotoShot } from '@/lib/preparation';
import { createPhotoShotSchema } from '@/schemas/preparation';
import { enforceOwnerRole, handleG9Error } from '../../g9-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/preparation/shots?eventId=<uuid>
 * Danh sách cảnh chụp trong shot list (S23 Tab 3).
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

    const shots = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listPhotoShots(scopedDb, eventId, session.role);
      }
    );

    return NextResponse.json({
      data: shots,
      total: shots.length,
    });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}

/**
 * POST /api/v1/preparation/shots
 * Thêm cảnh chụp mới vào danh sách chụp ảnh. Phân quyền: Chỉ chủ sở hữu (owner).
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

    const parseResult = createPhotoShotSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cảnh chụp không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return runIdempotentCreate(req, scopedDb, session!.user.id, bodyJson, async () => createPhotoShot(scopedDb, parseResult.data));
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Thêm cảnh chụp thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}
