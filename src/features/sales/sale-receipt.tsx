"use client";
import {ReceiptPreview} from '@/features/receipts/receipt-preview';
import {savedReceipt,type SavedReceiptSale} from '@/features/receipts/receipt-model';
/** Reprints persisted sale values and transactions; never invents original tender/change. */
export function SaleReceipt({sale,onClose}:{sale:SavedReceiptSale;onClose:()=>void}){return <ReceiptPreview receipt={savedReceipt(sale)} onClose={onClose}/>;}
