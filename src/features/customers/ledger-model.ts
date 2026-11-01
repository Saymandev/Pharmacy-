export type LedgerTransaction={id:string;txnId?:string;amount:unknown;flowType:string;txnType?:string;saleReturnId?:string|null;paymentMethod?:string;note?:string;createdAt:string};
export type LedgerSale={id:string;invoiceNumber:string;customerId?:string;branchId:string;branch?:{id:string;name:string};createdAt:string;status:string;netPrice:unknown;paidAmount:unknown;dueAmount:unknown;transactions?:LedgerTransaction[]};
export type LedgerReturn={id:string;saleId:string;customerId?:string;branchId:string;invoiceNumber?:string;createdAt:string;status:string;netPrice?:unknown;totalPrice:unknown;transactions?:LedgerTransaction[]};
export type LedgerEntry={id:string;date:string;branchId:string;kind:'Invoice'|'Payment'|'Return'|'Refund';reference:string;invoice:string;status:string;amount:number;method:string;note:string};
const amount=(value:unknown)=>{if(value==null||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<0)throw new Error('History contains an unavailable amount. Refresh before exporting.');return Number(value);};
export const ledgerMoney=(value:number)=>new Intl.NumberFormat('en-BD',{style:'currency',currency:'BDT',maximumFractionDigits:2}).format(value);
export function ledgerDate(value:string){const date=new Date(value);if(!Number.isFinite(date.getTime()))return '';return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function ledgerFilterError(start:string,end:string){for(const date of [start,end])if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))return 'Choose valid statement dates.';return start&&end&&start>end?'Start date must be on or before end date.':'';}
export function ledgerEntries(sales:LedgerSale[],returns:LedgerReturn[]):LedgerEntry[]{
 const entries:LedgerEntry[]=[],seen=new Set<string>();const source=new Map(sales.map(s=>[s.id,s]));
 function transaction(tx:LedgerTransaction,sale:LedgerSale){
  if(seen.has(tx.id))return;seen.add(tx.id);
  const kind=tx.flowType==='in'&&(!tx.txnType||tx.txnType==='sale')?'Payment':tx.flowType==='out'&&(tx.txnType==='sale-return'||tx.saleReturnId)?'Refund':null;if(!kind)return;
  entries.push({id:`txn-${tx.id}`,date:tx.createdAt,branchId:sale.branchId,kind,reference:tx.txnId||tx.id,invoice:sale.invoiceNumber,status:'recorded',amount:amount(tx.amount),method:tx.paymentMethod||'—',note:tx.note||''});
 }
 for(const sale of sales){entries.push({id:`sale-${sale.id}`,date:sale.createdAt,branchId:sale.branchId,kind:'Invoice',reference:sale.invoiceNumber,invoice:sale.invoiceNumber,status:sale.status,amount:amount(sale.netPrice),method:'—',note:''});for(const tx of sale.transactions||[])transaction(tx,sale);}
 for(const ret of returns){const sale=source.get(ret.saleId);if(!sale)throw new Error('A return does not match the customer invoices. Refresh history.');entries.push({id:`return-${ret.id}`,date:ret.createdAt,branchId:ret.branchId,kind:'Return',reference:ret.invoiceNumber||ret.id,invoice:sale.invoiceNumber,status:ret.status,amount:amount(ret.netPrice??ret.totalPrice),method:'—',note:'Return value; cash received is shown separately as Refund.'});for(const tx of ret.transactions||[])transaction(tx,sale);}
 if(entries.some(e=>!ledgerDate(e.date)))throw new Error('History contains an invalid event date. Refresh before exporting.');
 return entries.sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
export function filterLedger(entries:LedgerEntry[],branch:string,start:string,end:string){return entries.filter(e=>(!branch||e.branchId===branch)&&(!start||ledgerDate(e.date)>=start)&&(!end||ledgerDate(e.date)<=end));}
export function ledgerTotals(entries:LedgerEntry[]){const sum=(kind:LedgerEntry['kind'])=>entries.filter(e=>e.kind===kind&&(kind==='Invoice'||kind==='Return'?['completed','returned'].includes(e.status):true)).reduce((n,e)=>n+Math.round(e.amount*100),0)/100;return {invoices:sum('Invoice'),payments:sum('Payment'),returns:sum('Return'),refunds:sum('Refund')};}
export function ledgerCsv(rows:LedgerEntry[],context:string){const cell=(v:string|number)=>'"'+String(v).replace(/^[\s]*[=+@\-]/,"'$&").replace(/"/g,'""')+'"';return '\ufeff'+[[context],['Date (Asia/Dhaka)','Type','Reference','Invoice','Status','Amount (BDT)','Method','Note'],...rows.map(e=>[ledgerDate(e.date),e.kind,e.reference,e.invoice,e.status,e.amount,e.method,e.note])].map(row=>row.map(cell).join(',')).join('\r\n');}
