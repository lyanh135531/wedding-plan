import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { getUnifiedCalendarFeed } from '@/lib/tasks/calendar.repository';
import { generateIcsCalendar, IcsEventInput } from '@/lib/calendar/ics';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  try {
    const feed = await withTransactionScopedContext(
      session.user.id,
      session.role,
      async (_client, txDb) => {
        return getUnifiedCalendarFeed(txDb, {
          role: session.role,
          allowedEventIds: session.allowedEventIds,
        });
      }
    );

    const icsEvents: IcsEventInput[] = feed.map((item) => ({
      uid: item.id,
      title: item.title,
      startDate: item.dateTime,
      location: item.location || null,
      allDay: item.itemType === 'event_ceremony' || item.itemType === 'task',
    }));

    const icsContent = generateIcsCalendar(icsEvents);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'attachment; filename="wedding-calendar.ics"',
      },
    });
  } catch (error: any) {
    console.error('[GET /api/v1/export/calendar.ics error]:', error);
    return NextResponse.json({ error: error?.message || 'INTERNAL_ERROR' }, { status: 500 });
  }
}
