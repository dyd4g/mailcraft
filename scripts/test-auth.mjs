// Password rules, plus the full sign-in flow against a local copy of the app when MAILCRAFT_QA_ADMIN_EMAIL
// and MAILCRAFT_QA_ADMIN_PASSWORD point at an administrator account (the flow creates and removes nothing permanent:
// it creates a throwaway member, deactivates it at the end and leaves it deactivated).
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const code=ts.transpileModule(readFileSync('lib/auth/password.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const p=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const hash=await p.hashPassword('correct horse battery');
assert.match(hash,/^pbkdf2\$sha256\$100000\$/);assert.notEqual(hash,await p.hashPassword('correct horse battery'));
assert.equal(await p.verifyPassword('correct horse battery',hash),true);assert.equal(await p.verifyPassword('correct horse batterz',hash),false);
assert.equal(await p.verifyPassword('x','not a hash'),false);assert.equal(await p.verifyPassword('x',''),false);
assert.equal(p.needsRehash(await p.hashPassword('abcdefghijkl',1000)),true);assert.equal(p.needsRehash(hash),false);
assert.equal(await p.verifyPassword('abcdefghijkl',await p.hashPassword('abcdefghijkl',1000)),true);
assert.match(p.validatePassword('short'),/at least 12/);assert.match(p.validatePassword('password1234'),/harder to guess/);assert.match(p.validatePassword('aaaaaaaaaaaaaa'),/harder to guess/);
assert.match(p.validatePassword('jordanlee@example.com1','jordanlee@example.com'),/email/);assert.equal(p.validatePassword('a long unusual passphrase','x@example.com'),'');
const generated=new Set();for(let i=0;i<50;i++){const g=p.generatePassword();assert.equal(g.length,16);assert.match(g,/^[a-km-zA-HJ-NP-Z2-9]+$/);generated.add(g);}assert.equal(generated.size,50);
assert.equal(p.equalConstantTime('abc','abc'),true);assert.equal(p.equalConstantTime('abc','abd'),false);assert.equal(p.equalConstantTime('abc','abcd'),false);
console.log('PASS: password hashing, verification, upgrade detection, policy and temporary password generation.');
const base='http://127.0.0.1:5173',adminEmail=process.env.MAILCRAFT_QA_ADMIN_EMAIL,adminPassword=process.env.MAILCRAFT_QA_ADMIN_PASSWORD;
if(!adminEmail||!adminPassword){console.log('SKIPPED: set MAILCRAFT_QA_ADMIN_EMAIL and MAILCRAFT_QA_ADMIN_PASSWORD to run the sign-in flow against the local app.');process.exit(0);}
const cookieOf=res=>res.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
const post=(path,body,cookie='',origin=base)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});
const get=(path,cookie='')=>fetch(base+path,{headers:cookie?{Cookie:cookie}:{}});
// Closed by default.
for(const path of ['/api/studio','/api/campaigns?clientId=toyota-meridian','/api/users'])assert.equal((await get(path)).status,401);
assert.equal((await post('/api/users',{action:'create'})).status,401);
assert.equal((await post('/api/auth',{action:'login',email:adminEmail,password:'wrong password here'})).status,401);
assert.equal((await post('/api/auth',{action:'login',email:'nobody@example.com',password:'wrong password here'})).status,401);
assert.equal((await post('/api/auth',{action:'login',email:adminEmail,password:adminPassword},'','https://evil.example')).status,403);
const login=await post('/api/auth',{action:'login',email:adminEmail,password:adminPassword});assert.equal(login.status,200);
const setCookie=login.headers.getSetCookie()[0];assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Lax/);
const admin=cookieOf(login);assert.ok(!JSON.stringify(await (await get('/api/users',admin)).json()).includes('pbkdf2'));
// Admin creates a member; the member must change the temporary password before using anything.
const email='qa-member-'+crypto.randomUUID().slice(0,8)+'@example.com';
assert.equal((await post('/api/users',{action:'create',email,name:'QA Member',role:'member'},admin,'https://evil.example')).status,403);
const made=await post('/api/users',{action:'create',email,name:'QA Member',role:'member'},admin);assert.equal(made.status,201);const created=await made.json();assert.equal(created.temporaryPassword.length,16);
assert.equal((await post('/api/users',{action:'create',email:email.toUpperCase(),name:'Dup',role:'member'},admin)).status,409);
const temp=await post('/api/auth',{action:'login',email,password:created.temporaryPassword});assert.equal(temp.status,200);const member=cookieOf(temp);
assert.equal((await get('/api/studio',member)).status,403);assert.equal((await get('/api/users',member)).status,403);
assert.equal((await post('/api/auth',{action:'changePassword',currentPassword:created.temporaryPassword,newPassword:'short'},member)).status,400);
assert.equal((await post('/api/auth',{action:'changePassword',currentPassword:'not the password',newPassword:'a brand new passphrase'},member)).status,400);
assert.equal((await post('/api/auth',{action:'changePassword',currentPassword:created.temporaryPassword,newPassword:'a brand new passphrase'},member)).status,200);
assert.equal((await get('/api/studio',member)).status,200);assert.equal((await get('/api/users',member)).status,403);
assert.equal((await post('/api/users',{action:'update',id:created.user.id,role:'admin'},member)).status,403);
// Administrators cannot lock everyone out.
const list=await (await get('/api/users',admin)).json();assert.equal((await post('/api/users',{action:'update',id:list.currentUserId,active:false},admin)).status,409);assert.equal((await post('/api/users',{action:'update',id:list.currentUserId,role:'member'},admin)).status,409);
// Five wrong passwords lock the account, even for the right password, until an administrator resets it.
for(let i=0;i<5;i++)assert.equal((await post('/api/auth',{action:'login',email,password:'wrong password '+i}) ).status,401);
assert.equal((await post('/api/auth',{action:'login',email,password:'a brand new passphrase'})).status,429);
const reset=await post('/api/users',{action:'resetPassword',id:created.user.id},admin);assert.equal(reset.status,200);const resetPassword=(await reset.json()).temporaryPassword;
assert.equal((await get('/api/studio',member)).status,401);
assert.equal((await post('/api/auth',{action:'login',email,password:resetPassword})).status,200);
// Deactivation ends sessions and blocks sign-in.
const again=cookieOf(await post('/api/auth',{action:'login',email,password:resetPassword}));
assert.equal((await post('/api/users',{action:'update',id:created.user.id,active:false},admin)).status,200);
assert.equal((await get('/api/auth',again).then(r=>r.json())).user,null);assert.equal((await post('/api/auth',{action:'login',email,password:resetPassword})).status,401);
// Sign out ends the session; first-time setup stays closed once accounts exist.
const out=await post('/api/auth',{action:'logout'},admin);assert.equal(out.status,200);assert.equal((await get('/api/users',admin)).status,401);
assert.equal((await post('/api/auth',{action:'setup',token:'x',email:'x@example.com',name:'X',password:'a long unusual passphrase'})).status,409);
// Recipient-facing pages stay public.
assert.equal((await get('/unsubscribe?t=bad')).status,404);assert.equal((await get('/r/bad')).status,404);
console.log('PASS: closed by default, same-origin writes, administrator-only user management, forced password change, lockout and reset, deactivation, sign out, last-administrator protection and public recipient pages.');
