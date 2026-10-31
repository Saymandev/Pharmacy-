import assert from 'node:assert/strict';
import test from 'node:test';
import { backendApiBase } from '../src/lib/server/backend-url.ts';
test('origin and user-provided API base resolve to the same upstream',()=>{
 for(const s of ['https://example.com','https://example.com/','https://example.com/api/v1','https://example.com/api/v1/'])assert.equal(backendApiBase(s),'https://example.com/api/v1');
 assert.equal(backendApiBase('http://localhost:3001'),'http://localhost:3001/api/v1');
 assert.throws(()=>backendApiBase('ftp://example.com'));
});
