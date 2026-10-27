import {defaultBrand,cloneBlock,type Block,type Brand,type EmailContent,type TemplateMetadata,type SavedTemplate} from './model';
export type GalleryTemplate={id:string;version:number;clientId:string|null;name:string;content:EmailContent;metadata:TemplateMetadata;previewBrand:Brand;source:'starter'|'shared'|'client'|'legacy';updatedAt?:string};
export const campaigns=['Newsletter','Promotion','Announcement','Event'];
export const industries=['Any industry','Automotive','Retail','Professional services'];
export const designStyles=['Minimal','Editorial','Bold','Image-led'];
export function effectiveBrand(content:EmailContent,brand:Brand):Brand{return {...brand,...content.design};}
export function instantiateTemplate(template:GalleryTemplate,brand:Brand,useClientBrand=true):EmailContent {
  const content:EmailContent={...structuredClone(template.content),blocks:template.content.blocks.map(cloneBlock)};
  if(useClientBrand)delete content.design;else content.design={color:template.previewBrand.color,font:template.previewBrand.font};
  return content;
}
export function filterTemplates(items:GalleryTemplate[],filters:{query:string;campaign:string;industry:string;style:string;library:string}):GalleryTemplate[]{
  const q=filters.query.trim().toLocaleLowerCase();return items.filter(t=>
    (!q||[t.name,t.metadata.description,...t.metadata.tags,t.metadata.campaign,t.metadata.industry,t.metadata.style].join(' ').toLocaleLowerCase().includes(q))&&
    (filters.campaign==='all'||t.metadata.campaign===filters.campaign)&&
    (filters.industry==='all'||t.metadata.industry===filters.industry||t.metadata.industry==='Any industry')&&
    (filters.style==='all'||t.metadata.style===filters.style)&&
    (filters.library==='all'||t.source===filters.library||(filters.library==='client'&&t.source==='legacy')));
}
export function latestTemplates(versions:SavedTemplate[],clientId:string):SavedTemplate[]{return versions.filter(t=>(t.clientId===null||t.clientId===clientId)&&!versions.some(v=>v.id===t.id&&v.version>t.version));}
function design(id:string,name:string,description:string,campaign:string,industry:string,style:string,color:string,font:string,compose:(b:Builder)=>Block[]):GalleryTemplate{
 const b=new Builder(id);const previewBrand={...defaultBrand,name:'YOUR BRAND',logo:'',color,font,phone:'(555) 012-3456',website:'https://example.com',address:'Your business address',footer:'A little inspiration, delivered to your inbox. Manage your subscription with your sending platform.'};
 return {id,version:1,clientId:null,name,source:'starter',previewBrand,metadata:{description,campaign,industry,style,tags:[campaign,industry,style]},content:{subject:name,preheader:description,width:640,background:'#f1f0f4',blocks:compose(b)}};
}
class Builder{
 private i=0;constructor(private prefix:string){}
 block(type:string,props:Block['props'],children?:Block[]):Block{return {id:`${this.prefix}-${++this.i}`,type,props,...(children?{children}:{})};}
 text(text:string,fontSize=16,color='#3c4350',background='#ffffff',padding=24,align='left'){return this.block('text',{text,fontSize,color:background==='{{color}}'?'{{onColor}}':color,background,padding,align});}
 hero(title:string,text:string,background:string,color='#242938',eyebrow='',align='left'){const ink=background==='{{color}}'?'{{onColor}}':color;return this.block('hero',{title,text,background,titleColor:ink,textColor:ink,fontSize:44,padding:36,eyebrow,eyebrowColor:ink,align});}
 button(text:string,background='{{color}}',color='#ffffff',align='left'){return this.block('button',{text,link:'{{website}}',background,color:background==='{{color}}'?'{{onColor}}':color,padding:24,align,surface:'#ffffff'});}
 header(background='#ffffff',color='#242938',text='THE LATEST'){return this.block('header',{background,color,text,padding:24,link:'{{website}}'});}
 row(children:Block[],background='#ffffff',columns=2,gap=8){return this.block('columns',{columns,padding:16,gap,stack:true,background},children);}
 group(children:Block[],background='#ffffff'){return this.block('columns',{columns:1,padding:0,gap:0,stack:true,background},children);}
 footer(){return this.block('footer',{background:'#f5f5f7',color:'#737986',padding:28});}
 line(color='#e3e5ed'){return this.block('divider',{padding:24,color,background:'#ffffff'});}
}
export const starterTemplates:GalleryTemplate[]=[
 design('starter-service-edit','The Service Edit','A confident service campaign with a feature story and editable offer cards.','Promotion','Automotive','Bold','#225ed8','Arial, Helvetica, sans-serif',b=>[
   b.header('#142a47','#ffffff','SERVICE & SPECIALS'),b.hero('A little care.\nA lot more miles.','Keep your next adventure running smoothly.','{{color}}','#ffffff','THE SERVICE EDIT'),
   b.text('Your vehicle works hard for you. Give it the attention it deserves with timely maintenance and this month’s featured services.'),
   b.row([b.group([b.text('01 / ROUTINE CARE',12,'{{color}}','#f2f6ff',20),b.text('Ready for the road.',24,'#142a47','#f2f6ff',20),b.text('Oil changes, inspections, and a little peace of mind.',14,'#65738c','#f2f6ff',20)]),b.group([b.text('02 / SEASONAL SAVINGS',12,'{{color}}','#f2f6ff',20),b.text('More care. Less worry.',24,'#142a47','#f2f6ff',20),b.text('Discover the right service package for your next visit.',14,'#65738c','#f2f6ff',20)])]),
   b.button('Explore service offers'),b.footer()]),
 design('starter-monthly-journal','The Monthly Journal','An editorial digest with generous typography and a two-column reading list.','Newsletter','Professional services','Editorial','#876440','Georgia, Times New Roman, serif',b=>[
   b.header('#faf6ef','#3d342a','VOLUME 01 / MONTHLY NOTES'),b.hero('Good stories.\nFresh perspectives.','A few things worth your time this month.','#faf6ef','#3d342a','THE MONTHLY JOURNAL'),
   b.text('A note from our team',25,'#3d342a','#ffffff',28),b.text('Welcome to your monthly pause. We’re sharing ideas, useful discoveries, and a closer look at what’s happening in our world.',16,'#71675a'),b.line('#cdbfae'),
   b.row([b.group([b.text('01 / IN FOCUS',12,'{{color}}'),b.text('The ideas moving us forward',25,'#3d342a'),b.text('Go behind the scenes of our latest work and the people who make it possible.',14,'#71675a')]),b.group([b.text('02 / WORTH A LOOK',12,'{{color}}'),b.text('Small changes, meaningful impact',25,'#3d342a'),b.text('Practical insights you can put to work in your everyday routine.',14,'#71675a')])]),b.button('Read the latest stories'),b.footer()]),
 design('starter-product-focus','Product in Focus','A clean product spotlight with a visual feature, benefits, and a clear next step.','Promotion','Retail','Image-led','#38644f','Arial, Helvetica, sans-serif',b=>[
   b.header('#edf2eb','#284436','THOUGHTFULLY SELECTED'),b.hero('Meet your\nnew favorite.','Made for your day. Designed to last.','#edf2eb','#284436','THE PRODUCT EDIT'),
   b.block('image',{src:'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1280&q=85',alt:'Coffee prepared for a quiet morning',padding:0,link:'{{website}}'}),
   b.text('Everyday essentials. Elevated.',27,'#284436'),b.text('Introduce your featured product here. Tell your customers what makes it special, how it fits their life, and why you selected it.'),
   b.row([b.text('Thoughtful details\nBuilt around the little things.',15,'#38644f','#edf2eb'),b.text('Made to be enjoyed\nA better part of your everyday.',15,'#38644f','#edf2eb')]),b.button('Discover the collection'),b.footer()]),
 design('starter-seasonal-savings','The Seasonal Sale','A bright, bold promotion with a standout offer and supporting product sections.','Promotion','Retail','Bold','#b3334c','Arial, Helvetica, sans-serif',b=>[
   b.header('#fff3e8','#73273b','A LITTLE SOMETHING FOR YOU'),b.hero('Good things.\nEven better prices.','Your seasonal favorites, with a little extra to love.','#fff3e8','#73273b','THE SEASONAL SALE','center'),
   b.text('20% OFF',40,'#ffffff','{{color}}',36,'center'),b.text('Your next favorite is waiting.\nUse code HELLO20 on selected items.',18,'#73273b','#fff3e8',28,'center'),
   b.button('Find your favorites','{{color}}','#ffffff','center'),b.row([b.text('Fresh finds\nNew arrivals for the season.',18,'#73273b','#fff3e8'),b.text('Everyday favorites\nA little more of what you love.',18,'#73273b','#fff3e8')]),b.text('Replace this line with your offer terms, exclusions, and expiration date.',11,'#89818a','#ffffff',24,'center'),b.footer()]),
 design('starter-event-invitation','An Invitation to Connect','A striking event invitation with date, location, and a focused RSVP.','Event','Any industry','Bold','#634b88','Arial, Helvetica, sans-serif',b=>[
   b.header('#f3eff9','#49385f','SAVE YOUR SEAT'),b.hero('Good people.\nGreat conversations.','Join us for an experience worth making time for.','{{color}}','#ffffff','YOU’RE INVITED'),
   b.text('An evening of fresh ideas',28,'#49385f'),b.text('Bring your curiosity. Meet our team, connect with your community, and discover what’s next. We’d love to see you there.'),
   b.row([b.text('WHEN\nAdd your event date\nAdd your event time',16,'#49385f','#f3eff9'),b.text('WHERE\nAdd your venue\nAdd your city or meeting link',16,'#49385f','#f3eff9')]),b.button('Reserve your place'),b.text('Have a question? Reply to this email and our team will help.',13,'#8a8292'),b.footer()]),
 design('starter-simple-announcement','A Little Good News','A minimal announcement that gives one message room to shine.','Announcement','Any industry','Minimal','#353d51','Arial, Helvetica, sans-serif',b=>[
   b.header('#ffffff','#353d51','A NOTE FROM OUR TEAM'),b.line(),b.hero('Something good\nis on the way.','We have a little news to share.','#ffffff','#353d51','JUST ANNOUNCED'),
   b.text('The next chapter starts here.',24,'#353d51'),b.text('Share your announcement in a few clear sentences. Explain what’s changing, why it matters, and what your readers can look forward to.',17,'#6b7180'),b.button('Take a closer look'),b.line(),b.text('Thanks for being part of our story.\nThe {{name}} team',14,'#8b909d'),b.footer()])
];
export function sectionContent(block:Block):EmailContent{return {subject:'Section preview',preheader:'',width:640,background:'#ffffff',blocks:[block]};}
