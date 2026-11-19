'use client';
import { ResourceWorkspace } from '@/components/common/ResourceWorkspace';
import { useRole } from '@/context/RoleContext';
import { useEventScope } from '@/context/EventScopeContext';
export function AppointmentsWorkspace({onChanged}:{onChanged:()=>void}){const{isOwner}=useRole();const{availableEvents}=useEventScope();if(!isOwner)return null;return <ResourceWorkspace title="Cuộc hẹn" endpoint="/api/v1/appointments" onChanged={onChanged} fields={[{key:'title',label:'Tên cuộc hẹn',required:true},{key:'startTime',label:'Bắt đầu cuộc hẹn',type:'datetime-local',required:true},{key:'endTime',label:'Kết thúc cuộc hẹn',type:'datetime-local',required:true},{key:'eventId',label:'Buổi lễ liên quan',type:'select',options:availableEvents.map(e=>({value:e.id,label:e.name}))},{key:'location',label:'Địa điểm'},{key:'attendees',label:'Người tham gia'},{key:'notes',label:'Ghi chú',type:'textarea'},{key:'sharedWithFamily',label:'Chia sẻ với người nhà',type:'checkbox'}]}/>;}
