import test from 'node:test';import assert from 'node:assert/strict';
import {validPurchaseBody,purchaseTotals,validPurchaseResult} from '../src/features/shops/purchase-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111',supplierId='22222222-2222-4222-8222-222222222222';
const body={branchId:id,supplierId,type:'pharmacy',status:'pending',discountAmount:0.1,payments:[],note:'Delivery',purchaseItems:[{medicineId:id,unit:'Pcs',price:0.3,salePrice:1,mrp:2,quantity:3,batchNumber:'Batch',expiryDate:'2030-01-01T00:00:00.000Z',rackNumber:'',discountAmount:0.1}]};
test('purchase totals use exact cents, bounded quantity and unique medicine/batch tuples',()=>{
 assert.equal(validPurchaseBody(body),true);assert.deepEqual(purchaseTotals(body),{subtotal:0.8,discount:0.1,net:0.7});
 for(const value of [{...body,tenantId:'b'},{...body,payments:[{amount:0.1}]},{...body,discountAmount:0.8},{...body,purchaseItems:[...body.purchaseItems,...body.purchaseItems]},{...body,purchaseItems:[{...body.purchaseItems[0],quantity:1.5}]},{...body,purchaseItems:[{...body.purchaseItems[0],quantity:2147483647,price:99999999.99}]},{...body,purchaseItems:[{...body.purchaseItems[0],stockId:id}]},{...body,status:'rejected'}])assert.equal(validPurchaseBody(value),false);
});
test('saved purchase must match complete shop/branch/supplier and line tuples plus exact due totals',()=>{
 const result={id,tenantId:'a',branchId:id,supplierId,status:'pending',poNumber:'PUR-1',totalPrice:'0.8',discountAmount:'0.1',dueAmount:'0.7',paidAmount:'0',paymentStatus:'due',purchaseItems:body.purchaseItems.map(line=>({...line,purchaseId:id,tenantId:'a'}))};
 assert.equal(validPurchaseResult(result,'a',body),true);for(const value of [{...result,tenantId:'b'},{...result,branchId:supplierId},{...result,dueAmount:0.8},{...result,purchaseItems:[{...result.purchaseItems[0],tenantId:'b'}]},{...result,purchaseItems:[{...result.purchaseItems[0],quantity:5}]}])assert.equal(validPurchaseResult(value,'a',body),false);
});
test('purchase proxy allows only gated creation; retry body/key and route tenant stay fixed',async()=>{
 const config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};assert.ok(tenantWorkspaceTarget('a',['pharmacy','purchases'],'POST',config));assert.equal(tenantWorkspaceTarget('a',['pharmacy','purchases'],'POST',{...config,writes:'false'}),null);assert.equal(tenantWorkspaceTarget('a',['pharmacy','purchases',id],'PATCH',config),null);
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{}});});await client.createPurchase(body,'purchase-fixture-key-123');await client.createPurchase(body,'purchase-fixture-key-123');assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.headers['Idempotency-Key'],calls[1].options.headers['Idempotency-Key']);assert.match(calls[0].url,/tenant-workspace\/a\/pharmacy\/purchases$/);client.dispose();await assert.rejects(client.createPurchase(body,'purchase-fixture-key-123'));
});
