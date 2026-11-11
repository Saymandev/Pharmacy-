import test from 'node:test';import assert from 'node:assert/strict';
import {parseImportCsv,validateImportRows,validPriceRows} from '../src/features/shops/bulk-policy.ts';
import {tenantWorkspaceTarget,validBulkProxyBody} from '../src/lib/server/tenant-workspace-policy.ts';
import {createWorkspaceClient} from '../src/features/shops/workspace-client.ts';
const id='11111111-1111-4111-8111-111111111111';
const price={medicineId:id,sku:id,unitPrice:12,mrp:20,expectedUnitPrice:10,expectedMrp:20};
test('CSV handles BOM, CRLF, escaped quotes and multiline quoted names without implicit stock',()=>{
 const rows=parseImportCsv('\uFEFFname,barcode,salePrice,isActive\r\n"A, ""quoted""\nmedicine",00123,12.50,true\r\n');assert.equal(rows[0].name,'A, "quoted"\nmedicine');assert.equal(rows[0].barcode,'00123');assert.equal(rows[0].salePrice,12.5);assert.equal(rows[0].isActive,true);assert.equal(rows[0].branchId,undefined);
});
test('CSV rejects unknown/duplicate columns, formula text, bad quoting/UTF bounds, invalid prices and duplicate codes',()=>{
 for(const text of ['name,tenantId\nA,b','name,name\nA,B','name\n=HYPERLINK(1)','name\n"oops','name,salePrice\nA,-1','name,salePrice\nA,1.111','name,isActive\nA,yes','name,barcode\nA,001\nB,001','name\n','name,barcode\nA','name\n'+Array(101).fill('A').join('\n'),'name\n'+ 'x'.repeat(131073)])assert.throws(()=>parseImportCsv(text));
 assert.equal(validateImportRows([{name:'A',branchId:id}]),false);assert.equal(validateImportRows([{name:'A',openingStock:3}]),false);assert.equal(validateImportRows([{name:'A',categoryId:'not-an-id'}]),false);assert.equal(validateImportRows([{name:'A',categoryId:id}]),true);assert.equal(validateImportRows([{name:'A',salePrice:'3'}]),false);assert.equal(validateImportRows([{name:'A',isActive:false,reorderLevel:0}]),true);
});
test('bulk prices require unique medicine/SKU tuples with both inspected prices and bounded money',()=>{
 assert.equal(validPriceRows([price]),true);for(const rows of [[],[price,price],[{...price,expectedMrp:undefined}],[{...price,tenantId:'b'}],[{...price,unitPrice:NaN}],[{...price,mrp:1.001}],[{...price,quantity:4}]])assert.equal(validPriceRows(rows),false);
});
test('BFF allows only gated import, preview and PATCH prices with no identity bypass',()=>{
 const config={session:'true',workspace:'true',base:'http://localhost/api/v1',writes:'true'};
 assert.ok(tenantWorkspaceTarget('a',['pharmacy','medicines','import'],'POST',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','medicines','import-preview'],'POST',config));assert.ok(tenantWorkspaceTarget('a',['pharmacy','stocks','bulk-price-update'],'PATCH',config));assert.equal(tenantWorkspaceTarget('a',['pharmacy','medicines','import-preview'],'GET',config),null);assert.equal(tenantWorkspaceTarget('a',['pharmacy','stocks','bulk-price-update'],'POST',config),null);assert.equal(tenantWorkspaceTarget('a',['pharmacy','medicines','import'],'POST',{...config,writes:'false'}),null);
 assert.equal(validBulkProxyBody({rows:[{name:'A'}]},'import'),true);assert.equal(validBulkProxyBody({rows:[{name:'A'}],tenantId:'b'},'import'),false);assert.equal(validBulkProxyBody({rows:[{name:'A',categoryId:id}]},'import'),true);assert.equal(validBulkProxyBody([price],'bulk-price-update'),true);
});
test('transport retains exact body, key, URL-bound tenant and aborts after scope disposal',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{}});});
 const body={rows:[{name:'A'}]},key='bulk-fixture-key-1234';await client.importMedicines(body,key);await client.importMedicines(body,key);assert.equal(calls[0].options.body,calls[1].options.body);assert.equal(calls[0].options.headers['Idempotency-Key'],key);assert.match(calls[0].url,/tenant-workspace\/a\/pharmacy\/medicines\/import$/);
 await client.updatePrices([price],key);assert.equal(calls[2].options.method,'PATCH');client.dispose();await assert.rejects(client.importMedicines(body,key));
});
test('preview uploads one bounded CSV/XLSX file through the bound shop URL without a save key',async()=>{
 const calls=[],client=createWorkspaceClient('a',new AbortController().signal,async(url,options)=>{calls.push({url,options});return Response.json({success:true,data:{rows:[{name:'Preview'}]}});});
 const file=new File(['name\nPreview\n'],'preview.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});const result=await client.previewImport(file);assert.equal(result.rows[0].name,'Preview');assert.match(calls[0].url,/tenant-workspace\/a\/pharmacy\/medicines\/import-preview$/);assert.equal(calls[0].options.headers['Idempotency-Key'],undefined);assert.ok(calls[0].options.body instanceof FormData);await assert.rejects(client.previewImport(new File(['x'.repeat(1024*1024+1)],'large.xlsx')));
});
