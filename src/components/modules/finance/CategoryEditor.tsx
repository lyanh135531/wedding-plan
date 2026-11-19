'use client';
import React,{useState} from 'react';
import { RecordEditor } from '@/components/common/ResourceWorkspace';
import { api,jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
export function CategoryEditor({category,reload}:{category:{id:string;name:string;allocatedAmount:string|null;updatedAt:string;defaultOrder?:number};reload:()=>Promise<void>}){const[open,setOpen]=useState(false);return <><Button variant="secondary" size="sm" onClick={()=>setOpen(true)}>Sửa danh mục</Button>{open&&<RecordEditor title="Sửa danh mục & Ngân sách" fields={[{key:'name',label:'Tên danh mục',required:true},{key:'allocated_budget',label:'Ngân sách phân bổ (VND)',required:true}]} record={{id:category.id,name:category.name,allocated_budget:category.allocatedAmount||'0'}} close={()=>setOpen(false)} save={async body=>{await api('/api/v1/finance/categories',{method:'PATCH',body:jsonBody({...body,id:category.id,expectedUpdatedAt:category.updatedAt,default_order:category.defaultOrder||0})});await reload();}}/>}</>;}
