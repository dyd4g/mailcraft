import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
const files=['components/studio.tsx','lib/email/model.ts','lib/email/render.ts','app/api/studio/route.ts','db/schema.ts','app/page.tsx'];
for(const file of files){const source=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);writeFileSync(file,ts.createPrinter({newLine:ts.NewLineKind.LineFeed}).printFile(source));}
