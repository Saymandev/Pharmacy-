import test from 'node:test';import assert from 'node:assert/strict';
import {commercialFeatures} from '../src/features/platform/commercial-policy.ts';
import {validBillingPlans,validBillingChangeQuote} from '../src/features/shops/billing-change-policy.ts';
import {validBillingRequest} from '../src/features/shops/billing-portal-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
const id='28282828-2828-4828-8828-282828282828',quoteId='29292929-2929-4929-8929-292929292929';
export const plan={name:'Renewal Plus',currency:'BDT',price:'120.00',term:{kind:'MONTHLY',days:null},features:Object.fromEntries(commercialFeatures.map(k=>[k,true])),limits:{branches:5,seats:10,storageBytes:10485760},trialDays:0,graceDays:7};
export const quote={id:quoteId,targetTenantId:'a',kind:'RENEWAL_CHANGE',planVersionId:id,subscriptionRevision:1,plan,effectiveAt:'2026-12-01T00:00:00Z',periodEnd:'2027-01-01T00:00:00Z',expiresAt:'2026-11-18T00:15:00Z',seller:{name:'Merchant',address:'Dhaka',currency:'BDT',taxMode:'NONE',taxBps:0},totals:{grossMinor:12000,discountMinor:0,subtotalMinor:12000,taxMinor:0,totalMinor:12000},usageReviewRequired:false,overdueTerm:false};
test('eligible plan catalog excludes audience/private metadata and rejects malformed or foreign projections',()=>{
 const data={targetTenantId:'a',items:[{id,plan}]};assert.equal(validBillingPlans(data,'a'),true);assert.equal(validBillingPlans(data,'b'),false);
 for(const items of [[{id,plan:{...plan,audience:{kind:'DEDICATED',tenantIds:['secret']}}}],[{id,plan,operatorId:'private'}],[{id,plan},{id,plan}],[{id:'bad',plan}]])assert.equal(validBillingPlans({...data,items},'a'),false);
});
test('change quote validates scope, exact public fields, term, currency and server tax/total arithmetic',()=>{
 assert.equal(validBillingChangeQuote(quote,'a',id),true);assert.equal(validBillingChangeQuote(quote,'b'),false);assert.equal(validBillingChangeQuote(quote,'a',quoteId),false);
 for(const change of [{operatorId:'private'},{subscriptionRevision:0},{periodEnd:quote.effectiveAt},{expiresAt:'bad'},{plan:{...plan,audience:{kind:'PUBLIC',tenantIds:[]}}},{totals:{...quote.totals,totalMinor:12001}},{totals:{...quote.totals,discountMinor:1}},{seller:{...quote.seller,currency:'USD'}},{seller:{...quote.seller,taxBps:1}},{kind:'IMMEDIATE_CHANGE'}])assert.equal(validBillingChangeQuote({...quote,...change},'a'),false);
 assert.equal(validBillingChangeQuote({...quote,seller:{...quote.seller,taxMode:'EXCLUSIVE',taxBps:500},totals:{...quote.totals,taxMinor:600,totalMinor:12600}},'a'),true);
});
test('change requests carry only quote identity/note; negotiated changes cannot carry prices or approvals',()=>{
 assert.equal(validBillingRequest({kind:'PLAN_CHANGE',quoteId,note:'Review this plan quote'}),true);assert.equal(validBillingRequest({kind:'NEGOTIATION',note:'Need a dedicated agreement'}),true);
 for(const extra of [{price:'0.01'},{approved:true},{targetTenantId:'b'},{planVersionId:id},{timing:'IMMEDIATE'}])assert.equal(validBillingRequest({kind:'PLAN_CHANGE',quoteId,note:'Review this plan quote',...extra}),false);
 assert.equal(validBillingRequest({kind:'NEGOTIATION',quoteId,note:'Need a dedicated agreement'}),false);
});
test('BFF exposes bounded plan/quote reads and write-gates quote creation without contract mutation routes',()=>{
 const config={session:'true',workspace:'true',base:'https://backend.test/api/v1',writes:'false'};assert.ok(tenantWorkspaceTarget('a',['billing','plans'],'GET',config));assert.ok(tenantWorkspaceTarget('a',['billing','change-quotes',quoteId],'GET',config));assert.equal(tenantWorkspaceTarget('a',['billing','change-quotes'],'POST',config),null);assert.ok(tenantWorkspaceTarget('a',['billing','change-quotes'],'POST',{...config,writes:'true'}));assert.equal(tenantWorkspaceTarget('a',['billing','subscription','change'],'POST',{...config,writes:'true'}),null);
});
