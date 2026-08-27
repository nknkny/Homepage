import fs from 'node:fs';

function read(path) { return fs.readFileSync(path, 'utf8'); }
function write(path, content) { fs.writeFileSync(path, content); }
function replaceOnce(content, from, to, label) {
  if (!content.includes(from)) throw new Error(`Missing expected text for ${label}`);
  return content.replace(from, to);
}
function appendOnce(content, marker, block) {
  return content.includes(marker) ? content : `${content.trimEnd()}\n\n${block.trim()}\n`;
}

// Main HTML: load the enterprise layer statically, remove an ineffective meta-only directive,
// improve live-region semantics, and avoid misusing tab semantics for a filter group.
{
  const path = 'event-platform/index.html';
  let s = read(path);
  s = replaceOnce(s, "frame-ancestors 'none'; ", '', 'meta CSP frame-ancestors');
  s = replaceOnce(s, '<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css">\n<link rel="stylesheet" href="enterprise.css" data-enterprise-layer>', 'static enterprise stylesheet');
  s = replaceOnce(s, '<div class="discover-tabs" role="tablist" aria-label="掲載種別">', '<div class="discover-tabs" aria-label="掲載種別">', 'filter semantics');
  s = replaceOnce(s, '<div id="calendarList" class="calendar-list"></div>', '<div id="calendarList" class="calendar-list" aria-live="polite"></div>', 'calendar live region');
  write(path, s);
}

// Core robustness and terminology.
{
  const path = 'event-platform/app.js';
  let s = read(path);
  s = replaceOnce(s, "build: '2026-08-27-ui-v4'", "build: '2026-08-28-ui-v5'", 'build id');
  s = replaceOnce(s, "const TYPES = { space: '使える場所', want: '場所を探している企画', event: 'イベント' };", "const TYPES = { space: '使える場所', want: '開催場所を探す企画', event: 'イベント' };", 'type label');
  s = replaceOnce(s,
    "const key = (x) => `localspace_${x}`;\nconst read = (x, fallback) => { try { const v = localStorage.getItem(key(x)); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } };\nconst write = (x, v) => localStorage.setItem(key(x), JSON.stringify(v));",
    "const key = (x) => `localspace_${x}`;\nconst memoryStore = new Map();\nconst read = (x, fallback) => {\n  const k = key(x);\n  try {\n    const v = localStorage.getItem(k);\n    if (v != null) { memoryStore.set(k, v); return JSON.parse(v); }\n  } catch {}\n  try { const v = memoryStore.get(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; }\n};\nconst write = (x, v) => {\n  const k = key(x); const raw = JSON.stringify(v); memoryStore.set(k, raw);\n  try { localStorage.setItem(k, raw); return true; } catch { return false; }\n};\nconst removeStored = (x) => { const k = key(x); memoryStore.delete(k); try { localStorage.removeItem(k); } catch {} };",
    'storage fallback');
  s = replaceOnce(s, "  dashboard: { listings: [], notifications: [] },\n  selectedFiles: [],", "  dashboard: { listings: [], notifications: [] },\n  selectedFiles: [],\n  calendarDatePreset: '',\n  postType: 'space',", 'explicit state');
  s = replaceOnce(s, "function identity() {\n  let v = read('identity', null);\n  if (!v || !/^[0-9a-f-]{36}$/i.test(v.ownerId || '') || text(v.ownerKey).length < 32) {", "const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;\nconst SECRET_RE = /^[0-9a-f]{64}$/i;\nfunction identity() {\n  let v = read('identity', null);\n  if (!v || !UUID_RE.test(v.ownerId || '') || !SECRET_RE.test(v.ownerKey || '')) {", 'identity validation');
  s = replaceOnce(s, "function safeHttps(v) {\n  try { const u = new URL(text(v)); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; }\n}", "function safeHttps(v) {\n  try { const u = new URL(text(v)); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }\n}", 'https URL validation');
  s = replaceOnce(s, "  const headers = { 'Content-Type': 'application/json' };\n  if (options.auth) Object.assign(headers, authHeaders());", "  const headers = {};\n  if (options.body !== undefined) headers['Content-Type'] = 'application/json';\n  if (options.auth) Object.assign(headers, authHeaders());", 'GET preflight reduction');
  write(path, s);
}

// Form validation and event-first wording.
{
  const path = 'event-platform/app-form.js';
  let s = read(path);
  s = replaceOnce(s, "? '<strong>場所を探している</strong><p>ポップアップ、物販、ライブ等の一時利用企画を公開し、公開条件の近いSPACEを探します。</p>'", "? '<strong>イベントを開きたい</strong><p>ポップアップ、物販、ライブ等の一時利用企画を公開し、公開条件の近い開催場所を探します。</p>'", 'want explainer');
  s = replaceOnce(s, "  if (body.type !== 'space' && (!body.dateStart || !body.dateEnd)) errors.push('日付を入力してください。');\n  if (body.type === 'event' && !body.eventRightsConfirmed)", "  if (body.type !== 'space' && (!body.dateStart || !body.dateEnd)) errors.push('日付を入力してください。');\n  if (body.type !== 'space' && body.dateStart && body.dateEnd && body.dateEnd < body.dateStart) errors.push('終了日は開始日以降にしてください。');\n  if (body.type === 'space' && body.availableFrom && body.availableTo && body.availableTo < body.availableFrom) errors.push('利用可能期間の終了日は開始日以降にしてください。');\n  if ([body.capacity, body.sizeSqm, body.priceAmount, body.budgetMax].some((v) => !Number.isFinite(v) || v < 0)) errors.push('人数・広さ・料金・予算は0以上の数値で入力してください。');\n  if (body.capacity > 0 && !Number.isInteger(body.capacity)) errors.push('人数は整数で入力してください。');\n  if (body.type === 'event' && !body.eventRightsConfirmed)", 'date and numeric validation');
  s = replaceOnce(s, "  const ctx = canvas.getContext('2d', { alpha: false }); ctx.drawImage(bitmap, 0, 0, w, h); bitmap.close?.();", "  const ctx = canvas.getContext('2d', { alpha: false });\n  if (!ctx) { bitmap.close?.(); throw new Error('画像処理を開始できませんでした。'); }\n  ctx.drawImage(bitmap, 0, 0, w, h); bitmap.close?.();", 'canvas context check');
  write(path, s);
}

// Management-key handling and image rendering hardening.
{
  const path = 'event-platform/app-dashboard.js';
  let s = read(path);
  s = replaceOnce(s,
    "function renderExistingImages(r) {\n  const urls = r.imageUrls || [], paths = r.imagePaths || [];\n  $('existingImages').innerHTML = urls.map((u, i) => `<div class=\"image-tile\"><img src=\"${esc(safeHttps(u))}\" alt=\"登録画像${i+1}\"><button type=\"button\" class=\"image-remove\" data-listing=\"${esc(r.id)}\" data-delete-image=\"${esc(paths[i] || '')}\">削除</button></div>`).join('');\n  bindDynamic($('existingImages'));\n}",
    "function renderExistingImages(r) {\n  const urls = r.imageUrls || [], paths = r.imagePaths || [];\n  const items = urls.map((u, i) => ({ url: safeHttps(u), path: paths[i] || '', index: i })).filter((x) => x.url);\n  $('existingImages').innerHTML = items.map((x) => `<div class=\"image-tile\"><img src=\"${esc(x.url)}\" alt=\"登録画像${x.index+1}\"><button type=\"button\" class=\"image-remove\" data-listing=\"${esc(r.id)}\" data-delete-image=\"${esc(x.path)}\">削除</button></div>`).join('');\n  bindDynamic($('existingImages'));\n}",
    'existing image URL filter');
  s = replaceOnce(s, "    for (const k of ['identity','dashboard_cache']) localStorage.removeItem(key(k));", "    for (const k of ['identity','dashboard_cache']) removeStored(k);", 'safe storage deletion');
  s = replaceOnce(s,
    "function exportIdentity() {\n  const payload = { app: 'localspace', version: 1, ...identity() };\n  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })); a.download = `localspace-management-key-${new Date().toISOString().slice(0,10)}.json`; a.click(); URL.revokeObjectURL(a.href);\n}",
    "function exportIdentity() {\n  const payload = { app: 'localspace', version: 1, ...identity() };\n  const objectUrl = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));\n  const a = document.createElement('a'); a.href = objectUrl; a.download = `event-platform-management-key-${new Date().toISOString().slice(0,10)}.json`; a.hidden = true; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(objectUrl), 0);\n}",
    'management key export');
  s = replaceOnce(s, "    if (v.app !== 'localspace' || !/^[0-9a-f-]{36}$/i.test(v.ownerId || '') || text(v.ownerKey).length < 32) throw new Error('INVALID');", "    if (v.app !== 'localspace' || !UUID_RE.test(v.ownerId || '') || !SECRET_RE.test(v.ownerKey || '')) throw new Error('INVALID');", 'management key import validation');
  write(path, s);
}

// SPA history should behave like navigation instead of replacing every route.
{
  const path = 'event-platform/app-init.js';
  let s = read(path);
  s = replaceOnce(s,
    "function route(id) {\n  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));\n  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === id));\n  if (id === 'dashboard') loadDashboard();\n  if (id === 'favorites') renderFavorites();\n  if (id === 'calendar') { loadCalendar(); track('calendar_view', null, { route: 'calendar' }); }\n  history.replaceState(null, '', `#${id}`); window.scrollTo({ top: 0, behavior: 'smooth' });\n}",
    "const ROUTES = new Set(['discover','calendar','post','dashboard','favorites']);\nfunction route(id, historyMode = 'push') {\n  if (!ROUTES.has(id)) id = 'discover';\n  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === id));\n  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === id));\n  if (id === 'dashboard') loadDashboard();\n  if (id === 'favorites') renderFavorites();\n  if (id === 'calendar') { loadCalendar(); track('calendar_view', null, { route: 'calendar' }); }\n  const nextHash = `#${id}`;\n  if (historyMode === 'replace') history.replaceState({ route: id }, '', nextHash);\n  else if (historyMode === 'push' && location.hash !== nextHash) history.pushState({ route: id }, '', nextHash);\n  window.scrollTo({ top: 0, behavior: 'smooth' });\n}\nfunction routeFromHistory() { const h = location.hash.replace('#',''); route(ROUTES.has(h) ? h : 'discover', 'none'); }",
    'SPA routing history');
  s = replaceOnce(s, "  const h = location.hash.replace('#',''); if (['discover','calendar','post','dashboard','favorites'].includes(h)) route(h);", "  const h = location.hash.replace('#',''); route(ROUTES.has(h) ? h : 'discover', 'replace');", 'initial route');
  s = replaceOnce(s, "document.addEventListener('DOMContentLoaded', init);", "window.addEventListener('popstate', routeFromHistory);\ndocument.addEventListener('DOMContentLoaded', init);", 'back navigation listener');
  write(path, s);
}

// Enterprise UI hardening: keyboard focus, reduced motion, balanced headings, and a complete mobile nav.
{
  const path = 'event-platform/enterprise.css';
  let s = read(path);
  s = appendOnce(s, '/* Final accessibility and mobile hardening — 2026-08-28 */', `
/* Final accessibility and mobile hardening — 2026-08-28 */
:where(a,button,input,select,textarea,[tabindex]):focus-visible{outline:3px solid #84adff;outline-offset:3px}
.hero h1,.page-hero h1,.section-heading h2{text-wrap:balance}
@media(max-width:560px){
  .nav nav{width:100%;max-width:none;justify-content:center;overflow-x:auto;padding-inline:0}
  .nav nav button{padding:8px 7px;font-size:10px}
  .page-hero h1{font-size:clamp(32px,10vw,39px);line-height:1.14}
}
@media(prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  *,*::before,*::after{scroll-behavior:auto!important;animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}
}`);
  write(path, s);
}

// Legal pages receive a dedicated layout and neutral, non-final service descriptor.
const legalCss = `:root{--legal-ink:#101828;--legal-muted:#667085;--legal-line:#e4e7ec;--legal-soft:#f8fafc;--legal-brand:#ff4f32;--legal-link:#175cd3}\n.legal-page{background:#f8fafc;color:var(--legal-ink);line-height:1.85}\n.legal-page .site-header{position:sticky;top:0;background:rgba(255,255,255,.97);border-bottom:1px solid var(--legal-line);backdrop-filter:blur(14px)}\n.legal-page .nav{min-height:68px;align-items:center}.legal-page .brand{font-size:15px;text-decoration:none}.navlinks{display:flex;gap:18px;align-items:center}.navlinks a{font-size:12px;font-weight:800;color:#475467;text-decoration:none}.navlinks a:hover{text-decoration:underline;text-underline-offset:4px}\n.legal-main{padding:64px 0 88px}.legal-shell{width:min(920px,calc(100% - 36px))}.legal-shell>.eyebrow{color:var(--legal-brand);font-size:10px;letter-spacing:.17em;font-weight:900}.legal-shell>h1{font-size:clamp(36px,6vw,60px);line-height:1.1;letter-spacing:-.045em;margin:12px 0 18px;text-wrap:balance}.legal-shell .lead{font-size:16px;color:#475467;margin:0 0 34px}.legal-section{background:#fff;border:1px solid var(--legal-line);border-radius:16px;padding:26px 28px;margin:16px 0}.legal-section h2{font-size:20px;line-height:1.45;margin:0 0 12px;letter-spacing:-.02em}.legal-section p,.legal-section li{font-size:14px;color:#344054}.legal-section ul,.legal-section ol{padding-left:1.45em}.legal-section li+li{margin-top:7px}.legal-section a,.source-list a{color:var(--legal-link);text-underline-offset:3px}.legal-alert{background:#fff4ed;border:1px solid #ffd6ae;border-radius:16px;padding:20px 22px;margin:24px 0}.legal-alert>strong{display:block;color:#b93815;margin-bottom:5px}.legal-alert p{margin:0;color:#7a2e0e;font-size:13px}.legal-date{color:var(--legal-muted);font-size:12px;margin-top:28px}.legal-page footer{background:#101828;color:#d0d5dd}.legal-page .footer-row{min-height:76px;display:flex;align-items:center;justify-content:space-between;gap:18px;font-size:11px}.legal-page .footer-row a{color:#fff}.legal-page :where(a,button):focus-visible{outline:3px solid #84adff;outline-offset:3px}\n@media(max-width:680px){.legal-page .nav{align-items:flex-start}.navlinks{width:100%;overflow-x:auto;gap:14px;padding-bottom:3px}.navlinks a{white-space:nowrap}.legal-main{padding:42px 0 64px}.legal-shell{width:min(100% - 24px,920px)}.legal-shell .lead{font-size:14px}.legal-section{padding:20px 18px;border-radius:13px}.legal-section h2{font-size:18px}.legal-section p,.legal-section li{font-size:13px}.legal-page .footer-row{align-items:flex-start;flex-direction:column;justify-content:center;padding:20px 0}}\n@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}\n`;
write('event-platform/legal.css', legalCss);

for (const path of ['event-platform/terms.html','event-platform/privacy.html','event-platform/legal-boundaries.html']) {
  let s = read(path);
  s = s.replaceAll('ローカルスペース', 'イベント告知・マッチング');
  s = replaceOnce(s, '<link rel="stylesheet" href="styles.css">', '<link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="legal.css">', `${path} legal stylesheet`);
  if (path.endsWith('privacy.html')) {
    s = s.replaceAll('匿名利用計測', '第一者利用計測');
    s = s.replaceAll('匿名分析用セッションID', '分析用セッションID');
    s = s.replaceAll('匿名計測', '利用計測');
    s = s.replaceAll('匿名集計', '集計');
  }
  if (path.endsWith('legal-boundaries.html')) {
    s = s.replace('イベント告知・マッチング・イベント情報プラットフォームの取扱範囲と禁止事項', 'イベント告知・マッチング開発版の取扱範囲と禁止事項');
  }
  write(path, s);
}

// Internal docs: remove unverified final-brand wording and avoid claiming the analytics identifier is legally anonymous.
for (const path of ['event-platform/LAUNCH_CHECKLIST.md','event-platform/LEGAL_RESEARCH.md','event-platform/OPERATIONS.md','event-platform/STRATEGY.md']) {
  let s = read(path);
  s = s.replaceAll('ローカルスペース', 'イベント告知・マッチング');
  s = s.replaceAll('匿名第一者分析', '第一者利用分析');
  s = s.replaceAll('匿名分析用セッションID', '分析用セッションID');
  write(path, s);
}
{
  const path = 'event-platform/LEGAL_RESEARCH.md';
  let s = read(path);
  s = replaceOnce(s, '## 個人情報・分析\n\n', '## 個人情報・分析\n\n- ブラウザ識別子・端末識別子に類する情報は個人関連情報等に該当し得るため、単にハッシュ化したことだけを根拠に「匿名加工情報」または法的に匿名な情報とは扱わない。公開ポリシーでは取得項目・利用目的・保存期間を具体的に説明する。\n', 'privacy legal note');
  s = appendOnce(s, '- 個人情報保護委員会「個人情報の保護に関する法律についてのガイドラインに関するQ&A」', `
- 個人情報保護委員会「個人情報の保護に関する法律についてのガイドラインに関するQ&A」  
  https://www.ppc.go.jp/personalinfo/faq/APPI_QA/`);
  write(path, s);
}

// Cloudflare Pages production-ready static security headers. GitHub Pages ignores this file;
// Cloudflare Pages will apply it once the user completes account authorization and deployment.
write('event-platform/_headers', `/*\n  X-Frame-Options: DENY\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://fpgtwgtoqtokpitzlbie.supabase.co; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'; upgrade-insecure-requests\n`);

// Browser E2E: remove the now-unnecessary preview warning exception, capture the actual home view,
// verify browser-back navigation and mobile nav visibility, and run WCAG A/AA checks with axe.
{
  const path = 'event-platform/browser-e2e.mjs';
  let s = read(path);
  s = replaceOnce(s, "import { chromium } from 'playwright';\nimport assert from 'node:assert/strict';", "import { chromium } from 'playwright';\nimport AxeBuilder from '@axe-core/playwright';\nimport assert from 'node:assert/strict';", 'axe import');
  s = replaceOnce(s, "const KNOWN_PREVIEW_WARNINGS = [\n  \"The Content Security Policy directive 'frame-ancestors' is ignored when delivered via a <meta> element.\",\n];\n\n", '', 'remove known preview warning');
  s = replaceOnce(s, "    const text = message.text();\n    if (KNOWN_PREVIEW_WARNINGS.some((known) => text.includes(known))) return;\n    errors.push(`${label} console: ${text}`);", "    const text = message.text();\n    errors.push(`${label} console: ${text}`);", 'console errors strict');
  s = replaceOnce(s, "async function assertNoHorizontalOverflow(page, label) {", "async function assertAccessible(page, label) {\n  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();\n  const serious = result.violations.filter((v) => ['serious','critical'].includes(v.impact || ''));\n  assert.deepEqual(serious.map((v) => ({ id: v.id, impact: v.impact, targets: v.nodes.map((n) => n.target) })), [], `${label}: serious/critical accessibility violations`);\n}\n\nasync function assertNoHorizontalOverflow(page, label) {", 'accessibility helper');
  s = replaceOnce(s, "  await assertNoHorizontalOverflow(page, 'desktop');\n\n  await page.locator('#enterpriseLocation')", "  await assertNoHorizontalOverflow(page, 'desktop-home');\n  await assertAccessible(page, 'desktop-home');\n  await page.screenshot({ path: '/tmp/event-platform-home-desktop.png', fullPage: true });\n\n  await page.locator('#enterpriseLocation')", 'desktop home evidence');
  s = replaceOnce(s, "  assert.ok((await page.url()).includes('#calendar'));\n\n  await page.locator('[data-nav=\"discover\"]').first().click();", "  assert.ok((await page.url()).includes('#calendar'));\n  await page.goBack();\n  await page.waitForSelector('#discover.view.active', { timeout: 15000 });\n  assert.ok((await page.url()).includes('#discover'));\n\n  await page.locator('[data-nav=\"discover\"]').first().click();", 'browser back navigation');
  s = replaceOnce(s, "  await page.screenshot({ path: '/tmp/event-platform-desktop.png', fullPage: true });\n  assert.deepEqual(errors, [], errors.join('\\n'));", "  await assertAccessible(page, 'desktop-post');\n  await page.screenshot({ path: '/tmp/event-platform-desktop.png', fullPage: true });\n  assert.deepEqual(errors, [], errors.join('\\n'));", 'desktop post accessibility');
  s = replaceOnce(s, "  await assertNoHorizontalOverflow(page, 'mobile');\n\n  await page.locator('[data-enterprise-date=\"weekend\"]')", "  await assertNoHorizontalOverflow(page, 'mobile-home');\n  const lastNav = await page.locator('[data-nav=\"favorites\"]').boundingBox();\n  assert.ok(lastNav && lastNav.x >= 0 && lastNav.x + lastNav.width <= 390, 'mobile: favorites navigation must be visible without clipping');\n  await assertAccessible(page, 'mobile-home');\n  await page.screenshot({ path: '/tmp/event-platform-home-mobile.png', fullPage: true });\n\n  await page.locator('[data-enterprise-date=\"weekend\"]')", 'mobile home evidence');
  s = replaceOnce(s, "  await page.screenshot({ path: '/tmp/event-platform-mobile.png', fullPage: true });\n  assert.deepEqual(errors, [], errors.join('\\n'));", "  await assertAccessible(page, 'mobile-calendar');\n  await page.screenshot({ path: '/tmp/event-platform-mobile.png', fullPage: true });\n  assert.deepEqual(errors, [], errors.join('\\n'));", 'mobile calendar accessibility');
  write(path, s);
}

// CI: verify the production header template/legal styling and run axe with the browser suite.
{
  const path = '.github/workflows/event-platform-autopilot.yml';
  let s = read(path);
  s = replaceOnce(s, "          test -f event-platform/enterprise.css\n          grep -Fq 'enterprise-search' event-platform/enterprise.css", "          test -f event-platform/enterprise.css\n          test -f event-platform/legal.css\n          test -f event-platform/_headers\n          grep -Fq 'enterprise-search' event-platform/enterprise.css\n          grep -Fq 'enterprise.css\" data-enterprise-layer' event-platform/index.html\n          ! grep -Fq \"frame-ancestors 'none'\" event-platform/index.html\n          grep -Fq \"frame-ancestors 'none'\" event-platform/_headers\n          grep -Fq '第一者利用計測' event-platform/privacy.html", 'static hardening checks');
  s = replaceOnce(s, "          for file in styles.css enterprise.css app.js app-data.js app-render.js app-form.js app-dashboard.js app-init.js terms.html privacy.html legal-boundaries.html; do", "          for file in styles.css enterprise.css legal.css _headers app.js app-data.js app-render.js app-form.js app-dashboard.js app-init.js terms.html privacy.html legal-boundaries.html; do", 'deployment evidence files');
  s = replaceOnce(s, "          grep -Fq 'enterprise-search' /tmp/enterprise.css", "          grep -Fq 'enterprise-search' /tmp/enterprise.css\n          grep -Fq 'legal-shell' /tmp/legal.css\n          grep -Fq \"frame-ancestors 'none'\" /tmp/_headers", 'deployed hardening checks');
  s = replaceOnce(s, "          npm install --no-save --no-package-lock playwright@1.55.0", "          npm install --no-save --no-package-lock playwright@1.55.0 @axe-core/playwright@4.10.2", 'axe dependency');
  s = replaceOnce(s, "            /tmp/enterprise.css\n            /tmp/app.js", "            /tmp/enterprise.css\n            /tmp/legal.css\n            /tmp/_headers\n            /tmp/app.js", 'artifact hardening evidence');
  s = replaceOnce(s, "            /tmp/event-platform-desktop.png\n            /tmp/event-platform-mobile.png", "            /tmp/event-platform-home-desktop.png\n            /tmp/event-platform-home-mobile.png\n            /tmp/event-platform-desktop.png\n            /tmp/event-platform-mobile.png", 'home screenshots evidence');
  write(path, s);
}

// Checklist: record everything that can be prepared before account-owner authentication.
{
  const path = 'event-platform/LAUNCH_CHECKLIST.md';
  let s = read(path);
  s = replaceOnce(s, '- [x] GitHub Pages開発プレビューでPC/スマホ実ブラウザE2E成功', '- [x] GitHub Pages開発プレビューでPC/スマホ実ブラウザE2E成功\n- [x] WCAG A/AA重大・致命的違反の自動検査をCIへ追加\n- [x] ブラウザ戻る操作・モバイルナビ・横はみ出しをE2Eへ追加\n- [x] Cloudflare Pages用セキュリティヘッダー設定 `_headers` を事前作成', 'checklist hardening items');
  s = replaceOnce(s, '- [ ] 本番ホストでCSP `frame-ancestors \'none\'` をHTTPレスポンスヘッダーとして設定', '- [x] Cloudflare Pages用CSP `frame-ancestors \'none\'` を `_headers` に実装済み\n- [ ] 本番デプロイ後、レスポンスヘッダーとして実際に返ることを確認', 'production CSP checklist');
  write(path, s);
}

console.log('Final hardening patch applied successfully.');
