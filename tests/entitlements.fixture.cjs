const assert=require('node:assert/strict');
module.exports=()=>{
 const versions=[],grants=[],saved=new Map();let creates=0;
 const features=Object.fromEntries(['pos','catalog','inventory','purchases','customers','finance','reports','hr','communications','team','customization'].map(k=>[k,true]));
 return {handle(req,res,url,body,key){
  const send=(status,data,message)=>{res.writeHead(status,{'content-type':'application/json'});res.end(JSON.stringify({success:status<400,data,message}));return true;};
  if(url.pathname==='/api/v1/platform/addons'){
   if(req.method==='GET')return send(200,versions);
   if(saved.has(key))return send(200,saved.get(key));creates++;const v={id:'addon-1',addonKey:body.addonKey,version:1,revision:1,status:'DRAFT',config:body.config};versions.push(v);saved.set(key,JSON.parse(JSON.stringify(v)));return send(503,null,'Add-on response lost');
  }
  if(url.pathname==='/api/v1/platform/addons/addon-1/status'){versions[0].status=body.status;versions[0].revision++;return send(200,versions[0]);}
  if(url.pathname==='/api/v1/platform/shops/a/entitlements')return send(200,{targetTenantId:'a',effective:{targetTenantId:'a',state:'ACTIVE',operable:true,revision:'test-'+grants.length,features,limits:{branches:2+grants.length,seats:2,storageBytes:1000},usage:{branches:1,seats:1,storageBytes:0,reservedStorageBytes:0}},grants});
  if(url.pathname==='/api/v1/platform/shops/a/addons'){const g={id:'grant-1',targetTenantId:'a',revision:1,snapshot:versions[0].config,startsAt:body.startsAt,endsAt:null,paidAt:null,canceledAt:null};grants.push(g);return send(200,g);}
  return false;
 },async verify(page,requests,errors){
  await page.getByRole('button',{name:'Open shop Main Pharmacy',exact:true}).click();const panel=page.getByRole('region',{name:'Features and capacity',exact:true});await panel.getByText('1 / 2',{exact:true}).first().waitFor();
  await panel.getByRole('textbox',{name:'Add-on change reason',exact:true}).fill('Approved extra branch agreement');await panel.getByLabel('I confirm this add-on agreement and selected shop.',{exact:true}).check();
  await panel.getByText('Build an add-on version',{exact:true}).click();await panel.getByRole('textbox',{name:'Add-on key',exact:true}).fill('extra-branch');await panel.getByRole('textbox',{name:'Add-on name',exact:true}).fill('Extra branch');await panel.getByRole('spinbutton',{name:'Extra branches',exact:true}).fill('1');
  await panel.getByRole('button',{name:'Create add-on draft',exact:true}).click();await panel.getByRole('button',{name:'Retry same request',exact:true}).waitFor();assert.ok(await panel.getByRole('textbox',{name:'Add-on key',exact:true}).isDisabled());await panel.getByRole('button',{name:'Retry same request',exact:true}).click();await panel.getByRole('button',{name:'Publish version',exact:true}).waitFor();assert.equal(creates,1);
  await panel.getByLabel('I confirm this add-on agreement and selected shop.',{exact:true}).check();await panel.getByRole('button',{name:'Publish version',exact:true}).click();await panel.getByRole('button',{name:'Retire version',exact:true}).waitFor();
  await panel.locator('select').last().selectOption('addon-1');await panel.getByLabel('I confirm this add-on agreement and selected shop.',{exact:true}).check();await panel.getByRole('button',{name:'Assign add-on',exact:true}).click();await panel.getByText('1 / 3',{exact:true}).waitFor();
  const writes=requests.filter(r=>r.path==='/api/v1/platform/addons'&&r.method==='POST');assert.equal(writes.length,2);assert.equal(writes[0].key,writes[1].key);assert.deepEqual(writes[0].body,writes[1].body);assert.ok(requests.every(r=>!r.headers['x-tenant-id']));assert.deepEqual(errors,[]);
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Switch to dark mode',exact:true}).click();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log('PASS entitlement actual Next BFF: scoped usage, dedicated draft, exact-key unknown retry, publication, assignment and mobile theme.');
 }};
};
