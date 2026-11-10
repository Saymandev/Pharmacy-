/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const a1='11111111-1111-4111-8111-111111111111',a2='22222222-2222-4222-8222-222222222222',b1='33333333-3333-4333-8333-333333333333';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
(async()=>{
 const catalogMode=process.env.TENANT_CATALOG_TEST==='1';
 const formMode=process.env.TENANT_MEDICINE_FORM_TEST==='1';
 const stockMode=process.env.TENANT_STOCK_FORM_TEST==='1',stockIdA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',freshMedicineId='77777777-7777-4777-8777-777777777777';
 let stockQuantityA=5,openingCreates=0,adjustmentWrites=0,forceStockConflict=false;const openingRows=[];
 const referenceId='55555555-5555-4555-8555-555555555555',medicineId='44444444-4444-4444-8444-444444444444';
 let savedName='',savedVersion='2026-11-10T00:00:00.000Z',forceConflict=false,creates=0,updates=0;const savedKeys=new Map();
 let browser,child,logs='',revoked=false,late=false,release,releaseCatalog,denyCatalog=false,foreignCatalog=false;const upstream=[];
 const shop=id=>({tenant:{id,name:id==='a'?'Main Pharmacy':'Second Pharmacy',slug:id},membershipId:'member-'+id,userId:'u',role:{id:'role-'+id,name:id==='a'?'Manager':'Cashier'},permissions:id==='a'?['sale:read','report:read',...(catalogMode?['medicine:read','stock:read']:[]),...(stockMode?['stock:create','stock:update']:[]),...(formMode?['medicine:create','medicine:update',...['category','generic','group','manufacturer','unit'].map(name=>`medicine-${name}:read`)]:[])]:['stock:read'],allBranches:id==='a',branchIds:id==='a'?[]:[b1],homeBranchId:id==='a'?a1:null});
 const row=(tenant,id,name)=>({id,tenantId:tenant,name,isActive:true});
 const branches={a:[row('a',a1,'Main counter'),row('a',a2,'Rear counter')],b:[row('b',b1,'Second counter')]};
 const stub=http.createServer(async(req,res)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):undefined;
  const url=new URL(req.url,'http://fixture'),tenant=req.headers['x-tenant-id'],key=req.headers['idempotency-key'];upstream.push({path:url.pathname,query:Object.fromEntries(url.searchParams),tenant,authorization:req.headers.authorization,method:req.method,body,key});
  if(req.method==='POST'&&url.pathname.startsWith('/api/v1/pharmacy/stocks/')){
   const respond=(status,data,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({success:status<400,data,message}));};
   if(tenant!=='a'){respond(403,null,'Insufficient tenant permissions');return;}
   if(savedKeys.has(key)){respond(200,savedKeys.get(key));return;}
   if(url.pathname.endsWith('/opening')){
    if(openingRows.some(row=>row.medicineId===body.medicineId&&row.branchId===body.branchId&&row.batchNumber===body.batchNumber)){respond(409,null,'Batch already exists');return;}
    const result={...body,id:'99999999-9999-4999-8999-999999999999',tenantId:tenant};openingRows.push(result);openingCreates++;savedKeys.set(key,result);respond(503,null,'Stock save uncertain in test. Retry the same details.');return;
   }
   if(url.pathname.endsWith('/adjust')){
    if(body.stockId!==stockIdA){respond(404,null,'Stock not found');return;}
    if(forceStockConflict||body.expectedQuantity!==stockQuantityA){forceStockConflict=false;stockQuantityA=6;respond(409,null,'Stock changed. Reload the batch before adjusting.');return;}
    stockQuantityA+=body.type==='increase'?body.quantity:-body.quantity;adjustmentWrites++;
    const result={id:stockIdA,tenantId:tenant,medicineId,branchId:a1,quantity:stockQuantityA,batchNumber:'a-BATCH',unit:'Pcs',mrp:'20.00',unitPrice:'10.00',expiryDate:'2030-01-01T00:00:00Z'};savedKeys.set(key,result);respond(503,null,'Stock save uncertain in test. Retry the same details.');return;
   }
  }
  if(req.method==='POST'||req.method==='PATCH'){
   const respond=(status,data,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({success:status<400,data,message}));};
   if(savedKeys.has(key)){respond(200,savedKeys.get(key));return;}
   if(req.method==='PATCH'&&(forceConflict||body.expectedUpdatedAt!==savedVersion)){forceConflict=false;savedVersion='2026-11-10T00:00:01.000Z';respond(409,null,'Medicine was changed by another user. Reload before editing.');return;}
   const result={...body,id:medicineId,tenantId:tenant,updatedAt:'2026-11-10T00:00:02.000Z'};savedKeys.set(key,result);
   if(req.method==='POST'){creates++;respond(503,null,'Save status uncertain in test. Retry the same details.');return;}
   updates++;savedName=body.name;savedVersion=result.updatedAt;respond(200,result);return;
  }
  function respond(){
   if(res.writableEnded||res.destroyed)return;
   if(revoked&&tenant==='b'){res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({success:false,message:'Tenant access denied'}));return;}
   let data,meta;if(url.pathname==='/api/v1/workspace/bootstrap')data={...shop(tenant),branches:{items:branches[tenant]??[],nextCursor:null}};
   else if(url.pathname.startsWith('/api/v1/workspace/branches/'))data=(branches[tenant]??[]).find(item=>item.id===url.pathname.split('/').at(-1));
   else if(['/api/v1/pharmacy/categories','/api/v1/pharmacy/generics','/api/v1/pharmacy/groups','/api/v1/pharmacy/manufacturers','/api/v1/pharmacy/units'].includes(url.pathname)){
    data=[{id:referenceId,tenantId:tenant,name:url.searchParams.get('search')?'Server reference':'Own reference'}];meta={page:Number(url.searchParams.get('page')||1),pageSize:20,totalItems:1,totalPages:1,hasNextPage:false,hasPreviousPage:false};
   }
   else if(url.pathname.startsWith('/api/v1/pharmacy/')){
    if(denyCatalog){res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({success:false,message:'Insufficient tenant permissions'}));return;}
    const branchId=url.searchParams.get('branchId'),page=Number(url.searchParams.get('page')||1),medicineId='44444444-4444-4444-8444-444444444444';
    const stock={id:branchId===a2?'cccccccc-cccc-4ccc-8ccc-cccccccccccc':tenant==='a'?stockIdA:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',tenantId:tenant,medicineId,branchId,quantity:branchId===a1?stockQuantityA:5,batchNumber:tenant+'-BATCH',unit:'Pcs',mrp:'20.00',expiryDate:'2030-01-01T00:00:00Z',rackNumber:'R1'};
    const medicine={id:medicineId,tenantId:foreignCatalog?'foreign':tenant,name:page===2?'Next medicine':branchId===a2?'Rear medicine':tenant==='a'?(savedName||'Main medicine'):'Second medicine',genericName:'Sample generic',barcode:'00123',unit:'Pcs',salePrice:'15.00',isActive:true,stocks:[stock],nameBangla:null,genericNameBangla:null,dosageForm:null,strength:null,purchasePrice:'10.00',mrp:'20.00',reorderLevel:10,categoryId:null,genericId:null,groupId:null,medicineUnitId:null,medicineManufacturerId:null,updatedAt:savedVersion};
    const fresh={...medicine,id:freshMedicineId,name:'Fresh medicine',stocks:openingRows.filter(row=>row.medicineId===freshMedicineId&&row.branchId===branchId)};
    if(url.pathname==='/api/v1/pharmacy/medicines')data=url.searchParams.get('search')==='none'?[]:[medicine];
    else if(url.pathname.startsWith('/api/v1/pharmacy/medicines/'))data=url.pathname.endsWith(freshMedicineId)?fresh:medicine;
    else if(url.pathname==='/api/v1/pharmacy/stocks')data=catalogMode?[{...stock,medicine:{id:medicineId,tenantId:tenant,name:medicine.name},branch:{id:branchId,tenantId:tenant,name:'Working counter'}},...openingRows.filter(row=>row.branchId===branchId&&row.tenantId===tenant).map(row=>({...row,medicine:{id:row.medicineId,tenantId:tenant,name:'Fresh medicine'},branch:{id:branchId,tenantId:tenant,name:'Working counter'}}))]:[];
    else if(url.pathname.startsWith('/api/v1/pharmacy/stocks/'))data=url.pathname.endsWith(stock.id)?{...stock,medicine:{id:medicineId,tenantId:tenant,name:medicine.name},branch:{id:branchId,tenantId:tenant,name:'Working counter'}}:undefined;
    meta={page,pageSize:20,totalItems:Array.isArray(data)&&!data.length?0:url.pathname.endsWith('/medicines')?21:1,totalPages:Array.isArray(data)&&!data.length?0:url.pathname.endsWith('/medicines')?2:1,hasNextPage:url.pathname.endsWith('/medicines')&&page===1&&Array.isArray(data)&&data.length>0,hasPreviousPage:page>1};
    if(url.searchParams.get('registeredOnly')==='false'){data=url.searchParams.get('search')?[fresh]:[medicine,fresh];meta={page,pageSize:20,totalItems:data.length,totalPages:1,hasNextPage:false,hasPreviousPage:false};}
    if(url.pathname==='/api/v1/pharmacy/stocks'){meta.totalItems=data.length;meta.totalPages=data.length?1:0;}
   }
   if(!data){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({success:false,message:'Branch not available'}));return;}
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({success:true,data,...(meta?{meta}:{})}));
  }
  if(late&&tenant==='a'&&url.pathname.endsWith('/bootstrap')){release=respond;return;}
  if(url.searchParams.get('search')==='slow'){releaseCatalog=respond;return;}respond();
 });
 try{
  const upstreamPort=await listen(stub),probe=http.createServer(),port=await listen(probe);await new Promise(resolve=>probe.close(resolve));
  const base=`http://localhost:${port}`;
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port',String(port)],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,TENANT_SESSION_PREVIEW_ENABLED:'true',TENANT_WORKSPACE_PREVIEW_ENABLED:'true',TENANT_CATALOG_WRITES_ENABLED:formMode||stockMode?'true':'false',TENANT_BACKEND_API_URL:`http://127.0.0.1:${upstreamPort}/api/v1`},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',value=>{logs=(logs+value).slice(-5000);});child.stderr.on('data',value=>{logs=(logs+value).slice(-5000);});
  let ready=false;for(let i=0;i<90;i++){if(child.exitCode!==null)throw new Error('Next exited: '+logs);try{if((await fetch(base+'/shops',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await sleep(1000);}assert.ok(ready,'Staging fixture did not start: '+logs);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
  const context=await browser.newContext();await context.addCookies([{name:'pharmacy_access',value:'fixture-http-only',domain:'localhost',path:'/api/backend',httpOnly:true,sameSite:'Lax'}]);
  await context.route('**/api/backend/**',async route=>{
   const ep=new URL(route.request().url()).pathname.replace('/api/backend','');
   if(ep.startsWith('/tenant-workspace'))return route.continue();
   let data;if(ep==='/auth/me')data={id:'u',fullName:'Cashier',role:{name:'Legacy Super Admin',permissions:[{key:'*'}]}};
   else if(ep==='/tenant-session/memberships')data={items:['a','b'].map(id=>shop(id)),nextCursor:null};
   else if(ep.startsWith('/tenant-session/memberships/'))data=shop(ep.split('/').at(-1));
   else throw new Error('Unexpected legacy business request '+ep);
   return route.fulfill({json:{success:true,data}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/shops');await page.getByRole('button',{name:/Main Pharmacy/}).click();
  const workspace=page.getByRole('region',{name:'Shop workspace'});
  await workspace.locator('.workspace-current-branch').getByText('Main counter',{exact:true}).waitFor();
  assert.equal(await workspace.locator('.workspace-access').getByText('Reports',{exact:true}).count(),1);assert.equal(await workspace.locator('.workspace-access').getByText('Medicine catalog',{exact:true}).count(),catalogMode?1:0);
  if(catalogMode){
   const catalog=workspace.getByRole('region',{name:'Shop medicines and inventory'});
   await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
   await catalog.getByRole('button',{name:'Next',exact:true}).click();await catalog.getByRole('button',{name:/Next medicine/}).waitFor();
   await catalog.getByRole('button',{name:'Previous',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
   await catalog.getByRole('button',{name:/Main medicine/}).click();await page.getByRole('dialog').getByText('a-BATCH',{exact:true}).waitFor();await page.getByRole('button',{name:'Close medicine details'}).click();
   denyCatalog=true;await catalog.getByRole('button',{name:/Main medicine/}).click();await catalog.getByRole('alert').getByText('Insufficient tenant permissions').waitFor();assert.equal(await catalog.locator('.tenant-medicine').count(),0);
   denyCatalog=false;await catalog.getByRole('button',{name:'Retry',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
   await catalog.getByRole('button',{name:'Filters',exact:true}).click();await page.getByRole('dialog',{name:'Medicine filters'}).getByLabel('Barcode',{exact:true}).fill('00123');
   await page.getByRole('button',{name:'Apply filters',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
   assert.ok(upstream.some(call=>call.query.barcode==='00123'&&call.query.branchId===a1));
   await catalog.getByRole('button',{name:'Filters',exact:true}).click();await page.mouse.click(4,4);assert.equal(await page.locator('.tenant-catalog-filter').evaluate(node=>node.matches(':popover-open')),false);
   await catalog.getByRole('textbox',{name:'Search shop medicines'}).fill('none');await catalog.getByRole('button',{name:'Search',exact:true}).click();await catalog.getByText('No matching records in this branch.').waitFor();
   await catalog.getByRole('textbox',{name:'Search shop medicines'}).fill('Main');denyCatalog=true;await catalog.getByRole('button',{name:'Search',exact:true}).click();await catalog.getByRole('alert').getByText('Insufficient tenant permissions').waitFor();assert.equal(await catalog.locator('.tenant-medicine').count(),0);
   denyCatalog=false;foreignCatalog=true;await catalog.getByRole('button',{name:'Retry',exact:true}).click();await catalog.getByRole('alert').getByText('Medicines could not be loaded. Please try again.').waitFor();assert.equal(await catalog.locator('.tenant-medicine').count(),0);
   foreignCatalog=false;await catalog.getByRole('button',{name:'Retry',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
   await catalog.getByRole('tab',{name:'Inventory',exact:true}).click();await catalog.getByRole('cell',{name:'a-BATCH',exact:true}).waitFor();
   await catalog.getByRole('button',{name:'Filters',exact:true}).click();await page.getByRole('dialog',{name:'Medicine filters'}).getByLabel('Batch number',{exact:true}).fill('a-BATCH');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await catalog.getByRole('cell',{name:'a-BATCH',exact:true}).waitFor();
   assert.ok(upstream.some(call=>call.query.batchNumber==='a-BATCH'&&call.query.branchId===a1));
   await catalog.getByRole('tab',{name:'Medicine catalog',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
   if(formMode){
    await catalog.getByRole('button',{name:'Filters',exact:true}).click();
    await page.getByRole('dialog',{name:'Medicine filters'}).getByRole('button',{name:'Category',exact:true}).click();
    await page.getByRole('combobox',{name:'Search Category',exact:true}).fill('server');await page.getByRole('combobox',{name:'Search Category',exact:true}).press('Enter');await page.getByRole('option',{name:'Server reference',exact:true}).click();
    await page.getByRole('button',{name:'Apply filters',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
    assert.ok(upstream.some(call=>call.query.categoryId===referenceId));assert.ok(upstream.some(call=>call.path.endsWith('/categories')&&call.query.search==='server'));
    await catalog.getByRole('button',{name:'Add medicine',exact:true}).click();const create=page.getByRole('dialog',{name:'Add medicine',exact:true});
    await create.getByLabel('Medicine name *',{exact:true}).fill('New medicine');await create.getByLabel('Sale price',{exact:true}).fill('-1');
    await create.getByRole('button',{name:'Save medicine',exact:true}).click();await create.getByRole('alert').getByText('Prices must be non-negative amounts with at most two decimals.').waitFor();assert.equal(creates,0);
    await create.getByLabel('Sale price',{exact:true}).fill('12.50');await create.getByRole('button',{name:'Category',exact:true}).click();
    assert.equal(await create.getByLabel('Medicine form status',{exact:true}).evaluate(node=>getComputedStyle(node).opacity),'0');
    await page.getByRole('combobox',{name:'Search Category',exact:true}).fill('server');await page.getByRole('combobox',{name:'Search Category',exact:true}).press('Enter');await page.getByRole('option',{name:'Server reference',exact:true}).click();
    await create.evaluate(node=>node.scrollTop=0);await page.screenshot({path:path.resolve('../outputs/tenant-medicine-form-desktop.png'),fullPage:false});
    await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await create.evaluate(node=>node.scrollTop=0);await page.screenshot({path:path.resolve('../outputs/tenant-medicine-form-mobile.png'),fullPage:false});
    await create.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
    await create.getByRole('button',{name:'Retry save',exact:true}).waitFor();assert.equal(creates,1);assert.equal(await create.getByLabel('Medicine name *',{exact:true}).isDisabled(),true);
    await create.getByRole('button',{name:'Retry save',exact:true}).click();await catalog.getByText('Medicine saved. Register opening stock separately to show it in this branch.').waitFor();
    const attempts=upstream.filter(call=>call.method==='POST');assert.equal(attempts.length,2);assert.equal(attempts[0].key,attempts[1].key);assert.deepEqual(attempts[0].body,attempts[1].body);assert.equal(attempts[0].body.categoryId,referenceId);assert.equal(attempts[0].body.branchId,undefined);assert.equal(attempts[0].body.openingStock,undefined);
    await page.setViewportSize({width:1280,height:900});await catalog.getByRole('button',{name:/Main medicine/}).click();await page.getByRole('button',{name:'Edit medicine',exact:true}).click();const edit=page.getByRole('dialog',{name:'Edit medicine',exact:true});
    await edit.getByLabel('Medicine name *',{exact:true}).fill('Edited medicine');forceConflict=true;
    await edit.getByRole('button',{name:'Save medicine',exact:true}).click();await edit.getByRole('button',{name:'Reload medicine',exact:true}).waitFor();assert.equal(updates,0);
    await edit.getByRole('button',{name:'Reload medicine',exact:true}).click();await edit.getByLabel('Medicine name *',{exact:true}).fill('Edited medicine');await edit.getByLabel('Sale price',{exact:true}).fill('18.50');
    await edit.getByRole('button',{name:'Save medicine',exact:true}).click();await catalog.getByRole('button',{name:/Edited medicine/}).waitFor();assert.equal(updates,1);
    assert.equal(upstream.filter(call=>call.method==='PATCH').at(-1).body.expectedUpdatedAt,'2026-11-10T00:00:01.000Z');
    savedName='';await catalog.getByRole('button',{name:'Search',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
    const count=upstream.length,writeUrl=base+'/api/backend/tenant-workspace/a/pharmacy/medicines';
    assert.equal((await context.request.post(writeUrl,{headers:{Origin:'https://foreign.example','Idempotency-Key':'fixture-key-123456'},data:{name:'Blocked'}})).status(),403);
    assert.equal((await context.request.post(writeUrl,{headers:{Origin:base,'Idempotency-Key':'fixture-key-123456'},data:{name:'Blocked',openingStock:5}})).status(),422);
    assert.equal((await context.request.post(writeUrl,{headers:{Origin:base},data:{name:'Blocked'}})).status(),422);
    assert.equal(upstream.length,count);
    console.log('PASS medicine forms: own server-searched reference filters, native validation, duplicate-submit guard, uncertain create retry with identical key/body, explicit concurrent-edit conflict/reload, list refresh, scoped proxy write/CSRF/stock-field restrictions.');
   }
   if(stockMode){
    async function chooseFresh(){
     await catalog.getByRole('button',{name:'Opening stock',exact:true}).click();const opening=page.getByRole('dialog',{name:'Opening stock',exact:true});
     await opening.getByRole('button',{name:'Stock medicine',exact:true}).click();await page.getByRole('combobox',{name:'Search Stock medicine',exact:true}).fill('Fresh');await page.getByRole('option',{name:'Fresh medicine',exact:true}).click();
     await opening.getByLabel('Batch number *',{exact:true}).fill('OPEN-BATCH');await opening.getByLabel('Expiry date *',{exact:true}).fill('2030-01-01');return opening;
    }
    await page.getByRole('button',{name:'Switch to dark mode'}).click();
    const opening=await chooseFresh();await opening.getByLabel('Quantity *',{exact:true}).fill('1.5');await opening.getByRole('button',{name:'Save opening stock',exact:true}).click();await opening.getByRole('alert').getByText('Quantity must be a positive whole number.').waitFor();assert.equal(openingCreates,0);
    await opening.getByLabel('Quantity *',{exact:true}).fill('4');await opening.getByLabel('Rack',{exact:true}).fill('R2');await opening.getByLabel('Note',{exact:true}).fill('Initial inventory');
    assert.equal(await opening.locator('select[aria-label="Shop working branch"]').count(),0);await page.setViewportSize({width:390,height:844});await opening.evaluate(node=>node.scrollTop=0);await page.screenshot({path:path.resolve('../outputs/tenant-stock-opening-mobile-dark.png'),fullPage:false});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:900});
    await opening.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});await opening.getByRole('button',{name:'Retry stock save',exact:true}).waitFor();assert.equal(openingCreates,1);assert.equal(await opening.getByLabel('Quantity *',{exact:true}).isDisabled(),true);
    await opening.getByRole('button',{name:'Retry stock save',exact:true}).click();await catalog.getByText('Stock save confirmed.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Switch to light mode'}).click();
    const openingCalls=upstream.filter(call=>call.path.endsWith('/stocks/opening')&&call.method==='POST');assert.equal(openingCalls.length,2);assert.equal(openingCalls[0].key,openingCalls[1].key);assert.deepEqual(openingCalls[0].body,openingCalls[1].body);assert.equal(openingCalls[0].body.branchId,a1);assert.equal(openingCalls[0].body.medicineId,freshMedicineId);assert.equal(openingCalls[0].body.expiryDate,'2030-01-01T00:00:00.000Z');
    assert.ok(upstream.some(call=>call.query.registeredOnly==='false'&&call.query.search==='Fresh'&&call.query.branchId===a1));
    const duplicate=await chooseFresh();await duplicate.getByRole('button',{name:'Save opening stock',exact:true}).click();await duplicate.getByRole('alert').getByText('Batch already exists').waitFor();assert.equal(openingCreates,1);await duplicate.getByRole('button',{name:'Cancel',exact:true}).click();
    await catalog.getByRole('tab',{name:'Inventory',exact:true}).click();await catalog.getByRole('cell',{name:'OPEN-BATCH',exact:true}).waitFor();
    await catalog.getByRole('button',{name:'Adjust stock Main medicine a-BATCH',exact:true}).click();const adjust=page.getByRole('dialog',{name:'Adjust stock',exact:true});
    await adjust.getByLabel('Adjustment reason *',{exact:true}).fill('Physical count correction');await adjust.getByLabel('Correction direction',{exact:true}).selectOption('decrease');await adjust.getByLabel('Quantity *',{exact:true}).fill('6');
    await adjust.getByRole('button',{name:'Save adjustment',exact:true}).click();await adjust.getByRole('alert').getByText('Adjustment would produce an invalid stock quantity.').waitFor();assert.equal(adjustmentWrites,0);
    await adjust.getByLabel('Quantity *',{exact:true}).fill('2');forceStockConflict=true;await adjust.getByRole('button',{name:'Save adjustment',exact:true}).click();await adjust.getByRole('button',{name:'Reload stock',exact:true}).waitFor();assert.equal(adjustmentWrites,0);
    await adjust.getByRole('button',{name:'Reload stock',exact:true}).click();await adjust.getByLabel('Adjustment reason *',{exact:true}).fill('Physical count correction');await adjust.getByLabel('Correction direction',{exact:true}).selectOption('decrease');await adjust.getByLabel('Quantity *',{exact:true}).fill('2');
    await page.setViewportSize({width:390,height:844});await adjust.evaluate(node=>node.scrollTop=0);await page.screenshot({path:path.resolve('../outputs/tenant-stock-adjust-mobile.png'),fullPage:false});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.setViewportSize({width:1280,height:900});
    await adjust.getByRole('button',{name:'Save adjustment',exact:true}).click();await adjust.getByRole('button',{name:'Retry stock save',exact:true}).waitFor();assert.equal(adjustmentWrites,1);await adjust.getByRole('button',{name:'Retry stock save',exact:true}).click();
    await catalog.getByText('Stock save confirmed.',{exact:true}).waitFor();await catalog.getByRole('row').filter({hasText:'Main medicine'}).getByRole('cell',{name:'4 Pcs',exact:true}).waitFor();assert.equal(stockQuantityA,4);
    const adjustCalls=upstream.filter(call=>call.path.endsWith('/stocks/adjust')&&call.method==='POST');assert.equal(adjustCalls.length,3);assert.equal(adjustCalls[1].key,adjustCalls[2].key);assert.equal(adjustCalls[1].body.expectedQuantity,6);assert.equal(adjustCalls[1].body.note,'Physical count correction');
    const count=upstream.length,adjustUrl=base+'/api/backend/tenant-workspace/a/pharmacy/stocks/adjust';
    assert.equal((await context.request.post(adjustUrl,{headers:{Origin:base,'Idempotency-Key':'fixture-key-stock-123'},data:{stockId:stockIdA,quantity:1,type:'increase',note:'Reason'}})).status(),422);
    assert.equal((await context.request.post(adjustUrl,{headers:{Origin:'https://foreign.example','Idempotency-Key':'fixture-key-stock-123'},data:{stockId:stockIdA,quantity:1,type:'increase',expectedQuantity:4,note:'Reason'}})).status(),403);
    assert.equal((await context.request.post(base+'/api/backend/tenant-workspace/a/pharmacy/stocks/transfer',{headers:{Origin:base,'Idempotency-Key':'fixture-key-stock-123'},data:{stockId:stockIdA}})).status(),404);assert.equal(upstream.length,count);
    await catalog.getByRole('tab',{name:'Medicine catalog',exact:true}).click();await catalog.getByRole('button',{name:/Main medicine/}).waitFor();
    console.log('PASS stock forms: unregistered medicine picker, fixed branch, opening validation/retry/duplicate-batch rejection, fresh quantity adjustment, negative prevention, stale-stock conflict/reload, one movement on replay, real BFF body/CSRF/allowlist and mobile layout.');
   }
   await catalog.getByRole('textbox',{name:'Search shop medicines'}).fill('slow');await catalog.getByRole('button',{name:'Search',exact:true}).click();
   for(let i=0;i<50&&!releaseCatalog;i++)await sleep(50);assert.ok(releaseCatalog);
  }
  await workspace.getByRole('button',{name:'Workspace settings'}).click();
  await page.locator('.workspace-branch-dialog select').selectOption(a2);
  await page.waitForFunction(()=>document.querySelector('.workspace-current-branch strong')?.textContent==='Rear counter');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  if(catalogMode){releaseCatalog();await workspace.getByRole('button',{name:/Rear medicine/}).waitFor();assert.equal(await workspace.getByRole('button',{name:/Main medicine/}).count(),0);}
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pharmacy.workspace-branch:u:a:member-a')),a2);
  late=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));
  for(let i=0;i<50&&!release;i++)await sleep(50);assert.ok(release,'Delayed old-shop request started');
  await page.getByRole('button',{name:/Second Pharmacy/}).click();
  await workspace.getByText('Choose a branch in workspace settings',{exact:true}).waitFor();
  late=false;release();
  assert.equal(await workspace.locator('.workspace-access').getByText('Reports',{exact:true}).count(),0);assert.equal(await workspace.locator('.workspace-access').getByText('Inventory',{exact:true}).count(),1);
  assert.equal(await workspace.getByText('Rear counter',{exact:true}).count(),0);
  await workspace.getByRole('button',{name:'Workspace settings'}).click();
  assert.equal(await page.locator('.workspace-branch-dialog option').count(),2);
  await page.locator('.workspace-branch-dialog select').selectOption(b1);
  await page.waitForFunction(()=>document.querySelector('.workspace-current-branch strong')?.textContent==='Second counter');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  await page.getByRole('button',{name:'Switch to dark mode'}).click();await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:path.resolve('../outputs/tenant-workspace-mobile.png'),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  revoked=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));await workspace.getByRole('alert').getByText('Tenant access denied').waitFor();
  assert.equal(await workspace.locator('.workspace-current-branch').count(),0);assert.equal(await workspace.locator('.workspace-access').getByText('Inventory',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pharmacy.workspace-branch:u:b:member-b')),null);
  const forged=await context.request.get(base+'/api/backend/tenant-workspace/a/workspace/bootstrap',{headers:{'X-Tenant-Id':'b',Authorization:'Bearer forged'}});assert.equal(forged.status(),200);assert.equal((await forged.json()).data.tenant.id,'a');
  assert.equal(upstream.at(-1).authorization,'Bearer fixture-http-only');
  const before=upstream.length;
  assert.equal((await context.request.post(base+'/api/backend/tenant-workspace/a/workspace/bootstrap')).status(),403);
  assert.equal((await context.request.get(base+'/api/backend/tenant-workspace/a/pharmacy/stocks/adjust')).status(),404);
  const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+'/api/backend/tenant-workspace/a/workspace/bootstrap')).status(),401);await anonymous.close();
  assert.equal(upstream.length,before);assert.ok(upstream.every(item=>(item.method==='GET'||(formMode||stockMode)&&['POST','PATCH'].includes(item.method))&&['a','b'].includes(item.tenant)&&(item.path.startsWith('/api/v1/workspace/')||item.path.startsWith('/api/v1/pharmacy/'))));assert.deepEqual(errors,[]);
  if(catalogMode)console.log('PASS tenant catalog/inventory: actual Next proxy, server search/filter/pagination, details, popover dismiss, scoped quantities, denied/foreign response rejection, branch-change late response disposal, read scope checks.');
  console.log('PASS tenant workspace: real Next proxy + isolated HTTP upstream; HttpOnly cookie, route-bound tenant vs forged header, allowlist/method/anonymous denial, shop/permission/branch isolation, saved scope, late response, revocation, mobile dark. No real database.');
 }catch(error){console.error(logs);throw error;}
 finally{if(release)release();if(releaseCatalog)releaseCatalog();if(browser)await browser.close();if(child&&child.exitCode===null){if(process.platform==='win32'){try{execFileSync('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});}catch{}}else child.kill('SIGTERM');}stub.closeAllConnections();await new Promise(resolve=>stub.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
