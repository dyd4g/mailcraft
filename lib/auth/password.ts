// Pure password helpers built on Web Crypto. Keep this file free of imports so tests can load it alone.
// Cloudflare Workers cap PBKDF2 at 100,000 iterations; the count is stored in each hash so it can be raised
// on a Node server and older hashes upgrade the next time their owner signs in.
export const PBKDF2_ITERATIONS=100000;
export const MIN_PASSWORD_LENGTH=12;
const COMMON=new Set(['password1234','passw0rd1234','123456789012','1234567890ab','qwertyuiop12','letmein12345','welcome12345','changeme1234','administrator','iloveyou1234']);
const b64=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes));
const unb64=(text:string)=>Uint8Array.from(atob(text),c=>c.charCodeAt(0));
async function derive(password:string,salt:Uint8Array,iterations:number){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password.normalize('NFKC')),'PBKDF2',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:salt as BufferSource,iterations},key,256));
}
export function equalConstantTime(a:string|Uint8Array,b:string|Uint8Array):boolean{
 const x=typeof a==='string'?new TextEncoder().encode(a):a,y=typeof b==='string'?new TextEncoder().encode(b):b;
 let diff=x.length^y.length;for(let i=0;i<Math.max(x.length,y.length);i++)diff|=(x[i]??0)^(y[i]??0);return diff===0;
}
export async function hashPassword(password:string,iterations=PBKDF2_ITERATIONS):Promise<string>{
 const salt=crypto.getRandomValues(new Uint8Array(16));return `pbkdf2$sha256$${iterations}$${b64(salt)}$${b64(await derive(password,salt,iterations))}`;
}
export async function verifyPassword(password:string,stored:string):Promise<boolean>{
 const [scheme,hash,iterations,salt,expected]=stored.split('$');const count=Number(iterations);
 if(scheme!=='pbkdf2'||hash!=='sha256'||!Number.isInteger(count)||count<1||!salt||!expected)return false;
 try{return equalConstantTime(await derive(password,unb64(salt),count),unb64(expected));}catch{return false;}
}
export const needsRehash=(stored:string)=>Number(stored.split('$')[2])<PBKDF2_ITERATIONS;
/** Returns an explanation when the password is not acceptable, or an empty string. */
export function validatePassword(password:string,email=''):string{
 if(password.length<MIN_PASSWORD_LENGTH)return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
 if(password.length>200)return 'Use at most 200 characters.';
 const lower=password.toLowerCase();
 if(COMMON.has(lower)||/^(.)\1+$/.test(password))return 'Choose a password that is harder to guess.';
 if(email&&(lower===email.toLowerCase()||lower.includes(email.split('@')[0].toLowerCase())&&email.split('@')[0].length>=6))return 'The password must not contain your email address.';
 return '';
}
/** 16 characters from an alphabet without look-alike characters, drawn without modulo bias. */
export function generatePassword():string{
 const alphabet='abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';const limit=256-(256%alphabet.length);let out='';
 while(out.length<16){for(const byte of crypto.getRandomValues(new Uint8Array(32))){if(byte<limit&&out.length<16)out+=alphabet[byte%alphabet.length];}}
 return out;
}
