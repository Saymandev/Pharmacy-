import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validBillingHistory} from '../src/features/shops/billing-history-policy.ts';
import {tenantWorkspaceTarget} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111';
const payment={id,currency:'BDT',amountMinor:10000,method:'BANK',reference:'BANK-123',receivedAt:'2026-11-01T00:00:00Z',createdAt:'2026-11-01T00:00:00Z',state:'VERIFIED',allocatedMinor:2000,refundedMinor:1000,reservedMinor:1500,availableMinor:5500};
const page=(items=[payment])=>({targetTenantId:'a',kind:'PAYMENTS',availableShopCreditMinor:500,items});
test('payment history validates exact safe projection, funding arithmetic, states and shop',()=>{
 assert.equal(validBillingHistory(page(),'a','PAYMENTS'),true);
 for(const extra of [{targetTenantId:'b'},{kind:'CREDITS'},{availableShopCreditMinor:-1},{private:'secret'},{items:[payment,payment]},{items:Array.from({length:22},()=>payment)}])assert.equal(validBillingHistory({...page(),...extra},'a','PAYMENTS'),false);
 for(const change of [{id:'bad'},{encrypted:'private'},{operatorId:'private'},{reference:''},{currency:'USD'},{availableMinor:5501},{reservedMinor:-1},{amountMinor:1e20},{allocatedMinor:10001},{createdAt:'bad'},{state:'APPROVED'},{method:'GATEWAY:private-provider'}])assert.equal(validBillingHistory(page([{...payment,...change}]),'a','PAYMENTS'),false);
 for(const state of ['PENDING','REJECTED','REVERSED']){assert.equal(validBillingHistory(page([{...payment,state,availableMinor:0}]),'a','PAYMENTS'),true);assert.equal(validBillingHistory(page([{...payment,state}]),'a','PAYMENTS'),false);}
 assert.equal(validBillingHistory(page([{...payment,method:'GATEWAY'}]),'a','PAYMENTS'),true);
});
test('credit history excludes operator reasons and metadata and only accepts explicit financial events',()=>{
 const credit={id,currency:'BDT',kind:'CREDIT_USE',amountMinor:400,invoiceNumber:'SUB-001',createdAt:payment.createdAt},data={targetTenantId:'a',kind:'CREDITS',availableShopCreditMinor:500,items:[credit]};
 assert.equal(validBillingHistory(data,'a','CREDITS'),true);
 for(const change of [{kind:'VERIFY'},{reason:'private'},{metadata:{secret:true}},{invoiceNumber:5},{amountMinor:0}])assert.equal(validBillingHistory({...data,items:[{...credit,...change}]},'a','CREDITS'),false);
 assert.equal(validBillingHistory({...data,items:[{...credit,invoiceNumber:null}]},'a','CREDITS'),true);
});
test('history transport binds shop, cursor, session lifetime and read-only route without financial commands',async()=>{
 const calls=[],session=new AbortController(),client=createWorkspaceClient('a',session.signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:page()});});
 await client.billingHistory('PAYMENTS',id);assert.equal(calls[0].url,`/api/backend/tenant-workspace/a/billing/history?kind=PAYMENTS&before=${id}`);assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.credentials,'same-origin');assert.equal(new Headers(calls[0].options.headers).has('authorization'),false);assert.equal(new Headers(calls[0].options.headers).has('x-tenant-id'),false);
 assert.throws(()=>client.billingHistory('OTHER'),/Invalid billing history/);assert.throws(()=>client.billingHistory('PAYMENTS','b/foreign'),/Invalid billing history/);client.dispose();await assert.rejects(client.billingHistory('PAYMENTS'));
 const config={session:'true',workspace:'true',base:'https://backend.test/api/v1',writes:'false'};assert.ok(tenantWorkspaceTarget('a',['billing','history'],'GET',config));assert.equal(tenantWorkspaceTarget('a',['billing','history'],'POST',{...config,writes:'true'}),null);assert.equal(tenantWorkspaceTarget('a',['billing','history','private'],'GET',config),null);
});
