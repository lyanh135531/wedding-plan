'use client';
import { useCallback, useRef } from 'react';
/** Keep the same write key after an uncertain response; successful deliberate writes get a new key. */
export function useMutationFetch() {
  const pending = useRef(new Map<string,string>());
  return useCallback(async (input: string, init: RequestInit = {}) => {
    if (!init.method || ['GET','HEAD'].includes(init.method.toUpperCase())) return fetch(input,{...init,cache:'no-store'});
    const identity=`${init.method}:${input}:${String(init.body||'')}`;
    const key=pending.current.get(identity)||crypto.randomUUID();pending.current.set(identity,key);
    const headers=new Headers(init.headers);headers.set('Idempotency-Key',key);
    const response=await fetch(input,{...init,headers});
    if(response.ok)pending.current.delete(identity);
    return response;
  },[]);
}
