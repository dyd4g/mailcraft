'use client';
import {useState} from 'react';
export async function authCall<T>(url:string,body?:unknown):Promise<T>{
 const res=await fetch(url,{method:body===undefined?'GET':'POST',cache:'no-store',headers:body===undefined?undefined:{'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await res.json().catch(()=>({})) as T&{error?:string};
 if(!res.ok)throw new Error(value.error||'Something went wrong. Try again.');return value;
}
export default function PasswordForm({intro,onDone,onCancel}:{intro?:string;onDone:()=>void;onCancel?:()=>void}){
 const [current,setCurrent]=useState(''),[next,setNext]=useState(''),[again,setAgain]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setError('');if(next!==again){setError('The new passwords do not match.');return;}setBusy(true);
  try{await authCall('/api/auth',{action:'changePassword',currentPassword:current,newPassword:next});onDone();}catch(err){setError((err as Error).message);}finally{setBusy(false);}}
 return <form className="auth-form" onSubmit={submit}>
  {intro&&<p className="auth-note">{intro}</p>}
  {error&&<div className="auth-error" role="alert">{error}</div>}
  <label className="field"><span>Current password</span><input type="password" autoComplete="current-password" required value={current} onChange={e=>setCurrent(e.target.value)}/></label>
  <label className="field"><span>New password</span><input type="password" autoComplete="new-password" required minLength={12} value={next} onChange={e=>setNext(e.target.value)}/><small>At least 12 characters. A few random words work well.</small></label>
  <label className="field"><span>Repeat new password</span><input type="password" autoComplete="new-password" required value={again} onChange={e=>setAgain(e.target.value)}/></label>
  <div className="auth-actions">{onCancel&&<button type="button" onClick={onCancel}>Cancel</button>}<button className="primary" disabled={busy||!current||!next||!again}>{busy?'Saving…':'Save new password'}</button></div>
 </form>;
}
