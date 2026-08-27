import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const src=path.join(root,'event-platform');
const out=path.join(root,'dist-localspace');
const origin=(process.env.LOCALSPACE_CANONICAL_ORIGIN||'https://nknkny-localspace.pages.dev').replace(/\/$/,'');
const sourceSha=process.env.LOCALSPACE_SOURCE_SHA||'local';
if(!/^https:\/\/[^/]+$/.test(origin)) throw new Error(`invalid origin: ${origin}`);
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(out,{recursive:true});
for(const file of ['index.html','app.js','app-data.js','app-render.js','app-form.js','app-dashboard.js','app-init.js','styles.css','terms.html','privacy.html','legal-boundaries.html']) fs.copyFileSync(path.join(src,file),path.join(out,file));
let index=fs.readFileSync(path.join(out,'index.html'),'utf8');
index=index.replace('<meta name="robots" content="noindex,nofollow,noarchive">','<meta name="robots" content="index,follow,max-image-preview:large">');
index=index.replace('<title>ローカルスペース｜場所と小さな催しをつなぐ</title>',`<title>ローカルスペース｜場所と小さな催しをつなぐ</title>\n<link rel="canonical" href="${origin}/">`);
index=index.replace('<strong>開発プレビュー</strong>','<strong>無料公開版</strong>');
index=index.replace('青森市で実証開始予定・全国展開前提。現在は無料の情報掲載・検索・イベント告知のみ。','青森市から実証中・全国展開前提。現在は無料の情報掲載・検索・イベント告知のみ。');
fs.writeFileSync(path.join(out,'index.html'),index);
for(const file of ['terms.html','privacy.html','legal-boundaries.html']){
  const p=path.join(out,file);let s=fs.readFileSync(p,'utf8');
  s=s.replaceAll('開発版','無料公開版').replaceAll('開発プレビュー','無料公開版');
  s=s.replace('</title>',`</title>\n<link rel="canonical" href="${origin}/${file}">`);
  fs.writeFileSync(p,s);
}
const headers=`/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  X-Frame-Options: DENY\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://fpgtwgtoqtokpitzlbie.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests\n\n/app.js\n  Cache-Control: public, max-age=300, must-revalidate\n/styles.css\n  Cache-Control: public, max-age=300, must-revalidate\n`;
fs.writeFileSync(path.join(out,'_headers'),headers);
fs.writeFileSync(path.join(out,'robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
const urls=['/','/terms.html','/privacy.html','/legal-boundaries.html'];
fs.writeFileSync(path.join(out,'sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(u=>`\n  <url><loc>${origin}${u}</loc></url>`).join('')}\n</urlset>\n`);
fs.writeFileSync(path.join(out,'DEPLOYMENT.json'),JSON.stringify({app:'localspace',build:'2026-08-27-cloudflare-r1',canonicalOrigin:origin,sourceSha,generatedAt:new Date().toISOString(),commercialPayments:false,successFee:false,booking:false},null,2));

const forbidden=['buy.stripe.com','Pro 30日パス','1,980円','create_interest','request_action','prepare_pro_purchase'];
const joined=fs.readdirSync(out).filter(f=>/\.(html|js|css|txt|xml|json)$/.test(f)).map(f=>fs.readFileSync(path.join(out,f),'utf8')).join('\n');
for(const needle of forbidden) if(joined.includes(needle)) throw new Error(`forbidden production string: ${needle}`);
if(index.includes('noindex,nofollow')) throw new Error('production index still noindex');
if(!index.includes(`<link rel="canonical" href="${origin}/">`)) throw new Error('canonical missing');
console.log(`LocalSpace production artifact ready: ${out}`);
