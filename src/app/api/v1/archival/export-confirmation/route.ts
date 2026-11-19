import { NextRequest } from 'next/server';
import { authenticatedRoute } from '@/lib/api/route';
import { markTaskExportCompleted } from '@/lib/archival/archival.service';
export function POST(req:NextRequest){return authenticatedRoute(req,async(db,session)=>{await markTaskExportCompleted(db,session.user.id);return{success:true};});}
