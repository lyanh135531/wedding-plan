import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and,eq } from 'drizzle-orm';
import { authenticatedRoute,RouteError } from '@/lib/api/route';
import { attachments } from '@/db/schema/files';
import { auditLogs } from '@/db/schema/system';
export function PATCH(req:NextRequest,props:{params:Promise<{id:string}>}){return authenticatedRoute(req,async(db,session)=>{
  const id=z.string().uuid().parse((await props.params).id);const body=z.object({originalName:z.string().trim().min(1).max(255),isArchived:z.boolean(),expectedUpdatedAt:z.string().datetime({offset:true})}).parse(await req.json());
  const[current]=await db.select().from(attachments).where(eq(attachments.id,id)).for('update');
  if(!current)throw new RouteError(404,'Không tìm thấy tài liệu.');if(current.updatedAt.toISOString()!==body.expectedUpdatedAt)throw new RouteError(409,'Tài liệu đã thay đổi. Hãy tải lại.');
  await db.update(attachments).set({originalName:body.originalName,isArchived:body.isArchived,archivedAt:body.isArchived?new Date():null,updatedAt:new Date()}).where(eq(attachments.id,id));
  await db.insert(auditLogs).values({userId:session.user.id,action:body.isArchived?'ARCHIVE_DOCUMENT':'UPDATE_DOCUMENT',entityType:'attachments',entityId:id,afterState:{originalName:body.originalName,isArchived:body.isArchived}});return{id};
});}
