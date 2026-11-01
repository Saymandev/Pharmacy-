"use client";
import Link from 'next/link';
import {LockKeyhole,ArrowRight} from 'lucide-react';
import {useLanguage} from '@/lib/i18n/language-provider';
export function WorkspaceAccessNotice({message,available}:{message:string;available:{href:string;label:string}[]}){
 const {t}=useLanguage();return <section className="workspace-access-notice panel" aria-labelledby="workspace-access-title"><span className="workspace-access-icon"><LockKeyhole size={24}/></span><p className="eyebrow">{t('WORKSPACE ACCESS')}</p><h1 id="workspace-access-title">{t('Access required')}</h1><p>{t(message)}</p><p>{t('Ask an administrator to enable this workspace, or choose a page you can access.')}</p><Link className="purchase-primary-action" href="/dashboard">{t('Go to overview')}<ArrowRight size={16}/></Link>{available.length>0&&<div className="workspace-access-links"><h2>{t('Available workspaces')}</h2>{available.map(item=><Link key={item.href} href={item.href}>{t(item.label)}<ArrowRight size={14}/></Link>)}</div>}</section>;
}
