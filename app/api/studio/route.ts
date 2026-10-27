import { and, desc, eq, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { getDb } from '@/db';
import { clients, documents, componentVersions, assets, sharedAssets, templateVersions } from '@/db/schema';
import { sampleClient, sampleContent, newBlock, types } from '@/lib/email/model';
const color = z.string().regex(/^#[a-f\d]{6}$/i);
const url = z.string().max(2048).refine(s => !s || /^https?:\/\/[^\s<>]+$/i.test(s), 'Use a full http(s) URL');
const brandSchema = z.object({ name: z.string().min(1).max(120), logo: url, color, background: color, font: z.enum(['Arial, Helvetica, sans-serif', 'Georgia, Times New Roman, serif', 'Verdana, Geneva, sans-serif']), phone: z.string().max(80), website: url, address: z.string().max(500), footer: z.string().max(4000) });
const blockSchema: z.ZodTypeAny = z.lazy(() => z.object({ id: z.string().min(1).max(80), type: z.enum(types), props: z.record(z.union([z.string().max(20000), z.number().finite().min(-1000).max(10000), z.boolean()])), children: z.array(blockSchema).max(100).optional(), source: z.object({ id: z.string().max(80), version: z.number().int().positive() }).optional() }));
const contentSchema = z.object({ subject: z.string().max(200), preheader: z.string().max(500), width: z.number().int().min(320).max(900), background: color, blocks: z.array(blockSchema).max(100), design: z.object({ color, font: brandSchema.shape.font }).optional() });
type Write = BatchItem<'sqlite'>;
const batch = (db: ReturnType<typeof getDb>, writes: Write[]) => db.batch(writes as [Write, ...Write[]]);
type TreeNode = { id: string; type: string; children?: TreeNode[] };
const text = z.string().trim().min(1).max(120);
const id = z.string().min(1).max(80);
function parseTree(value: unknown) {
    let count = 0;
    const ids = new Set<string>();
    function walk(n: TreeNode, depth: number) {
        if (depth > 5 || ++count > 300)
            throw new Error('Use at most 300 blocks and 5 nesting levels.');
        if (ids.has(n.id))
            throw new Error('Block IDs must be unique.');
        ids.add(n.id);
        if (n.children?.length && n.type !== 'columns')
            throw new Error('Only columns can contain blocks.');
        for (const c of n.children || [])
            walk(c, depth + 1);
    }
    for (const b of Array.isArray(value) ? value : [value])
        walk(b, 0);
}
const json = (v: unknown, status = 200) => Response.json(v, { status, headers: { 'Cache-Control': 'no-store' } });
async function allowed(req: Request, write = false) {
    const auth = await requireUser(req, { write });
    return auth.denied ?? null;
}
async function bootstrap() {
    const db = getDb();
    if (await db.select({ id: clients.id }).from(clients).where(eq(clients.id, "toyota-meridian")).get())
        return;
    const client = sampleClient();
    const now = client.updatedAt;
    await db.batch([db.insert(clients).values({ ...client, brand: JSON.stringify(client.brand) }).onConflictDoNothing(), db.insert(documents).values({ id: "toyota-october-sample", clientId: client.id, title: "October service specials", kind: "email", content: JSON.stringify(sampleContent()), revision: 1, updatedAt: now }).onConflictDoNothing(), db.insert(componentVersions).values({ id: "shared-two-columns", version: 1, clientId: null, name: "Two-column layout", content: JSON.stringify(newBlock("columns")), createdAt: now }).onConflictDoNothing()]);
}
export async function GET(req: Request) {
    const denied = await allowed(req);
    if (denied)
        return denied;
    try {
        await bootstrap();
        const db = getDb();
        const [cs, ds, vs, imgs, sharedImgs, templates] = await Promise.all([db.select().from(clients).orderBy(clients.name), db.select().from(documents).orderBy(desc(documents.updatedAt)), db.select().from(componentVersions).orderBy(desc(componentVersions.version)), db.select().from(assets).orderBy(desc(assets.createdAt)), db.select().from(sharedAssets).orderBy(desc(sharedAssets.createdAt)), db.select().from(templateVersions).orderBy(desc(templateVersions.version))]);
        return json({ clients: cs.map(c => ({ ...c, brand: JSON.parse(c.brand) })), documents: ds.map(d => ({ ...d, content: JSON.parse(d.content) })), components: vs.map(v => ({ ...v, content: JSON.parse(v.content) })), assets: [...imgs,...sharedImgs.map(a=>({...a,clientId:null}))], templates: templates.map(t => ({ ...t, content: JSON.parse(t.content), metadata: JSON.parse(t.metadata), previewBrand: JSON.parse(t.previewBrand) })) });
    }
    catch (e) {
        console.error('Studio read failed', e);
        return json({ error: 'The workspace could not load. Check the server database connection and try again.' }, 503);
    }
}
export async function POST(req: Request) {
    const denied = await allowed(req, true);
    if (denied)
        return denied;
    try {
        const raw = await req.text();
        if (raw.length > 1000000)
            return json({ error: 'This document is too large (maximum 1 MB).' }, 413);
        const p = JSON.parse(raw);
        const db = getDb();
        const now = new Date().toISOString();
        if (p.action === 'importDesigns') {
            const metadata = z.object({ description: z.string().max(500), campaign: text, industry: text, style: text, tags: z.array(z.string().min(1).max(40)).max(12) });
            const pack = z.object({ format: z.literal('mailcraft-design-pack-v1'), clientId: id, designs: z.array(z.object({ id, title: text, content: contentSchema, template: z.object({ id, name: text, metadata }).optional() })).min(1).max(10) }).parse(p.pack);
            const client = await db.select().from(clients).where(eq(clients.id, pack.clientId)).get();
            if (!client) return json({ error: 'Open or create the client workspace before importing designs.' }, 404);
            const docIds = pack.designs.map(d => d.id);
            const templateIds = pack.designs.flatMap(d => d.template ? [d.template.id] : []);
            if (new Set(docIds).size !== docIds.length || new Set(templateIds).size !== templateIds.length) return json({ error: 'The design pack contains duplicate IDs.' }, 400);
            const writes: Write[] = [];
            let created = 0;
            for (const design of pack.designs) {
                parseTree(design.content.blocks);
                const existing = await db.select().from(documents).where(eq(documents.id, design.id)).get();
                if (existing && (existing.clientId !== pack.clientId || existing.kind !== 'email')) return json({ error: 'A design ID belongs to another workspace or document type.' }, 409);
                if (!existing) {
                    writes.push(db.insert(documents).values({ id: design.id, clientId: pack.clientId, title: design.title, kind: 'email', content: JSON.stringify(design.content), revision: 1, updatedAt: now }));
                    created++;
                }
                if (design.template) {
                    const t = design.template;
                    const saved = await db.select().from(templateVersions).where(eq(templateVersions.id, t.id)).get();
                    if (saved && saved.clientId !== pack.clientId) return json({ error: 'A template ID belongs to another library.' }, 409);
                    if (!saved) writes.push(db.insert(templateVersions).values({ id: t.id, version: 1, clientId: pack.clientId, name: t.name, content: JSON.stringify(design.content), metadata: JSON.stringify(t.metadata), previewBrand: client.brand, createdAt: now }));
                }
            }
            try {
                if (writes.length) await batch(db, writes);
                return json({ clientId: pack.clientId, emailId: docIds[0], created }, writes.length ? 201 : 200);
            } catch {
                return json({ error: 'An import record changed. No designs were saved. Refresh and try again.' }, 409);
            }
        }
        if (p.action === 'onboard') {
            const metadata = z.object({ description: z.string().max(500), campaign: text, industry: text, style: text, tags: z.array(z.string().min(1).max(40)).max(12) });
            const pack = z.object({ format: z.literal('mailcraft-client-pack-v1'), client: z.object({ id, name: text, brand: brandSchema }), email: z.object({ id, title: text, content: contentSchema }), template: z.object({ id, name: text, metadata }).optional(), assets: z.array(z.object({ id, name: text, url: url.refine(s => !!s) })).max(25), components: z.array(z.object({ id, name: text, content: blockSchema })).max(25) }).parse(p.pack);
            parseTree(pack.email.content.blocks);
            for (const c of pack.components)
                parseTree(c.content);
            for (const list of [pack.assets, pack.components])
                if (new Set(list.map(v => v.id)).size !== list.length)
                    return json({ error: 'The client pack contains duplicate record IDs.' }, 400);
            if (pack.client.name !== pack.client.brand.name)
                return json({ error: 'Client name and brand name must match.' }, 400);
            const existing = await db.select().from(clients).where(eq(clients.id, pack.client.id)).get();
            if (existing) {
                if (existing.name.toLowerCase() !== pack.client.name.toLowerCase())
                    return json({ error: 'This client ID belongs to a different workspace.' }, 409);
                const email = await db.select().from(documents).where(and(eq(documents.id, pack.email.id), eq(documents.clientId, existing.id))).get();
                return json({ clientId: existing.id, emailId: email?.id || null, existing: true });
            }
            const domain = (value: string) => { try {
                return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
            }
            catch {
                return '';
            } };
            const allClients = await db.select().from(clients);
            const newDomain = domain(pack.client.brand.website);
            if (allClients.some(c => c.name.toLowerCase() === pack.client.name.toLowerCase() || (newDomain && domain(JSON.parse(c.brand).website) === newDomain)))
                return json({ error: 'A workspace for this client already exists. Open it instead of importing a duplicate.' }, 409);
            try {
                const writes: Write[] = [db.insert(clients).values({ id: pack.client.id, name: pack.client.name, brand: JSON.stringify(pack.client.brand), revision: 1, updatedAt: now }), db.insert(documents).values({ id: pack.email.id, clientId: pack.client.id, title: pack.email.title, kind: 'email', content: JSON.stringify(pack.email.content), revision: 1, updatedAt: now })];
                for (const a of pack.assets)
                    writes.push(db.insert(assets).values({ ...a, clientId: pack.client.id, createdAt: now }));
                for (const c of pack.components)
                    writes.push(db.insert(componentVersions).values({ id: c.id, version: 1, clientId: pack.client.id, name: c.name, content: JSON.stringify(c.content), createdAt: now }));
                if (pack.template)
                    writes.push(db.insert(templateVersions).values({ id: pack.template.id, version: 1, clientId: pack.client.id, name: pack.template.name, content: JSON.stringify(pack.email.content), metadata: JSON.stringify(pack.template.metadata), previewBrand: JSON.stringify(pack.client.brand), createdAt: now }));
                await batch(db, writes);
                return json({ clientId: pack.client.id, emailId: pack.email.id, existing: false }, 201);
            }
            catch (e) {
                console.error('Client pack import rolled back', e);
                return json({ error: 'The client pack conflicts with an existing record. No part of this import was saved.' }, 409);
            }
        }
        if (p.action === 'client') {
            const input = z.object({ id, name: text, brand: brandSchema, revision: z.number().int().nonnegative() }).parse(p);
            if (input.revision === 0) {
                const [row] = await db.insert(clients).values({ ...input, brand: JSON.stringify(input.brand), revision: 1, updatedAt: now }).returning();
                return json({ client: { ...row, brand: JSON.parse(row.brand) } }, 201);
            }
            const [row] = await db.update(clients).set({ name: input.name, brand: JSON.stringify(input.brand), revision: sql `${clients.revision}+1`, updatedAt: now }).where(and(eq(clients.id, input.id), eq(clients.revision, input.revision))).returning();
            if (!row)
                return json({ error: 'This brand was changed in another tab. Reload the workspace before saving.' }, 409);
            return json({ client: { ...row, brand: JSON.parse(row.brand) } });
        }
        if (p.action === 'document') {
            const input = z.object({ id, clientId: id, title: text, kind: z.enum(['email', 'template']), content: contentSchema, revision: z.number().int().nonnegative() }).parse(p);
            parseTree(input.content.blocks);
            if (!(await db.select().from(clients).where(eq(clients.id, input.clientId)).get()))
                return json({ error: 'Client not found.' }, 404);
            if (input.revision === 0) {
                const [row] = await db.insert(documents).values({ ...input, content: JSON.stringify(input.content), revision: 1, updatedAt: now }).returning();
                return json({ document: { ...row, content: JSON.parse(row.content) } }, 201);
            }
            const [row] = await db.update(documents).set({ title: input.title, content: JSON.stringify(input.content), revision: sql `${documents.revision}+1`, updatedAt: now }).where(and(eq(documents.id, input.id), eq(documents.clientId, input.clientId), eq(documents.revision, input.revision), eq(documents.kind, input.kind))).returning();
            if (!row)
                return json({ error: 'This draft changed in another tab. Download a backup, then reload to resolve the conflict.' }, 409);
            return json({ document: { ...row, content: JSON.parse(row.content) } });
        }
        if (p.action === 'template') {
            const metadataSchema = z.object({ description: z.string().max(500), campaign: z.string().trim().min(1).max(60), industry: z.string().trim().min(1).max(60), style: z.string().trim().min(1).max(60), tags: z.array(z.string().trim().min(1).max(40)).max(12) });
            const input = z.object({ id, clientId: id.nullable(), name: text, content: contentSchema, metadata: metadataSchema, previewBrand: brandSchema, baseVersion: z.number().int().nonnegative() }).parse(p);
            parseTree(input.content.blocks);
            if (input.clientId && !(await db.select().from(clients).where(eq(clients.id, input.clientId)).get()))
                return json({ error: 'Client not found.' }, 404);
            const latest = await db.select().from(templateVersions).where(eq(templateVersions.id, input.id)).orderBy(desc(templateVersions.version)).get();
            if ((latest?.version || 0) !== input.baseVersion || latest && latest.clientId !== input.clientId)
                return json({ error: 'This template has a newer version or a different library. Reload before publishing.' }, 409);
            try {
                const [row] = await db.insert(templateVersions).values({ id: input.id, version: input.baseVersion + 1, clientId: input.clientId, name: input.name, content: JSON.stringify(input.content), metadata: JSON.stringify(input.metadata), previewBrand: JSON.stringify(input.previewBrand), createdAt: now }).returning();
                return json({ template: { ...row, content: JSON.parse(row.content), metadata: JSON.parse(row.metadata), previewBrand: JSON.parse(row.previewBrand) } }, 201);
            }
            catch {
                return json({ error: 'Another template version was published. Reload and try again.' }, 409);
            }
        }
        if (p.action === 'component') {
            const input = z.object({ id, clientId: id.nullable(), name: text, content: blockSchema, baseVersion: z.number().int().nonnegative() }).parse(p);
            parseTree(input.content);
            if (input.clientId && !(await db.select().from(clients).where(eq(clients.id, input.clientId)).get()))
                return json({ error: 'Client not found.' }, 404);
            const latest = await db.select().from(componentVersions).where(eq(componentVersions.id, input.id)).orderBy(desc(componentVersions.version)).get();
            if ((latest?.version || 0) !== input.baseVersion || latest && latest.clientId !== input.clientId)
                return json({ error: 'This component has a newer version. Reload before publishing another version.' }, 409);
            try {
                const [row] = await db.insert(componentVersions).values({ id: input.id, version: input.baseVersion + 1, clientId: input.clientId, name: input.name, content: JSON.stringify(input.content), createdAt: now }).returning();
                return json({ component: { ...row, content: JSON.parse(row.content) } }, 201);
            }
            catch {
                return json({ error: 'Another version was published. Reload and try again.' }, 409);
            }
        }
        if (p.action === 'asset') {
            const input = z.object({ clientId: id.nullable(), name: text, url: url.refine(s => s.length > 0) }).parse(p);
            if (input.clientId && !(await db.select().from(clients).where(eq(clients.id, input.clientId)).get()))
                return json({ error: 'Client not found.' }, 404);
            if(input.clientId===null){
                const [row]=await db.insert(sharedAssets).values({id:crypto.randomUUID(),name:input.name,url:input.url,createdAt:now}).returning();
                return json({asset:{...row,clientId:null}},201);
            }
            const [row] = await db.insert(assets).values({ ...input, clientId:input.clientId!, id: crypto.randomUUID(), createdAt: now }).returning();
            return json({ asset: row }, 201);
        }
        if (p.action === 'deleteDocument') {
            const input = z.object({ id, clientId: id, revision: z.number().int().positive() }).parse(p);
            const rows = await db.delete(documents).where(and(eq(documents.id, input.id), eq(documents.clientId, input.clientId), eq(documents.revision, input.revision))).returning();
            if (!rows.length)
                return json({ error: 'The draft changed. Reload before deleting.' }, 409);
            return json({ ok: true });
        }
        return json({ error: 'Unknown workspace action.' }, 400);
    }
    catch (e) {
        if (e instanceof z.ZodError)
            return json({ error: e.errors.map(x => `${x.path.join('.')}: ${x.message}`).slice(0, 3).join('; ') }, 400);
        if (e instanceof SyntaxError)
            return json({ error: 'Invalid JSON.' }, 400);
        if (e instanceof Error && /nesting|unique|contain/.test(e.message))
            return json({ error: e.message }, 400);
        console.error('Studio write failed', e);
        return json({ error: 'Unable to save this change. Please try again.' }, 500);
    }
}
