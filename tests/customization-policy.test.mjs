import test from 'node:test';import assert from 'node:assert/strict';import {validCustomizationBody,validCustomizationResponse} from '../src/features/shops/customization-policy.ts';
const snapshot={version:2,publishedAt:'2026-11-15T00:00:00Z',theme:{palette:'ocean',font:'system',density:'compact'},templates:{pos:'cards',receipt:'standard',report:'dense'}};
test('customization rejects executable values, forged fields and malformed or repeated version history',()=>{
 assert.ok(validCustomizationBody({revision:1,theme:snapshot.theme,templates:snapshot.templates}));assert.ok(validCustomizationResponse({revision:1,configs:{current:snapshot,history:[]}}));
 for(const value of [{revision:1,theme:{...snapshot.theme,css:'evil'},templates:snapshot.templates},{revision:1,theme:{...snapshot.theme,palette:'url(evil)'},templates:snapshot.templates},{revision:1,tenantId:'foreign'}])assert.equal(validCustomizationBody(value),false);
 for(const configs of [{current:snapshot,history:[snapshot]},{current:{...snapshot,publishedAt:'invalid'},history:[]},{current:snapshot,history:[{...snapshot,version:3}]}])assert.equal(validCustomizationResponse({revision:1,configs}),false);
});
