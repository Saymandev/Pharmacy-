/* eslint @typescript-eslint/no-require-imports: "off" */
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs/promises');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [], writes = [];
  const permissions = [{ id: 'p1', key: 'sale:read', action: 'read', module: 'sale', description: 'View sales and saved invoices.' }, { id: 'p2', key: 'sale:create', action: 'create', module: 'sale', description: 'Create a sale at the point of sale.' }];
  const role = { id: 'r1', name: 'Cashier', description: 'Sales and customer service', permissionCount: 2, userCount: 1, permissions, permissionsByModule: { sale: permissions } };
  const member = { id: 'u1', username: 'cashier', fullName: 'Sample Cashier', email: 'cashier@example.test', isActive: true, role, branchId: 'b1', branch: { name: 'Main Pharmacy' } };
  let settings = [{ id: 's1', name: 'general', configs: { title: 'Main Pharmacy', email: 'info@example.test', enableAlerts: true, details: { sender: 'Pharmacy' } } }, { id: 's2', name: 'pharmacy', configs: { lowStockThreshold: 10, vatPercentage: 5 } }];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/api/backend/**', async route => {
    const request = route.request(), endpoint = new URL(request.url()).pathname.replace('/api/backend', '');
    let data = [], meta;
    if (request.method() !== 'GET') {
      const body = request.postDataJSON(); writes.push({ endpoint, method: request.method(), body });
      if (endpoint === '/users/u1' && request.method() === 'PATCH') Object.assign(member, body);
      if (endpoint.startsWith('/settings/')) settings = settings.map(s => s.name === endpoint.split('/').at(-1) ? { ...s, configs: body.configs } : s);
      data = { id: 'saved' };
    } else if (endpoint === '/auth/me') data = { id: 'admin', fullName: 'UI reviewer', role: { permissions: [{ key: '*' }] } };
    else if (endpoint === '/users') { data = [member]; meta = { page: 1, totalItems: 1, totalPages: 1 }; }
    else if (endpoint === '/roles') data = [role];
    else if (endpoint === '/roles/permissions') data = { sale: permissions, customer: [{ id: 'p3', key: 'customer:read', action: 'read', module: 'customer', description: 'View customer accounts.' }] };
    else if (endpoint === '/roles/r1') data = role;
    else if (endpoint === '/branches') data = { branches: [{ id: 'b1', name: 'Main Pharmacy', address: 'Dhaka city', email: 'branch@example.test', phone: '01700000000' }], pagination: { total: 1, page: 1, limit: 100, totalPages: 1 } };
    else if (endpoint === '/communication/notifications') { data = [{ id: 'n1', title: 'Stock needs attention', message: 'Review low-stock medicines before the next purchase.', createdAt: '2026-11-04T03:00:00Z', isRead: false }]; meta = { unreadCount: 1 }; }
    else if (endpoint === '/communication/notices') data = [{ id: 'n2', title: 'Opening hours update', content: 'The main pharmacy opens at 8 AM from Sunday.', postedBy: { fullName: 'Administrator' }, createdAt: '2026-11-04T03:00:00Z' }];
    else if (endpoint === '/media') data = [{ id: 'm1', fileName: 'Pharmacy product image.png', type: 'image', url: '/pharmacy-mark.svg', size: 24000 }];
    else if (endpoint === '/media/m1') data = { id: 'm1', fileName: 'Pharmacy product image.png', metadata: {} };
    else if (endpoint === '/settings') data = settings;
    else if (endpoint === '/settings/BACKUP_CONFIG') data = { configs: { retentionCount: 5, cronExpression: '0 0 * * *', autoBackupEnabled: true } };
    else if (endpoint === '/backups/history') data = [{ id: 'backup1', fileName: 'pharmacy-2026-11-04.sql.gz', fileSize: 380000, status: 'completed', createdAt: '2026-11-04T03:00:00Z' }];
    else if (endpoint === '/settings/audit-logs/all') data = [{ id: 'a1', userName: 'Administrator', module: 'User', action: 'UPDATE', status: 'SUCCESS', note: 'Updated a team account', createdAt: '2026-11-04T03:00:00Z' }];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data, meta }) });
  });
  const base = process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000';
  const screenshot = name => page.screenshot({ path: path.resolve('../work', name), fullPage: true });
  const noOverflow = async () => assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
  try {
    await page.goto(base + '/access');
    const actions = page.getByRole('button', { name: 'Actions for Sample Cashier', exact: true }); await actions.waitFor();
    await actions.click(); const menu = page.getByRole('menu'); await menu.waitFor(); assert.equal(await menu.getByRole('menuitem').count(), 4);
    await page.keyboard.press('ArrowDown'); assert.equal(await page.getByRole('menuitem', { name: 'Reset password' }).evaluate(e => e === document.activeElement), true);
    await page.keyboard.press('Escape'); assert.equal(await menu.isVisible(), false); assert.equal(await actions.evaluate(e => e === document.activeElement), true);
    await actions.click(); await page.getByRole('heading', { name: 'Team access', exact: true }).click(); assert.equal(await menu.isVisible(), false);
    await actions.click(); await menu.getByRole('menuitem', { name: 'Edit', exact: true }).click();
    let dialog = page.getByRole('dialog', { name: 'Edit user', exact: true }); await dialog.waitFor();
    assert.equal(await dialog.getByRole('textbox', { name: 'Username', exact: true }).isDisabled(), true);
    await dialog.getByRole('textbox', { name: 'Full name', exact: true }).fill('Sample Cashier Updated');
    await dialog.getByRole('button', { name: 'Save changes', exact: true }).evaluate(button => { button.click(); button.click(); }); await dialog.waitFor({ state: 'hidden' });
    assert.equal(writes.filter(w => w.endpoint === '/users/u1').length, 1); assert.equal(writes[0].body.fullName, 'Sample Cashier Updated');
    await page.getByRole('button', { name: 'Add user', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Create user', exact: true });
    await dialog.getByRole('textbox', { name: 'Full name', exact: true }).fill('New Team Member'); await dialog.getByRole('textbox', { name: 'Username', exact: true }).fill('new.member'); await dialog.getByRole('textbox', { name: 'Email', exact: true }).fill('new@example.test');
    await dialog.getByRole('combobox',{name:'Role',exact:true}).selectOption('r1'); await dialog.getByLabel('Temporary password', { exact: true }).fill('StrongPassword1'); await dialog.getByRole('button', { name: 'Show password', exact: true }).click(); assert.equal(await dialog.getByLabel('Temporary password', { exact: true }).getAttribute('type'), 'text');
    await screenshot('access-create-desktop.png');
    await page.setViewportSize({ width: 390, height: 844 }); await noOverflow();
    await dialog.locator('.access-editor-body').evaluate(e => e.scrollTop = e.scrollHeight); assert.equal(await dialog.getByRole('button', { name: 'Create user', exact: true }).isVisible(), true);
    const footer = await dialog.locator('footer').boundingBox(); assert.ok(footer.y + footer.height <= 845); await screenshot('access-create-mobile.png');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click(); await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Roles & permissions', exact: true }).click(); await page.getByRole('button', { name: 'View permissions', exact: true }).click();
    dialog = page.getByRole('dialog'); await dialog.locator('.access-permission-groups').waitFor();
    assert.ok(await dialog.locator('.access-permission-groups strong').first().evaluate(e => parseFloat(getComputedStyle(e).fontSize)) >= 15); await screenshot('role-permissions-desktop.png'); await dialog.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Edit role', exact: true }).click(); dialog = page.getByRole('dialog', { name: 'Edit role', exact: true });
    await dialog.getByRole('textbox', { name: 'Search permissions', exact: true }).fill('no-match'); await dialog.getByText('No permissions match your search', { exact: true }).waitFor();
    await dialog.getByRole('textbox', { name: 'Search permissions', exact: true }).fill('sale'); await dialog.getByRole('button', { name: 'Clear module', exact: true }).click(); assert.equal(await dialog.getByRole('checkbox', { checked: true }).count(), 0);
    await dialog.getByRole('button', { name: 'Select module', exact: true }).click(); assert.equal(await dialog.getByRole('checkbox', { checked: true }).count(), 2); await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.goto(base + '/admin');
    const adminNav = page.locator('.admin-tabs');
    const readySelectors={'Notifications':'.admin-notification','Notice board':'.admin-notice','Media library':'.admin-media-item','Settings':'.admin-setting:visible','Backups':'.admin-backup-list>article','Audit trail':'.hr-table tbody tr','Branches & locations':'.hr-table tbody tr'};
    const ready=async name=>page.locator(readySelectors[name]).first().waitFor();
    for (const name of ['Notifications', 'Notice board', 'Media library', 'Settings', 'Backups', 'Audit trail', 'Branches & locations']) {
      await adminNav.getByRole('button', { name, exact: true }).click(); await page.locator('.admin-section-heading h2').filter({ hasText: name }).waitFor(); await ready(name);
      await noOverflow(); await screenshot('admin-' + name.replaceAll(/[^a-z0-9]/gi, '-').toLowerCase() + '.png');
      await page.setViewportSize({ width: 390, height: 844 }); await noOverflow(); await page.setViewportSize({ width: 1440, height: 1000 });
    }
    await adminNav.getByRole('button', { name: 'Branches & locations', exact: true }).click();await page.locator('.admin-page[data-view=branches] .hr-table tbody tr').waitFor();assert.match(await page.locator('.admin-page[data-view=branches] .hr-table').innerText(),/Main Pharmacy/);assert.match(await page.locator('.admin-section-count').innerText(),/1 on this page/);
    await adminNav.getByRole('button', { name: 'Notice board', exact: true }).click();await page.getByRole('button',{name:'Publish notice',exact:true}).click();const noticeDialog=page.getByRole('dialog',{name:'Publish a notice',exact:true});await noticeDialog.getByRole('combobox',{name:'Branch audience',exact:true}).locator('option[value=b1]').waitFor({state:'attached'});assert.equal(await noticeDialog.getByRole('combobox',{name:'Branch audience',exact:true}).locator('option[value=b1]').textContent(),'Main Pharmacy');await noticeDialog.getByRole('button',{name:'Close',exact:true}).click();
    await adminNav.getByRole('button', { name: 'Settings', exact: true }).click();
    const editor = page.locator('.admin-setting:visible'); await editor.getByRole('textbox', { name: 'title', exact: true }).fill('Changed title'); await editor.getByText('Unsaved changes', { exact: true }).waitFor();
    await page.locator('.admin-settings-categories').getByRole('button', { name: /pharmacy/i }).click(); await editor.getByRole('spinbutton', { name: 'low Stock Threshold', exact: true }).waitFor();
    await page.locator('.admin-settings-categories').getByRole('button', { name: /general/i }).click(); assert.equal(await editor.getByRole('textbox', { name: 'title', exact: true }).inputValue(), 'Changed title');
    await editor.getByRole('button', { name: 'Reset changes', exact: true }).click(); assert.equal(await editor.getByRole('textbox', { name: 'title', exact: true }).inputValue(), 'Main Pharmacy');
    await editor.locator('summary').click(); await editor.getByRole('textbox', { name: 'details', exact: true }).fill('{'); await editor.getByRole('button', { name: 'Save settings', exact: true }).click(); await editor.getByRole('alert').waitFor();
    await editor.getByRole('textbox', { name: 'details', exact: true }).fill('{"sender":"Updated"}'); await editor.getByRole('button', { name: 'Save settings', exact: true }).click(); await page.getByRole('status').filter({ hasText: 'settings saved' }).waitFor();
    assert.deepEqual(writes.find(w => w.endpoint === '/settings/general').body.configs.details, { sender: 'Updated' });
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    for (const name of ['Notifications', 'Notice board', 'Media library', 'Settings', 'Backups', 'Audit trail', 'Branches & locations']) { await adminNav.getByRole('button', { name, exact: true }).click(); await ready(name); await noOverflow(); }
    await adminNav.getByRole('button', { name: 'Settings', exact: true }).click(); await ready('Settings'); await screenshot('admin-settings-dark.png');
    await page.goto(base + '/access'); await page.getByRole('button', { name: 'Add user', exact: true }).click(); await screenshot('access-create-dark.png'); await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 }); await page.getByRole('button', { name: 'Roles & permissions', exact: true }).click(); await page.getByRole('button', { name: 'View permissions', exact: true }).click(); await noOverflow(); await screenshot('role-permissions-mobile-dark.png');
    assert.deepEqual(errors, []);
    await fs.mkdir(path.resolve('../outputs'), { recursive: true });
    for (const [from, to] of [['access-create-desktop.png', 'team-user-modal-preview.png'], ['role-permissions-desktop.png', 'role-permissions-preview.png'], ['admin-settings.png', 'settings-page-preview.png']]) await fs.copyFile(path.resolve('../work', from), path.resolve('../outputs', to));
    console.log('PASS administration browser: action menu keyboard/outside dismissal, edit payload/duplicate guard, create form/password visibility/mobile footer, permission search/module selection/readability, all seven admin tabs light/dark/mobile, settings drafts/reset/JSON save. Mock API only.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
