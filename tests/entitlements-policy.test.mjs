import test from 'node:test';import assert from 'node:assert/strict';
import {validEntitlementBody} from '../src/features/platform/entitlement-policy.ts';
import {validShopEntitlements,canWriteFeature,entitlementFeatures} from '../src/features/shops/entitlement-policy.ts';
import {platformTarget} from '../src/lib/server/platform-policy.ts';
const effective={targetTenantId:'a',state:'ACTIVE',operable:true,revision:'test',features:Object.fromEntries(entitlementFeatures.map(k=>[k,true])),limits:{branches:0,seats:null,storageBytes:100},usage:{branches:1,seats:1,storageBytes:100,reservedStorageBytes:0}};
test('missing/foreign/expired entitlements never authorize UI writes; explicit zero and unlimited remain distinct',()=>{
 assert.ok(validShopEntitlements(effective,'a'));assert.equal(validShopEntitlements(effective,'b'),false);assert.ok(canWriteFeature(effective,'pos'));assert.equal(canWriteFeature(undefined,'pos'),false);assert.equal(canWriteFeature({...effective,operable:false,state:'EXPIRED'},'pos'),false);assert.equal(canWriteFeature({...effective,features:{...effective.features,pos:false}},'pos'),false);
 assert.equal(validShopEntitlements({...effective,limits:{seats:null}},'a'),false);
});
test('add-on bodies cannot grant payment or caller-selected tenant privileges and require write gates',()=>{
 const body={addonVersionId:'version-1',startsAt:'2026-11-16T00:00:00Z',reason:'Reviewed dedicated add-on'};assert.ok(validEntitlementBody(['shops','a','addons'],body));assert.equal(validEntitlementBody(['shops','a','addons'],{...body,paidAt:'now'}),false);assert.equal(validEntitlementBody(['shops','a','addons'],{...body,targetTenantId:'b'}),false);
 const env={enabled:'true',writes:'true',base:'http://127.0.0.1:5000/api/v1/platform'};assert.ok(platformTarget(['shops','a','entitlements'],'GET',env));assert.ok(platformTarget(['shops','a','addons'],'POST',env));assert.equal(platformTarget(['shops','a','addons'],'POST',{...env,writes:'false'}),null);
});
