import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceDir = path.join(repoRoot, 'akiya-pocket');
const outDir = path.join(repoRoot, 'dist');

const oldBase = 'https://nknkny.github.io/Homepage/akiya-pocket';
const oldOrigin = 'https://nknkny.github.io';
const oldWorker = 'https://rapid-hat-f45c.jmdjdtdjdt.workers.dev';
const adminBase = 'https://nknkny.github.io/Homepage/akiya-pocket/control-center';

function asOrigin(raw) {
  if (!raw) return '';
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    throw new Error(`Invalid deployment URL: ${raw}`);
  }
}

function stablePagesOrigin(deploymentOrigin) {
  const override = asOrigin(process.env.AKIYA_CANONICAL_ORIGIN || '');
  if (override) return override;
  const u = new URL(deploymentOrigin);
  if (!u.hostname.endsWith('.pages.dev')) return deploymentOrigin;
  const parts = u.hostname.split('.');
  if (parts.length <= 3) return deploymentOrigin;
  const project = parts.at(-3);
  return `${u.protocol}//${project}.pages.dev`;
}

const deploymentOrigin = asOrigin(
  process.env.CF_PAGES_URL ||
  process.env.AKIYA_DEPLOYMENT_URL ||
  'https://akiyapocket.pages.dev'
);
const canonicalOrigin = stablePagesOrigin(deploymentOrigin);
const allowedOrigins = [...new Set([canonicalOrigin, deploymentOrigin])];
const sourceSha = String(process.env.AKIYA_SOURCE_SHA || process.env.GITHUB_SHA || '').trim();
if (sourceSha && !/^[0-9a-f]{40}$/i.test(sourceSha)) throw new Error(`Invalid source SHA: ${sourceSha}`);

if (!fs.existsSync(sourceDir)) throw new Error(`Missing source directory: ${sourceDir}`);
fs.rmSync(outDir, { recursive: true, force: true });
fs.cpSync(sourceDir, outDir, {
  recursive: true,
  filter: (src) => path.basename(src) !== '.github',
});

// The owner control center intentionally stays on GitHub Pages because its
// authenticated APIs allow that origin. Do not publish a stale/broken copy on
// the customer-facing Cloudflare site.
fs.rmSync(path.join(outDir, 'control-center'), { recursive: true, force: true });

const textExtensions = new Set(['.html', '.js', '.css', '.txt', '.xml', '.json', '.webmanifest', '.md']);
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (textExtensions.has(path.extname(entry.name).toLowerCase())) {
      let body = fs.readFileSync(file, 'utf8');
      body = body.split(oldBase).join(canonicalOrigin);
      body = body.split(oldWorker).join(canonicalOrigin);
      body = body.split(oldOrigin).join(canonicalOrigin);
      fs.writeFileSync(file, body);
    }
  }
}
walk(outDir);

// Japanese headings should not leave a single character stranded on a final
// line. Chromium/modern browsers balance only headings, leaving body copy and
// the explicitly fixed homepage hero lines unchanged.
const sharedStylePath = path.join(outDir, 'assets', 'style.css');
fs.appendFileSync(sharedStylePath, '\n/* Final responsive typography guard */\nh1,h2{text-wrap:balance}\n');

const configPath = path.join(outDir, 'assets', 'config.js');
const config = `window.AKIYA_CONFIG = {\n` +
  `  FRONTEND_BUILD: "2026-08-21-cloudflare-pages-r1",\n` +
  `  API_URL: "https://fpgtwgtoqtokpitzlbie.supabase.co/functions/v1/akiya-pocket-api",\n` +
  `  REQUIRED_API_BUILD: "2026-08-14-legal-final-r10",\n` +
  `  PAYMENT_API_URL: "https://fpgtwgtoqtokpitzlbie.supabase.co/functions/v1/akiya-pocket-payment-api",\n` +
  `  PAYMENT_API_BUILD: "2026-08-18-payment-bridge-r2",\n` +
  `  SITE_ORIGIN: ${JSON.stringify(canonicalOrigin)},\n` +
  `  ALLOWED_SITE_ORIGINS: ${JSON.stringify(allowedOrigins, null, 2).replaceAll('\n', '\n  ')},\n` +
  `  API_TIMEOUT_MS: 45000,\n` +
  `  SITE_NAME: "空家ポケット",\n` +
  `  SERVICE_AREA: "青森市",\n` +
  `  TURNSTILE_SITE_KEY: ""\n` +
  `};\n`;
fs.writeFileSync(configPath, config);

const headers = `/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  X-Frame-Options: DENY\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), usb=()\n  Strict-Transport-Security: max-age=31536000; includeSubDomains\n  Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; object-src 'none'\n\n/DEPLOYMENT.json\n  Cache-Control: no-store, max-age=0\n/VERSION.txt\n  Cache-Control: no-store, max-age=0\n/robots.txt\n  Cache-Control: no-store, max-age=0\n/sitemap.xml\n  Cache-Control: no-store, max-age=0\n/assets/config.js\n  Cache-Control: no-store, max-age=0\n/assets/api.js\n  Cache-Control: no-store, max-age=0\n/assets/site.js\n  Cache-Control: no-cache, max-age=0, must-revalidate\n/assets/style.css\n  Cache-Control: no-cache, max-age=0, must-revalidate\n/member.html\n  Cache-Control: no-store, max-age=0\n/member-login.html\n  Cache-Control: no-store, max-age=0\n/profile.html\n  Cache-Control: no-store, max-age=0\n/request.html\n  Cache-Control: no-store, max-age=0\n/checkout.html\n  Cache-Control: no-store, max-age=0\n/payment-success.html\n  Cache-Control: no-store, max-age=0\n/delete-account.html\n  Cache-Control: no-store, max-age=0\n/reset-password.html\n  Cache-Control: no-store, max-age=0\n/account-recovery.html\n  Cache-Control: no-store, max-age=0\n/unsubscribe.html\n  Cache-Control: no-store, max-age=0\n/newsletter-unsubscribe.html\n  Cache-Control: no-store, max-age=0\n/checklist.html\n  Cache-Control: no-store, max-age=0\n/member-survey.html\n  Cache-Control: no-store, max-age=0\n`;
fs.writeFileSync(path.join(outDir, '_headers'), headers);

const redirects = `/control-center ${adminBase}/ 302\n/control-center/ ${adminBase}/ 302\n/control-center/* ${adminBase}/:splat 302\n`;
fs.writeFileSync(path.join(outDir, '_redirects'), redirects);

const marker = {
  build: '2026-08-21-cloudflare-pages-r1',
  sourceSha,
  canonicalOrigin,
  deploymentOrigin,
  generatedAt: new Date().toISOString(),
};
fs.writeFileSync(path.join(outDir, 'DEPLOYMENT.json'), JSON.stringify(marker, null, 2) + '\n');

const home = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
if (!home.includes(`<link rel="canonical" href="${canonicalOrigin}/">`)) throw new Error('Canonical replacement failed');
if (!home.includes('空家ポケット')) throw new Error('Homepage missing expected brand');
if (!fs.readFileSync(configPath, 'utf8').includes(`SITE_ORIGIN: ${JSON.stringify(canonicalOrigin)}`)) throw new Error('Config origin replacement failed');
if (home.includes(oldBase) || home.includes(oldWorker)) throw new Error('Legacy production URL remains in homepage');
if (fs.existsSync(path.join(outDir, 'control-center'))) throw new Error('Control center leaked into customer artifact');
if (!fs.existsSync(path.join(outDir, '_redirects'))) throw new Error('Admin redirect file missing');

console.log(JSON.stringify({ ok: true, outDir, canonicalOrigin, deploymentOrigin, allowedOrigins, sourceSha }, null, 2));
