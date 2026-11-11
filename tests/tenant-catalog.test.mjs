import test from 'node:test';import assert from 'node:assert/strict';
import {validCatalogMedicine,validInventoryStock,validCatalogPage} from '../src/features/shops/catalog-contract.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
const id='11111111-1111-4111-8111-111111111111';
const stock={id:'s',tenantId:'a',branchId:id,quantity:2,batchNumber:'A',unit:'Pcs',mrp:'20.00',expiryDate:'2030-01-01T00:00:00Z'};
const medicine={id:'m',tenantId:'a',name:'Medicine',unit:'Pcs',salePrice:'15.00',isActive:true,stocks:[stock]};
test('catalog rejects foreign medicine, nested stocks and wrong branch before rendering',()=>{
 assert.equal(validCatalogMedicine(medicine,'a',id),true);
 for(const row of [{...medicine,tenantId:'b'},{...medicine,stocks:[{...stock,tenantId:'b'}]},{...medicine,stocks:[{...stock,branchId:'other'}]},{...medicine,salePrice:'NaN'}])assert.equal(validCatalogMedicine(row,'a',id),false);
 const inventory={...stock,medicine:{id:'m',tenantId:'a',name:'Medicine'},branch:{id,tenantId:'a',name:'Main'}};
 assert.equal(validInventoryStock(inventory,'a',id),true);assert.equal(validInventoryStock({...inventory,medicine:{...inventory.medicine,tenantId:'b'}},'a',id),false);
});
test('server pagination must match the requested page and bounded backend metadata',()=>{
 const value={data:[medicine],meta:{page:1,pageSize:20,totalItems:21,totalPages:2,hasNextPage:true,hasPreviousPage:false}};
 const validate=row=>validCatalogMedicine(row,'a',id);
 assert.equal(validCatalogPage(value,1,validate),true);assert.equal(validCatalogPage(value,2,validate),false);
 for(const patch of [{pageSize:1000},{totalPages:1},{hasNextPage:false}])assert.equal(validCatalogPage({...value,meta:{...value.meta,...patch}},1,validate),false);
});
test('resource transport keeps metadata, fixes branch identity and rejects caller scope overrides',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url)=>{calls.push(new URL(url,'http://fixture'));return Response.json({success:true,data:[],meta:{page:2}});});
 const result=await client.medicines(id,2,{search:'A&B',hasStock:'false',isActive:'true'});
 assert.equal(result.meta.page,2);assert.equal(calls[0].pathname,'/api/backend/tenant-workspace/a/pharmacy/medicines');assert.equal(calls[0].searchParams.get('branchId'),id);assert.equal(calls[0].searchParams.get('search'),'A&B');
 assert.throws(()=>client.stocks(id,1,{branchId:'foreign'}));assert.throws(()=>client.medicines(id,1,{tenantId:'b'}));assert.throws(()=>client.stocks(id,0));client.dispose();
});
test('resource proxy explicitly permits only fixed list/detail GET routes',()=>{
 const config={session:'true',workspace:'true',base:'http://localhost:9999/api/v1'};
 for(const path of [['pharmacy','medicines'],['pharmacy','stocks'],['pharmacy','medicines',id]])assert.ok(tenantWorkspaceTarget('a',path,'GET',config));
 for(const path of [['pharmacy','stocks','adjust'],['pharmacy','medicines','import'],['pharmacy','stocks','history','export']])assert.equal(tenantWorkspaceTarget('a',path,'GET',config),null);
 assert.equal(tenantWorkspaceTarget('a',['pharmacy','medicines'],'POST',config),null);
});
