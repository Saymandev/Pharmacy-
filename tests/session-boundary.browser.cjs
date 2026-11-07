/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try {
  const context=await browser.newContext();let actor='a';
  await context.addInitScript(()=>{
   if(localStorage.getItem('session-fixture'))return;
   localStorage.setItem('session-fixture','1');
   localStorage.setItem('pharmacy.active-branch','foreign');
   localStorage.setItem('pharmacy.active-branch:user:a','a2');
   localStorage.setItem('pharmacy.active-branch:user:b','b2');
  });
  await context.route('**/api/backend/**',async route=>{
   const path=new URL(route.request().url()).pathname.replace('/api/backend','');let data=[];
   if((path==='/auth/me'&&!actor)||path==='/auth/login')return route.fulfill({status:401,json:{success:false,message:'Invalid test credentials'}});
   if(path==='/setup/status')data={isSetupComplete:true};
   if(path==='/auth/me')data={id:actor,fullName:`Cashier ${actor}`,role:{permissions:[{key:'*'}]}};
   if(path==='/branches')data=[{id:actor+'1',name:actor+' first'},{id:actor+'2',name:actor+' saved'}];
   if(path==='/pharmacy/cash-register/active')data={id:'register',branchId:actor+'2',closingBalance:0};
   await route.fulfill({json:{success:true,data}});
  });
  const page=await context.newPage(),other=await context.newPage(),base=process.env.TEST_BASE_URL||'http://localhost:3000';
  await page.goto(base+'/pos');
  await page.waitForFunction(()=>document.querySelector('.pos-header-branch')?.textContent==='a saved');
  await other.goto(base+'/pos');
  await other.waitForFunction(()=>document.querySelector('.pos-header-branch')?.textContent==='a saved');
  actor='b';
  await other.evaluate(()=>localStorage.setItem('pharmacy.session-event',crypto.randomUUID()));
  await page.waitForFunction(()=>document.querySelector('.pos-header-branch')?.textContent==='b saved');
  assert.equal(await page.locator('.pos-header-branch').innerText(),'b saved');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pharmacy.active-branch:user:a')),'a2');
  assert.equal(await page.evaluate(()=>localStorage.getItem('pharmacy.active-branch:user:b')),'b2');
  actor='';
  const login=await context.newPage();await login.goto(base+'/login');
  await login.locator('#usernameOrEmail').fill('fixture');
  await login.locator('#password').fill('invalid-fixture');
  await login.getByRole('button',{name:'Sign in',exact:false}).click();
  await login.getByRole('alert').filter({hasText:'Invalid test credentials'}).waitFor();
  assert.equal(await login.locator('#usernameOrEmail').inputValue(),'fixture');
  console.log('PASS user-scoped branch preference, legacy key ignored, other-tab session change reloads and resolves new actor. Mock API only.');
  console.log('PASS failed login retains input and displays the authentication error.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
