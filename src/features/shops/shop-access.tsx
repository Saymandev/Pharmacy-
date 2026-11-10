"use client";
import { useCallback,useEffect,useRef,useState } from "react";
import { useRouter } from "next/navigation";
import { Building2,Check,ChevronRight,LogOut,Moon,Sun } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useTheme } from "@/components/providers/theme-provider";
import { useLanguage } from "@/lib/i18n/language-provider";
import { DataSkeleton,SessionSkeleton } from "@/components/ui/skeleton";
import { api,ApiClientError } from "@/lib/api/client";
import { sessionBoundary } from "@/lib/api/session-boundary";
import { type ShopPage,type ShopContext,type ShopMembership,shopPreferenceKey,validShopContext,validShopPage } from "./shop-contract";
import { TenantWorkspace } from './tenant-workspace';

export function ShopAccess({workspaceEnabled=false}:{workspaceEnabled?:boolean}){
  const {status,user,logout}=useAuth(),{theme,setTheme}=useTheme(),{language,setLanguage,t}=useLanguage(),router=useRouter();
  const [items,setItems]=useState<ShopMembership[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(""),[pending,setPending]=useState("");
  const [selected,setSelected]=useState<ShopContext|null>(null),[suggested,setSuggested]=useState("");
  const request=useRef(0),listRequest=useRef(0),selectionTitle=useRef<HTMLHeadingElement>(null);
  const invalidate=useCallback(()=>{listRequest.current++;request.current++;},[]);
  useEffect(()=>{if(status==='anonymous')router.replace('/login');},[router,status]);
  const load=useCallback(async(after?:string)=>{
    const revision=++listRequest.current;setLoading(true);setError("");
    if(!after)setSelected(null);
    try{
      const page=await api.get<ShopPage>(`/tenant-session/memberships?limit=20${after?`&after=${encodeURIComponent(after)}`:''}`);
      if(revision!==listRequest.current)return;
      if(!validShopPage(page))throw new Error('Invalid shop response');
      setItems(current=>after?[...current,...page.items.filter(row=>!current.some(item=>item.membershipId===row.membershipId))]:page.items);setCursor(page.nextCursor);
    }catch(cause){if(revision===listRequest.current)setError(cause instanceof ApiClientError?cause.message:t('Shops could not be loaded. Please try again.'));}
    finally{if(revision===listRequest.current)setLoading(false);}
  },[t]);
  useEffect(()=>{
    if(status!=='authenticated'||!user)return;
    let active=true;
    queueMicrotask(()=>{if(!active)return;setPending('');setSelected(null);try{setSuggested(sessionStorage.getItem(shopPreferenceKey(user.id))??'');}catch{}void load();});
    return()=>{active=false;invalidate();};
  },[status,user,load,invalidate]);
  useEffect(()=>{if(selected)selectionTitle.current?.focus();},[selected]);
  async function choose(tenantId:string){
    if(!user)return;
    const revision=++request.current;listRequest.current++;sessionBoundary.reset();
    setSelected(null);setPending(tenantId);setLoading(false);setError("");
    try{sessionStorage.removeItem(shopPreferenceKey(user.id));}catch{}
    try{
      const context=await api.get<ShopContext>(`/tenant-session/memberships/${encodeURIComponent(tenantId)}`);
      if(revision!==request.current)return;
      if(!validShopContext(context,tenantId,user.id))throw new Error('Invalid shop response');
      setSelected(context);setSuggested(tenantId);
      try{sessionStorage.setItem(shopPreferenceKey(user.id),tenantId);}catch{}
    }catch(cause){if(revision===request.current){setSuggested('');setError(cause instanceof ApiClientError?cause.message:t('Shop access could not be verified. Please try again.'));}}
    finally{if(revision===request.current)setPending('');}
  }
  if(status!=='authenticated')return <SessionSkeleton>{t('Checking your session…')}</SessionSkeleton>;
  return <main className="shop-access">
    <header className="shop-access-top"><span className="shop-access-brand"><Building2 size={21}/>{t('Pharmacy')}</span><div>
      <button onClick={()=>setLanguage(language==='en'?'bn':'en')} type="button">{language==='en'?'বাংলা':'English'}</button>
      <button type="button" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label={t(theme==='dark'?'Switch to light mode':'Switch to dark mode')}>{theme==='dark'?<Sun size={18}/>:<Moon size={18}/>}</button>
      <button type="button" onClick={logout}><LogOut size={16}/>{t('Sign out')}</button>
    </div></header>
    <div className="shop-access-heading"><h1>{t('Your shops')}</h1><p>{t('Choose a shop to review your access.')} <span>{user?.fullName}</span></p></div>
    <div className="shop-preview-notice" role="note">{t('Shop access preview. Sales and other shop tools are not available here yet.')}</div>
    {error&&<div className="shop-access-error" role="alert"><p>{error}</p><button type="button" disabled={loading||!!pending} onClick={()=>void load()}>{t('Reload shops')}</button></div>}
    {selected&&<section className="shop-selected" aria-labelledby="selected-shop-title"><Check size={22}/><div><h2 id="selected-shop-title" tabIndex={-1} ref={selectionTitle}>{selected.tenant.name}</h2><p>{t(workspaceEnabled?'Selected shop':'Access verified')}{!workspaceEnabled&&` · ${selected.role.name}`}</p>{!workspaceEnabled&&<small>{selected.allBranches?t('All shop branches'):`${selected.branchIds.length} ${t('Assigned branches')}`}</small>}</div></section>}
    {selected&&workspaceEnabled&&<TenantWorkspace key={`${selected.tenant.id}:${selected.membershipId}`} selected={selected}/>}
    <section aria-label={t('Available shops')} aria-busy={loading||!!pending} className="shop-access-list">
      {items.map(item=><button type="button" key={item.membershipId} className="shop-choice" aria-pressed={selected?.tenant.id===item.tenant.id} disabled={!!pending||loading} onClick={()=>void choose(item.tenant.id)}>
        <span className="shop-choice-icon"><Building2 size={22}/></span><span className="shop-choice-copy"><strong>{item.tenant.name}</strong><small>{item.role.name}</small>{suggested===item.tenant.id&&!selected&&<small>{t('Last selected on this tab')}</small>}</span><span className="shop-choice-action">{pending===item.tenant.id?t('Checking…'):selected?.tenant.id===item.tenant.id?<Check size={18}/>:<ChevronRight size={18}/>}</span>
      </button>)}
      {loading&&<DataSkeleton variant="cards" rows={3}>{t('Loading shops…')}</DataSkeleton>}
      {!loading&&!error&&!items.length&&!cursor&&<div className="shop-empty"><Building2 size={32}/><h2>{t('No shops available')}</h2><p>{t('Contact your administrator to check your shop access.')}</p><button type="button" onClick={()=>void load()}>{t('Reload shops')}</button></div>}
    </section>
    {!loading&&cursor&&<button className="shop-load-more" type="button" disabled={!!pending} onClick={()=>void load(cursor)}>{t('Load more shops')}</button>}
  </main>;
}
