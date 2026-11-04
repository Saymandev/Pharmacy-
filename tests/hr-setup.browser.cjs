/* eslint @typescript-eslint/no-require-imports: "off" */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const writes = [], reads = [], errors = [];
  let failDepartmentOptions = false, failSave = false;
  const records = {
    departments: [{ id: 'd1', name: 'Pharmacy operations', branchId: 'b1', description: 'Pharmacists, dispensing and daily store operations.' }],
    designations: [{ id: 'job1', name: 'Senior pharmacist', branchId: 'b1', departmentId: 'd1', department: { name: 'Pharmacy operations' }, description: 'Dispensing and quality control.' }],
    'leave-types': [{ id: 'leave1', name: 'Annual leave', branchId: 'b1', maxDaysPerYear: 14, isPaid: true, description: 'Yearly paid leave entitlement.' }],
    'annual-calendars': [{ id: 'cal1', name: 'Branch holiday', branchId: 'b1', type: 'holiday', startDate: '2026-11-03T18:00:00.000Z', endDate: '2026-11-05T17:59:59.999Z', description: 'Holiday for the main pharmacy.' }],
  };
  await page.route('**/api/backend/**', async route => {
    const request = route.request(), url = new URL(request.url()), endpoint = url.pathname.replace('/api/backend', '');
    let data = [], meta, status = 200, message = 'Success';
    if (request.method() !== 'GET') {
      const body = request.postData() ? request.postDataJSON() : undefined;
      writes.push({ method: request.method(), endpoint, body });
      await new Promise(resolve => setTimeout(resolve, 120));
      if (failSave) { status = 503; message = 'Could not save configuration'; } else data = { id: 'saved' };
    } else {
      reads.push(url);
      if (endpoint === '/auth/me') data = { id: 'reviewer', fullName: 'HR reviewer', role: { permissions: [{ key: '*' }] } };
      else if (endpoint === '/branches') data = [{ id: 'b1', name: 'Main Pharmacy' }, { id: 'b2', name: 'Second Pharmacy' }];
      else if (endpoint === '/hr/departments' && url.searchParams.get('limit') === '100') {
        if (url.searchParams.get('branchId') === 'b2') {
          if (failDepartmentOptions) { status = 503; message = 'Department options unavailable'; }
          else { data = [{ id: 'd2', name: 'Second branch team', branchId: 'b2' }]; meta = { page: 1, limit: 100, total: 1, totalPages: 1 }; }
        } else {
          const second = url.searchParams.get('page') === '2';
          data = second ? [{ id: 'd101', name: 'Last department', branchId: 'b1' }] : [records.departments[0], ...Array.from({ length: 99 }, (_, i) => ({ id: 'dept' + i, name: 'Department ' + i, branchId: 'b1' }))];
          meta = { page: second ? 2 : 1, limit: 100, total: 101, totalPages: 2 };
        }
      } else if (endpoint.startsWith('/hr/')) {
        data = records[endpoint.split('/').at(-1)] || [];
        if (endpoint.endsWith('/departments') || endpoint.endsWith('/designations')) meta = { page: 1, limit: 20, total: data.length, totalPages: 1 };
      }
    }
    await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status === 200, data, meta, message }) });
  });
  page.on('pageerror', error => errors.push(error.message));
  const base = process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000';
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  const snap = async name => { await page.evaluate(()=>window.scrollTo(0,0)); return page.screenshot({ path: path.resolve('../work', name), fullPage: await page.getByRole('dialog').count()===0 }); };
  const configurations = [['Departments', 'department', 'departments'], ['Designations', 'designation', 'designations'], ['Leave types', 'leave type', 'leave-types'], ['Annual calendar', 'calendar event', 'annual-calendars']];
  try {
    await page.goto(base + '/hr/setup'); await page.locator('.hr-setup-table tbody tr').waitFor();
    for (const theme of ['light', 'dark']) {
      if (theme === 'dark') await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
      for (const [tab, singular, entity] of configurations) {
        await page.locator('.hr-setup-tabs').getByRole('button', { name: tab, exact: true }).click();
        await page.getByText(records[entity][0].name, { exact: true }).first().waitFor(); await noOverflow(); await snap(`hr-setup-${entity}-${theme}.png`);
        for (const edit of [false, true]) {
          await (edit ? page.getByRole('button', { name: 'Edit', exact: true }).first() : page.getByRole('button', { name: 'Add ' + singular, exact: true })).click();
          const dialog = page.getByRole('dialog', { name: (edit ? 'Edit ' : 'Add ') + singular, exact: true }); await dialog.waitFor();
          if (entity === 'designations') await dialog.getByRole('option', { name: 'Last department', exact: true }).waitFor({ state: 'attached' });
          if (entity === 'annual-calendars' && edit) { assert.equal(await dialog.getByLabel('Start date', { exact: true }).inputValue(), '2026-11-04'); assert.equal(await dialog.getByLabel('End date', { exact: true }).inputValue(), '2026-11-05'); }
          await snap(`hr-modal-${entity}-${edit ? 'edit' : 'add'}-${theme}.png`);
          await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
          await dialog.locator('.hr-setup-dialog-body').evaluate(e => e.scrollTop = e.scrollHeight);
          const footer = await dialog.locator('footer').boundingBox(); assert.ok(footer.y + footer.height <= 845);
          await snap(`hr-modal-${entity}-${edit ? 'edit' : 'add'}-${theme}-mobile.png`);
          await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); await noOverflow(); await snap(`hr-setup-${entity}-${theme}-mobile.png`);
          await page.setViewportSize({ width: 1440, height: 1000 });
        }
      }
    }
    assert.equal(writes.length, 0, 'Previewing every modal must not mutate records');
    await page.locator('.hr-setup-tabs').getByRole('button', { name: 'Designations', exact: true }).click(); await page.getByText('Senior pharmacist', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Edit', exact: true }).click();
    let dialog = page.getByRole('dialog'); await dialog.getByRole('option', { name: 'Last department', exact: true }).waitFor({ state: 'attached' });
    await dialog.getByRole('combobox', { name: 'Department', exact: true }).selectOption('d101');
    failDepartmentOptions = true; await dialog.getByRole('combobox', { name: 'Branch', exact: true }).selectOption('b2');
    await dialog.getByRole('alert').waitFor(); assert.equal(await dialog.getByRole('combobox', { name: 'Department', exact: true }).inputValue(), ''); assert.equal(await dialog.getByRole('button', { name: 'Save changes', exact: true }).isDisabled(), true);
    failDepartmentOptions = false; await dialog.getByRole('button', { name: 'Retry', exact: true }).click(); await dialog.getByRole('option', { name: 'Second branch team', exact: true }).waitFor({ state: 'attached' });
    assert.equal(await dialog.getByRole('option', { name: 'Last department', exact: true }).count(), 0); await dialog.getByRole('combobox', { name: 'Department', exact: true }).selectOption('d2');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).evaluate(b => { b.click(); b.click(); }); await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes.length, 1); assert.equal(writes[0].body.branchId, 'b2'); assert.equal(writes[0].body.departmentId, 'd2');
    await page.locator('.hr-setup-tabs').getByRole('button', { name: 'Annual calendar', exact: true }).click(); await page.getByText('Branch holiday', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Edit', exact: true }).click(); dialog = page.getByRole('dialog');
    await dialog.getByLabel('End date', { exact: true }).fill('2026-11-03'); await dialog.getByRole('button', { name: 'Save changes', exact: true }).click(); await dialog.getByRole('alert').waitFor(); assert.equal(writes.length, 1);
    await dialog.getByLabel('End date', { exact: true }).fill('2026-11-04'); await dialog.getByRole('combobox', { name: 'Branch', exact: true }).selectOption('');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes[1].body.startDate, '2026-11-03T18:00:00.000Z'); assert.equal(writes[1].body.endDate, '2026-11-04T17:59:59.999Z'); assert.equal(writes[1].body.dayCount, 1); assert.equal(writes[1].body.branchId, null);
    await page.locator('.hr-setup-tabs').getByRole('button', { name: 'Leave types', exact: true }).click(); await page.getByText('Annual leave', { exact: true }).waitFor(); await page.getByRole('button', { name: 'Add leave type', exact: true }).click(); dialog = page.getByRole('dialog');
    await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Unpaid leave'); await dialog.getByRole('spinbutton', { name: 'Annual days', exact: true }).fill('1.5'); await dialog.getByRole('button', { name: 'Save configuration', exact: true }).click(); await dialog.getByRole('alert').waitFor(); assert.equal(writes.length, 2);
    await dialog.getByRole('spinbutton', { name: 'Annual days', exact: true }).fill('0'); await dialog.getByRole('checkbox', { name: 'Paid leave', exact: true }).uncheck(); await dialog.getByRole('button', { name: 'Save configuration', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes[2].body.maxDaysPerYear, 0); assert.equal(writes[2].body.isPaid, false); assert.equal(await page.getByRole('navigation', { name: 'Pagination', exact: true }).count(), 0);
    await page.locator('.hr-setup-tabs').getByRole('button', { name: 'Departments', exact: true }).click(); await page.getByText('Pharmacy operations', { exact: true }).waitFor();
    const searched = page.waitForRequest(r => r.url().includes('/hr/departments?') && new URL(r.url()).searchParams.get('search') === 'Back office'); await page.getByRole('textbox', { name: 'Search Departments…', exact: true }).fill('Back office'); await searched;
    await page.getByRole('button', { name: 'Add department', exact: true }).click(); dialog = page.getByRole('dialog'); await dialog.getByRole('textbox', { name: 'Name', exact: true }).fill('Draft department');
    failSave = true; await dialog.getByRole('button', { name: 'Save configuration', exact: true }).click(); await dialog.getByRole('alert').waitFor(); assert.equal(await dialog.getByRole('textbox', { name: 'Name', exact: true }).inputValue(), 'Draft department'); await snap('hr-modal-save-error-dark.png'); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.evaluate(() => localStorage.setItem('pharmacy.language', 'bn')); await page.reload(); await page.locator('.hr-setup-table tbody tr').waitFor(); await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(); await snap('hr-setup-bangla-mobile.png');
    assert.deepEqual(errors, []);
    await fs.mkdir(path.resolve('../outputs'), { recursive: true });
    for (const [from, to] of [['hr-setup-leave-types-light.png', 'hr-setup-page-preview.png'], ['hr-modal-leave-types-add-light.png', 'hr-leave-modal-preview.png'], ['hr-modal-annual-calendars-edit-dark.png', 'hr-calendar-modal-preview.png']]) await fs.copyFile(path.resolve('../work', from), path.resolve('../outputs', to));
    console.log('PASS HR setup browser: all four add/edit dialogs and tabs in light/dark/mobile, fixed footer, permission-safe previews, paginated department options, branch change/retry, calendar Dhaka date/day-count/global scope, leave validation, duplicate guard, server search, save-error draft retention, Bangla. Mock API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
