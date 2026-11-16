import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getTableById,
  getTableAssignments,
  assignGuestToTable,
  TableNotFoundError,
} from '@/lib/seating';
import { enforceOwnerRole, handleG8Error } from '../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã bàn không hợp lệ.' });

const assignSeatBodySchema = z.object({
  guestId: z.string().uuid({ message: 'Mã khách mời phải là UUID hợp lệ.' }),
  seatNumber: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  version: z.number().int().optional(),
  eventId: z.string().uuid().optional(),
});

type RouteContext = {
  params: { id: string } | Promise<{ id: string }>;
};

/**
 * GET /api/v1/tables/[id]/seats
 * Lấy danh sách chỗ ngồi của bàn.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã bàn không hợp lệ.' },
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

    const assignments = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        const rows = await getTableAssignments(scopedDb, id);
        if (session.role === 'family_view') {
          return rows.map((r) => ({ ...r, notes: null }));
        }
        return rows;
      }
    );

    return NextResponse.json({
      data: assignments,
      total: assignments.length,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * POST /api/v1/tables/[id]/seats
 * Phân bổ khách mời vào bàn.
 * - Kiểm tra sức chứa (AT21): Nếu bàn đầy và khách cần ghế -> HTTP 409 Conflict (CAPACITY_EXCEEDED).
 * - Trẻ em không cần ghế (AT07): Vẫn được xếp vào bàn kể cả khi bàn đầy.
 * - Khóa lạc quan (AT30): Nếu version cung cấp khác version bàn -> HTTP 409 Conflict (OPTIMISTIC_LOCK_CONFLICT).
 * - Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await Promise.resolve(context.params);
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã bàn không hợp lệ.' },
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

    const parseResult = assignSeatBodySchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu phân bổ chỗ ngồi không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const assignment = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        let eventId = parseResult.data.eventId;
        if (!eventId) {
          const table = await getTableById(scopedDb, id);
          if (!table) {
            throw new TableNotFoundError();
          }
          eventId = table.eventId;
        }

        return assignGuestToTable(scopedDb, eventId, id, parseResult.data.guestId, {
          seatNumber: parseResult.data.seatNumber ?? undefined,
          notes: parseResult.data.notes ?? undefined,
          version: parseResult.data.version,
        });
      }
    );

    return NextResponse.json(
      {
        data: assignment,
        message: 'Xếp chỗ cho khách mời thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
