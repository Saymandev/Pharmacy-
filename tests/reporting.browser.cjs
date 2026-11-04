/* eslint @typescript-eslint/no-require-imports: "off" -- Browser regression runner uses CommonJS. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true});const errors=[];const calls=[];let unavailable=false;
  page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.print=()=>{window.__reportPrinted=true;};});
  const saleRows=Array.from({length:105},(_,i)=>({slNo:i+1,invoiceNumber:`INV-${String(i).padStart(3,'0')}`,patientNumber:'001',patientName:'পরীক্ষার ক্রেতা',totalPrice:'100.00',discountAmount:'0.00',taxAmount:'0.00',netAmount:'100.00',paidAtEnd:'90.00',dueAtEnd:'10.00',createdBy:'Test Cashier',createdAt:'2026-10-31T19:00:00Z'}));
  await page.route('**/api/backend/**',async route=>{
   const url=new URL(route.request().url());const path=url.pathname.replace('/api/backend','');let data=[];let status=200;
   if(path==='/auth/me')data={id:'user-a',fullName:'Reporting user',role:{permissions:[{key:'report:read'}]}};
   else if(path==='/branches')data=[{id:'branch-a',name:'Main Branch'},{id:'branch-b',name:'Second Branch'}];
   else if(path.startsWith('/reports/')){
    calls.push(url);
    if(unavailable){status=503;data=null;}else if(path==='/reports/pharmacy/summary')data={sales:{totalAmount:'1234.50',paidAmount:'1000',dueAmount:'234.50',count:4},purchases:{totalAmount:'500',count:2},netProfit:'-42.50'};
    else if(path==='/reports/overall-summary')data={summary:{totalSales:100,totalPaid:80,totalDues:20,totalDiscount:0,totalReturned:0,totalExpenses:5,totalPurchases:30,totalPurchasesPaid:25,grossProfit:10,netProfit:5}};
    else if(path==='/reports/pharmacy/sales-report')data={outdoor:{sales:saleRows,returns:[],subTotals:{netAmount:10500,paidAtEnd:9450,dueAtEnd:1050}},indoor:{sales:[],returns:[]},summary:{totalNetSale:10500,totalCollection:9850,sameDayCollected:9450,previousDayDueCollected:400,advanceApplied:0,outstandingDueAtEnd:1050}};
    else if(path==='/reports/finance/income')data={summary:{totalCollection:50},groups:[{type:'pos',subTotals:{netAmount:50},sales:[{invoiceNumber:'INCOME-001',patientName:'Test Customer',netAmount:'50.00',paid:50,due:0}]}]};
    else if(path==='/reports/finance/expense'){await new Promise(r=>setTimeout(r,600));data={summary:{totalExpenditure:20},groups:[{category:'Rent',subTotals:{amount:20},expenses:[{expenseNumber:'STALE-EXPENSE',amount:20}]}]};}
    else if(path==='/reports/doctor-summary'){status=503;data=null;}
    else data={summary:{totalCollection:0},invoices:[]};
   }
   await route.fulfill({status,contentType:'application/json',body:JSON.stringify({success:status===200,message:status===200?'Success':'Report service temporarily unavailable.',data})}).catch(()=>{});
  });
  const base=process.env.POS_TEST_BASE_URL||'http://127.0.0.1:3000';await page.goto(base+'/reports');
  const content=page.locator('.reports-content');await content.getByText('Net profit',{exact:true}).waitFor();
  const reportNav=await page.locator('.reports-nav').boundingBox(),reportBody=await content.boundingBox();assert.ok(reportNav.y<reportBody.y && Math.abs(reportNav.width-reportBody.width)<3,'Report navigation should sit above the full-width content');
  assert.match(await content.getByText('Net profit',{exact:true}).locator('..').locator('strong').innerText(),/^-.*42\.50/);assert.ok(calls[0].searchParams.get('startDate'));assert.equal(calls[0].searchParams.get('branchId'),'branch-a');
  let failPdfFont=true;await page.route('**/fonts/NotoSansBengali*.ttf',route=>failPdfFont?route.fulfill({status:503,body:'Unavailable'}):route.continue());await page.getByRole('button',{name:'Download PDF',exact:true}).click();await page.getByRole('alert').filter({hasText:'PDF could not be created'}).waitFor();failPdfFont=false;const retryPdf=page.waitForEvent('download');await page.getByRole('alert').filter({hasText:'PDF could not be created'}).getByRole('button',{name:'Retry',exact:true}).click();await retryPdf;
  const firstDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();let download=await firstDownload;
  let csv=await fs.readFile(await download.path(),'utf8');assert.match(csv,/Main Branch/);assert.match(csv,/Net profit/);assert.match(csv,/-42.5/);
  await page.getByRole('button',{name:'All operations overview',exact:true}).click();await content.getByText('Net profit',{exact:true}).waitFor();assert.equal(await content.locator('.reports-metrics article').count(),10);
  await page.getByRole('button',{name:'Income',exact:true}).click();await content.getByText('INCOME-001',{exact:true}).first().waitFor();assert.match(await content.innerText(),/POS/);assert.doesNotMatch(await content.innerText(),/1 items/);
  await page.getByRole('button',{name:'Sales detail',exact:true}).click();const table=page.locator('.reports-screen-table table');await table.waitFor();assert.equal(await table.locator('th').count(),12);assert.equal(await table.locator('tbody tr').count(),50);assert.match(await table.locator('thead').innerText(),/Paid at period end/);assert.match(await content.innerText(),/Previous-day dues collected/);
  const nav=page.getByRole('navigation',{name:/Outdoor.*Sales pagination/});await nav.getByRole('button',{name:'Next',exact:true}).click();assert.match(await table.innerText(),/INV-050/);
  const allDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Export CSV',exact:true}).click();download=await allDownload;csv=await fs.readFile(await download.path(),'utf8');assert.match(csv,/INV-104/);assert.match(csv,/Created by/);assert.match(csv,/Previous-day dues collected/);assert.match(csv,/Paid at period end/);
  await page.getByRole('button',{name:'Filters',exact:true}).click();
  const pdfDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download PDF',exact:true}).evaluate(button=>{button.click();button.click();});const pdf=await pdfDownload;assert.match(pdf.suggestedFilename(),/\.pdf$/);await pdf.saveAs(require('node:path').resolve('../work/report-wide-browser.pdf'));assert.equal((await fs.readFile(await pdf.path())).subarray(0,5).toString(),'%PDF-');
  const filters=page.getByRole('form',{name:'Report filters'});await filters.getByLabel('From',{exact:true}).fill('2026-10-01');await filters.getByLabel('To',{exact:true}).fill('2026-10-31');await filters.getByLabel('Branch',{exact:true}).selectOption('branch-b');
  assert.equal(await page.getByRole('button',{name:'Export CSV',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('button',{name:'Download PDF',exact:true}).isDisabled(),true);
  const nextRequest=page.waitForRequest(r=>r.url().includes('/reports/pharmacy/sales-report')&&r.url().includes('branch-b'));
  await filters.getByRole('button',{name:'Apply filters',exact:true}).click();await nextRequest;await content.getByText('INV-000',{exact:true}).first().waitFor();assert.match(await content.locator('.reports-report-title').innerText(),/Second Branch/);
  const applied=calls.at(-1);assert.equal(applied.searchParams.get('startDate'),'2026-10-01');assert.equal(applied.searchParams.get('endDate'),'2026-10-31');
  await page.emulateMedia({media:'print'});assert.equal(await page.locator('.reports-print-table tbody tr').count(),105);assert.equal(await page.locator('.reports-print-table').isVisible(),true);await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'Print report',exact:true}).click();assert.equal(await page.evaluate(()=>window.__reportPrinted),true);
  const slowRequest=page.waitForRequest(r=>r.url().includes('/reports/finance/expense'));await page.getByRole('button',{name:'Expenses',exact:true}).click();await slowRequest;await page.getByRole('button',{name:'Income',exact:true}).click();await content.getByText('INCOME-001',{exact:true}).first().waitFor();await page.waitForTimeout(700);assert.doesNotMatch(await content.innerText(),/STALE-EXPENSE/);
  assert.equal(await page.getByRole('button',{name:'Doctors',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Hospital collection',exact:true}).count(),0);unavailable=true;await page.getByRole('button',{name:'Refresh',exact:true}).click();await page.getByRole('alert').filter({hasText:'Report service temporarily unavailable.'}).waitFor();assert.equal(await page.getByRole('button',{name:'Export CSV',exact:true}).isDisabled(),true);assert.equal(await content.locator('.reports-table-card').count(),0);
  unavailable=false;await page.getByRole('button',{name:'Pharmacy summary',exact:true}).click();await content.getByText('Net profit',{exact:true}).waitFor();await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);await page.screenshot({path:require('node:path').resolve('../work/reporting-mobile.png'),fullPage:true});
  assert.deepEqual(errors,[]);
  const denied=await browser.newPage();const deniedCalls=[];await denied.route('**/api/backend/**',async route=>{const path=new URL(route.request().url()).pathname;if(path.includes('/reports/'))deniedCalls.push(path);await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:path.endsWith('/auth/me')?{id:'restricted',fullName:'Restricted user',role:{permissions:[]}}:[]})});});await denied.goto(base+'/reports');await denied.getByText('Your role cannot view reports.',{exact:true}).waitFor();assert.equal(deniedCalls.length,0);
  console.log('PASS reporting browser: summary-only CSV, all metrics/columns, grouped rows, paging/full export, applied branch/date filters, all-row print, stale-request cancellation, error/export guard, mobile layout, permission denial. Mock API only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1)});
