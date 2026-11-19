'use client';
import React,{useState} from 'react';
import { RecordEditor } from '@/components/common/ResourceWorkspace';
import { api,jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
export function DocumentActions({file,reload}:{file:{id:string;originalName:string;isArchived:boolean;updatedAt:string};reload:()=>void}){const[open,setOpen]=useState(false);return <><Button variant="secondary" size="sm" onClick={()=>setOpen(true)}>Đổi tên / Lưu trữ</Button>{open&&<RecordEditor title="Thông tin tài liệu" record={{...file}} fields={[{key:'originalName',label:'Tên tài liệu',required:true},{key:'isArchived',label:'Đã lưu trữ (bỏ chọn để khôi phục)',type:'checkbox'}]} close={()=>setOpen(false)} save={async body=>{await api(`/api/v1/documents/${file.id}`,{method:'PATCH',body:jsonBody({...body,expectedUpdatedAt:file.updatedAt})});reload();}}/>}</>;}
