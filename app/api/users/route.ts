import {and,eq,sql} from 'drizzle-orm';
import {z} from 'zod';
import {first,getDb} from '@/db';
import {sessions,users} from '@/db/auth-schema';
import {generatePassword,hashPassword} from '@/lib/auth/password';
import {json,normalizeAccountEmail,requireUser} from '@/lib/auth/session';
const id=z.string().min(1).max(100);
const email=z.string().trim().max(254).email().transform(normalizeAccountEmail);
const role=z.enum(['admin','member']);
const listed=(u:typeof users.$inferSelect)=>({id:u.id,email:u.email,name:u.name,role:u.role,active:u.active,mustChangePassword:u.mustChangePassword,locked:!!u.lockedUntil&&new Date(u.lockedUntil).getTime()>Date.now(),lastLoginAt:u.lastLoginAt,createdAt:u.createdAt});
async function activeAdmins(){const row=await getDb().select({n:sql<number>`count(*)::int`}).from(users).where(and(eq(users.role,'admin'),eq(users.active,true))).then(first);return row?.n||0;}
export async function GET(req:Request){
 const auth=await requireUser(req,{admin:true});if(auth.denied)return auth.denied;
 try{return json({users:(await getDb().select().from(users).orderBy(users.name)).map(listed),currentUserId:auth.user.id});}
 catch{return json({error:'Users could not load. Refresh and try again.'},503);}
}
export async function POST(req:Request){
 const auth=await requireUser(req,{admin:true,write:true});if(auth.denied)return auth.denied;
 try{
  const p=await req.json() as {action?:string};const db=getDb(),now=new Date().toISOString();
  if(p.action==='create'){
   const input=z.object({email,name:z.string().trim().min(1).max(120),role}).safeParse(p);if(!input.success)return json({error:'Enter a name and a valid email address.'},400);
   if(await db.select({id:users.id}).from(users).where(eq(users.email,input.data.email)).then(first))return json({error:'An account with that email already exists.'},409);
   const temporaryPassword=generatePassword(),userId=crypto.randomUUID();
   await db.insert(users).values({id:userId,email:input.data.email,name:input.data.name,role:input.data.role,passwordHash:await hashPassword(temporaryPassword),active:true,mustChangePassword:true,createdAt:now,updatedAt:now});
   return json({user:listed((await db.select().from(users).where(eq(users.id,userId)).then(first))!),temporaryPassword},201);
  }
  const target=await db.select().from(users).where(eq(users.id,id.parse((p as {id?:string}).id))).then(first);if(!target)return json({error:'Account not found.'},404);
  if(p.action==='update'){
   const input=z.object({name:z.string().trim().min(1).max(120).optional(),role:role.optional(),active:z.boolean().optional()}).safeParse(p);if(!input.success)return json({error:'Those changes are not valid.'},400);
   const losesAdmin=target.role==='admin'&&target.active&&((input.data.role&&input.data.role!=='admin')||input.data.active===false);
   if(losesAdmin&&target.id===auth.user.id)return json({error:'You cannot remove your own administrator access or deactivate your own account.'},409);
   if(losesAdmin&&await activeAdmins()<=1)return json({error:'At least one active administrator is required.'},409);
   await db.update(users).set({...(input.data.name?{name:input.data.name}:{}),...(input.data.role?{role:input.data.role}:{}),...(input.data.active!==undefined?{active:input.data.active}:{}),updatedAt:now}).where(eq(users.id,target.id));
   if(input.data.active===false||(input.data.role&&input.data.role!==target.role))await db.delete(sessions).where(eq(sessions.userId,target.id));
   return json({ok:true});
  }
  if(p.action==='resetPassword'){
   const temporaryPassword=generatePassword();
   await db.update(users).set({passwordHash:await hashPassword(temporaryPassword),mustChangePassword:true,failedAttempts:0,lockedUntil:null,updatedAt:now}).where(eq(users.id,target.id));
   await db.delete(sessions).where(eq(sessions.userId,target.id));
   return json({temporaryPassword});
  }
  return json({error:'Unknown action.'},400);
 }catch(e){if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'That request is not valid.'},400);console.error('User administration failed');return json({error:'The change could not be saved. Refresh and try again.'},500);}
}
