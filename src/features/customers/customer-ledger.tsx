"use client";
import {useEffect,useMemo,useState} from 'react';
import {createPortal} from 'react-dom';
import {useLanguage} from '@/lib/i18n/language-provider';
import {fetchCustomerPages} from './customer-data';
import {filterLedger,ledgerEntries,ledgerFilterError,ledgerDate,ledgerTotals,ledgerMoney,ledgerCsv,type LedgerSale,type LedgerReturn,type LedgerEntry} from './ledger-model';

type Props={customer:{id:string;name:string;phone:string;customerNumber?:string};sales:LedgerSale[];canReadSales:boolean;canReadReturns:boolean;refresh:number};
export function CustomerLedger({customer,sales,canReadSales,canReadReturns,refresh}:Props){
 const {t}=useLanguage();const [returns,setReturns]=useState<LedgerReturn[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 const [branch,setBranch]=useState(''),[start,setStart]=useState(''),[end,setEnd]=useState(''),[page,setPage]=useState(1);
 useEffect(()=>{const controller=new AbortController();const timer=window.setTimeout(async()=>{
  setLoading(true);setError('');setReturns([]);
  if(!canReadSales||!canReadReturns){setLoading(false);return;}
  try{
   const collected:LedgerReturn[]=[];let index=0;
   await Promise.all(Array.from({length:Math.min(4,sales.length)},async()=>{while(index<sales.length){const sale=sales[index++];const rows=await fetchCustomerPages<LedgerReturn>('/sales/returns',{saleId:sale.id},controller.signal);if(rows.some(r=>r.saleId!==sale.id||r.customerId&&r.customerId!==customer.id))throw new Error('The server returned mismatched return records.');collected.push(...rows);}}));
   if(!controller.signal.aborted)setReturns(Array.from(new Map(collected.map(r=>[r.id,r])).values()));
  }catch(cause){if(!controller.signal.aborted)setError(cause instanceof Error?cause.message:'Customer history could not be loaded.');}finally{if(!controller.signal.aborted)setLoading(false);}
 },0);return()=>{window.clearTimeout(timer);controller.abort();};},[customer.id,sales,canReadSales,canReadReturns,refresh,retry]);
 const model=useMemo(()=>{try{return {entries:ledgerEntries(sales,returns),error:''};}catch(cause){return {entries:[],error:cause instanceof Error?cause.message:'History is unavailable.'};}},[sales,returns]);
 const dateError=ledgerFilterError(start,end),problem=error||model.error||dateError;
 const filtered=dateError?[]:filterLedger(model.entries,branch,start,end),totals=ledgerTotals(filtered),pages=Math.max(1,Math.ceil(filtered.length/20));
 const selected=filtered.slice((Math.min(page,pages)-1)*20,Math.min(page,pages)*20);
 const branches=Array.from(new Map(sales.map(s=>[s.branchId,s.branch?.name||s.branchId])).entries());
 const context=`${customer.name} · ${customer.customerNumber||customer.id} · ${branch?branches.find(b=>b[0]===branch)?.[1]:'All branches'} · ${start||'All dates'} – ${end||'All dates'}`;
 const ready=canReadSales&&!loading&&!problem;
 function table(rows:LedgerEntry[]){return <table className="customer-ledger-table"><thead><tr>{['Date','Type','Reference','Invoice','Status','Amount','Method','Note'].map(label=><th key={label}>{t(label)}</th>)}</tr></thead><tbody>{rows.map(e=><tr key={e.id}><td>{ledgerDate(e.date)}</td><td>{t(e.kind)}</td><td>{e.reference}</td><td>{e.invoice}</td><td>{t(e.status)}</td><td>{ledgerMoney(e.amount)}</td><td>{e.method}</td><td>{t(e.note)}</td></tr>)}</tbody></table>;}
 if(!canReadSales)return <p>{t('Your role cannot view invoice history.')}</p>;
 return <section className="customer-ledger" aria-label="Customer statement">
  <h3>{t('Statement & history')}</h3><p>{t('Invoice values and cash movements are shown separately. Returns do not automatically mean a cash refund.')}</p>
  <div className="customer-ledger-filters"><label>{t('Branch')}<select aria-label="Statement branch" value={branch} onChange={e=>{setBranch(e.target.value);setPage(1);}}><option value="">{t('All branches')}</option>{branches.map(([id,name])=><option key={id} value={id}>{name}</option>)}</select></label><label>{t('From')}<input aria-label="Statement from" type="date" value={start} onChange={e=>{setStart(e.target.value);setPage(1);}}/></label><label>{t('To')}<input aria-label="Statement to" type="date" value={end} onChange={e=>{setEnd(e.target.value);setPage(1);}}/></label><button onClick={()=>{setStart('');setEnd('');setBranch('');setPage(1);}}>{t('Clear filters')}</button></div>
  {!canReadReturns&&<p role="note">{t('Return history requires sale-return:read access. This statement includes invoices and their recorded transactions only.')}</p>}
  {problem&&<div role="alert" className="purchase-alert error">{t(problem)}{error&&<button onClick={()=>setRetry(x=>x+1)}>{t('Retry')}</button>}</div>}
  {loading&&<p role="status">{t('Loading customer history…')}</p>}
  <div className="customer-ledger-totals">{[['Saved invoice value',totals.invoices],['Recorded payments',totals.payments],['Completed return value',canReadReturns?totals.returns:null],['Recorded refunds',totals.refunds]].map(([label,value])=><div key={String(label)}><small>{t(String(label))}</small><strong>{loading||problem||value===null?'—':ledgerMoney(Number(value))}</strong></div>)}</div>
  <p>{t('Totals follow the selected event dates. Invoice values use the current saved amounts; pending and rejected invoices are excluded from totals.')}</p>
  <div className="customer-detail-actions"><button disabled={!ready} onClick={()=>window.print()}>{t('Print statement')}</button><button disabled={!ready} onClick={()=>{const url=URL.createObjectURL(new Blob([ledgerCsv(filtered,`${context} · Invoice-linked activity; current saved invoice values${canReadReturns?'':' · Return history omitted: permission required'}`)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='customer-statement.csv';a.click();URL.revokeObjectURL(url);}}>{t('Export CSV')}</button></div>
  {!loading&&<><div className="customer-ledger-scroll">{table(selected)}</div>{!filtered.length&&<p>{t('No activity matches these filters.')}</p>}<div className="sales-pagination"><span>{filtered.length} {t('events')}</span><button disabled={page<=1} onClick={()=>setPage(x=>x-1)}>{t('Previous')}</button><span>{Math.min(page,pages)} / {pages}</span><button disabled={page>=pages} onClick={()=>setPage(x=>x+1)}>{t('Next')}</button></div></>}
  {ready&&createPortal(<article className="customer-statement-print"><h1>{t('Customer statement')}</h1><p>{context}</p><p>{customer.phone} · {t('Times use Asia/Dhaka')}</p>{!canReadReturns&&<p>{t('Return history requires sale-return:read access. This statement includes invoices and their recorded transactions only.')}</p>}<p>{t('Saved invoice value')}: {ledgerMoney(totals.invoices)} · {t('Recorded payments')}: {ledgerMoney(totals.payments)} · {t('Recorded refunds')}: {ledgerMoney(totals.refunds)} · {t('Completed return value')}: {canReadReturns?ledgerMoney(totals.returns):'—'}</p><p>{t('Invoice values use the current saved amounts. Return value is separate from cash refunded.')}</p>{table(filtered)}</article>,document.body)}
 </section>;
}
