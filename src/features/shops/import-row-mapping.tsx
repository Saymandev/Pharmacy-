"use client";
import {useState} from 'react';
import {ReferencePicker} from './reference-picker';
import {medicineReferences} from './medicine-form-policy';
import {type ImportRow} from './bulk-policy';
import {type ShopContext} from './shop-contract';
import {useLanguage} from '@/lib/i18n/language-provider';

/** Explicit row overrides; clearing a value preserves the file/default mapping. */
export function ImportRowMapping({rows,context,disabled,onChange}:{rows:ImportRow[];context:ShopContext;disabled:boolean;onChange:(value:Record<number,Record<string,string>>)=>void}){
 const {t}=useLanguage();const [mapping,setMapping]=useState<Record<number,Record<string,string>>>({});
 return <details className="tenant-import-details"><summary>{t('Map individual medicine rows')}</summary><p>{t('Row selections override the file and all-row defaults. Clear a selection to use the default.')}</p>{rows.map((row,index)=><section className="tenant-import-masters" key={index}><h3>{index+1}. {row.name}</h3>{medicineReferences.map(ref=><div className="tenant-editor-reference" key={ref.key}><span>{t(ref.label)}</span><ReferencePicker tenantId={context.tenant.id} kind={ref.kind} label={`${t(ref.label)} ${index+1}`} value={mapping[index]?.[ref.key]??''} canRead={context.permissions.includes(ref.permission)} disabled={disabled} onChange={id=>{const next={...mapping,[index]:{...mapping[index],[ref.key]:id}};setMapping(next);onChange(next);}}/></div>)}</section>)}</details>;
}
