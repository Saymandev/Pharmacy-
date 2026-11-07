import assert from 'node:assert/strict';
import test from 'node:test';
import {createSessionBoundary} from '../src/lib/api/session-boundary.ts';

test('session change aborts old requests and rejects responses even if transport ignores abort', () => {
  const boundary=createSessionBoundary(), old=boundary.capture();
  boundary.reset();
  assert.equal(old.signal.aborted,true);
  assert.equal(old.isCurrent(),false);
  const next=boundary.capture();
  assert.equal(next.signal.aborted,false);
  assert.equal(next.isCurrent(),true);
  boundary.reset();
  assert.equal(next.isCurrent(),false);
});

test('caller cancellation and session cancellation both reach fetch signal', () => {
  const boundary=createSessionBoundary(), caller=new AbortController();
  const signal=AbortSignal.any([caller.signal,boundary.capture().signal]);
  caller.abort(); assert.equal(signal.aborted,true);
  const next=AbortSignal.any([new AbortController().signal,boundary.capture().signal]);
  boundary.reset(); assert.equal(next.aborted,true);
});
