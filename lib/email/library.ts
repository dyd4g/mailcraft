import type {Block} from './model';
export function belongsToLibrary(owner:string|null,clientId:string,team:boolean):boolean {
 return team ? owner===null : !!clientId && owner===clientId;
}
export function ownershipLabel(owner:string|null,name:string):string {
 return owner===null ? 'Team asset · Available to every client' : 'Owned by '+name;
}
export function brandingLabel(blocks:Block[]):string {
 let fixed=false,linked=false;
 const walk=(b:Block)=>{
  if(['header','footer'].includes(b.type))linked=true;
  for(const [key,value] of Object.entries(b.props))if(typeof value==='string'){
   if(/\{\{\w+\}\}/.test(value))linked=true;
   if((['src','link'].includes(key)&&/^https?:/.test(value))||/hyundai|toyota/i.test(value))fixed=true;
  }
  b.children?.forEach(walk);
 };
 blocks.forEach(walk);
 return fixed?'Contains fixed content · Review for each client':linked?'Uses client branding':'Custom styling · Review before use';
}
