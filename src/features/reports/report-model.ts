export type ReportRecord = Record<string, unknown>;
export type ReportMetric = { key: string; label: string; value: number };
export type ReportTable = { id: string; name: string; rows: ReportRecord[]; columns: string[]; totals: ReportMetric[] };
export type ReportModel = { metrics: ReportMetric[]; tables: ReportTable[] };

const labels: Record<string, string> = {
 sameDayCollected: 'Same-day sale receipts', previousDayDueCollected: 'Previous-day dues collected', cashRefunded: 'Money refunded', advanceApplied: 'Advance applied (no new receipt)', outstandingDueAtEnd: 'All invoice dues at period end', saleDate: 'Sale date', collectedAt: 'Collection date', paidAtEnd: 'Paid at period end', dueAtEnd: 'Due at period end',
 totalCashReceived: 'Recorded money received', totalCashPaid: 'Recorded money paid', netCashMovement: 'Net account movement', purchaseSpread: 'Sales less purchases', invoicePaymentSurplus: 'Net collections less expenses and purchase payments',
 totalSales: 'Total sales', totalSale: 'Gross sales', totalPrice: 'Gross amount', totalNetSale: 'Net sales', netSales: 'Net sales',
 totalPaid: 'Paid', totalDues: 'Outstanding dues', totalDiscount: 'Discounts', totalReturned: 'Returns', totalReturn: 'Returns',
 totalExpenses: 'Expenses', totalPurchases: 'Purchases', totalPurchasesPaid: 'Purchase payments', grossProfit: 'Gross profit', netProfit: 'Net profit', cogs: 'Cost of goods sold',
 totalCollection: 'Collection', totalPurchase: 'Gross purchases', totalNetPurchase: 'Net purchases', totalPayment: 'Net payment', netAmount: 'Net amount', netPrice: 'Net amount',
 totalAmount: 'Total amount', paidAmount: 'Paid', dueAmount: 'Due', paid: 'Paid', due: 'Due', taxAmount: 'Tax', discountAmount: 'Discount',
 totalPatientVisited: 'Visits', patientVisited: 'Visits', totalAppointmentSale: 'Appointment sales', totalConsultationCharge: 'Consultation charges',
 totalAmountPaid: 'Paid', totalAmountDue: 'Due', totalExpenditure: 'Total expenditure', totalDueCollected: 'Due collected', totalCollected: 'Collected',
 collectedAmount: 'Collected amount', collectionAmount: 'Collected amount', returnAmount: 'Returned amount', netCollection: 'Net collection',
 totalTax: 'Tax', count: 'Count', saleReturnCount: 'Sale returns', purchaseReturnCount: 'Purchase returns',
 saleReturnAmount: 'Sales returned', purchaseReturnAmount: 'Purchases returned',
 pos: 'POS', slNo: 'No.', patientNumber: 'Customer number', patientName: 'Customer', invoiceNumber: 'Invoice', poNumber: 'Purchase order', supplierName: 'Supplier',
 createdBy: 'Created by', createdAt: 'Created', lastPaymentDate: 'Last payment', paymentMethod: 'Payment method', doctorName: 'Doctor', recordedBy: 'Recorded by',
 appointmentSale: 'Appointment sales', consultationChargeGot: 'Consultation commission', amountPaid: 'Paid', amountDue: 'Due', chargePaid: 'Charges paid', chargeDue: 'Charges due',
 commissionPaid: 'Commission paid', commissionDue: 'Commission due', totalCommission: 'Total commission',
 outdoor: 'Outdoor', indoor: 'Indoor', pharmacy: 'Pharmacy', hospital: 'Hospital', clinic: 'Clinic', salesByType: 'Sales by type', collections: 'Collections', invoices: 'Invoices',
};
export const isRecord = (value: unknown): value is ReportRecord => !!value && typeof value === 'object' && !Array.isArray(value);
export function reportLabel(key: string) { return labels[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/[_-]/g, ' ').replace(/^./, c => c.toUpperCase()); }
export function numericReportValue(value: unknown): number | null {
 if (typeof value !== 'number' && typeof value !== 'string') return null;
 if (typeof value === 'string' && !/^-?\d+(?:\.\d+)?$/.test(value)) return null;
 const parsed=Number(value); return Number.isFinite(parsed)?parsed:null;
}
export function isMoneyColumn(key: string) {
 if (/count|visited|quantity|percentage|percent|rate|method$|^slNo$|number$|^id$|Id$/i.test(key)) return false;
 return /cash|amount|price|sales|sale$|paid|due|discount|profit|purchase|collect|payment|tax|expen|income|charge|return|commission|^cogs$/i.test(key);
}
export function formatReportValue(key: string, value: unknown, locale='en-BD'): string {
 if(value===null||value===undefined||value==='')return '—';
 const amount=numericReportValue(value);
 if(amount!==null && isMoneyColumn(key))return new Intl.NumberFormat(locale,{style:'currency',currency:'BDT',maximumFractionDigits:2}).format(amount);
 if(typeof value==='number')return new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value);
 if(typeof value==='string' && /^\d{4}-\d{2}-\d{2}T/.test(value) && Number.isFinite(Date.parse(value)))return new Intl.DateTimeFormat(locale,{timeZone:'Asia/Dhaka',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
 if(isRecord(value))return Object.entries(value).map(([k,v])=>`${reportLabel(k)}: ${formatReportValue(k,v,locale)}`).join(' · ');
 if(Array.isArray(value))return value.map(item=>isRecord(item)?JSON.stringify(item):String(item)).join(' · ');
 return String(value);
}

export function buildReportModel(input: unknown): ReportModel {
 const payload=isRecord(input)&&'data' in input?input.data:input;
 const model:ReportModel={metrics:[],tables:[]};
 function metrics(value:ReportRecord,path:string[],out:ReportMetric[]) {
  for(const [key,item] of Object.entries(value)){
   const number=numericReportValue(item);
   if(number!==null)out.push({key:[...path,key].join('.'),label:[...path,key].map(reportLabel).join(' · '),value:number});
   else if(isRecord(item))metrics(item,[...path,key],out);
  }
 }
 function walk(value:unknown,path:string[],depth=0){
  if(depth>12)return;
  if(Array.isArray(value)){
   const records=value.filter(isRecord);
   const leafRows=records.filter(row=>!Object.values(row).some(Array.isArray));
   if(leafRows.length)model.tables.push({id:path.join('.')||'records',name:path.map(reportLabel).join(' · ')||'Records',rows:leafRows,columns:[...new Set(leafRows.flatMap(row=>Object.keys(row)))],totals:[]});
   records.filter(row=>Object.values(row).some(Array.isArray)).forEach((row,index)=>{
    const group=String(row.category??row.type??row.name??`Group ${index+1}`);
    for(const [key,child] of Object.entries(row))if(Array.isArray(child)){
     const before=model.tables.length;walk(child,[...path,group,key],depth+1);
     if(isRecord(row.subTotals))for(const table of model.tables.slice(before))metrics(row.subTotals,[],table.totals);
    }
   });
   return;
  }
  if(!isRecord(value))return;
  for(const [key,item] of Object.entries(value)){
   if(key==='summary'){if(isRecord(item))metrics(item,[],model.metrics);continue;}
   if(key==='subTotals')continue;
   if(Array.isArray(item)||isRecord(item)){
    const before=model.tables.length;
    walk(item,key==='groups'?path:[...path,key],depth+1);
    if(Array.isArray(item) && isRecord(value.subTotals))for(const table of model.tables.slice(before))metrics(value.subTotals,[],table.totals);
   }
  }
 }
 walk(payload,[]);
 // Summary-style objects (including pharmacy summary) contain scalar nested sections.
 if(isRecord(payload) && !isRecord(payload.summary))metrics(payload,[],model.metrics);
 else if(isRecord(payload))for(const [key,value] of Object.entries(payload))if(key!=='summary' && isRecord(value) && !Object.values(value).some(Array.isArray))metrics(value,[key],model.metrics);
 return model;
}

/** Numeric exports stay raw; text is quoted and protected against spreadsheet formulas. */
export function reportCsv(model:ReportModel,context:ReportRecord):string {
 const rows:ReportRecord[]=[...model.metrics.map(metric=>({...context,Section:'Summary',Metric:metric.label,Value:metric.value})),
  ...model.tables.flatMap(table=>[...table.rows.map(row=>({...context,Section:table.name,...Object.fromEntries(Object.entries(row).map(([key,value])=>[key,isMoneyColumn(key)&&numericReportValue(value)!==null?numericReportValue(value):value]))})),...table.totals.map(metric=>({...context,Section:`${table.name} · Totals`,Metric:metric.label,Value:metric.value}))])];
 if(!rows.length)return '';
 const columns=[...new Set(rows.flatMap(row=>Object.keys(row)))];
 function quote(value:unknown){let text=isRecord(value)||Array.isArray(value)?JSON.stringify(value):String(value??'');if(typeof value!=='number'&&/^[\s]*[=+@\-\t\r]/.test(text))text=`'${text}`;return `"${text.replaceAll('"','""')}"`;}
 return '\uFEFF'+[columns.map(column=>quote(reportLabel(column))).join(','),...rows.map(row=>columns.map(column=>quote(row[column])).join(','))].join('\r\n');
}

export type DatePreset='today'|'yesterday'|'last7'|'thisMonth'|'lastMonth'|'all';
export function reportDateRange(preset:DatePreset,now=new Date()){
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Dhaka',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const date=new Date(`${today}T12:00:00Z`);const format=(d:Date)=>d.toISOString().slice(0,10);
 if(preset==='all')return {startDate:'',endDate:''};
 if(preset==='yesterday'){date.setUTCDate(date.getUTCDate()-1);return {startDate:format(date),endDate:format(date)};}
 if(preset==='last7')date.setUTCDate(date.getUTCDate()-6);
 if(preset==='thisMonth')date.setUTCDate(1);
 if(preset==='lastMonth'){date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()-1);const end=new Date(date);end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);return {startDate:format(date),endDate:format(end)};}
 return {startDate:format(date),endDate:today};
}
export function reportDateError(start:string,end:string){
 if(Boolean(start)!==Boolean(end))return 'Choose both a start and end date, or clear both for all dates.';
 if(!start)return '';
 const valid=(s:string)=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;
 if(!valid(start)||!valid(end))return 'Enter valid report dates.';
 return start>end?'The start date must be on or before the end date.':'';
}
