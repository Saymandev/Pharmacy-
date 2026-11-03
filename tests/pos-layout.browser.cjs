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

 await page.locator('.pos-focus-mode').waitFor();
 await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
 await page.goto('http://127.0.0.1:3000/catalog');
 await page.getByRole('link',{name:'Point of sale',exact:true}).click();
 await page.locator('.pos-focus-mode').waitFor();
 await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
 const product=page.getByRole('button').filter({hasText:'POS Test Medicine'}).first();await product.waitFor();
 for(const width of [1440,1024,390]) {
  await page.setViewportSize({width,height:900});
  const bounds=await page.locator('.pos-catalog').boundingBox();const workspace=await page.locator('.pos-workspace').boundingBox();assert.ok(Math.abs(bounds.width-workspace.width)<2);
  assert.equal(await page.locator('.pos-cart-panel').count(),0);
  await page.getByRole('button',{name:'Filters',exact:false}).first().click();
  await page.getByRole('heading',{name:'Medicine catalog',exact:true}).click();assert.equal(await page.locator('#pos-filter-popover').count(),0);
  await page.getByRole('button',{name:'Filters',exact:false}).first().click();await page.keyboard.press('Escape');assert.equal(await page.locator('#pos-filter-popover').count(),0);
  await page.getByRole('button',{name:'Filters',exact:false}).first().click();await page.getByRole('button',{name:'Close filters',exact:true}).click();assert.equal(await page.locator('#pos-filter-popover').count(),0);
  await product.click();await page.getByRole('button',{name:'Open current sale',exact:true}).click();
  const drawer=page.getByRole('dialog',{name:'Current sale',exact:true});await drawer.waitFor();assert.equal(await drawer.evaluate(el=>el.matches(':modal')),true);
  await page.keyboard.press('Tab');assert.equal(await drawer.evaluate(el=>el.contains(document.activeElement)),true);
  await page.keyboard.press('Escape');await drawer.waitFor({state:'hidden'});
  assert.equal(await page.getByRole('button',{name:'Open current sale',exact:true}).evaluate(el=>el===document.activeElement),true);
  const cartBounds=await page.getByRole('button',{name:'Open current sale',exact:true}).boundingBox();assert.ok(cartBounds.y>=0 && cartBounds.y+cartBounds.height<=900);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  if(width===1440){await page.getByRole('button',{name:'Open current sale',exact:true}).click();await page.mouse.click(4,400);await drawer.waitFor({state:'hidden'});}
  console.log('PASS catalog width, filter dismissal and accessible cart drawer at '+width);
 }
 await page.setViewportSize({width:1440,height:900});await page.getByRole('button',{name:'Full screen',exact:true}).click();assert.ok(await page.locator('.pos-focus-mode').count());
 await page.getByRole('button',{name:'Open current sale',exact:true}).click();await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'pos-drawer-after.png')});
 await page.getByRole('button',{name:'Proceed to checkout',exact:false}).click();await page.getByRole('heading',{name:'Review & pay',exact:true}).waitFor();
 await page.getByRole('button',{name:'Back to cart',exact:false}).click();await page.getByRole('dialog',{name:'Current sale',exact:true}).waitFor();
 await page.getByRole('button',{name:'Close cart',exact:true}).click();await page.screenshot({path:require('node:path').join(require('node:os').tmpdir(),'pos-catalog-after.png')});
 await page.getByRole('button',{name:'Exit full screen',exact:true}).click();
 for(const path of ['/catalog','/inventory']) {await page.goto('http://127.0.0.1:3000'+path);const filter=page.getByRole('button',{name:'Filters',exact:false}).first();await filter.click();await page.locator('.data-filter-drawer').waitFor();await page.locator('h1').click();assert.equal(await page.locator('.data-filter-drawer').count(),0);await filter.click();await page.keyboard.press('Escape');assert.equal(await page.locator('.data-filter-drawer').count(),0);console.log('PASS outside/Escape filters '+path);}
 assert.deepEqual(errors,[]);await browser.close();console.log('PASS full screen and checkout-to-cart navigation');
})().catch(e=>{console.error(e);process.exitCode=1});
