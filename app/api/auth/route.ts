import {env} from 'cloudflare:workers';
import {eq,sql} from 'drizzle-orm';
import {z} from 'zod';
import {getDb} from '@/db';
import {users} from '@/db/auth-schema';
import {equalConstantTime,hashPassword,needsRehash,validatePassword,verifyPassword} from '@/lib/auth/password';
import {clearedCookie,endOtherSessions,endSession,getSessionUser,json,normalizeAccountEmail,requireUser,sameOrigin,sessionCookie,startSession} from '@/lib/auth/session';
const MAX_ATTEMPTS=5,LOCK_MS=15*60000;
const email=z.string().trim().max(254).email().transform(normalizeAccountEmail);
// Verified against when an address is unknown, so a missing account takes as long as a wrong password.
const DUMMY_HASH='pbkdf2$sha256$100000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const withCookie=(res:Response,cookie:string)=>{res.headers.append('Set-Cookie',cookie);return res;};
const publicUser=(u:{id:string;email:string;name:string;role:string;mustChangePassword:boolean})=>({id:u.id,email:u.email,name:u.name,role:u.role,mustChangePassword:u.mustChangePassword});
export async function GET(req:Request){
 try{
  const user=await getSessionUser(req);
  const count=await getDb().select({n:sql<number>`count(*)`}).from(users).get();
  return json({user,setupAvailable:(count?.n||0)===0&&!!env.SETUP_TOKEN?.trim()});
 }catch{return json({error:'Sign-in is unavailable. Try again shortly.'},503);}
}
export async function POST(req:Request){
 if(!sameOrigin(req))return json({error:'Cross-origin requests are not allowed.'},403);
 try{
  const p=await req.json() as {action?:string};const db=getDb(),now=new Date().toISOString();
  if(p.action==='login'){
   const input=z.object({email,password:z.string().min(1).max(200)}).safeParse(p);if(!input.success)return json({error:'Incorrect email or password.'},401);
   const account=await db.select().from(users).where(eq(users.email,input.data.email)).get();
   if(account?.lockedUntil&&new Date(account.lockedUntil).getTime()>Date.now())return json({error:'Too many failed attempts. Try again in 15 minutes, or ask an administrator to reset your password.'},429);
   const ok=await verifyPassword(input.data.password,account?.passwordHash||DUMMY_HASH);
   if(!account||!ok||!account.active){
    if(account&&!ok){const attempts=account.failedAttempts+1;await db.update(users).set(attempts>=MAX_ATTEMPTS?{failedAttempts:0,lockedUntil:new Date(Date.now()+LOCK_MS).toISOString(),updatedAt:now}:{failedAttempts:attempts,updatedAt:now}).where(eq(users.id,account.id));}
    return json({error:'Incorrect email or password.'},401);
   }
   await db.update(users).set({failedAttempts:0,lockedUntil:null,lastLoginAt:now,updatedAt:now,...(needsRehash(account.passwordHash)?{passwordHash:await hashPassword(input.data.password)}:{})}).where(eq(users.id,account.id));
   return withCookie(json({user:publicUser(account)}),sessionCookie(req,await startSession(account.id)));
  }
  if(p.action==='logout'){await endSession(req);return withCookie(json({ok:true}),clearedCookie(req));}
  if(p.action==='changePassword'){
   const auth=await requireUser(req,{write:true,allowPasswordChange:true});if(auth.denied)return auth.denied;
   const input=z.object({currentPassword:z.string().min(1).max(200),newPassword:z.string().max(200)}).safeParse(p);if(!input.success)return json({error:'Enter your current and new password.'},400);
   const account=await db.select().from(users).where(eq(users.id,auth.user.id)).get();
   if(!account||!await verifyPassword(input.data.currentPassword,account.passwordHash))return json({error:'Your current password is incorrect.'},400);
   const problem=validatePassword(input.data.newPassword,account.email);if(problem)return json({error:problem},400);
   if(input.data.newPassword===input.data.currentPassword)return json({error:'Choose a password different from the current one.'},400);
   await db.update(users).set({passwordHash:await hashPassword(input.data.newPassword),mustChangePassword:false,failedAttempts:0,lockedUntil:null,updatedAt:now}).where(eq(users.id,account.id));
   await endOtherSessions(req,account.id);return json({ok:true});
  }
  if(p.action==='setup'){
   const secret=env.SETUP_TOKEN?.trim();const count=await db.select({n:sql<number>`count(*)`}).from(users).get();
   if(!secret||(count?.n||0)>0)return json({error:'First-time setup is not available.'},409);
   const input=z.object({token:z.string().max(500),email,name:z.string().trim().min(1).max(120),password:z.string().max(200)}).safeParse(p);if(!input.success)return json({error:'Enter the setup token, your name, a valid email and a password.'},400);
   if(!equalConstantTime(input.data.token,secret))return json({error:'The setup token is not correct.'},403);
   const problem=validatePassword(input.data.password,input.data.email);if(problem)return json({error:problem},400);
   const id=crypto.randomUUID();await db.insert(users).values({id,email:input.data.email,name:input.data.name,role:'admin',passwordHash:await hashPassword(input.data.password),active:true,mustChangePassword:false,createdAt:now,updatedAt:now});
   return withCookie(json({user:{id,email:input.data.email,name:input.data.name,role:'admin',mustChangePassword:false}},201),sessionCookie(req,await startSession(id)));
  }
  return json({error:'Unknown action.'},400);
 }catch(e){if(e instanceof SyntaxError)return json({error:'Invalid request.'},400);console.error('Auth request failed');return json({error:'Sign-in is unavailable. Try again shortly.'},500);}
}
