import assert from 'node:assert/strict';import test from 'node:test';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
const config={session:'true',workspace:'true',base:'http://127.0.0.1:4000/api/v1'};
test('tenant transport requires both gates and an explicit separate upstream; only safe reads are allowed',()=>{
 assert.deepEqual(tenantWorkspaceTarget('a',['workspace','bootstrap'],'GET',config),{tenantId:'a',url:config.base+'/workspace/bootstrap'});
 for(const value of [{...config,session:'false'},{...config,workspace:'false'},{...config,base:''},{...config,base:'http://user:password@localhost'},{...config,base:'file:///tmp'}])assert.equal(tenantWorkspaceTarget('a',['workspace','bootstrap'],'GET',value),null);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(tenantWorkspaceTarget('a',['workspace','bootstrap'],method,config),null);
 for(const path of [['pharmacy','medicines'],['workspace','bootstrap','extra'],['workspace','branches','../foreign']])assert.equal(tenantWorkspaceTarget('a',path,'GET',config),null);
 assert.equal(tenantWorkspaceTarget('../b',['workspace','bootstrap'],'GET',config),null);
});
test('shop transport binds URL, never sends caller-selected auth/header, and disables caching',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{own:true}});});
 assert.deepEqual(await client.bootstrap(),{own:true});
 assert.equal(calls[0].url,'/api/backend/tenant-workspace/a/workspace/bootstrap');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(calls[0].options.cache,'no-store');
 assert.deepEqual(calls[0].options.headers,{Accept:'application/json'});client.dispose();
 await assert.rejects(client.bootstrap(),error=>error.status===409);
});
test('disposed shop rejects late decoded responses even when transport ignores AbortSignal',async()=>{
 let release,started;const ready=new Promise(resolve=>{started=resolve;});
 const client=createWorkspaceClient('a',new AbortController().signal,async()=>{started();return {ok:true,json:()=>new Promise(resolve=>{release=resolve;})};});
 const pending=client.bootstrap();await ready;await Promise.resolve();client.dispose();release({success:true,data:{shop:'a'}});
 await assert.rejects(pending,error=>error.status===409);
});
test('session revocation rejects a late response and never retries against legacy routes',async()=>{
 let release;const controller=new AbortController();let calls=0;
 const client=createWorkspaceClient('b',controller.signal,async()=>{calls++;return {ok:true,json:()=>new Promise(resolve=>{release=resolve;})};});
 const pending=client.bootstrap();await Promise.resolve();controller.abort();release({success:true,data:{shop:'b'}});
 await assert.rejects(pending,error=>error.status===409);assert.equal(calls,1);
});
