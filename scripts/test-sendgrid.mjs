import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('lib/campaigns/sendgrid.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const s=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const valid=v=>/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(v);
const contacts=new Set(['customer@example.com','staff@dyd.com']);

// Recipient rules: contacts are blocked, except the signed-in staff member's own address.
assert.deepEqual(s.parseTestRecipients(['Tester@Example.com',' tester@example.com ','qa@dyd.org'],'staff@dyd.com',contacts,valid),{recipients:['tester@example.com','qa@dyd.org'],error:''});
assert.match(s.parseTestRecipients(['customer@example.com'],'staff@dyd.com',contacts,valid).error,/contact of this client/);
assert.equal(s.parseTestRecipients(['STAFF@dyd.com'],'staff@dyd.com',contacts,valid).error,'');
assert.match(s.parseTestRecipients([],'staff@dyd.com',contacts,valid).error,/at least one/);
assert.match(s.parseTestRecipients(['nope'],'staff@dyd.com',contacts,valid).error,/not a valid email/);
assert.match(s.parseTestRecipients(['a@x.io','b@x.io','c@x.io','d@x.io','e@x.io','f@x.io'],'me@dyd.com',new Set(),valid).error,/at most 5/);
assert.equal(s.parseTestRecipients(['a@x.io','a@x.io','A@x.io'],'me@dyd.com',new Set(),valid).recipients.length,1);

// Test HTML: tracked links, banner, inactive unsubscribe, untouched non-http links.
const html='<html><body style="margin:0"><a href="https://a.example/">One</a><a href="tel:123">Call</a><a href="https://b.example/">Two</a></body></html>';
const urls=new Map([['link-1','https://studio.example/r/t1'],['link-2','https://studio.example/r/t2']]);
const out=s.buildTestHtml(html,urls,'Toyota <of> Meridian');
assert.ok(out.includes('https://studio.example/r/t1')&&out.includes('https://studio.example/r/t2'));
assert.ok(out.includes('href="tel:123"')&&!out.includes('https://a.example/'));
assert.ok(out.indexOf('TEST EMAIL')>out.indexOf('<body')&&out.indexOf('TEST EMAIL')<out.indexOf('One'));
assert.ok(!out.includes('/unsubscribe')&&out.includes('Toyota &lt;of&gt; Meridian'));
assert.ok(s.buildTestHtml('<p><a href="https://a.example/">x</a></p>',new Map(),'C').includes('https://a.example/'));
assert.ok(s.buildTestHtml('<p>no body</p>',new Map(),'C').startsWith('<div'));

// Message: subject prefix, provider tracking off, no key material.
const msg=s.buildTestMessage({from:'news@client.com',fromName:'Client',replyTo:'',to:'qa@dyd.org',subject:'October',html:out,campaignId:'c1'});
assert.equal(msg.subject,'[TEST] October');assert.equal(msg.tracking_settings.subscription_tracking.enable,false);assert.equal(msg.tracking_settings.click_tracking.enable,false);
assert.equal(msg.content[0].type,'text/plain');assert.ok(msg.content[0].value.includes('One'));assert.ok(!('reply_to' in msg));
assert.deepEqual(msg.personalizations[0].to,[{email:'qa@dyd.org'}]);

// Provider calls against a fake SendGrid.
const fake=(status,body='',headers={})=>async(url,init)=>{fake.last={url,init};return new Response(body,{status,headers});};
let r=await s.sendTestMessage('SG.secret',msg,fake(202,'',{'x-message-id':'abc123'}));
assert.deepEqual(r,{ok:true,messageId:'abc123',error:''});
assert.equal(fake.last.url,'https://api.sendgrid.com/v3/mail/send');assert.equal(fake.last.init.headers.Authorization,'Bearer SG.secret');assert.equal(JSON.parse(fake.last.init.body).subject,'[TEST] October');
r=await s.sendTestMessage('SG.secret',msg,fake(400,JSON.stringify({errors:[{message:'The from address does not match a verified Sender Identity.'}]})));
assert.equal(r.ok,false);assert.match(r.error,/verified Sender Identity/);
for(const [status,pattern] of [[401,/API key/],[403,/API key/],[429,/rate limiting/],[503,/temporarily unavailable/],[418,/unexpected response \(418\)/]]){r=await s.sendTestMessage('SG.secret',msg,fake(status,'{"errors":[{"message":"SG.secret leaked"}]}'));assert.match(r.error,pattern);assert.ok(!r.error.includes('SG.secret'));}
r=await s.sendTestMessage('SG.secret',msg,async()=>{throw new Error('connect ECONNREFUSED with SG.secret');});assert.match(r.error,/could not be reached/);assert.ok(!r.error.includes('SG.secret'));
console.log('PASS: test recipients, contact blocking with own-address exception, tracked-link rewriting, test banner, inactive unsubscribe, subject prefix, provider tracking off, and SendGrid success/failure handling without exposing the key.');
