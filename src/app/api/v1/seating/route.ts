import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { seatAssignments } from '@/db/schema/seating';
import { listTablesByEvent } from '@/lib/seating';
import { listGuests, listAttendance } from '@/lib/guests';
import { handleG8Error } from '../g8-utils';

export const dynamic = 'force-dynamic';

/** Load one consistent event view; family never receives private guest/table fields. */
export async function GET(request: NextRequest) {
  const session = await getCurrentSession(request);
  if (!session) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  const event = z.string().uuid().safeParse(request.nextUrl.searchParams.get('eventId'));
  if (!event.success) return NextResponse.json({ error: 'INVALID_EVENT' }, { status: 400 });
  if (session.role === 'family_view' && !session.allowedEventIds.includes(event.data)) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
  }
  try {
    const data = await withTransactionScopedContext(session.user.id, session.role, async (client, db) => {
      const tables = await listTablesByEvent(db, event.data, session.role);
      const attendance = await listAttendance(db, { eventId: event.data, role: session.role, allowedEventIds: session.allowedEventIds });
      const guests = await listGuests(db, { eventId: event.data, role: session.role, allowedEventIds: session.allowedEventIds, limit: 2_147_483_647 });
      const seats = await db.select({ guestId: seatAssignments.guestId, tableId: seatAssignments.tableId })
        .from(seatAssignments).where(eq(seatAssignments.eventId, event.data));
      return { tables, attendance, guests, seats };
    }, undefined, 'repeatable read');
    return NextResponse.json({ data });
  } catch (error) { return handleG8Error(error); }
}
