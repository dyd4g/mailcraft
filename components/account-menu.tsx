'use client';
import {useEffect,useRef,useState} from 'react';
import PasswordForm,{authCall} from './password-form';
export type AccountInfo={id:string;email:string;name:string;role:'admin'|'member'};
const initials=(name:string)=>name.split(/\s+/).filter(Boolean).slice(0,2).map(v=>v[0]?.toUpperCase()).join('')||'?';
export default function AccountMenu({account}:{account:AccountInfo}){
 const [open,setOpen]=useState(false),[changing,setChanging]=useState(false),[done,setDone]=useState(false);
 const box=useRef<HTMLDivElement>(null),dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{if(!open)return;const close=(e:MouseEvent)=>{if(!box.current?.contains(e.target as Node))setOpen(false);};document.addEventListener('mousedown',close);return()=>document.removeEventListener('mousedown',close);},[open]);
 useEffect(()=>{if(changing)dialog.current?.showModal();},[changing]);
 async function signOut(){try{await authCall('/api/auth',{action:'logout'});}finally{window.location.reload();}}
 return <div className="account-menu" ref={box}>
  <button className="avatar" aria-haspopup="menu" aria-expanded={open} aria-label={'Account menu for '+account.name} onClick={()=>setOpen(!open)}>{initials(account.name)}</button>
  {open&&<div className="account-pop" role="menu"><div className="account-who"><strong>{account.name}</strong><span>{account.email}</span><em>{account.role==='admin'?'Administrator':'Team member'}</em></div>
   <button role="menuitem" onClick={()=>{setOpen(false);setDone(false);setChanging(true);}}>Change password</button>
   {account.role==='admin'&&<a role="menuitem" href="/users">Manage team access</a>}
   <button role="menuitem" onClick={signOut}>Sign out</button></div>}
  {changing&&<dialog ref={dialog} className="dialog" onCancel={()=>setChanging(false)} onClose={()=>setChanging(false)}>
   <div className="dialog-head"><h2>Change password</h2></div>
   {done?<div className="auth-form"><p className="auth-note">Your password was changed. Other devices were signed out.</p><div className="auth-actions"><button className="primary" onClick={()=>setChanging(false)}>Close</button></div></div>:<PasswordForm onDone={()=>setDone(true)} onCancel={()=>setChanging(false)}/>}
  </dialog>}
 </div>;
}
