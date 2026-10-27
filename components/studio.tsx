'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mail, Users, ArrowLeft, ArrowDown, ArrowUp, ArrowRight, Building2, Check, Columns2, Copy, Download, Eye, FileText, FolderOpen, GripVertical, Image as ImageIcon, Layers, LayoutTemplate, Loader2, Minus, Monitor, MousePointer2, Palette, PanelTop, Plus, Redo2, Save, Search, Settings2, Smartphone, Square, Trash2, Type, Undo2, X } from 'lucide-react';
import { type Client, type Block, type Brand, type EmailDocument, type Component, type Asset, type EmailContent, uid, newBlock, blankContent, cloneBlock, findBlock, updateBlock, removeBlock, labels, types, defaultBrand } from '@/lib/email/model';
import TemplateGallery from './template-gallery';
import CampaignWorkspace from './campaign-workspace';
import Link from 'next/link';
import AccountMenu, { type AccountInfo } from './account-menu';
import {belongsToLibrary,ownershipLabel,brandingLabel} from '@/lib/email/library';
import DesignPreview from './design-preview';
import { campaigns, industries, designStyles, sectionContent, latestTemplates } from '@/lib/email/catalog';
import { type SavedTemplate } from '@/lib/email/model';
import type { ClientPack, DesignPack } from '@/lib/email/client-pack';
import { resolve, safeUrl, exportEmail } from '@/lib/email/render';
type Data = {
    clients: Client[];
    documents: EmailDocument[];
    components: Component[];
    assets: Asset[];
    templates: SavedTemplate[];
};
type Drag = {
    kind: 'block';
    id: string;
} | {
    kind: 'new';
    type: string;
} | {
    kind: 'component';
    id: string;
};
const icons: Record<string, React.ElementType> = { header: PanelTop, hero: Square, text: Type, image: ImageIcon, button: MousePointer2, columns: Columns2, divider: Minus, spacer: Square, footer: FileText };
const date = (v: string) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
const filename = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'newsletter';
function download(name: string, content: string, mime: string) { const url = URL.createObjectURL(new Blob([content], { type: mime })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function insertAt(nodes: Block[], parent: string | null, index: number, node: Block): Block[] {
    if (!parent) {
        const result = [...nodes];
        result.splice(index, 0, node);
        return result;
    }
    return updateBlock(nodes, parent, n => { const children = [...(n.children || [])]; children.splice(index, 0, node); return { ...n, children }; });
}
function locate(nodes: Block[], id: string, parent: string | null = null): {
    parent: string | null;
    index: number;
    list: Block[];
} | undefined {
    const index = nodes.findIndex(n => n.id === id);
    if (index >= 0)
        return { parent, index, list: nodes };
    for (const n of nodes) {
        const r = locate(n.children || [], id, n.id);
        if (r)
            return r;
    }
}
function countTree(nodes: Block[]): number { return nodes.reduce((n, b) => n + 1 + countTree(b.children || []), 0); }
function treeDepth(nodes: Block[]): number { return nodes.length ? 1 + Math.max(...nodes.map(b => treeDepth(b.children || []))) : 0; }
function Dialog({ title, onClose, children }: {
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}) { const ref = useRef<HTMLDialogElement>(null); useEffect(() => { ref.current?.showModal(); }, []); return <dialog ref={ref} className="dialog" onCancel={onClose}><div className="dialog-head"><h2>{title}</h2><button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></div>{children}</dialog>; }
function Field({ label, children, hint }: {
    label: string;
    children: React.ReactNode;
    hint?: string;
}) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>; }
export default function Studio({ account }: { account: AccountInfo }) {
    const [data, setData] = useState<Data>({ clients: [], documents: [], components: [], assets: [], templates: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [auth, setAuth] = useState(false);
    const [clientId, setClientId] = useState('');
    const [page, setPage] = useState('clients');
    const [campaignDocumentId,setCampaignDocumentId]=useState<string|null>(null);
    function startCampaign(doc:EmailDocument){if(dirty){notify('Save your newsletter changes before creating a campaign.');return;}setCampaignDocumentId(doc.id);navigate('campaigns');}
    const [teamMode,setTeamMode]=useState(false);
    const [copyItem,setCopyItem]=useState<{kind:'component'|'template'|'asset';value:Component|SavedTemplate|Asset}|null>(null);
    const [pendingUse,setPendingUse]=useState<{title:string;content:EmailContent}|null>(null);
    const [draft, setDraft] = useState<EmailDocument | null>(null);
    const [selected, setSelected] = useState('');
    const [saved, setSaved] = useState('');
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState('');
    const [libraryTab, setLibraryTab] = useState('blocks');
    const [mobile, setMobile] = useState(false);
    const [preview, setPreview] = useState(false);
    const [search, setSearch] = useState('');
    const [dialog, setDialog] = useState<null | 'client' | 'component' | 'asset' | 'newEmail' | 'settings' | 'template' | 'history' | 'import' | 'copy' | 'useTemplate'>(null);
    const packFile = useRef<HTMLInputElement>(null);
    const [pendingPack, setPendingPack] = useState<ClientPack | DesignPack | null>(null);
    const [form, setForm] = useState<Record<string, string>>({});
    const [brandDraft, setBrandDraft] = useState<Brand | null>(null);
    const [componentMode, setComponentMode] = useState<Component | null>(null);
    const [saveTarget, setSaveTarget] = useState<Block | null>(null);
    const [past, setPast] = useState<EmailContent[]>([]);
    const [future, setFuture] = useState<EmailContent[]>([]);
    const [dragging, setDragging] = useState(false);
    const [dropOver, setDropOver] = useState('');
    const dragRef = useRef<Drag | null>(null);
    const draftRef = useRef(draft);
    draftRef.current = draft;
    const client = data.clients.find(c => c.id === clientId);
    const baseBrand = teamMode ? {...defaultBrand,name:'YOUR CLIENT',logo:'',phone:'',website:'https://example.com',address:'Client address',footer:'Client subscription details'} : client?.brand || defaultBrand;
    const brand = { ...baseBrand, ...draft?.content.design };
    const node = draft ? findBlock(draft.content.blocks, selected) : undefined;
    const dirty = !!draft && JSON.stringify(draft) !== saved;
    const latest = data.components.filter(c => !data.components.some(v => v.id === c.id && v.version > c.version));
    const available = latest.filter(c => c.clientId === null || (!teamMode && c.clientId === clientId));
    const clientDocs = data.documents.filter(d => d.clientId === clientId);
    const section = page === 'editor' ? (componentMode ? 'components' : draft?.kind === 'template' ? 'templates' : 'clients') : page === 'emails' ? 'clients' : page;
    const ownedComponents=latest.filter(c=>belongsToLibrary(c.clientId,clientId,teamMode));
    const ownedAssets=data.assets.filter(a=>belongsToLibrary(a.clientId,clientId,teamMode));
    const ownerLabel=(owner:string|null)=>ownershipLabel(owner,data.clients.find(c=>c.id===owner)?.name || 'this client');
    const backTo = componentMode ? { page: 'components', label: 'components' } : draft?.kind === 'template' ? { page: 'templates', label: 'templates' } : { page: 'emails', label: (client?.name || 'client') + ' emails' };
    function teamUrl(p:string){const u=new URL(window.location.href);u.searchParams.delete('client');u.searchParams.delete('email');u.searchParams.set('library','team');u.searchParams.set('type',p);window.history.replaceState(null,'',u.pathname+u.search+u.hash);}
    function openTeam(p='templates'){if(!guard())return;setTeamMode(true);setPage(p);setSearch('');setDraft(null);setSaved('');setSelected('');setComponentMode(null);setBrandDraft(null);setPast([]);setFuture([]);teamUrl(p);}
    function beginCopy(kind:'component'|'template'|'asset',value:Component|SavedTemplate|Asset){setCopyItem({kind,value});setForm({name:value.name,target:value.clientId===null?(clientId||data.clients[0]?.id||''):'team'});setError('');setDialog('copy');}
    async function copyResource(){if(!copyItem)return;const {kind,value}=copyItem;const target=form.target==='team'?null:form.target;
        if(!target&&form.target!=='team')throw new Error('Select a destination client.');
        if(kind==='asset'){const {asset}=await api({action:'asset',clientId:target,name:form.name,url:(value as Asset).url});setData(d=>({...d,assets:[asset,...d.assets]}));}
        if(kind==='component'){const {component}=await api({action:'component',id:uid(),baseVersion:0,clientId:target,name:form.name,content:cloneBlock((value as Component).content)});setData(d=>({...d,components:[component,...d.components]}));}
        if(kind==='template'){const t=value as SavedTemplate;const {template}=await api({action:'template',id:uid(),baseVersion:0,clientId:target,name:form.name,content:{...t.content,blocks:t.content.blocks.map(cloneBlock)},metadata:t.metadata,previewBrand:target?data.clients.find(c=>c.id===target)!.brand:t.previewBrand});setData(d=>({...d,templates:[template,...d.templates]}));}
        setDialog(null);setCopyItem(null);notify('Independent copy saved to '+(target?data.clients.find(c=>c.id===target)?.name:'Team library')+'. The original is unchanged.');
    }
    const notify = useCallback((s: string) => setToast(s), []);
    useEffect(() => {
        if (!toast)
            return;
        const t = setTimeout(() => setToast(''), 5000);
        return () => clearTimeout(t);
    }, [toast]);
    async function api(payload: unknown) {
        const res = await fetch('/api/studio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const value = await res.json() as {
            error?: string;
            document: EmailDocument;
            client: Client;
            component: Component;
            asset: Asset;
            template: SavedTemplate;
            clientId: string;
            emailId: string | null;
            existing: boolean;
            created?: number;
        };
        if (!res.ok)
            throw new Error(value.error || 'The change could not be saved.');
        return value;
    }
    async function load(initial = false) {
        setLoading(true);
        setError('');
        try {
            const res = await fetch('/api/studio', { cache: 'no-store' });
            const value = await res.json() as Data & {
                error?: string;
            };
            if (res.status === 401) {
                setAuth(true);
                return;
            }
            if (!res.ok)
                throw new Error(value.error || 'Unable to load workspace.');
            setData({ ...value, templates: value.templates || [] });
            if (initial) {
                const params = new URLSearchParams(window.location.search);
                const requested = params.get('client');
                const active = value.clients.some(c => c.id === requested) ? requested! : '';
                setClientId(active);
                const requestedEmail = params.get('email');
                const linked = value.documents.find(d => d.clientId === active && d.id === requestedEmail);
                const d = linked || value.documents.find(d => d.clientId === active && d.kind === 'email');
                const isTeam=params.get('library')==='team';setTeamMode(isTeam);
                setPage(isTeam ? (['templates','components','assets'].includes(params.get('type')||'')?params.get('type')!:'templates') : active ? (linked ? 'editor' : 'emails') : 'clients');
                if (d) {
                    setDraft(d);
                    setSaved(JSON.stringify(d));
                }
            }
            setAuth(false);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setLoading(false);
        }
    }
    useEffect(() => { void load(true); }, []);
    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (dirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [dirty]);
    async function readPack(event: React.ChangeEvent<HTMLInputElement>) { const input = event.currentTarget; const file = input.files?.[0]; if (!file)
        return; setError(''); try {
        if (file.size > 1000000)
            throw new Error('Client packs must be smaller than 1 MB. Use hosted image URLs instead of embedded image data.');
        const pack = JSON.parse(await file.text());
        if (!(pack.format === 'mailcraft-design-pack-v1' && typeof pack.clientId === 'string' && Array.isArray(pack.designs) && pack.designs.length) && !(pack.format === 'mailcraft-client-pack-v1' && typeof pack.client?.name === 'string' && typeof pack.email?.title === 'string' && Array.isArray(pack.assets) && Array.isArray(pack.components)))
            throw new Error('Choose a valid Mailcraft client pack JSON file.');
        setPendingPack(pack);
        setDialog('import');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        input.value = '';
    } }
    async function importPack() { if (!pendingPack)
        return; setBusy(true); setError(''); try {
        const result = await api({ action: pendingPack.format === 'mailcraft-design-pack-v1' ? 'importDesigns' : 'onboard', pack: pendingPack });
        const response = await fetch('/api/studio', { cache: 'no-store' });
        const value = await response.json() as Data & {
            error?: string;
        };
        if (!response.ok)
            throw new Error(value.error || 'Client imported, but the workspace could not reload. Refresh to continue.');
        setData(value);
        setTeamMode(false);setClientId(result.clientId);
        setBrandDraft(null);
        const document = value.documents.find(d => d.clientId === result.clientId && d.id === result.emailId);
        if (document)
            openDoc(document);
        else {
            setDraft(null);
            setSaved('');
            setPage('emails');
        }
        setPendingPack(null);
        setDialog(null);
        notify(pendingPack.format === 'mailcraft-design-pack-v1' ? `${result.created} new designs imported. Existing drafts were preserved.` : result.existing ? 'Opened the existing client workspace. No saved work was overwritten.' : 'Client workspace, newsletter, images, and reusable designs imported.');
    }
    catch (e) {
        setError((e as Error).message);
    }
    finally {
        setBusy(false);
    } }
    function guard() { return !dirty || window.confirm('You have unsaved changes. Leave without saving?'); }
    function workspaceUrl(id:string|null,emailId?:string){const url=new URL(window.location.href);url.searchParams.delete('library');url.searchParams.delete('type');if(id)url.searchParams.set('client',id);else url.searchParams.delete('client');if(emailId)url.searchParams.set('email',emailId);else url.searchParams.delete('email');window.history.replaceState(null,'',url.pathname+url.search+url.hash);}
    function openDoc(doc: EmailDocument, mode: Component | null = null) { if(!mode)workspaceUrl(doc.clientId,doc.id);setDraft(structuredClone(doc)); setSaved(JSON.stringify(doc)); setSelected(''); setPast([]); setFuture([]); setComponentMode(mode); setPage('editor'); setPreview(false); setError(''); }
    function switchClient(id: string) {
        if (id === clientId && !teamMode && page==='emails')
            return;
        if (!guard())
            return;
        setTeamMode(false);setClientId(id);
        setBrandDraft(null);
        setComponentMode(null);
        workspaceUrl(id);
        setDraft(null);
        setSaved('');
        setSelected('');
        setPast([]);
        setFuture([]);
        setPage('emails');
        setSearch('');
    }
    function navigate(p: string) {
        if (page === 'editor' && p !== 'editor' && !guard())
            return;
        if(p!=='clients'&&!teamMode&&!clientId){notify('Open a client workspace first.');return;}
        if(page==='editor'&&p!=='editor'){setDraft(null);setSaved('');setSelected('');setComponentMode(null);setPast([]);setFuture([]);setPreview(false);}
        if(p==='clients'){setTeamMode(false);setClientId('');setDraft(null);setSaved('');setSelected('');setComponentMode(null);setBrandDraft(null);setPast([]);setFuture([]);workspaceUrl(null);}
        else if(p!=='editor'){if(teamMode)teamUrl(p);else workspaceUrl(clientId);}
        setPage(p);
        setSearch('');
        if (p === 'brand')
            setBrandDraft(structuredClone(baseBrand));
    }
    function mutate(fn: (c: EmailContent) => EmailContent) {
        if (!draft)
            return;
        setPast(p => [...p.slice(-49), structuredClone(draft.content)]);
        setFuture([]);
        setDraft({ ...draft, content: fn(draft.content) });
    }
    function prop(key: string, value: string | number | boolean) {
        if (!node)
            return;
        mutate(c => ({ ...c, blocks: updateBlock(c.blocks, node.id, n => ({ ...n, props: { ...n.props, [key]: value } })) }));
    }
    function changeHistory(redo = false) {
        if (!draft)
            return;
        const source = redo ? future : past;
        if (!source.length)
            return;
        const next = source[source.length - 1];
        if (redo) {
            setFuture(source.slice(0, -1));
            setPast(p => [...p, draft.content]);
        }
        else {
            setPast(source.slice(0, -1));
            setFuture(f => [...f, draft.content]);
        }
        setDraft({ ...draft, content: next });
    }
    async function saveDoc() {
        if (!draft || componentMode || busy)
            return;
        setBusy(true);
        setError('');
        try {
            const { document: row } = await api({ action: 'document', ...draft });
            setData(d => ({ ...d, documents: [row, ...d.documents.filter(x => x.id !== row.id)] }));
            setDraft(prev => prev && prev.id === row.id ? { ...prev, revision: row.revision, updatedAt: row.updatedAt } : prev);
            setSaved(JSON.stringify(row));
            notify('All changes saved to the workspace.');
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    async function makeDoc(title: string, kind: 'email' | 'template', content?: EmailContent, targetClientId=clientId): Promise<boolean> {
        const d: EmailDocument = { id: uid(), clientId:targetClientId, title: title.slice(0, 120), kind, content: content ? { ...structuredClone(content), blocks: content.blocks.map(cloneBlock) } : blankContent(), revision: 0, updatedAt: new Date().toISOString() };
        setBusy(true);
        setError('');
        try {
            const { document: row } = await api({ action: 'document', ...d });
            setData(v => ({ ...v, documents: [row, ...v.documents] }));
            setTeamMode(false);setClientId(targetClientId);openDoc(row);
            setDialog(null);
            notify(kind === 'template' ? 'Template draft created.' : 'Email created from an independent copy.');
            return true;
        }
        catch (e) {
            setError((e as Error).message);
            return false;
        }
        finally {
            setBusy(false);
        }
    }
    function newEmail() {
        if (!guard())
            return;
        setPage('templates');
        setSearch('');
    }
    function openTemplateSave() {
        if (!draft)
            return;
        setError('');
        setForm({ name: draft.title, description: '', campaign: 'Newsletter', industry: 'Any industry', style: 'Minimal', tags: '', scope: teamMode?'shared':'client', existing: 'new' });
        setDialog('template');
    }
    async function publishTemplate() {
        if (!draft)
            return;
        setBusy(true);
        setError('');
        try {
            const existing = latestTemplates(data.templates, clientId).find(t => t.id === form.existing);
            const { template } = await api({ action: 'template', id: existing?.id || uid(), baseVersion: existing?.version || 0, clientId: existing ? existing.clientId : form.scope === 'shared' ? null : clientId, name: form.name, metadata: { description: form.description || '', campaign: form.campaign, industry: form.industry, style: form.style, tags: (form.tags || '').split(',').map(t => t.trim()).filter(Boolean) }, content: draft.content, previewBrand: brand });
            setData(d => ({ ...d, templates: [template, ...d.templates] }));
            setDialog(null);
            notify('Published ' + template.name + ' · version ' + template.version + '. Existing emails stay unchanged.');
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function addNode(block: Block) {
        if (!draft)
            return;
        let parent: string | null = null;
        let index = draft.content.blocks.length;
        if (node?.type === 'columns') {
            parent = node.id;
            index = node.children?.length || 0;
        }
        else if (node) {
            const loc = locate(draft.content.blocks, node.id);
            if (loc) {
                parent = loc.parent;
                index = loc.index + 1;
            }
        }
        const blocks = insertAt(draft.content.blocks, parent, index, block);
        if (countTree(blocks) > 300 || treeDepth(blocks) > 6) {
            notify('Keep emails within 300 blocks and 5 nesting levels.');
            return;
        }
        mutate(c => ({ ...c, blocks }));
        setSelected(block.id);
    }
    function componentBlock(c: Component) { const block = cloneBlock(c.content); block.source = { id: c.id, version: c.version }; return block; }
    function startDrag(e: React.DragEvent, drag: Drag) { e.stopPropagation(); dragRef.current = drag; e.dataTransfer.effectAllowed = drag.kind === 'block' ? 'move' : 'copy'; e.dataTransfer.setData('application/mailcraft', JSON.stringify(drag)); setDragging(true); }
    function drop(e: React.DragEvent, parent: string | null, index: number) {
        e.preventDefault();
        e.stopPropagation();
        const drag = dragRef.current;
        setDragging(false);
        setDropOver('');
        dragRef.current = null;
        if (!drag || !draft)
            return;
        let blocks = draft.content.blocks;
        let block: Block | undefined;
        if (drag.kind === 'block') {
            block = findBlock(blocks, drag.id);
            if (!block || block.id === parent || (parent && findBlock(block.children || [], parent)))
                return;
            const old = locate(blocks, drag.id);
            if (old && old.parent === parent && old.index < index)
                index--;
            blocks = removeBlock(blocks, drag.id);
        }
        else if (drag.kind === 'new') {
            block = newBlock(drag.type);
        }
        else {
            const c = available.find(c => c.id === drag.id);
            if (c)
                block = componentBlock(c);
        }
        if (!block)
            return;
        blocks = insertAt(blocks, parent, index, block);
        if (countTree(blocks) > 300 || treeDepth(blocks) > 6) {
            notify('Keep emails within 300 blocks and 5 nesting levels.');
            return;
        }
        mutate(c => ({ ...c, blocks }));
        setSelected(block.id);
    }
    function slot(parent: string | null, index: number) { const key = (parent || 'root') + ':' + index; return <div key={'drop-' + key} className={'drop-slot ' + (dragging ? 'drag-ready ' : '') + (dropOver === key ? 'over' : '')} onDragOver={e => { e.preventDefault(); e.stopPropagation(); setDropOver(key); }} onDrop={e => drop(e, parent, index)}><span>Drop here</span></div>; }
    function move(direction: number) {
        if (!draft || !node)
            return;
        const loc = locate(draft.content.blocks, node.id);
        if (!loc || loc.index + direction < 0 || loc.index + direction >= loc.list.length)
            return;
        let blocks = removeBlock(draft.content.blocks, node.id);
        blocks = insertAt(blocks, loc.parent, loc.index + direction, node);
        mutate(c => ({ ...c, blocks }));
    }
    function duplicate() {
        if (!draft || !node)
            return;
        const loc = locate(draft.content.blocks, node.id);
        if (!loc)
            return;
        const copy = cloneBlock(node);
        mutate(c => ({ ...c, blocks: insertAt(c.blocks, loc.parent, loc.index + 1, copy) }));
        setSelected(copy.id);
    }
    function remove() {
        if (!node)
            return;
        mutate(c => ({ ...c, blocks: removeBlock(c.blocks, node.id) }));
        setSelected('');
    }
    function saveComponent(entire = false) {
        if (!draft)
            return;
        const target = entire || !node ? (draft.content.blocks.length === 1 ? draft.content.blocks[0] : { ...newBlock('columns'), props: { columns: 1, gap: 0, padding: 0, stack: true }, children: structuredClone(draft.content.blocks) }) : node;
        if (!target) {
            notify('Add a block first.');
            return;
        }
        setSaveTarget(target);
        setForm({ name: (componentMode ? draft.title : '') || labels[target.type] || 'Custom component', scope: componentMode ? (componentMode.clientId ? 'client' : 'shared') : teamMode?'shared':'client', mode: componentMode ? 'version' : 'new' });
        setDialog('component');
    }
    async function publishComponent() {
        if (!saveTarget)
            return;
        setBusy(true);
        try {
            const isVersion = componentMode && componentMode.version > 0 && form.mode === 'version';
            const { component: c } = await api({ action: 'component', id: isVersion ? componentMode.id : uid(), clientId: isVersion ? componentMode.clientId : form.scope === 'shared' ? null : clientId, name: form.name, content: cloneBlock(saveTarget), baseVersion: isVersion ? componentMode.version : 0 });
            setData(d => ({ ...d, components: [c, ...d.components] }));
            setDialog(null);
            if (componentMode) {
                setComponentMode(c);
                setSaved(JSON.stringify(draft));
            }
            notify(`Saved ${c.name} · version ${c.version}. Existing emails keep their own copies.`);
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function editComponent(c: Component) {
        if (!guard())
            return;
        openDoc({ id: 'component-' + c.id, clientId, title: c.name, kind: 'email', content: { ...blankContent(), blocks: [cloneBlock(c.content)] }, revision: 0, updatedAt: c.createdAt }, c);
    }
    async function action(run: () => Promise<void>) {
        setBusy(true);
        setError('');
        try {
            await run();
        }
        catch (e) {
            setError((e as Error).message);
        }
        finally {
            setBusy(false);
        }
    }
    function blockView(b: Block, depth = 0): React.ReactNode {
        const p = b.props;
        const active = b.id === selected;
        const style: React.CSSProperties = { padding: Number(p.padding || 0), background: resolve(p.background || '#ffffff', brand), color: resolve(p.color || '#555d6f', brand), fontFamily: brand.font };
        let inner: React.ReactNode;
        const img = (src: unknown, alt: unknown) => <img src={safeUrl(src, brand) || undefined} alt={resolve(alt, brand) || 'Image'} draggable={false} onError={e => { e.currentTarget.classList.add('image-error'); }}/>;
        switch (b.type) {
            case 'header':
                inner = <div className="email-header" style={{ color: resolve(p.color || '#ffffff', brand) }}>{brand.logo ? img(brand.logo, brand.name) : <strong>{brand.name}</strong>}<div>{resolve(p.text, brand)}<br />{brand.phone}</div></div>;
                break;
            case 'hero':
                inner = <div className="hero-block" style={{ textAlign: (p.align || 'left') as React.CSSProperties['textAlign'] }}>{p.src && img(p.src, p.alt)}{p.eyebrow && <div className="hero-eyebrow" style={{ color: resolve(p.eyebrowColor || '#6b7180', brand) }}>{resolve(p.eyebrow, brand)}</div>}<h1 style={{ fontSize: Number(p.fontSize) || 32, color: resolve(p.titleColor || '#242938', brand), whiteSpace: 'pre-line' }}>{resolve(p.title, brand)}</h1><p style={{ color: resolve(p.textColor || '#4b5260', brand) }}>{resolve(p.text, brand)}</p></div>;
                break;
            case 'text':
                inner = <div style={{ fontSize: Number(p.fontSize || 15), whiteSpace: 'pre-wrap', textAlign: p.align as React.CSSProperties['textAlign'], lineHeight: 1.7, overflowWrap: 'anywhere' }}>{resolve(p.text, brand)}</div>;
                break;
            case 'image':
                inner = p.src ? img(p.src, p.alt) : <div className="image-placeholder"><ImageIcon size={28}/><span>Select an image or paste a URL</span></div>;
                break;
            case 'button':
                style.background = resolve(p.surface || '#ffffff', brand);
                inner = <div style={{ textAlign: (p.align || 'center') as React.CSSProperties['textAlign'] }}><span className="email-button" style={{ background: resolve(p.background, brand), color: resolve(p.color, brand) }}>{resolve(p.text, brand)}</span></div>;
                break;
            case 'columns':
                inner = <div className="email-columns" style={{ gridTemplateColumns: `repeat(${mobile && p.stack !== false ? 1 : Number(p.columns) || 2},minmax(0,1fr))`, gap: Number(p.gap || 0) }}>{slot(b.id, 0)}{(b.children || []).map((child, i) => <React.Fragment key={child.id}>{blockView(child, depth + 1)}{slot(b.id, i + 1)}</React.Fragment>)}{!(b.children?.length) && <button className="empty-column" onClick={e => { e.stopPropagation(); setSelected(b.id); }}>Select a block from the library</button>}</div>;
                break;
            case 'divider':
                inner = <hr style={{ border: 0, borderTop: `1px solid ${resolve(p.color, brand)}` }}/>;
                break;
            case 'spacer':
                inner = <div className="space-block" style={{ height: Number(p.height || 24) }}><span>Spacer · {String(p.height)} px</span></div>;
                break;
            case 'footer':
                inner = <div className="email-footer"><strong>{brand.name}</strong><br />{brand.address}<br />{brand.phone}<br />{brand.website}<p>{brand.footer}</p></div>;
                break;
            default: inner = null;
        }
        return <section key={b.id} aria-label={labels[b.type] + ' block'} className={'email-block ' + (active ? 'selected ' : '') + (depth ? 'nested ' : '')} style={style} onDragOver={e => { e.preventDefault(); e.stopPropagation(); }} onDrop={e => {
                if (!draft)
                    return;
                const loc = locate(draft.content.blocks, b.id);
                if (loc) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    drop(e, loc.parent, loc.index + (e.clientY > rect.top + rect.height / 2 ? 1 : 0));
                }
            }} onClick={e => { e.stopPropagation(); setSelected(b.id); }}><div className="block-handle"><button aria-label={'Select ' + labels[b.type]} onClick={e => { e.stopPropagation(); setSelected(b.id); }} draggable onDragStart={e => startDrag(e, { kind: 'block', id: b.id })} onDragEnd={() => { setDragging(false); setDropOver(''); }}><GripVertical size={13}/>{labels[b.type]}{b.source && <span> · v{b.source.version}</span>}</button></div>{inner}</section>;
    }
    function textField(key: string, title: string, textarea = false, hint?: string) { return <Field key={key} label={title} hint={hint}>{textarea ? <textarea rows={5} value={String(node?.props[key] ?? '')} onChange={e => prop(key, e.target.value)}/> : <input value={String(node?.props[key] ?? '')} onChange={e => prop(key, e.target.value)}/>}</Field>; }
    function colorField(key: string, title: string) { const value = String(node?.props[key] || '#ffffff'); return <Field key={key} label={title}><div className="color-input"><input aria-label={title + ' picker'} type="color" value={/^#[\da-f]{6}$/i.test(value) ? value : brand.color} onChange={e => prop(key, e.target.value)}/><input aria-label={title + ' value'} value={value} onChange={e => prop(key, e.target.value)}/></div>{value === '{{color}}' && <small>Linked to client brand</small>}</Field>; }
    if (loading && !data.clients.length)
        return <div className="loading"><span className="brand-mark">m</span><h2>Opening your studio</h2><Loader2 className="spin"/><p>Loading clients and your design library…</p></div>;
    if (auth)
        return <div className="signin"><span className="brand-mark">m</span><h1>Your team’s email design studio.</h1><p>Reusable components. Every client’s brand. One creative workspace.</p><Link className="button primary" href="/">Sign in to your workspace <ArrowRight size={16}/></Link><small>Internal team access · No client accounts</small></div>;
    if (!data.clients.length)
        return <div className="loading"><h2>Unable to open the workspace</h2><p role="alert">{error}</p><button className="primary" onClick={() => load()}>Try again</button></div>;
    return <div className="studio" onDragEnd={() => { setDragging(false); setDropOver(''); }}>
    <input ref={packFile} type="file" accept=".json,application/json" aria-label="Client pack JSON file" hidden onChange={readPack}/><header className="topbar"><button className="wordmark" onClick={() => navigate('clients')}><span className="brand-mark">m</span>mailcraft<span className="wordmark-dot">.</span></button>{!teamMode && clientId && page!=='clients' && <>{client && <><div className="top-divider"/><div className="client-picker"><Building2 size={15}/><strong style={{ fontSize: 12, fontWeight: 600, color: '#242938' }}>{client.name}</strong></div></>}</>}<span className="workspace-pill">INTERNAL TEAM WORKSPACE</span><span className="top-spacer"/><span className="connection"><span />Server connected</span><AccountMenu account={account}/></header>
    <nav className="mainnav global-nav" aria-label="Main navigation"><button className={!teamMode?'active':''} onClick={()=>navigate('clients')}><Building2 size={15}/>Clients</button><button className={teamMode?'active':''} onClick={()=>openTeam()}><Layers size={15}/>Team library</button><span className="top-spacer"/><span className="nav-caption">CLIENT WORK STAYS WITH THE CLIENT. TEAM RESOURCES ARE SHARED.</span></nav>
    {page!=='editor' && (teamMode || (clientId&&page!=='clients')) && <div className="workspace-context"><div className="workspace-identity"><span className="context-icon">{teamMode?<Layers size={19}/>:<Building2 size={19}/>}</span><div><span className="eyebrow">{teamMode?'TEAM LIBRARY':'CLIENT WORKSPACE'}</span><strong>{teamMode?'Resources for every client':client?.name}</strong><small>{teamMode?'Templates, components and images your team deliberately shares.':'Emails, campaigns, contacts and brand details belong to this client.'}</small></div></div>{!teamMode&&<button className="text-link" onClick={()=>navigate('clients')}><ArrowLeft size={13}/>All clients</button>}</div>}
    {(teamMode || (clientId&&page!=='clients')) && page!=='editor' && <nav className="mainnav workspace-nav" aria-label={teamMode?'Team library navigation':'Client workspace navigation'}>{(teamMode?[{id:'templates',text:'Shared templates',icon:LayoutTemplate},{id:'components',text:'Shared components',icon:Columns2},{id:'assets',text:'Shared images',icon:ImageIcon}]:[{id:'emails',text:'Emails',icon:FileText},{id:'campaigns',text:'Campaigns',icon:Mail},{id:'audience',text:'Audience',icon:Users},{id:'sending',text:'Sending settings',icon:Settings2},{id:'templates',text:'Client templates',icon:LayoutTemplate},{id:'components',text:'Client components',icon:Columns2},{id:'assets',text:'Client images',icon:ImageIcon},{id:'brand',text:'Brand kit',icon:Palette}]).map(({id,text,icon:Icon})=><button key={id} className={section===id?'active':''} onClick={()=>navigate(id)}><Icon size={15}/>{text}</button>)}</nav>}
    {page==='editor'&&<nav className="flow-breadcrumb" aria-label="Design location"><button onClick={()=>teamMode?openTeam():navigate('clients')}>{teamMode?'Team library':'Clients'}</button><span>›</span>{!teamMode&&<><button onClick={()=>navigate('emails')}>{client?.name}</button><span>›</span></>}<button onClick={()=>navigate(backTo.page)}>{componentMode?'Components':draft?.kind==='template'?'Templates':'Emails'}</button><span>›</span><strong>{componentMode?'Component designer':'Email editor'}</strong><span className="owner-pill">{componentMode?ownerLabel(componentMode.clientId):ownerLabel(clientId)}</span></nav>}
    {error && <div className="error-bar" role="alert"><span>{error}</span><div className="row">{draft && <button onClick={() => download(filename(draft.title) + '-backup.json', JSON.stringify(draft, null, 2), 'application/json')}>Download backup</button>}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={16}/></button></div></div>}

        {page === 'editor' && draft && <><div className="documentbar"><div><button className="text-link" onClick={() => navigate(backTo.page)}><ArrowLeft size={12}/>Back to {backTo.label}</button><div className="eyebrow">{componentMode ? 'COMPONENT DESIGNER' : draft.kind === 'template' ? 'TEMPLATES / DESIGN' : 'EMAILS / DESIGN'} <span className="crumb"> / {teamMode?'Team library':client?.name}</span></div><input className="document-title" aria-label="Document title" value={draft.title} maxLength={120} onChange={e => setDraft({ ...draft, title: e.target.value })}/><div className="document-meta"><span className="status-dot"/>{componentMode ? 'Component draft' : draft.kind === 'template' ? 'Reusable template' : 'Draft email'}<span>·</span>{dirty ? 'Unsaved changes' : `Saved · ${date(draft.updatedAt)}`}{componentMode && <span>· v{componentMode.version}</span>}</div></div><div className="document-actions"><button className="icon-button" aria-label="Undo" disabled={!past.length || busy} onClick={() => changeHistory()}><Undo2 size={17}/></button><button className="icon-button" aria-label="Redo" disabled={!future.length || busy} onClick={() => changeHistory(true)}><Redo2 size={17}/></button><div className="vertical-rule"/>{!componentMode&&draft.kind==='email'&&<button disabled={busy||dirty} onClick={()=>startCampaign(draft)}><Mail size={15}/>Create campaign</button>}<button onClick={() => setPreview(!preview)}><Eye size={15}/>{preview ? 'Edit design' : 'Preview'}</button><button onClick={() => { download(filename(draft.title) + '.html', exportEmail(draft.content, brand), 'text/html'); notify('Email HTML exported. Add your sending platform’s unsubscribe field before sending.'); }}><Download size={15}/>Export HTML</button><button className="primary" disabled={busy || (!dirty && !componentMode)} onClick={() => componentMode ? saveComponent(true) : saveDoc()}>{busy ? <Loader2 size={15} className="spin"/> : <Save size={15}/>} {componentMode ? 'Publish component' : 'Save changes'}</button></div></div>
        <div className={'editor-layout ' + (preview ? 'preview-mode' : '')}>
        {!preview && <aside className="block-library"><div className="panel-heading"><h3>Build your email</h3><span className="subtle">Drag or click to add a block</span></div><div className="library-tabs">{['blocks', 'saved'].map(t => <button key={t} className={libraryTab === t ? 'active' : ''} onClick={() => setLibraryTab(t)}>{t === 'blocks' ? 'Blocks' : 'Saved'}</button>)}</div>{libraryTab === 'blocks' ? <><div className="block-grid">{types.map(type => { const Icon = icons[type]; return <button key={type} className="palette-block" draggable onDragStart={e => startDrag(e, { kind: 'new', type })} onClick={() => addNode(newBlock(type))}><Icon size={21}/><span>{labels[type]}</span></button>; })}</div><div className="library-note"><span className="tiny-label">YOUR DESIGN SYSTEM</span><p>Combine blocks into something new. Save once, reuse across emails.</p><button onClick={() => saveComponent(!node)}><Plus size={14}/>Save as component</button></div></> : <div className="saved-list">{available.map(c => <button key={c.id} className="saved-block" draggable onDragStart={e => startDrag(e, { kind: 'component', id: c.id })} onClick={() => addNode(componentBlock(c))}><DesignPreview content={sectionContent(c.content)} brand={baseBrand} title={c.name} height={82}/><strong>{c.name}</strong><span>{ownerLabel(c.clientId)} · v{c.version}</span></button>)}{!available.length && <p className="subtle">Save a section to start your library.</p>}</div>}<div className="library-bottom"><span className="tiny-label">{teamMode?'TEAM ASSET · SHARED':'BRAND CONNECTED'}</span><span className="row"><span className="color-dot" style={{ background: brand.color }}/>{teamMode?'Neutral client preview':client?.name}</span><button disabled={teamMode} onClick={() => navigate('brand')}>Manage brand kit <ArrowRight size={12}/></button></div></aside>}
        <main className="canvas-area"><div className="canvas-toolbar"><div className="device-toggle"><button aria-pressed={!mobile} className={!mobile ? 'active' : ''} onClick={() => setMobile(false)}><Monitor size={14}/>Desktop</button><button aria-pressed={mobile} className={mobile ? 'active' : ''} onClick={() => setMobile(true)}><Smartphone size={14}/>Mobile</button></div><span className="canvas-size">{mobile ? '375' : draft.content.width} px</span><button className="icon-button" aria-label="Email settings" onClick={() => setDialog('settings')}><Settings2 size={16}/></button></div><div className="canvas-stage" onDragOver={e => e.preventDefault()} onDrop={e => drop(e, null, draft.content.blocks.length)} onClick={e => {
                if (e.target === e.currentTarget)
                    setSelected('');
            }} style={{ background: draft.content.background }}>{preview ? <iframe title="Email HTML preview" sandbox="" srcDoc={exportEmail(draft.content, brand)} style={{ width: mobile ? 375 : draft.content.width, maxWidth: '100%', height: 1100, border: 0, background: '#fff' }}/> : <div className={'email-canvas ' + (mobile ? 'is-mobile' : '')} style={{ width: mobile ? 375 : draft.content.width, maxWidth: '100%' }}>{slot(null, 0)}{draft.content.blocks.map((b, i) => <React.Fragment key={b.id}>{blockView(b)}{slot(null, i + 1)}</React.Fragment>)}<button className="add-section" onClick={() => { const b = newBlock('text'); mutate(c => ({ ...c, blocks: [...c.blocks, b] })); setSelected(b.id); }} onDragOver={e => e.preventDefault()} onDrop={e => drop(e, null, draft.content.blocks.length)}><Plus size={16}/> Add a block or drop a component here</button></div>}</div><div className="canvas-footer"><span>{countTree(draft.content.blocks)} blocks</span><span>Built with reusable components <Layers size={12}/></span></div></main>
            {!preview && <aside className="inspector"><div className="panel-heading"><span className="tiny-label">{node ? 'COMPONENT SETTINGS' : 'EMAIL SETTINGS'}</span><h3>{node ? labels[node.type] : 'Make it your own'}</h3>{node && <span className="badge">{node.source ? 'Library copy · v' + node.source.version : 'Editable block'}</span>}</div>{node ? <><div className="inspector-fields">
                {node.type === 'columns' && <><Field label="Columns"><select value={Number(node.props.columns) || 2} onChange={e => prop('columns', Number(e.target.value))}>{[1, 2, 3].map(n => <option key={n} value={n}>{n} column{n > 1 ? 's' : ''}</option>)}</select></Field><Field label="Gap (px)"><input type="number" min="0" max="40" value={Number(node.props.gap) || 0} onChange={e => prop('gap', Math.max(0, Math.min(40, Number(e.target.value))))}/></Field><label className="check-field"><input type="checkbox" checked={node.props.stack !== false} onChange={e => prop('stack', e.target.checked)}/>Stack on mobile</label><div className="inline-note">Select a column block, then click or drop a block from the library to add content inside it.</div></>}
                {['text', 'button', 'header'].includes(node.type) && textField('text', node.type === 'text' ? 'Content' : 'Label', node.type === 'text')}
                {node.type === 'hero' && <>{textField('eyebrow', 'Eyebrow label')}{textField('title', 'Headline')}{textField('text', 'Supporting text', true)}{colorField('titleColor', 'Headline color')}{colorField('textColor', 'Supporting text color')}{colorField('eyebrowColor', 'Eyebrow color')}<Field label="Headline size"><input type="number" min="12" max="64" value={Number(node.props.fontSize) || 32} onChange={e => prop('fontSize', Math.max(12, Math.min(64, Number(e.target.value))))}/></Field></>}
                {['image', 'hero'].includes(node.type) && <>{textField('src', 'Image URL', false, 'Use a publicly hosted image URL.')}{textField('alt', 'Image alternative text')}{data.assets.some(a => a.clientId === clientId || a.clientId===null) && <Field label="Choose a library image"><select value="" onChange={e => {
                                const a = data.assets.find(a => a.id === e.target.value);
                                if (a) {
                                    prop('src', a.url);
                                }
                            }}><option value="">Select an image…</option>{[{id:'client',label:client?.name+' images'},{id:'team',label:'Team images · Shared'}].map(g=><optgroup key={g.id} label={g.label}>{data.assets.filter(a=>g.id==='team'?a.clientId===null:a.clientId===clientId).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</optgroup>)}</select></Field>}</>}
                {['image', 'hero', 'button', 'header'].includes(node.type) && textField('link', 'Destination link', false, 'Brand field: {{website}}')}
                {node.type === 'text' && <Field label="Text size (px)"><input type="number" min="10" max="40" value={Number(node.props.fontSize) || 15} onChange={e => prop('fontSize', Math.max(10, Math.min(40, Number(e.target.value))))}/></Field>}
                {['text', 'button', 'hero'].includes(node.type) && <Field label="Alignment"><select value={String(node.props.align || 'left')} onChange={e => prop('align', e.target.value)}><option>left</option><option>center</option><option>right</option></select></Field>}
                {['text', 'button', 'divider', 'footer', 'header'].includes(node.type) && colorField('color', node.type === 'divider' ? 'Line color' : 'Text color')}
                {['header', 'hero', 'columns', 'button', 'footer'].includes(node.type) && colorField('background', 'Background')}
                {node.type === 'button' && <button className="text-link" onClick={() => prop('background', '{{color}}')}>Use client brand color</button>}
                {node.type === 'spacer' ? <Field label="Height (px)"><input type="number" min="0" max="200" value={Number(node.props.height) || 0} onChange={e => prop('height', Math.max(0, Math.min(200, Number(e.target.value))))}/></Field> : <Field label="Padding (px)"><input type="number" min="0" max="100" value={Number(node.props.padding) || 0} onChange={e => prop('padding', Math.max(0, Math.min(100, Number(e.target.value))))}/></Field>}
                {['footer', 'header'].includes(node.type) && <button disabled={teamMode} onClick={() => navigate('brand')} className="full-width"><Palette size={14}/>Edit client details</button>}
                </div><div className="inspector-section"><h4>Arrange</h4><div className="arrange"><button aria-label="Move block up" onClick={() => move(-1)}><ArrowUp size={15}/></button><button aria-label="Move block down" onClick={() => move(1)}><ArrowDown size={15}/></button><button aria-label="Duplicate block" onClick={duplicate}><Copy size={15}/></button><button aria-label="Delete block" className="danger" onClick={remove}><Trash2 size={15}/></button></div><button className="primary full-width" onClick={() => saveComponent()}><Layers size={14}/>Save as component</button><p className="subtle">Independent copy. Changes apply only to this design.</p></div></> : <div className="inspector-fields"><p className="subtle">Select a block on the canvas to customize it.</p><Field label="Subject line"><input value={draft.content.subject} onChange={e => mutate(c => ({ ...c, subject: e.target.value }))} maxLength={200}/></Field><Field label="Inbox preview text"><textarea value={draft.content.preheader} onChange={e => mutate(c => ({ ...c, preheader: e.target.value }))} maxLength={500}/></Field><button className="full-width" onClick={() => setDialog('settings')}><Settings2 size={14}/>Layout settings</button><div className="inspector-section"><h4>Turn this into a starting point</h4><button className="full-width" onClick={() => { openTemplateSave(); }}><LayoutTemplate size={14}/>Save as template</button><button className="full-width" onClick={() => saveComponent(true)}><Layers size={14}/>Save entire design as component</button></div></div>}</aside>}
        </div></>}
    {!teamMode&&client&&['campaigns','audience','sending'].includes(page)&&<CampaignWorkspace key={clientId} client={client} documents={data.documents} view={page} initialDocumentId={campaignDocumentId} onStarted={()=>setCampaignDocumentId(null)}/>}
    {page === 'templates' && <TemplateGallery key={teamMode?'team':'client-'+clientId} teamMode={teamMode} onTeam={()=>openTeam()} onCopy={t=>beginCopy('template',t)} brand={baseBrand} clientId={clientId} versions={data.templates} legacy={data.documents} busy={busy} error={error} onUse={async (title, content) => {
                if (!guard())
                    return false;
                if(teamMode){setPendingUse({title,content});setForm({target:clientId||data.clients[0]?.id||''});setDialog('useTemplate');return true;}
                return makeDoc(title + ' — ' + baseBrand.name, 'email', content);
            }} onEdit={d => {
                if (guard())
                    openDoc(d);
            }} onBlank={() => {
                if (!guard())
                    return;
                if(teamMode){navigate('clients');notify('Open a client to design an email, then save a reusable copy to the Team library.');return;}
                setForm({ name: 'Untitled newsletter', kind: 'email' });
                setError('');
                setDialog('newEmail');
            }}/>}
    {page === 'editor' && !draft && <div className="empty-state"><Layers size={35}/><h2>A fresh canvas for this client.</h2><p>Start with a blank email or choose a template.</p><button className="primary" onClick={newEmail}><Plus size={16}/>Create an email</button></div>}

    {page === 'clients' && <main className="workspace-page"><div className="page-heading"><div><span className="eyebrow">YOUR CREATIVE WORKSPACE</span><h1>Every client. Their own world.</h1><p>Keep each brand organized, with a shared foundation for your team.</p></div><div className="row"><button disabled={busy} onClick={() => { if (guard())
            packFile.current?.click(); }}><Download size={15}/>Import pack</button><button className="primary" onClick={() => { setForm({ name: '', website: '', color: '#5145cd' }); setDialog('client'); }}><Plus size={16}/>Add client</button></div></div><div className="client-cards">{data.clients.map(c => <article className="client-card" key={c.id}><div className="client-card-top"><span className="client-monogram" style={{ background: c.brand.color + '15', color: c.brand.color }}>{c.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</span>{c.id === clientId && <span className="badge">Current workspace</span>}</div><h2>{c.name}</h2><p>{c.brand.website.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Brand workspace'}</p><div className="client-counts"><span>{data.documents.filter(d => d.clientId === c.id && d.kind === 'email').length} emails</span><span>{latest.filter(x => x.clientId === c.id).length} components</span></div><button className="full-width" onClick={() => switchClient(c.id)}>Open workspace <ArrowRight size={15}/></button></article>)}<button className="add-client-card" onClick={() => { setForm({ name: '', website: '', color: '#5145cd' }); setDialog('client'); }}><Plus size={25}/><strong>A new brand starts here</strong><span>Add a client workspace</span></button></div><div className="foundation"><div className="foundation-icon"><Layers size={23}/></div><div><h3>Designed once. Made for every client.</h3><p>Shared components inherit each client’s colors and details. Client-specific components stay in their own workspace.</p></div></div></main>}

    {page === 'emails' && <main className="workspace-page"><div className="page-heading"><div><span className="eyebrow">{client?.name.toUpperCase()}</span><h1>{page === 'emails' ? 'A little inspiration. Ready to open.' : 'Your next email starts here.'}</h1><p>{page === 'emails' ? 'Draft, refine, and export your client’s newsletters.' : 'Reusable starting points, built around this client’s brand.'}</p></div><button className="primary" onClick={() => {
                if (page === 'emails')
                    newEmail();
                else {
                    if (!guard())
                        return;
                    setForm({ name: 'Untitled template' });
                    setDialog('newEmail');
                }
            }}><Plus size={16}/>{page === 'emails' ? 'New email' : 'New template'}</button></div><div className="searchbar"><Search size={16}/><input aria-label="Search designs" placeholder="Search your designs…" value={search} onChange={e => setSearch(e.target.value)}/></div><div className="design-cards">{clientDocs.filter(d => d.kind === (page === 'emails' ? 'email' : 'template') && d.title.toLowerCase().includes(search.toLowerCase())).map(d => <article className="design-card" key={d.id}><button className="design-thumb" aria-label={'Open ' + d.title} onClick={() => {
                    if (guard())
                        openDoc(d);
                }}><DesignPreview content={d.content} brand={baseBrand} title={d.title} height={220}/></button><div className="design-card-body"><div className="row"><span className="badge">{d.kind === 'template' ? 'Template' : 'Draft'}</span><span className="subtle">Updated {date(d.updatedAt)}</span></div><h3>{d.title}</h3><div className="row"><button className="primary" onClick={() => {
                    if (guard())
                        openDoc(d);
                }}>Edit design <ArrowRight size={14}/></button>{d.kind==='email'&&<button onClick={()=>startCampaign(d)}><Mail size={13}/>Create campaign</button>}{d.kind === 'template' && <button onClick={() => {
                        if (guard())
                            makeDoc(d.title + ' copy', 'email', d.content);
                    }}>Use template</button>}<button className="icon-button" aria-label={'Delete ' + d.title} disabled={busy} onClick={() => {
                    if (!window.confirm('Delete this ' + d.kind + '? This cannot be undone.'))
                        return;
                    action(async () => {
                        await api({ action: 'deleteDocument', id: d.id, clientId, revision: d.revision });
                        setData(s => ({ ...s, documents: s.documents.filter(x => x.id !== d.id) }));
                        if (draft?.id === d.id) {
                            setDraft(null);
                            setSaved('');
                        }
                        notify('Design deleted.');
                    });
                }}><Trash2 size={15}/></button></div></div></article>)}</div>{!clientDocs.some(d => d.kind === (page === 'emails' ? 'email' : 'template')) && <div className="empty-state"><LayoutTemplate size={35}/><h2>{page === 'emails' ? 'Your first email is waiting.' : 'Create your first template.'}</h2><p>{page === 'emails' ? 'Start blank or use a template.' : 'Save an email as a template, or create one from scratch.'}</p></div>}</main>}

    {page === 'components' && <main className="workspace-page"><div className="page-heading"><div><span className="eyebrow">{teamMode?'TEAM LIBRARY / COMPONENTS':'CLIENT COMPONENTS'}</span><h1>{teamMode?'Build once. Reuse across clients.':'Building blocks for '+client?.name+'.'}</h1><p>{teamMode?'Shared resources are available to every client. Existing emails retain their own copies.':'Only components owned by this client appear here. Copy a reusable version to the Team library when ready.'}</p></div><button className="primary" onClick={() => {
                if (!guard())
                    return;
                const c: Component = { id: uid(), version: 0, clientId:teamMode?null:clientId, name: 'Untitled component', content: { ...newBlock('columns'), props: { columns: 1, padding: 0, gap: 0, stack: true }, children: [] }, createdAt: new Date().toISOString() };
                editComponent(c);
            }}><Plus size={16}/>Create component</button></div><div className="list-toolbar"><p className="ownership-note">{teamMode?'Team asset · Available to every client':ownerLabel(clientId)}</p><div className="searchbar"><Search size={15}/><input aria-label="Search components" placeholder="Find a component…" value={search} onChange={e=>setSearch(e.target.value)}/></div></div><div className="component-cards">{ownedComponents.filter(c => c.name.toLowerCase().includes(search.toLowerCase())).map(c => <article className="component-card" key={c.id}><div className="component-art component-art-live"><DesignPreview content={sectionContent(c.content)} brand={baseBrand} title={c.name} height={175}/><span className="version-badge">v{c.version}</span></div><div className="component-card-body"><span className="tiny-label">{ownerLabel(c.clientId)}</span><h3>{c.name}</h3><p>{countTree([c.content])} blocks · {brandingLabel([c.content])}</p><div className="row"><button className="primary" onClick={() => editComponent(c)}>Customize <ArrowRight size={14}/></button><button disabled={busy} onClick={()=>beginCopy('component',c)}><Copy size={13}/>{teamMode?'Copy to client':'Copy to team library'}</button><button className="icon-button" aria-label={'Version history for ' + c.name} onClick={() => { setForm({ componentId: c.id }); setDialog('history'); }}><FolderOpen size={15}/></button></div></div></article>)}</div><div className="foundation"><Layers size={24}/><div><h3>Your library can grow with your team.</h3><p>Build new components from blocks. Publish new versions when they improve. Existing emails stay unchanged.</p></div></div></main>}

    {page === 'assets' && <main className="workspace-page"><div className="page-heading"><div><span className="eyebrow">{teamMode?'TEAM LIBRARY':client?.name.toUpperCase()} / IMAGES</span><h1>The right image, ready to use.</h1><p>{teamMode?'Shared images are available to every client. Brand-specific logos and coupons should stay in the client workspace.':'These images belong to this client. Shared images live in the Team library.'}</p></div><button className="primary" onClick={() => { setForm({ name: '', url: '', scope:teamMode?'shared':'client' }); setDialog('asset'); }}><Plus size={16}/>Add image URL</button></div><div className="asset-grid">{ownedAssets.map(a => <article className="asset-card" key={a.id}><div><img src={a.url} alt={a.name}/></div><h3>{a.name}</h3><p className="ownership-note">{ownerLabel(a.clientId)}</p><button disabled={busy} onClick={()=>beginCopy('asset',a)}><Copy size={13}/>{teamMode?'Copy to client':'Copy to team library'}</button><p className="subtle" style={{padding:"0 16px"}}>Choose this image from an image block inside a client email.</p></article>)}</div>{!ownedAssets.length && <div className="empty-state"><ImageIcon size={36}/><h2>{teamMode?'A home for shared images.':'A home for your client’s images.'}</h2><p>Add image links from your website or image hosting service.</p></div>}</main>}

    {page === 'brand' && brandDraft && <main className="workspace-page"><div className="page-heading"><div><span className="eyebrow">CLIENT BRAND KIT · ALWAYS CLIENT-SPECIFIC</span><h1>Unmistakably {client?.name}.</h1><p>One source for the colors, identity, and details used in your designs.</p></div><button className="primary" disabled={busy} onClick={() => action(async () => { const { client: c } = await api({ action: 'client', id: clientId, name: brandDraft.name, brand: brandDraft, revision: client?.revision }); setData(d => ({ ...d, clients: d.clients.map(x => x.id === c.id ? c : x) })); notify('Brand kit saved. Brand-linked fields now use these values.'); })}><Save size={15}/>Save brand kit</button></div><div className="brand-layout"><section className="settings-card"><h3>Brand identity</h3>{[['name', 'Business name'], ['logo', 'Logo URL'], ['website', 'Website'], ['phone', 'Phone'], ['address', 'Business address']].map(([key, label]) => <Field key={key} label={label}><input value={brandDraft[key as keyof Brand]} onChange={e => setBrandDraft({ ...brandDraft, [key]: e.target.value })}/></Field>)}<Field label="Footer / subscription text"><textarea rows={4} value={brandDraft.footer} onChange={e => setBrandDraft({ ...brandDraft, footer: e.target.value })}/></Field><small className="subtle">Your sending platform supplies its own unsubscribe URL or merge tag.</small></section><section className="settings-card"><h3>Design defaults</h3><Field label="Primary color"><div className="color-input"><input aria-label="Brand color picker" type="color" value={brandDraft.color} onChange={e => setBrandDraft({ ...brandDraft, color: e.target.value })}/><input value={brandDraft.color} onChange={e => setBrandDraft({ ...brandDraft, color: e.target.value })}/></div></Field><Field label="Email font"><select value={brandDraft.font} onChange={e => setBrandDraft({ ...brandDraft, font: e.target.value })}><option value="Arial, Helvetica, sans-serif">Arial / Sans serif</option><option value="Georgia, Times New Roman, serif">Georgia / Serif</option><option value="Verdana, Geneva, sans-serif">Verdana / Sans serif</option></select></Field><div className="brand-preview" style={{ fontFamily: brandDraft.font }}><span className="tiny-label">BRAND PREVIEW</span><h2>{brandDraft.name}</h2><p>A consistent look, in every newsletter.</p><span className="email-button" style={{ background: brandDraft.color }}>Explore more</span></div><div className="inline-note">Use <code>{'{{color}}'}</code>, <code>{'{{website}}'}</code>, <code>{'{{name}}'}</code>, and <code>{'{{phone}}'}</code> in component fields to inherit client details.</div></section></div></main>}

    {toast && <div className="toast" role="status"><Check size={17}/>{toast}</div>}
        {dialog && <Dialog title={{ client: 'Add a client workspace', component: 'Save to component library', asset: teamMode?'Add a shared image':'Add a client image', newEmail: form.kind === 'template' ? 'Create a template' : 'Create an email', settings: 'Email settings', template: 'Save as template', history: 'Component versions', import: 'Import Mailcraft pack', copy:'Save an independent library copy', useTemplate:'Choose a client for this email' }[dialog]} onClose={() => setDialog(null)}>
        {error && <div className="dialog-error" role="alert">{error}</div>}{dialog === 'history' ? <div className="version-list">{data.components.filter(c => c.id === form.componentId).sort((a, b) => b.version - a.version).map(c => <div key={c.version}><div><strong>Version {c.version}</strong><p>{c.name} · {date(c.createdAt)}</p></div><button onClick={() => { setDialog(null); editComponent(c); }}>Open version</button></div>)}</div> : <form onSubmit={e => {
                    e.preventDefault();
                    if(dialog==='copy'){void action(copyResource);return;}
                    if(dialog==='useTemplate'&&pendingUse){const target=data.clients.find(c=>c.id===form.target);if(target)void makeDoc(pendingUse.title+' — '+target.name,'email',pendingUse.content,target.id);return;}
                    if (dialog === 'import') {
                        void importPack();
                        return;
                    }
                    if (dialog === 'component') {
                        void publishComponent();
                        return;
                    }
                    if (dialog === 'newEmail') {
                        void makeDoc(form.name, form.kind === 'template' ? 'template' : 'email');
                        return;
                    }
                    if (dialog === 'template' && draft) {
                        void publishTemplate();
                        return;
                    }
                    if (dialog === 'client') {
                        void action(async () => {
                            const { client: c } = await api({ action: 'client', id: uid(), name: form.name, brand: { ...defaultBrand, name: form.name, website: form.website, color: form.color }, revision: 0 });
                            setData(d => ({ ...d, clients: [...d.clients, c] }));
                            if (!guard())
                                return;
                            setClientId(c.id);
                            setDraft(null);
                            setSaved('');
                            setPage('emails');
                            setDialog(null);
                            notify('Client workspace created.');
                        });
                        return;
                    }
                    if (dialog === 'asset') {
                        void action(async () => { const { asset } = await api({ action: 'asset', clientId: form.scope==='shared'?null:clientId, name: form.name, url: form.url }); setData(d => ({ ...d, assets: [asset, ...d.assets] })); setDialog(null); notify(form.scope==='shared'?'Image added to Team library.':'Image added to client library.'); });
                        return;
                    }
                    if (dialog === 'settings') {
                        setDialog(null);
                        return;
                    }
                }}>
            {dialog === 'import' && pendingPack?.format === 'mailcraft-design-pack-v1' && <div className="client-import-review"><h3>{data.clients.find(c => c.id === pendingPack.clientId)?.name || pendingPack.clientId}</h3><p>Add {pendingPack.designs.length} editable designs to this existing client workspace.</p><ul>{pendingPack.designs.map(d => <li key={d.id}>{d.title}{d.template ? ' — draft and reusable template' : ''}</li>)}</ul><div className="inline-note">Existing designs are preserved. Importing the same pack again will not duplicate or overwrite them.</div></div>}{dialog === 'import' && pendingPack?.format === 'mailcraft-client-pack-v1' && <div className="client-import-review"><h3>{pendingPack.client.name}</h3><p>{pendingPack.email.title}</p><ul><li>Client brand kit and contact details</li><li>{pendingPack.assets.length} image-library entries</li><li>{pendingPack.components.length} reusable client components</li><li>One editable newsletter draft{pendingPack.template ? ' and reusable template' : ''}</li></ul><div className="inline-note">Imports create a separate client workspace. Importing the same pack again opens the existing client without overwriting saved work.</div></div>}{['client', 'component', 'asset', 'newEmail', 'template'].includes(dialog) && <Field label={dialog === 'client' ? 'Client name' : dialog === 'asset' ? 'Image name' : 'Name'}><input autoFocus required maxLength={120} value={form.name || ''} onChange={e => setForm({ ...form, name: e.target.value })}/></Field>}
            {dialog === 'client' && <><Field label="Website"><input type="url" required placeholder="https://example.com" value={form.website || ''} onChange={e => setForm({ ...form, website: e.target.value })}/></Field><Field label="Brand color"><input type="color" value={form.color} onChange={e => setForm({ ...form, color: e.target.value })}/></Field></>}
            {dialog==='copy'&&copyItem&&<><p className="ownership-note">Original: {ownerLabel(copyItem.value.clientId)}</p><Field label="Copy name"><input required maxLength={120} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></Field><Field label="Save copy to"><select value={form.target} onChange={e=>setForm({...form,target:e.target.value})}>{copyItem.value.clientId!==null&&<option value="team">Team library · Available to every client</option>}{data.clients.filter(c=>c.id!==copyItem.value.clientId).map(c=><option key={c.id} value={c.id}>{c.name} · Client only</option>)}</select></Field><div className="inline-note">The original stays in its library. This creates a separate copy. Fixed text, links and images are retained; review client branding before reuse.</div></>}{dialog==='useTemplate'&&<><Field label="Destination client"><select required value={form.target||''} onChange={e=>setForm({...form,target:e.target.value})}><option value="" disabled>Select a client</option>{data.clients.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></Field><div className="inline-note">Creates an independent email inside this client’s workspace. Review any fixed images, offers and links before using the design.</div></>}{dialog==='asset'&&<p className="ownership-note">Save to: {form.scope==='shared'?'Team library · Available to every client':ownerLabel(clientId)}</p>}{dialog === 'asset' && <Field label="Public image URL" hint="Use your website or image CDN. Private links won’t display in recipients’ emails."><input type="url" required value={form.url || ''} onChange={e => setForm({ ...form, url: e.target.value })}/></Field>}
            {dialog === 'component' && <>{componentMode && componentMode.version > 0 && <Field label="Save behavior"><select value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value })}><option value="version">Publish version {componentMode.version + 1}</option><option value="new">Create a new component</option></select></Field>}<Field label="Save to"><select disabled={form.mode === 'version' && !!componentMode?.version} value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}><option value="client" disabled={!clientId}>{client?.name || 'Choose a client first'} · Client only</option><option value="shared">Team library · Available to every client</option></select></Field><div className="inline-note">Existing emails retain independent copies. New versions are available for future designs.</div></>}
            {dialog === 'template' && <><Field label="Publish as"><select value={form.existing} onChange={e => { const t = latestTemplates(data.templates, clientId).find(t => t.id === e.target.value); setForm(t ? { ...form, existing: t.id, name: t.name, description: t.metadata.description, campaign: t.metadata.campaign, industry: t.metadata.industry, style: t.metadata.style, tags: t.metadata.tags.join(', '), scope: t.clientId ? 'client' : 'shared' } : { ...form, existing: 'new' }); }}><option value="new">New template</option>{latestTemplates(data.templates, clientId).map(t => <option key={t.id} value={t.id}>{t.name + ' · Publish version ' + (t.version + 1)}</option>)}</select></Field><Field label="Save to"><select disabled={form.existing !== 'new'} value={form.scope} onChange={e => setForm({ ...form, scope: e.target.value })}><option value="client" disabled={!clientId}>{client?.name || 'Choose a client first'} · Client only</option><option value="shared">Team library · Available to every client</option></select></Field><Field label="Description"><textarea maxLength={500} rows={2} value={form.description || ''} onChange={e => setForm({ ...form, description: e.target.value })}/></Field>{[{ label: 'Campaign type', key: 'campaign', options: campaigns }, { label: 'Industry', key: 'industry', options: industries }, { label: 'Design style', key: 'style', options: designStyles }].map(f => <Field key={f.key} label={f.label}><select value={form[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })}>{[...new Set([...f.options, form[f.key]])].filter(Boolean).map(o => <option key={o}>{o}</option>)}</select></Field>)}<Field label="Tags" hint="Up to 12 tags, separated by commas."><input value={form.tags || ''} onChange={e => setForm({ ...form, tags: e.target.value })}/></Field><div className="inline-note">This publishes a reusable snapshot. Existing emails and earlier template versions stay unchanged.</div></>}
            {dialog === 'settings' && draft && <><Field label="Subject line"><input value={draft.content.subject} maxLength={200} onChange={e => mutate(c => ({ ...c, subject: e.target.value }))}/></Field><Field label="Inbox preview text"><textarea value={draft.content.preheader} maxLength={500} onChange={e => mutate(c => ({ ...c, preheader: e.target.value }))}/></Field><Field label="Email width"><select value={draft.content.width} onChange={e => mutate(c => ({ ...c, width: Number(e.target.value) }))}>{[600, 640, 680, 720].map(w => <option key={w} value={w}>{w} px</option>)}</select></Field><Field label="Surrounding background"><input type="color" value={draft.content.background} onChange={e => mutate(c => ({ ...c, background: e.target.value }))}/></Field><button type="button" className="text-link" onClick={() => download(filename(draft.title) + '.json', JSON.stringify(draft, null, 2), 'application/json')}>Download editable JSON backup</button></>}
            <div className="dialog-actions"><button type="button" onClick={() => setDialog(null)}>Cancel</button><button type="submit" className="primary" disabled={busy}>{busy ? <Loader2 size={15} className="spin"/> : <Check size={15}/>} {dialog==='copy'?'Save copy':dialog==='useTemplate'?'Create client email':dialog === 'settings' ? 'Done' : dialog === 'component' ? 'Save component' : dialog === 'client' ? 'Create workspace' : dialog === 'asset' ? 'Add image' : dialog === 'template' ? 'Publish template' : dialog === 'import' ? pendingPack?.format === 'mailcraft-design-pack-v1' ? 'Import designs' : 'Create client workspace' : 'Create design'}</button></div></form>}
        </Dialog>}
    </div>;
}

