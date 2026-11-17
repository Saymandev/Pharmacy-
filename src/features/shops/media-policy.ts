export const mediaMimes=['image/png','image/jpeg','image/gif','image/webp','application/pdf'] as const;
export function mediaDownloadName(name:string,mime:string):string{
 const ext:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp','application/pdf':'pdf'},suffix=ext[mime];
 if(!suffix)throw new Error('Invalid private file type.');
 return new RegExp(suffix==='jpg'?'\\.jpe?g$':`\\.${suffix}$`,'i').test(name)?name:`${name.replace(/\.[^.]*$/,'')||'file'}.${suffix}`;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const id=(v:unknown)=>typeof v==='string'&&/^[0-9a-f-]{36}$/i.test(v);
const date=(v:unknown)=>typeof v==='string'&&Number.isFinite(Date.parse(v));
export type MediaRow={id:string;tenantId:string;branchId:string;fileName:string;mimeType:string;size:number;type:'image'|'document';purpose:'library';state:'READY'|'DELETED';metadata:null|{altText?:string;caption?:string;tags?:string[]};createdAt:string;updatedAt:string;deletedAt:string|null};
export type MediaPage={data:MediaRow[];pagination:{page:number;pageSize:number;totalItems:number;totalPages:number;hasNextPage:boolean;hasPreviousPage:boolean}};
export function validMediaMetadata(v:unknown):boolean{return object(v)&&Object.keys(v).every(k=>['altText','caption','tags'].includes(k))&&(!('altText'in v)||typeof v.altText==='string'&&v.altText.length<=300)&&(!('caption'in v)||typeof v.caption==='string'&&v.caption.length<=500)&&(!('tags'in v)||Array.isArray(v.tags)&&v.tags.length<=10&&v.tags.every(x=>typeof x==='string'&&x.trim().length>0&&x.length<=32));}
export function validMedia(v:unknown,tenant:string,branch:string):v is MediaRow{
 return object(v)&&id(v.id)&&v.tenantId===tenant&&v.branchId===branch&&v.purpose==='library'&&typeof v.fileName==='string'&&v.fileName.trim().length>0&&v.fileName.length<=150&&!/[\\/\u0000-\u001f\u007f]/.test(v.fileName)&&mediaMimes.includes(v.mimeType as typeof mediaMimes[number])&&Number.isSafeInteger(v.size)&&Number(v.size)>0&&Number(v.size)<=5242880&&v.type===(v.mimeType==='application/pdf'?'document':'image')&&['READY','DELETED'].includes(String(v.state))&&(v.metadata===null||validMediaMetadata(v.metadata))&&date(v.createdAt)&&date(v.updatedAt)&&(v.state==='READY'?v.deletedAt===null:date(v.deletedAt))&&!['storageKey','url','publicId','sha256'].some(k=>k in v);
}
export function validMediaPage(v:unknown,tenant:string,branch:string,page:number):v is MediaPage{
 if(!object(v)||!Array.isArray(v.data)||v.data.length>24||!v.data.every(r=>validMedia(r,tenant,branch))||new Set(v.data.map(r=>r.id)).size!==v.data.length||!object(v.pagination))return false;
 const p=v.pagination;return p.page===page&&p.pageSize===24&&Number.isSafeInteger(p.totalItems)&&Number(p.totalItems)>=0&&p.totalPages===Math.ceil(Number(p.totalItems)/24)&&typeof p.hasNextPage==='boolean'&&p.hasNextPage===(page<Number(p.totalPages))&&typeof p.hasPreviousPage==='boolean'&&p.hasPreviousPage===(page>1);
}
export function validMediaMutation(v:unknown,kind:string):boolean{
 if(!object(v)||!date(v.expectedUpdatedAt))return false;
 if(kind==='trash'||kind==='restore')return Object.keys(v).length===1;
 return kind==='rename'&&Object.keys(v).every(k=>['expectedUpdatedAt','fileName','metadata'].includes(k))&&typeof v.fileName==='string'&&v.fileName.trim().length>0&&v.fileName.length<=150&&!/[\\/\u0000-\u001f\u007f]/.test(v.fileName)&&(!('metadata'in v)||validMediaMetadata(v.metadata));
}
export function validMediaFiles(files:readonly {name:string;type:string;size:number}[]):boolean{return files.length>0&&files.length<=5&&files.every(f=>Number.isSafeInteger(f.size)&&f.size>0&&f.size<=5242880&&f.name.length>0&&f.name.length<=150&&!/[\\/\u0000-\u001f\u007f]/.test(f.name)&&mediaMimes.includes(f.type as typeof mediaMimes[number]))&&files.reduce((n,f)=>n+f.size,0)<=10485760;}
export function validUploadResult(v:unknown,tenant:string,branch:string):v is MediaRow[]{return Array.isArray(v)&&v.length>0&&v.length<=5&&new Set(v.map(r=>object(r)?r.id:null)).size===v.length&&v.every(r=>validMedia(r,tenant,branch));}
export type UploadReservation={id:string;bytes:number;remainingBytes:number;state:'PENDING';expired:boolean;expiresAt:string};
export function validUploadReservations(v:unknown):v is UploadReservation[]{return Array.isArray(v)&&v.length<=100&&v.every(r=>object(r)&&id(r.id)&&r.state==='PENDING'&&Number.isSafeInteger(r.bytes)&&Number(r.bytes)>0&&Number(r.bytes)<=10485760&&Number.isSafeInteger(r.remainingBytes)&&Number(r.remainingBytes)>=0&&Number(r.remainingBytes)<=Number(r.bytes)&&typeof r.expired==='boolean'&&date(r.expiresAt)&&!['objects','key','userId','targetTenantId'].some(k=>k in r));}
