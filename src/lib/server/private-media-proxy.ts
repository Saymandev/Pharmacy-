import {validMediaFiles,mediaMimes,mediaDownloadName} from '../../features/shops/media-policy.ts';
/** Bound multipart bytes before parsing; never rely on an untrusted Content-Length. */
export async function readPrivateMediaUpload(request:Request):Promise<FormData|null>{
 const url=new URL(request.url),query=[...url.searchParams.entries()];
 if(query.length!==2||url.searchParams.get('purpose')!=='library'||!/^[0-9a-f-]{36}$/i.test(url.searchParams.get('branchId')??'')||query.some(([k])=>!['branchId','purpose'].includes(k))||!request.headers.get('content-type')?.startsWith('multipart/form-data;'))return null;
 const reader=request.body?.getReader();if(!reader)return null;
 const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>10485760+65536){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}
 try{const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  const form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData(),entries=[...form.entries()];
  if(entries.some(([key,value])=>key!=='files'||!(value instanceof File))||!validMediaFiles(entries.map(([,v])=>v as File)))return null;
  return form;
 }catch{return null;}
}
export function privateMediaHeaders(upstream:Headers):Record<string,string>|null{
 const mime=upstream.get('content-type')?.split(';')[0],length=Number(upstream.get('content-length'));
 if(!mediaMimes.includes(mime as typeof mediaMimes[number])||!Number.isSafeInteger(length)||length<1||length>5242880)return null;
 return {'Content-Type':mime!,'Content-Length':String(length),'Content-Disposition':`attachment; filename="${mediaDownloadName('private-file',mime!)}"`,'X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'",'Cache-Control':'private, no-store, max-age=0'};
}
