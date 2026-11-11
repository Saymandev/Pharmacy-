import {purchaseCents} from './purchase-policy.ts';
import {supplierPaymentMethods} from './purchase-payment-policy.ts';
import {type CatalogMedicine,type CatalogStock} from './catalog-contract.ts';
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export type PosLine={medicine:CatalogMedicine;stock:CatalogStock;quantity:number};
export type PosBody={branchId:string;customerId?:string;type:'pos';status:'completed';discountAmount:number;taxPercentage:number;note:string;advanceAmount:number;saleItems:{stockId:string;quantity:number;price:number}[];payments:{accountId:string;amount:number;paymentMethod:string;note:string}[]};
export type PosCustomer={id:string;tenantId:string;name:string;phone:string;customerNumber:string;balance:number|string;isWalkIn:boolean};
export function validPosCustomer(value:unknown,tenantId:string):value is PosCustomer{
 if(!object(value)||!uuid(value.id)||value.tenantId!==tenantId||typeof value.name!=='string'||typeof value.phone!=='string'||typeof value.customerNumber!=='string'||typeof value.isWalkIn!=='boolean')return false;
 try{return (typeof value.balance==='number'||typeof value.balance==='string'&&value.balance.trim()!=='')&&purchaseCents(Number(value.balance))>=BigInt(0);}catch{return false;}
}
export function posFunding(total:number,customer:PosCustomer|null,payment:number|null,advance:number,canAdvance:boolean){
 const net=purchaseCents(total),wallet=purchaseCents(advance);if(wallet>BigInt(0)&&(!customer||customer.isWalkIn||!canAdvance||wallet>purchaseCents(Number(customer.balance))))throw new Error('Advance exceeds the available balance or permission.');
 const cash=payment===null?net-wallet:purchaseCents(payment);if(cash<BigInt(0)||cash+wallet>net)throw new Error('Payment and advance cannot exceed the total.');
 const due=net-cash-wallet;if((!customer||customer.isWalkIn)&&(due!==BigInt(0)||wallet!==BigInt(0)))throw new Error('Select a registered customer for partial or due sales.');
 return {payment:Number(cash)/100,advance:Number(wallet)/100,paid:Number(cash+wallet)/100,due:Number(due)/100,status:due===BigInt(0)?'paid':cash+wallet>BigInt(0)?'partial':'due'};
}
export function posTotals(lines:{price:number;quantity:number}[],discount:number,taxPercentage:number){
 let gross=BigInt(0);if(!lines.length||lines.length>50)throw new Error('Choose 1 to 50 stock lines.');
 for(const line of lines){if(!Number.isInteger(line.quantity)||line.quantity<1||line.quantity>99999999)throw new Error('Quantity must be a positive whole number.');gross+=purchaseCents(line.price)*BigInt(line.quantity);}
 const reduction=purchaseCents(discount),rate=purchaseCents(taxPercentage);if(rate>BigInt(10000)||reduction>gross||gross>BigInt(9999999999))throw new Error('Check the discount, VAT and total.');
 const taxable=gross-reduction,tax=(taxable*rate+BigInt(5000))/BigInt(10000),net=taxable+tax;if(net>BigInt(9999999999))throw new Error('Sale amount is outside the supported range.');
 return {subtotal:Number(gross)/100,discount:Number(reduction)/100,tax:Number(tax)/100,total:Number(net)/100};
}
export function validPosBody(value:unknown):value is PosBody{
 if(!object(value)||Object.keys(value).length!==('customerId'in value?10:9)||!Object.keys(value).every(k=>['branchId','customerId','type','status','discountAmount','taxPercentage','note','advanceAmount','saleItems','payments'].includes(k)))return false;
 return validPosFields(value);
}
// Current backend permission, customer ledger and stock checks remain authoritative.
function validPosFields(v:Record<string,unknown>):boolean{
 if(!uuid(v.branchId)||'customerId'in v&&!uuid(v.customerId)||v.type!=='pos'||v.status!=='completed'||typeof v.note!=='string'||v.note.length>2000||!Array.isArray(v.saleItems)||!Array.isArray(v.payments)||v.payments.length>10)return false;
 const seen=new Set<string>();try{
  for(const line of v.saleItems){if(!object(line)||Object.keys(line).length!==3||!Object.keys(line).every(k=>['stockId','quantity','price'].includes(k))||!uuid(line.stockId)||seen.has(line.stockId)||typeof line.price!=='number'||typeof line.quantity!=='number')return false;seen.add(line.stockId);}
  const totals=posTotals(v.saleItems as PosBody['saleItems'],v.discountAmount as number,v.taxPercentage as number);let paid=BigInt(0);
  for(const p of v.payments){if(!object(p)||Object.keys(p).length!==4||!Object.keys(p).every(k=>['accountId','amount','paymentMethod','note'].includes(k))||!uuid(p.accountId)||!supplierPaymentMethods.includes(p.paymentMethod as typeof supplierPaymentMethods[number])||typeof p.note!=='string'||p.note.length>2000||purchaseCents(p.amount)<=BigInt(0))return false;paid+=purchaseCents(p.amount);}
  const advance=purchaseCents(v.advanceAmount),total=purchaseCents(totals.total);return v.customerId?paid+advance<=total:advance===BigInt(0)&&paid===total;
 }catch{return false;}
}
export function saleableStock(stock:CatalogStock,now=new Date()):boolean{
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 return uuid(stock.id)&&stock.quantity>0&&Date.parse(stock.expiryDate)>=Date.parse(today+'T00:00:00+06:00');
}
export function buildPosBody(branchId:string,lines:PosLine[],discount:number,taxPercentage:number,note:string,accountId:string,method:string,funding?:{tenantId:string;customer:PosCustomer|null;payment:number|null;advance:number;canAdvance:boolean}):PosBody{
 for(const line of lines)if(line.medicine.tenantId!==line.stock.tenantId||line.stock.branchId!==branchId||!line.medicine.isActive||!line.medicine.stocks.some(s=>s.id===line.stock.id)||!saleableStock(line.stock)||line.quantity>line.stock.quantity)throw new Error('Check the active medicine, batch and available quantity.');
 const saleItems=lines.map(line=>({stockId:line.stock.id,quantity:line.quantity,price:Number(line.medicine.salePrice)})),totals=posTotals(saleItems,discount,taxPercentage);
 const person=funding?.customer??null;if(person&&(!validPosCustomer(person,funding!.tenantId)||person.isWalkIn))throw new Error('Customer could not be verified.');
 const amounts=posFunding(totals.total,person,funding?.payment??null,funding?.advance??0,funding?.canAdvance??false);
 const body:PosBody={branchId,...(person?{customerId:person.id}:{}),type:'pos',status:'completed',discountAmount:discount,taxPercentage,note:note.trim(),advanceAmount:amounts.advance,saleItems,payments:amounts.payment?[{accountId,amount:amounts.payment,paymentMethod:method,note:''}]:[]};
 if(!validPosFields(body))throw new Error('Choose a payment account and check the sale.');return body;
}
export type PosReceipt={id:string;tenantId:string;branchId:string;customerId:string;userId:string;invoiceNumber:string;status:'completed';paymentStatus:'paid'|'partial'|'due';totalPrice:string|number;discountAmount:string|number;taxAmount:string|number;netPrice:string|number;paidAmount:string|number;dueAmount:string|number;createdAt:string;saleItems:{id:string;saleId:string;tenantId:string;branchId:string;stockId:string;itemName:string;unit:string;quantity:number|string;price:number|string;totalPrice:number|string}[]};
export function validPosResult(value:unknown,tenantId:string,userId:string,body:PosBody):value is PosReceipt{
 if(!object(value)||!uuid(value.id)||!uuid(value.customerId)||body.customerId&&value.customerId!==body.customerId||value.tenantId!==tenantId||value.branchId!==body.branchId||value.userId!==userId||value.status!=='completed'||typeof value.invoiceNumber!=='string'||typeof value.createdAt!=='string'||!Number.isFinite(Date.parse(value.createdAt))||!Array.isArray(value.saleItems)||value.saleItems.length!==body.saleItems.length)return false;
 try{const totals=posTotals(body.saleItems,body.discountAmount,body.taxPercentage),amount=(v:unknown)=>{if(typeof v!=='number'&&!(typeof v==='string'&&v.trim()))throw new Error('Invalid amount');return purchaseCents(Number(v));};
  const paid=body.payments.reduce((n,p)=>n+purchaseCents(p.amount),purchaseCents(body.advanceAmount)),due=purchaseCents(totals.total)-paid,status=due===BigInt(0)?'paid':paid>BigInt(0)?'partial':'due';
  if(value.paymentStatus!==status||amount(value.totalPrice)!==amount(totals.subtotal)||amount(value.discountAmount)!==amount(totals.discount)||amount(value.taxAmount)!==amount(totals.tax)||amount(value.netPrice)!==amount(totals.total)||amount(value.paidAmount)!==paid||amount(value.dueAmount)!==due)return false;
  const seen=new Set();for(const line of value.saleItems){if(!object(line)||!uuid(line.id)||seen.has(line.stockId)||line.saleId!==value.id||line.tenantId!==tenantId||line.branchId!==body.branchId||typeof line.itemName!=='string'||typeof line.unit!=='string')return false;seen.add(line.stockId);const source=body.saleItems.find(s=>s.stockId===line.stockId);if(!source||Number(line.quantity)!==source.quantity||amount(line.price)!==amount(source.price)||amount(line.totalPrice)!==purchaseCents(source.price)*BigInt(source.quantity))return false;}
  return true;
 }catch{return false;}
}
