import {and,eq,lt,ne} from 'drizzle-orm';
import {getDb} from '@/db';
import {sessions,users} from '@/db/auth-schema';
import {tokenHash,newToken} from './token';
export const SESSION_COOKIE='mc_session';
const ABSOLUTE_MS=7*86400000,IDLE_MS=12*3600000,TOUCH_MS=5*60000;
export type SessionUser={id:string;email:string;name:string;role:'admin'|'member';mustChangePassword:boolean};
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export const normalizeAccountEmail=(v:string)=>v.trim().toLowerCase();
function cookieValue(req:Request,name:string){
 for(const part of (req.headers.get('cookie')||'').split(';')){const i=part.indexOf('=');if(i>0&&part.slice(0,i).trim()===name)return part.slice(i+1).trim();}return '';
}
const secure=(req:Request)=>new URL(req.url).protocol==='https:'||req.headers.get('x-forwarded-proto')==='https';
export const sessionCookie=(req:Request,token:string)=>`${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${ABSOLUTE_MS/1000}${secure(req)?'; Secure':''}`;
export const clearedCookie=(req:Request)=>`${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure(req)?'; Secure':''}`;
export function sameOrigin(req:Request){const origin=req.headers.get('origin');return !origin||origin===new URL(req.url).origin;}
export async function startSession(userId:string){
 const db=getDb(),now=new Date(),token=newToken();
 await db.delete(sessions).where(lt(sessions.expiresAt,now.toISOString()));
 await db.insert(sessions).values({hash:await tokenHash(token),userId,createdAt:now.toISOString(),lastSeenAt:now.toISOString(),expiresAt:new Date(now.getTime()+ABSOLUTE_MS).toISOString()});
 return token;
}
export async function endSession(req:Request){const token=cookieValue(req,SESSION_COOKIE);if(token)await getDb().delete(sessions).where(eq(sessions.hash,await tokenHash(token)));}
export async function endOtherSessions(req:Request,userId:string){
 const token=cookieValue(req,SESSION_COOKIE);const keep=token?await tokenHash(token):'';
 await getDb().delete(sessions).where(keep?and(eq(sessions.userId,userId),ne(sessions.hash,keep)):eq(sessions.userId,userId));
}
/** The signed-in, active account for this request, or null. */
export async function getSessionUser(req:Request):Promise<SessionUser|null>{
 const token=cookieValue(req,SESSION_COOKIE);if(!/^[a-f0-9]{64}$/.test(token))return null;
 const db=getDb(),hash=await tokenHash(token),now=Date.now();
 const row=await db.select({session:sessions,user:users}).from(sessions).innerJoin(users,eq(users.id,sessions.userId)).where(eq(sessions.hash,hash)).get();
 if(!row)return null;
 if(new Date(row.session.expiresAt).getTime()<=now||now-new Date(row.session.lastSeenAt).getTime()>IDLE_MS){await db.delete(sessions).where(eq(sessions.hash,hash));return null;}
 if(!row.user.active)return null;
 if(now-new Date(row.session.lastSeenAt).getTime()>TOUCH_MS)await db.update(sessions).set({lastSeenAt:new Date(now).toISOString()}).where(eq(sessions.hash,hash));
 return {id:row.user.id,email:row.user.email,name:row.user.name,role:row.user.role==='admin'?'admin':'member',mustChangePassword:row.user.mustChangePassword};
}
/** Common gate for API routes. Returns the user, or a response to send back instead. */
export async function requireUser(req:Request,options:{write?:boolean;admin?:boolean;allowPasswordChange?:boolean}={}):Promise<{user:SessionUser;denied?:undefined}|{user?:undefined;denied:Response}>{
 const user=await getSessionUser(req);
 if(!user)return {denied:json({error:'Sign in to continue.'},401)};
 if(user.mustChangePassword&&!options.allowPasswordChange)return {denied:json({error:'Choose a new password before continuing.',code:'password_change_required'},403)};
 if(options.admin&&user.role!=='admin')return {denied:json({error:'Only an administrator can do this.'},403)};
 if(options.write&&!sameOrigin(req))return {denied:json({error:'Cross-origin writes are not allowed.'},403)};
 return {user};
}
