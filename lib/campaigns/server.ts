import {env} from 'cloudflare:workers';
import {json,requireUser} from '@/lib/auth/session';
export {json};
export {tokenHash,newToken} from '@/lib/auth/token';
export const sendGridKey=()=>env.SENDGRID_API_KEY?.trim()||'';
/** Null when the request comes from a signed-in, active team member; otherwise the response to send. */
export async function authorize(req:Request,write=false){
 const auth=await requireUser(req,{write});return auth.denied||null;
}
