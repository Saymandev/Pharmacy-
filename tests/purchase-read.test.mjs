import test from 'node:test';import assert from 'node:assert/strict';
import {validPurchaseRecord,validPurchaseDetail,validPurchaseStatusBody} from '../src/features/shops/purchase-read-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111',branch='22222222-2222-4222-8222-222222222222';
const row={id,tenantId:'a',branchId:branch,supplierId:id,poNumber:'PUR-1',type:'pharmacy',status:'pending',paymentStatus:'due',totalPrice:'20',discountAmount:'0',paidAmount:'0',dueAmount:'20',createdAt:'2026-11-11T04:00:00Z'};
const detail={...row,purchaseItems:[{id,tenantId:'a',purchaseId:id,medicineId:id,itemName:'Medicine',batchNumber:'B',expiryDate:'2030-01-01T00:00:00Z',unit:'Pcs',quantity:2,price:'10',totalPrice:'20'}]};
test('list and details reject foreign scope, bad amounts and mismatched nested ownership',()=>{
 assert.equal(validPurchaseRecord(row,'a',branch),true);assert.equal(validPurchaseDetail(detail,'a',branch),true);
 for(const value of [{...row,tenantId:'b'},{...row,branchId:id},{...row,dueAmount:-1},{...row,status:'unknown'}])assert.equal(validPurchaseRecord(value,'a',branch),false);
 for(const items of [[],[detail.purchaseItems[0],detail.purchaseItems[0]],[{...detail.purchaseItems[0],tenantId:'b'}],[{...detail.purchaseItems[0],purchaseId:branch}],[{...detail.purchaseItems[0],quantity:0}]])assert.equal(validPurchaseDetail({...detail,purchaseItems:items},'a',branch),false);
});
test('status proxy only permits explicit final transitions behind the write gate',()=>{
 const config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};assert.ok(tenantWorkspaceTarget('a',['pharmacy','purchases'],'GET',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','purchases',id],'GET',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','purchases',id,'status'],'PATCH',config));assert.equal(tenantWorkspaceTarget('a',['pharmacy','purchases',id,'status'],'PATCH',{...config,writes:'false'}),null);
 for(const body of [{status:'pending'},{status:'completed',branchId:branch},{status:'rejected',note:'x'.repeat(2001)},{status:'completed',payments:[]}])assert.equal(validPurchaseStatusBody(body),false);assert.equal(validPurchaseStatusBody({status:'completed',note:'Verified'}),true);
});
test('list binds branch and server filters; final status retries preserve the key and body',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url:new URL(url,'http://fixture'),options});return Response.json({success:true,data:[]});});
 await client.purchases(branch,2,{status:'pending',startDate:'2026-11-01',endDate:'2026-11-30',supplierId:id,minAmount:'10',maxAmount:'100'});assert.equal(calls[0].url.searchParams.get('branchId'),branch);assert.equal(calls[0].url.searchParams.get('page'),'2');assert.equal(calls[0].url.searchParams.get('supplierId'),id);assert.throws(()=>client.purchases(branch,1,{branchId:id}));
 const body={status:'completed',note:'Verified'},key='purchase-status-key-123';await client.purchaseStatus(id,body,key);await client.purchaseStatus(id,body,key);assert.equal(calls[1].options.body,calls[2].options.body);assert.equal(calls[1].options.headers['Idempotency-Key'],key);client.dispose();await assert.rejects(client.purchaseStatus(id,body,key));
});
