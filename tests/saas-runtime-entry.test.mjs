import test from 'node:test';
import assert from 'node:assert/strict';
import {workspaceEntry,logoutEndpoint} from '../src/lib/auth/workspace-entry.ts';
test('SaaS entry selects shop context and server session revocation while legacy navigation remains explicit',()=>{
 assert.equal(workspaceEntry('true'),'/shops');assert.equal(logoutEndpoint('true'),'/api/backend/auth/logout');
 for(const mode of ['false','',undefined]){assert.equal(workspaceEntry(mode),'/dashboard');assert.equal(logoutEndpoint(mode),'/api/session/logout');}
});
