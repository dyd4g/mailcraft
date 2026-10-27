'use client';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
import Studio from './studio';
import UsersAdmin from './users-admin';
import PasswordForm,{authCall} from './password-form';
import type {AccountInfo} from './account-menu';
type Me=AccountInfo&{mustChangePassword:boolean};
type State={status:'loading'|'ready'|'error';user:Me|null;setupAvailable:boolean;message:string};
function Card({title,children}:{title:string;children:React.ReactNode}){
 return <main className="auth-page"><div className="auth-card"><span className="brand-mark">m</span><h1>{title}</h1>{children}</div></main>;
}
function LoginForm({onDone}:{onDone:()=>void}){
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await authCall('/api/auth',{action:'login',email,password});onDone();}catch(err){setError((err as Error).message);setBusy(false);}}
 return <Card title="Sign in to Mailcraft"><form className="auth-form" onSubmit={submit}>
  <p className="auth-note">Internal team workspace. Your administrator creates your account.</p>
  {error&&<div className="auth-error" role="alert">{error}</div>}
  <label className="field"><span>Work email</span><input type="email" autoComplete="username" required autoFocus value={email} onChange={e=>setEmail(e.target.value)}/></label>
  <label className="field"><span>Password</span><input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <button className="primary" disabled={busy||!email||!password}>{busy?'Signing in…':'Sign in'}</button>
  <small className="auth-help">Forgot your password? Ask an administrator to reset it.</small>
 </form></Card>;
}
function SetupForm({onDone}:{onDone:()=>void}){
 const [f,setF]=useState({token:'',name:'',email:'',password:''}),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await authCall('/api/auth',{action:'setup',...f});onDone();}catch(err){setError((err as Error).message);setBusy(false);}}
 return <Card title="Create the first administrator"><form className="auth-form" onSubmit={submit}>
  <p className="auth-note">No accounts exist yet. Enter the setup token from the server settings to create the first administrator. Then remove the token.</p>
  {error&&<div className="auth-error" role="alert">{error}</div>}
  <label className="field"><span>Setup token</span><input type="password" autoComplete="off" required value={f.token} onChange={e=>setF({...f,token:e.target.value})}/></label>
  <label className="field"><span>Full name</span><input required maxLength={120} value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></label>
  <label className="field"><span>Work email</span><input type="email" autoComplete="username" required value={f.email} onChange={e=>setF({...f,email:e.target.value})}/></label>
  <label className="field"><span>Password</span><input type="password" autoComplete="new-password" required minLength={12} value={f.password} onChange={e=>setF({...f,password:e.target.value})}/><small>At least 12 characters.</small></label>
  <button className="primary" disabled={busy||!f.token||!f.name||!f.email||!f.password}>{busy?'Creating…':'Create administrator'}</button>
 </form></Card>;
}
export default function AuthGate({view}:{view:'studio'|'users'}){
 const [state,setState]=useState<State>({status:'loading',user:null,setupAvailable:false,message:''});
 const refresh=useCallback(()=>authCall<{user:Me|null;setupAvailable:boolean}>('/api/auth').then(v=>setState({status:'ready',user:v.user,setupAvailable:v.setupAvailable,message:''})).catch(e=>setState({status:'error',user:null,setupAvailable:false,message:(e as Error).message})),[]);
 useEffect(()=>{void refresh();},[refresh]);
 if(state.status==='loading')return <Card title="Opening your studio"><p className="auth-note">Checking your sign-in…</p></Card>;
 if(state.status==='error')return <Card title="Sign-in is unavailable"><p className="auth-note">{state.message}</p><button className="primary" onClick={()=>{setState({...state,status:'loading'});void refresh();}}>Try again</button></Card>;
 if(!state.user)return state.setupAvailable?<SetupForm onDone={()=>void refresh()}/>:<LoginForm onDone={()=>void refresh()}/>;
 if(state.user.mustChangePassword)return <Card title="Choose your own password"><PasswordForm intro="Your account was created with a temporary password. Choose a new one to continue." onDone={()=>void refresh()}/></Card>;
 if(view==='users')return state.user.role==='admin'?<UsersAdmin/>:<Card title="Administrators only"><p className="auth-note">Ask an administrator if you need access changes.</p><Link className="primary auth-link" href="/">Back to the studio</Link></Card>;
 return <Studio account={state.user}/>;
}
