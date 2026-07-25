import type { APIRoute } from 'astro';

// インデックスさせたいページだけを列挙する。
// /line/ は / と内容が完全一致の重複ページなので載せない（noindex + robots Disallow 済み）。
const PAGES = [
  { path: '', priority: '1.0' },
  { path: 'subsidy/', priority: '0.9' },
  { path: 'business/', priority: '0.9' },
  { path: 'uchimado/', priority: '0.8' },
];

export const GET: APIRoute = ({ site }) => {
  const urls = PAGES.map(({ path, priority }) => {
    const loc = new URL(path, site).href;
    return `  <url>\n    <loc>${loc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${priority}</priority>\n  </url>`;
  }).join('\n');

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
