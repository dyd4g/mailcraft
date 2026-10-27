import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
const local=process.argv.includes('--local');
const origin=local?'http://127.0.0.1:5173':'https://mailcraft-studio.nifty-skunk-1607.chatgpt.site';
const website='https://www.hyundaiofmeridian.com/';
const offers=website+'service-offers/';
const schedule=website+'service/schedule-service/';
const imageRoot=origin+'/clients/hyundai-of-meridian/';
const logo='https://di-uploads-pod4.dealerinspire.com/hyundaiofmeridian/uploads/2025/12/IMG_2285-2-.jpeg';
let seq=0;
const block=(type,props,children)=>({id:'hyundai-block-'+(++seq),type,props,...(children?{children}:{})});
const text=(copy,size=15,color='#43536b',background='#ffffff',padding=20,align='left')=>block('text',{text:copy,fontSize:size,color,background,padding,align});
const button=(label,link,padding=20,align='left',surface='#ffffff')=>block('button',{text:label,link,background:'{{color}}',color:'{{onColor}}',surface,padding,align});
const image=(file,alt,offer)=>block('image',{src:imageRoot+file,alt,link:offers+'?utm_source=newsletter&utm_medium=email&utm_campaign=service_specials&utm_content='+offer,padding:0,background:'#ffffff'});
const group=(children,background='#ffffff')=>block('columns',{columns:1,padding:0,gap:0,stack:true,background},children);
const brand={name:'Hyundai of Meridian',logo,color:'#003b73',background:'#ffffff',font:'Arial, Helvetica, sans-serif',phone:'601-685-4070',website,address:'2001 MS-39 · Meridian, MS 39301',footer:'You are receiving this email because you opted in to receive service offers and updates from Hyundai of Meridian. Use the subscription preferences or unsubscribe link provided by your email platform.'};
const header=block('header',{background:'#ffffff',color:'#002c5f',padding:24,link:offers,text:'SERVICE SPECIALS'});
const featured=block('columns',{columns:2,gap:0,padding:14,stack:true,background:'#edf3f9'},[
 image('better-service-bundle.png','BETTER Bundle: oil and filter change, tire rotation, cabin filter or air filter, and fuel treatment — $169.99. Hyundai vehicles only.','better-bundle'),
 group([
   text('FEATURED SERVICE PACKAGE',11,'#39729e','#edf3f9',16),
   text('A better bundle.\nMore care in one visit.',26,'#002c5f','#edf3f9',16),
   text('Oil & filter change\nTire rotation\nCabin filter or air filter\nFuel treatment',15,'#43536b','#edf3f9',16),
   text('$169.99',36,'#002c5f','#edf3f9',16),
   text('Hyundai vehicles only.',12,'#63748a','#edf3f9',16),
   button('View bundle details',offers+'?utm_source=newsletter&utm_medium=email&utm_campaign=service_specials&utm_content=better-bundle',16,'left','#edf3f9')
 ],'#edf3f9')
]);
const couponRow=block('columns',{columns:2,gap:12,padding:14,stack:true,background:'#ffffff'},[
 group([image('full-synthetic-oil-change.png','Full Synthetic Oil Change — $69.99, up to 5 quarts. Protect your engine. Power every mile.','full-synthetic-oil-change'),text('Full Synthetic Oil Change',18,'#002c5f','#ffffff',14),text('$69.99 · Up to 5 quarts',16,'#43536b','#ffffff',14)]),
 group([image('good-service-bundle.png','GOOD Bundle: oil change and tire rotation — $84.99. Hyundai vehicles only.','good-bundle'),text('“GOOD” Bundle',18,'#002c5f','#ffffff',14),text('$84.99 · Oil change & tire rotation\nHyundai vehicles only.',16,'#43536b','#ffffff',14)])
]);
const content={subject:'Hyundai service offers: oil changes from $69.99',preheader:'Explore a $69.99 oil change, the $84.99 GOOD Bundle, and the $169.99 BETTER Bundle.',width:680,background:'#e9eef5',blocks:[
 header,
 block('hero',{eyebrow:'HYUNDAI OF MERIDIAN / SERVICE SPECIALS',eyebrowColor:'#c5d8ed',title:'A little care.\nMore miles ahead.',fontSize:44,titleColor:'#ffffff',textColor:'#dbe7f5',text:'Three service offers to help keep your Hyundai ready for the road.',background:'#002c5f',padding:36,align:'left'}),
 text('Give your next service visit a head start. Explore the offers below, choose the care that fits your vehicle, and schedule with the Hyundai of Meridian service team.',16,'#43536b','#ffffff',26),
 button('View all service offers',offers,24,'center'),
 featured,
 text('More ways to care for your Hyundai',25,'#002c5f','#ffffff',26),
 couponRow,
 text('Ready for your next service visit?',25,'#002c5f','#edf3f9',28,'center'),
 button('Schedule service',schedule,24,'center','#edf3f9'),
 text('Questions? Call 601-685-4070.\nSee offer details for complete terms and availability.',12,'#63748a','#edf3f9',20,'center'),
 block('footer',{background:'#002c5f',color:'#ffffff',padding:28})
]};
const pack={format:'mailcraft-client-pack-v1',client:{id:'hyundai-meridian',name:brand.name,brand},email:{id:'hyundai-meridian-service-specials',title:'Hyundai of Meridian — Service Specials',content},template:{id:'hyundai-meridian-service-template',name:'Hyundai of Meridian — Service Offers',metadata:{description:'Hyundai-branded newsletter with one featured service bundle and a responsive two-coupon row, based on the supplied offer artwork.',campaign:'Promotion',industry:'Automotive',style:'Image-led',tags:['Hyundai','service','coupons','oil change','Meridian']}},assets:[
 {id:'hyundai-logo',name:'Hyundai — official blue logo',url:logo},
 {id:'hyundai-synthetic-oil-coupon',name:'Full Synthetic Oil Change — $69.99',url:imageRoot+'full-synthetic-oil-change.png'},
 {id:'hyundai-better-bundle-coupon',name:'BETTER Bundle — $169.99',url:imageRoot+'better-service-bundle.png'},
 {id:'hyundai-good-bundle-coupon',name:'GOOD Bundle — $84.99',url:imageRoot+'good-service-bundle.png'}
],components:[{id:'hyundai-service-header',name:'Hyundai — service header',content:header},{id:'hyundai-featured-better-bundle',name:'Hyundai — featured BETTER Bundle',content:featured},{id:'hyundai-two-coupon-row',name:'Hyundai — two-coupon row',content:couponRow}]};
export const hyundaiPack=pack;
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){mkdirSync('outputs',{recursive:true});const path='outputs/hyundai-meridian-client-pack'+(local?'.local':'')+'.json';writeFileSync(path,JSON.stringify(pack,null,2));console.log(path);}

