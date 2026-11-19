'use client';
import React,{useState} from 'react';
import { api,jsonBody } from '@/lib/api/request';
import { Button } from '@/components/ui/button';
import { MergeGuestsModal, DuplicatePairSummary } from './MergeGuestsModal';
import { GuestOwnerDto } from '@/schemas/guests';
export function DuplicateReview({reload}:{reload:()=>Promise<void>}) {
  const [pairs,setPairs]=useState<DuplicatePairSummary[]|null>(null);const [selected,setSelected]=useState<DuplicatePairSummary|null>(null);const[busy,setBusy]=useState(false);const[error,setError]=useState('');
  return <div className="space-y-3"><Button variant="secondary" disabled={busy} onClick={async()=>{setBusy(true);setError('');try{const r=await api<{data:{guest_a:GuestOwnerDto;guest_b:GuestOwnerDto;match_reasons:string[]}[]}>('/api/v1/duplicate-candidates');const map=(g:GuestOwnerDto)=>({id:g.id,displayName:g.display_name,side:g.side,phone:g.phone,email:g.email,address:g.address,subTags:g.sub_tags});setPairs(r.data.map(p=>({...p,guest_a:map(p.guest_a),guest_b:map(p.guest_b)})));}catch(f){setError((f as Error).message);}finally{setBusy(false);}}}>Rà soát khách có thể trùng</Button>{error&&<p role="alert">{error}</p>}{pairs?.length===0&&<p>Không tìm thấy hồ sơ có thể trùng.</p>}{pairs?.map(p=><div key={`${p.guest_a.id}:${p.guest_b.id}`} className="surface-card p-3 flex flex-wrap gap-3 items-center"><span>{p.guest_a.displayName} / {p.guest_b.displayName}</span><Button variant="secondary" onClick={()=>setSelected(p)}>So sánh & Gộp</Button></div>)}{selected&&<MergeGuestsModal isOpen candidatePair={selected} onClose={()=>setSelected(null)} onMergeSubmit={body=>api('/api/v1/merge',{method:'POST',body:jsonBody(body)})} onMergeSuccess={()=>{setSelected(null);setPairs(null);void reload();}}/>}</div>;
}
