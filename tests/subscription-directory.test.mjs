import test from 'node:test';import assert from 'node:assert/strict';
import {validSubscriptionDirectoryRow,validSubscriptionDirectoryPage,subscriptionDirectorySearch} from '../src/features/platform/subscription-directory-contract.ts';
import {platformTarget} from '../src/lib/server/platform-policy.ts';
const row={shop:{id:'shop-a',name:'Main Pharmacy',slug:'main',status:'SUSPENDED'},state:'PENDING_PAYMENT',subscription:{id:'sub-a',planName:'Dedicated plan',price:'100.00',currency:'BDT',termKind:'MONTHLY',periodStart:'2026-11-01T00:00:00.000Z',periodEnd:'2026-12-01T00:00:00.000Z',trialEnd:null,graceEnd:null,paidThrough:null,canceledAt:null,cancelAtEnd:false,scheduledChange:false}};
test('directory accepts separate shop/billing states and rejects malformed or overexposed contracts',()=>{
 assert(validSubscriptionDirectoryRow(row));assert(validSubscriptionDirectoryRow({...row,state:'UNASSIGNED',subscription:null}));
 for(const bad of [{...row,state:'UNASSIGNED'},{...row,subscription:null},{...row,shop:{...row.shop,password:'hidden'}},{...row,subscription:{...row.subscription,snapshot:{tenantIds:['foreign']}}},{...row,state:'FORGED'},{...row,subscription:{...row.subscription,currency:'USD'}},{...row,subscription:{...row.subscription,periodEnd:'invalid'}},{...row,subscription:{...row.subscription,termKind:'LIFETIME'}}])assert.equal(validSubscriptionDirectoryRow(bad),false);
});
test('page validation rejects stale pages and duplicate shop rows',()=>{
 const value={asOf:'2026-11-19T00:00:00.000Z',data:[row],pagination:{page:1,pageSize:20,totalItems:1,totalPages:1,hasNextPage:false,hasPreviousPage:false}};
 assert(validSubscriptionDirectoryPage(value,1));assert.equal(validSubscriptionDirectoryPage(value,2),false);assert.equal(validSubscriptionDirectoryPage({...value,data:[row,row],pagination:{...value.pagination,totalItems:2}},1),false);
});
test('search retains literal user text and global reads cannot become arbitrary writes',()=>{
 const q=new URLSearchParams(subscriptionDirectorySearch({page:2,search:'Main & 10%',state:'PENDING_PAYMENT',shopStatus:'SUSPENDED',endingIn:'7',sort:'renewal'}));assert.equal(q.get('search'),'Main & 10%');assert.equal(q.get('page'),'2');assert.equal(q.get('endingIn'),'7');assert.equal(q.get('state'),'PENDING_PAYMENT');
 const config={enabled:'true',writes:'true',base:'https://backend.test/api/v1/platform'};assert(platformTarget(['subscriptions'],'GET',config));assert.equal(platformTarget(['subscriptions'],'POST',config),null);assert.equal(platformTarget(['subscriptions'],'GET',{...config,enabled:'false'}),null);assert(platformTarget(['subscriptions'],'GET',{...config,writes:'false'}));
});
