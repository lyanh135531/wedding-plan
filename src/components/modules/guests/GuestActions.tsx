'use client';
import React, { useState } from 'react';
import { api, jsonBody } from '@/lib/api/request';
import { RecordEditor, RecordData, Field } from '@/components/common/ResourceWorkspace';
import { Button } from '@/components/ui/button';
import { GuestOwnerDto } from '@/schemas/guests';
const fields: Field[] = [{key:'display_name',label:'Họ và tên',required:true},{key:'side',label:'Bên mời',type:'select',required:true,options:[{value:'groom',label:'Nhà trai'},{value:'bride',label:'Nhà gái'},{value:'mutual',label:'Chung'},{value:'unassigned',label:'Chưa phân loại'}]},{key:'age_tier',label:'Độ tuổi',type:'select',required:true,options:[{value:'adult',label:'Người lớn'},{value:'child',label:'Trẻ em'},{value:'baby',label:'Em bé'}]},{key:'phone',label:'Số điện thoại',type:'tel'},{key:'email',label:'Email'},{key:'address',label:'Địa chỉ'},{key:'sub_tags',label:'Nhãn',type:'tags'},{key:'private_notes',label:'Ghi chú riêng',type:'textarea'},{key:'is_placeholder',label:'Khách đại diện tạm',type:'checkbox'},{key:'placeholder_for',label:'Đại diện cho'}];
export function GuestActions({ guest,reload }: { guest: GuestOwnerDto;reload:()=>Promise<void> }) {
  const [open,setOpen]=useState(false);const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  return <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={()=>setOpen(true)}>Sửa hồ sơ</Button><Button variant="secondary" disabled={busy} onClick={async()=>{
    if(busy||!window.confirm(guest.is_archived?'Khôi phục hồ sơ khách này?':'Lưu trữ hồ sơ khách? Hãy kiểm tra RSVP và chỗ ngồi trước khi thực hiện.'))return;setBusy(true);setError('');try{await api(`/api/v1/guests/${guest.id}${guest.is_archived?'/restore':''}`,{method:guest.is_archived?'POST':'DELETE',...(guest.is_archived?{body:jsonBody({version:guest.version})}:{})});await reload();}catch(f){setError((f as Error).message);}finally{setBusy(false);}
  }}>{guest.is_archived?'Khôi phục':'Lưu trữ hồ sơ'}</Button>{error&&<p role="alert">{error}</p>}{open&&<RecordEditor title="Sửa hồ sơ khách" fields={fields} record={guest as unknown as RecordData} close={()=>setOpen(false)} save={async body=>{await api(`/api/v1/guests/${guest.id}`,{method:'PATCH',body:jsonBody({...body,version:guest.version})});await reload();}}/>}</div>;
}
