/* eslint @typescript-eslint/no-require-imports: "off" -- CommonJS browser runner. */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const stock = { id: 'stock', branchId: 'branch-a', quantity: 10, mrp: 25, unit: 'Pcs', batchNumber: 'A', expiryDate: '2030-01-01' };
  await page.route('**/api/backend/**', async route => {
   const url = new URL(route.request().url()), path = url.pathname.replace('/api/backend', ''); let data = [];
   if (path === '/auth/me') data = { id: 'u', fullName: 'Tester', role: { permissions: [{ key: '*' }] } };
   else if (path === '/branches') data = [{ id: 'branch-a', name: 'Main' }];
   else if (path === '/pharmacy/medicines') data = ['medicine-a', 'medicine-blue', 'medicine-violet'].map((id, index) => ({ id, name: `Medicine ${index}`, salePrice: 25, stocks: [{ ...stock, id: `${id}-stock` }] }));
   else if (path === '/sales') data = [{ id: 's', invoiceNumber: 'SALE-DARK', status: 'completed', netPrice: 25, paidAmount: 25, dueAmount: 0, paymentStatus: 'paid', customer: { name: 'Theme customer' }, createdAt: '2026-11-03T00:00:00Z' }];
   else if (path === '/pharmacy/cash-register/active') data = { id: 'session' };
   await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  });
  const base = process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000';
  await page.goto(base + '/pos'); await page.locator('.pos-product-card').first().waitFor();
  const search = page.getByRole('textbox', { name: 'Search medicine or scan barcode…', exact: true });
  assert.equal(await search.evaluate(el => getComputedStyle(el).borderTopWidth), '0px');
  const colors = await page.locator('.pos-product-card').evaluateAll(nodes => nodes.map(n => getComputedStyle(n).backgroundColor));
  assert.equal(new Set(colors).size, 3);
  const before = await page.locator('.pos-product-grid').boundingBox(); assert.ok(before.y < 310, 'POS chrome takes too much height');
  await page.getByRole('button', { name: 'Filters', exact: false }).first().click();
  const popup = page.locator('.floating-filter:popover-open'); await popup.waitFor();
  assert.equal(await popup.evaluate(el => getComputedStyle(el).position), 'fixed');
  assert.equal((await page.locator('.pos-product-grid').boundingBox()).y, before.y);
  await Promise.all([page.waitForResponse(r => r.url().includes('/pharmacy/medicines?') && r.url().includes('strength=500')), popup.getByLabel('Strength', { exact: true }).fill('500')]);
  await popup.getByRole('button', { name: 'Close filters', exact: true }).click();
  await Promise.all([page.waitForResponse(r => r.url().includes('/pharmacy/medicines?') && r.url().includes('search=Paracetamol')), search.fill('Paracetamol')]);
  for (const width of [1440, 390]) {
   await page.setViewportSize({ width, height: 900 });
   for (const path of ['/catalog', '/inventory', '/sales', '/purchases', '/customers', '/finance', '/reports', '/hr', '/access']) {
    await page.goto(base + path); await page.locator('.page-heading-row h1').waitFor();
    await page.getByRole('button', { name: /^(More )?filters$/i }).first().click(); await popup.waitFor();
    const box = await popup.boundingBox(); assert.ok(box.x >= 0 && box.x + box.width <= width + 1, path + ' popup width');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, path + ' overflow');
    await page.mouse.click(3, 3); await popup.waitFor({ state: 'hidden' });
   }
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(base + '/sales');
  await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click(); await page.getByText('SALE-DARK', { exact: true }).waitFor();
  const background = await page.locator('.sales-row').first().evaluate(el => getComputedStyle(el).backgroundColor);
  assert.ok(background.match(/\d+/g).slice(0, 3).map(Number).every(v => v < 100), 'Sales row remained light');
  assert.deepEqual(errors, []);
  console.log('PASS compact POS, single search border, distinct card colors, backend search/filter queries, nine floating-filter pages at desktop/mobile and dark sales');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
