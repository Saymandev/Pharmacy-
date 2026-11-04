import assert from 'node:assert/strict';
import test from 'node:test';
import { hrDateInput, hrCalendarDays } from '../src/features/hr/hr-setup-dates.ts';

test('calendar editing keeps the Dhaka date of persisted start/end timestamps', () => {
  assert.equal(hrDateInput('2026-11-03T18:00:00.000Z'), '2026-11-04');
  assert.equal(hrDateInput('2026-11-04T17:59:59.999Z'), '2026-11-04');
  assert.equal(hrDateInput('2026-11-04'), '2026-11-04');
  assert.equal(hrDateInput(undefined, new Date('2026-11-03T19:00:00Z')), '2026-11-04');
});
test('calendar duration includes both dates without counting a one-day holiday twice', () => {
  assert.equal(hrCalendarDays('2026-11-04', '2026-11-04'), 1);
  assert.equal(hrCalendarDays('2026-12-31', '2027-01-02'), 3);
  assert.equal(hrCalendarDays('2028-02-28', '2028-03-01'), 3);
  assert.equal(hrCalendarDays('2026-11-05', '2026-11-04'), 0);
  assert.equal(hrCalendarDays('2026-02-30', '2026-03-03'), 0);
});
