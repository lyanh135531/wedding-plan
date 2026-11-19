import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import {
  getTransportTripById,
  assignPassenger,
  listTripPassengers,
  TripNotFoundError,
} from '@/lib/logistics';
import { enforceOwnerRole, handleG8Error } from '../../../g8-utils';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const uuidParamSchema = z.string().uuid({ message: 'Mã chuyến xe không hợp lệ.' });

const assignPassengerBodySchema = z.object({
  guestId: z.string().uuid({ message: 'Mã khách mời phải là UUID hợp lệ.' }),
  pickupPoint: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  eventId: z.string().uuid().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/v1/transport/[id]/passengers
 * Danh sách hành khách của chuyến xe.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã chuyến xe không hợp lệ.' },
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

    const passengers = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listTripPassengers(scopedDb, id);
      }
    );

    return NextResponse.json({
      data: passengers,
      total: passengers.length,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * POST /api/v1/transport/[id]/passengers
 * Phân bổ hành khách lên chuyến xe.
 * - Kiểm tra sức chứa xe (AT21): Nếu xe đã đủ chỗ -> HTTP 409 Conflict (CAPACITY_EXCEEDED).
 * - Phân quyền: family_view -> HTTP 403 Forbidden.
 */
export async function POST(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parseId = uuidParamSchema.safeParse(id);
    if (!parseId.success) {
      return NextResponse.json(
        { error: 'BAD_REQUEST', message: parseId.error.issues?.[0]?.message || 'Mã chuyến xe không hợp lệ.' },
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

    const parseResult = assignPassengerBodySchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu hành khách không hợp lệ.',
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
          const trip = await getTransportTripById(scopedDb, id);
          if (!trip) {
            throw new TripNotFoundError();
          }
          eventId = trip.eventId;
        }

        return assignPassenger(
          scopedDb,
          eventId,
          id,
          parseResult.data.guestId,
          parseResult.data.pickupPoint ?? undefined,
          parseResult.data.notes ?? undefined
        );
      }
    );

    return NextResponse.json(
      {
        data: assignment,
        message: 'Gán hành khách lên chuyến xe thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
