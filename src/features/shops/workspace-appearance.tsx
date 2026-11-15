"use client";
import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createWorkspaceClient} from './workspace-client';
import {sessionBoundary} from '@/lib/api/session-boundary';

const palettes:Record<string,string[]>={pharmacy:['#16775f','#0c4c3c','#eaf5ef'],ocean:['#147c9f','#07536e','#e8f5fa'],violet:['#7350b8','#4d2d8b','#f2edfc'],slate:['#3c6975','#27464f','#eaf1f3']};
/** Appearance stays inside the selected workspace and is discarded on shop switch. */
export function WorkspaceAppearance({tenantId}:{tenantId:string}){
 const marker=useRef<HTMLSpanElement>(null);
 const [revision,setRevision]=useState(0);
 useEffect(()=>{const refresh=(event:Event)=>{if((event as CustomEvent).detail?.tenantId===tenantId)setRevision(value=>value+1);};window.addEventListener('tenant-customization-published',refresh);return()=>window.removeEventListener('tenant-customization-published',refresh);},[tenantId]);
 useEffect(()=>{let active=true;const client=createWorkspaceClient(tenantId,sessionBoundary.capture().signal),root=marker.current?.parentElement;
  void client.activeCustomization().then(value=>{if(!active||!root||!value||typeof value!=='object')return;const c=(value as {configs?:{current?:{theme?:{palette?:string;density?:string}}}}).configs?.current,theme=c?.theme;
   if(!theme||!Object.hasOwn(palettes,theme.palette??''))return;
   root.dataset.workspacePalette=theme.palette;root.dataset.density=theme.density==='compact'?'compact':'comfortable';
   const font=(theme as {font?:unknown}).font;root.dataset.workspaceFont=font==='rounded'||font==='compact'?font:'system';
   const templates=(c as {templates?:{report?:unknown}})?.templates;root.dataset.workspaceReport=templates?.report==='dense'?'dense':'standard';
  }).catch(()=>{});
  return()=>{active=false;client.dispose();if(root){delete root.dataset.workspacePalette;delete root.dataset.density;delete root.dataset.workspaceReport;delete root.dataset.workspaceFont;}};
 },[tenantId,revision]);
 return <span ref={marker} hidden style={{display:'none'} as CSSProperties}/>;
}
