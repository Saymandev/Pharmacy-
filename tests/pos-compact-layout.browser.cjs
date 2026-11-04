/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require("playwright"),assert=require("node:assert/strict"),path=require("node:path");
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});try{
 const page=await browser.newPage(),errors=[],writes=[];page.on("pageerror",e=>errors.push(e.message));
 const medicines=Array.from({length:24},(_,i)=>({id:`m${i}`,name:`Medicine ${i+1}`,genericName:`Generic ${i+1}`,strength:"500mg",salePrice:20,unit:"Pcs",stocks:[{id:`s${i}`,branchId:"b1",batchNumber:`B-${i}`,expiryDate:"2030-12-31",quantity:123,mrp:20,unit:"Pcs"}]}));
 await page.route("**/api/backend/**",async route=>{const req=route.request(),ep=new URL(req.url()).pathname.replace("/api/backend","");let data=[],meta;if(req.method()!=="GET")writes.push(ep);if(ep==="/auth/me")data={id:"a",fullName:"Test Admin",role:{permissions:[{key:"*"}]}};if(ep==="/branches")data=[{id:"b1",name:"Primary branch with a long branch name"}];if(ep==="/pharmacy/medicines"){data=medicines;meta={page:1,totalItems:24,totalPages:1};}if(ep==="/pharmacy/cash-register/active")data={id:"r1"};await route.fulfill({json:{success:true,data,...(meta?{meta}:{})}});});
 const base=process.env.POS_TEST_BASE_URL||"http://127.0.0.1:3000";await page.goto(base+"/pos");
 // Older saved table preferences must now open the list.
 await page.evaluate(()=>{localStorage.setItem("pharmacy.pos-view","table");});await page.reload();await page.locator(".pos-catalog-list-row").first().waitFor();assert.equal(await page.locator("table").count(),0);assert.equal(await page.getByRole("columnheader",{name:"Actions",exact:true}).count(),0);
 const measurements=[];
 for(const theme of ["light","dark"]){await page.evaluate(theme=>localStorage.setItem("pharmacy.theme",theme),theme);await page.reload();await page.getByRole("button",{name:"List mode",exact:true}).click();await page.locator(".pos-catalog-list-row").first().waitFor();
  for(const [width,height]of [[1366,768],[1366,600],[1024,600],[390,700]]){
   await page.setViewportSize({width,height});
   for(const mode of ["List mode","Card mode"]){await page.getByRole("button",{name:mode,exact:true}).click();await page.locator(".pos-focus-mode").evaluate(el=>el.scrollTop=0);
    const selector=mode==="List mode"?".pos-catalog-list-row":".pos-product-card";await page.locator(selector).first().waitFor();
    const bounds=await page.locator(selector).first().boundingBox();const visible=await page.locator(selector).evaluateAll((nodes,height)=>nodes.filter(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=height-84;}).length,height);
    assert.ok(bounds.y<=(width>650?145:230),`Medicine starts too low: ${width}x${height} ${mode} y=${bounds.y}`);
    if(width>650&&mode==="List mode")assert.ok(visible>=7,`Only ${visible} list rows visible`);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    measurements.push({width,height,theme,mode,firstMedicineY:Math.round(bounds.y),visible});
    if(width===1366&&height===600){await page.screenshot({path:path.resolve(`../work/pos-compact-${theme}-${mode==="List mode"?"list":"cards"}.png`)});}
   }
  }
 }
 await page.setViewportSize({width:1024,height:600});await page.getByRole("button",{name:"List mode",exact:true}).click();await page.locator(".pos-focus-mode").evaluate(el=>el.scrollTop=0);await page.locator(".pos-catalog-list-row").first().click();await page.getByRole("region",{name:"Quick quantity",exact:true}).waitFor();assert.equal(await page.locator(".pos-cart-modal").count(),0);const withQuantity=await page.locator(".pos-catalog-list-row").first().boundingBox();assert.ok(withQuantity.y<=195,`Quick quantity pushes list too low: ${withQuantity.y}`);
 await page.getByRole("button",{name:"Filters",exact:false}).first().click();await page.locator("#pos-filter-popover").waitFor();await page.getByRole("heading",{name:"Medicine catalog",exact:true}).click();assert.equal(await page.locator("#pos-filter-popover").count(),0);
 assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);console.log(JSON.stringify(measurements));console.log("PASS compact POS: no table/action column; whole-row add; legacy preference migration; medicine start/visible-row budget at 1366x600 and 1024x600; list/cards, long branch names, themes, mobile and quick quantity. Mock API only.");
 }finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exit(1);});
