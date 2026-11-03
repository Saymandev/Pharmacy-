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
  else if(path==='/pharmacy/categories')data=[{id:'cat-a',name:'Tablets'},{id:'cat-b',name:'Syrups'}];
  else if(path==='/pharmacy/medicines'&&req.method()==='POST'){posted.push(req.postDataJSON());data={id:'created',...req.postDataJSON()};}
  else if(path==='/pharmacy/medicines'){data=[medicine];meta={page:1,totalItems:1,pageSize:60,totalPages:1,hasNextPage:false};}
  else if(path==='/finance/accounts')data=[{id:'cash-a',name:'Cash drawer',type:'cash'}];
  else if(path==='/settings/tax')data={configs:{taxPercentage:0}};
  else if(path==='/pharmacy/cash-register/active')data={id:'session-a',closingBalance:0};
  else if(path.includes('customers'))data=[{id:'customer-a',name:'OPD customer',phone:''}];
  else if(path==='/sales'&&req.method()==='POST'){posted.push(req.postDataJSON());data={sale:{id:'sale-a',invoiceNumber:'SALE-TEST-1',createdAt:new Date().toISOString(),status:'completed',totalPrice:'75.50',netPrice:'75.50',paidAmount:'75.50',dueAmount:'0.00'}};}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data,...(meta?{meta}:{})})});
 });
 await page.goto(`${process.env.POS_TEST_BASE_URL || 'http://127.0.0.1:3000'}/pos`);


 await page.goto('http://127.0.0.1:3000/catalog');
 const launch=page.getByRole('button',{name:'Add medicine',exact:true});await launch.click();
 const dialog=page.getByRole('dialog',{name:'Add medicine',exact:true});await dialog.waitFor();
 const name=dialog.getByRole('textbox',{name:/^Medicine name/});assert.equal(await name.evaluate(el=>el===document.activeElement),true);
 await dialog.getByRole('button',{name:'Add medicine',exact:true}).click();assert.equal(posted.length,0);
 await name.fill('New UI Test Medicine');await dialog.getByRole('textbox',{name:/^Generic name \*/}).fill('Paracetamol');
 const category=dialog.getByRole('combobox',{name:'Category',exact:true});
 await category.locator('..').locator('.ui-select-display').click();let popup=page.locator('.ui-select-popup:popover-open');await popup.waitFor();await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'custom-select.png')});
 await popup.getByRole('combobox',{name:'Search options',exact:true}).fill('syr');await popup.getByRole('option',{name:'Syrups',exact:true}).click();assert.equal(await category.inputValue(),'cat-b');
 await category.focus();await page.keyboard.press('ArrowDown');await popup.getByRole('combobox',{name:'Search options',exact:true}).fill('not-found');await popup.getByRole('status').filter({hasText:'No matching options'}).waitFor();
 await page.keyboard.press('Escape');await popup.waitFor({state:'hidden'});assert.equal(await dialog.isVisible(),true);
 await category.focus();await page.keyboard.press('Enter');await popup.getByRole('combobox',{name:'Search options',exact:true}).fill('tab');await page.keyboard.press('Enter');assert.equal(await category.inputValue(),'cat-a');
 await category.locator('..').locator('.ui-select-display').click();await name.click();await popup.waitFor({state:'hidden'});
 for(const width of [1440,768,390]){await page.setViewportSize({width,height:900});assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'medicine-modal-'+width+'.png')});}
 await page.setViewportSize({width:1440,height:900});await dialog.getByRole('button',{name:'Add medicine',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(posted.length,1);assert.equal(posted[0].categoryId,'cat-a');assert.equal(posted[0].name,'New UI Test Medicine');
 await launch.click();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await launch.evaluate(el=>el===document.activeElement),true);
 for(const path of ['/catalog','/inventory','/purchases','/sales','/customers','/finance','/reports','/hr','/admin','/access']) {await page.setViewportSize({width:390,height:844});await page.goto('http://127.0.0.1:3000'+path);await page.locator('.page-heading-row h1').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,path+' horizontal overflow');const h=await page.locator('.page-heading-row').boundingBox();assert.ok(h.x>=0 && h.x+h.width<=392,path+' header exceeds viewport');}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS shared custom dropdown search/mouse/keyboard/Escape/outside, medicine form payload/validation/focus, modal layouts, ten responsive page headers');
})().catch(e=>{console.error(e);process.exit(1)});
