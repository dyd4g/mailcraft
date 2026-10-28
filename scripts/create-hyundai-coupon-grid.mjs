// Builds the Hyundai "service coupons" email: rows of two linked coupon images, as requested by the dealership.
// Output: outputs/hyundai-meridian-coupon-grid.email.json (email document) and a rendered .preview.html.
// Run: node scripts/create-hyundai-coupon-grid.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import ts from 'typescript';

const SITE = 'https://www.hyundaiofmeridian.com/service-offers/';
// Banner images are served from the app itself (public/clients/hyundai-of-meridian/), so they go live with a deploy.
const ASSETS = 'https://mailcraft-app.happyriver-0d77ea09.centralus.azurecontainerapps.io/clients/hyundai-of-meridian/';
const UPLOADS = 'https://api.motorperks.com/uploads/campaign-previews/';
const link = (slug) => `${SITE}?utm_source=newsletter&utm_medium=email&utm_campaign=service_coupons&utm_content=${slug}`;

// Coupons in the dealership's requested order. Add the remaining ones (Sunbit financing, GOOD and Brake & Rotor) in their
// slots when the artwork arrives: row 2 left/right and row 3 left.
export const coupons = [
  { slug: 'full-synthetic-oil-change', file: 'coupon-full-synthetic-oil-change.png', alt: 'Full Synthetic Oil Change: $69.99, up to 5 quarts. Protect your engine. Power every mile.' },
  { slug: 'better-bundle', file: 'coupon-better-bundle.png', alt: 'BETTER Bundle: oil and filter change, tire rotation, cabin filter or air filter, and fuel treatment, $169.99. Hyundai vehicles only.' },
  { slug: 'alignment', file: 'coupon-alignment.png', alt: 'Alignment: $20 off. Straighten your drive. Extend your tire life.' },
  { slug: 'best-bundle', file: 'coupon-best-bundle.png', alt: 'BEST Bundle: oil and filter change, tire rotation, cabin filter, air filter, fuel treatment and oil additive, $225.99. Hyundai vehicles only.' },
];

let n = 100;
const id = () => `hyundai-grid-${n++}`;
const text = (t, o = {}) => ({ id: id(), type: 'text', props: { text: t, fontSize: 16, color: '#43536b', background: '#ffffff', padding: 26, align: 'left', ...o } });
const cell = (c) => ({
  id: id(), type: 'image',
  props: { src: ASSETS + c.file, alt: c.alt, link: link(c.slug), padding: 0, background: '#ffffff' },
});
const row = (pair) => ({
  id: id(), type: 'columns',
  props: { columns: 2, gap: 12, padding: 14, stack: true, background: '#ffffff' },
  children: pair.map(cell),
});

const rows = [];
for (let i = 0; i < coupons.length; i += 2) rows.push(row(coupons.slice(i, i + 2)));

export const couponGridEmail = {
  id: 'hyundai-meridian-service-coupons-2', // -2: the first version hotlinked images the host blocks; imports never overwrite, so this is a new ID
  title: 'Hyundai of Meridian — Service Coupons',
  content: {
    subject: 'Hyundai service coupons: oil change $69.99, alignment $20 off',
    preheader: 'Pick your coupon: Full Synthetic Oil Change, BETTER and BEST Bundles, and an alignment special.',
    width: 680,
    background: '#e9eef5',
    blocks: [
      { id: id(), type: 'header', props: { background: '#ffffff', color: '#002c5f', padding: 24, link: SITE, text: 'SERVICE COUPONS' } },
      { id: id(), type: 'image', props: { src: ASSETS + 'fall-savings-hay.jpg', alt: 'Fall savings on service bundles', link: SITE, padding: 0, background: '#ffffff' } },
      text('Tap a coupon to see the details and schedule with the Hyundai of Meridian service team.', { align: 'center' }),
      { id: id(), type: 'image', props: { src: ASSETS + 'fall-service-bundles-banner.jpg', alt: 'Fall service bundles', link: SITE, padding: 0, background: '#ffffff' } },
      ...rows,
      { id: id(), type: 'text', props: { text: 'Ready for your next service visit?', fontSize: 25, color: '#002c5f', background: '#edf3f9', padding: 28, align: 'center' } },
      { id: id(), type: 'button', props: { text: 'Schedule service', link: 'https://www.hyundaiofmeridian.com/service/schedule-service/', background: '{{color}}', color: '{{onColor}}', surface: '#edf3f9', padding: 24, align: 'center' } },
      { id: id(), type: 'text', props: { text: 'Questions? Call 601-685-4070.\nSee offer details for complete terms and availability.', fontSize: 12, color: '#63748a', background: '#edf3f9', padding: 20, align: 'center' } },
      { id: id(), type: 'footer', props: { background: '#002c5f', color: '#ffffff', padding: 28 } },
    ],
  },
};

if (import.meta.url === new URL(process.argv[1], 'file:///').href || process.argv[1]?.endsWith('create-hyundai-coupon-grid.mjs')) {
  const root = new URL('../', import.meta.url);
  writeFileSync(new URL('outputs/hyundai-meridian-coupon-grid.email.json', root), JSON.stringify(couponGridEmail, null, 2));
  const load = (p) => ts.transpileModule(readFileSync(new URL(p, root), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const modelUri = 'data:text/javascript;base64,' + Buffer.from(load('lib/email/model.ts')).toString('base64');
  const renderSrc = load('lib/email/render.ts').replace(/from ['"]\.\/model['"]/g, 'from ' + JSON.stringify(modelUri));
  const render = await import('data:text/javascript;base64,' + Buffer.from(renderSrc).toString('base64'));
  const pack = JSON.parse(readFileSync(new URL('outputs/hyundai-meridian-client-pack.azure.json', root), 'utf8'));
  const html = render.exportEmail(couponGridEmail.content, pack.client.brand);
  writeFileSync(new URL('outputs/hyundai-meridian-coupon-grid.preview.html', root), html);
  // Design pack for Clients > Import client pack: the three earlier Hyundai designs plus this one, pointing at the Azure address.
  const { hyundaiDesignPack } = await import('./create-hyundai-designs.mjs');
  const old = 'https://mailcraft-studio.nifty-skunk-1607.chatgpt.site/';
  const designPack = JSON.parse(JSON.stringify(hyundaiDesignPack).replaceAll(old, ASSETS.replace('clients/hyundai-of-meridian/', '')));
  designPack.designs.push({
    id: couponGridEmail.id, title: couponGridEmail.title, content: couponGridEmail.content,
    template: { id: 'hyundai-meridian-service-coupons-2-template', name: couponGridEmail.title, metadata: { description: 'Fall service coupons in rows of two linked coupon images under a seasonal banner.', campaign: 'Promotion', industry: 'Automotive', style: 'Image-led', tags: ['Hyundai', 'service', 'coupons', 'fall'] } },
  });
  writeFileSync(new URL('outputs/hyundai-design-pack.azure.json', root), JSON.stringify(designPack, null, 2));
  console.log('wrote design pack with', designPack.designs.length, 'designs');
  console.log('wrote email json and preview;', coupons.length, 'coupons in', rows.length, 'rows;', html.length, 'bytes of HTML');
}
