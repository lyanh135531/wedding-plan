import { NextRequest } from 'next/server';
import { desc } from 'drizzle-orm';
import { authenticatedRoute } from '@/lib/api/route';
import { appointments } from '@/db/schema/tasks';
import { appointmentSchema } from '@/schemas/appointments';
export const dynamic='force-dynamic';
export function GET(req:NextRequest){return authenticatedRoute(req,db=>db.select().from(appointments).orderBy(desc(appointments.startTime)),{owner:true});}
export function POST(req:NextRequest){return authenticatedRoute(req,async db=>{const body=appointmentSchema.parse(await req.json());const[row]=await db.insert(appointments).values({...body,startTime:new Date(body.startTime),endTime:new Date(body.endTime)}).returning();return row;});}
