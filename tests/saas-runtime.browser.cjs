const http=require('node:http'),assert=require('node:assert/strict'),{spawn,execFileSync}=require('node:child_process'),{chromium}=require('playwright');
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
(async()=>{
 let child,browser,logs='',failLogout=false;const revoked=new Set(),calls=[];
 const user=kind=>({id:'runtime-'+kind,username:'runtime.'+kind,email:kind+'@example.test',fullName:'Runtime '+kind,role:null,employee:null,permissions:[],isActive:true});
 const fixture=http.createServer(async(req,res)=>{
  const chunks=[];for await(const c of req)chunks.push(c);const body=chunks.length?JSON.parse(Buffer.concat(chunks).toString()):{},url=new URL(req.url,'http://fixture'),token=req.headers.authorization?.replace('Bearer ','');calls.push({path:req.url,method:req.method,auth:req.headers.authorization});
  const kind=token==='runtime-admin'?'admin':'owner';let status=200,data,message;
  if(url.pathname==='/api/v1/setup/status')data={isSetupComplete:true};
  else if(url.pathname==='/api/v1/auth/login'){const actor=body.usernameOrEmail==='runtime.admin'?'admin':'owner';revoked.delete('runtime-'+actor);data={user:user(actor),accessToken:'runtime-'+actor,refreshToken:'runtime-refresh-'+actor};}
  else if(url.pathname==='/api/v1/auth/me'){if(!token||revoked.has(token))status=401;else data=user(kind);}
  else if(url.pathname==='/api/v1/platform/session'){if(!token||revoked.has(token))status=401;else if(kind!=='admin'){status=403;message='Platform operator access required';}else data={operatorId:'runtime-operator',userId:user(kind).id,capabilities:['platform:shops:read']};}
  else if(url.pathname==='/api/v1/platform/shops')data={data:[],pagination:{page:1,pageSize:20,totalItems:0,totalPages:0,hasNextPage:false,hasPreviousPage:false}};
  else if(url.pathname==='/api/v1/tenant-session/memberships')data={items:[],nextCursor:null};
  else if(url.pathname==='/api/v1/auth/logout'){if(failLogout)status=503;else revoked.add(token);}
  else status=404;
  res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify({success:status===200,data:data??null,message:message??(status===503?'Unavailable':undefined)}));
 });
 try{
  const upstream=await listen(fixture),probe=http.createServer(),port=await listen(probe);await new Promise(r=>probe.close(r));const base=`http://localhost:${port}`;
  child=spawn(process.execPath,['node_modules/next/dist/bin/next',process.env.NEXT_BROWSER_MODE==='start'?'start':'dev','--port',String(port)],{windowsHide:true,env:{...process.env,NEXT_PUBLIC_SAAS_MODE:'false',SAAS_RUNTIME_ENABLED:'true',TENANT_SESSION_PREVIEW_ENABLED:'true',PLATFORM_ADMIN_PREVIEW_ENABLED:'true',PLATFORM_ADMIN_WRITES_ENABLED:'true',PLATFORM_BACKEND_API_URL:`http://127.0.0.1:${upstream}/api/v1/platform`,BACKEND_API_URL:`http://127.0.0.1:${upstream}/api/v1`},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>logs=(logs+b).slice(-6000));child.stderr.on('data',b=>logs=(logs+b).slice(-6000));let ready=false;
  for(let i=0;i<90;i++){try{if((await fetch(base+'/login',{signal:AbortSignal.timeout(1000)})).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,logs);
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const login=async actor=>{await page.goto(base+'/login');await page.getByLabel('Username or email',{exact:true}).fill('runtime.'+actor);await page.getByLabel('Password',{exact:true}).fill('strong-runtime-password');await page.getByRole('button',{name:'Sign in',exact:true}).click();};
  await login('admin');await page.waitForURL('**/platform');await page.getByRole('heading',{name:'Super Admin',exact:true}).waitFor();
  // A stale legacy bookmark must also resolve to the verified platform panel.
  await page.goto(base+'/dashboard');await page.waitForURL('**/platform');await page.getByRole('heading',{name:'Super Admin',exact:true}).waitFor();
  assert(!await page.evaluate(()=>document.cookie.includes('runtime-admin')));
  assert.equal((await page.request.post(base+'/api/backend/auth/logout',{headers:{Origin:'https://foreign.test'}})).status(),403);
  // Reproduce Coolify's public host vs internal request URL mismatch.
  const proxyLogout=await page.request.post(base+'/api/session/logout',{headers:{Origin:'https://public.example','X-Forwarded-Host':'public.example','X-Forwarded-Proto':'https'},maxRedirects:0});
  assert.equal(proxyLogout.status(),307);assert.equal(proxyLogout.headers().location,'/api/backend/auth/logout');
  failLogout=true;await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Retry sign out',exact:true}).waitFor();
  assert((await context.cookies()).some(c=>c.name==='pharmacy_access'&&c.value==='runtime-admin'&&c.httpOnly));assert(!revoked.has('runtime-admin'));
  failLogout=false;await page.getByRole('button',{name:'Retry sign out',exact:true}).click();await page.waitForURL('**/login');await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert(revoked.has('runtime-admin'));
  assert(!(await context.cookies()).some(c=>['pharmacy_access','pharmacy_refresh'].includes(c.name)));
  // Owner signs in immediately after the admin's failed-then-retried logout.
  await login('owner');await page.waitForURL('**/shops');await page.getByRole('heading',{name:'Your shops',exact:true}).waitFor();await page.getByRole('heading',{name:'No shops available',exact:true}).waitFor();
  assert((await context.cookies()).some(c=>c.name==='pharmacy_access'&&c.value==='runtime-owner'));
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL('**/login');await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();assert(revoked.has('runtime-owner'));
  assert(!(await context.cookies()).some(c=>['pharmacy_access','pharmacy_refresh'].includes(c.name)));
  assert(calls.some(c=>c.path==='/api/v1/platform/session'&&c.auth==='Bearer runtime-owner'));assert(calls.some(c=>c.path==='/api/v1/platform/session'&&c.auth==='Bearer runtime-admin'));assert.deepEqual(errors,[]);
  console.log('PASS actual Next runtime-only SaaS mode despite false public flag: admin -> platform, stale dashboard -> platform, failed logout retains session, retry revokes/clears cookies, owner login -> shops, owner logout -> login, proxy-safe relative redirect and origin rejection.');
 }catch(e){console.error(logs);throw e;}finally{if(browser)await browser.close();if(child&&child.exitCode===null)try{execFileSync('taskkill',['/pid',String(child.pid),'/t','/f'],{windowsHide:true,stdio:'ignore'});}catch{}fixture.closeAllConnections();await new Promise(r=>fixture.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
