import test from 'node:test';
import assert from 'node:assert/strict';
import {activationKeys,validActivationCheck,validActivationCommand} from '../src/features/platform/activation-policy.ts';
import {platformTarget} from '../src/lib/server/platform-policy.ts';
const check={targetTenantId:'a',status:'PROVISIONING',isolationReady:false,expectedUpdatedAt:'2026-11-16T00:00:00Z',canActivate:true,checks:activationKeys.map(key=>({key,passed:true}))};
test('activation binds complete unique server checks to the selected shop',()=>{
 assert.ok(validActivationCheck(check,'a'));assert.equal(validActivationCheck(check,'b'),false);
 for(const v of [{...check,checks:check.checks.slice(1)},{...check,checks:check.checks.map(()=>check.checks[0])},{...check,checks:[null,...check.checks.slice(1)]},{...check,canActivate:false},{...check,expectedUpdatedAt:'invalid'}])assert.equal(validActivationCheck(v,'a'),false);
});
test('activation commands cannot supply readiness, status, owner or incomplete consent',()=>{
 const body={reason:'Reviewed agreement',confirm:true,expectedUpdatedAt:check.expectedUpdatedAt};assert.ok(validActivationCommand(body));
 for(const v of [{...body,isolationReady:true},{...body,status:'ACTIVE'},{...body,ownerId:'owner'},{...body,confirm:false},{...body,reason:'x'}])assert.equal(validActivationCommand(v),false);
 const env={enabled:'true',writes:'true',base:'http://127.0.0.1:5000/api/v1/platform'};
 assert.ok(platformTarget(['shops','a','activation-check'],'GET',env));assert.ok(platformTarget(['shops','a','activate'],'POST',env));
 assert.equal(platformTarget(['shops','a','activate'],'POST',{...env,writes:'false'}),null);assert.equal(platformTarget(['shops','a','activate'],'PATCH',env),null);
});
