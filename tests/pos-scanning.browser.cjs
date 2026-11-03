/* eslint @typescript-eslint/no-require-imports: "off" -- Browser regression runner. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000);const errors=[],lookups=[];let fail=false,delay=80;
 const stock=(id,batch,quantity,expiry='2030-01-01')=>({id,branchId:'branch-a',batchNumber:batch,quantity,expiryDate:expiry,mrp:20,unit:'Pcs'});
 const scanned={id:'scan-med',name:'Scanned Medicine',barcode:'00Ab-01',unit:'Pcs',salePrice:20,stocks:[stock('exp','EXP',50,'2020-01-01'),stock('a','A',1),stock('b','B',2,'2031-01-01')]};
 const old={id:'old-med',name:'Old Catalog',unit:'Pcs',salePrice:10,stocks:[stock('old','OLD',5)]},fresh={id:'fresh-med',name:'Fresh Medicine',unit:'Pcs',salePrice:10,stocks:[stock('fresh','FRESH',3)]};
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/backend/**',async route=>{const req=route.request(),url=new URL(req.url()),path=url.pathname.replace('/api/backend','');let data=[],meta,status=200;
 if(path==='/auth/me')data={id:'u1',fullName:'Test cashier',role:{permissions:[{key:'*'}]}};
 else if(path==='/branches')data=[{id:'branch-a',name:'Main Branch'},{id:'branch-b',name:'Second Branch'}];
 else if(path==='/finance/accounts')data=[{id:'cash',name:'Cash drawer',type:'cash'}];
 else if(path==='/pharmacy/cash-register/active')data={id:'register',status:'open'};
 else if(path==='/pharmacy/medicines'){
  if(url.searchParams.has('barcode')){const code=url.searchParams.get('barcode');lookups.push(code);await new Promise(r=>setTimeout(r,delay));if(fail)status=503;else data=code==='00Ab-01'?[scanned]:code==='CANCEL-1'?[{...scanned,id:'cancel-med',name:'Cancelled Lookup Medicine',barcode:code,stocks:[stock('cancel','CANCEL',5)]}]:[{...scanned,barcode:'near-match'}];}
  else{const search=url.searchParams.get('search');if(search==='Fresh'){await new Promise(r=>setTimeout(r,150));data=[fresh];}else data=[old];}
  meta={total:data.length,totalPages:1,page:1,limit:60};
 }
 await route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status===200,message:status===503?'Barcode service unavailable':'Success',data,...(meta?{meta}:{})})});});
 async function cartSnapshot(){await page.getByRole('button',{name:'Open current sale',exact:true}).click();const lines=await page.locator('.pos-cart-line').evaluateAll(nodes=>nodes.map(n=>({name:n.querySelector('.pos-line-main strong').textContent,batch:n.querySelector('select').value,quantity:n.querySelector('input').value})));await page.getByRole('button',{name:'Close cart',exact:true}).click();return lines;}
 const base=process.env.POS_TEST_BASE_URL||'http://127.0.0.1:3000';await page.goto(base+'/pos');await page.getByRole('button').filter({hasText:'Old Catalog'}).first().waitFor();const search=page.getByRole('textbox',{name:'Search medicine or scan barcode…',exact:true});await search.fill('Fresh');await search.press('Enter');await page.getByRole('button',{name:'Open current sale',exact:true}).click();await page.getByRole('button',{name:'Remove Fresh Medicine',exact:true}).waitFor();await page.getByRole('button',{name:'Close cart',exact:true}).click();const freshCart=await cartSnapshot();assert.equal(freshCart[0].name,'Fresh Medicine');assert.equal(freshCart.some(line=>line.name==='Old Catalog'),false);
 await page.keyboard.press('F3');const scanner=page.getByRole('region',{name:'Barcode scanner',exact:true}),input=scanner.getByRole('textbox',{name:'Scan barcode',exact:true});await input.waitFor();
 // Scanner may submit the next code while the previous network lookup is running.
 for(let i=0;i<3;i++){await input.fill('00Ab-01');await input.press('Enter');}
 await page.keyboard.press('F4');assert.equal(await page.getByRole('dialog',{name:'Review & pay',exact:true}).count(),0);await scanner.getByRole('status').filter({hasText:'Ready for the next barcode'}).waitFor();const scannedLines=(await cartSnapshot()).filter(line=>line.name==='Scanned Medicine');assert.deepEqual(scannedLines.map(line=>line.batch),['a','b']);assert.deepEqual(scannedLines.map(line=>line.quantity),['1','2']);assert.equal(lookups.length,3);
 await input.fill('00Ab-01');await input.press('Enter');await scanner.getByText('Scans needing attention · 1',{exact:true}).waitFor();assert.equal((await cartSnapshot()).filter(line=>line.name==='Scanned Medicine').length,2);await scanner.getByRole('button',{name:'Dismiss failed scan 00Ab-01',exact:true}).click();
 await input.fill('00ab-01');await input.press('Enter');await scanner.getByText('No exact in-stock barcode match',{exact:true}).waitFor();assert.equal((await cartSnapshot()).filter(line=>line.name==='Scanned Medicine').length,2);
 fail=true;await input.fill('RETRY-1');await input.press('Enter');await scanner.getByText('Barcode service unavailable',{exact:true}).waitFor();fail=false;await scanner.getByRole('button',{name:'Retry scan',exact:true}).last().click();await scanner.locator('.pos-scan-failures>div').filter({hasText:'RETRY-1'}).getByText('No exact in-stock barcode match',{exact:true}).waitFor();assert.equal(lookups.filter(code=>code==='RETRY-1').length,2);
 // Close and branch switches invalidate pending lookups instead of adding late items.
 delay=300;await input.fill('CANCEL-1');await input.press('Enter');await scanner.getByRole('button',{name:'Close barcode scanner',exact:true}).click();await page.waitForTimeout(350);assert.equal((await cartSnapshot()).filter(line=>line.name==='Scanned Medicine').length,2);assert.equal((await cartSnapshot()).some(line=>line.name==='Cancelled Lookup Medicine'),false);
 await page.keyboard.press('F3');await input.waitFor();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:'/tmp/pos-scanner-mobile.png'});await page.keyboard.press('Escape');await scanner.waitFor({state:'hidden'});assert.equal(await search.evaluate(node=>node===document.activeElement),true);
 await page.keyboard.press('F4');await page.getByRole('dialog',{name:'Review & pay',exact:true}).waitFor();assert.deepEqual(errors,[]);
 console.log('PASS scanning browser: fresh Enter selection, exact alphanumeric/leading-zero barcode, queued rapid scans, FEFO and stock cap, checkout guard, failed-scan retry, cancelled lookup, F3/Escape/F4 and mobile. Mock API only.');
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exit(1)});
