/* eslint @typescript-eslint/no-require-imports: "off" -- CommonJS runner resolves externally installed Playwright through NODE_PATH. */
// Requires Playwright and Chromium; mocks API responses, not live backend validation.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (require('node:fs').existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text())});
 page.setDefaultTimeout(30000);
 const posted=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const stock=(id,batchNumber,expiryDate,quantity)=>({id,branchId:'branch-a',batchNumber,expiryDate,quantity,mrp:75.5,unit:'Pcs'});
 const medicine={id:'med-a',name:'POS Test Medicine',salePrice:75.5,barcode:'123456',unit:'Pcs',stocks:[stock('expired','EXP','2020-01-01',10),stock('first','A','2030-01-01',1),stock('second','B','2031-01-01',3)]};
 await page.route('**/api/backend/**',async route=>{
  const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/backend','');let data=[];let meta;
  if(path==='/auth/me')data={id:'user-a',username:'cashier',fullName:'Test Cashier',role:{permissions:[{key:'*'}]}};
  else if(path==='/branches')data=[{id:'branch-a',name:'Test Branch'}];
  else if(path==='/pharmacy/medicines'){data=[medicine];meta={page:1,totalItems:1,pageSize:60,totalPages:1,hasNextPage:false};}
  else if(path==='/finance/accounts')data=[{id:'cash-a',name:'Cash drawer',type:'cash'}];
  else if(path==='/settings/tax')data={configs:{taxPercentage:0}};
  else if(path==='/pharmacy/cash-register/active')data={id:'session-a',closingBalance:0};
  else if(path.includes('customers'))data=[{id:'customer-a',name:'OPD customer',phone:''}];
  else if(path==='/sales'&&req.method()==='POST'){posted.push(req.postDataJSON());data={sale:{id:'sale-a',invoiceNumber:'SALE-TEST-1',createdAt:new Date().toISOString(),status:'completed',totalPrice:'75.50',netPrice:'75.50',paidAmount:'75.50',dueAmount:'0.00'}};}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data,...(meta?{meta}:{})})});
 });
 await page.goto(`${process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000'}/pos`);
 const product=page.getByRole('button').filter({hasText:'POS Test Medicine'}).first();
 await product.waitFor().catch(async e=>{console.log(await page.locator('body').innerText());console.log(errors);await browser.close();throw e;});await page.getByRole('textbox',{name:'Search medicine or scan barcode…'}).fill('POS Test');await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await product.click();
 const batches=page.getByRole('combobox',{name:'Batch for POS Test Medicine'});
 assert.equal(await batches.count(),2);
 assert.equal(await batches.nth(0).inputValue(),'first');assert.equal(await batches.nth(1).inputValue(),'second');
 assert.equal(await batches.nth(0).locator('option[value="expired"]').count(),0);
 assert.equal(await batches.nth(0).locator('option[value="second"]').isDisabled(),true);
 await page.getByRole('button',{name:'Hold cart',exact:true}).click();
 await page.getByRole('button',{name:'Held carts (1)',exact:true}).click();
 await page.getByRole('button',{name:'Resume cart',exact:true}).click();
 assert.equal(await batches.count(),2);
 await page.getByRole('button',{name:'Remove POS Test Medicine',exact:true}).nth(1).click();
 await page.keyboard.press('F2');assert.equal(await page.getByRole('textbox',{name:'Search medicine or scan barcode…'}).evaluate(el=>el===document.activeElement),true);
 await page.setViewportSize({width:390,height:844});
 await page.keyboard.press('F4');await page.getByRole('heading',{name:'Review & pay',exact:true}).waitFor();
 const amount=page.locator('.pos-tender-line input');await amount.fill('100');
 await page.getByText('Change to return',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth+1),true);
 await page.screenshot({path:'/tmp/pos-mobile-checkout.png'});
 await page.getByRole('button',{name:'Review & confirm sale',exact:true}).click();
 // Inspect confirmation before committing the mocked request.
 const confirm=page.getByRole('dialog',{name:'Confirm completed sale'});

 await confirm.getByRole('button').filter({hasText:/Confirm|Complete/}).last().click();
 await page.getByRole('dialog').filter({hasText:'SALE-TEST-1'}).waitFor();
 assert.equal(posted.length,1);assert.equal(posted[0].paidAmount,75.5);assert.equal(posted[0].payments[0].amount,75.5);assert.equal(posted[0].dueAmount,0);assert.equal(posted[0].saleItems[0].batchNumber,'A');
 await page.locator('.pos-receipt-paper').getByText(/Cash change returned/).waitFor();
 assert.deepEqual(errors,[]);
 console.log('PASS browser: FEFO, expiry exclusion, duplicate batch, hold/resume, F2/F4, cash change, sale payload, receipt; mocked API only.');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
