/* eslint @typescript-eslint/no-require-imports: "off" -- Resolve an externally installed browser driver via NODE_PATH. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];const writes=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.print=()=>{window.__printed=true;};});
  const member={id:'user-a',username:'test.cashier',email:'cashier@example.test',fullName:'Test Cashier',isActive:true,role:{id:'role-a',name:'Cashier',permissions:[{key:'*'}]}};
  const sale={id:'sale-a',invoiceNumber:'SALE-PERSISTED-1',branchId:'branch-a',branch:{id:'branch-a',name:'Test Branch'},customerId:'customer-a',customer:{id:'customer-a',name:'Test Customer'},type:'pos',status:'completed',paymentStatus:'paid',paymentMethod:'cash',totalPrice:'75.50',netPrice:'70.00',paidAmount:'70.00',dueAmount:'0.00',discountAmount:'5.50',taxAmount:'0.00',createdAt:'2026-10-31T12:00:00Z',saleItems:[{id:'item-a',medicineId:'med-a',itemName:'Saved Medicine',unit:'Pcs',price:'75.50',mrp:'75.50',quantity:1,totalPrice:'75.50',discountAmount:'0.00',batchNumber:'BATCH-A'}]};
  await page.route('**/api/backend/**',async route=>{
   const request=route.request();const path=new URL(request.url()).pathname.replace('/api/backend','');let data=[];let meta;
   if(path==='/auth/me')data=member;
   else if(path==='/branches')data=[{id:'branch-a',name:'Test Branch'}];
   else if(path==='/users')data=[member];
   else if(path==='/roles')data=[member.role];
   else if(path==='/permissions/grouped')data=[];
   else if(path.startsWith('/auth/admin/change-password/')){writes.push({path,body:request.postDataJSON()});data={message:'Password updated'};}
   else if(path==='/sales')data={sales:[sale],pagination:{total:1,page:1,limit:20,totalPages:1}};
   else if(path==='/sales/sale-a')data=sale;
   else if(path==='/finance/accounts')data=[{id:'cash-a',name:'Cash drawer',type:'cash'}];
   else if(path==='/customers'){data=[{id:'customer-a',name:'Test Customer',phone:'01000000000',balance:'0',gender:'other'}];meta={page:1,pageSize:20,totalItems:25,totalPages:2};}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data,...(meta?{meta}:{})})});
  });
  const base=process.env.POS_TEST_BASE_URL||'http://127.0.0.1:3000';
  await page.goto(base+'/access');
  await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();
  await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
  await page.reload();
  await page.getByRole('button',{name:'Switch to light mode',exact:true}).waitFor();
  assert.equal(await page.locator('.app-frame').getAttribute('data-theme'),'dark');
  assert.equal(await page.locator('.app-frame').evaluate(el=>el.classList.contains('sidebar-collapsed')),true);
  await page.getByRole('button',{name:'Toggle sidebar',exact:true}).click();
  await page.getByRole('button',{name:'Actions for Test Cashier',exact:true}).click();
  await page.getByRole('menuitem',{name:'Reset password',exact:true}).click();
  const reset=page.getByRole('dialog',{name:'Reset password'});
  await reset.getByLabel('New password',{exact:true}).fill('SyntheticTest123!');
  await reset.getByLabel('Confirm password',{exact:true}).fill('SyntheticTest123!');
  await reset.getByRole('button',{name:'Update password',exact:true}).click();
  await reset.waitFor({state:'hidden'});assert.equal(writes.length,1);assert.equal(writes[0].path,'/auth/admin/change-password/user-a');assert.equal(writes[0].body.newPassword,writes[0].body.confirmPassword);
  await page.goto(base+'/sales');await page.getByRole('button').filter({hasText:'SALE-PERSISTED-1'}).first().click();
  await page.getByRole('dialog',{name:'Sale details'}).getByRole('button',{name:'Print receipt'}).click();
  const receipt=page.getByRole('dialog',{name:'Receipt reprint'});await receipt.waitFor();
  assert.match(await receipt.innerText(),/SALE-PERSISTED-1/);assert.match(await receipt.innerText(),/70\.00/);assert.match(await receipt.innerText(),/BATCH-A/);
  await receipt.getByRole('button',{name:'Print receipt'}).click();assert.equal(await page.evaluate(()=>window.__printed),true);
  await page.goto(base+'/customers');await page.getByText('Test Customer',{exact:true}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'Next',exact:true}).isEnabled(),true);
  assert.deepEqual(errors,[]);
  console.log('PASS browser: persisted theme/sidebar, admin password reset contract, persisted receipt reprint, print action, customer envelope pagination. Mocked backend only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
