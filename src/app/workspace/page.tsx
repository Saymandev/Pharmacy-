"use client";
import {useEffect,useState} from 'react';
import {useRouter} from 'next/navigation';
import {useAuth} from '@/components/providers/auth-provider';
import {SessionSkeleton} from '@/components/ui/skeleton';
import {api,ApiClientError} from '@/lib/api/client';
import {validPlatformSession} from '@/features/platform/platform-policy';
import {useLanguage} from '@/lib/i18n/language-provider';

export default function WorkspaceEntry(){
 const {status,user,saasMode,logout}=useAuth(),router=useRouter(),{t}=useLanguage();
 const [error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(status==='anonymous'){router.replace('/login');return;}
  if(status!=='authenticated'||!user)return;
  if(!saasMode){router.replace('/dashboard');return;}
  let active=true;const controller=new AbortController();
  void api.get<unknown>('/platform/session',{signal:controller.signal}).then(session=>{
   if(!active)return;
   if(!validPlatformSession(session,user.id))throw new Error('Platform access could not be verified.');
   router.replace('/platform');
  }).catch(cause=>{
   if(!active)return;
   if(cause instanceof ApiClientError&&cause.status===403){router.replace('/shops');return;}
   if(cause instanceof ApiClientError&&cause.status===401){window.location.replace('/login');return;}
   setError('Workspace access could not be verified. Please try again.');
  });
  return()=>{active=false;controller.abort();};
 },[status,user,saasMode,router,retry]);
 if(error)return <main className="session-entry-error"><div role="alert">{t(error)}</div><button type="button" onClick={()=>{setError('');setRetry(v=>v+1);}}>{t('Retry access')}</button><button type="button" onClick={logout}>{t('Sign out')}</button></main>;
 return <SessionSkeleton>{t('Opening your workspace…')}</SessionSkeleton>;
}
