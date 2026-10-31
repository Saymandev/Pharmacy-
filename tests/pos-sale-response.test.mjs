import assert from 'node:assert/strict';
import test from 'node:test';
import { unwrapSavedSale, savedAmount } from '../src/features/pos/sale-response.ts';
test('sale create contract unwraps data.sale while detail responses stay direct',()=>{
 const sale={id:'sale-1',invoiceNumber:'SALE-001',netPrice:'75.50',paidAmount:'75.50',dueAmount:'0.00'};
 assert.equal(unwrapSavedSale({sale}),sale);
 assert.equal(unwrapSavedSale({success:true,data:{sale}}),sale);
 assert.equal(unwrapSavedSale(sale),sale);
 assert.equal(savedAmount(sale.dueAmount,99),0);
});
test('missing sale records cannot masquerade as a saved invoice',()=>{
 for(const value of [null,[],{sale:null},{success:true,data:{}},{id:''}])assert.equal(unwrapSavedSale(value),null);
 assert.equal(savedAmount(undefined,10),10);assert.equal(savedAmount('bad',10),10);
});
