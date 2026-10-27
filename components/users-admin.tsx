'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import {authCall} from './password-form';
type Row={id:string;email:string;name:string;role:'admin'|'member';active:boolean;mustChangePassword:boolean;locked:boolean;lastLoginAt:string|null;createdAt:string};
type Reveal={title:string;email:string;password:string};
const when=(v:string|null)=>v?new Date(v).toLocaleString():'Never';
export default function UsersAdmin(){
 const [rows,setRows]=useState<Row[]>([]),[me,setMe]=useState(''),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reveal,setReveal]=useState<Reveal|null>(null);
 const [form,setForm]=useState({name:'',email:'',role:'member'}),[copied,setCopied]=useState(false);
 const load=useCallback(()=>authCall<{users:Row[];currentUserId:string}>('/api/users').then(v=>{setRows(v.users);setMe(v.currentUserId);}),[]);
 useEffect(()=>{load().catch(e=>setError((e as Error).message)).finally(()=>setLoading(false));},[load]);
 async function act(fn:()=>Promise<void>){setBusy(true);setError('');try{await fn();await load();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const create=(e:React.FormEvent)=>{e.preventDefault();void act(async()=>{const r=await authCall<{temporaryPassword:string}>('/api/users',{action:'create',...form});setReveal({title:'Account created',email:form.email.trim().toLowerCase(),password:r.temporaryPassword});setCopied(false);setForm({name:'',email:'',role:'member'});});};
 return <main className="users-page">
  <Link className="text-link" href="/">← Back to the studio</Link>
  <h1>Team access</h1>
  <p className="auth-note">Only people listed here can sign in. Accounts are created by an administrator; there is no public sign-up.</p>
  {error&&<div className="auth-error" role="alert">{error}</div>}
  {reveal&&<div className="auth-reveal" role="status"><strong>{reveal.title} for {reveal.email}</strong><p>Give them this temporary password. It is shown only once and they must choose their own when they first sign in.</p><code>{reveal.password}</code><div className="auth-actions"><button onClick={()=>{void navigator.clipboard?.writeText(reveal.password).then(()=>setCopied(true));}}>{copied?'Copied':'Copy password'}</button><button onClick={()=>setReveal(null)}>I have saved it</button></div></div>}
  <section className="settings-card"><h3>Add a person</h3>
   <form className="users-add" onSubmit={create}>
    <label className="field"><span>Full name</span><input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
    <label className="field"><span>Work email</span><input type="email" required maxLength={254} value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label>
    <label className="field"><span>Role</span><select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="member">Team member (design and campaigns)</option><option value="admin">Administrator (also manages access)</option></select></label>
    <button className="primary" disabled={busy||!form.name.trim()||!form.email.trim()}>Create account</button>
   </form></section>
  <h3 className="campaign-section-title">People with access</h3>
  {loading?<p className="subtle">Loading…</p>:<div className="campaign-table-wrap"><table><thead><tr><th>Name</th><th>Role</th><th>Status</th><th>Last sign-in</th><th>Actions</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>
   <td><strong>{r.name}</strong><small>{r.email}{r.id===me?' (you)':''}</small></td>
   <td><select aria-label={'Role for '+r.name} disabled={busy||r.id===me} value={r.role} onChange={e=>void act(()=>authCall('/api/users',{action:'update',id:r.id,role:e.target.value}).then(()=>undefined))}><option value="member">Team member</option><option value="admin">Administrator</option></select></td>
   <td><span className={'campaign-status '+(r.active?'active':'suppressed')}>{r.active?(r.locked?'Locked':r.mustChangePassword?'Waiting for first sign-in':'Active'):'Deactivated'}</span></td>
   <td>{when(r.lastLoginAt)}</td>
   <td><div className="row"><button disabled={busy||!r.active} onClick={()=>{if(window.confirm('Reset the password for '+r.name+'? They will be signed out everywhere.'))void act(async()=>{const x=await authCall<{temporaryPassword:string}>('/api/users',{action:'resetPassword',id:r.id});setReveal({title:'Password reset',email:r.email,password:x.temporaryPassword});setCopied(false);});}}>Reset password</button>
    {r.id!==me&&<button disabled={busy} onClick={()=>{if(r.active&&!window.confirm('Deactivate '+r.name+'? They will be signed out and cannot sign in.'))return;void act(()=>authCall('/api/users',{action:'update',id:r.id,active:!r.active}).then(()=>undefined));}}>{r.active?'Deactivate':'Reactivate'}</button>}</div></td>
  </tr>)}</tbody></table></div>}
 </main>;
}
