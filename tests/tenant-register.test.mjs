import test from 'node:test';import assert from 'node:assert/strict';
import {validRegister,validRegisterBody} from '../src/features/shops/register-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111',row={id,tenantId:'a',branchId:id,userId:'u',status:'open',openingBalance:'100',closingBalance:'95',actualBalance:null,difference:null,openingNote:null,closingNote:null,openedAt:'2026-11-11T01:00:00Z',closedAt:'2026-11-11T01:00:00Z'};
test('register payloads require own actor, tenant and branch, bounded cents and closed count',()=>{
 assert.ok(validRegister(row,'a',id,'u'));for(const patch of [{tenantId:'b'},{userId:'other'},{branchId:'other'},{closingBalance:-1},{openingBalance:'NaN'},{status:'closed'},{openingBalance:.001}])assert.equal(validRegister({...row,...patch},'a',id,'u'),false);
 assert.ok(validRegister({...row,status:'closed',actualBalance:94,difference:-1},'a',id,'u'));
 assert.ok(validRegisterBody({branchId:id,openingBalance:0}));assert.equal(validRegisterBody({branchId:id,openingBalance:0,userId:'u'}),false);
 assert.equal(validRegisterBody({branchId:id,expectedBalance:95,actualBalance:94},true),false);assert.ok(validRegisterBody({branchId:id,expectedBalance:95,actualBalance:94,closingNote:'Short count'},true));
});
test('register routes enforce write gates and reject unrestricted or legacy methods',()=>{
 const c={session:'true',workspace:'true',writes:'true',base:'https://backend.test/api/v1'};
 for(const [path,method]of [[['pharmacy','cash-register'],'GET'],[['pharmacy','cash-register','active'],'GET'],[['pharmacy','cash-register',id,'movements'],'GET'],[['pharmacy','cash-register','open'],'POST'],[['pharmacy','cash-register',id,'close'],'POST']])assert.ok(tenantWorkspaceTarget('a',path,method,c));
 assert.equal(tenantWorkspaceTarget('a',['pharmacy','cash-register','open'],'POST',{...c,writes:'false'}),null);assert.equal(tenantWorkspaceTarget('a',['pharmacy','cash-register',id],'DELETE',c),null);
});
test('register retry retains exact body/key and disposed sessions cannot send',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:row});});const body={branchId:id,openingBalance:100},key='register-key-123456';
 await client.saveRegister(null,body,key);await client.saveRegister(null,body,key);assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.headers['Idempotency-Key'],key);assert.match(calls[0].url,/tenant-workspace\/a\/pharmacy\/cash-register\/open$/);client.dispose();await assert.rejects(()=>client.activeRegister(id));
});
