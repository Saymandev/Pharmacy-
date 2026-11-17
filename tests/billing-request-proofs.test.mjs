import {test} from 'node:test';import assert from 'node:assert/strict';
import {validProofFile,validRequestProofList,validRequestProof} from '../src/features/shops/billing-request-proof-policy.ts';
import {readRequestProofUpload,privateRequestProofResponse} from '../src/lib/server/billing-request-proof-proxy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {platformTarget} from '../src/lib/server/platform-policy.ts';
import {createRequestProofClient} from '../src/features/shops/billing-request-proof-client.ts';
const requestId='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',key='33333333-3333-4333-8333-333333333333',bytes=new TextEncoder().encode('%PDF-1.4\nPrivate transfer fixture');
const proof={id,requestId,mime:'application/pdf',name:'transfer.pdf',size:bytes.length,createdAt:'2026-11-17T00:00:00Z'};
test('proof lists strictly bind request/shop and reject private fields, duplicate IDs and attachment overflow',()=>{
 const list={targetTenantId:'a',requestId,items:[proof]};assert.equal(validRequestProofList(list,'a',requestId),true);assert.equal(validRequestProofList(list,'b',requestId),false);assert.equal(validRequestProofList(list,'a',id),false);
 for(const items of [[{...proof,encrypted:'SECRET'}],[proof,proof],Array.from({length:4},(_,n)=>({...proof,id:`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`})),[{...proof,size:1048577}],[{...proof,id:'bad'}],[{...proof,mime:'text/html'}]])assert.equal(validRequestProofList({...list,items},'a',requestId),false);
 assert.equal(validRequestProof({...proof,key},requestId),false);assert.equal(validProofFile({type:'image/png',name:'transfer.png',size:1}),true);
});
test('upload BFF bounds real bytes, validates magic and never relies on client Content-Length',async()=>{
 const make=(body=bytes,headers={})=>new Request('http://localhost/proofs',{method:'POST',headers:{'Content-Type':'application/pdf','Idempotency-Key':key,'X-Proof-Name':'transfer.pdf',...headers},body});
 const result=await readRequestProofUpload(make());assert.deepEqual(new Uint8Array(result.body),bytes);assert.equal(result.headers['Idempotency-Key'],key);
 assert.equal(await readRequestProofUpload(make(new Uint8Array(1048577),{'Content-Length':'1'})),null);assert.equal(await readRequestProofUpload(make(new TextEncoder().encode('<html>'))),null);assert.equal(await readRequestProofUpload(make(bytes,{'X-Proof-Name':'%bad%'})),null);assert.equal(await readRequestProofUpload(make(bytes,{'Content-Type':'text/html'})),null);
 const downloaded=await privateRequestProofResponse(new Response(bytes,{headers:{'Content-Type':'application/pdf','Content-Length':String(bytes.length),'Content-Disposition':'inline; filename="bad.html"'}}));assert.ok(downloaded.headers.get('content-disposition').includes('attachment; filename="billing-proof.pdf"'));assert.equal(downloaded.headers.get('content-security-policy'),"sandbox; default-src 'none'");assert.equal(downloaded.headers.get('cache-control'),'private, no-store, max-age=0');
 for(const headers of [{'Content-Type':'text/html','Content-Length':'12'},{'Content-Type':'application/pdf','Content-Length':'99999999'},{'Content-Type':'application/pdf','Content-Length':'1'}])assert.equal(await privateRequestProofResponse(new Response(bytes,{headers})),null);
});
test('only explicit read/write proof routes cross the tenant and platform BFF',()=>{
 const config={session:'true',workspace:'true',base:'https://backend.test/api/v1',writes:'false'},path=['billing','requests',requestId,'proofs'];assert.ok(tenantWorkspaceTarget('a',path,'GET',config));assert.equal(tenantWorkspaceTarget('a',path,'POST',config),null);assert.ok(tenantWorkspaceTarget('a',path,'POST',{...config,writes:'true'}));assert.equal(tenantWorkspaceTarget('a',path,'DELETE',{...config,writes:'true'}),null);assert.ok(tenantWorkspaceTarget('a',['billing','request-proofs',id],'GET',config));
 const platform={enabled:'true',base:'https://backend.test/platform',writes:'true'},operator=['shops','a','billing-requests',requestId,'proofs'];assert.ok(platformTarget(operator,'GET',platform));assert.equal(platformTarget(operator,'POST',platform),null);assert.ok(platformTarget(['shops','a','billing-request-proofs',id],'GET',platform));
});
test('proof transport preserves exact file/key and rejects stale sessions and platform uploads',async()=>{
 const calls=[],signal=new AbortController(),file=new File([bytes],'transfer.pdf',{type:'application/pdf'}),client=createRequestProofClient('a',requestId,false,signal.signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:proof});});
 await client.upload(file,key);await client.upload(file,key);assert.equal(calls.length,2);assert.equal(calls[0].url,`/api/backend/tenant-workspace/a/billing/requests/${requestId}/proofs`);assert.equal(calls[0].options.body,file);assert.equal(calls[0].options.headers['Idempotency-Key'],calls[1].options.headers['Idempotency-Key']);assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(new Headers(calls[0].options.headers).has('Authorization'),false);
 client.dispose();await assert.rejects(client.list());const operator=createRequestProofClient('a',requestId,true,signal.signal);await assert.rejects(operator.upload(file,key));operator.dispose();
 let release;const late=createRequestProofClient('a',requestId,false,signal.signal,async()=>new Response(new ReadableStream({start(controller){release=()=>{controller.enqueue(new TextEncoder().encode(JSON.stringify({success:true,data:proof})));controller.close();};}}),{headers:{'Content-Type':'application/json'}}));const pending=late.list();await Promise.resolve();signal.abort();release();await assert.rejects(pending);late.dispose();
});
test('download verifies actual bytes when Next streams without Content-Length and rejects mismatches',async()=>{
 const signal=new AbortController();
 for(const platform of [false,true]){const client=createRequestProofClient('a',requestId,platform,signal.signal,async()=>new Response(bytes,{headers:{'Content-Type':'application/pdf'}}));assert.equal((await client.download(proof)).size,bytes.length);client.dispose();}
 for(const [body,headers] of [[bytes,{'Content-Type':'text/html'}],[bytes,{'Content-Type':'application/pdf','Content-Length':'1'}],[new Uint8Array(1),{'Content-Type':'application/pdf'}]]){const client=createRequestProofClient('a',requestId,false,signal.signal,async()=>new Response(body,{headers}));await assert.rejects(client.download(proof));client.dispose();}
});
