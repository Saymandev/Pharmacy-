/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{
  const context=await browser.newContext();let revoked=false,empty=false,broken=false,wrongActor=false;const calls=[];
  const a={membershipId:'member-a',tenant:{id:'a',name:'Main Pharmacy',slug:'main'},role:{id:'role-a',name:'Shop owner'}};
  const b={membershipId:'member-b',tenant:{id:'b',name:'Second Pharmacy',slug:'second'},role:{id:'role-b',name:'Cashier'}};
  await context.addInitScript(()=>{sessionStorage.setItem('pharmacy.selected-shop:user:u','a');});
  await context.route('**/api/backend/**',async route=>{
   const request=route.request(),url=new URL(request.url()),ep=url.pathname.replace('/api/backend','');calls.push({ep,method:request.method(),headers:request.headers()});
   let data,status=200;
   if(ep==='/auth/me')data={id:'u',fullName:'Fixture user',role:{name:'Legacy admin',permissions:[{key:'*'}]}};
   else if(ep==='/tenant-session/memberships'){
    if(broken)return route.fulfill({status:503,json:{success:false,message:'Shop directory unavailable'}});
    data={items:empty?[]:url.searchParams.has('after')?[b]:[a],nextCursor:empty||revoked||url.searchParams.has('after')?null:'00000000-0000-4000-8000-000000000001'};
   }else if(ep==='/tenant-session/memberships/a')data={...a,userId:wrongActor?'foreign':'u',permissions:['sale:read'],allBranches:true,branchIds:[],homeBranchId:null};
   else if(ep==='/tenant-session/memberships/b'){
    if(revoked)return route.fulfill({status:403,json:{success:false,message:'Tenant access denied'}});
    data={...b,userId:'u',permissions:['sale:read'],allBranches:false,branchIds:['branch-b'],homeBranchId:'branch-b'};
   }else {status=500;data=null;}
   await route.fulfill({status,json:{success:status===200,data}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.TEST_BASE_URL||'http://localhost:3000';
  await page.goto(base+'/shops',{timeout:90000});
  await page.getByRole('heading',{name:'Your shops',exact:true}).waitFor();
  assert.equal(await page.locator('.shop-selected').count(),0,'saved hint never auto-verifies');
  await page.getByRole('button',{name:/Main Pharmacy/}).click();
  await page.locator('.shop-selected').getByText('Access verified',{exact:false}).waitFor();
  assert.equal(await page.locator('#selected-shop-title').evaluate(node=>document.activeElement===node),true);
  await page.getByRole('button',{name:'Load more shops',exact:true}).click();
  await page.getByRole('button',{name:/Second Pharmacy/}).click();
  await page.locator('.shop-selected').getByRole('heading',{name:'Second Pharmacy'}).waitFor();
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pharmacy.selected-shop:user:u')),'b');
  revoked=true;
  await page.getByRole('button',{name:/Second Pharmacy/}).click();
  await page.getByRole('alert').getByText('Tenant access denied').waitFor();
  assert.equal(await page.locator('.shop-selected').count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('pharmacy.selected-shop:user:u')),null);
  wrongActor=true;
  await page.getByRole('button',{name:/Main Pharmacy/}).click();
  await page.getByRole('alert').getByText('Shop access could not be verified. Please try again.').waitFor();
  assert.equal(await page.locator('.shop-selected').count(),0);
  wrongActor=false;
  await page.getByRole('button',{name:/Main Pharmacy/}).click();
  await page.locator('.shop-selected').getByRole('heading',{name:'Main Pharmacy'}).waitFor();
  await page.getByRole('button',{name:'Switch to dark mode'}).click();
  await page.screenshot({path:path.resolve('../outputs/shop-access-dark.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'বাংলা',exact:true}).click();
  await page.getByRole('heading',{name:'আপনার শপগুলো'}).waitFor();
  await page.getByRole('button',{name:/Main Pharmacy/}).click();
  await page.locator('.shop-selected').getByText('অ্যাক্সেস ভেরিফাই হয়েছে',{exact:false}).waitFor();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.resolve('../outputs/shop-access-mobile-bn.png'),fullPage:true});
  await page.getByRole('button',{name:'English',exact:true}).click();
  await page.getByRole('heading',{name:'Your shops'}).waitFor();
  broken=true;await page.reload();
  await page.getByRole('alert').getByText('Shop directory unavailable').waitFor();
  broken=false;empty=true;await page.getByRole('button',{name:'Reload shops'}).click();
  await page.getByRole('heading',{name:'No shops available'}).waitFor();
  assert.deepEqual(errors,[]);
  assert.ok(calls.every(call=>call.method==='GET' && (call.ep==='/auth/me'||call.ep.startsWith('/tenant-session/memberships'))),'preview must never call legacy business routes');
  assert.ok(calls.every(call=>!call.headers['x-tenant-id']),'preview never activates tenant business routing');
  console.log('PASS shop preview: pagination, fresh selection, permission projection, revoked/mismatched context rejection, saved hint, error/retry/empty, focus, mobile dark/Bangla, no legacy business requests. Mock API only.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
