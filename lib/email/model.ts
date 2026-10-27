export type Brand = {
    name: string;
    logo: string;
    color: string;
    background: string;
    font: string;
    phone: string;
    website: string;
    address: string;
    footer: string;
};
export type Client = {
    id: string;
    name: string;
    brand: Brand;
    revision: number;
    updatedAt: string;
};
export type Block = {
    id: string;
    type: string;
    props: Record<string, string | number | boolean>;
    children?: Block[];
    source?: {
        id: string;
        version: number;
    };
};
export type EmailContent = {
    subject: string;
    preheader: string;
    width: number;
    background: string;
    blocks: Block[];
    design?: {
        color: string;
        font: string;
    };
};
export type TemplateMetadata = {
    description: string;
    campaign: string;
    industry: string;
    style: string;
    tags: string[];
};
export type SavedTemplate = {
    id: string;
    version: number;
    clientId: string | null;
    name: string;
    content: EmailContent;
    metadata: TemplateMetadata;
    previewBrand: Brand;
    createdAt: string;
};
export type EmailDocument = {
    id: string;
    clientId: string;
    title: string;
    kind: 'email' | 'template';
    content: EmailContent;
    revision: number;
    updatedAt: string;
};
export type Component = {
    id: string;
    version: number;
    clientId: string | null;
    name: string;
    content: Block;
    createdAt: string;
};
export type Asset = {
    id: string;
    clientId: string | null;
    name: string;
    url: string;
    createdAt: string;
};
export const uid = () => crypto.randomUUID();
export const cloneBlock = (node: Block): Block => ({ ...node, id: uid(), props: { ...node.props }, children: node.children?.map(cloneBlock) });
export function findBlock(nodes: Block[], id: string): Block | undefined {
    for (const n of nodes) {
        if (n.id === id)
            return n;
        const child = findBlock(n.children || [], id);
        if (child)
            return child;
    }
}
export function updateBlock(nodes: Block[], id: string, fn: (n: Block) => Block): Block[] { return nodes.map(n => n.id === id ? fn(n) : { ...n, children: n.children ? updateBlock(n.children, id, fn) : undefined }); }
export function removeBlock(nodes: Block[], id: string): Block[] { return nodes.filter(n => n.id !== id).map(n => ({ ...n, children: n.children ? removeBlock(n.children, id) : undefined })); }
export const types = ['header', 'hero', 'text', 'image', 'button', 'columns', 'divider', 'spacer', 'footer'] as const;
export const labels: Record<string, string> = { header: 'Brand header', hero: 'Hero banner', text: 'Text', image: 'Image', button: 'Button', columns: 'Columns', divider: 'Divider', spacer: 'Spacer', footer: 'Business footer' };
export const isContainer = (b: Block) => b.type === 'columns';
export function newBlock(type: string): Block {
    const defaults: Record<string, Record<string, string | number | boolean>> = {
        header: { background: '#303239', padding: 20, link: '{{website}}', text: 'SERVICE COUPONS' }, hero: { title: 'A fresh season. A new opportunity.', text: 'Discover what’s new this month.', background: '#e8e3d7', padding: 36 }, text: { text: 'Write something worth opening. Share your latest news, offers, or ideas.', color: '#555d6f', fontSize: 15, padding: 24, align: 'left' }, image: { src: '', alt: 'Describe your image', link: '', padding: 0 }, button: { text: 'Explore offers', link: '{{website}}', background: '{{color}}', color: '#ffffff', padding: 20, align: 'center' }, columns: { columns: 2, gap: 12, padding: 12, background: '#f0f0f3', stack: true }, divider: { color: '#e3e5ed', padding: 16 }, spacer: { height: 24 }, footer: { background: '#303239', color: '#ffffff', padding: 24 }
    };
    return { id: uid(), type, props: { ...(defaults[type] || defaults.text) }, ...(type === 'columns' ? { children: [newBlock('text'), newBlock('button')] } : {}) };
}
export const defaultBrand: Brand = { name: 'New client', logo: '', color: '#144fa8', background: '#ffffff', font: 'Arial, Helvetica, sans-serif', phone: '', website: 'https://example.com', address: '', footer: 'You are receiving this email because you subscribed to updates.' };
export function blankContent(): EmailContent { return { subject: '', preheader: '', width: 680, background: '#eceef3', blocks: [newBlock('header'), newBlock('hero'), newBlock('text'), newBlock('button'), newBlock('footer')] }; }
export function sampleClient(): Client { return { id: 'toyota-meridian', name: 'Toyota of Meridian', brand: { ...defaultBrand, name: 'Toyota of Meridian', logo: 'https://static.fixedopsmarketing.com/media/toyota_of_meridian_logo_new.png', color: '#144fa8', phone: '(601) 429-5869', website: 'https://www.toyotaofmeridian.com/meridian-toyota-service-parts-specials/', address: '3010 MS-39 · Meridian, MS 39301', footer: 'You have received this email because you are a recent customer of Toyota of Meridian, or opted in to receive coupons and other marketing messages.' }, revision: 1, updatedAt: new Date().toISOString() }; }
export function sampleContent(): EmailContent {
    const image = (src: string, link: string, alt: string): Block => ({ id: uid(), type: 'image', props: { src, link, alt, padding: 0 } });
    const specials = 'https://www.toyotaofmeridian.com/meridian-toyota-service-parts-specials/';
    const blocks: Block[] = [newBlock('header'), image('https://static.fixedopsmarketing.com/media/october_theme_scared_yet_email_featured.jpg', specials, 'October seasonal service offers'), { ...newBlock('text'), props: { ...newBlock('text').props, text: 'This Halloween, clear out the cobwebs from under your vehicle’s hood to prepare for the chill of autumn. Take advantage of this last chance to prepare… before it’s too late!\n\nClick “View Offers” to see our month’s specials at Toyota of Meridian!' } }, { ...newBlock('button'), props: { ...newBlock('button').props, text: 'VIEW OFFERS' } }];
    const ids = ['554161', '566714', '554024', '554009', '554065', '553982'];
    const names = ['Toyota tire event', 'Spooky savings bundle', 'Synthetic oil change', 'Synthetic oil service', 'Pick-up and delivery', 'Front or rear brake service'];
    for (let i = 0; i < 6; i += 2) {
        const row = newBlock('columns');
        row.children = [i, i + 1].map(j => image('https://fomstatic.s3-us-west-1.amazonaws.com/media/email/' + ids[j] + '.jpg', specials + '?single=' + ids[j], names[j]));
        blocks.push(row);
    }
    blocks.push(newBlock('footer'));
    return { subject: 'October service specials at Toyota of Meridian', preheader: 'Prepare for autumn with this month’s service offers.', width: 680, background: '#222222', blocks };
}
