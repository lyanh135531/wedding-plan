import { NextRequest } from 'next/server';
import { and,eq,sql } from 'drizzle-orm';
import { authenticatedRoute,RouteError } from '@/lib/api/route';
import { appointments } from '@/db/schema/tasks';
import { appointmentSchema } from '@/schemas/appointments';
import { uuidSchema,versionSchema } from '@/schemas/common';
export function PATCH(req:NextRequest,props:{params:Promise<{id:string}>}){return authenticatedRoute(req,async db=>{const id=uuidSchema.parse((await props.params).id);const input=await req.json();const body=appointmentSchema.parse(input);const version=versionSchema.parse(input.version);const[row]=await db.update(appointments).set({...body,startTime:new Date(body.startTime),endTime:new Date(body.endTime),version:sql`${appointments.version}+1`,updatedAt:new Date()}).where(and(eq(appointments.id,id),eq(appointments.version,version))).returning();if(!row)throw new RouteError(409,'Lịch hẹn đã thay đổi. Hãy tải lại.');return row;});}
export function DELETE(req:NextRequest,props:{params:Promise<{id:string}>}){return authenticatedRoute(req,async db=>{const id=uuidSchema.parse((await props.params).id);const version=versionSchema.parse(Number(req.nextUrl.searchParams.get('version')));const[row]=await db.delete(appointments).where(and(eq(appointments.id,id),eq(appointments.version,version))).returning();if(!row)throw new RouteError(409,'Lịch hẹn đã thay đổi. Hãy tải lại.');return{id};});}
