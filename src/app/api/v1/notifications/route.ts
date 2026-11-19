import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';
import { authenticatedRoute } from '@/lib/api/route';
import { notifications } from '@/db/schema/system';
import { getUnifiedCalendarFeed } from '@/lib/tasks/calendar.repository';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const feed = await getUnifiedCalendarFeed(db, { role: session.role, allowedEventIds: session.allowedEventIds, endDate: new Date(Date.now() + 7 * 86400000) });
  const states = await db.select().from(notifications).where(eq(notifications.userId, session.user.id));
  return feed.filter(i => !['completed','cancelled','paid'].includes(i.status)).map(item => {
    const key = `${session.user.id}:${item.itemType}:${item.sourceId}:${item.dateString}`;
    const state = states.find(s => s.deduplicationKey === key);
    return { key, title: item.title, date: item.dateString, read: state?.isRead || false, snoozedUntil: state?.snoozedUntil || null, href: item.itemType === 'task' ? '/tasks' : item.itemType === 'payment_schedule' ? '/payments' : '/calendar' };
  }).filter(i => !i.snoozedUntil || new Date(i.snoozedUntil) < new Date());
}); }
export function POST(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const body = z.object({ key: z.string().max(500), read: z.boolean().default(true), snooze: z.boolean().default(false) }).parse(await req.json());
  if (!body.key.startsWith(`${session.user.id}:`)) throw new Error('Invalid notification');
  const values = { userId: session.user.id, deduplicationKey: body.key, isRead: body.read, snoozedUntil: body.snooze ? new Date(Date.now() + 86400000) : null };
  await db.insert(notifications).values(values).onConflictDoUpdate({ target: notifications.deduplicationKey, set: { isRead: values.isRead, snoozedUntil: values.snoozedUntil }, where: eq(notifications.userId, session.user.id) });
  return { success: true };
}, { memberWrite: true, unarchive: true }); }
