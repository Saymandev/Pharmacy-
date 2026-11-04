/* eslint @typescript-eslint/no-require-imports: "off" */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], writes = [];
  const member = { id: 'u1', username: 'cashier', fullName: 'Sample Cashier', email: 'cashier@example.test', isActive: true, role: { id: 'role1', name: 'Cashier' } };
  const employee = { id: 'e1', name: 'Employee One', employeeNumber: 'EMP-1', employeeType: 'staff', branchId: 'b1', age: 25, gender: 'other', phone: '01700000000', address: 'Dhaka', grossSalary: 25000, joiningDate: '2026-11-01', status: 'active' };
  const shift = { id: 'shift1', name: 'Morning', branchId: 'b1', startTime: '2026-11-04T03:00:00Z', endTime: '2026-11-04T11:00:00Z' };
  const roster = { id: 'roster1', shiftId: 'shift1', shift, branchId: 'b1', startDate: '2026-11-03T18:00:00Z', endDate: '2026-11-05T17:59:00Z' };
  const medicine = { id: 'med1', name: 'Sample medicine', genericName: 'Paracetamol', unit: 'Pcs', isActive: true, salePrice: 10, mrp: 10, purchasePrice: 7, reorderLevel: 5, stocks: [{ id: 'stock1', medicineId: 'med1', branchId: 'b1', batchNumber: 'BATCH-1', quantity: 50, expiryDate: '2030-12-31', unit: 'Pcs', mrp: 10 }] };
  const fixtures = {
    '/hr/employees': [employee], '/hr/attendance': [{ id: 'att1', employeeId: 'e1', employee, branchId: 'b1', date: '2026-11-04', isoDate: '2026-11-04', clockIn: '09:00', clockOut: '17:00', shift: 'Morning' }],
    '/hr/leaves': [{ id: 'leave1', employee, leaveType: { name: 'Annual leave' }, status: 'pending', startDate: '2026-11-05', endDate: '2026-11-06', reason: 'Family event' }],
    '/hr/leave-types': [{ id: 'lt1', name: 'Annual leave', branchId: 'b1', maxDaysPerYear: 14, isPaid: true }],
    '/hr/shifts': [shift], '/hr/rosters': [roster], '/hr/assigned-rosters': [{ id: 'assignment1', rosterId: 'roster1', employeeId: 'e1', employee, roster, branchId: 'b1', startDate: roster.startDate, endDate: roster.endDate }],
    '/hr/departments': [{ id: 'dep1', name: 'Pharmacy', branchId: 'b1' }], '/hr/designations': [{ id: 'job1', name: 'Pharmacist', branchId: 'b1', departmentId: 'dep1', department: { name: 'Pharmacy' } }], '/hr/annual-calendars': [{ id: 'event1', name: 'Public holiday', branchId: 'b1', type: 'holiday', startDate: roster.startDate, endDate: roster.endDate }],
  };
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/backend/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname.replace('/api/backend', '');
    let data = [], meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    if (request.method() !== 'GET') { writes.push({ endpoint, body: request.postData() ? request.postDataJSON() : null }); await new Promise(resolve => setTimeout(resolve, 160)); data = { id: 'saved' }; }
    else if (endpoint === '/auth/me') data = { id: 'admin', fullName: 'UI reviewer', role: { permissions: [{ key: '*' }] } };
    else if (endpoint === '/branches') data = [{ id: 'b1', name: 'Main Pharmacy' }];
    else if (endpoint === '/users') data = [member];
    else if (endpoint === '/roles') data = [member.role];
    else if (endpoint === '/pharmacy/medicines') { data = [medicine]; meta = { page: 1, totalItems: 1, pageSize: 20, totalPages: 1 }; }
    else data = fixtures[endpoint] || [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, meta }) });
  });
  const base = process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000';
  async function fieldsAbove(dialog) {
    const failures = await dialog.locator('label').evaluateAll(labels => labels.flatMap(label => {
      if (label.classList.contains('ui-select-search') || label.classList.contains('hr-setup-paid-toggle')) return [];
      const field = label.querySelector('.ui-select') || label.querySelector('input:not([type=checkbox]),textarea');
      const text = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!field || !text || !field.getClientRects().length) return [];
      const range = document.createRange(); range.selectNodeContents(text);
      const caption = range.getBoundingClientRect(), box = field.getBoundingClientRect(), row = label.getBoundingClientRect();
      return caption.bottom > box.top + 1 || box.width < row.width - 4 ? [{ label: text.textContent.trim(), captionBottom: caption.bottom, fieldTop: box.top, fieldWidth: box.width, labelWidth: row.width }] : [];
    }));
    assert.deepEqual(failures, [], 'Labels must be above full-width controls');
  }
  async function preview(name) {
    const dialog = page.getByRole('dialog'); await dialog.waitFor(); await fieldsAbove(dialog);
    await page.screenshot({ path: path.resolve('../work', `${name}.png`) });
    await page.setViewportSize({ width: 390, height: 844 }); await fieldsAbove(dialog);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    const body = dialog.locator('.operations-dialog-body,.hr-setup-dialog-body'); if (await body.count()) await body.evaluate(e => e.scrollTop = e.scrollHeight);
    const footer = await dialog.locator('footer').boundingBox(); assert.ok(footer.y + footer.height <= 845);
    await page.screenshot({ path: path.resolve('../work', `${name}-mobile.png`) });
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await page.setViewportSize({ width: 1440, height: 1000 });
  }
  try {
    for (const theme of ['light', 'dark']) {
      await page.goto(base + '/access'); await page.getByRole('button', { name: 'Actions for Sample Cashier', exact: true }).waitFor();
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
      await page.getByRole('button', { name: 'Actions for Sample Cashier', exact: true }).click(); await page.getByRole('menuitem', { name: 'Reset password', exact: true }).click(); await preview('reset-password-' + theme);
      await page.goto(base + '/hr');
      for (const [tab, add, record] of [['Employees', 'Add employee', 'Employee One'], ['Attendance', 'Record attendance', 'Employee One'], ['Leave requests', 'New leave request', 'Employee One']]) {
        await page.locator('.hr-tabs').getByRole('button', { name: tab, exact: true }).click(); await page.getByText(record, { exact: true }).first().waitFor();
        await page.locator('.page-heading-row').getByRole('button', { name: add, exact: true }).click(); await preview(`${tab.replaceAll(' ', '-')}-add-${theme}`);
        if (tab !== 'Leave requests') { await page.getByRole('button', { name: 'Edit', exact: true }).first().click(); await preview(`${tab}-edit-${theme}`); }
        else { await page.getByRole('button', { name: 'Review', exact: true }).click(); await preview('leave-review-' + theme); }
      }
      await page.goto(base + '/hr/rosters');
      for (const [tab, add] of [['Shift definitions', 'Add shift'], ['Duty rosters', 'Add roster'], ['Staff assignments', 'Add assignment']]) {
        await page.locator('.hr-tabs').getByRole('button', { name: tab, exact: true }).click(); await page.getByRole('button', { name: 'Edit', exact: true }).first().waitFor();
        await page.getByRole('button', { name: add, exact: true }).click(); await preview(`${add.replaceAll(' ', '-')}-${theme}`);
        await page.getByRole('button', { name: 'Edit', exact: true }).first().click();
        if (tab !== 'Shift definitions') assert.equal(await page.getByRole('dialog').getByLabel(tab === 'Duty rosters' ? 'Start date' : 'From', { exact: true }).inputValue(), '2026-11-04');
        await preview(`${tab.replaceAll(' ', '-')}-edit-${theme}`);
      }
      await page.goto(base + '/hr/setup');
      for (const [tab, add] of [['Departments', 'Add department'], ['Designations', 'Add designation'], ['Leave types', 'Add leave type'], ['Annual calendar', 'Add calendar event']]) { await page.locator('.hr-setup-tabs').getByRole('button', { name: tab, exact: true }).click(); await page.getByRole('button', { name: add, exact: true }).first().click(); await preview(`${add.replaceAll(' ', '-')}-${theme}`); }
      await page.goto(base + '/catalog'); const edit = page.getByRole('button', { name: 'Edit Sample medicine', exact: true }); await edit.waitFor();
      assert.equal(await edit.innerText(), 'Edit'); const batches = page.getByRole('button', { name: 'View batches for Sample medicine', exact: true }); assert.equal(await batches.innerText(), 'View batches');
      await page.screenshot({ path: path.resolve('../work', `catalog-actions-${theme}.png`), fullPage: true });
      await page.setViewportSize({ width: 390, height: 844 });
      for (const button of [edit, batches]) { const bounds = await button.boundingBox(); assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 391 && bounds.height >= 36); }
      await page.screenshot({ path: path.resolve('../work', `catalog-actions-${theme}-mobile.png`), fullPage: true });
      await batches.click(); await page.getByRole('dialog', { name: 'Medicine batch details', exact: true }).getByText('Batch BATCH-1', { exact: true }).waitFor(); await page.keyboard.press('Escape'); await page.setViewportSize({ width: 1440, height: 1000 });
      await edit.click(); await page.getByRole('dialog').getByRole('textbox', { name: /^Medicine name/ }).waitFor(); await page.keyboard.press('Escape');
    }
    assert.equal(writes.length, 0);
    await page.goto(base + '/access'); await page.getByRole('button', { name: 'Actions for Sample Cashier', exact: true }).click(); await page.getByRole('menuitem', { name: 'Reset password', exact: true }).click(); const reset = page.getByRole('dialog', { name: 'Reset password', exact: true });
    await reset.getByLabel('New password', { exact: true }).fill('StrongPassword1'); await reset.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword2'); await reset.getByRole('button', { name: 'Update password', exact: true }).click(); await reset.getByRole('alert').waitFor(); assert.equal(writes.length, 0);
    await reset.getByLabel('Confirm password', { exact: true }).fill('StrongPassword1'); await reset.getByText('Passwords match', { exact: true }).waitFor();
    await reset.getByRole('button', { name: 'Show password · New password', exact: true }).click(); assert.equal(await reset.getByLabel('New password', { exact: true }).getAttribute('type'), 'text');
    await reset.getByRole('button', { name: 'Update password', exact: true }).evaluate(b => { b.click(); b.click(); }); await reset.waitFor({ state: 'hidden' }); assert.equal(writes.length, 1); assert.equal(writes[0].endpoint, '/auth/admin/change-password/u1');
    assert.deepEqual(errors, []);
    await fs.mkdir(path.resolve('../outputs'), { recursive: true });
    for (const [from, to] of [['reset-password-light.png', 'reset-password-modal-preview.png'], ['Attendance-add-light.png', 'attendance-modal-preview.png'], ['Add-roster-light.png', 'duty-roster-modal-preview.png'], ['catalog-actions-light.png', 'catalog-actions-preview.png']]) await fs.copyFile(path.resolve('../work', from), path.resolve('../outputs', to));
    console.log('PASS modal fields: labels above full-width inputs across reset/HR/rosters/HR setup, add/edit/review light/dark/mobile, fixed footers, roster dates, visible catalog actions with correct destinations, reset match/visibility/validation/duplicate contract. Mock API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
