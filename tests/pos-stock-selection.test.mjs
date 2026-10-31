import assert from 'node:assert/strict';
import test from 'node:test';
import { sellableStocks, chooseAvailableStock } from '../src/features/pos/stock-selection.ts';
const now = new Date('2026-10-31T18:30:00Z'); // November 1 in Dhaka
const batch = (id, expiryDate, quantity = 5, branchId = 'branch-a') => ({ id, expiryDate, quantity, branchId });
test('FEFO excludes expired, invalid, wrong-branch and unsellable whole-unit stock', () => {
 const stocks = [batch('later','2026-12-01'), batch('expired','2026-10-31'), batch('today','2026-11-01'), batch('invalid','invalid'), batch('other','2026-12-01',5,'branch-b'), batch('empty','2026-12-01',0), batch('fraction','2026-12-01',0.5)];
 assert.deepEqual(sellableStocks(stocks,'branch-a',now).map(s=>s.id),['today','later']);
 assert.equal(stocks[0].id,'later');
});
test('full batch advances to next batch and never exceeds available whole units', () => {
 const stocks = [batch('first','2026-11-01',2.5),batch('second','2026-12-01',3)];
 assert.equal(chooseAvailableStock(stocks,[]).id,'first');
 assert.equal(chooseAvailableStock(stocks,[{stock:{id:'first'},quantity:2}]).id,'second');
 assert.equal(chooseAvailableStock(stocks,[{stock:{id:'first'},quantity:2},{stock:{id:'second'},quantity:3}]),undefined);
});
