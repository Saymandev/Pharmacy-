import assert from 'node:assert/strict';import test from 'node:test';
import {medicinePayload,emptyMedicine,editMedicineDraft,validReference} from '../src/features/shops/medicine-form-policy.ts';
import {tenantWorkspaceTarget,validMedicineProxyBody} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='44444444-4444-4444-8444-444444444444',ref='55555555-5555-4555-8555-555555555555';
test('medicine form rejects invalid money/quantity/IDs and never adds ownership or stock mutations',()=>{
 const draft={...emptyMedicine,name:'  Medicine  ',salePrice:'20.25',categoryId:ref};const body=medicinePayload(draft);assert.equal(body.name,'Medicine');assert.equal(body.salePrice,20.25);assert.equal(body.categoryId,ref);assert.equal(body.barcode,null);
 for(const patch of [{name:' '},{salePrice:'-1'},{purchasePrice:'1e2'},{mrp:'10.001'},{reorderLevel:'1.5'},{categoryId:'foreign'}])assert.throws(()=>medicinePayload({...draft,...patch}));
 assert.ok(!('tenantId'in body));assert.ok(!('branchId'in body));assert.ok(!('openingStock'in body));
});
test('edit form requires complete owned server fields and a fresh version, preserving null and zero',()=>{
 const row={...medicinePayload({...emptyMedicine,name:'Medicine'}),id,tenantId:'a',updatedAt:'2026-11-10T00:00:00.000Z'};
 assert.equal(editMedicineDraft(row,'a').draft.salePrice,'0');assert.equal(editMedicineDraft(row,'a').draft.barcode,'');
 for(const value of [{...row,tenantId:'b'},{...row,updatedAt:null},{...row,purchasePrice:undefined},{...row,categoryId:ref,category:{id:ref,tenantId:'b',name:'Foreign'}}])assert.throws(()=>editMedicineDraft(value,'a'));
 assert.equal(validReference({id:ref,tenantId:'b',name:'B'},'a'),false);
});
test('medicine writes need a third gate and the proxy excludes stock/identity fields',()=>{
 const config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};
 assert.ok(tenantWorkspaceTarget('a',['pharmacy','medicines'],'POST',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','medicines',id],'PATCH',config));
 assert.equal(tenantWorkspaceTarget('a',['pharmacy','medicines'],'POST',{...config,writes:'false'}),null);
 assert.equal(tenantWorkspaceTarget('a',['pharmacy','stocks'],'POST',config),null);
 assert.equal(validMedicineProxyBody({name:'A',openingStock:1},'POST'),false);assert.equal(validMedicineProxyBody({name:'A',tenantId:'b'},'POST'),false);assert.equal(validMedicineProxyBody({name:'A',expectedUpdatedAt:'today'},'POST'),false);assert.equal(validMedicineProxyBody({name:'A'},'PATCH'),false);assert.equal(validMedicineProxyBody({name:'A',expectedUpdatedAt:'2026-11-10T00:00:00.000Z'},'PATCH'),true);
});
test('write transport preserves exact key/body for caller retries and exposes API validation errors',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{id,tenantId:'a'}});});
 const key='fixed-request-key-1234',body={name:'A'};await client.saveMedicine(null,body,key);await client.saveMedicine(null,body,key);
 assert.equal(calls[0].options.method,'POST');assert.equal(calls[0].options.headers['Idempotency-Key'],key);assert.equal(calls[1].options.body,calls[0].options.body);client.dispose();
 const invalid=createWorkspaceClient('a',new AbortController().signal,async()=>Response.json({success:false,message:'Validation failed',errors:[{message:'Name is required'}]},{status:422}));
 await assert.rejects(invalid.saveMedicine(id,{},key),error=>error.status===422&&error.message.includes('Name is required'));invalid.dispose();
});
