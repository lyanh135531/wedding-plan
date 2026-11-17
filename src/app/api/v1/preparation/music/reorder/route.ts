import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { reorderPlaylist } from '@/lib/preparation';
import { reorderPlaylistSchema } from '@/schemas/preparation';
import { enforceOwnerRole, handleG9Error } from '../../../g9-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/v1/preparation/music/reorder
 * Sắp xếp lại thứ tự các bài hát trong danh sách nhạc (S23 Tab 2).
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

    const parseResult = reorderPlaylistSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu sắp xếp danh sách nhạc không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const updatedTracks = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return reorderPlaylist(scopedDb, parseResult.data.eventId, parseResult.data.trackIds);
      }
    );

    return NextResponse.json({
      data: updatedTracks,
      message: 'Sắp xếp thứ tự danh sách nhạc thành công.',
    });
  } catch (err: unknown) {
    return handleG9Error(err);
  }
}
