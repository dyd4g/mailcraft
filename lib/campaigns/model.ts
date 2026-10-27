import type {Brand,EmailContent} from '../email/model';
export type Contact={clientId:string;email:string;firstName:string;lastName:string;fields:Record<string,string>;status:string;updatedAt:string};
export type Mapping={email:string;firstName:string;lastName:string;extra:string[]};
export type ImportStats={rows:number;valid:number;invalid:number;duplicates:number;unique:number};
export type Audience={id:string;clientId:string;name:string;members:string[];stats:ImportStats;mapping:Mapping;kind:string;createdAt:string};
export type CampaignLink={id:string;label:string;url:string;placement:number};
export type Snapshot={content:EmailContent;brand:Brand;html:string;links:CampaignLink[];sourceRevision:number;sourceTitle:string};
export type Campaign={id:string;clientId:string;documentId:string|null;name:string;snapshot:Snapshot;audienceId:string|null;status:string;plannedAt:string|null;sentAt:string|null;revision:number;createdAt:string;updatedAt:string};
export type Settings={clientId:string;senderName:string;fromEmail:string;replyTo:string;mapping:Mapping;reportDelay:number;senderVerified:boolean;revision:number;updatedAt:string};
export type CampaignTest={id:string;campaignId:string;email:string;sourceRevision:number;sentBy:string;status:'accepted'|'rejected';error:string;providerMessageId:string;createdAt:string};
export type EventRow={id?:string;campaignId?:string;email:string;fullName?:string;event:string;url?:string;linkId?:string;reason?:string;bounceType?:string;timestamp:string;isTest?:number;raw?:Record<string,unknown>};
export type ReportData={stats:Record<string,number|null>;events:EventRow[];notes:string[];rawSheets?:{name:string;rows:(string|number|boolean|null)[][];dates?:{row:number;column:number}[]}[]};
export type Report={id:string;clientId:string;campaignId:string;source:string;cutoff:string;timezone:string;data:ReportData;createdAt:string};
export type CampaignData={contacts:Contact[];audiences:Audience[];campaigns:Campaign[];reports:Report[];settings:Settings|null;events:EventRow[];tests:CampaignTest[];staffEmail:string;delivery:{connected:boolean;enabled:boolean;message:string}};
export const emptyMapping:Mapping={email:'',firstName:'',lastName:'',extra:[]};
export const normalizeEmail=(v:unknown)=>String(v??'').trim().toLowerCase();
export const validEmail=(v:string)=>v.length<=254&&/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
export function parseCSV(text:string):string[][]{
 const rows:string[][]=[];let row:string[]=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else if(quoted||!cell)quoted=!quoted;else cell+=c;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quoted)throw new Error('The CSV contains an unclosed quoted field.');
 row.push(cell);if(row.some(v=>v.trim()))rows.push(row);return rows;
}
export function detectHeader(rows:string[][]):number{
 const found=rows.slice(0,20).findIndex(r=>r.some(v=>/^(e[ -]?mail(?: address)?|emailaddress)$/i.test(v.trim())));
 return found>=0?found:rows.slice(0,20).findIndex(r=>r.filter(v=>v.trim()).length>1);
}
export function suggestMapping(headers:string[],saved?:Mapping):Mapping{
 const match=(pattern:RegExp)=>headers.find(h=>pattern.test(h))||'';
 return {email:headers.includes(saved?.email||'')?saved!.email:match(/^e[ -]?mail(?: address)?$/i),firstName:headers.includes(saved?.firstName||'')?saved!.firstName:match(/^first[ _]?name$/i),lastName:headers.includes(saved?.lastName||'')?saved!.lastName:match(/^last[ _]?name$/i),extra:(saved?.extra||[]).filter(h=>headers.includes(h))};
}
export function prepareContacts(headers:string[],rows:string[][],mapping:Mapping){
 if(!mapping.email||!headers.includes(mapping.email))throw new Error('Map an email address column.');
 const used=[mapping.email,mapping.firstName,mapping.lastName,...mapping.extra].filter(Boolean);
 if(new Set(used).size!==used.length)throw new Error('Map each source column only once.');
 if(mapping.extra.length>12)throw new Error('Select up to 12 extra fields.');
 const list=new Map<string,{email:string;firstName:string;lastName:string;fields:Record<string,string>}>();let invalid=0,duplicates=0;
 const value=(r:string[],h:string)=>h?String(r[headers.indexOf(h)]??'').trim():'';
 for(const row of rows){const email=normalizeEmail(value(row,mapping.email));if(!validEmail(email)){invalid++;continue;}const contact={email,firstName:value(row,mapping.firstName).slice(0,120),lastName:value(row,mapping.lastName).slice(0,120),fields:Object.fromEntries(mapping.extra.map(h=>[h,value(row,h).slice(0,500)]))};if(list.has(email))duplicates++;else list.set(email,contact);}
 return {contacts:[...list.values()],stats:{rows:rows.length,valid:rows.length-invalid,invalid,duplicates,unique:list.size}};
}
export function identifyLinks(html:string):CampaignLink[]{
 const links:CampaignLink[]=[];let placement=0;
 for(const m of html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)){
  const url=m[1].replace(/&amp;/g,'&');if(!/^https?:\/\//i.test(url))continue;
  const label=(m[2].replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi,'$1').replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim()||'Image link').slice(0,160);
  links.push({id:'link-'+(++placement),label,url,placement});
 }return links;
}
export function reportMetrics(data:ReportData){
 const s=data.stats;const rate=(a:number|null|undefined,b:number|null|undefined)=>a!=null&&b!=null&&b>0?a/b:null;
 const clicks=data.events.filter(e=>e.event==='click');const bounces=data.events.filter(e=>e.event==='bounce');
 const warnings=[...data.notes];
 if(s.sent!=null&&s.delivered!=null&&s.bounced!=null&&s.dropped!=null){const n=s.sent-s.delivered-s.bounced-s.dropped;if(n)warnings.push(`${n} send(s) are not reconciled by delivered, bounced and dropped totals.`);}
 if(s.bounced!=null&&s.bounced!==bounces.length)warnings.push(`Summary has ${s.bounced} bounces; detail contains ${bounces.length}.`);
 const uniqueClicks=new Set(clicks.map(e=>normalizeEmail(e.email))).size;
 if(s.clicked!=null&&s.clicked!==uniqueClicks)warnings.push(`Summary has ${s.clicked} clickers; click detail contains ${uniqueClicks} distinct addresses.`);
 const grouped=new Map<string,{url:string;label:string;clicks:number;recipients:Set<string>}>();
 for(const e of clicks){const key=e.linkId||e.url||'unknown';const g=grouped.get(key)||{url:e.url||'',label:e.linkId||e.url||'Unknown destination',clicks:0,recipients:new Set<string>()};g.clicks++;g.recipients.add(normalizeEmail(e.email));grouped.set(key,g);}
 return {rates:{delivered:rate(s.delivered,s.sent),opened:rate(s.opened,s.delivered),clicked:rate(s.clicked,s.delivered),bounced:rate(s.bounced,s.sent),unsubscribed:rate(s.unsubscribed,s.delivered),ctor:rate(s.clicked,s.opened)},links:[...grouped.values()].map(g=>({...g,unique:g.recipients.size,recipients:undefined})).sort((a,b)=>b.clicks-a.clicks),rawClicks:clicks.length,uniqueClicks,warnings};
}
