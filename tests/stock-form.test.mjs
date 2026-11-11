import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStock,openingStockPayload,adjustmentPayload} from '../src/features/shops/stock-form-policy.ts';
import {tenantWorkspaceTarget,validStockProxyBody} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111';
test('opening stock validates integer quantity, exact calendar date and costs without accepting caller ownership',()=>{
 const draft={...emptyStock,batchNumber:' B-01 ',expiryDate:'2030-01-01',quantity:'4',unitPrice:'10.25'};
 const body=openingStockPayload(id,id,draft);assert.equal(body.expiryDate,'2030-01-01T00:00:00.000Z');assert.equal(body.batchNumber,'B-01');assert.equal(body.quantity,4);assert.equal(body.unitPrice,10.25);assert.ok(!('tenantId'in body));
 for(const patch of [{quantity:'0'},{quantity:'1.5'},{quantity:'2147483648'},{unitPrice:'-1'},{mrp:'20.001'},{expiryDate:'2030-02-30'},{batchNumber:' '}])assert.throws(()=>openingStockPayload(id,id,{...draft,...patch}));
});
test('adjustment carries the inspected quantity and requires a reason, avoiding negatives and overflow',()=>{
 const body=adjustmentPayload(id,5,{...emptyStock,quantity:'2',type:'decrease',note:'Count correction'});assert.equal(body.expectedQuantity,5);assert.equal(body.quantity,2);assert.equal(body.type,'decrease');
 for(const [current,patch]of [[1,{quantity:'2',type:'decrease'}],[2147483647,{quantity:'1'}],[5,{note:''}],[5,{quantity:'1e2'}]])assert.throws(()=>adjustmentPayload(id,current,{...emptyStock,note:'Reason',...patch}));
});
test('stock mutation proxy gates explicit actions and rejects identity/ledger fields',()=>{
 const config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};
 for(const kind of ['opening','adjust'])assert.ok(tenantWorkspaceTarget('a',['pharmacy','stocks',kind],'POST',config));
 assert.equal(tenantWorkspaceTarget('a',['pharmacy','stocks','adjust'],'POST',{...config,writes:'false'}),null);assert.equal(tenantWorkspaceTarget('a',['pharmacy','stocks','import'],'POST',config),null);
 assert.equal(validStockProxyBody({stockId:id,quantity:2,type:'increase',expectedQuantity:5,note:'Count'},'adjust'),true);
 for(const body of [{stockId:id,quantity:1,type:'increase',note:'Reason'},{stockId:id,quantity:1,expectedQuantity:5,note:''},{stockId:id,quantity:1,expectedQuantity:5,note:'Reason',tenantId:'b'},{medicineId:id,branchId:id,quantity:1,accountId:id}])assert.equal(validStockProxyBody(body,'stockId'in body?'adjust':'opening'),false);
});
test('opening picker includes unregistered medicines; stock saves preserve the replay key and inspected branch',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url:new URL(url,'http://fixture'),options});return Response.json({success:true,data:[],meta:{}});});
 await client.stockMedicines(id,1,'new medicine');assert.equal(calls[0].url.searchParams.get('registeredOnly'),'false');assert.equal(calls[0].url.searchParams.get('branchId'),id);
 await client.stock(id,id);assert.equal(calls[1].url.searchParams.get('branchId'),id);
 const body=adjustmentPayload(id,5,{...emptyStock,note:'Reason'}),key='fixed-stock-save-key-123';await client.saveStock('adjust',body,key);await client.saveStock('adjust',body,key);assert.equal(calls[2].options.headers['Idempotency-Key'],key);assert.equal(calls[2].options.body,calls[3].options.body);client.dispose();
});
