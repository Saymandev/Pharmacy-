import assert from 'node:assert/strict';
import test from 'node:test';
import { allocatePayments } from '../src/features/pos/payment-allocation.ts';
const tender = (amount, paymentMethod='cash',accountId='cash-account')=>({amount,paymentMethod,accountId});
test('cash tender records only the sale amount and returns change',()=>{
 const r=allocatePayments(75.5,[tender('100')]);
 assert.equal(r.change,24.5);assert.equal(r.paid,75.5);assert.equal(r.due,0);assert.equal(r.payments[0].amount,75.5);
});
test('split tender preserves non-cash amount and deducts change from cash only',()=>{
 const r=allocatePayments(100,[tender('100'),tender('40','card','bank')]);
 assert.equal(r.change,40);assert.deepEqual(r.payments.map(p=>p.amount),[60,40]);
});
test('partial payment, unpaid sale and default exact tender',()=>{
 assert.equal(allocatePayments(100,[tender('30')]).due,70);
 assert.equal(allocatePayments(100,[tender('0')]).payments.length,0);
 assert.equal(allocatePayments(100,[tender('')]).paid,100);
});
test('invalid and non-cash overpayments are rejected',()=>{
 for(const value of ['-1','abc','Infinity'])assert.throws(()=>allocatePayments(100,[tender(value)]));
 assert.throws(()=>allocatePayments(100,[tender('101','card')]));
});
test('decimal tender is reconciled in cents across cash accounts',()=>{
 const r=allocatePayments(.3,[tender('.1'),tender('.3','cash','second')]);
 assert.equal(r.change,.1);assert.equal(r.paid,.3);assert.deepEqual(r.payments.map(p=>p.amount),[.1,.2]);
});
