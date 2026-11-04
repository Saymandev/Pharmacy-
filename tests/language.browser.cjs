/* eslint @typescript-eslint/no-require-imports: "off" */
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ts=require("typescript");
function entries(file){const out={};const ast=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),99,true,4);function visit(n){if(ts.isPropertyAssignment(n)&&ts.isStringLiteral(n.initializer))out[n.name.text]=n.initializer.text;ts.forEachChild(n,visit);}visit(ast);return out;}
const labels={...entries("src/lib/i18n/workspace-bn.ts"),...entries("src/lib/i18n/language-provider.tsx"),...entries("src/lib/i18n/interface-bn.ts")};
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const technical=new Set(["0.00","BDT","e.g. B-1042","pharmacy.admin","supplier@example.com"]);
// All literal translation calls must resolve. Technical examples are intentionally unchanged.
for(const file of walk("src").filter(f=>f.endsWith(".tsx"))){const ast=ts.createSourceFile(file,fs.readFileSync(file,"utf8"),99,true,4);function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(ast)==="t"&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){const key=n.arguments[0].text;assert.ok(labels[key]||technical.has(key),`${file}: missing Bengali message: ${key}`);}ts.forEachChild(n,visit);}visit(ast);}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:900}}),errors=[],writes=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem("pharmacy.language","bn");});
 await page.route("**/api/backend/**",async route=>{const req=route.request(),ep=new URL(req.url()).pathname.replace("/api/backend","");let data=[];
 if(req.method()!=="GET")writes.push(ep);
 if(ep==="/auth/me")data={id:"a",fullName:"Test Admin",role:{name:"Super Admin",permissions:[{key:"*"}]}};
 if(ep==="/branches")data=[{id:"b1",name:"Test Branch"}];
 if(ep==="/setup/status")data={isSetupComplete:false};
 await route.fulfill({json:{success:true,data,meta:{total:0,page:1,limit:20,totalPages:1}}});
 });
 const base=process.env.POS_TEST_BASE_URL||"http://127.0.0.1:3000";
 const routes=["/dashboard","/catalog","/inventory","/catalog/setup","/purchases","/suppliers","/sales","/returns","/customers","/finance","/reports","/hr","/hr/setup","/hr/rosters","/access","/admin","/pos"];
 for(const route of routes){
  await page.goto(base+route);
  await page.locator(".app-frame").waitFor();
  assert.equal(await page.locator("html").getAttribute("lang"),"bn");
  await page.locator(".side-navigation").getByRole("link",{name:"ইনভেন্টরি",exact:true}).waitFor({state:"attached"});
  const text=await page.locator(".app-frame").innerText();
  for(const forbidden of ["সারসংক্ষেপ","কর্মক্ষেত্র","ওষুধের তালিকা"])assert.ok(!text.includes(forbidden),`${route}: old navigation spelling: ${forbidden}`);
 }
 await page.goto(base+"/purchases");
 await page.getByRole("heading",{name:"সাপ্লায়ার ও পারচেজ",exact:true}).waitFor();
 await page.getByRole("button",{name:"সাপ্লায়ার রিটার্ন",exact:true}).click();
 await page.getByRole("heading",{name:"সাপ্লায়ার রিটার্ন ও রিফান্ড",exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await page.screenshot({path:path.resolve("../work/bengali-supplier-returns-mobile.png"),fullPage:true});
 await page.goto(base+"/setup");
 await page.getByRole("heading",{name:"আপনার ফার্মেসি ওয়ার্কস্পেস তৈরি করুন"}).waitFor();
 await page.getByRole("button",{name:"কন্টিনিউ",exact:true}).click();
 await page.getByRole("alert").filter({hasText:"ফার্মেসির নাম কমপক্ষে ৩ অক্ষরের হতে হবে।"}).waitFor();
 await page.getByRole("combobox",{name:"ল্যাঙ্গুয়েজ",exact:true}).selectOption("en");
 await page.getByRole("heading",{name:"Create your pharmacy workspace"}).waitFor();
 await page.reload();
 await page.getByRole("heading",{name:"Create your pharmacy workspace"}).waitFor();
 assert.deepEqual(writes,[]);
 assert.deepEqual(errors,[]);
 console.log("PASS language audit: all static message keys covered; Bengali navigation across 17 workspaces; supplier-return tab, setup validation, English switch/persistence and mobile width. No writes. Mock API only.");
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
