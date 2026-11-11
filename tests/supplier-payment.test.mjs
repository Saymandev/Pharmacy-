import test from 'node:test';import assert from 'node:assert/strict';
import {validPaymentAccount,validSupplierPayment,supplierPaymentPayload,validSupplierPaymentResult} from '../src/features/shops/purchase-payment-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111',branch='22222222-2222-4222-8222-222222222222',accountId='33333333-3333-4333-8333-333333333333';
const before={id,tenantId:'a',branchId:branch,supplierId:id,poNumber:'PUR',type:'pharmacy',status:'completed',paymentStatus:'due',totalPrice:'20',discountAmount:'0',paidAmount:'0',dueAmount:'20',createdAt:'2026-11-11T04:00:00Z',purchaseItems:[{id,tenantId:'a',purchaseId:id,medicineId:id,itemName:'Medicine',unit:'Pcs',batchNumber:'B',expiryDate:'2030-01-01T00:00:00Z',quantity:2,price:'10',totalPrice:'20'}],transactions:[]};
const account={id:accountId,tenantId:'a',name:'Bank',type:'bank',group:null},body={accountId,amount:10,paymentMethod:'card',note:'Supplier settlement'};
test('payment account projection rejects foreign scope, wrong method type and balance snapshots',()=>{
 assert.equal(validPaymentAccount(account,'a','bank'),true);for(const row of [{...account,tenantId:'b'},{...account,type:'cash'},{...account,currentBalance:1000}])assert.equal(validPaymentAccount(row,'a','bank'),false);
 assert.deepEqual(supplierPaymentPayload(before,account,'10','card','Supplier settlement'),body);
 for(const amount of ['0','20.01','1.001','-1'])assert.throws(()=>supplierPaymentPayload(before,account,amount,'card',''));
 assert.throws(()=>supplierPaymentPayload({...before,status:'pending'},account,'1','card',''));assert.throws(()=>supplierPaymentPayload(before,account,'1','cash',''));
 for(const patch of [{tenantId:'b'},{branchId:branch},{amount:0},{paymentMethod:'other'},{note:'x'.repeat(2001)}])assert.equal(validSupplierPayment({...body,...patch}),false);
});
test('payment response requires a new matching journal entry and correct scoped purchase totals',()=>{
 const transaction={id:branch,txnId:'PAY-1',accountId,amount:'10',flowType:'out',paymentMethod:'card',createdAt:'2026-11-11T05:00:00Z'};
 const result={...before,paidAmount:'10',dueAmount:'10',paymentStatus:'partial',transactions:[transaction]};assert.equal(validSupplierPaymentResult(result,before,body),true);
 for(const value of [{...result,tenantId:'b'},{...result,dueAmount:15},{...result,transactions:[]},{...result,transactions:[{...transaction,accountId:id}]},{...result,transactions:[{...transaction,flowType:'in'}]},{...result,paymentStatus:'paid'}])assert.equal(validSupplierPaymentResult(value,before,body),false);
 assert.equal(validSupplierPaymentResult(result,{...before,transactions:[transaction]},body),false);
 assert.equal(validSupplierPaymentResult({...result,paidAmount:20,dueAmount:0,paymentStatus:'paid',transactions:[transaction,{...transaction,id:accountId,txnId:'PAY-2'}]},before,body),true,'concurrent legitimate same-amount payments remain valid; exactly-once is enforced by backend keys');
});
test('proxy permits only scoped payment-options GET and keyed purchase payment POST',async()=>{
 const config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};assert.ok(tenantWorkspaceTarget('a',['finance','accounts','payment-options'],'GET',config));assert.equal(tenantWorkspaceTarget('a',['finance','accounts'],'GET',config),null);assert.ok(tenantWorkspaceTarget('a',['pharmacy','purchases',id,'payments'],'POST',config));assert.equal(tenantWorkspaceTarget('a',['pharmacy','purchases',id,'payments'],'POST',{...config,writes:'false'}),null);
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url:new URL(url,'http://fixture'),options});return Response.json({success:true,data:[]});});await client.paymentAccounts(branch,2,'Bank & safe','bank');assert.equal(calls[0].url.searchParams.get('branchId'),branch);assert.equal(calls[0].url.searchParams.get('type'),'bank');await client.payPurchase(id,body,'purchase-pay-key-1234');await client.payPurchase(id,body,'purchase-pay-key-1234');assert.equal(calls[1].options.body,calls[2].options.body);assert.equal(calls[1].options.headers['Idempotency-Key'],calls[2].options.headers['Idempotency-Key']);client.dispose();await assert.rejects(client.payPurchase(id,body,'purchase-pay-key-1234'));
});
