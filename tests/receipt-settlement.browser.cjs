/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require("playwright"),assert=require("node:assert/strict"),path=require("node:path");
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});try{
 const page=await browser.newPage({viewport:{width:1366,height:768}}),errors=[],sales=[];
 page.on("pageerror",error=>errors.push(error.message));
 const branch={id:"b1",name:"Demo Pharmacy",address:"Sample address",phone:"01000000000",email:"demo@example.test"};
 const medicines=["a","b"].map((id,index)=>({id,name:["Axim CV","Duo-5"][index],strength:"500mg",genericName:"Tablet",salePrice:20,unit:"Pcs",stocks:[{id:"stock-"+id,branchId:"b1",batchNumber:"SECRET-BATCH-"+id,expiryDate:"2030-12-31",quantity:50,mrp:20,unit:"Pcs"}]}));
 let latest;
 await page.route("**/api/backend/**",async route=>{const request=route.request(),ep=new URL(request.url()).pathname.replace("/api/backend","");let data=[],meta;
 if(ep==="/auth/me")data={id:"admin",fullName:"Demo cashier",role:{permissions:[{key:"*"}]}};
 else if(ep==="/branches")data=[branch];
 else if(ep==="/pharmacy/medicines"){data=medicines;meta={page:1,totalItems:2,totalPages:1};}
 else if(ep==="/finance/accounts")data=[{id:"cash",name:"Private cash account",type:"cash"}];
 else if(ep==="/settings/tax")data={configs:{taxPercentage:0}};
 else if(ep==="/pharmacy/cash-register/active")data={id:"register1"};
 else if(ep==="/pharmacy/customers"||ep==="/customers")data=[{id:"c1",name:"OPD customer",phone:""}];
 else if(ep==="/sales"&&request.method()==="POST"){const body=request.postDataJSON();sales.push(body);latest={...body,id:"sale"+sales.length,invoiceNumber:"DEMO-"+sales.length,createdAt:"2026-11-05T03:00:00Z",branch,customer:{id:"c1",name:"OPD customer"},cashierName:"Demo cashier",totalPrice:40,netPrice:40,saleItems:body.saleItems.map((row,i)=>({...row,id:"i"+i,totalPrice:20})),transactions:body.paidAmount?[{id:"tx1",txnId:"TX-SHOULD-NOT-PRINT",flowType:"in",txnType:"sale",amount:body.paidAmount,paymentMethod:"cash",account:{name:"Private cash account"}}]:[]};data={sale:latest};}
 else if(ep==="/sales")data={sales:latest?[latest]:[],pagination:{total:latest?1:0,page:1,limit:20,totalPages:1}};
 else if(ep.startsWith("/sales/sale"))data=latest;
 await route.fulfill({json:{success:true,data,...(meta?{meta}:{})}});
 });
 const base=process.env.POS_TEST_BASE_URL||"http://127.0.0.1:3000";
 for(const scenario of [{state:"paid",amount:""},{state:"partial",amount:"20"},{state:"due",amount:"0"}]){
  await page.goto(base+"/pos");await page.evaluate(state=>localStorage.setItem("pharmacy.theme",state==="due"?"dark":"light"),scenario.state);await page.reload();await page.locator(".pos-product-card").first().waitFor();await page.locator(".pos-product-card").nth(0).click();await page.locator(".pos-product-card").nth(1).click();
  assert.equal(await page.locator(".pos-header-actions").getByRole("button",{name:"Calculator",exact:true}).count(),0);
  await page.keyboard.press("F4");const checkout=page.getByRole("dialog",{name:"Review & pay",exact:true});await checkout.waitFor();
  assert.equal(await checkout.locator(".pos-checkout-payment > .pos-checkout-adjustments").count(),1);
  await checkout.getByRole("button",{name:"Calculator",exact:true}).click();const calculator=page.getByRole("dialog",{name:"Calculator",exact:true});await calculator.waitFor();await calculator.getByRole("textbox",{name:"Calculation",exact:true}).fill("3*4");await page.keyboard.press("Enter");await calculator.getByRole("status",{name:"Calculation result",exact:true}).filter({hasText:"12"}).waitFor();await page.keyboard.press("Escape");await calculator.waitFor({state:"hidden"});assert.equal(await checkout.isVisible(),true);
  await checkout.locator(".pos-tender-line input").fill(scenario.amount);
  await page.waitForFunction(state=>document.querySelector(".pos-review-dialog")?.getAttribute("data-settlement")===state,scenario.state);
  assert.equal(await checkout.locator(".pos-settlement-warning").count(),scenario.state==="paid"?0:1);
  await checkout.screenshot({path:path.resolve("../work/checkout-"+scenario.state+"-settlement.png")});
  await checkout.getByRole("button",{name:"Complete sale",exact:true}).click();
  const preview=page.locator(".receipt-preview"),paper=preview.locator(".thermal-receipt");await preview.waitFor();
  assert.equal(await paper.getAttribute("data-settlement"),scenario.state);assert.ok((await paper.innerText()).includes("05/11/2026"));
  assert.equal(await paper.locator(".receipt-sale-items th").count(),4);
  assert.equal(await paper.locator(".receipt-item").count(),2);
  assert.equal(await paper.locator(".receipt-due-stamp").count(),scenario.state==="paid"?0:1);
  assert.equal(await paper.locator(".receipt-due-watermark").count(),scenario.state==="paid"?0:1);
  for(const text of ["SECRET-BATCH","Recorded payments","Payment breakdown","TX-SHOULD","Private cash account"])assert.ok(!(await paper.innerText()).includes(text),text);
  assert.ok((await paper.innerText()).includes("Sample address"));
  await paper.screenshot({path:path.resolve("../work/receipt-"+scenario.state+"-sample.png")});
  if(scenario.state!=="due"){
   await page.emulateMedia({media:"print"});
   if(scenario.state==="partial"){const color=await paper.locator(".receipt-due-stamp strong").evaluate(el=>getComputedStyle(el).color);assert.equal(color,"rgb(185, 28, 28)");}
   await page.pdf({path:path.resolve("../outputs/receipt-"+(scenario.state==="paid"?"paid":"due")+"-sample.pdf"),width:"80mm",height:"297mm",printBackground:false});
   await page.emulateMedia({media:"screen"});
  }
  await preview.getByRole("button",{name:"Close receipt",exact:true}).click();
  await page.goto(base+"/sales");await page.getByRole("button").filter({hasText:latest.invoiceNumber}).first().click();await page.getByRole("dialog",{name:"Sale details",exact:true}).getByRole("button",{name:"Print receipt",exact:true}).click();await preview.waitFor();
  assert.equal(await paper.getAttribute("data-settlement"),scenario.state);
  assert.equal(await paper.locator(".receipt-due-stamp").count(),scenario.state==="paid"?0:1);
  assert.equal(await paper.getByText("Change return",{exact:true}).count(),0);
  for(const text of ["SECRET-BATCH","Recorded payments","Payment breakdown","TX-SHOULD","Private cash account"])assert.ok(!(await paper.innerText()).includes(text),text);
  await preview.getByRole("combobox",{name:"Receipt language",exact:true}).selectOption("bn");await page.setViewportSize({width:390,height:844});assert.ok(await paper.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await preview.getByRole("combobox",{name:"রসিদের ভাষা",exact:true}).selectOption("en");await preview.getByRole("button",{name:"Close receipt",exact:true}).click();await page.setViewportSize({width:1366,height:768});
 }
 assert.deepEqual(sales.map(row=>row.paymentStatus),["paid","partial","due"]);assert.deepEqual(errors,[]);
 console.log("PASS checkout/receipt settlement: calculator only in checkout with Escape isolation, adjustments beside payment, paid/partial/due warnings, current + history receipts, sample table layout, no batch/payment history, red stamp in print, Bengali/mobile and authoritative saved balances. Mock API only.");
 }finally{await browser.close();}})().catch(error=>{console.error(error.stack);process.exit(1);});
