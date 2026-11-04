/* eslint @typescript-eslint/no-require-imports: "off" */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1595, height: 850 } });
  const errors = [], writes = [];
  const transactions = [
    { id: 'tin', txnId: 'TX-MONEY-IN', accountId: 'a', flowType: 'in', txnType: 'sale', amount: 400, account: { name: 'Cash drawer', type: 'cash' }, note: 'Older invoice due collected', paymentMethod: 'cash', createdAt: '2026-11-04T04:00:00Z', accountBalanceBefore: 1200, accountBalanceNow: 1600 },
    { id: 'tout', txnId: 'TX-MONEY-OUT', accountId: 'a', flowType: 'out', txnType: 'expense', amount: 150, account: { name: 'Cash drawer', type: 'cash' }, note: 'Store operating expense', paymentMethod: 'cash', createdAt: '2026-11-04T05:00:00Z', accountBalanceBefore: 1600, accountBalanceNow: 1450 },
  ];
  const account = { id: 'a', name: 'Cash drawer', type: 'cash', currentBalance: 1450, openingBalance: 1000, isActive: true, _count: { transactions: 2 }, transactions };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/backend/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api/backend', '');
    let data = [], meta = { total: 0, page: 1, limit: 20, totalPages: 1 };
    if (request.method() !== 'GET') { writes.push(endpoint); data = {}; }
    else if (endpoint === '/auth/me') data = { id: 'admin', fullName: 'UI reviewer', role: { permissions: [{ key: '*' }] } };
    else if (endpoint === '/branches') data = [{ id: 'b1', name: 'Main Pharmacy' }];
    else if (endpoint === '/finance/accounts') { data = [account, { ...account, id: 'bank', name: 'Business bank', type: 'bank', currentBalance: 5200 }]; meta.total = 2; }
    else if (endpoint === '/finance/accounts/a') data = account;
    else if (endpoint === '/finance/transactions') { data = transactions; meta.total = 2; }
    else if (endpoint === '/finance/transactions/tin') data = transactions[0];
    else if (endpoint === '/finance/transactions/tout') data = transactions[1];
    else if (endpoint === '/finance/incomes') { data = [{ id: 'inc1', incomeNumber: 'INC-001', amount: 100, date: '2026-11-04', account: account, category: { name: 'Other income' } }]; meta.total = 1; }
    else if (endpoint === '/finance/expenses') { data = [{ id: 'exp1', expenseNumber: 'EXP-001', amount: 150, date: '2026-11-04', account: account, category: { name: 'Utilities' } }]; meta.total = 1; }
    else if (endpoint === '/finance/incomes/categories' || endpoint === '/finance/expenses/categories') data = [{id:'category1',name:'Operations',description:'Daily pharmacy operations'}];
    else if (endpoint === '/settings/BACKUP_CONFIG') data = {};
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, meta }) });
  });
  const base = process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000';
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  const snap = name => page.screenshot({ path: path.resolve('../work', name), fullPage: true });
  try {
    await page.goto(base + '/finance'); await page.locator('.finance-account-card').first().waitFor();
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
      await page.locator('.finance-tabs').getByRole('button', { name: 'Transactions', exact: true }).click(); await page.getByText('TX-MONEY-IN', { exact: true }).waitFor();
      const incoming = page.locator('.finance-transaction-row').filter({ hasText: 'TX-MONEY-IN' }), outgoing = page.locator('.finance-transaction-row').filter({ hasText: 'TX-MONEY-OUT' });
      assert.equal(await incoming.locator('.finance-flow-badge').innerText(), 'Money in'); assert.equal(await outgoing.locator('.finance-flow-badge').innerText(), 'Money out');
      assert.match(await incoming.locator('strong.finance-in').innerText(), /^\+/); assert.match(await outgoing.locator('strong.finance-out').innerText(), /^−/);
      assert.notEqual(await incoming.locator('strong.finance-in').evaluate(e => getComputedStyle(e).color), await outgoing.locator('strong.finance-out').evaluate(e => getComputedStyle(e).color));
      assert.equal(await incoming.evaluate(e => getComputedStyle(e).display), 'grid'); await snap(`finance-transactions-${theme}.png`);
      await outgoing.click(); const detail = page.getByRole('dialog', { name: 'Transaction details', exact: true }); await detail.getByText('Money out', { exact: true }).waitFor();
      assert.equal(await detail.getByRole('textbox', { name: 'Note', exact: true }).inputValue(), 'Store operating expense'); await snap(`finance-transaction-detail-${theme}.png`); await page.keyboard.press('Escape');
      for (const width of [1100, 768, 390]) { await page.setViewportSize({ width, height: 844 }); await noOverflow(); assert.equal(await incoming.locator('.finance-flow-badge').isVisible(), true); assert.equal(await outgoing.locator('.finance-flow-badge').isVisible(), true); }
      await snap(`finance-transactions-${theme}-mobile.png`); await page.setViewportSize({ width: 1595, height: 850 });
      for (const [tab, label] of [['Income', 'Money in'], ['Expenses', 'Money out']]) { await page.locator('.finance-tabs').getByRole('button', { name: tab, exact: true }).click(); await page.locator('.finance-entry-row .finance-flow-badge').filter({hasText:label}).waitFor(); await noOverflow(); await page.getByRole('button',{name:'Manage categories',exact:true}).click(); const categories=page.getByRole('dialog'); await categories.getByText('Operations',{exact:true}).waitFor(); const categoryBox=await categories.boundingBox(); assert.ok(categoryBox.width<=681); await page.setViewportSize({width:390,height:844}); await noOverflow(); await page.keyboard.press('Escape'); await page.setViewportSize({width:1595,height:850}); }
      await page.locator('.finance-tabs').getByRole('button', { name: 'Accounts', exact: true }).click(); await page.getByRole('button', { name: /Cash drawer/ }).click(); const accountDetail = page.getByRole('dialog', { name: 'Account details', exact: true }); await accountDetail.getByText('Money in', { exact: true }).waitFor(); await accountDetail.getByText('Money out', { exact: true }).waitFor(); await page.keyboard.press('Escape');
    }
    // Every route owns an AppShell: navigation must restore the sidebar DOM's scrollTop.
    await page.setViewportSize({ width: 1280, height: 650 });
    await page.locator('.sidebar').evaluate(e => e.scrollTop = e.scrollHeight);
    const before = await page.locator('.sidebar').evaluate(e => e.scrollTop); assert.ok(before > 100);
    await page.locator('.sidebar').getByRole('link', { name: 'Team access', exact: true }).click(); await page.waitForURL('**/access'); await page.getByRole('heading', { name: 'Team access', exact: true }).waitFor();
    assert.ok(Math.abs(await page.locator('.sidebar').evaluate(e => e.scrollTop) - before) <= 2, 'Route change preserves sidebar position');
    await page.locator('.sidebar').getByRole('link', { name: 'Communications & settings', exact: true }).click(); await page.waitForURL('**/admin'); await page.getByRole('heading', { name: 'Communications & settings', exact: true }).waitFor();
    assert.ok(Math.abs(await page.locator('.sidebar').evaluate(e => e.scrollTop) - before) <= 2);
    await page.reload(); await page.getByRole('heading', { name: 'Communications & settings', exact: true }).waitFor(); assert.ok(Math.abs(await page.locator('.sidebar').evaluate(e => e.scrollTop) - before) <= 2, 'Reload restores session sidebar position');
    await page.goBack(); await page.waitForURL('**/access'); await page.getByRole('heading', { name: 'Team access', exact: true }).waitFor(); assert.ok(await page.locator('.sidebar').evaluate(e => e.scrollTop) > 100);
    await page.setViewportSize({ width: 390, height: 700 }); await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click(); await page.locator('.sidebar').evaluate(e => e.scrollTop = e.scrollHeight);
    const mobileBefore = await page.locator('.sidebar').evaluate(e => e.scrollTop);
    await page.locator('.sidebar a[href="/hr/setup"]').evaluate(link=>link.addEventListener('click',()=>sessionStorage.setItem('sidebar-test-at-click',String(link.closest('.sidebar').scrollTop)),{capture:true,once:true}));
    await page.locator('.sidebar').getByRole('link', { name: 'HR setup', exact: true }).click(); await page.waitForURL('**/hr/setup'); await page.getByRole('heading', { name: 'HR setup', exact: true }).waitFor();
    assert.equal(await page.locator('.sidebar').evaluate(e => e.classList.contains('sidebar-mobile-open')), false); await page.getByRole('button', { name: 'Toggle sidebar', exact: true }).click(); assert.ok(Math.abs(await page.locator('.sidebar').evaluate(e => e.scrollTop) - Number(await page.evaluate(()=>sessionStorage.getItem('sidebar-test-at-click')))) <= 2, `Mobile drawer reopens at remembered menu position (initial ${mobileBefore})`); await noOverflow();
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    await fs.mkdir(path.resolve('../outputs'), { recursive: true });
    await fs.copyFile(path.resolve('../work/finance-transactions-dark.png'), path.resolve('../outputs/finance-transactions-preview.png'));
    console.log('PASS Finance/sidebar: explicit In/Out badges and signed colors in list/details/account history/income/expense, responsive ledger grid, desktop route/reload/back sidebar position, mobile close/reopen scroll, no mutations. Mock API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
