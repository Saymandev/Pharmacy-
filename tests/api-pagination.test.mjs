import assert from 'node:assert/strict';
import test from 'node:test';
import { readPagination } from '../src/lib/api/pagination.ts';
test('backend controller envelope metadata keeps all medicine/customer pages reachable',()=>{
 const r=readPagination({data:[],meta:{totalItems:125,page:2,pageSize:60,totalPages:3,hasNextPage:true}});
 assert.equal(r.total,125);assert.equal(r.limit,60);assert.equal(r.hasNextPage,true);
});
test('sales service pagination and empty lists use their reported totals',()=>{
 assert.equal(readPagination({data:{sales:[],pagination:{total:25,limit:20,page:1,totalPages:2}}}).totalPages,2);
 assert.equal(readPagination({data:[],meta:{totalItems:0,page:1,pageSize:20,totalPages:0}},10).total,0);
});
