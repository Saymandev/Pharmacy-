/* eslint @typescript-eslint/no-require-imports: "off" -- CommonJS browser test runner. */
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(require('node:fs').existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];const posts=[];const patches=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',dialog=>dialog.accept());
  const original=(id,quantity=2)=>({id,medicineId:'med-a',itemName:'Return Medicine',unit:'Pcs',quantity,price:50,mrp:50,totalPrice:100,batchNumber:'BATCH-A',expiryDate:'2030-01-01'});
  let sale={id:'sale-a',invoiceNumber:'SALE-FLOW-1',branchId:'branch-a',branch:{name:'Main'},customerId:'customer-a',customer:{name:'Customer'},type:'pos',status:'completed',paymentStatus:'partial',paymentMethod:'cash',totalPrice:200,netPrice:150,paidAmount:50,dueAmount:100,discountAmount:50,taxAmount:0,createdAt:'2026-10-31T19:00:00Z',saleItems:[original('line-a'),original('line-b'),{...original('zero',1),medicineId:'med-free',itemName:'Free Item',batchNumber:'FREE',price:50,totalPrice:0,discountAmount:50}]};
  const historyLine=quantity=>({...original('return-line',quantity)});
  let oldReturnQuantity=1;let changedDue=false;let reviewMode=false;let reviewReserved=2;let releaseHistory;const historyGate=new Promise(resolve=>{releaseHistory=resolve;});let firstHistory=true;
  const pending=()=>({id:'review-a',saleId:'sale-a',invoiceNumber:'SALE-FLOW-1',branchId:'branch-a',status:'pending',totalPrice:80,createdAt:'2026-11-01T01:00:00Z',saleReturnItems:[historyLine(2)]});
  await page.route('**/api/backend/**',async route=>{
   const req=route.request();const url=new URL(req.url());const path=url.pathname.replace('/api/backend','');let data=[];
   if(path==='/auth/me')data={id:'user-a',fullName:'Test Cashier',role:{permissions:[{key:'*'}]}};
   else if(path==='/branches')data=[{id:'branch-a',name:'Main'}];
   else if(path==='/finance/accounts')data=[{id:'cash-a',name:'Cash drawer',type:'cash'},{id:'bank-b',name:'Bank account',type:'bank'}];
   else if(path==='/sales')data={sales:[sale],pagination:{total:1,page:1,limit:20,totalPages:1}};
   else if(path==='/sales/sale-a'){
    if(changedDue){sale={...sale,dueAmount:50,paidAmount:100};changedDue=false;}
    data=sale;
   }else if(path==='/sales/sale-a/payments'){
    posts.push({path,body:req.postDataJSON()});await new Promise(r=>setTimeout(r,100));sale={...sale,paidAmount:150,dueAmount:0,paymentStatus:'paid'};data=sale;
   }else if(path==='/sales/returns'&&req.method()==='GET'){
    if(!url.searchParams.has('saleId'))data={data:reviewMode?[pending()]:[],pagination:{total:reviewMode?1:0,page:1,limit:20,totalPages:reviewMode?1:0}};
    else if(reviewMode)data={data:[pending(),{id:'previous-review',saleId:'sale-a',status:'completed',saleReturnItems:[historyLine(reviewReserved)]}],pagination:{total:2,page:1,limit:100,totalPages:1}};
    else if(url.searchParams.get('page')==='2'){
     if(firstHistory){await historyGate;firstHistory=false;}data={data:[{id:'historic-last',saleId:'sale-a',status:'completed',saleReturnItems:[historyLine(oldReturnQuantity)]}],pagination:{total:101,page:2,limit:100,totalPages:2}};
    }else data={data:[{id:'historic-pending',saleId:'sale-a',status:'pending',saleReturnItems:[historyLine(1)]},...Array.from({length:99},(_,i)=>({id:`rejected-${i}`,saleId:'sale-a',status:'rejected',saleReturnItems:[]}))],pagination:{total:101,page:1,limit:100,totalPages:2}};
   }else if(path==='/sales/returns'&&req.method()==='POST'){
    posts.push({path,body:req.postDataJSON()});data={id:'created-return',saleId:'sale-a',status:'completed',totalPrice:40,saleReturnItems:[]};
   }else if(path==='/sales/returns/review-a')data=pending();
   else if(path==='/sales/returns/review-a/status'){patches.push(req.postDataJSON());data={...pending(),status:req.postDataJSON().status};}
   await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data})});
  });
  const base=process.env.POS_TEST_BASE_URL||'http://127.0.0.1:3000';await page.goto(base+'/sales');
  await page.getByRole('button',{name:'View invoice SALE-FLOW-1',exact:true}).click();const detail=page.getByRole('dialog',{name:'Sale details'});await detail.waitFor();
  const free=detail.locator('.sales-detail-line').filter({hasText:'Free Item'});assert.match(await free.locator('b').innerText(),/0\.00/);
  await detail.getByRole('button',{name:'Collect due',exact:true}).click();const payment=page.getByRole('dialog',{name:'Collect sale due'});
  await payment.getByLabel('Amount',{exact:true}).fill('75');changedDue=true;await payment.getByRole('button',{name:'Record payment',exact:true}).click();
  await payment.getByRole('alert').filter({hasText:'current outstanding due'}).waitFor();assert.equal(posts.length,0);
  await payment.getByRole('button',{name:'Pay full due',exact:true}).click();assert.equal(await payment.getByLabel('Amount',{exact:true}).inputValue(),'50.00');
  await payment.getByText('Optional payment note',{exact:true}).click();await payment.getByLabel('Payment note',{exact:true}).fill('Counter collection');
  await payment.locator('form').evaluate(form=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));});
  await payment.waitFor({state:'hidden'});assert.equal(posts.length,1);assert.equal(posts[0].body.amount,50);assert.equal(posts[0].body.note,'Counter collection');assert.equal(posts[0].body.accountId,'cash-a');
  await page.getByRole('button',{name:'View invoice SALE-FLOW-1',exact:true}).click();
  const historySecond=page.waitForRequest(r=>r.url().includes('/sales/returns?')&&r.url().includes('page=2'));
  await detail.getByRole('button',{name:'Start return',exact:true}).click();await historySecond;
  assert.equal(await page.getByRole('dialog',{name:'Create sale return'}).count(),0);releaseHistory();
  const create=page.getByRole('dialog',{name:'Create sale return'});await create.waitFor();
  const quantities=create.getByRole('spinbutton',{name:'Return quantity for Return Medicine (BATCH-A)',exact:true});assert.equal(await quantities.count(),2);assert.equal(await quantities.first().getAttribute('max'),'2');
  await quantities.first().fill('2');assert.equal(await quantities.nth(1).getAttribute('max'),'0');
  await create.getByRole('combobox',{name:'Return request state'}).selectOption('completed');await create.getByRole('combobox',{name:'Refund account'}).selectOption('bank-b');
  oldReturnQuantity=2;await create.getByRole('button',{name:'Complete return',exact:true}).click();await create.getByRole('alert').filter({hasText:'remaining after previous requests'}).waitFor();assert.equal(posts.length,1);
  await quantities.first().fill('1');await create.getByLabel('Reason / notes',{exact:true}).fill('Damaged package');sale={...sale,saleItems:sale.saleItems.map(item=>item.id==='line-a'?{...item,price:45}:item)};
  await create.getByRole('button',{name:'Complete return',exact:true}).click();await create.waitFor({state:'hidden'});assert.equal(posts.length,2);const returned=posts[1].body;assert.equal(returned.accountId,'bank-b');assert.equal(returned.saleReturnItems[0].quantity,1);assert.equal(returned.saleReturnItems[0].price,45);
  reviewMode=true;await page.goto(base+'/returns');await page.getByRole('button',{name:'View return SALE-FLOW-1',exact:true}).click();const review=page.getByRole('dialog',{name:'Return request details'});await review.waitFor();assert.match(await review.locator('.sales-detail-totals').innerText(),/Net adjustment/);assert.match(await review.locator('.sales-detail-totals').innerText(),/-BDT\s*20\.00/);
  reviewReserved=3;await review.getByRole('button',{name:'Approve & process',exact:true}).click();await review.getByRole('alert').filter({hasText:'remaining after previous requests'}).waitFor();assert.equal(patches.length,0);
  reviewReserved=2;await review.getByRole('button',{name:'Approve & process',exact:true}).click();await review.waitFor({state:'hidden'});assert.deepEqual(patches,[{status:'completed'}]);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'View return SALE-FLOW-1',exact:true}).click();await review.waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);await page.screenshot({path:'/tmp/sales-return-mobile.png'});
  assert.deepEqual(errors,[]);
  const denied=await browser.newPage();const reads=[];await denied.route('**/api/backend/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/backend/sales')reads.push(path);await route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,data:path.endsWith('/auth/me')?{id:'no-access',fullName:'No access',role:{permissions:[]}}:[]})});});await denied.goto(base+'/sales');await denied.getByText('Your role cannot view this page.',{exact:true}).waitFor();assert.equal(reads.length,0);
  console.log('PASS sales browser: saved zero totals, fresh due validation, exact payment/note and duplicate guard, paginated return history, shared batch allowance, history recheck, original-price refresh, refund account, safe approval, mobile and read permission. Mock API only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1)});
