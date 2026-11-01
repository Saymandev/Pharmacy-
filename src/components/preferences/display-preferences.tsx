"use client";
import {useEffect,useRef} from 'react';
import {Monitor,Moon,Sun,X,Check,Languages} from 'lucide-react';
import {useTheme,type Theme} from '@/components/providers/theme-provider';
import {useLanguage} from '@/lib/i18n/language-provider';
export function DisplayPreferences({onClose}:{onClose:()=>void}){
 const {theme,setTheme}=useTheme(),{language,setLanguage,t}=useLanguage();const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>{node?.close();};},[]);
 const options:{value:Theme;title:string;note:string;icon:typeof Sun}[]=[{value:'light',title:'Light',note:'Bright and clear',icon:Sun},{value:'dark',title:'Dark',note:'Comfort for late shifts',icon:Moon},{value:'system',title:'System',note:'Match your device',icon:Monitor}];
 return <dialog ref={dialog} className="display-preferences" aria-labelledby="display-title" onCancel={onClose} onClick={event=>{if(event.target===event.currentTarget){const rect=event.currentTarget.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)onClose();}}} onClose={onClose}>
  <div className="display-heading"><div><span className="display-eyebrow">{t('MAKE IT YOURS')}</span><h2 id="display-title">{t('Display preferences')}</h2></div><button type="button" className="display-close" onClick={onClose} aria-label={t('Close preferences')}><X size={19}/></button></div>
  <p>{t('A comfortable workspace for every shift. Your choices are saved on this browser.')}</p>
  <fieldset><legend>{t('Appearance')}</legend><div className="appearance-options">{options.map(({value,title,note,icon:Icon})=><label key={value} className={`appearance-choice ${theme===value?'selected':''}`}><input type="radio" name="appearance" value={value} checked={theme===value} onChange={()=>setTheme(value)}/><span className={`appearance-preview preview-${value}`} aria-hidden="true"><i/><span><b/><b/><b/></span></span><span className="appearance-choice-title"><Icon size={16}/>{t(title)}{theme===value&&<Check size={15}/>}</span><small>{t(note)}</small></label>)}</div></fieldset>
  <fieldset><legend><Languages size={16}/>{t('Language')}</legend><div className="display-language-options">{([{key:'en',label:'English',note:'English interface'},{key:'bn',label:'বাংলা',note:'বাংলায় ব্যবহার করুন'}] as const).map(option=><label key={option.key} className={language===option.key?'selected':''}><input type="radio" name="display-language" checked={language===option.key} onChange={()=>setLanguage(option.key)}/><span><strong lang={option.key}>{option.label}</strong><small>{option.note}</small></span>{language===option.key&&<Check size={17}/>}</label>)}</div></fieldset>
  <button type="button" className="display-done" onClick={onClose}>{t('Done')}</button>
 </dialog>;
}
