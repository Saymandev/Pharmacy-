import {proofMimes,proofSignature} from '../../features/shops/billing-request-proof-policy.ts';
export async function boundedProofBytes(stream:ReadableStream<Uint8Array>|null){
 const reader=stream?.getReader();if(!reader)return null;const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1048576){await reader.cancel();return null;}chunks.push(value);}}finally{reader.releaseLock();}
 if(!size)return null;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return bytes;
}
export async function readRequestProofUpload(request:Request){
 const mime=request.headers.get('content-type'),key=request.headers.get('idempotency-key'),name=request.headers.get('x-proof-name');
 if(new URL(request.url).search||!mime||!proofMimes.includes(mime as typeof proofMimes[number])||!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key)||!name||name.length>1800)return null;
 try{const decoded=decodeURIComponent(name);if(!decoded.length||decoded.length>150)return null;}catch{return null;}
 const bytes=await boundedProofBytes(request.body);return bytes&&proofSignature(bytes,mime)?{body:bytes.buffer as ArrayBuffer,headers:{'Content-Type':mime,'Idempotency-Key':key,'X-Proof-Name':name}}:null;
}
export async function privateRequestProofResponse(upstream:Response){
 const mime=upstream.headers.get('content-type')?.split(';')[0],size=Number(upstream.headers.get('content-length'));
 if(!mime||!proofMimes.includes(mime as typeof proofMimes[number])||!Number.isSafeInteger(size)||size<1||size>1048576){await upstream.body?.cancel();return null;}
 const bytes=await boundedProofBytes(upstream.body);if(!bytes||bytes.length!==size||!proofSignature(bytes,mime))return null;
 const ext=mime==='application/pdf'?'pdf':mime==='image/png'?'png':'jpg';
 return new Response(bytes.buffer as ArrayBuffer,{headers:{'Content-Type':mime,'Content-Length':String(size),'Content-Disposition':`attachment; filename="billing-proof.${ext}"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'"}});
}
