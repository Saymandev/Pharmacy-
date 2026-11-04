/* eslint @typescript-eslint/no-require-imports: "off" */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1595, height: 850 } });
  const errors = [], writes = [], searches = [];
  const suppliers = Array.from({ length: 4 }, (_, i) => ({ id: `supplier-${i}`, name: `Demo Supplier ${i + 1}`, address: 'Demo supplier address, Dhaka', phone: '0100000010' + i, email: `demo-supplier-${i + 1}@example.test`, createdAt: '2026-11-03T08:00:00Z' }));
  const items = Array.from({ length: 20 }, (_, i) => ({ id: `item-${i}`, itemName: `Medicine ${i + 1}`, quantity: 1, unit: 'Pcs', batchNumber: `DEMO-${i + 1}`, expiryDate: '2030-12-31', price: 20, totalPrice: 20 }));
  const sale = { id: 'sale1', invoiceNumber: 'INV-DESIGN-001', type: 'pos', branchId: 'b1', customer: { name: 'Sample customer', phone: '01700000000' }, status: 'completed', paymentStatus: 'paid', totalPrice: 400, netPrice: 420, taxAmount: 20, discountAmount: 0, paidAmount: 420, dueAmount: 0, createdAt: '2026-11-04T08:00:00Z', saleItems: items };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/backend/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api/backend', '');
    let data = [], meta;
    if (request.method() !== 'GET') { writes.push(endpoint); data = {}; }
    else if (endpoint === '/auth/me') data = { id: 'admin', fullName: 'UI reviewer', role: { permissions: [{ key: '*' }] } };
    else if (endpoint === '/branches') data = [{ id: 'b1', name: 'Main Pharmacy' }];
    else if (endpoint === '/pharmacy/suppliers') { searches.push(url.searchParams.get('search')); data = suppliers; meta = { total: 4, page: 1, totalPages: 1, limit: 10 }; }
    else if (endpoint === '/sales') data = { sales: [sale], pagination: { total: 1, page: 1, totalPages: 1, limit: 20 } };
    else if (endpoint === '/sales/sale1') data = sale;
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, meta }) });
  });
  const base = process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000';
  const snap = name => page.screenshot({ path: path.resolve('../work', name), fullPage: true });
  async function contrast(locator) {
    return locator.evaluateAll(elements => elements.map(element => {
      const rgb = color => (color.match(/[\d.]+/g) || []).map(Number);
      const luminance = color => rgb(color).slice(0, 3).map(v => { const n = v / 255; return n <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4; }).reduce((n, v, i) => n + v * [.2126, .7152, .0722][i], 0);
      let parent = element, background = 'rgb(255,255,255)';
      while (parent) { const color = getComputedStyle(parent).backgroundColor, values = rgb(color); if (values.length === 3 || values[3] > .99) { background = color; break; } parent = parent.parentElement; }
      const foreground = getComputedStyle(element).color, a = luminance(foreground), b = luminance(background);
      return { text: element.textContent.trim(), ratio: (Math.max(a, b) + .05) / (Math.min(a, b) + .05) };
    }));
  }
  try {
    for (const theme of ['light', 'dark']) {
      await page.goto(base + '/suppliers'); await page.locator('.supplier-table tbody tr').first().waitFor();
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
      const panel = await page.locator('.supplier-directory-card').boundingBox(), table = await page.locator('.supplier-table').boundingBox(), toolbar = await page.locator('.supplier-toolbar').boundingBox(), search = await page.getByRole('textbox', { name: 'Search suppliers', exact: true }).boundingBox();
      assert.ok(table.width >= panel.width - 3, 'Supplier table must fill directory panel'); assert.ok(toolbar.width >= panel.width - 3); assert.ok(search.width > toolbar.width * .65, 'Search uses available width');
      await snap(`supplier-directory-${theme}.png`);
      await page.getByRole('textbox', { name: 'Search suppliers', exact: true }).fill('Demo Supplier'); const response = page.waitForResponse(r => r.url().includes('/pharmacy/suppliers?') && new URL(r.url()).searchParams.get('search') === 'Demo Supplier'); await page.locator('.supplier-toolbar').getByRole('button', { name: 'Search', exact: true }).click(); await response; assert.ok(searches.includes('Demo Supplier'));
      await page.getByRole('button', { name: 'Edit Demo Supplier 1', exact: true }).click(); await page.getByRole('dialog', { name: 'Edit supplier', exact: true }).waitFor(); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
      await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); await snap(`supplier-directory-${theme}-mobile.png`); await page.setViewportSize({ width: 1595, height: 850 });
      await page.goto(base + '/sales'); await page.locator('.sales-invoice').first().click();
      const dialog = page.getByRole('dialog', { name: 'Sale details', exact: true }); await dialog.waitFor();
      const ratios = await contrast(dialog.locator('.sales-detail-line>b,.sales-detail-line small,.sales-detail-totals b')); assert.ok(ratios.length > 20); assert.deepEqual(ratios.filter(v => v.ratio < 4.5), [], 'Invoice amounts and metadata need readable contrast');
      const body = dialog.locator('.sales-invoice-body'); assert.equal(await body.evaluate(e => e.scrollHeight > e.clientHeight), true);
      await snap(`sale-details-${theme}.png`); await body.evaluate(e => e.scrollTop = e.scrollHeight);
      for (const selector of ['.sales-detail-head', '.sales-detail-actions']) { const box = await dialog.locator(selector).boundingBox(); assert.ok(box.y >= 0 && box.y + box.height <= 851, 'Header and actions stay in viewport'); }
      await snap(`sale-details-${theme}-scrolled.png`);
      await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true); const actionBox = await dialog.locator('.sales-detail-actions').boundingBox(); assert.ok(actionBox.y + actionBox.height <= 845); await snap(`sale-details-${theme}-mobile.png`); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await page.setViewportSize({ width: 1595, height: 850 });
    }
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    await fs.mkdir(path.resolve('../outputs'), { recursive: true });
    for (const [from, to] of [['supplier-directory-dark.png', 'supplier-directory-preview.png'], ['sale-details-dark-scrolled.png', 'sale-details-preview.png']]) await fs.copyFile(path.resolve('../work', from), path.resolve('../outputs', to));
    console.log('PASS supplier/sales design: full-width directory/search, backend search and edit action, light/dark/mobile, invoice text contrast >=4.5, long-invoice body scroll with visible header/actions, Escape, no mutations. Mock API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
