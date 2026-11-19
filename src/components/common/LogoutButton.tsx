'use client';
import React,{useState} from 'react';
import { authClient } from '@/lib/auth-client';
export function LogoutButton(){const[busy,setBusy]=useState(false);const[error,setError]=useState('');return <div><button type="button" className="min-h-11 text-sm underline" disabled={busy} onClick={async()=>{if(busy)return;setBusy(true);try{const result=await authClient.signOut();if(result.error)throw new Error(result.error.message);try{for(const key of Object.keys(sessionStorage))if(key.startsWith('wedding-'))sessionStorage.removeItem(key);}catch{}window.location.assign('/login');}catch{setError('Không thể đăng xuất. Vui lòng thử lại.');setBusy(false);}}}>{busy?'Đang đăng xuất…':'Đăng xuất'}</button>{error&&<p role="alert">{error}</p>}</div>;}
