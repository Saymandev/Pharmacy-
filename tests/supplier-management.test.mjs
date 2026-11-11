import test from 'node:test';import assert from 'node:assert/strict';
import {tenantWorkspaceTarget,validSupplierBody} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111',config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};
test('supplier proxy permits bounded owned paths and scalar fields only',()=>{
 assert.ok(tenantWorkspaceTarget('a',['pharmacy','suppliers'],'GET',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','suppliers'],'POST',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','suppliers',id],'DELETE',config));assert.equal(tenantWorkspaceTarget('a',['pharmacy','suppliers'],'POST',{...config,writes:'false'}),null);assert.equal(tenantWorkspaceTarget('a',['pharmacy','suppliers','foreign'],'PATCH',config),null);
 const body={name:'Supplier',address:'Dhaka',phone:'00123',email:'test@example.com'};assert.equal(validSupplierBody(body,'POST'),true);for(const patch of [{tenantId:'b'},{branchId:id},{phone:''},{address:'x'.repeat(501)},{email:'invalid'},{openingBalance:100}])assert.equal(validSupplierBody({...body,...patch},'POST'),false);assert.equal(validSupplierBody({},'DELETE'),true);
});
test('supplier create retry preserves its exact key and body within selected tenant',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{}});});const body={name:'Supplier',address:'Dhaka',phone:'00123'},key='supplier-key-fixture-123';await client.saveSupplier(null,body,key);await client.saveSupplier(null,body,key);assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.headers['Idempotency-Key'],key);assert.match(calls[0].url,/tenant-workspace\/a\/pharmacy\/suppliers$/);await client.suppliers(2,'Name & phone');assert.match(calls[2].url,/page=2/);client.dispose();await assert.rejects(client.saveSupplier(null,body,key));
});
