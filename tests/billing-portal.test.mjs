import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validBillingRequest,validBillingPortal,validBillingReview} from '../src/features/shops/billing-portal-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {platformTarget} from '../src/lib/server/platform-policy.ts';
test('billing claims cannot carry approval, foreign-shop or financial authority fields',()=>{
 const renewal={kind:'RENEWAL',note:'Please renew this agreement'};assert.equal(validBillingRequest(renewal),true);assert.equal(validBillingRequest({...renewal,targetTenantId:'b'}),false);assert.equal(validBillingRequest({...renewal,paid:true}),false);
 const payment={kind:'PAYMENT_REVIEW',invoiceId:'11111111-1111-4111-8111-111111111111',method:'BANK',reference:'BANK-123',amount:'100.00',note:'Please check transfer'};assert.equal(validBillingRequest(payment),true);for(const amount of ['0.00','1e5','100','-1.00','100000000.00'])assert.equal(validBillingRequest({...payment,amount}),false);assert.equal(validBillingRequest({...payment,verified:true}),false);
 assert.equal(validBillingReview({revision:1,status:'RESOLVED',response:'Transfer checked separately'}),true);assert.equal(validBillingReview({revision:1,status:'VERIFIED',response:'Transfer checked separately'}),false);
});
test('portal validates scope and excludes draft states; BFF allows only explicit recovery routes',()=>{
 const data={targetTenantId:'a',subscription:null,invoices:[],requests:[]};assert.equal(validBillingPortal(data,'a'),true);assert.equal(validBillingPortal(data,'b'),false);assert.equal(validBillingPortal({...data,invoices:[{state:'DRAFT'}]},'a'),false);
 const config={session:'true',workspace:'true',base:'https://backend.test/api/v1',writes:'false'};assert.ok(tenantWorkspaceTarget('a',['billing','portal'],'GET',config));assert.equal(tenantWorkspaceTarget('a',['billing','requests'],'POST',config),null);assert.ok(tenantWorkspaceTarget('a',['billing','requests'],'POST',{...config,writes:'true'}));assert.equal(tenantWorkspaceTarget('a',['billing','invoices','x','settle'],'POST',{...config,writes:'true'}),null);
 const platform={enabled:'true',writes:'true',base:'https://backend.test/platform'};assert.ok(platformTarget(['shops','a','billing-requests'],'GET',platform));assert.ok(platformTarget(['shops','a','billing-requests','r','review'],'POST',platform));assert.equal(platformTarget(['shops','a','billing-requests','r','review'],'DELETE',platform),null);
});
