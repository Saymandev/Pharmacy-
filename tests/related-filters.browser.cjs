const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH});try{
 const page=await browser.newPage();const queries=[];
 await page.route('**/api/backend/**',async route=>{const url=new URL(route.request().url()),path=url.pathname.replace('/api/backend','');let data=[],meta;
 if(path==='/auth/me')data={id:'user',fullName:'User',role:{permissions:[{key:'*'}]}};
 else if(path==='/branches')data=[{id:'branch-a',name:'Main'}];
 else if(path==='/customers'){data=[{id:url.searchParams.get('page')==='2'?'customer-b':'customer-a',name:'Customer',phone:'01000000000'}];meta={page:Number(url.searchParams.get('page')),totalPages:2,totalItems:26,pageSize:25};}
 else if(path==='/pharmacy/cash-register')data=[{id:'session-a',status:'open',openedAt:'2026-11-03T00:00:00Z'}];
 else if(path==='/sales'){queries.push(Object.fromEntries(url.searchParams));data={sales:[],pagination:{total:0,totalPages:1,page:1,limit:20}};}
 await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data,meta})});});
 await page.goto('http://127.0.0.1:3000/sales');await page.getByRole('button',{name:'Filters',exact:true}).click();
 const customer=page.locator('fieldset').filter({has:page.locator('legend').filter({hasText:'Customer'})});
 await customer.getByRole('button',{name:'Next',exact:true}).click();await customer.getByRole('combobox').selectOption('customer-b');
 await page.getByRole('combobox',{name:'Register session',exact:true}).selectOption('session-a');
 await page.getByLabel('Created by',{exact:true}).fill('cashier');
 await page.waitForResponse(r=>r.url().includes('/api/backend/sales?')&&r.url().includes('createdBy=cashier'));
 assert.equal(queries.at(-1).customerId,'customer-b');assert.equal(queries.at(-1).cashRegisterSessionId,'session-a');
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.waitForResponse(r=>r.url().includes('/api/backend/sales?')&&!r.url().includes('customerId='));
 console.log('PASS related filters: paginated customer choice, register session, username query and reset. Mock API only.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
