import { NextRequest, NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { Workbook } from 'exceljs';
import { getCurrentSession } from '@/lib/auth/session';
import { withTransactionScopedContext } from '@/db/client';
import { sanitizeForSpreadsheet } from '@/lib/export/formula-sanitizer';
const datasets: Record<string, string[]> = {
  guests: ['guests','invitations','invitation_members','attendance'],
  finance: ['budget_categories','category_budgets','cost_items','payment_schedules','payments','payment_allocations','fund_settings','funding_entries','gifts','gift_contributors','gift_returns'],
  operations: ['events','tables','seat_assignments','menus','menu_items','catering_snapshots','accommodations','room_assignments','transport_trips','trip_passengers','timeline_items','support_assignments','preparation_items'],
  all: ['wedding_settings','events','guests','invitations','invitation_members','attendance','tasks','task_checklist_items','task_dependencies','appointments','budget_categories','category_budgets','cost_items','payment_schedules','payments','payment_allocations','fund_settings','funding_entries','gifts','gift_contributors','gift_returns','vendors','vendor_quotes','tables','seat_assignments','menus','menu_items','guest_meal_selections','catering_snapshots','accommodations','room_assignments','transport_trips','trip_passengers','timeline_items','support_assignments','preparation_items','handover_packets','post_wedding_tasks','media_links','attachments'],
};
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
  const session = await getCurrentSession(req);
  if (!session) return NextResponse.json({ message:'Yêu cầu đăng nhập.' },{status:401});
  if (session.role !== 'owner') return NextResponse.json({ message:'Chỉ chủ sở hữu được xuất dữ liệu đầy đủ. Người nhà dùng bản in vận hành trong từng menu được chia sẻ.' },{status:403});
  const dataset = req.nextUrl.searchParams.get('dataset') || 'guests';
  if (!datasets[dataset]) return NextResponse.json({message:'Bộ dữ liệu không hợp lệ.'},{status:400});
  try {
    const tables = await withTransactionScopedContext(session.user.id,session.role,async(_client,db)=>{
      const rows: Record<string,Record<string,unknown>[]> = {};
      for(const name of datasets[dataset]) rows[name] = (await db.execute(sql.raw(`SELECT * FROM "${name}"`))).rows as Record<string,unknown>[];
      return rows;
    }, undefined, 'repeatable read');
    if(req.nextUrl.searchParams.get('format')==='json')return new NextResponse(JSON.stringify({exportedAt:new Date().toISOString(),tables},(_,v)=>typeof v==='bigint'?v.toString():v),{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="wedding-data.json"','Cache-Control':'no-store'}});
    const workbook=new Workbook(); workbook.creator='Sổ quản lý đám cưới';
    const info=workbook.addWorksheet('Thông tin');info.addRows([['Ngày xuất',new Date().toISOString()],['Nội dung','Dữ liệu thuộc phạm vi chủ sở hữu. Tiền VND được lưu dưới dạng văn bản để giữ chính xác.'],['Tệp đính kèm','Chỉ gồm metadata. Sao lưu tệp gốc bằng quy trình backup DB và uploads.']]);
    for(const[name,rows]of Object.entries(tables)){
      const sheet=workbook.addWorksheet(name.slice(0,31));if(!rows.length){sheet.addRow(['Chưa có dữ liệu']);continue;}
      const keys=Object.keys(rows[0]);sheet.columns=keys.map(key=>({header:key,key,width:24}));
      for(const row of rows)sheet.addRow(Object.fromEntries(keys.map(key=>{const value=row[key];return[key,value===null||value===undefined?'':typeof value==='string'?sanitizeForSpreadsheet(value):value instanceof Date?value.toISOString():typeof value==='object'?JSON.stringify(value):value];})));
      sheet.getRow(1).font={bold:true};sheet.views=[{state:'frozen',ySplit:1}];sheet.autoFilter={from:{row:1,column:1},to:{row:1,column:keys.length}};
    }
    const buffer=await workbook.xlsx.writeBuffer();return new NextResponse(new Uint8Array(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="wedding-${dataset}.xlsx"`,'Cache-Control':'no-store'}});
  }catch(error){console.error('[Export workbook]',(error as Error).name);return NextResponse.json({message:'Không thể xuất dữ liệu. Vui lòng thử lại.'},{status:500});}
}
