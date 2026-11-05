"use client";
import { BrandLogo, useBranding } from "@/components/providers/branding-provider";
import { Select } from "@/components/ui/select";
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Printer,X} from 'lucide-react';
import {useLanguage} from '@/lib/i18n/language-provider';
import {useBrowserPreference} from '@/lib/browser/use-browser-preference';
import {consistentTender,receiptSettlement,type ReceiptDocument,type ReceiptMoney} from './receipt-model';
const widths=['58','80'] as const;
export function ReceiptPreview({receipt,onClose}:{receipt:ReceiptDocument;onClose:()=>void}){
 const {branding}=useBranding();
 const {t,language,setLanguage}=useLanguage();const [width,setWidth]=useBrowserPreference<'58'|'80'>('pharmacy.receipt-width','80',widths);const [printing,setPrinting]=useState(false),[printError,setPrintError]=useState('');const node=useRef<HTMLElement>(null);
 const locale=language==='bn'?'bn-BD':'en-BD';
 const money=(value:ReceiptMoney|undefined)=>value==null?'—':new Intl.NumberFormat(locale,{style:'currency',currency:'BDT',currencyDisplay:'narrowSymbol',maximumFractionDigits:2}).format(value);
 const number=(value:ReceiptMoney)=>value===null?'—':new Intl.NumberFormat(locale,{maximumFractionDigits:2}).format(value);
 const date=(value:string)=>Number.isFinite(Date.parse(value))?new Date(value).toLocaleString(language==='bn'?'bn-BD':'en-GB',{timeZone:'Asia/Dhaka',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:true}):'—';
 const settlement=receiptSettlement(receipt);const hasDue=settlement==='partial'||settlement==='due';
 const decimal=(value:ReceiptMoney)=>value===null?'—':new Intl.NumberFormat(locale,{minimumFractionDigits:2,maximumFractionDigits:2}).format(value);
 const title=t(receipt.reprint?'Receipt reprint':receipt.status==='pending'?'Sale slip':'Sales receipt');const tenderKnown=consistentTender(receipt);
 useEffect(()=>{const prior=document.activeElement as HTMLElement|null;node.current?.focus({preventScroll:true});return()=>{if(prior?.isConnected)prior.focus();};},[]);
 async function print(){if(printing)return;setPrinting(true);setPrintError('');try{if(document.fonts)await document.fonts.ready;await Promise.all(Array.from(node.current?.querySelectorAll("img")||[]).map(img=>Promise.race([img.decode().catch(()=>{}),new Promise(resolve=>setTimeout(resolve,4000))])));window.print();}catch{setPrintError(t('Printing could not be opened. Try again or use your browser print command.'));}finally{setPrinting(false);}}
 function trap(event:React.KeyboardEvent<HTMLElement>){if(event.key==='Escape'){event.stopPropagation();onClose();}if(event.key==='Tab'){const all=node.current?.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)');if(!all?.length)return;const first=all[0],last=all[all.length-1];if(event.shiftKey&&(document.activeElement===first||document.activeElement===node.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&(document.activeElement===last||document.activeElement===node.current)){event.preventDefault();first.focus();}}}
 return createPortal(<div className="pos-receipt-backdrop receipt-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose();}}><section ref={node} tabIndex={-1} className="pos-receipt-dialog receipt-preview" data-paper-width={width} role="dialog" aria-modal="true" aria-labelledby="receipt-preview-title" onKeyDown={trap}>
  <div className="pos-receipt-actions receipt-controls"><div className="receipt-modal-heading"><div><p className="receipt-eyebrow">{t('Print preview')}</p><h2 id="receipt-preview-title">{title}</h2><small>{receipt.invoice} · {receipt.branch}</small></div><button type="button" className="receipt-close" onClick={onClose} aria-label={t('Close receipt')}><X size={18}/></button></div><div className="receipt-settings"><label>{t('Paper width')}<Select aria-label={t('Paper width')} value={width} onChange={event=>setWidth(event.target.value as '58'|'80')}><option value="58">58 mm</option><option value="80">80 mm</option></Select></label><label>{t('Language')}<Select aria-label={t('Receipt language')} value={language} onChange={event=>setLanguage(event.target.value as 'en'|'bn')}><option value="en">English</option><option value="bn">বাংলা</option></Select></label></div></div>

  <div className="receipt-preview-scroll"><article className="pos-receipt-paper thermal-receipt sample-sale-receipt" lang={language} data-paper-width={width} data-settlement={settlement}>
   <header className="receipt-business-header"><BrandLogo className="receipt-brand-logo"/><h2>{branding.name||receipt.branch}</h2>{branding.name&&branding.name!==receipt.branch&&<small>{receipt.branch}</small>}<strong>{t('PHARMACY')}</strong>{receipt.branchAddress&&<small>{receipt.branchAddress}</small>}{receipt.branchPhone&&<small>{t('Phone')}: {receipt.branchPhone}</small>}{receipt.branchEmail&&<small>{t('Email')}: {receipt.branchEmail}</small>}<small className="receipt-document-label">{title}</small></header>
   <div className="pos-receipt-meta"><span><span>{t('Invoice')}</span><strong>{receipt.invoice}</strong></span><span><span>{t('Date')}</span><strong>{date(receipt.date)}</strong></span><span><span>{t('Customer')}</span><strong>{language==='bn'?receipt.customer.nameBangla||receipt.customer.name:receipt.customer.name}</strong></span>{receipt.customer.phone&&<span><span>{t('Phone')}</span><strong>{receipt.customer.phone}</strong></span>}</div>
   {receipt.status==='pending'&&<p className="receipt-pending-note">{t('Pending sale — this slip does not confirm a completed checkout.')}</p>}
   <div className="receipt-sale-content">
    {hasDue&&<div className="receipt-due-watermark" aria-hidden="true">{t('DUE')}</div>}
    <table className="receipt-sale-items"><colgroup><col className="receipt-col-item"/><col className="receipt-col-qty"/><col className="receipt-col-rate"/><col className="receipt-col-total"/></colgroup><thead><tr><th>{t('Item')}</th><th>{t('Qty')}</th><th>{t('Rate')}</th><th>{t('Amount')}</th></tr></thead><tbody>{receipt.items.map((item,index)=><tr className="receipt-item" key={index}><td><strong className="receipt-item-name">{item.name}</strong>{item.description&&<small>{item.description}</small>}{item.discount!==null&&item.discount>0&&<small>{t('Item discount')}: {money(item.discount)}</small>}</td><td>{number(item.quantity)}</td><td>{decimal(item.price)}</td><td className="receipt-item-total">{decimal(item.total)}</td></tr>)}</tbody></table>
    <div className="pos-receipt-totals">
     <span><span>{t('Gross total')}</span><strong>{money(receipt.subtotal)}</strong></span>
     {(receipt.itemDiscount===null||receipt.itemDiscount>0)&&<span><span>{t('Item discount')}</span><strong>−{money(receipt.itemDiscount)}</strong></span>}
     {(receipt.saleDiscount===null||receipt.saleDiscount>0)&&<span><span>{t('Sale discount')}</span><strong>−{money(receipt.saleDiscount)}</strong></span>}
     {(receipt.taxAmount===null||receipt.taxAmount>0)&&<span><span>{t('Tax')}{receipt.taxPercent!=null?' ('+number(receipt.taxPercent)+'%)':''}</span><strong>{money(receipt.taxAmount)}</strong></span>}
     <span className="pos-receipt-grand"><span>{t('Net payable')}</span><strong>{money(receipt.total)}</strong></span>
     <span><span>{t('Paid amount')}</span><strong>{money(receipt.paid)}</strong></span>
     {(receipt.due===null||receipt.due>0)&&<span className={hasDue?'receipt-due-total':undefined}><span>{t('Due')}</span><strong>{money(receipt.due)}</strong></span>}
     {tenderKnown&&<span><span>{t('Change return')}</span><strong>{money(receipt.change)}</strong></span>}
    </div>
   </div>
   {hasDue&&<div className="receipt-due-stamp" role="status"><strong>{t('DUE')}</strong><b>{money(receipt.due)}</b><small>{t(receipt.paid===null?'Outstanding due':settlement==='partial'?'Partially paid sale':'Unpaid sale')}</small></div>}
   <footer>{receipt.cashier&&<p className="receipt-billed-by">{t('Billing by')}: <strong>{receipt.cashier}</strong></p>}<strong>{t('Thank you for visiting!')}</strong><small>{t('Please keep this receipt for returns.')}</small></footer>
  </article></div>
  <div className="receipt-modal-footer"><div><p>{t('Choose matching paper width in printer settings. Turn off browser headers and footers.')}</p>{printError&&<p role="alert">{printError}</p>}</div><div className="receipt-footer-buttons"><button type="button" className="receipt-done" onClick={onClose}>{t('Done')}</button><button type="button" className="receipt-print" disabled={printing} onClick={()=>void print()}><Printer size={17}/>{t(printing?'Preparing print…':'Print receipt')}</button></div></div>
 </section></div>,document.body);
}
