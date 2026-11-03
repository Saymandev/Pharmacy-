/* eslint @typescript-eslint/no-require-imports: "off" */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const edge = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(edge) ? { executablePath: edge } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.setDefaultTimeout(15000);
    const errors = [], writes = [];
    page.on('pageerror', error => errors.push(error.message));
    const branch = { id: 'branch-a', name: 'Main Branch' };
    const account = { id: 'account-a', name: 'Main bank', type: 'bank' };
    const supplier = { id: 'supplier-a', name: 'Supplier A' };
    const purchase = { id: 'purchase-a', poNumber: 'PO-A', branchId: branch.id, supplierId: supplier.id, supplier, status: 'completed', paymentStatus: 'paid', totalPrice: 100, discountAmount: 0, paidAmount: 100, dueAmount: 0, createdAt: '2026-11-01T00:00:00Z', purchaseItems: [] };
    const source = { id: 'line-a', itemName: 'Medicine A', batchNumber: 'LOT-A', price: '10.00', quantity: '10', completedQuantity: 0, pendingQuantity: 0, availableStock: 10, remainingAllowance: 10 };
    let ret = null;
    const customer = { id: 'customer-a', name: 'Test Customer', phone: '01000000000', age: 30, gender: 'other', balance: 0 };
    let invoice = { id: 'sale-a', customerId: customer.id, branchId: branch.id, invoiceNumber: 'INV-A', createdAt: '2026-11-01T00:00:00Z', status: 'completed', type: 'pos', paymentStatus: 'due', netPrice: 50, paidAmount: 0, dueAmount: 50, transactions: [] };
    const events = [];
    await page.route('**/api/backend/**', async route => {
      const request = route.request(), url = new URL(request.url()), path = url.pathname.replace('/api/backend', '');
      const method = request.method(); let data = [], status = 200;
      if (path === '/auth/me') data = { id: 'user-a', fullName: 'Test user', role: { permissions: [{ key: '*' }] } };
      else if (path === '/branches') data = [branch];
      else if (path === '/finance/accounts') data = [account];
      else if (path === '/pharmacy/suppliers') data = [supplier];
      else if (path === '/pharmacy/cash-register/active') data = { id: 'register-a' };
      else if (path === '/pharmacy/purchases') data = { purchases: [purchase], pagination: { total: 1, page: 1, limit: 20, totalPages: 1 } };
      else if (path === '/pharmacy/purchases/purchase-a/returnable-items') data = { purchaseId: purchase.id, branchId: branch.id, supplierId: supplier.id, items: [source] };
      else if (path === '/pharmacy/purchase-returns' && method === 'GET') data = { returns: ret ? [ret] : [], pagination: { total: ret ? 1 : 0, page: 1, limit: 25, totalPages: 1 } };
      else if (path === '/pharmacy/purchase-returns' && method === 'POST') {
        writes.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] });
        ret = { id: 'return-a', purchaseId: purchase.id, poNumber: purchase.poNumber, supplier, status: 'pending', reason: 'Damaged package', totalPrice: '20.00', dueReduction: '0.00', supplierCredit: '0.00', refundedAmount: '0.00', refundableCredit: '0.00', createdAt: new Date().toISOString(), purchaseReturnItems: [{ id: 'return-line-a', itemName: 'Medicine A', batchNumber: 'LOT-A', quantity: '2', price: '10.00' }], transactions: [] };
        data = ret;
      }
      else if (path === '/pharmacy/purchase-returns/return-a/status') { writes.push({ path, body: request.postDataJSON() }); ret = { ...ret, status: 'completed', supplierCredit: '20.00', refundableCredit: '20.00' }; data = ret; }
      else if (path === '/pharmacy/purchase-returns/return-a/refunds') { writes.push({ path, body: request.postDataJSON(), key: request.headers()['idempotency-key'] }); ret = { ...ret, refundedAmount: '5.00', refundableCredit: '15.00', transactions: [{ id: 'transaction-a', txnId: 'PRF-A', amount: '5.00', paymentMethod: 'Bank Transfer', createdAt: new Date().toISOString() }] }; data = ret; }
      else if (path === '/pharmacy/purchase-returns/return-a') data = ret;
      else if (path === '/customers' && method === 'GET') data = { data: [customer], pagination: { total: 1, page: 1, limit: 20, totalPages: 1 } };
      else if (path === '/customers/customer-a/ledger' && method === 'GET') data = { events, currentAdvance: String(events.reduce((sum, event) => sum + (event.kind === 'received' ? 1 : -1) * Number(event.amount), 0)), pagination: { total: events.length, totalPages: 1 }, scope: { historicalCoverage: 'New events only', balanceScope: 'all branches' } };
      else if (path === '/customers/customer-a' && method === 'GET') data = customer;
      else if (path === '/sales' && method === 'GET') data = { sales: [invoice], pagination: { total: 1, page: 1, limit: 100, totalPages: 1 } };
      else if (/^\/customers\/customer-a\/(advances|advance-allocations|advance-refunds)$/.test(path) && method === 'POST') {
        const body = request.postDataJSON(); writes.push({ path, body, key: request.headers()['idempotency-key'] });
        const kind = path.endsWith('/advances') ? 'received' : path.endsWith('/advance-allocations') ? 'applied' : 'refunded';
        if (kind === 'applied') invoice = { ...invoice, dueAmount: invoice.dueAmount - body.amount, paidAmount: invoice.paidAmount + body.amount };
        const after = events.reduce((sum, event) => sum + (event.kind === 'received' ? 1 : -1) * Number(event.amount), 0) + (kind === 'received' ? 1 : -1) * body.amount;
        data = { id: `event-${events.length + 1}`, kind, amount: String(body.amount), balanceAfter: String(after), createdAt: new Date().toISOString(), branch, sale: kind === 'applied' ? { invoiceNumber: invoice.invoiceNumber } : null };
        events.push(data);
      }
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status === 200, data }) });
    });
    const base = process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000';
    await page.goto(base + '/purchases');
    await page.getByRole('button', { name: 'Supplier returns', exact: true }).click();
    const panel = page.getByRole('region', { name: 'Supplier returns and refunds' });
    await panel.getByLabel('Source purchase').selectOption(purchase.id);
    await panel.getByLabel('Medicine A LOT-A return quantity').fill('2');
    await panel.getByLabel('Reason').fill('Damaged package');
    await panel.getByRole('button', { name: 'Save pending return' }).click();
    await panel.getByRole('button', { name: 'Approve & remove stock' }).click();
    await panel.getByLabel('Amount').fill('5');
    await panel.getByLabel('Account').selectOption(account.id);
    await panel.getByRole('button', { name: 'Post refund received' }).click();
    await panel.getByText('PRF-A').waitFor();
    await page.screenshot({ path: require('node:path').resolve('../work/supplier-return-mobile.png'), fullPage: true });
    assert.equal(writes[0].body.items[0].purchaseItemId, source.id);
    assert.ok(writes[0].key && writes[2].key);
    assert.equal(writes[2].body.amount, 5);
    await page.goto(base + '/customers');
    await page.getByRole('button', { name: 'View Test Customer' }).click();
    const dialog = page.getByRole('dialog', { name: 'Customer details' });
    await dialog.getByRole('tab', { name: 'Advances' }).click();
    const ledger = dialog.getByRole('region', { name: 'Customer advance ledger' });
    await ledger.getByLabel('Branch').first().selectOption(branch.id);
    await ledger.getByLabel('Amount').fill('15');
    await ledger.getByLabel('Account').selectOption(account.id);
    await ledger.getByRole('button', { name: 'Receive advance' }).click();
    await ledger.getByText('BDT 15.00').first().waitFor();
    assert.equal(writes.at(-1).body.amount, 15);
    assert.ok(writes.at(-1).key);
    await ledger.getByRole('button', { name: 'Apply to invoice' }).click();
    await ledger.getByLabel('Amount').fill('10');
    await ledger.getByLabel('Invoice').selectOption(invoice.id);
    await ledger.getByRole('button', { name: 'Apply advance' }).click();
    await ledger.getByText('BDT 5.00').first().waitFor();
    assert.equal(writes.at(-1).body.saleId, invoice.id);
    await ledger.getByRole('button', { name: 'Refund', exact: true }).click();
    await ledger.getByLabel('Amount').fill('5');
    await ledger.getByLabel('Account').selectOption(account.id);
    await ledger.getByRole('button', { name: 'Refund advance' }).click();
    await ledger.getByText('BDT 0.00').first().waitFor();
    assert.equal(events.length, 3);
    await page.screenshot({ path: require('node:path').resolve('../work/customer-advance-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    assert.deepEqual(errors, []);
    console.log('PASS purchase return and customer advance browser: create, approve, supplier refund, idempotency headers, receipt, invoice application, advance refund and mobile. Mock API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exit(1); });
