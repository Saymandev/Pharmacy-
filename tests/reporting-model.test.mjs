import assert from 'node:assert/strict';
import test from 'node:test';
import { buildReportModel, formatReportValue, reportCsv, reportDateRange, reportDateError } from '../src/features/reports/report-model.ts';

test('overview keeps every summary amount including zero, Decimal strings and losses',()=>{
 const summary=Object.fromEntries(Array.from({length:10},(_,i)=>[`totalMetric${i}`,i]));summary.netProfit='-125.50';summary.totalPaid='0.00';
 const model=buildReportModel({summary});
 assert.equal(model.metrics.length,12);assert.equal(model.metrics.find(x=>x.key==='netProfit').value,-125.5);
 assert.equal(model.metrics.find(x=>x.key==='totalPaid').value,0);
 assert.match(reportCsv(model,{Branch:'Main'}),/Net profit/);
});
test('pharmacy summary keeps count fields distinct from monetary fields',()=>{
 const model=buildReportModel({sales:{totalAmount:'1000.50',count:4},returns:{saleReturnCount:2},netProfit:-10});
 assert.equal(model.metrics.length,4);
 assert.doesNotMatch(formatReportValue('sales.count',4),/BDT|৳/);
 assert.match(formatReportValue('sales.totalAmount','1000.50'),/1,000.50/);
 assert.equal(formatReportValue('patientNumber','00123'),'00123');
 for(const key of ['totalTax','totalPayment','totalCollected'])assert.match(formatReportValue(key,'100.50'),/100.50/);
 for(const key of ['totalTax','totalPayment','totalCollected'])assert.match(formatReportValue(key,'100.50'),/BDT|৳/);
 assert.equal(formatReportValue('paymentMethod','cash'),'cash');
});
test('grouped income and expense extract actual rows and named group subtotals',()=>{
 const data={summary:{totalCollection:100},groups:[{type:'hospital',subTotals:{netAmount:100},sales:[{invoiceNumber:'INV-001',netAmount:100}]},{category:'Utilities',subTotals:{amount:30},expenses:[{expenseNumber:'EX-001',amount:'30.00'}]}]};
 const model=buildReportModel(data);assert.equal(model.tables.length,2);
 assert.equal(model.tables[0].rows[0].invoiceNumber,'INV-001');assert.match(model.tables[0].name,/Hospital/);
 assert.equal(model.tables[0].totals[0].value,100);assert.equal(model.tables[1].rows[0].expenseNumber,'EX-001');
});
test('sales tables retain every row and column, plus indoor/outdoor return subtotals',()=>{
 const rows=Array.from({length:105},(_,i)=>({slNo:i+1,invoiceNumber:`INV-${i}`,patientNumber:'001',totalPrice:10,discountAmount:1,taxAmount:0,netAmount:9,paid:9,due:0,createdBy:'Cashier',createdAt:'2026-10-31T19:00:00Z'}));
 const model=buildReportModel({outdoor:{sales:rows,returns:[{invoiceNumber:'RET-1',totalReturn:2}],subTotals:{netAmount:945,totalReturn:2}},summary:{totalCollection:943}});
 assert.equal(model.tables[0].rows.length,105);assert.equal(model.tables[0].columns.length,11);
 assert.equal(model.tables.length,2);assert.equal(model.tables[0].totals.length,2);
 const csv=reportCsv(model,{});assert.match(csv,/INV-104/);assert.match(csv,/Created by|createdBy/);
});
test('CSV has filter context, quote escaping, numeric loss values and formula protection',()=>{
 const model=buildReportModel({summary:{netProfit:-5},invoices:[{invoiceNumber:'=CMD()',patientName:'A,"B"',netCollection:'-5.00'}]});
 const csv=reportCsv(model,{Branch:'Dhaka',From:'2026-11-01',To:'2026-11-01'});
 assert.ok(csv.startsWith('\uFEFF'));assert.match(csv,/Dhaka/);assert.match(csv,/'=CMD\(\)/);assert.match(csv,/A,""B""/);assert.match(csv,/"-5"/);assert.doesNotMatch(csv,/'-5/);
});
test('date presets use Dhaka midnight, inclusive seven days and correct last-month boundaries',()=>{
 const now=new Date('2026-10-31T19:00:00Z');
 assert.deepEqual(reportDateRange('today',now),{startDate:'2026-11-01',endDate:'2026-11-01'});
 assert.deepEqual(reportDateRange('yesterday',now),{startDate:'2026-10-31',endDate:'2026-10-31'});
 assert.deepEqual(reportDateRange('last7',now),{startDate:'2026-10-26',endDate:'2026-11-01'});
 assert.deepEqual(reportDateRange('lastMonth',now),{startDate:'2026-10-01',endDate:'2026-10-31'});
 assert.deepEqual(reportDateRange('lastMonth',new Date('2024-03-01T01:00:00Z')),{startDate:'2024-02-01',endDate:'2024-02-29'});
});
test('partial, reversed and invalid dates are rejected; all-time is explicit',()=>{
 assert.ok(reportDateError('2026-11-02',''));assert.ok(reportDateError('2026-11-02','2026-11-01'));assert.ok(reportDateError('2026-02-30','2026-03-01'));
 assert.equal(reportDateError('',''),'');assert.equal(reportDateError('2026-11-01','2026-11-01'),'');
});


test('settlement and receipt amounts retain explicit labels in screen, CSV and PDF model',()=>{
 const model=buildReportModel({sales:{paidAtEnd:600,dueAtEnd:400},collections:{sameDayCollected:0,previousDayDueCollected:400,totalCollected:400,cashRefunded:0,netCollection:400,advanceApplied:0,outstandingDueAtEnd:0}});
 assert.equal(model.metrics.find(x=>x.key==='sales.paidAtEnd').label,'Sales · Paid at period end');
 assert.equal(model.metrics.find(x=>x.key==='collections.previousDayDueCollected').value,400);
 const csv=reportCsv(model,{});assert.match(csv,/Paid at period end/);assert.match(csv,/Previous-day dues collected/);assert.match(csv,/Advance applied \(no new receipt\)/);
 assert.match(formatReportValue('sales.dueAtEnd',400),/BDT|৳/);
});
