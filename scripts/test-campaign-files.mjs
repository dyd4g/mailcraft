import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import ts from 'typescript';
const compile=p=>ts.transpileModule(readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const modelUri='data:text/javascript;base64,'+Buffer.from(compile('lib/campaigns/model.ts')).toString('base64');
mkdirSync('outputs',{recursive:true});const modulePath=resolve('outputs/campaign-files-test-module.mjs');writeFileSync(modulePath,compile('lib/campaigns/files.ts').replace(/from ['"]\.\/model['"]/g,'from '+JSON.stringify(modelUri)));
const m=await import(pathToFileURL(modulePath).href);
let file;if(process.argv[2])file=new File([readFileSync(process.argv[2])],'source.xlsx');else{const ExcelJS=(await import('exceljs')).default;const w=new ExcelJS.Workbook();w.addWorksheet('Stats').addRows([['Sent','Delivered','Clicked'],[1,1,1]]);const s=w.addWorksheet('Clicks');s.addRows([['Email','Url','Timestamp','Unusual column'],['qa@example.com','https://example.com',new Date('2026-10-14T14:04:49Z'),'kept']]);s.getCell('C2').numFmt='yyyy-mm-dd hh:mm:ss';file=new File([await w.xlsx.writeBuffer()],'fixture.xlsx');}
const sheets=await m.readSheets(file),data=m.reportFromSheets(sheets);
assert.ok(sheets.length);let dates=0;for(const s of sheets)for(const d of s.dates||[]){dates++;assert.ok(!String(s.rows[d.row-1][d.column-1]).endsWith('Z'),'Source wall-clock timestamps must not acquire a timezone');}
let captured;globalThis.document={createElement:()=>({click(){},set href(v){},set download(v){}})};const original=URL.createObjectURL;URL.createObjectURL=b=>{captured=b;return 'blob:test';};
await m.exportRawWorkbook({id:'qa',campaignId:'qa',clientId:'qa',source:'fixture',cutoff:new Date().toISOString(),timezone:'Unknown (source export)',data,createdAt:new Date().toISOString()});URL.createObjectURL=original;
assert.ok(captured);writeFileSync('outputs/qa-raw-roundtrip.xlsx',Buffer.from(await captured.arrayBuffer()));
const ExcelJS=(await import('exceljs')).default;const w=new ExcelJS.Workbook();await w.xlsx.load(Buffer.from(await captured.arrayBuffer()));
for(const s of sheets){const actual=w.getWorksheet(s.name);assert.ok(actual);const positions=new Set((s.dates||[]).map(d=>d.row+':'+d.column));s.rows.forEach((row,i)=>row.forEach((v,j)=>{const a=actual.getCell(i+1,j+1).value;if(positions.has((i+1)+':'+(j+1))){assert.ok(a instanceof Date);assert.equal(a.toISOString().slice(0,-1),v);}else assert.equal(a??null,v??null);}));}
console.log('PASS: all source sheets and values round-trip, including '+dates+' Excel date cells without assigning a source timezone.');
