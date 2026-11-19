import { NextRequest } from 'next/server';
import { desc,eq } from 'drizzle-orm';
import { authenticatedRoute } from '@/lib/api/route';
import { cateringSnapshots } from '@/db/schema/catering';
import { uuidSchema } from '@/schemas/common';
export const dynamic='force-dynamic';
export function GET(req:NextRequest){return authenticatedRoute(req,db=>db.select().from(cateringSnapshots).where(eq(cateringSnapshots.eventId,uuidSchema.parse(req.nextUrl.searchParams.get('eventId')))).orderBy(desc(cateringSnapshots.snapshotVersion)));}
