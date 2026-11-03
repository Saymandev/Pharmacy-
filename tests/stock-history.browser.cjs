/* eslint @typescript-eslint/no-require-imports: "off" */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const requests = []; let fail = false; const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/backend/**', async route => {
      const url = new URL(route.request().url()); const path = url.pathname.replace('/api/backend', '');
      let data = []; let meta; let status = 200;
      if (path === '/auth/me') data = { id: 'user', fullName: 'History user', role: { permissions: [{ key: '*' }] } };
      else if (path === '/branches') data = [{ id: 'branch-a', name: 'Main' }, { id: 'branch-b', name: 'Second' }];
      else if (path === '/pharmacy/stocks/history') {
        requests.push(Object.fromEntries(url.searchParams));
        if (fail) status = 503;
        else {
          data = [{ id: 'h1', createdAt: '2026-11-02T18:30:00Z', quantity: 3, quantityDelta: -3, type: 'out', stockChangeType: 'transfer', medicine: { name: 'History Medicine' }, stock: { batchNumber: 'A', unit: 'Pcs' }, branch: { name: 'Main' }, targetBranch: { name: 'Second' }, note: 'Move batch' }];
          meta = { page: Number(url.searchParams.get('page')), totalItems: 26, totalPages: 2, pageSize: 25 };
        }
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status === 200, message: status === 200 ? 'OK' : 'History temporarily unavailable', data, meta }) });
    });
    await page.goto((process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000') + '/inventory');
    await page.getByRole('button', { name: 'Stock history', exact: true }).click();
    const history = page.getByRole('region', { name: 'Stock history', exact: true });
    await history.getByText('History Medicine', { exact: true }).waitFor();
    assert.equal(requests[0].branchId, 'branch-a');
    assert.match(await history.innerText(), /-3/);
    await history.getByLabel('Batch number', { exact: true }).fill('A');
    await history.getByLabel('Direction', { exact: true }).selectOption('out');
    await history.getByLabel('From date', { exact: true }).fill('2026-11-01');
    await history.getByLabel('To date', { exact: true }).fill('2026-11-03');
    await Promise.all([page.waitForResponse(response => response.url().includes('/stocks/history?') && response.url().includes('startDate=')), history.getByRole('button', { name: 'Apply filters' }).click()]);
    assert.equal(requests.at(-1).batchNumber, 'A'); assert.equal(requests.at(-1).type, 'out');
    await Promise.all([page.waitForResponse(response => response.url().includes('/stocks/history?') && response.url().includes('page=2')), history.getByRole('button', { name: 'Next', exact: true }).click()]);
    await history.getByText('History Medicine', { exact: true }).waitFor();
    fail = true; await history.getByRole('button', { name: 'Refresh', exact: true }).click();
    await history.getByRole('alert').waitFor();
    assert.equal(await history.getByText('History Medicine', { exact: true }).count(), 0);
    fail = false; await history.getByRole('button', { name: 'Retry', exact: true }).click();
    await history.getByText('History Medicine', { exact: true }).waitFor();
    await history.getByLabel('From date', { exact: true }).fill('2026-11-04');
    assert.equal(await history.getByRole('button', { name: 'Apply filters' }).isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    await history.getByLabel('From date', { exact: true }).fill('2026-11-01');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: require('node:path').resolve('../work/stock-history-mobile.png'), fullPage: true });
    assert.equal(await page.getByRole('link', { name: 'Doctor settlements', exact: true }).count(), 0);
    const denied = await browser.newPage(); let deniedReads = 0;
    await denied.route('**/api/backend/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path.includes('/stocks/history')) deniedReads++;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: path.endsWith('/auth/me') ? { id: 'denied', fullName: 'Denied', role: { permissions: [] } } : [] }) });
    });
    await denied.goto((process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000') + '/inventory');
    await denied.locator('.workspace-access-notice').waitFor();
    assert.equal(deniedReads, 0);
    assert.deepEqual(errors, []);
    console.log('PASS stock history: branch scope, filters, pagination, failure clears rows, retry, date validation and mobile. Mock API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
