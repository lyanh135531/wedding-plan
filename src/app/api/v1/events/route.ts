import { NextRequest } from 'next/server';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { events } from '@/db/schema/events';
import { eventInputSchema } from '@/schemas/events';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return authenticatedRoute(req, async (db, session) => {
  const rows = await db.select().from(events);
  return session.role === 'owner' ? rows : rows.map(({ privateNotes, contactPhone, ...row }) => row);
}); }
export function POST(req: NextRequest) { return authenticatedRoute(req, async db => {
  const body = eventInputSchema.parse(await req.json());
  if (body.startTime && body.endTime && body.endTime < body.startTime) throw new RouteError(400, 'Giờ kết thúc phải sau giờ bắt đầu.');
  const [row] = await db.insert(events).values({ ...body, startTime: body.startTime ? new Date(body.startTime) : null, endTime: body.endTime ? new Date(body.endTime) : null }).returning(); return row;
}); }
