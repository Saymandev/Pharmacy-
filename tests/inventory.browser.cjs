/* eslint @typescript-eslint/no-require-imports: "off" -- CommonJS browser regression runner. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];const writes=[];let metadataFails=false;
  page.on('pageerror',e=>errors.push(e.message));
  let stocks=[{id:'s1',sku:'sku-1',medicineId:'med-a',branchId:'branch-a',batchNumber:'A',quantity:10,unitPrice:10,mrp:20,unit:'Pcs',expiryDate:'2030-01-01',medicine:{id:'med-a',name:'Inventory Medicine',genericName:'Generic',unit:'Pcs'}},{id:'s2',sku:'sku-2',medicineId:'med-a',branchId:'branch-a',batchNumber:'B',quantity:3,unitPrice:10,mrp:20,unit:'Pcs',expiryDate:'2031-01-01',medicine:{id:'med-a',name:'Inventory Medicine',genericName:'Generic',unit:'Pcs'}}];
  const rare={id:'med-rare',name:'Rare Medicine 250',genericName:'Rare generic',unit:'Pcs',purchasePrice:12,mrp:24,isActive:true};
  await page.route('**/api/backend/**',async route=>{
   const req=route.request();const url=new URL(req.url());const path=url.pathname.replace('/api/backend','');let data=[];let meta;let status=200;
   if(path==='/auth/me')data={id:'inventory-user',fullName:'Inventory user',role:{permissions:[{key:'*'}]}};
   else if(path==='/branches')data=[{id:'branch-a',name:'Main Branch'},{id:'branch-b',name:'Second Branch'}];
   else if(path==='/finance/accounts')data=[{id:'cash-a',name:'Cash drawer',type:'cash'}];
   else if(path==='/pharmacy/medicines'){
    if(url.searchParams.get('limit')==='100'&&metadataFails)status=503;
    else data=url.searchParams.get('search')?.includes('Rare')?[rare]:[{id:'med-a',name:'Inventory Medicine',genericName:'Generic',reorderLevel:6,isActive:true,stocks}];
    meta={totalItems:data.length,totalPages:1,page:1,pageSize:100};
   }else if(path==='/pharmacy/stocks'&&req.method()==='GET'){
    data=stocks.filter(stock=>(!url.searchParams.has('batchNumber')||stock.batchNumber===url.searchParams.get('batchNumber'))&&(!url.searchParams.has('medicineId')||stock.medicineId===url.searchParams.get('medicineId')));
    meta={totalItems:data.length,totalPages:1,page:1,pageSize:25};
   }else if(path==='/pharmacy/stocks/adjust'){
    const body=req.postDataJSON();writes.push({path,body});await new Promise(r=>setTimeout(r,100));stocks=stocks.map(stock=>stock.id===body.stockId?{...stock,quantity:stock.quantity+(body.type==='increase'?body.quantity:-body.quantity)}:stock);data=stocks.find(stock=>stock.id===body.stockId);
   }else if(path==='/pharmacy/stocks/transfer'){
    const body=req.postDataJSON();writes.push({path,body});stocks=stocks.map(stock=>stock.id===body.stockId?{...stock,quantity:stock.quantity-body.quantity}:stock);data={sourceStockId:body.stockId,destStockId:'destination'};
   }else if(path==='/pharmacy/stocks/opening'){
    const body=req.postDataJSON();writes.push({path,body});await new Promise(r=>setTimeout(r,100));const created={...body,id:'s-rare',sku:'sku-rare',medicine:{id:rare.id,name:rare.name,genericName:rare.genericName}};stocks.push(created);data=created;
   }else if(path==='/pharmacy/stocks/bulk-price-update'){
    const body=req.postDataJSON();writes.push({path,body});stocks=stocks.map(stock=>{const item=body.find(item=>item.sku===stock.sku);return item?{...stock,...item}:stock});metadataFails=true;data={count:body.length};
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status===200,message:status===200?'Success':'Optional medicine metadata unavailable',data,...(meta?{meta}:{})})});
  });
  const base=process.env.POS_TEST_BASE_URL||'http://127.0.0.1:3000';await page.goto(base+'/inventory');
  await page.getByRole('button',{name:'Adjust batch A',exact:true}).click();const modal=page.getByRole('dialog',{name:'Stock operation'});await modal.waitFor();
  await modal.getByRole('combobox',{name:'Operation batch'}).selectOption('s2');assert.equal(await modal.getByRole('combobox',{name:'Operation batch'}).inputValue(),'s2');
  await modal.getByRole('combobox',{name:'Adjustment type'}).selectOption('decrease');await modal.getByLabel('Quantity',{exact:true}).fill('2');stocks=stocks.map(stock=>stock.id==='s2'?{...stock,quantity:0}:stock);
  await modal.getByRole('button',{name:'Confirm operation',exact:true}).click();await modal.getByRole('alert').filter({hasText:'current available stock'}).waitFor();assert.equal(writes.length,0);
  stocks=stocks.map(stock=>stock.id==='s2'?{...stock,quantity:3}:stock);await modal.getByLabel('Quantity',{exact:true}).fill('1');await modal.getByRole('spinbutton',{name:'Recovery amount'}).fill('5');await modal.getByRole('combobox',{name:'Recovery account'}).selectOption('cash-a');
  await modal.getByRole('button',{name:'Confirm operation',exact:true}).evaluate(button=>{button.click();button.click();});await modal.waitFor({state:'hidden'});assert.equal(writes.length,1);assert.equal(writes[0].body.stockId,'s2');assert.equal(writes[0].body.recoverAmount,5);
  await page.getByRole('button',{name:'Transfer batch A',exact:true}).click();await modal.getByLabel('Quantity',{exact:true}).fill('8');stocks=stocks.map(stock=>stock.id==='s1'?{...stock,quantity:4}:stock);
  await modal.getByRole('button',{name:'Confirm operation',exact:true}).click();await modal.getByRole('alert').filter({hasText:'current available stock'}).waitFor();assert.equal(writes.length,1);
  await modal.getByLabel('Quantity',{exact:true}).fill('2');await modal.getByRole('combobox',{name:'Destination branch'}).selectOption('branch-b');await modal.getByRole('button',{name:'Confirm operation',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal(writes[1].body.toBranchId,'branch-b');assert.equal(writes[1].body.stockId,'s1');
  await page.getByRole('button',{name:'Opening stock',exact:true}).click();await modal.getByRole('textbox',{name:'Search medicine for opening stock'}).fill('Rare');await modal.getByRole('combobox',{name:'Opening stock medicine'}).selectOption('med-rare');
  await modal.getByLabel('Batch number',{exact:true}).fill('RARE');await modal.getByLabel('Expiry date',{exact:true}).fill('2030-12-31');await modal.getByLabel('Quantity',{exact:true}).fill('10');
  await modal.getByRole('button',{name:'Confirm operation',exact:true}).evaluate(button=>{button.click();button.click();});await modal.waitFor({state:'hidden'});assert.equal(writes.length,3);assert.equal(writes[2].body.medicineId,'med-rare');assert.equal(writes[2].body.branchId,'branch-a');assert.equal(writes[2].body.unitPrice,12);assert.match(writes[2].body.expiryDate,/^2030-12-31T/);
  await page.getByRole('button',{name:'Bulk price',exact:true}).click();const prices=page.getByRole('dialog',{name:'Bulk batch price update'});await prices.getByRole('spinbutton',{name:'MRP for A',exact:true}).fill('25');await prices.getByRole('spinbutton',{name:'Unit cost for B',exact:true}).fill('');
  await prices.getByRole('button',{name:'Save changed prices',exact:true}).click();await prices.getByRole('alert').filter({hasText:'positive amounts'}).waitFor();assert.equal(writes.length,3);
  await prices.getByRole('spinbutton',{name:'Unit cost for B',exact:true}).fill('10');await prices.getByRole('button',{name:'Save changed prices',exact:true}).click();await prices.waitFor({state:'hidden'});assert.equal(writes.length,4);assert.equal(writes[3].body.length,1);assert.equal(writes[3].body[0].sku,'sku-1');assert.equal(writes[3].body[0].mrp,25);
  await page.getByRole('button',{name:'Adjust batch A',exact:true}).waitFor();assert.equal(await page.locator('.inventory-table tbody tr').count(),3);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Transfer batch A',exact:true}).click();await modal.waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);await page.screenshot({path:'/tmp/inventory-mobile.png'});assert.deepEqual(errors,[]);
  const denied=await browser.newPage();const reads=[];await denied.route('**/api/backend/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/backend/pharmacy/stocks')reads.push(path);await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:path.endsWith('/auth/me')?{id:'no-access',fullName:'No access',role:{permissions:[]}}:[]})});});await denied.goto(base+'/inventory');await denied.getByText('Your role cannot view this page.',{exact:true}).waitFor();assert.equal(reads.length,0);
  console.log('PASS inventory browser: selected-batch identity, fresh decrease/transfer bounds, recovery account, searchable opening medicine, duplicate submit, bulk-price validation/payload, optional metadata failure, mobile and permissions. Mock API only.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exit(1)});
