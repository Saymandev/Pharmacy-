/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require("playwright"),assert=require("node:assert/strict"),path=require("node:path");
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});try{
const page=await browser.newPage(),errors=[],writes=[];page.on("pageerror",e=>errors.push(e.message));
const medicines=Array.from({length:8},(_,i)=>({id:`m${i}`,name:`Cart medicine ${i+1}`,strength:"500mg",salePrice:20,unit:"Pcs",stocks:[{id:`s${i}`,branchId:"b1",quantity:123,unit:"Pcs",mrp:20,batchNumber:`DEMO-LONG-BATCH-${i}`,expiryDate:"2030-12-08"}]}));
await page.route("**/api/backend/**",async route=>{const req=route.request(),ep=new URL(req.url()).pathname.replace("/api/backend","");let data=[],meta;
if(req.method()!=="GET")writes.push(ep);
if(ep==="/auth/me")data={id:"admin",fullName:"Test Admin",role:{permissions:[{key:"*"}]}};
if(ep==="/branches")data=[{id:"b1",name:"Test Branch"}];
if(ep==="/pharmacy/medicines"){data=medicines;meta={page:1,totalItems:8,totalPages:1,limit:60};}
if(ep==="/finance/accounts")data=[{id:"a1",name:"Cash drawer",type:"cash"}];
if(ep==="/pharmacy/cash-register/active")data={id:"r1",closingBalance:0};
await route.fulfill({json:{success:true,data,...(meta?{meta}:{})}});});
const base=process.env.POS_TEST_BASE_URL||"http://127.0.0.1:3000";await page.goto(base+"/pos");
for(const theme of ["light","dark"]){
await page.evaluate(theme=>{localStorage.setItem("pharmacy.theme",theme);},theme);await page.reload();
await page.locator(".pos-product-card").first().waitFor();for(let i=0;i<8;i++)await page.locator(".pos-product-card").nth(i).click();
for(const [width,height]of [[1440,900],[822,650],[390,700],[360,540]]){
await page.setViewportSize({width,height});await page.locator(".pos-mobile-cart-bar").click();const cart=page.locator(".pos-cart-modal");await cart.waitFor();
assert.equal(await cart.locator(".pos-cart-line").count(),8);
const heading=await cart.locator(".pos-cart-heading").boundingBox(),lines=await cart.locator(".pos-cart-lines").boundingBox(),summary=await cart.locator(".pos-cart-summary").boundingBox(),footer=await cart.locator(".pos-cart-footer").boundingBox();
assert.ok(lines.y>=heading.y+heading.height-1,"items must start below header");assert.ok(lines.y+lines.height<=summary.y+1,"items must end above summary");assert.ok(footer.y+footer.height<=height+1,"checkout remains visible");assert.ok(lines.height>=height*.5,"item list gets majority of height");
const stepper=cart.locator(".pos-quantity-stepper").first();const input=await stepper.locator("input").boundingBox(),box=await stepper.boundingBox();assert.ok(input.y>=box.y&&input.y+input.height<=box.y+box.height+1,"quantity input stays inside stepper");
await cart.locator(".pos-cart-lines").evaluate(el=>el.scrollTop=el.scrollHeight);const endHeader=await cart.locator(".pos-cart-heading").boundingBox();assert.equal(endHeader.y,heading.y);
assert.ok(await cart.evaluate(el=>el.scrollWidth<=el.clientWidth+1));
await page.screenshot({path:path.resolve(`../work/cart-${theme}-${width}.png`)});
await page.keyboard.press("Escape");await cart.waitFor({state:"hidden"});
}
await page.setViewportSize({width:822,height:650});await page.locator(".pos-mobile-cart-bar").click();const cart=page.locator(".pos-cart-modal");await cart.locator(".pos-cart-lines").evaluate(el=>el.scrollTop=0);
await cart.getByRole("button",{name:"Increase quantity",exact:true}).first().click();assert.equal(await cart.getByRole("textbox",{name:"Quantity",exact:true}).first().inputValue(),"2");
await cart.getByRole("button",{name:"Proceed to checkout",exact:false}).click();await page.getByRole("heading",{name:"Review & pay",exact:true}).waitFor();await page.getByRole("button",{name:"Back to cart",exact:true}).click();await cart.waitFor();assert.equal(await cart.getByRole("textbox",{name:"Quantity",exact:true}).first().inputValue(),"2");await page.keyboard.press("Escape");
}
assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);console.log("PASS cart design: eight items, fixed header/checkout, scrolling, contained quantity input, 4 viewport sizes, light/dark themes and quantity preserved through checkout/back. Mock API only.");
}finally{await browser.close();}})().catch(e=>{console.error(e.stack);process.exit(1);});
