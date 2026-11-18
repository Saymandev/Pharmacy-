import test from 'node:test';import assert from 'node:assert/strict';
import {validBillingCapabilities,hasBillingAccess} from '../src/features/shops/billing-access-policy.ts';
import {validBillingPortal} from '../src/features/shops/billing-portal-policy.ts';
import {validTeamBody} from '../src/features/shops/team-policy.ts';
import {validWorkspaceBootstrap} from '../src/features/shops/workspace-contract.ts';
test('billing projection is explicit, read-dependent and separate from accepted ownership',()=>{
 for(const caps of [[],['billing:read'],['billing:read','billing:request'],['billing:read','billing:proof'],['billing:read','billing:request','billing:proof']])assert.equal(validBillingCapabilities(caps),true);
 for(const caps of [null,['*'],['platform:billing:read'],['billing:request'],['billing:proof'],['billing:read','billing:read'],['billing:read','user:update']])assert.equal(validBillingCapabilities(caps),false);
 assert.equal(hasBillingAccess({allBranches:true,billingAccess:false,billingCapabilities:['billing:read']}),true);assert.equal(hasBillingAccess({allBranches:false,billingCapabilities:['billing:read']}),false);assert.equal(hasBillingAccess({allBranches:true,billingAccess:true}),false);
 const portal={targetTenantId:'a',capabilities:['billing:read'],subscription:null,invoices:[],requests:[]};assert.equal(validBillingPortal(portal,'a'),true);assert.equal(validBillingPortal({...portal,capabilities:[]},'a'),false);assert.equal(validBillingPortal({...portal,capabilities:['billing:proof']},'a'),false);
});
test('role requests require billing View for billing actions without deriving Team authority',()=>{
 const body={name:'Billing assistant',description:'Shop billing only',permissions:['billing:read','billing:request','billing:proof']};assert.equal(validTeamBody(body,'role.create'),true);assert.equal(body.permissions.includes('user:update'),false);assert.equal(body.permissions.includes('role:create'),false);
 assert.equal(validTeamBody({...body,permissions:['billing:request']},'role.create'),false);assert.equal(validTeamBody({...body,permissions:['billing:proof']},'role.create'),false);assert.equal(validTeamBody({...body,permissions:['billing:read']},'role.create'),true);
});
test('workspace accepts explicit delegated access while rejecting malformed, foreign and branch-limited projections',()=>{
 const selected={tenant:{id:'a',name:'Shop A',slug:'a'},userId:'delegate',membershipId:'member-a',role:{id:'role-a',name:'Billing reader'},permissions:['billing:read'],allBranches:true,branchIds:[],homeBranchId:null};
 const data={...selected,billingAccess:false,billingCapabilities:['billing:read'],branches:{items:[],nextCursor:null}};
 assert.equal(validWorkspaceBootstrap(data,selected),true);assert.equal(data.billingAccess,false);
 for(const change of [{billingAccess:'owner'},{billingCapabilities:['billing:request']},{billingCapabilities:['billing:read','role:create']},{allBranches:false},{tenant:{...selected.tenant,id:'b'}},{userId:'other'},{membershipId:'foreign'}])assert.equal(validWorkspaceBootstrap({...data,...change},selected),false);
 assert.equal(validWorkspaceBootstrap({...data,allBranches:false,billingCapabilities:[]},selected),true);
});
