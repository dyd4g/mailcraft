import {readFileSync} from 'node:fs';
import ts from 'typescript';
import test from 'node:test';
import assert from 'node:assert/strict';
import {hyundaiPack} from './create-hyundai-pack.mjs';
import {hyundaiDesignPack} from './create-hyundai-designs.mjs';
const load=async path=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const model=await load('../lib/email/model.ts');const render=await load('../lib/email/render.ts');
const library=await load('../lib/email/library.ts');
test('library ownership keeps clients and shared resources in separate areas',()=>{
 assert.equal(library.belongsToLibrary(null,'hyundai',true),true);
 assert.equal(library.belongsToLibrary('hyundai','hyundai',true),false);
 assert.equal(library.belongsToLibrary(null,'hyundai',false),false);
 assert.equal(library.belongsToLibrary('toyota','hyundai',false),false);
 assert.equal(library.belongsToLibrary('hyundai','hyundai',false),true);
 assert.equal(library.ownershipLabel(null,'Hyundai'),'Team asset · Available to every client');
 assert.equal(library.ownershipLabel('hyundai','Hyundai'),'Owned by Hyundai');
 assert.match(library.brandingLabel([{type:'image',props:{src:'https://example.com/coupon.png'}}]),/fixed content/);
 assert.equal(library.brandingLabel([{type:'header',props:{link:'{{website}}'}}]),'Uses client branding');
});
test('three Hyundai designs retain all offers and have distinct editable compositions',()=>{
 assert.equal(hyundaiDesignPack.designs.length,3);
 const signatures=new Set();
 for(const d of hyundaiDesignPack.designs){
  const ids=new Set();const walk=(n,depth=0)=>{assert.ok(depth<=5);assert.ok(!ids.has(n.id));ids.add(n.id);assert.ok(model.types.includes(n.type));(n.children||[]).forEach(c=>walk(c,depth+1));};
  d.content.blocks.forEach(n=>walk(n));
  const html=render.exportEmail(d.content,hyundaiPack.client.brand);
  for(const text of ['$69.99','$84.99','$169.99','Up to 5 quarts','Hyundai vehicles only.','cabin filter or air filter']) assert.ok(html.toLowerCase().includes(text.toLowerCase()),d.title+': '+text);
  assert.ok(html.includes('IMG_2285-2-.jpeg'));assert.ok(!html.includes('Toyota'));assert.ok(!html.includes('127.0.0.1'));
  assert.equal((html.match(/clients\/hyundai-of-meridian\//g)||[]).length,3);
  signatures.add(JSON.stringify(d.content.blocks));
 }
 assert.equal(signatures.size,3);
});
test('Hyundai pack preserves supplied prices, restrictions and responsive layout',()=>{const pack=hyundaiPack;const html=render.exportEmail(pack.email.content,pack.client.brand);assert.equal(pack.client.id,'hyundai-meridian');assert.equal(pack.client.brand.phone,'601-685-4070');assert.ok(html.includes('$69.99'));assert.ok(html.includes('$84.99'));assert.ok(html.includes('$169.99'));assert.ok(html.includes('Hyundai vehicles only.'));assert.ok(html.includes('Up to 5 quarts'));assert.ok(html.includes('2001 MS-39'));assert.ok(!html.includes('Toyota'));assert.ok(!html.includes('127.0.0.1'));assert.ok(html.includes('class="mc-stack"'));assert.equal(pack.assets.length,4);assert.equal(pack.components.length,3);assert.ok(pack.assets.slice(1).every(a=>a.url.startsWith('https://mailcraft-studio.nifty-skunk-1607.chatgpt.site/clients/hyundai-of-meridian/')));});
const modelSource=ts.transpileModule(readFileSync(new URL('../lib/email/model.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const modelUri='data:text/javascript;base64,'+Buffer.from(modelSource).toString('base64');
const catalogSource=ts.transpileModule(readFileSync(new URL('../lib/email/catalog.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace(/from ['"]\.\/model['"]/g,'from '+JSON.stringify(modelUri));
const catalog=await import('data:text/javascript;base64,'+Buffer.from(catalogSource).toString('base64'));

test('six distinct starters use valid editable blocks and unique IDs',()=>{assert.equal(catalog.starterTemplates.length,6);const signatures=new Set();for(const t of catalog.starterTemplates){const ids=new Set();function walk(n){assert.ok(model.types.includes(n.type));assert.ok(!ids.has(n.id));ids.add(n.id);(n.children||[]).forEach(walk);}t.content.blocks.forEach(walk);assert.ok(t.metadata.description.length>10);assert.ok(t.metadata.tags.length>0);signatures.add(JSON.stringify(t.content.blocks.map(b=>({type:b.type,props:b.props}))));const html=render.exportEmail(t.content,t.previewBrand);assert.ok(!html.includes('{{'));assert.ok(html.includes(t.previewBrand.name));}assert.equal(signatures.size,6);});
test('template selection clones content and honors both brand choices',()=>{const t=catalog.starterTemplates[1];const brand={...model.sampleClient().brand,color:'#eecc22'};const original=JSON.stringify(t);const a=catalog.instantiateTemplate(t,brand,true);const b=catalog.instantiateTemplate(t,brand,false);assert.notEqual(a.blocks[0].id,t.content.blocks[0].id);assert.notEqual(a.blocks[0].id,b.blocks[0].id);assert.equal(a.design,undefined);assert.equal(b.design.color,t.previewBrand.color);assert.equal(b.design.font,t.previewBrand.font);a.blocks[0].props.text='Changed';assert.equal(JSON.stringify(t),original);assert.ok(render.exportEmail(b,brand).includes(t.previewBrand.color));assert.ok(render.exportEmail(b,brand).includes(brand.name));});
test('catalog search, metadata filters, scope and no-match states agree',()=>{const all={query:'',campaign:'all',industry:'all',style:'all',library:'all'};const ts=catalog.starterTemplates;assert.equal(catalog.filterTemplates(ts,{...all,query:'SEASONAL'}).length,1);assert.equal(catalog.filterTemplates(ts,{...all,campaign:'Event'}).length,1);assert.equal(catalog.filterTemplates(ts,{...all,style:'Editorial'}).length,1);assert.equal(catalog.filterTemplates(ts,{...all,library:'shared'}).length,0);assert.equal(catalog.filterTemplates(ts,{...all,query:'does not exist'}).length,0);assert.ok(catalog.filterTemplates(ts,{...all,industry:'Automotive'}).every(t=>['Automotive','Any industry'].includes(t.metadata.industry)));});
test('latest template selection isolates clients and retains shared versions',()=>{const base={...catalog.starterTemplates[0],createdAt:new Date().toISOString()};const versions=[{...base,id:'a',clientId:'client-a',version:1},{...base,id:'a',clientId:'client-a',version:2},{...base,id:'b',clientId:'client-b',version:1},{...base,id:'shared',clientId:null,version:1}];assert.deepEqual(catalog.latestTemplates(versions,'client-a').map(t=>[t.id,t.version]),[['a',2],['shared',1]]);});
test('brand-colored starter surfaces choose readable ink',()=>{const content=catalog.instantiateTemplate(catalog.starterTemplates[0],model.defaultBrand,true);const html=render.exportEmail(content,{...model.defaultBrand,color:'#ffffcc'});assert.ok(html.includes('color:#142033'));assert.equal(render.contrastColor('#ffffff'),'#142033');assert.equal(render.contrastColor('#142a47'),'#ffffff');});
test('sample has six linked offers and editable column layouts',()=>{const c=model.sampleContent();const rows=c.blocks.filter(b=>b.type==='columns');assert.equal(rows.length,3);assert.equal(rows.flatMap(r=>r.children).length,6);assert.ok(rows.every(r=>r.children.every(c=>c.props.link.startsWith('https://'))));});
test('inserting a component creates independent IDs and content',()=>{const original=model.newBlock('columns');const copy=model.cloneBlock(original);assert.notEqual(copy.id,original.id);assert.notEqual(copy.children[0].id,original.children[0].id);copy.children[0].props.text='Changed';assert.notEqual(copy.children[0].props.text,original.children[0].props.text);});
test('nested editing and removal preserve sibling content',()=>{const row=model.newBlock('columns');const id=row.children[0].id;const updated=model.updateBlock([row],id,n=>({...n,props:{...n.props,text:'New content'}}));assert.equal(model.findBlock(updated,id).props.text,'New content');assert.notEqual(model.findBlock([row],id).props.text,'New content');assert.equal(model.removeBlock(updated,id)[0].children.length,1);});
test('export escapes copy, metadata and attributes; rejects unsafe links',()=>{const brand=model.sampleClient().brand;const node=model.newBlock('button');node.props.text='<script>alert(1)</script>';node.props.link='javascript:alert(1)';node.props.background='red;position:absolute';const c={...model.blankContent(),subject:'<img onerror=alert(1)>',blocks:[node]};const html=render.exportEmail(c,brand);assert.ok(!html.includes('<script>'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('position:absolute'));assert.ok(html.includes('&lt;script&gt;'));assert.ok(html.includes('&lt;img onerror=alert(1)&gt;'));});
test('brand tokens render per client without mutating shared content',()=>{const c=model.blankContent();const brand=model.sampleClient().brand;const other={...brand,name:'Other client',color:'#ff5500',website:'https://example.com'};const a=render.exportEmail(c,brand);const b=render.exportEmail(c,other);assert.ok(a.includes('#144fa8'));assert.ok(b.includes('#ff5500'));assert.ok(b.includes('https://example.com'));assert.equal(c.blocks.find(n=>n.type==='button').props.background,'{{color}}');});
test('export includes responsive table structure, preheader and Outlook width fallback',()=>{const c=model.sampleContent();const html=render.exportEmail(c,model.sampleClient().brand);assert.ok(html.includes('<!--[if mso]>'));assert.ok(html.includes('width="680"'));assert.ok(html.includes('@media screen and (max-width:480px)'));assert.ok(html.includes('class="mc-stack"'));assert.ok(html.includes(c.preheader));assert.ok(!html.includes('contenteditable'));});

