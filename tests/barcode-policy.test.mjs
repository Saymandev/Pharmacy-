import assert from 'node:assert/strict';import test from 'node:test';
import {barcodeValue,barcodeError,exactBarcodeMatch} from '../src/features/pos/barcode-policy.ts';
test('barcode identifiers preserve leading zeroes and case while trimming scanner suffix whitespace',()=>{assert.equal(barcodeValue(' 0012AbC\r\n'),'0012AbC');assert.equal(barcodeError('0012AbC'),'');});
test('barcode validation rejects empty, embedded control characters and unbounded input',()=>{for(const code of ['', ' ', 'ab\tcd', 'x'.repeat(257)])assert.ok(barcodeError(code));});
test('only a unique exact identifier matches, never a partial, name or case-insensitive near match',()=>{const rows=[{id:'a',barcode:'001ABC'},{id:'b',barcode:'001abc'},{id:'c',barcode:'001ABCD'}];assert.equal(exactBarcodeMatch(rows,'001ABC').id,'a');assert.equal(exactBarcodeMatch(rows,'001abc').id,'b');assert.equal(exactBarcodeMatch(rows,'1ABC'),undefined);assert.equal(exactBarcodeMatch([{barcode:'x'},{barcode:'x'}],'x'),undefined);});
