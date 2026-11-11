import test from 'node:test';import assert from 'node:assert/strict';
import {emptyStock,transferPayload} from '../src/features/shops/stock-form-policy.ts';
import {validStockMovement} from '../src/features/shops/history-contract.ts';
import {tenantWorkspaceTarget,validStockProxyBody} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const source='11111111-1111-4111-8111-111111111111',dest='22222222-2222-4222-8222-222222222222',stockId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
test('transfer requires a different destination, inspected source quantity and a positive bounded amount/reason',()=>{
 const body=transferPayload(stockId,source,dest,5,{...emptyStock,quantity:'2',note:'Branch allocation'});assert.equal(body.expectedQuantity,5);assert.equal(body.toBranchId,dest);assert.equal(body.quantity,2);assert.ok(!('branchId'in body));
 assert.throws(()=>transferPayload(stockId,source,source,5,{...emptyStock,note:'Reason'}));for(const patch of [{quantity:'6'},{quantity:'0'},{quantity:'1.5'},{note:''}])assert.throws(()=>transferPayload(stockId,source,dest,5,{...emptyStock,note:'Reason',...patch}));
});
test('history validates the complete medicine/stock/branch tuple and never treats current stock quantity as movement balance',()=>{
 const row={id:'event',tenantId:'a',branchId:source,stockId,medicineId:'m',quantity:2,type:'out',stockChangeType:'transfer',note:'Reason',targetBranchId:dest,createdAt:'2026-11-10T04:00:00Z',medicine:{id:'m',tenantId:'a',name:'Medicine'},stock:{id:stockId,tenantId:'a',branchId:source,medicineId:'m',batchNumber:'B',unit:'Pcs',quantity:99}};
 assert.equal(validStockMovement(row,'a',source),true);
 for(const value of [{...row,tenantId:'b'},{...row,branchId:dest},{...row,type:'unknown'},{...row,stock:{...row.stock,medicineId:'other'}},{...row,medicine:{...row.medicine,tenantId:'b'}}])assert.equal(validStockMovement(value,'a',source),false);
});
test('proxy adds only history GET and guarded transfer POST; transfer cannot carry ownership/financial data',()=>{
 const config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};
 assert.ok(tenantWorkspaceTarget('a',['pharmacy','stocks','history'],'GET',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','stocks','transfer'],'POST',config));assert.equal(tenantWorkspaceTarget('a',['pharmacy','stocks','history'],'POST',config),null);
 assert.equal(validStockProxyBody({stockId,toBranchId:dest,quantity:1,expectedQuantity:5,note:'Reason'},'transfer'),true);
 for(const body of [{stockId,toBranchId:dest,quantity:1,note:'Reason'},{stockId,toBranchId:dest,quantity:1,expectedQuantity:5,note:'Reason',tenantId:'b'},{stockId,toBranchId:dest,quantity:1,expectedQuantity:5,note:'Reason',accountId:'account'}])assert.equal(validStockProxyBody(body,'transfer'),false);
});
test('history/branch search binds scope, encodes filters, and transfer keeps its retry key',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url:new URL(url,'http://fixture'),options});return Response.json({success:true,data:[],meta:{}});});
 await client.history(source,2,{stockId,type:'out',stockChangeType:'transfer',startDate:'2026-11-01',endDate:'2026-11-10'});assert.equal(calls[0].url.searchParams.get('branchId'),source);assert.equal(calls[0].url.searchParams.get('type'),'out');assert.equal(calls[0].url.searchParams.get('page'),'2');
 await client.bootstrap(undefined,'Rear & safe');assert.equal(calls[1].url.searchParams.get('search'),'Rear & safe');assert.throws(()=>client.history(source,1,{branchId:dest}));
 const body=transferPayload(stockId,source,dest,5,{...emptyStock,note:'Reason'});await client.saveStock('transfer',body,'transfer-key-fixture-123');assert.equal(calls[2].options.headers['Idempotency-Key'],'transfer-key-fixture-123');client.dispose();
});
