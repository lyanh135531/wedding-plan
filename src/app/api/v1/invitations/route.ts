import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listInvitations, createInvitation } from '@/lib/guests';
import { createInvitationSchema } from '@/schemas/guests';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId');
  if (!eventId) {
    return NextResponse.json(
      { error: 'BAD_REQUEST', message: 'Tham số eventId là bắt buộc' },
      { status: 400 }
    );
  }

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return listInvitations(txDb, eventId, session.role, session.allowedEventIds);
      }
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error: any) {
    console.error('[GET /api/v1/invitations error]:', error);
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
    const parsed = createInvitationSchema.safeParse(body);
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
        return createInvitation(txDb, parsed.data, session.user.id);
      }
    );

    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: any) {
    console.error('[POST /api/v1/invitations error]:', error);
    const status = error?.message?.includes('đã thuộc thiệp') ? 409 : 500;
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status });
  }
}
