import test from 'node:test';import assert from 'node:assert/strict';
import {tenantWorkspaceTarget,validMasterBody} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111',config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};
test('master mutations restrict kinds, methods, identities and fields',()=>{
 for(const kind of ['categories','generics','groups','manufacturers','units']){assert.ok(tenantWorkspaceTarget('a',['pharmacy',kind],'POST',config));for(const method of ['PATCH','DELETE'])assert.ok(tenantWorkspaceTarget('a',['pharmacy',kind,id],method,config));assert.equal(tenantWorkspaceTarget('a',['pharmacy',kind,id],'PUT',config),null);assert.equal(tenantWorkspaceTarget('a',['pharmacy',kind],'POST',{...config,writes:'false'}),null);}
 assert.equal(tenantWorkspaceTarget('a',['pharmacy','suppliers',id],'DELETE',config),null);assert.equal(validMasterBody({name:'Valid',nameBangla:null},'POST'),true);for(const body of [{name:''},{name:'x'.repeat(101)},{name:'Valid',tenantId:'b'},{name:'Valid',isActive:true},{name:'Valid',nameBangla:'x'.repeat(151)}])assert.equal(validMasterBody(body,'POST'),false);assert.equal(validMasterBody({},'DELETE'),true);assert.equal(validMasterBody({tenantId:'b'},'DELETE'),false);
});
test('master transport binds scope and does not retry an uncertain create',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:false,message:'Unavailable'},{status:503});});
 await assert.rejects(client.saveMaster('categories',null,{name:'Valid'}));assert.equal(calls.length,1);assert.match(calls[0].url,/tenant-workspace\/a\/pharmacy\/categories$/);assert.equal(calls[0].options.method,'POST');client.dispose();await assert.rejects(client.saveMaster('units',id,{},true));assert.equal(calls.length,1);
});
