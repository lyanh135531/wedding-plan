import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { authenticatedRoute, RouteError } from '@/lib/api/route';
import { guestMealSelections } from '@/db/schema/catering';
import { guests } from '@/db/schema/guests';
import { setGuestMealSelectionSchema } from '@/schemas/catering';
import { setGuestMealSelection } from '@/lib/catering';
import { uuidSchema } from '@/schemas/common';
export const dynamic = 'force-dynamic';
export function GET(req: NextRequest) { return authenticatedRoute(req, async db => {
  const eventId = uuidSchema.parse(req.nextUrl.searchParams.get('eventId'));
  return db.select().from(guestMealSelections).where(eq(guestMealSelections.eventId, eventId));
}); }
export function POST(req: NextRequest) { return authenticatedRoute(req, async db => {
  const body = setGuestMealSelectionSchema.parse(await req.json());
  const [guest] = await db.select().from(guests).where(eq(guests.id, body.guestId)).for('update');
  if (!guest || guest.isArchived) throw new RouteError(404, 'Không tìm thấy khách.');
  return setGuestMealSelection(db, body.eventId, body.guestId, body.mealTier, body.dietaryNotes, body.allergyNotes);
}); }
