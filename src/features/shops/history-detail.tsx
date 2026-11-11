"use client";
import { useEffect,useRef,useState } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/language-provider';
import { sessionBoundary } from '@/lib/api/session-boundary';
import { createWorkspaceClient } from './workspace-client';
import { validWorkspaceBranch,type WorkspaceBranch } from './workspace-contract';
import { type ShopContext } from './shop-contract';
import { type StockMovement,movementLabels } from './history-contract';
export function HistoryDetail({row,context,branch,onClose}:{row:StockMovement;context:ShopContext;branch:WorkspaceBranch;onClose:()=>void}){
 const {t,language}=useLanguage(),dialog=useRef<HTMLDialogElement>(null),[target,setTarget]=useState('');
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 useEffect(()=>{if(!row.targetBranchId)return;let active=true;const client=createWorkspaceClient(context.tenant.id,sessionBoundary.capture().signal);void client.branch(row.targetBranchId).then(value=>{if(active&&validWorkspaceBranch(value,context))setTarget(value.name);}).catch(()=>{});return()=>{active=false;client.dispose();};},[context,row.targetBranchId]);
 return <dialog ref={dialog} className="workspace-branch-dialog tenant-history-dialog" aria-labelledby="history-detail-title" onCancel={onClose} onClose={()=>{if(!dialog.current?.open)onClose();}} onClick={event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}}><header><h2 id="history-detail-title">{t('Stock movement')}</h2><button type="button" aria-label={t('Close movement details')} onClick={onClose}><X size={18}/></button></header><h3>{row.medicine.name}</h3><dl><dt>{t('Working branch')}</dt><dd>{branch.name}</dd><dt>{t('Batch number')}</dt><dd>{row.stock.batchNumber}</dd><dt>{t('Date')}</dt><dd>{new Date(row.createdAt).toLocaleString(language==='bn'?'bn-BD':'en-GB',{timeZone:'Asia/Dhaka'})}</dd><dt>{t('Direction')}</dt><dd>{t(row.type==='in'?'In':'Out')}</dd><dt>{t('Movement quantity')}</dt><dd>{row.type==='in'?'+':'−'}{row.quantity} {row.stock.unit}</dd><dt>{t('Change type')}</dt><dd>{t(movementLabels[row.stockChangeType]??row.stockChangeType)}</dd>{row.targetBranchId&&<><dt>{t(row.type==='out'?'To branch':'From branch')}</dt><dd>{target||t('Not available with your current access')}</dd></>}<dt>{t('Note')}</dt><dd>{row.note||'—'}</dd></dl><p>{t('Movement quantity is not a historical running balance.')}</p></dialog>;
}
