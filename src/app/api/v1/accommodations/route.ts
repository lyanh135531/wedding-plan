import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listAccommodationsByEvent, createAccommodation } from '@/lib/logistics';
import { createAccommodationSchema } from '@/schemas/logistics';
import { enforceOwnerRole, handleG8Error } from '../g8-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/v1/accommodations?eventId=<uuid>
 * Danh sách nơi lưu trú của buổi lễ.
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

    const accommodations = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, scopedDb) => {
        return listAccommodationsByEvent(scopedDb, eventId);
      }
    );

    // If family_view, contact phone or private notes can be sanitized
    const data =
      session.role === 'family_view'
        ? accommodations.map((a) => ({ ...a, contactPhone: null, notes: null }))
        : accommodations;

    return NextResponse.json({
      data,
      total: data.length,
    });
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}

/**
 * POST /api/v1/accommodations
 * Tạo nơi lưu trú mới.
 * Phân quyền: family_view -> HTTP 403 Forbidden.
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

    const parseResult = createAccommodationSchema.safeParse(bodyJson);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'VALIDATION_ERROR',
          message: parseResult.error.issues?.[0]?.message || 'Dữ liệu nơi lưu trú không hợp lệ.',
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session!.user.id,
      session!.role,
      async (_client, scopedDb) => {
        return createAccommodation(scopedDb, parseResult.data);
      }
    );

    return NextResponse.json(
      {
        data: created,
        message: 'Tạo nơi lưu trú thành công.',
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    return handleG8Error(err);
  }
}
