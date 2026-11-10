/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const a1='11111111-1111-4111-8111-111111111111',a2='22222222-2222-4222-8222-222222222222',b1='33333333-3333-4333-8333-333333333333';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
(async()=>{
 const catalogMode=process.env.TENANT_CATALOG_TEST==='1';
 let browser,child,logs='',revoked=false,late=false,release,releaseCatalog,denyCatalog=false,foreignCatalog=false;const upstream=[];
 const shop=id=>({tenant:{id,name:id==='a'?'Main Pharmacy':'Second Pharmacy',slug:id},membershipId:'member-'+id,userId:'u',role:{id:'role-'+id,name:id==='a'?'Manager':'Cashier'},permissions:id==='a'?['sale:read','report:read',...(catalogMode?['medicine:read','stock:read']:[])]:['stock:read'],allBranches:id==='a',branchIds:id==='a'?[]:[b1],homeBranchId:id==='a'?a1:null});
 const row=(tenant,id,name)=>({id,tenantId:tenant,name,isActive:true});
 const branches={a:[row('a',a1,'Main counter'),row('a',a2,'Rear counter')],b:[row('b',b1,'Second counter')]};
 const stub=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture'),tenant=req.headers['x-tenant-id'];upstream.push({path:url.pathname,query:Object.fromEntries(url.searchParams),tenant,authorization:req.headers.authorization,method:req.method});
  function respond(){
   if(res.writableEnded||res.destroyed)return;
   if(revoked&&tenant==='b'){res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({success:false,message:'Tenant access denied'}));return;}
   let data,meta;if(url.pathname==='/api/v1/workspace/bootstrap')data={...shop(tenant),branches:{items:branches[tenant]??[],nextCursor:null}};
   else if(url.pathname.startsWith('/api/v1/workspace/branches/'))data=(branches[tenant]??[]).find(item=>item.id===url.pathname.split('/').at(-1));
   else if(url.pathname.startsWith('/api/v1/pharmacy/')){
    if(denyCatalog){res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({success:false,message:'Insufficient tenant permissions'}));return;}
    const branchId=url.searchParams.get('branchId'),page=Number(url.searchParams.get('page')||1),medicineId='44444444-4444-4444-8444-444444444444';
    const stock={id:'stock-'+tenant,tenantId:tenant,branchId,quantity:5,batchNumber:tenant+'-BATCH',unit:'Pcs',mrp:'20.00',expiryDate:'2030-01-01T00:00:00Z',rackNumber:'R1'};
    const medicine={id:medicineId,tenantId:foreignCatalog?'foreign':tenant,name:page===2?'Next medicine':branchId===a2?'Rear medicine':tenant==='a'?'Main medicine':'Second medicine',genericName:'Sample generic',barcode:'00123',unit:'Pcs',salePrice:'15.00',isActive:true,stocks:[stock]};
    if(url.pathname==='/api/v1/pharmacy/medicines')data=url.searchParams.get('search')==='none'?[]:[medicine];
    else if(url.pathname.startsWith('/api/v1/pharmacy/medicines/'))data=medicine;
    else if(url.pathname==='/api/v1/pharmacy/stocks')data=catalogMode?[{...stock,medicine:{id:medicineId,tenantId:tenant,name:medicine.name},branch:{id:branchId,tenantId:tenant,name:'Working counter'}}]:[];
    meta={page,pageSize:20,totalItems:Array.isArray(data)&&!data.length?0:url.pathname.endsWith('/medicines')?21:1,totalPages:Array.isArray(data)&&!data.length?0:url.pathname.endsWith('/medicines')?2:1,hasNextPage:url.pathname.endsWith('/medicines')&&page===1&&Array.isArray(data)&&data.length>0,hasPreviousPage:page>1};
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
  child=spawn(process.execPath,['node_modules/next/dist/bin/next','dev','--port',String(port)],{cwd:path.resolve(__dirname,'..'),windowsHide:true,env:{...process.env,TENANT_SESSION_PREVIEW_ENABLED:'true',TENANT_WORKSPACE_PREVIEW_ENABLED:'true',TENANT_BACKEND_API_URL:`http://127.0.0.1:${upstreamPort}/api/v1`},stdio:['ignore','pipe','pipe']});
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
  assert.equal((await context.request.post(base+'/api/backend/tenant-workspace/a/workspace/bootstrap')).status(),405);
  assert.equal((await context.request.get(base+'/api/backend/tenant-workspace/a/pharmacy/stocks/adjust')).status(),404);
  const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+'/api/backend/tenant-workspace/a/workspace/bootstrap')).status(),401);await anonymous.close();
  assert.equal(upstream.length,before);assert.ok(upstream.every(item=>item.method==='GET'&&['a','b'].includes(item.tenant)&&(item.path.startsWith('/api/v1/workspace/')||item.path.startsWith('/api/v1/pharmacy/'))));assert.deepEqual(errors,[]);
  if(catalogMode)console.log('PASS tenant catalog/inventory: actual Next proxy, server search/filter/pagination, details, popover dismiss, scoped quantities, denied/foreign response rejection, branch-change late response disposal, no write operations.');
  console.log('PASS tenant workspace: real Next proxy + isolated HTTP upstream; HttpOnly cookie, route-bound tenant vs forged header, allowlist/method/anonymous denial, shop/permission/branch isolation, saved scope, late response, revocation, mobile dark. No real database.');
 }catch(error){console.error(logs);throw error;}
 finally{if(release)release();if(releaseCatalog)releaseCatalog();if(browser)await browser.close();if(child&&child.exitCode===null){if(process.platform==='win32'){try{execFileSync('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});}catch{}}else child.kill('SIGTERM');}stub.closeAllConnections();await new Promise(resolve=>stub.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
