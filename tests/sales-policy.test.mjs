import assert from 'node:assert/strict';
import test from 'node:test';
import { duePaymentError, priorReturnQuantities, returnItemKey, returnQuantityError, lineReturnLimit, saleFilterError, hasReturnHistoryList } from '../src/features/sales/sales-policy.ts';
const line=(id,quantity=3,batchNumber='BATCH-A')=>({id,medicineId:'med-a',itemName:'Medicine',batchNumber,quantity});
test('due collection accepts cents and blocks invalid, zero, excessive and rejected payments',()=>{
 const sale={status:'completed',dueAmount:'25.50'};
 assert.equal(duePaymentError(sale,'25.50','cash'), '');
 for(const value of ['0','-1','Infinity','1e2','25.51','1.005'])assert.ok(duePaymentError(sale,value,'cash'));
 assert.ok(duePaymentError(sale,'1',''));assert.ok(duePaymentError({...sale,status:'rejected'},'1','cash'));
 assert.ok(duePaymentError({...sale,dueAmount:null},'1','cash'));
});
test('pending and completed returns reserve allowance; rejected returns do not',()=>{
 const history=[{id:'pending',status:'pending',saleReturnItems:[line('r1',1)]},{id:'completed',status:'completed',saleReturnItems:[line('r2',1)]},{id:'rejected',status:'rejected',saleReturnItems:[line('r3',99)]}];
 const totals=priorReturnQuantities(history);assert.equal(totals[returnItemKey(line('x'))],2);
 assert.equal(priorReturnQuantities(history,'pending')[returnItemKey(line('x'))],1);
});
test('same-batch duplicate lines share one remaining quantity and retain per-line bounds',()=>{
 const original=[line('a',2),line('b',2)];const previous={[returnItemKey(original[0])]:1};
 assert.equal(lineReturnLimit(original[1],original,previous,{a:2}),1);
 assert.ok(returnQuantityError(original,[line('a',2),line('b',2)],previous,true));
 assert.equal(returnQuantityError(original,[line('a',2),line('b',1)],previous,true),'');
 assert.ok(returnQuantityError(original,[line('a',3)],{},true));
});
test('batch and medicine identities prevent returning stock from a different batch',()=>{
 assert.ok(returnQuantityError([line('a')],[line('a',1,'OTHER')],{}));
 const service={id:'s',serviceId:'med-a',itemName:'Service',batchNumber:'BATCH-A',quantity:1};
 assert.notEqual(returnItemKey(service),returnItemKey(line('a')));
});
test('medicine quantities are whole units; service quantities may have two decimal places',()=>{
 assert.ok(returnQuantityError([line('a')],[line('a',.5)],{}));
 const service={id:'s',serviceId:'service-a',itemName:'Service',quantity:1};
 assert.equal(returnQuantityError([service],[{...service,quantity:.25}],{},true),'');
 assert.ok(returnQuantityError([service],[{...service,quantity:.001}],{},true));
});
test('invalid return history fails closed instead of granting extra allowance',()=>{
 assert.throws(()=>priorReturnQuantities([{id:'bad',status:'pending',saleReturnItems:[line('a','bad')]}]));
 assert.throws(()=>priorReturnQuantities([{id:'missing',status:'pending'}]));
 assert.equal(hasReturnHistoryList({data:{data:[],pagination:{total:0}}}),true);
 assert.equal(hasReturnHistoryList({success:true,data:{}}),false);
 assert.ok(returnQuantityError([line('a')],[],{}));
});
test('sales filters reject reversed dates and negative/reversed amount limits',()=>{
 assert.ok(saleFilterError('2026-11-02','2026-11-01','',''));
 assert.ok(saleFilterError('','','-1','10'));assert.ok(saleFilterError('','','20','10'));
 assert.equal(saleFilterError('2026-11-01','','0','10'),'');
});
