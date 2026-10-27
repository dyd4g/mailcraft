import {and,eq,desc,gt,inArray,sql} from 'drizzle-orm';
import {z} from 'zod';
import {first,getDb,type Db,type Tx} from '@/db';
import {publicUrl} from '@/lib/auth/origin';
import {clients,documents} from '@/db/schema';
import {contacts,audienceImports,campaignSettings,campaigns,campaignReports,campaignTests,preferenceTokens,clickTokens,campaignEvents} from '@/db/campaign-schema';
import {authorize,json,newToken,sendGridKey,tokenHash} from '@/lib/campaigns/server';
import {getSessionUser} from '@/lib/auth/session';
import {identifyLinks,normalizeEmail,validEmail} from '@/lib/campaigns/model';
import {TEST_LIMIT_PER_HOUR,buildTestHtml,buildTestMessage,parseTestRecipients,rewriteLinks,sendTestMessage} from '@/lib/campaigns/sendgrid';
import {exportEmail,escapeHtml} from '@/lib/email/render';
const id=z.string().min(1).max(100),name=z.string().trim().min(1).max(120);
const mapping=z.object({email:z.string().max(200),firstName:z.string().max(200),lastName:z.string().max(200),extra:z.array(z.string().max(200)).max(12)});
// A deferred write runs inside one shared transaction, so a failed import saves nothing.
type Write=(tx:Tx)=>PromiseLike<unknown>;
const batch=(db:Db,writes:Write[])=>db.transaction(async tx=>{for(const write of writes)await write(tx);});
// PostgreSQL allows 65,535 parameters per statement; contact rows use 7 each.
const CONTACT_CHUNK=1500;
async function upsertContacts(tx:Tx,clientId:string,rows:{email:string;firstName:string;lastName:string;fields:Record<string,string>}[],status:string,now:string){
 for(let i=0;i<rows.length;i+=CONTACT_CHUNK)await tx.insert(contacts).values(rows.slice(i,i+CONTACT_CHUNK).map(c=>({clientId,email:c.email,firstName:c.firstName,lastName:c.lastName,fields:JSON.stringify(c.fields),status,updatedAt:now}))).onConflictDoUpdate({target:[contacts.clientId,contacts.email],set:{
  firstName:sql`CASE WHEN excluded.first_name<>'' THEN excluded.first_name ELSE ${contacts.firstName} END`,
  lastName:sql`CASE WHEN excluded.last_name<>'' THEN excluded.last_name ELSE ${contacts.lastName} END`,
  fields:sql`(${contacts.fields}::jsonb || COALESCE((SELECT jsonb_object_agg(key,value) FROM jsonb_each_text(excluded.fields::jsonb) WHERE value<>''),'{}'::jsonb))::text`,
  status:sql`CASE WHEN excluded.status='unsubscribed' THEN 'unsubscribed' ELSE ${contacts.status} END`,
  updatedAt:sql`excluded.updated_at`}});
}
async function markUnsubscribed(tx:Tx,clientId:string,emails:string[],now:string){
 for(let i=0;i<emails.length;i+=CONTACT_CHUNK)await tx.insert(contacts).values(emails.slice(i,i+CONTACT_CHUNK).map(email=>({clientId,email,status:'unsubscribed',updatedAt:now}))).onConflictDoUpdate({target:[contacts.clientId,contacts.email],set:{status:'unsubscribed',updatedAt:now}});
}
function deliveryStatus(settings:{fromEmail:string;senderVerified:boolean}|undefined){
 if(!sendGridKey())return {connected:false,enabled:false,message:'SendGrid connection pending. Test emails, live sends and scheduling are disabled until an API key is added to the server.'};
 if(!settings?.fromEmail||!settings.senderVerified)return {connected:true,enabled:false,message:'SendGrid is connected. Save a from address and confirm it is a verified sender before sending a test email.'};
 return {connected:true,enabled:true,message:'Test emails are available. Live sends and scheduling remain disabled.'};
}
const parse=<T extends {fields:string}>(r:T)=>({...r,fields:JSON.parse(r.fields) as Record<string,string>});
async function owner(clientId:string){return getDb().select().from(clients).where(eq(clients.id,clientId)).then(first);}
export async function GET(req:Request){
 const denied=await authorize(req);if(denied)return denied;
 const clientId=new URL(req.url).searchParams.get('clientId');if(!clientId||!await owner(clientId))return json({error:'Client not found.'},404);
 try{const db=getDb();const [cs,ais,cas,rs,settings,events,tests,user]=await Promise.all([
  db.select().from(contacts).where(eq(contacts.clientId,clientId)).orderBy(contacts.email),db.select().from(audienceImports).where(eq(audienceImports.clientId,clientId)).orderBy(desc(audienceImports.createdAt)),db.select().from(campaigns).where(eq(campaigns.clientId,clientId)).orderBy(desc(campaigns.updatedAt)),db.select().from(campaignReports).where(eq(campaignReports.clientId,clientId)).orderBy(desc(campaignReports.createdAt)),db.select().from(campaignSettings).where(eq(campaignSettings.clientId,clientId)).then(first),db.select().from(campaignEvents).where(eq(campaignEvents.clientId,clientId)).orderBy(desc(campaignEvents.timestamp)),db.select().from(campaignTests).where(eq(campaignTests.clientId,clientId)).orderBy(desc(campaignTests.createdAt)).limit(200),getSessionUser(req)]);
  return json({contacts:cs.map(parse),audiences:ais.map(r=>({...r,members:JSON.parse(r.members),stats:JSON.parse(r.stats),mapping:JSON.parse(r.mapping)})),campaigns:cas.map(r=>({...r,snapshot:JSON.parse(r.snapshot)})),reports:rs.map(r=>({...r,data:JSON.parse(r.data)})),settings:settings?{...settings,mapping:JSON.parse(settings.mapping)}:null,events,tests,staffEmail:user?.email||'',delivery:deliveryStatus(settings)});
 }catch{return json({error:'Campaign data could not load. Refresh and try again.'},503);}
}
export async function POST(req:Request){
 const denied=await authorize(req,true);if(denied)return denied;
 try{
  const raw=await req.text();if(raw.length>1800000)return json({error:'Import exceeds 1.8 MB of extracted data. Split it into smaller files.'},413);
  const p=JSON.parse(raw);const clientId=id.parse(p.clientId);const client=await owner(clientId);if(!client)return json({error:'Client not found.'},404);
  const db=getDb(),now=new Date().toISOString();
  if(p.action==='importContacts'){
   const input=z.object({id,name,fingerprint:z.string().length(64),mapping,kind:z.enum(['audience','suppressions']),stats:z.object({rows:z.number().int().nonnegative(),valid:z.number().int().nonnegative(),invalid:z.number().int().nonnegative(),duplicates:z.number().int().nonnegative(),unique:z.number().int().nonnegative()}),contacts:z.array(z.object({email:z.string().max(254),firstName:z.string().max(120),lastName:z.string().max(120),fields:z.record(z.string().max(500))})).min(1).max(10000)}).parse(p);
   if(input.stats.unique!==input.contacts.length||input.stats.rows!==input.stats.valid+input.stats.invalid||input.stats.valid!==input.stats.unique+input.stats.duplicates)return json({error:'Import totals do not reconcile. Review the selected columns.'},400);
   if(input.contacts.some(c=>!validEmail(normalizeEmail(c.email))||Object.keys(c.fields).some(k=>!input.mapping.extra.includes(k))))return json({error:'Contacts contain an invalid email or unmapped fields.'},400);
   if(new Set(input.contacts.map(c=>normalizeEmail(c.email))).size!==input.contacts.length)return json({error:'Deduplicate the import before saving.'},400);
   const existing=await db.select().from(audienceImports).where(and(eq(audienceImports.clientId,clientId),eq(audienceImports.fingerprint,input.fingerprint),eq(audienceImports.kind,input.kind))).then(first);
   if(existing)return json({id:existing.id,existing:true});
   const rows=input.contacts.map(c=>({...c,email:normalizeEmail(c.email)}));const status=input.kind==='suppressions'?'unsubscribed':'active';
   // One transaction: the upsert preserves existing suppression status and nonempty saved values.
   await batch(db,[
    tx=>upsertContacts(tx,clientId,rows,status,now),
    tx=>tx.insert(audienceImports).values({id:input.id,clientId,name:input.name,fingerprint:input.fingerprint,members:JSON.stringify(rows.map(c=>c.email)),stats:JSON.stringify(input.stats),mapping:JSON.stringify(input.mapping),kind:input.kind,createdAt:now}),
    tx=>tx.insert(campaignSettings).values({clientId,senderName:client.name,mapping:JSON.stringify(input.mapping),updatedAt:now}).onConflictDoUpdate({target:campaignSettings.clientId,set:{mapping:JSON.stringify(input.mapping),revision:sql`${campaignSettings.revision}+1`,updatedAt:now}})
   ]);return json({id:input.id,existing:false},201);
  }
  if(p.action==='settings'){
   const input=z.object({senderName:z.string().max(120),fromEmail:z.union([z.literal(''),z.string().email()]),replyTo:z.union([z.literal(''),z.string().email()]),reportDelay:z.number().int().min(1).max(30),senderVerified:z.boolean(),revision:z.number().int().nonnegative()}).parse(p);
   if(!input.revision){try{await db.insert(campaignSettings).values({clientId,...input,revision:1,updatedAt:now});}catch{return json({error:'Settings changed. Reload before saving.'},409);}}
   else{const updated=await db.update(campaignSettings).set({...input,revision:input.revision+1,updatedAt:now}).where(and(eq(campaignSettings.clientId,clientId),eq(campaignSettings.revision,input.revision))).returning();if(!updated.length)return json({error:'Settings changed. Reload before saving.'},409);}
   return json({ok:true});
  }
  if(p.action==='create'){
   const input=z.object({id,name,documentId:id}).parse(p);const doc=await db.select().from(documents).where(and(eq(documents.id,input.documentId),eq(documents.clientId,clientId),eq(documents.kind,'email'))).then(first);if(!doc)return json({error:'Choose a saved newsletter belonging to this client.'},400);
   const content=JSON.parse(doc.content),brand=JSON.parse(client.brand);const html=exportEmail(content,brand);const snapshot={content,brand,html,links:identifyLinks(html),sourceRevision:doc.revision,sourceTitle:doc.title};
   await db.insert(campaigns).values({id:input.id,clientId,documentId:doc.id,name:input.name,snapshot:JSON.stringify(snapshot),createdAt:now,updatedAt:now});return json({id:input.id},201);
  }
  if(p.action==='suppress'){
   const email=normalizeEmail(z.string().email().parse(p.email));const result=await db.update(contacts).set({status:'unsubscribed',updatedAt:now}).where(and(eq(contacts.clientId,clientId),eq(contacts.email,email))).returning();if(!result.length)return json({error:'Contact not found.'},404);return json({ok:true});
  }
  if(p.action==='preferenceLink'){
   const email=normalizeEmail(z.string().email().parse(p.email));const contact=await db.select().from(contacts).where(and(eq(contacts.clientId,clientId),eq(contacts.email,email))).then(first);if(!contact)return json({error:'Contact not found.'},404);
   const token=newToken();await db.insert(preferenceTokens).values({hash:await tokenHash(token),clientId,email,createdAt:now});return json({url:publicUrl(req,'/unsubscribe?t='+token)});
  }
  const campaignId=id.parse(p.campaignId);const campaign=await db.select().from(campaigns).where(and(eq(campaigns.id,campaignId),eq(campaigns.clientId,clientId))).then(first);if(!campaign)return json({error:'Campaign not found in this client workspace.'},404);
  if(p.action==='update'){
   const input=z.object({name,revision:z.number().int().positive(),audienceId:id.nullable(),plannedAt:z.string().datetime().nullable(),sentAt:z.string().datetime().nullable(),status:z.enum(['draft','ready'])}).parse(p);
   if(campaign.status==='reported')return json({error:'Reported campaigns retain their snapshot. Create a new campaign for another send.'},409);
   if(input.audienceId&&!await db.select().from(audienceImports).where(and(eq(audienceImports.id,input.audienceId),eq(audienceImports.clientId,clientId),eq(audienceImports.kind,'audience'))).then(first))return json({error:'Choose an audience belonging to this client.'},400);
   if(input.status==='ready'&&(!input.audienceId||!JSON.parse(campaign.snapshot).content.subject?.trim()))return json({error:'Add an audience and a newsletter subject before marking ready.'},400);
   const updated=await db.update(campaigns).set({...input,revision:input.revision+1,updatedAt:now}).where(and(eq(campaigns.id,campaignId),eq(campaigns.clientId,clientId),eq(campaigns.revision,input.revision))).returning();if(!updated.length)return json({error:'Campaign changed in another tab. Reload before saving.'},409);return json({ok:true});
  }
  if(['send','schedule'].includes(p.action))return json({error:'Live sending and scheduling are not enabled. No emails were sent or scheduled.'},409);
  if(p.action==='sendTest'){
   const input=z.object({recipients:z.array(z.string().max(254)).max(20)}).parse(p);
   const settings=await db.select().from(campaignSettings).where(eq(campaignSettings.clientId,clientId)).then(first);const delivery=deliveryStatus(settings);
   if(!delivery.enabled||!settings)return json({error:delivery.message},409);
   const snapshot=JSON.parse(campaign.snapshot);if(!snapshot.content.subject?.trim())return json({error:'Add a subject to the newsletter and create a new campaign before sending a test.'},400);
   const user=await getSessionUser(req);if(!user)return json({error:'Sign in to send a test email.'},401);
   const known=new Set((await db.select({email:contacts.email}).from(contacts).where(and(eq(contacts.clientId,clientId),inArray(contacts.email,input.recipients.map(normalizeEmail).filter(Boolean))))).map(c=>c.email));
   const parsed=parseTestRecipients(input.recipients,normalizeEmail(user.email),known,validEmail);if(parsed.error)return json({error:parsed.error},400);
   const since=new Date(Date.now()-3600000).toISOString();const recent=await db.select({n:sql<number>`count(*)::int`}).from(campaignTests).where(and(eq(campaignTests.campaignId,campaignId),gt(campaignTests.createdAt,since))).then(first);
   if((recent?.n||0)+parsed.recipients.length>TEST_LIMIT_PER_HOUR)return json({error:`This campaign is limited to ${TEST_LIMIT_PER_HOUR} test emails per hour. Try again later.`},429);
   const key=sendGridKey(),results:{email:string;status:'accepted'|'rejected';error:string}[]=[];
   for(const to of parsed.recipients){
    const urls=new Map<string,string>(),writes:Write[]=[];
    for(const link of snapshot.links){const token=newToken();urls.set(link.id,publicUrl(req,'/r/'+token));const hash=await tokenHash(token);writes.push(tx=>tx.insert(clickTokens).values({hash,clientId,campaignId,email:to,linkId:link.id,url:link.url,isTest:1}));}
    if(writes.length)await batch(db,writes);
    const sent=await sendTestMessage(key,buildTestMessage({from:settings.fromEmail,fromName:settings.senderName||client.name,replyTo:settings.replyTo,to,subject:snapshot.content.subject,html:buildTestHtml(snapshot.html,urls,client.name),campaignId}));
    const status=sent.ok?'accepted' as const:'rejected' as const;results.push({email:to,status,error:sent.error});
    await db.insert(campaignTests).values({id:crypto.randomUUID(),clientId,campaignId,email:to,sourceRevision:snapshot.sourceRevision,sentBy:normalizeEmail(user.email),status,error:sent.error,providerMessageId:sent.messageId,createdAt:new Date().toISOString()});
   }
   return json({results});
  }
  if(p.action==='previewRecipient'){
   const email=normalizeEmail(z.string().email().parse(p.email));const contact=await db.select().from(contacts).where(and(eq(contacts.clientId,clientId),eq(contacts.email,email))).then(first);if(!contact)return json({error:'Choose a contact in this client workspace.'},404);
   const snapshot=JSON.parse(campaign.snapshot);const writes:Write[]=[];const tokens=new Map<string,string>();
   for(const link of snapshot.links){const token=newToken();tokens.set(link.id,publicUrl(req,'/r/'+token));const hash=await tokenHash(token);writes.push(tx=>tx.insert(clickTokens).values({hash,clientId,campaignId,email,linkId:link.id,url:link.url,isTest:1}));}
   if(writes.length)await batch(db,writes);const html=rewriteLinks(snapshot.html,tokens).replace(/<\/body>/i,`<p style="text-align:center;font:12px Arial;padding:20px;color:#6b7280">Unsubscribe from ${escapeHtml(client.name)} marketing emails (live in sent emails only)</p></body>`);
   return json({html:html.replace(/<head>/i,'<head><base target="_blank">'),isTest:true,message:'Browser preview only. Clicks are marked as test activity. The unsubscribe link is not active in previews.'});
  }
  if(p.action==='importReport'){
   const cell=z.union([z.string().max(20000),z.number().finite(),z.boolean(),z.null()]);
   const event=z.object({id:z.string().max(150).optional(),email:z.string().max(254),fullName:z.string().max(250).optional(),event:z.string().max(80),url:z.string().max(4000).optional(),linkId:z.string().max(120).optional(),reason:z.string().max(4000).optional(),bounceType:z.string().max(100).optional(),timestamp:z.string().max(100),raw:z.record(z.unknown()).optional()});
   const input=z.object({id,fingerprint:z.string().length(64),source:z.string().max(250),cutoff:z.string().datetime(),timezone:z.string().min(1).max(100),data:z.object({stats:z.record(z.number().nonnegative().nullable()),events:z.array(event).max(15000),notes:z.array(z.string().max(1000)).max(100),rawSheets:z.array(z.object({name:z.string().max(100),rows:z.array(z.array(cell).max(100)).max(15001),dates:z.array(z.object({row:z.number().int().min(1).max(15001),column:z.number().int().min(1).max(100)})).max(100000).optional()})).max(30)})}).parse(p);
   const existing=await db.select().from(campaignReports).where(and(eq(campaignReports.campaignId,campaignId),eq(campaignReports.fingerprint,input.fingerprint))).then(first);if(existing)return json({id:existing.id,existing:true});
   const unsub=[...new Set(input.data.events.filter(e=>['unsubscribe','spamreport'].includes(e.event)&&validEmail(normalizeEmail(e.email))).map(e=>normalizeEmail(e.email)))];
   const writes:Write[]=[tx=>tx.insert(campaignReports).values({id:input.id,clientId,campaignId,fingerprint:input.fingerprint,source:input.source,cutoff:input.cutoff,timezone:input.timezone,data:JSON.stringify(input.data),createdAt:now}),tx=>tx.update(campaigns).set({status:'reported',revision:sql`${campaigns.revision}+1`,updatedAt:now}).where(and(eq(campaigns.id,campaignId),eq(campaigns.clientId,clientId)))];
   if(unsub.length)writes.push(tx=>markUnsubscribed(tx,clientId,unsub,now));
   await batch(db,writes);return json({id:input.id,existing:false},201);
  }
  return json({error:'Unknown campaign action.'},400);
 }catch(e){if(e instanceof z.ZodError)return json({error:e.errors.slice(0,3).map(v=>v.path.join('.')+': '+v.message).join('; ')},400);if(e instanceof SyntaxError)return json({error:'Invalid JSON.'},400);console.error('Campaign write failed');return json({error:'The change could not be saved. Refresh and try again.'},500);}
}
