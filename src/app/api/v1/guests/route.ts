import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listGuests, createGuest } from '@/lib/guests';
import { createGuestSchema, guestSideEnum, rsvpStatusEnum } from '@/schemas/guests';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search') || undefined;
  const sideParam = searchParams.get('side');
  const side = sideParam && guestSideEnum.safeParse(sideParam).success ? (sideParam as any) : undefined;
  const groupId = searchParams.get('groupId') || undefined;
  const rsvpParam = searchParams.get('rsvpStatus');
  const rsvpStatus = rsvpParam && rsvpStatusEnum.safeParse(rsvpParam).success ? (rsvpParam as any) : undefined;
  const eventId = searchParams.get('eventId') || undefined;
  const isArchived = searchParams.get('isArchived') === 'true';
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return listGuests(txDb, {
          search,
          side,
          groupId,
          rsvpStatus,
          eventId,
          isArchived,
          limit,
          offset,
          role: session.role,
          allowedEventIds: session.allowedEventIds,
        });
      }
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error: any) {
    console.error('[GET /api/v1/guests error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'FORBIDDEN: Owner role required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = createGuestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const created = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return createGuest(txDb, parsed.data, session.user.id);
      }
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/guests error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
