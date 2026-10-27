import type { Block, Brand, EmailContent } from './model';
export const escapeHtml = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
export function resolve(value: unknown, brand: Brand): string { return String(value ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => key === 'onColor' ? contrastColor(brand.color) : String(brand[key as keyof Brand] ?? '')); }
export function contrastColor(hex: string): string { const channels = /^#[a-f\d]{6}$/i.test(hex) ? [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) : [0, 0, 0]; const values = channels.map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4); const luminance = values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722; return luminance > 0.179 ? '#142033' : '#ffffff'; }
export function safeUrl(v: unknown, brand: Brand): string { const value = resolve(v, brand).trim(); return /^(https?:\/\/|mailto:|tel:)/i.test(value) ? value : ''; }
const col = (v: unknown, brand: Brand, fallback: string) => /^#[0-9a-f]{3,8}$/i.test(resolve(v, brand)) ? resolve(v, brand) : fallback;
const num = (v: unknown, fallback: number, max = 100) => Math.max(0, Math.min(max, Number.isFinite(Number(v)) ? Number(v) : fallback));
export function renderBlock(block: Block, brand: Brand, availableWidth = 680): string {
    const p = block.props;
    const text = (v: unknown) => escapeHtml(resolve(v, brand));
    const pad = num(p.padding, 0);
    const table = (s: string) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${s}</table>`;
    const image = (src: unknown, alt: unknown, link?: unknown) => {
        const url = safeUrl(src, brand);
        if (!url)
            return '';
        const html = `<img src="${escapeHtml(url)}" alt="${text(alt)}" width="${Math.max(1, Math.floor(availableWidth - pad * 2))}" style="display:block;width:100%;max-width:100%;height:auto;border:0;">`;
        const href = safeUrl(link, brand);
        return href ? `<a href="${escapeHtml(href)}">${html}</a>` : html;
    };
    let content = '';
    let bg = col(p.background, brand, '#ffffff');
    switch (block.type) {
        case 'text':
            content = `<div style="font-size:${num(p.fontSize, 15, 40)}px;line-height:1.65;color:${col(p.color, brand, '#555d6f')};text-align:${['left', 'center', 'right'].includes(String(p.align)) ? p.align : 'left'};">${text(p.text).replace(/\n/g, '<br>')}</div>`;
            break;
        case 'image':
            content = image(p.src, p.alt, p.link);
            break;
        case 'hero':
            content = `<div style="text-align:${['left', 'center', 'right'].includes(String(p.align)) ? p.align : 'left'};">${image(p.src, p.alt, p.link)}${p.eyebrow ? `<div style="font-size:11px;letter-spacing:2px;margin-bottom:22px;color:${col(p.eyebrowColor, brand, '#6b7180')};">${text(p.eyebrow)}</div>` : ''}<h1 style="margin:0 0 18px;font-size:${num(p.fontSize, 32, 64)}px;line-height:1.12;color:${col(p.titleColor, brand, '#242938')};">${text(p.title).replace(/\n/g, '<br>')}</h1><div style="font-size:16px;line-height:1.6;color:${col(p.textColor, brand, '#4b5260')};">${text(p.text)}</div></div>`;
            break;
        case 'button':
            content = table(`<tr><td align="${['left', 'center', 'right'].includes(String(p.align)) ? p.align : 'center'}"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${col(p.background, brand, brand.color)}" style="border-radius:4px;mso-padding-alt:14px 24px;"><a href="${escapeHtml(safeUrl(p.link, brand) || brand.website)}" style="display:inline-block;padding:14px 24px;font-size:16px;font-weight:bold;text-decoration:none;color:${col(p.color, brand, '#ffffff')};">${text(p.text)}</a></td></tr></table></td></tr>`);
            bg = col(p.surface, brand, '#ffffff');
            break;
        case 'header': {
            const logo = safeUrl(brand.logo, brand);
            content = table(`<tr><td width="45%" valign="middle">${logo ? `<img src="${escapeHtml(logo)}" alt="${text(brand.name)}" width="150" style="max-width:100%;height:auto;display:block;">` : `<span style="color:${col(p.color, brand, '#ffffff')};font-size:20px;font-weight:bold;">${text(brand.name)}</span>`}</td><td width="55%" align="right" valign="middle" style="font-size:12px;line-height:1.8;"><a href="${escapeHtml(safeUrl(p.link, brand))}" style="color:${col(p.color, brand, '#ffffff')};text-decoration:none;">${text(p.text)}</a><br><a href="tel:${escapeHtml(brand.phone.replace(/[^+\d]/g, ''))}" style="color:${col(p.color, brand, '#ffffff')};text-decoration:none;">${text(brand.phone)}</a></td></tr>`);
            break;
        }
        case 'footer':
            content = `<div style="color:${col(p.color, brand, '#ffffff')};font-size:12px;line-height:1.8;"><strong>${text(brand.name)}</strong><br>${text(brand.address)}<br>${text(brand.phone)}<br><a href="${escapeHtml(safeUrl(brand.website, brand))}" style="color:inherit;">${text(brand.website)}</a><br><br>${text(brand.footer)}</div>`;
            break;
        case 'spacer': return `<tr><td height="${num(p.height, 24, 200)}" style="font-size:1px;line-height:1px;">&nbsp;</td></tr>`;
        case 'divider':
            content = `<div style="height:1px;background:${col(p.color, brand, '#e3e5ed')};font-size:1px;">&nbsp;</div>`;
            break;
        case 'columns': {
            const count = num(p.columns, 2, 3) || 2;
            const gap = num(p.gap, 12, 40);
            const children = block.children || [];
            const rows = [];
            for (let i = 0; i < children.length; i += count) {
                const cells = children.slice(i, i + count).map(child => `<td ${p.stack !== false ? 'class="mc-stack"' : ''} width="${Math.floor(100 / count)}%" valign="top" style="padding:${gap / 2}px;">${table(renderBlock(child, brand, (availableWidth - pad * 2) / count - gap))}</td>`);
                while (cells.length < count)
                    cells.push(`<td width="${Math.floor(100 / count)}%"></td>`);
                rows.push(`<tr>${cells.join('')}</tr>`);
            }
            content = table(rows.join(''));
            break;
        }
        default: content = '';
    }
    return `<tr><td bgcolor="${bg}" style="padding:${pad}px;font-family:${escapeHtml(brand.font)};">${content}</td></tr>`;
}
export function exportEmail(content: EmailContent, brand: Brand): string { brand = { ...brand, ...content.design }; const width = num(content.width, 680, 900) || 680; const background = col(content.background, brand, '#eceef3'); return `<!DOCTYPE html><html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(content.subject || brand.name)}</title><!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]--><style>body{margin:0;padding:0;width:100%!important}table{border-spacing:0;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt}img{border:0;-ms-interpolation-mode:bicubic}a{word-break:break-word}@media screen and (max-width:480px){.mc-stack{display:block!important;width:100%!important;box-sizing:border-box!important}.mc-wrap{width:100%!important}}</style></head><body style="background:${background};"><div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${escapeHtml(content.preheader)}${'&zwnj;&nbsp;'.repeat(30)}</div><table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0" bgcolor="${background}"><tr><td align="center"><!--[if mso]><table role="presentation" width="${width}" align="center"><tr><td><![endif]--><div style="max-width:${width}px;margin:0 auto;"><table role="presentation" class="mc-wrap" width="100%" border="0" cellpadding="0" cellspacing="0" style="background:#fff;">${content.blocks.map(n => renderBlock(n, brand, width)).join('')}</table></div><!--[if mso]></td></tr></table><![endif]--></td></tr></table></body></html>`; }
