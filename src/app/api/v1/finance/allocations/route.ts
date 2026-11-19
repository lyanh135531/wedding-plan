import { NextRequest } from 'next/server';
import { eq,and,isNull } from 'drizzle-orm';
import { authenticatedRoute } from '@/lib/api/route';
import { paymentAllocations,payments } from '@/db/schema/finance';
import { uuidSchema } from '@/schemas/common';
export const dynamic='force-dynamic';
export function GET(req:NextRequest){return authenticatedRoute(req,async db=>{
  const id=uuidSchema.parse(req.nextUrl.searchParams.get('costItemId'));
  const rows=await db.select({id:paymentAllocations.id,amount:paymentAllocations.allocatedAmount,paymentId:payments.id,transactionTime:payments.transactionTime}).from(paymentAllocations).innerJoin(payments,eq(paymentAllocations.paymentId,payments.id)).where(and(eq(payments.costItemId,id),eq(payments.isVoided,false),isNull(paymentAllocations.scheduleId)));
  return JSON.parse(JSON.stringify(rows,(_,v)=>typeof v==='bigint'?v.toString():v));
},{owner:true});}
