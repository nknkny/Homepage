import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';

const url = process.env.PREVIEW_URL || 'https://nknkny.github.io/Homepage/event-platform/';

async function waitForApp(page) {
  await page.waitForSelector('#enterpriseSearch', { state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => {
    const el = document.querySelector('#storageStatus');
    return el && !/接続確認中/.test(el.textContent || '');
  }, null, { timeout: 30000 }).catch(() => {});
}

function captureErrors(page, label) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`${label} pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    errors.push(`${label} console: ${message.text()}`);
  });
  return errors;
}

async function assertAccessible(page, label) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
  const serious = result.violations.filter((v) => ['serious','critical'].includes(v.impact || ''));
  assert.deepEqual(
    serious.map((v) => ({ id: v.id, impact: v.impact, help: v.help, targets: v.nodes.map((n) => n.target) })),
    [],
    `${label}: serious/critical accessibility violations`,
  );
}

async function assertNoHorizontalOverflow(page, label) {
  const widths = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  assert.ok(widths.scrollWidth <= widths.clientWidth + 2, `${label}: horizontal overflow ${widths.scrollWidth} > ${widths.clientWidth}`);
}

async function desktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = captureErrors(page, 'desktop');
  try {
    const response = await page.goto(`${url}?e2e=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
    assert.ok(response && response.ok(), `desktop: HTTP ${response?.status()}`);
    await waitForApp(page);

    assert.match(await page.title(), /イベント/);
    assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow,noarchive');
    assert.equal(await page.locator('#enterpriseSearch').count(), 1);
    assert.equal(await page.locator('[data-enterprise-category]').count(), 6);
    assert.ok(await page.getByRole('button', { name: 'イベントを探す' }).isVisible());
    await assertNoHorizontalOverflow(page, 'desktop-home');
    await assertAccessible(page, 'desktop-home');
    await page.screenshot({ path: '/tmp/event-platform-home-desktop.png', fullPage: true });

    await page.locator('#enterpriseLocation').fill('青森市');
    await page.locator('#enterpriseKeyword').fill('');
    await page.locator('#enterpriseDate').selectOption('today');
    await page.getByRole('button', { name: 'イベントを探す' }).click();
    await page.waitForSelector('#calendar.view.active', { timeout: 15000 });
    assert.equal(await page.locator('#calendarMunicipality').inputValue(), '青森市');
    assert.ok((await page.url()).includes('#calendar'));
    await page.goBack();
    await page.waitForSelector('#discover.view.active', { timeout: 15000 });
    assert.ok((await page.url()).includes('#discover'));

    await page.locator('[data-nav="discover"]').first().click();
    await page.waitForSelector('#discover.view.active');
    await page.locator('[data-enterprise-category="音楽・ライブ"]').click();
    await page.waitForSelector('#calendar.view.active');
    assert.equal(await page.locator('#calendarCategory').inputValue(), '音楽・ライブ');

    await page.locator('[data-nav="discover"]').first().click();
    await page.locator('[data-quick-post="want"]').first().click();
    await page.waitForSelector('#post.view.active');
    assert.equal(await page.locator('#postType').inputValue(), 'want');

    await assertAccessible(page, 'desktop-post');
    await page.screenshot({ path: '/tmp/event-platform-desktop.png', fullPage: true });
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally {
    await context.close();
  }
}

async function mobile(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  const errors = captureErrors(page, 'mobile');
  try {
    const response = await page.goto(`${url}?e2e-mobile=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
    assert.ok(response && response.ok(), `mobile: HTTP ${response?.status()}`);
    await waitForApp(page);

    assert.ok(await page.locator('#enterpriseSearch').isVisible());
    assert.ok(await page.locator('.enterprise-discovery-rail').isVisible());
    assert.ok(await page.locator('[data-quick-post="want"]').first().isVisible());
    await assertNoHorizontalOverflow(page, 'mobile-home');
    const lastNav = await page.locator('[data-nav="favorites"]').boundingBox();
    assert.ok(lastNav && lastNav.x >= 0 && lastNav.x + lastNav.width <= 390, 'mobile: favorites navigation must be visible without clipping');
    await assertAccessible(page, 'mobile-home');
    await page.screenshot({ path: '/tmp/event-platform-home-mobile.png', fullPage: true });

    await page.locator('[data-enterprise-date="weekend"]').click();
    await page.waitForSelector('#calendar.view.active', { timeout: 15000 });
    assert.ok((await page.url()).includes('#calendar'));

    await assertAccessible(page, 'mobile-calendar');
    await page.screenshot({ path: '/tmp/event-platform-mobile.png', fullPage: true });
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally {
    await context.close();
  }
}

async function auditLegalPages(browser, viewport, label) {
  const context = await browser.newContext(viewport);
  const page = await context.newPage();
  const errors = captureErrors(page, label);
  const files = ['terms.html', 'privacy.html', 'legal-boundaries.html'];
  try {
    for (const file of files) {
      const response = await page.goto(`${url}${file}?e2e=${Date.now()}`, { waitUntil: 'networkidle', timeout: 60000 });
      assert.ok(response && response.ok(), `${label}-${file}: HTTP ${response?.status()}`);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'), 'noindex,nofollow,noarchive');
      assert.ok(await page.locator('.legal-shell h1').isVisible(), `${label}-${file}: legal heading visible`);
      assert.ok((await page.locator('.legal-section').count()) > 0, `${label}-${file}: legal sections exist`);
      await assertNoHorizontalOverflow(page, `${label}-${file}`);
      await assertAccessible(page, `${label}-${file}`);
      if (file === 'privacy.html' && label === 'legal-desktop') await page.screenshot({ path: '/tmp/event-platform-legal-desktop.png', fullPage: true });
      if (file === 'legal-boundaries.html' && label === 'legal-mobile') await page.screenshot({ path: '/tmp/event-platform-legal-mobile.png', fullPage: true });
    }
    assert.deepEqual(errors, [], errors.join('\n'));
  } finally {
    await context.close();
  }
}

const browser = await chromium.launch({ headless: true });
try {
  await desktop(browser);
  await mobile(browser);
  await auditLegalPages(browser, { viewport: { width: 1440, height: 1000 } }, 'legal-desktop');
  await auditLegalPages(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }, 'legal-mobile');
  console.log('Browser E2E passed: desktop/mobile discovery, posting, calendar, navigation, and legal pages are healthy.');
} finally {
  await browser.close();
}
