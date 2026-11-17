import {test} from 'node:test';import assert from 'node:assert/strict';
import {validInviteBody,validInviteCommand,validInvitePage,validMemberBody,validMemberReceipt} from '../src/features/shops/team-invitation-policy.ts';
import {memberInvitationTarget} from '../src/lib/server/member-invitation-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
import {createMemberClient} from '../src/features/shops/member-invitation-client.ts';
const id='77777777-7777-4777-8777-777777777777',branch='11111111-1111-4111-8111-111111111111',token=id+'.'+'a'.repeat(43),body={email:'member@example.test',roleId:id,allBranches:false,branchIds:[branch],homeBranchId:branch,hours:24};
test('invitation requests bind role, branches and consent; no identity or tenant override accepted',()=>{
 assert.ok(validInviteBody(body));for(const change of [{tenantId:'b'},{password:'secret'},{branchIds:[]},{allBranches:true},{hours:169},{homeBranchId:id}])assert.equal(validInviteBody({...body,...change}),false);assert.ok(validInviteBody({...body,allBranches:true,branchIds:[]}));
 assert.ok(validMemberBody({token}));assert.ok(validMemberBody({token,confirm:true},true));for(const v of [{token,tenantId:'b'},{token,confirm:false},{token:token+'extra',confirm:true}])assert.equal(validMemberBody(v,true),false);
 assert.ok(validInviteCommand({id,targetTenantId:'a',status:'PENDING',token},'a','issue'));assert.equal(validInviteCommand({id,targetTenantId:'b',status:'PENDING',token},'a','issue'),false);assert.equal(validInviteCommand({id,targetTenantId:'a',status:'REVOKED',token},'a','revoke',id),false);
});
test('projections verify all branch grants and forbid tokens in list responses',()=>{
 const row={id,targetTenantId:'a',email:body.email,roleId:id,roleName:'Cashier',allBranches:false,branchIds:[branch],homeBranchId:branch,status:'PENDING',expiresAt:'2026-11-18T00:00:00Z',createdAt:'2026-11-17T00:00:00Z'},list={targetTenantId:'a',page:1,pageSize:20,totalItems:1,items:[row]};assert.ok(validInvitePage(list,'a',1));assert.equal(validInvitePage({...list,items:[{...row,token}]},'a',1),false);assert.equal(validInvitePage({...list,items:[{...row,targetTenantId:'b'}]},'a',1),false);
 const receipt={id,targetTenantId:'a',shopName:'Main shop',roleName:'Cashier',allBranches:false,branchIds:[branch],branches:[{id:branch,name:'Main branch'}],homeBranchId:branch,status:'PENDING',expiresAt:row.expiresAt,acceptedAt:null};assert.ok(validMemberReceipt(receipt,token));assert.equal(validMemberReceipt({...receipt,branches:[{id,name:'Foreign branch'}]},token),false);assert.equal(validMemberReceipt({...receipt,password:'secret'},token),false);
});
test('BFF gates separate identity acceptance from shop scope and disallow arbitrary target paths',()=>{
 const cfg={enabled:'true',base:'https://backend.test/api/v1/member-invitations'};assert.equal(memberInvitationTarget(['accept'],'POST',cfg),cfg.base+'/accept');for(const path of [[],['accept','extra'],['users'],['..']])assert.equal(memberInvitationTarget(path,'POST',cfg),null);assert.equal(memberInvitationTarget(['preview'],'GET',cfg),null);assert.equal(memberInvitationTarget(['accept'],'POST',{...cfg,enabled:'false'}),null);assert.equal(memberInvitationTarget(['accept'],'POST',{...cfg,base:'https://user:pass@backend.test/member-invitations'}),null);
 const config={session:'true',workspace:'true',writes:'true',base:'https://back.test/api/v1'};assert.ok(tenantWorkspaceTarget('a',['team','invitations'],'POST',config));assert.ok(tenantWorkspaceTarget('a',['team','invitations',id,'revoke'],'POST',config));assert.equal(tenantWorkspaceTarget('a',['team','invitations',id,'accept'],'POST',config),null);assert.equal(tenantWorkspaceTarget('a',['team','invitations'],'POST',{...config,writes:'false'}),null);
});
test('transports use only same-origin cookies, keep token in POST body and stop after disposal',async()=>{
 const calls=[],fetcher=async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{}});},signal=new AbortController().signal;
 const team=createWorkspaceClient('a',signal,fetcher);await team.teamInvite(body,'operation-key-12345');await team.revokeTeamInvite(id,'operation-key-67890');assert.ok(calls.every(c=>!('Authorization'in c.options.headers)&&!('X-Tenant-Id'in c.options.headers)));
 const member=createMemberClient(signal,fetcher);await member.request(token,true);const call=calls.at(-1);assert.equal(call.url,'/api/backend/member-invitations/accept');assert.deepEqual(JSON.parse(call.options.body),{token,confirm:true});assert.ok(!call.url.includes(token));member.dispose();await assert.rejects(member.request(token));team.dispose();await assert.rejects(team.teamInvitations(1));
});
