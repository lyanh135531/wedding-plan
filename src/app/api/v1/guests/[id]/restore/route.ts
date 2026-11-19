import { NextRequest } from 'next/server';
import { and,eq,sql } from 'drizzle-orm';
import { authenticatedRoute,RouteError } from '@/lib/api/route';
import { guests } from '@/db/schema/guests';
import { auditLogs } from '@/db/schema/system';
import { uuidSchema,versionSchema } from '@/schemas/common';
export function POST(req:NextRequest,props:{params:Promise<{id:string}>}) {return authenticatedRoute(req,async(db,session)=>{
  const id=uuidSchema.parse((await props.params).id);const version=versionSchema.parse((await req.json()).version);
  const [row]=await db.update(guests).set({isArchived:false,archivedAt:null,version:sql`${guests.version}+1`,updatedAt:new Date()}).where(and(eq(guests.id,id),eq(guests.version,version))).returning();
  if(!row)throw new RouteError(409,'Hồ sơ đã thay đổi. Hãy tải lại.');await db.insert(auditLogs).values({userId:session.user.id,action:'RESTORE_GUEST',entityType:'guests',entityId:id});return{id};
});}
