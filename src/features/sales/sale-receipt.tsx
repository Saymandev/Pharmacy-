"use client";
import {useActiveBranch} from "@/components/providers/active-branch-provider";
import {ReceiptPreview} from '@/features/receipts/receipt-preview';
import {savedReceipt,type SavedReceiptSale} from '@/features/receipts/receipt-model';
/** Reprints saved balances and branch details; transaction history stays in Sales details. */
export function SaleReceipt({sale,onClose}:{sale:SavedReceiptSale;onClose:()=>void}){const {branches}=useActiveBranch();const branch=branches.find(row=>row.id===sale.branchId);return <ReceiptPreview receipt={savedReceipt({...sale,branch:sale.branch?{...branch,...sale.branch}:branch})} onClose={onClose}/>;}
