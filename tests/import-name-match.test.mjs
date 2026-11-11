import test from 'node:test';import assert from 'node:assert/strict';
import {matchImportName} from '../src/features/shops/import-name-match.ts';
const a={id:'11111111-1111-4111-8111-111111111111',tenantId:'a',name:'Paracetamol'};
const page=(data,index=1,more=false)=>({data,meta:{page:index,hasNextPage:more}});
test('matches case and whitespace but never partial names; checks later pages for ambiguity',async()=>{
 assert.equal((await matchImportName('a',' paracetamol ',async()=>page([a]))).id,a.id);
 assert.equal(await matchImportName('a','Para',async()=>page([a])),null);
 await assert.rejects(matchImportName('a','Paracetamol',async index=>index===1?page([a],1,true):page([{...a,id:'22222222-2222-4222-8222-222222222222'}],2)),/Multiple exact/);
});
test('rejects foreign/malformed and incomplete result pages; matches Bangla aliases',async()=>{
 await assert.rejects(matchImportName('a','Paracetamol',async()=>page([{...a,tenantId:'b'}])));
 await assert.rejects(matchImportName('a','Paracetamol',async()=>page([a],2)));
 assert.equal((await matchImportName('a','প্যারাসিটামল',async()=>page([{...a,nameBangla:'প্যারাসিটামল'}]))).id,a.id);
 await assert.rejects(matchImportName('a','Paracetamol',async index=>page([],index,true)),/Too many/);
});
