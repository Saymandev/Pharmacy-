import type { ReactNode } from "react";
import { Pill } from "lucide-react";

type Variant="table"|"cards"|"form"|"report";
export function SkeletonBar({className=""}:{className?:string}){return <span className={`skeleton-bar ${className}`} aria-hidden="true"/>;}
export function DataSkeleton({children,variant="table",rows=5,className=""}:{children?:ReactNode;variant?:Variant;rows?:number;className?:string}){
 return <div className={`data-loading loading-skeleton skeleton-${variant} ${className}`} role="status" aria-live="polite" aria-busy="true"><span className="sr-only">{children||"Loading"}</span><div className="skeleton-layout" aria-hidden="true">{Array.from({length:rows},(_,i)=><div className="skeleton-item" key={i}>{variant==="cards"&&<SkeletonBar className="skeleton-picture"/>}<SkeletonBar className="skeleton-primary"/><SkeletonBar className="skeleton-secondary"/>{variant!=="form"&&<SkeletonBar className="skeleton-tertiary"/>}</div>)}</div></div>;
}
export function SessionSkeleton({children}:{children:ReactNode}){
 return <main className="auth-loading session-loading" role="status" aria-live="polite" aria-busy="true"><div className="session-skeleton-card"><span className="session-skeleton-brand" aria-hidden="true"><Pill size={24}/></span><p>{children}</p><div className="session-skeleton-fields" aria-hidden="true"><SkeletonBar className="session-title"/><SkeletonBar className="session-subtitle"/><SkeletonBar className="session-input"/><SkeletonBar className="session-input"/><SkeletonBar className="session-submit"/></div></div></main>;
}
