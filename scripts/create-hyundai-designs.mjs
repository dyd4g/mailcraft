import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const origin=process.argv.includes('--local')?'http://127.0.0.1:5173':'https://mailcraft-studio.nifty-skunk-1607.chatgpt.site';
const root=origin+'/clients/hyundai-of-meridian/';
const offers='https://www.hyundaiofmeridian.com/service-offers/';
const schedule='https://www.hyundaiofmeridian.com/service/schedule-service/';
let seq=0;
const b=(type,props,children)=>({id:'hyundai-variant-'+(++seq),type,props,...(children?{children}:{})});
const t=(text,fontSize=16,color='#263b51',background='#ffffff',padding=24,align='left')=>b('text',{text,fontSize,color,background,padding,align});
const cta=(text,link=offers,surface='#ffffff',background='#002c5f',color='#ffffff',align='left',padding=24)=>b('button',{text,link,surface,background,color,align,padding});
const group=(children,background='#ffffff')=>b('columns',{columns:1,padding:0,gap:0,stack:true,background},children);
const row=(children,background='#ffffff',padding=16,gap=12)=>b('columns',{columns:children.length,padding,gap,stack:true,background},children);
const img=(file,alt,bg='#ffffff',padding=0)=>b('image',{src:root+file,alt,link:offers,background:bg,padding});
const hero=(title,text,background,titleColor,padding=36,fontSize=48,eyebrow='',align='left',textColor=titleColor)=>b('hero',{title,text,background,titleColor,textColor,padding,fontSize,eyebrow,eyebrowColor:textColor,align});
const header=(label)=>b('header',{background:'#ffffff',color:'#002c5f',padding:24,link:offers,text:label});
const footer=(bg='#002c5f',color='#ffffff')=>b('footer',{background:bg,color,padding:28});
const divider=(color='#dce2e8',padding=20)=>b('divider',{color,padding,background:'#ffffff'});
const oil=()=>img('full-synthetic-oil-change.png','Full Synthetic Oil Change — $69.99. Up to 5 quarts.');
const good=()=>img('good-service-bundle.png','GOOD Bundle — $84.99. Oil change and tire rotation. Hyundai vehicles only.');
const better=()=>img('better-service-bundle.png','BETTER Bundle — $169.99. Oil & filter change, tire rotation, cabin filter or air filter, and fuel treatment. Hyundai vehicles only.');
const terms='See offer details for complete terms and availability. Questions? Call 601-685-4070.';
const base=(subject,preheader,background,blocks,font='Arial, Helvetica, sans-serif')=>({subject,preheader,width:680,background,design:{color:'#002c5f',font},blocks});
const editorial=base('The Service Journal | Care for the miles ahead','Three service offers from Hyundai of Meridian, starting at $69.99.','#e9e5dc',[
 header('THE SERVICE JOURNAL'),
 t('HYUNDAI OF MERIDIAN  /  SERVICE & CARE',11,'#76684f','#f6f2e9',28),
 hero('Good care.\nA longer story.','Every mile has a next chapter. Make regular maintenance part of yours.','#f6f2e9','#102c48',36,50,'THE SERVICE JOURNAL'),
 row([group([t('01 / THE ESSENTIAL',11,'#76684f','#f6f2e9',20),t('Start with fresh oil.',30,'#102c48','#f6f2e9',20),t('Full Synthetic Oil Change\n$69.99 · Up to 5 quarts',20,'#102c48','#f6f2e9',20),cta('Explore the oil change offer',offers,'#f6f2e9','#102c48','#ffffff','left',20)],'#f6f2e9'),oil()],'#f6f2e9',16,4),
 t('More care, in one visit.',32,'#102c48','#ffffff',30),
 t('Choose a service bundle that fits your next visit. Both packages below are for Hyundai vehicles only.',16,'#526174','#ffffff',24),
 row([good(),group([t('02 / THE GOOD BUNDLE',11,'#76684f','#ffffff',18),t('Fresh oil. Even tire wear.',26,'#102c48','#ffffff',18),t('$84.99',36,'#102c48','#ffffff',18),t('Oil change & tire rotation.\nHyundai vehicles only.',15,'#526174','#ffffff',18),cta('View GOOD Bundle',offers,'#ffffff','#102c48','#ffffff','left',18)])],'#ffffff',16,8),
 divider('#d8cdbb'),
 row([group([t('03 / THE BETTER BUNDLE',11,'#76684f','#ffffff',18),t('A little extra attention.',26,'#102c48','#ffffff',18),t('$169.99',36,'#102c48','#ffffff',18),t('Oil & filter change, tire rotation, cabin filter or air filter, and fuel treatment.\nHyundai vehicles only.',15,'#526174','#ffffff',18),cta('View BETTER Bundle',offers,'#ffffff','#102c48','#ffffff','left',18)]),better()],'#ffffff',16,8),
 t('Make time for the next mile.',30,'#102c48','#f6f2e9',30,'center'),cta('Plan your service visit',schedule,'#f6f2e9','#102c48','#ffffff','center'),t(terms,12,'#526174','#f6f2e9',24,'center'),footer('#102c48')
],'Georgia, Times New Roman, serif');
const bold=base('Service savings start at $69.99','Oil change, GOOD Bundle, or BETTER Bundle — choose your service offer.','#001b3c',[
 header('SERVICE SAVINGS'),
 hero('BIG CARE.\nSMART SAVINGS.','Three ways to give your Hyundai the attention it deserves.','#002c5f','#ffffff',36,52,'HYUNDAI OF MERIDIAN','left','#d4e5f5'),
 t('FULL SYNTHETIC OIL CHANGE',13,'#002c5f','#b8edf4',24,'center'),
 hero('$69.99','Up to 5 quarts. Protect your engine. Power every mile.','#b8edf4','#002c5f',20,64,'FEATURED OFFER','center'),
 cta('Get the oil change offer',offers,'#b8edf4','#002c5f','#ffffff','center',24),
 row([oil(),group([t('KEEP YOUR NEXT MILE MOVING.',30,'#002c5f','#ffffff',22),t('Explore the full synthetic oil change offer, or add more care with one of our service bundles.',17,'#36516f','#ffffff',22),cta('See all service offers',offers,'#ffffff','#002c5f','#ffffff','left',22)])],'#ffffff',16,4),
 t('CHOOSE YOUR BUNDLE',28,'#ffffff','#002c5f',28,'center'),
 row([group([t('GOOD',13,'#002c5f','#e8f4fa',20),t('$84.99',40,'#002c5f','#e8f4fa',20),t('Oil change & tire rotation.\nHyundai vehicles only.',16,'#294966','#e8f4fa',20),good(),cta('Get GOOD Bundle',offers,'#e8f4fa','#002c5f','#ffffff','center',20)],'#e8f4fa'),group([t('BETTER',13,'#002c5f','#b8edf4',20),t('$169.99',40,'#002c5f','#b8edf4',20),t('Oil & filter change, tire rotation, cabin filter or air filter, and fuel treatment.\nHyundai vehicles only.',16,'#294966','#b8edf4',20),better(),cta('Get BETTER Bundle',offers,'#b8edf4','#002c5f','#ffffff','center',20)],'#b8edf4')],'#002c5f',12,12),
 hero('Your next stop:\ngreat service.','Choose your offer. Book your visit. We’ll take it from there.','#002c5f','#ffffff',32,36,'','center','#d4e5f5'),cta('Schedule service',schedule,'#002c5f','#b8edf4','#002c5f','center'),t(terms,12,'#d4e5f5','#002c5f',24,'center'),footer('#001b3c')
]);
const minimal=base('Your Hyundai service menu','Simple choices for your next service visit: $69.99, $84.99, and $169.99.','#f1f3f5',[
 header('YOUR SERVICE MENU'),divider('#e2e7ed',24),
 hero('Care, made simple.','Three clear choices. One convenient place for your next service visit.','#ffffff','#002c5f',40,44,'HYUNDAI OF MERIDIAN'),
 t('01  /  EVERYDAY ESSENTIAL',11,'#687789','#ffffff',24),
 row([group([t('Full Synthetic\nOil Change',28,'#002c5f','#ffffff',16),t('$69.99',36,'#002c5f','#ffffff',16),t('Up to 5 quarts.',16,'#687789','#ffffff',16),cta('View offer',offers,'#ffffff','#002c5f','#ffffff','left',16)]),oil()],'#ffffff',16,20),
 divider('#e2e7ed',24),t('02  /  TWO SERVICES, ONE VISIT',11,'#687789','#ffffff',24),
 row([group([t('“GOOD” Bundle',28,'#002c5f','#ffffff',16),t('$84.99',36,'#002c5f','#ffffff',16),t('Oil change & tire rotation.\nHyundai vehicles only.',16,'#687789','#ffffff',16),cta('View bundle',offers,'#ffffff','#002c5f','#ffffff','left',16)]),good()],'#ffffff',16,20),
 divider('#e2e7ed',24),t('03  /  MORE CARE IN ONE PACKAGE',11,'#687789','#ffffff',24),
 row([group([t('“BETTER” Bundle',28,'#002c5f','#ffffff',16),t('$169.99',36,'#002c5f','#ffffff',16),t('Oil & filter change\nTire rotation\nCabin filter or air filter\nFuel treatment\n\nHyundai vehicles only.',15,'#687789','#ffffff',16),cta('View bundle',offers,'#ffffff','#002c5f','#ffffff','left',16)]),better()],'#ffffff',16,20),
 divider('#e2e7ed',24),t('Ready when you are.',26,'#002c5f','#f4f7fa',30,'center'),cta('Schedule your visit',schedule,'#f4f7fa','#002c5f','#ffffff','center'),t(terms,12,'#687789','#f4f7fa',24,'center'),footer('#ffffff','#526174')
]);
const designs=[['editorial','The Service Journal',editorial,'Editorial','A warm editorial newsletter with serif headlines and alternating service features.'],['bold','Smart Savings',bold,'Bold','High-impact navy and cyan promotion with a featured oil-change price and side-by-side bundle cards.'],['minimal','Care, Made Simple',minimal,'Minimal','A quiet service menu with numbered offers, generous space, and clear prices.']].map(([slug,name,content,style,description])=>({id:'hyundai-meridian-'+slug,title:'Hyundai — '+name,content,template:{id:'hyundai-meridian-'+slug+'-template',name:'Hyundai — '+name,metadata:{description,campaign:'Promotion',industry:'Automotive',style,tags:['Hyundai','service','coupons',slug]}}}));
export const hyundaiDesignPack={format:'mailcraft-design-pack-v1',clientId:'hyundai-meridian',designs};
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){mkdirSync('outputs',{recursive:true});const path='outputs/hyundai-design-pack'+(process.argv.includes('--local')?'.local':'')+'.json';writeFileSync(path,JSON.stringify(hyundaiDesignPack,null,2));console.log(path);}
