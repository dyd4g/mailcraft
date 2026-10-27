import {and,eq} from 'drizzle-orm';
import {getDb} from '@/db';
import {clients} from '@/db/schema';
import {contacts,preferenceTokens} from '@/db/campaign-schema';
import {tokenHash} from '@/lib/campaigns/server';
import {escapeHtml} from '@/lib/email/render';
async function render(req:Request,submit:boolean){
 const token=new URL(req.url).searchParams.get('t')||'';const db=getDb();const preference=/^[a-f0-9]{64}$/.test(token)?await db.select().from(preferenceTokens).where(eq(preferenceTokens.hash,await tokenHash(token))).get():null;
 const client=preference?await db.select().from(clients).where(eq(clients.id,preference.clientId)).get():null;
 let title='This preference link is unavailable.',body='Please use the unsubscribe link in your original email.',form='';
 if(preference&&client){
  if(submit){await db.update(contacts).set({status:'unsubscribed',updatedAt:new Date().toISOString()}).where(and(eq(contacts.clientId,preference.clientId),eq(contacts.email,preference.email)));title='You’re unsubscribed.';body=`You will no longer receive marketing emails from ${client.name}. This does not change subscriptions with other businesses.`;}
  else{title='Your email preferences';body=`Unsubscribe from ${client.name} marketing emails. No login is required.`;form=`<form method="post"><button type="submit">Unsubscribe</button></form>`;}
 }
 const brand=client?JSON.parse(client.brand):null;const logo=brand?.logo&&/^https:\/\//.test(brand.logo)?`<img src="${escapeHtml(brand.logo)}" alt="${escapeHtml(client!.name)}" style="max-width:200px;max-height:75px;margin-bottom:30px">`:'';
 return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="referrer" content="no-referrer"><title>Email preferences</title><style>body{font:16px Arial;background:#f4f6fa;color:#24324b;margin:0;padding:60px 20px}main{max-width:500px;margin:40px auto;background:white;border:1px solid #e1e5ee;border-radius:16px;padding:40px}h1{font-size:26px}p{line-height:1.7;color:#58667b}button{padding:14px 24px;background:#243b64;color:white;border:0;border-radius:6px;font:inherit;cursor:pointer}</style><main>${logo}<h1>${escapeHtml(title)}</h1><p>${escapeHtml(body)}</p>${form}</main></html>`,{status:preference&&client?200:404,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; img-src https:; form-action 'self'; frame-ancestors 'none'"}});
}
export const GET=(req:Request)=>render(req,false);
export const POST=(req:Request)=>render(req,true);
