const assert=require('node:assert/strict');
module.exports=()=>{
 const shop={id:'activation-shop',name:'Activation Pharmacy',slug:'activation-pharmacy',status:'PROVISIONING',isolationReady:false,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'},saved=new Map();
 const keys=['PENDING_SHOP','PROVISIONING_RECEIPT','ACCEPTED_OWNER','SHOP_DEFAULTS','EFFECTIVE_SUBSCRIPTION','DATABASE_ISOLATION'];let checks=0,commits=0;
 return {rows:()=>[shop],handle(req,res,url,body,key){
  const send=(status,data,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({success:status<400,data,message}));return true;};
  if(url.pathname===`/api/v1/platform/shops/${shop.id}`)return send(200,shop);
  if(url.pathname.endsWith(`/${shop.id}/activation-check`)){checks++;return send(200,{targetTenantId:shop.id,status:shop.status,isolationReady:shop.isolationReady,expectedUpdatedAt:shop.updatedAt,canActivate:checks>1,checks:keys.map(key=>({key,passed:checks>1||key!=='EFFECTIVE_SUBSCRIPTION'}))});}
  if(url.pathname.endsWith(`/${shop.id}/activate`)){
   if(saved.has(key))return send(200,saved.get(key));commits++;shop.status='ACTIVE';shop.isolationReady=true;
   const receipt={kind:'shop.activate',targetTenantId:shop.id,status:'ACTIVE',isolationReady:true};saved.set(key,receipt);return send(503,null,'Commit response lost');
  }return false;
 },async verify(page,requests,errors){
  await page.getByRole('button',{name:'Open shop Activation Pharmacy',exact:true}).click();
  const section=page.getByRole('region',{name:'Activate shop',exact:true}),check=section.getByRole('button',{name:'Check activation readiness',exact:true}),activate=section.getByRole('button',{name:'Activate verified shop',exact:true});
  assert.ok(await activate.isDisabled());await check.click();await section.getByText('Blocked',{exact:true}).waitFor();assert.ok(await activate.isDisabled());
  await check.click();await section.getByRole('textbox',{name:'Activation reason',exact:true}).fill('Reviewed owner and shop agreement');
  await section.getByRole('checkbox').check();
  const endpoint=new URL('/api/backend/platform/shops/activation-shop/activate',page.url()).toString();
  assert.equal((await page.request.post(endpoint,{headers:{Origin:new URL(page.url()).origin,'Idempotency-Key':'activation-forgery-test'},data:{reason:'Reviewed owner',confirm:true,expectedUpdatedAt:shop.updatedAt,isolationReady:true}})).status(),422);
  await activate.click();const retry=section.getByRole('button',{name:'Retry same request',exact:true});await retry.waitFor();
  assert.ok(await section.getByRole('textbox').isDisabled());assert.ok(await check.isDisabled());
  await retry.click();await section.waitFor({state:'detached'});
  const writes=requests.filter(v=>v.path.endsWith('/activate'));assert.equal(commits,1);assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.deepEqual(writes[0].body,writes[1].body);assert.ok(writes.every(v=>!v.headers['x-tenant-id']));assert.deepEqual(errors,[]);
  console.log('PASS activation actual Next BFF: blocked checklist, readiness forgery rejected, explicit consent, response-loss exact-key retry, one activation and refreshed shop.');
 }};
};
