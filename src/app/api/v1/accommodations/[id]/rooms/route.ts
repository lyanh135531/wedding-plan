import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getAccommodationById,
  assignRoom,
  listRoomAssignments,
  AccommodationNotFoundError,
} from '@/lib/logistics';
import { enforceOwnerRole, handleG8Error } from '../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã nơi lưu trú không hợp lệ.' });

const assignRoomBodySchema = z.object({
  eventId: z.string().uuid().optional(),
  roomNumber: z.string().trim().min(1, { message: 'Số phòng không được để trống' }).max(50),
  guestId: z.string().uuid({ message: 'Mã khách mời phải là UUID hợp lệ.' }),
  checkInDate: z.string().optional().nullable(),
  checkOutDate: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/accommodations/[id]/rooms
 * Danh sách phòng đã phân bổ tại nơi lưu trú.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nơi lưu trú không hợp lệ.' },
        { status: 400 }
      );
    }

    const session = await getCurrentSession(req);
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: 'Yêu cầu đăng nhập.' },
        { status: 401 }
      );
    }

    const rooms = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listRoomAssignments(scopedDb, id);
      }
    );

    return NextResponse.json({
      data: rooms,
      total: rooms.length,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * POST /api/v1/accommodations/[id]/rooms
 * Phân bổ phòng cho khách mời.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã nơi lưu trú không hợp lệ.' },
        { status: 400 }
      );
    }

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

    const parseResult = assignRoomBodySchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu gán phòng không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        let eventId = parseResult.data.eventId;
        if (!eventId) {
          const acc = await getAccommodationById(scopedDb, id);
          if (!acc) {
            throw new AccommodationNotFoundError();
          }
          eventId = acc.eventId;
        }

        return assignRoom(scopedDb, {
          accommodationId: id,
          eventId,
          roomNumber: parseResult.data.roomNumber,
          guestId: parseResult.data.guestId,
          checkInDate: parseResult.data.checkInDate,
          checkOutDate: parseResult.data.checkOutDate,
          notes: parseResult.data.notes,
        });
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Gán phòng cho khách thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
