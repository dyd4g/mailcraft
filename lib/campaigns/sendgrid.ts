// Pure helpers for test emails. This file must stay free of runtime imports so tests can load it alone.
export const MAX_TEST_RECIPIENTS=5;
export const TEST_LIMIT_PER_HOUR=10;
export type SendResult={ok:boolean;messageId:string;error:string};
const esc=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
export function parseTestRecipients(raw:string[],own:string,contacts:Set<string>,isValid:(email:string)=>boolean):{recipients:string[];error:string}{
 const recipients=[...new Set(raw.map(v=>v.trim().toLowerCase()).filter(Boolean))];const me=own.trim().toLowerCase();
 if(!recipients.length)return {recipients:[],error:'Enter at least one test address.'};
 if(recipients.length>MAX_TEST_RECIPIENTS)return {recipients:[],error:`Send to at most ${MAX_TEST_RECIPIENTS} addresses at a time.`};
 const bad=recipients.find(v=>!isValid(v));if(bad)return {recipients:[],error:`“${bad.slice(0,80)}” is not a valid email address.`};
 const contact=recipients.find(v=>v!==me&&contacts.has(v));if(contact)return {recipients:[],error:`${contact} is a contact of this client. Test emails go only to addresses outside the contact list, or to your own address.`};
 return {recipients,error:''};
}
/** Replaces the Nth http(s) anchor with its mapped tracking address; unmapped anchors keep their original link. */
export function rewriteLinks(html:string,urls:Map<string,string>):string{
 let n=0;return html.replace(/(<a\b[^>]*href=")([^"]+)(")/gi,(match,a:string,url:string,c:string)=>/^https?:\/\//i.test(url)?(urls.get('link-'+(++n))?a+urls.get('link-'+n)+c:match):match);
}
export function buildTestHtml(html:string,urls:Map<string,string>,clientName:string):string{
 const banner='<div style="background:#fff3cd;color:#5c4400;font:13px/1.5 Arial,sans-serif;padding:10px 16px;text-align:center">TEST EMAIL. Not sent to the audience. Links are recorded as test activity and the unsubscribe link is inactive.</div>';
 const footer=`<p style="text-align:center;font:12px Arial;padding:20px;color:#6b7280">Unsubscribe from ${esc(clientName)} marketing emails (live in sent emails only)</p>`;
 let out=rewriteLinks(html,urls);
 out=/<body[^>]*>/i.test(out)?out.replace(/<body[^>]*>/i,m=>m+banner):banner+out;
 return /<\/body>/i.test(out)?out.replace(/<\/body>/i,footer+'</body>'):out+footer;
}
export function htmlToText(html:string):string{
 return html.replace(/<(style|script|head)[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?>|<\/(p|div|tr|h[1-6]|li)>/gi,'\n').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/[ \t]+/g,' ').replace(/ ?\n ?/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
}
export function buildTestMessage(input:{from:string;fromName:string;replyTo:string;to:string;subject:string;html:string;campaignId:string}){
 return {
  personalizations:[{to:[{email:input.to}]}],
  from:{email:input.from,name:input.fromName||undefined},
  ...(input.replyTo?{reply_to:{email:input.replyTo}}:{}),
  subject:'[TEST] '+input.subject,
  content:[{type:'text/plain',value:htmlToText(input.html)||'Test email'},{type:'text/html',value:input.html}],
  // Our own redirect records test clicks, so provider tracking and unsubscribe footers stay off.
  tracking_settings:{click_tracking:{enable:false,enable_text:false},open_tracking:{enable:false},subscription_tracking:{enable:false}},
  categories:['mailcraft-test'],
  custom_args:{campaign_id:input.campaignId,test:'true'},
 };
}
function describeFailure(status:number,body:string):string{
 if(status===401||status===403)return 'SendGrid rejected the API key or its permission to send mail.';
 if(status===429)return 'SendGrid is rate limiting requests. Try again shortly.';
 if(status===400||status===413){try{const message=(JSON.parse(body) as {errors?:{message?:string}[]}).errors?.[0]?.message;if(message)return 'SendGrid: '+message.slice(0,300);}catch{/* fall through */}return 'SendGrid could not accept this message.';}
 if(status>=500)return 'SendGrid is temporarily unavailable.';
 return `SendGrid returned an unexpected response (${status}).`;
}
export async function sendTestMessage(apiKey:string,message:object,fetchImpl:typeof fetch=fetch):Promise<SendResult>{
 try{
  const res=await fetchImpl('https://api.sendgrid.com/v3/mail/send',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify(message),signal:AbortSignal.timeout(10000)});
  if(res.status===202)return {ok:true,messageId:res.headers.get('x-message-id')||'',error:''};
  return {ok:false,messageId:'',error:describeFailure(res.status,await res.text().catch(()=>''))};
 }catch{return {ok:false,messageId:'',error:'SendGrid could not be reached. Try again.'};}
}
