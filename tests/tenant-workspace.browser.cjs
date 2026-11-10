/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path'),{spawn,execFileSync}=require('node:child_process');
const a1='11111111-1111-4111-8111-111111111111',a2='22222222-2222-4222-8222-222222222222',b1='33333333-3333-4333-8333-333333333333';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function listen(server){await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));return server.address().port;}
(async()=>{
 let browser,child,logs='',revoked=false,late=false,release;const upstream=[];
 const shop=id=>({tenant:{id,name:id==='a'?'Main Pharmacy':'Second Pharmacy',slug:id},membershipId:'member-'+id,userId:'u',role:{id:'role-'+id,name:id==='a'?'Manager':'Cashier'},permissions:id==='a'?['sale:read','report:read']:['stock:read'],allBranches:id==='a',branchIds:id==='a'?[]:[b1],homeBranchId:id==='a'?a1:null});
 const row=(tenant,id,name)=>({id,tenantId:tenant,name,isActive:true});
 const branches={a:[row('a',a1,'Main counter'),row('a',a2,'Rear counter')],b:[row('b',b1,'Second counter')]};
 const stub=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://fixture'),tenant=req.headers['x-tenant-id'];upstream.push({path:url.pathname,tenant,authorization:req.headers.authorization,method:req.method});
  function respond(){
   if(res.writableEnded||res.destroyed)return;
   if(revoked&&tenant==='b'){res.writeHead(403,{'content-type':'application/json'});res.end(JSON.stringify({success:false,message:'Tenant access denied'}));return;}
   let data;if(url.pathname==='/api/v1/workspace/bootstrap')data={...shop(tenant),branches:{items:branches[tenant]??[],nextCursor:null}};
   else if(url.pathname.startsWith('/api/v1/workspace/branches/'))data=(branches[tenant]??[]).find(item=>item.id===url.pathname.split('/').at(-1));
   if(!data){res.writeHead(404,{'content-type':'application/json'});res.end(JSON.stringify({success:false,message:'Branch not available'}));return;}
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({success:true,data}));
  }
  if(late&&tenant==='a'&&url.pathname.endsWith('/bootstrap')){release=respond;return;}respond();
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
  assert.equal(await workspace.getByText('Reports',{exact:true}).count(),1);assert.equal(await workspace.getByText('Medicine catalog',{exact:true}).count(),0);
  await workspace.getByRole('button',{name:'Workspace settings'}).click();
  await page.locator('.workspace-branch-dialog select').selectOption(a2);
  await page.waitForFunction(()=>document.querySelector('.workspace-current-branch strong')?.textContent==='Rear counter');
  await page.getByRole('button',{name:'Done',exact:true}).click();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pharmacy.workspace-branch:u:a:member-a')),a2);
  late=true;await page.evaluate(()=>dispatchEvent(new Event('focus')));
  for(let i=0;i<50&&!release;i++)await sleep(50);assert.ok(release,'Delayed old-shop request started');
  await page.getByRole('button',{name:/Second Pharmacy/}).click();
  await workspace.getByText('Choose a branch in workspace settings',{exact:true}).waitFor();
  late=false;release();
  assert.equal(await workspace.getByText('Reports',{exact:true}).count(),0);assert.equal(await workspace.getByText('Inventory',{exact:true}).count(),1);
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
  assert.equal(await workspace.locator('.workspace-current-branch').count(),0);assert.equal(await workspace.getByText('Inventory',{exact:true}).count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pharmacy.workspace-branch:u:b:member-b')),null);
  const forged=await context.request.get(base+'/api/backend/tenant-workspace/a/workspace/bootstrap',{headers:{'X-Tenant-Id':'b',Authorization:'Bearer forged'}});assert.equal(forged.status(),200);assert.equal((await forged.json()).data.tenant.id,'a');
  assert.equal(upstream.at(-1).authorization,'Bearer fixture-http-only');
  const before=upstream.length;
  assert.equal((await context.request.post(base+'/api/backend/tenant-workspace/a/workspace/bootstrap')).status(),405);
  assert.equal((await context.request.get(base+'/api/backend/tenant-workspace/a/pharmacy/medicines')).status(),404);
  const anonymous=await browser.newContext();assert.equal((await anonymous.request.get(base+'/api/backend/tenant-workspace/a/workspace/bootstrap')).status(),401);await anonymous.close();
  assert.equal(upstream.length,before);assert.ok(upstream.every(item=>item.method==='GET'&&['a','b'].includes(item.tenant)&&item.path.startsWith('/api/v1/workspace/')));assert.deepEqual(errors,[]);
  console.log('PASS tenant workspace: real Next proxy + isolated HTTP upstream; HttpOnly cookie, route-bound tenant vs forged header, allowlist/method/anonymous denial, shop/permission/branch isolation, saved scope, late response, revocation, mobile dark. No real database.');
 }catch(error){console.error(logs);throw error;}
 finally{if(release)release();if(browser)await browser.close();if(child&&child.exitCode===null){if(process.platform==='win32'){try{execFileSync('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});}catch{}}else child.kill('SIGTERM');}stub.closeAllConnections();await new Promise(resolve=>stub.close(resolve));}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
