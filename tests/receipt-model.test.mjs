import assert from 'node:assert/strict';import test from 'node:test';
import {receiptNumber,receiptLineTotal,savedReceipt,consistentTender,receiptSettlement} from '../src/features/receipts/receipt-model.ts';
const sale={id:'s1',invoiceNumber:'INV-1',status:'completed',createdAt:'2026-11-01T05:00:00Z',totalPrice:'100',netPrice:'80',paidAmount:'30',dueAmount:'50',discountAmount:'10',taxAmount:'0',saleItems:[{id:'i1',itemName:'Medicine',price:'100',quantity:1,unit:'Pcs',totalPrice:'90',discountAmount:'10',batchNumber:'B1'}]};
test('receipt money preserves saved zero and keeps missing/invalid amounts unknown',()=>{assert.equal(receiptNumber('0.00'),0);for(const value of [null,undefined,'',' ',false,{},NaN,'bad',-1])assert.equal(receiptNumber(value),null);const model=savedReceipt({...sale,netPrice:0,paidAmount:0,dueAmount:0});assert.equal(model.total,0);assert.equal(model.paid,0);assert.equal(model.due,0);});
test('line totals prefer saved values including zero and derive only with known numeric values',()=>{assert.equal(receiptLineTotal({price:50,quantity:2,totalPrice:0}),0);assert.equal(receiptLineTotal({price:'10.50',quantity:'1.5',discountAmount:'.25'}),15.5);assert.equal(receiptLineTotal({price:null,quantity:1}),null);});
test('saved receipt uses authoritative totals rather than rebuilding sale discounts or due',()=>{const model=savedReceipt(sale);assert.equal(model.subtotal,100);assert.equal(model.itemDiscount,10);assert.equal(model.saleDiscount,10);assert.equal(model.total,80);assert.equal(model.due,50);assert.equal(model.items[0].batch,'B1');assert.equal(model.tendered,undefined);assert.equal(model.change,undefined);});
test('reprints deduplicate payments and distinguish actual refunds from unrelated expenses',()=>{const payment={id:'t1',flowType:'in',txnType:'sale',amount:'30',paymentMethod:'cash'},refund={id:'r1',flowType:'out',txnType:'sale-return',amount:'5'};const model=savedReceipt({...sale,transactions:[payment,payment,refund,{id:'commission',flowType:'out',txnType:'referral',amount:10}]});assert.equal(model.payments.length,1);assert.equal(model.refunds.length,1);assert.equal(model.refunds[0].amount,5);assert.equal(model.paid,30);assert.equal(consistentTender(model),false);});
test('cash tender/change is shown only when known and consistent with saved paid total',()=>{const receipt={paid:70,payments:[{method:'cash',amount:50},{method:'card',amount:20}],tendered:100,change:30};assert.equal(consistentTender(receipt),true);assert.equal(consistentTender({...receipt,paid:0}),false);assert.equal(consistentTender({...receipt,reprint:true}),false);assert.equal(consistentTender({...receipt,tendered:null}),false);});

test('receipt debt indicator uses saved balances and distinguishes partial, due, pending and unknown',()=>{
 assert.equal(receiptSettlement({status:'completed',paid:50,due:25}),'partial');
 assert.equal(receiptSettlement({status:'completed',paid:0,due:25}),'due');
 assert.equal(receiptSettlement({status:'completed',paid:25,due:0}),'paid');
 assert.equal(receiptSettlement({status:'pending',paid:0,due:25}),'pending');
 assert.equal(receiptSettlement({status:'completed',paid:null,due:null}),'unknown');
 assert.equal(receiptSettlement({status:'returned',paid:0,due:0}),'paid');
});
