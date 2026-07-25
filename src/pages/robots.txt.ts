import type { APIRoute } from 'astro';

// ステージング（GitHub Pages）は全面 Disallow、本番のみクロールを許可する。
// ページ側の noindex だけに頼ると、クロール自体は走ってしまうため robots.txt でも塞ぐ。
export const GET: APIRoute = ({ site }) => {
  const isProduction = site?.origin === 'https://lp.madoa.co.jp';

  const body = isProduction
    ? [
        'User-agent: *',
        'Allow: /',
        // /line/ は / と内容が完全に同一の重複ページ。noindex に加えてクロールも止める
        'Disallow: /line/',
        '',
        `Sitemap: ${new URL('sitemap.xml', site).href}`,
        '',
      ].join('\n')
    : ['User-agent: *', 'Disallow: /', ''].join('\n');

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
