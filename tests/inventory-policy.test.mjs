import assert from 'node:assert/strict';import test from 'node:test';
import {expiryDays,stockFlags,stockOperationError,positivePrice,positiveQuantity} from '../src/features/catalog/inventory-policy.ts';
const now=new Date('2026-10-31T19:00:00Z');
const stock=(id='s1',quantity=5,expiryDate='2030-01-01')=>({id,medicineId:'med-a',branchId:'branch-a',batchNumber:'A',quantity,expiryDate});
const form={medicineId:'med-a',stockId:'s1',toBranchId:'branch-b',quantity:'2',type:'decrease',batchNumber:'A',expiryDate:'2030-01-01',unitPrice:'10.50',mrp:'20.00',recoverAmount:'',accountId:'',note:''};
test('expiry uses inclusive Dhaka calendar days and rejects invalid dates',()=>{assert.equal(expiryDays('2026-11-01T00:00:00Z',now),0);assert.equal(expiryDays('2026-10-31',now),-1);assert.equal(expiryDays('2026-02-30',now),null);});
test('low stock uses combined usable medicine stock in the branch, not an individual batch',()=>{
 const a=stock(),b={...stock('s2'),batchNumber:'B'},expired={...stock('old',100,'2020-01-01')},other={...stock('other',500),branchId:'branch-b'};
 const flags=stockFlags(a,{reorderLevel:6,stocks:[a,b,expired,other]},now);assert.equal(flags.usable,10);assert.equal(flags.low,false);
 assert.equal(stockFlags(a,{reorderLevel:10,stocks:[a,b]},now).low,true);
});
test('missing optional metadata remains unknown and a newly observed batch is still counted',()=>{
 assert.equal(stockFlags(stock(),undefined,now).state,'unknown');assert.equal(stockFlags(stock(),{reorderLevel:0,stocks:[]},now).usable,5);
 const expired=stockFlags(stock('old',2,'2020-01-01'),{reorderLevel:5,stocks:[stock('old',2,'2020-01-01')]},now);assert.equal(expired.expired,true);assert.equal(expired.low,true);
});
test('quantity and prices reject fractions, NaN, infinity, blanks and out-of-range counts',()=>{
 for(const value of ['0','-1','.5','1.5','Infinity','2147483648',''])assert.equal(positiveQuantity(value),null);
 assert.equal(positiveQuantity('2'),2);for(const value of ['','0','NaN','Infinity','1.001','100000000'])assert.equal(positivePrice(value),null);assert.equal(positivePrice('10.50'),10.5);
});
test('stock decrease and transfer revalidate available quantity and operation branch',()=>{
 assert.equal(stockOperationError('adjust',form,'branch-a','branch-a',stock()),'');
 assert.ok(stockOperationError('adjust',form,'branch-a','branch-a',stock('s1',1)));
 assert.equal(stockOperationError('adjust',form,'branch-a','branch-a',stock('s1',0),false),'');
 assert.ok(stockOperationError('transfer',{...form,toBranchId:'branch-a'},'branch-a','branch-a',stock()));
 assert.ok(stockOperationError('transfer',form,'branch-a','branch-b',stock()));
 assert.ok(stockOperationError('adjust',{...form,stockId:'s2'},'branch-a','branch-a',stock()));
});
test('opening stock requires complete fields and recovery requires a decrease/account',()=>{
 assert.equal(stockOperationError('opening',form,'branch-a','branch-a'),'');
 assert.ok(stockOperationError('opening',{...form,mrp:'Infinity'},'branch-a','branch-a'));
 assert.ok(stockOperationError('adjust',{...form,recoverAmount:'5'},'branch-a','branch-a',stock()));
 assert.ok(stockOperationError('adjust',{...form,type:'increase',recoverAmount:'5',accountId:'cash'},'branch-a','branch-a',stock()));
 assert.equal(stockOperationError('adjust',{...form,recoverAmount:'5',accountId:'cash'},'branch-a','branch-a',stock()),'');
});
