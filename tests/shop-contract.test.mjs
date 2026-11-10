import assert from 'node:assert/strict';
import test from 'node:test';
import {shopPreferenceKey,validShopContext,validShopPage} from '../src/features/shops/shop-contract.ts';
import {tenantSessionRouteAllowed} from '../src/lib/server/tenant-session-gate.ts';
const context={tenant:{id:'a',name:'A',slug:'a'},membershipId:'m',userId:'u',role:{id:'r',name:'Cashier'},permissions:['sale:read'],allBranches:false,branchIds:['a1'],homeBranchId:'a1'};
test('shop context must match both actor and selected shop and rejects wildcard permissions',()=>{
 assert.equal(validShopContext(context,'a','u'),true);
 for(const value of [{...context,userId:'foreign'},{...context,tenant:{id:'b'}},{...context,permissions:['*']},{...context,branchIds:['a1',null]},{...context,allBranches:'true'}])assert.equal(validShopContext(value,'a','u'),false);
 assert.notEqual(shopPreferenceKey('a'),shopPreferenceKey('b'));
});
test('server rollout gate is off by default and allows only GET discovery/context paths',()=>{
 for(const flag of [undefined,'false','1','TRUE'])assert.equal(tenantSessionRouteAllowed(['tenant-session','memberships'],'GET',flag),false);
 assert.equal(tenantSessionRouteAllowed(['tenant-session','memberships'],'GET','true'),true);
 assert.equal(tenantSessionRouteAllowed(['tenant-session','memberships','a'],'GET','true'),true);
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal(tenantSessionRouteAllowed(['tenant-session','memberships'],''+method,'true'),false);
 for(const path of [['tenant-session'],['tenant-session','jobs'],['tenant-session','memberships','../b'],['tenant-session','memberships','a','extra']])assert.equal(tenantSessionRouteAllowed(path,'GET','true'),false);
});
test('shop directory rejects malformed or oversized responses before rendering',()=>{
 const membership={membershipId:'m',tenant:{id:'a',name:'A',slug:'a'},role:{id:'r',name:'Cashier'}};
 assert.equal(validShopPage({items:[membership],nextCursor:null}),true);
 for(const value of [null,{items:[{}],nextCursor:null},{items:[{...membership,tenant:{...membership.tenant,id:'../foreign'}}],nextCursor:null},{items:Array(51).fill(membership),nextCursor:null},{items:[],nextCursor:'invalid'}])assert.equal(validShopPage(value),false);
 for(const value of [null,{}, {...context,tenant:{id:'a'}}])assert.equal(validShopContext(value,'a','u'),false);
});
