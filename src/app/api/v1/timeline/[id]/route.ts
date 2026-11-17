import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getTimelineItemById, updateTimelineItem, deleteTimelineItem, mapToTimelineItemDto, mapToTimelineItemFamilyDto } from '@/lib/timeline';
import { updateTimelineItemSchema } from '@/schemas/timeline';
import { enforceOwnerRole, checkArchivalFreezeGuard, handleG10Error } from '../../g10-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/timeline/[id]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const item = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        const raw = await getTimelineItemById(scopedDb, id);
        if (!raw) return null;
        if (session.role === 'family_view') {
          return raw.isShared ? mapToTimelineItemFamilyDto(raw) : null;
        }
        return mapToTimelineItemDto(raw);
      }
    );

    if (!item) {
      return NextResponse.json(
        { error: 'TIMELINE_ITEM_NOT_FOUND', message: 'Không tìm thấy mục lịch trình.' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: item });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}

/**
 * PATCH /api/v1/timeline/[id]
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    const { id } = await params;
    let bodyJson: unknown;
    try {
      bodyJson = await req.json();
    } catch {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: 'Dữ liệu JSON không hợp lệ.' },
        { status: 400 }
      );
    }

    const parseResult = updateTimelineItemSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu cập nhật không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updated = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        await checkArchivalFreezeGuard(scopedDb);
        return updateTimelineItem(scopedDb, id, parseResult.data);
      }
    );

    return NextResponse.json({
      data: updated,
      message: 'Cập nhật mục lịch trình thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}

/**
 * DELETE /api/v1/timeline/[id]
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getCurrentSession(req);
    const authError = enforceOwnerRole(session);
    if (authError) return authError;

    const { id } = await params;
    const { searchParams } = req.nextUrl;
    const versionParam = searchParams.get('version');
    const version = versionParam ? parseInt(versionParam, 10) : undefined;

    await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        await checkArchivalFreezeGuard(scopedDb);
        await deleteTimelineItem(scopedDb, id, version);
      }
    );

    return NextResponse.json({
      message: 'Xóa mục lịch trình thành công.',
    });
  } catch (err: unknown) {
    return handleG10Error(err);
  }
}
