export async function tokenHash(value:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function newToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');}
