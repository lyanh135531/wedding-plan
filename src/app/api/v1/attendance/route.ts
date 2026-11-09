import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { listAttendance, updateAttendance } from '@/lib/guests';
import { updateAttendanceSchema, rsvpStatusEnum } from '@/schemas/guests';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const eventId = searchParams.get('eventId') || undefined;
  const guestId = searchParams.get('guestId') || undefined;
  const rsvpParam = searchParams.get('rsvpStatus');
  const rsvpStatus = rsvpParam && rsvpStatusEnum.safeParse(rsvpParam).success ? (rsvpParam as any) : undefined;

  try {
    const data = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return listAttendance(txDb, {
          eventId,
          guestId,
          rsvpStatus,
          role: session.role,
          allowedEventIds: session.allowedEventIds,
        });
      }
    );

    return NextResponse.json({ data, total: data.length });
  } catch (error: any) {
    console.error('[GET /api/v1/attendance error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}

const patchAttendanceBodySchema = updateAttendanceSchema.extend({
  guest_id: z.string().uuid('ID khách không hợp lệ'),
  event_id: z.string().uuid('ID buổi cưới không hợp lệ'),
});

export async function PATCH(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'FORBIDDEN: Owner role required' }, { status: 403 });
  }

  try {
    const body = await req.json();
    const parsed = patchAttendanceBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { guest_id, event_id, ...updatePayload } = parsed.data;

    const updated = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return updateAttendance(txDb, guest_id, event_id, updatePayload, session.user.id);
      }
    );

    return NextResponse.json({ data: updated });
  } catch (error: any) {
    console.error('[PATCH /api/v1/attendance error]:', error);
    const status = error?.message?.includes('bị thay đổi bởi người khác') ? 409 : 500;
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status });
  }
}
