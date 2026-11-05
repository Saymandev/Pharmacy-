"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Check, RefreshCw, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api/client";
import { readPagination } from "@/lib/api/pagination";
import { canVisitWorkspace } from "@/lib/access/workspace-policy";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/lib/i18n/language-provider";

type Notification = { id:string; title:string; message?:string; isRead:boolean; createdAt?:string };
type Envelope = { data:Notification[]; meta?:{unreadCount?:number} };
import { NOTIFICATIONS_CHANGED, OPEN_NOTIFICATIONS } from "@/features/notifications/events";
import { useNotificationSocket } from "@/features/notifications/use-notification-socket";

export function NotificationMenu(){
 const realtime=useNotificationSocket();
 const {t,language}=useLanguage(),{hasPermission}=useAuth(),router=useRouter();
 const [open,setOpen]=useState(false),[items,setItems]=useState<Notification[]>([]),[unread,setUnread]=useState<number|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(""),[busy,setBusy]=useState(false),[page,setPage]=useState(1),[pages,setPages]=useState(1);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),request=useRef(0),lock=useRef(false);
 const invalidate=useCallback(()=>{request.current++;},[]);
 const refresh=useCallback(async(quiet=false)=>{
  const id=++request.current;if(!quiet)setLoading(true);
  try{const result=await api.getWithMeta<Envelope>(`/communication/notifications?page=${page}&limit=10`);if(id!==request.current)return;
   if(!Array.isArray(result.data))throw new Error("Invalid notification response");
   setItems(result.data);const count=result.meta?.unreadCount;setUnread(typeof count==="number"&&Number.isFinite(count)?Math.max(0,count):null);setPages(readPagination(result,result.data.length,page,10).totalPages);setError("");
  }catch{if(id===request.current)setError("Could not load notifications. Please retry.");}
  finally{if(id===request.current)setLoading(false);}
 },[page]);
 useEffect(()=>{
  const timer=window.setTimeout(()=>void refresh(),0);
  const sync=()=>void refresh(true);
  window.addEventListener(NOTIFICATIONS_CHANGED,sync);
  return()=>{window.clearTimeout(timer);window.removeEventListener(NOTIFICATIONS_CHANGED,sync);invalidate();};
 },[refresh,invalidate]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(event.target instanceof Node&&!root.current?.contains(event.target))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"){event.stopPropagation();setOpen(false);trigger.current?.focus();}};
  document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape);
  return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape);};
 },[open]);
 async function markRead(id?:string){
  if(lock.current)return;lock.current=true;setBusy(true);setError("");request.current++;
  try{await api.patch(id?`/communication/notifications/${encodeURIComponent(id)}/read`:"/communication/notifications/read-all",{});window.dispatchEvent(new CustomEvent(NOTIFICATIONS_CHANGED,{detail:{source:"header"}}));}
  catch{setError("Could not update notifications. Please retry.");}
  finally{lock.current=false;setBusy(false);}
 }
 const date=(value?:string)=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat(language==="bn"?"bn-BD":"en-GB",{timeZone:"Asia/Dhaka",dateStyle:"medium",timeStyle:"short"}).format(new Date(value)):"";
 return <div className="notification-menu" ref={root}><button ref={trigger} className="icon-button notification-button" type="button" aria-label={t("Notifications")} title={unread?`${t("Notifications")} (${unread})`:t("Notifications")} aria-expanded={open} aria-controls="header-notification-panel" onClick={()=>{setOpen(value=>!value);if(!open)void refresh();}}><Bell size={18}/>{!error&&unread!==null&&unread>0&&<span className="notification-unread-badge" aria-label={t("{count} unread notifications",{count:unread})}>{unread>99?"99+":unread}</span>}</button>
 {open&&<section id="header-notification-panel" className="notification-panel" role="region" aria-label={t("Notification panel")}><header><div><strong>{t("Notifications")}</strong><small>{error?t("Unavailable"):unread===null?t("Loading…"):t("{count} unread notifications",{count:unread})}</small></div><button type="button" disabled={loading||busy} onClick={()=>void refresh()} aria-label={t("Refresh notifications")}><RefreshCw size={15}/></button><button type="button" onClick={()=>{setOpen(false);trigger.current?.focus();}} aria-label={t("Close notifications")}><X size={17}/></button></header>
 {error&&<div className="notification-error" role="alert"><span>{t(error)}</span><button type="button" disabled={busy||loading} onClick={()=>void refresh()}>{t("Retry")}</button></div>}
 <div className="notification-realtime" data-connected={realtime.state==="connected"}><span>{t(realtime.state==="connected"?"Live updates connected":realtime.state==="connecting"?"Connecting live updates…":"Live updates disconnected")}</span>{realtime.state==="disconnected"&&<button type="button" onClick={realtime.reconnect}>{t("Reconnect")}</button>}</div>
 <div className="notification-panel-list" aria-busy={loading}>{loading?<p role="status" className="notification-empty">{t("Loading notifications…")}</p>:!items.length&&!error?<div className="notification-empty"><Bell size={25}/><strong>{t("No notifications yet")}</strong><span>{t("Your latest alerts will appear here.")}</span></div>:items.map(item=><article key={item.id} className={item.isRead?"":"unread"}><div><strong>{item.title}</strong>{item.message&&<p>{item.message}</p>}<time dateTime={item.createdAt}>{date(item.createdAt)}</time></div>{!item.isRead&&<button type="button" disabled={busy||loading} onClick={()=>void markRead(item.id)} aria-label={t("Mark {title} as read",{title:item.title})} title={t("Mark read")}><Check size={16}/></button>}</article>)}</div>
 {pages>1&&<nav className="notification-panel-pagination" aria-label={t("Notification pages")}><button type="button" disabled={page<=1||loading||busy} onClick={()=>setPage(value=>value-1)}>{t("Previous")}</button><span>{t("Page")} {page} / {pages}</span><button type="button" disabled={page>=pages||loading||busy} onClick={()=>setPage(value=>value+1)}>{t("Next")}</button></nav>}
 <footer><button type="button" disabled={busy||loading||!!error||!unread} onClick={()=>void markRead()}>{t("Mark all read")}</button>{canVisitWorkspace("/admin",hasPermission)&&<button type="button" onClick={()=>{setOpen(false);window.dispatchEvent(new Event(OPEN_NOTIFICATIONS));router.push("/admin");}}>{t("View all notifications")}</button>}</footer></section>}
 </div>;
}
