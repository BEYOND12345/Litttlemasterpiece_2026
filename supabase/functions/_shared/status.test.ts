import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CLAIMABLE_FROM, ORDER_STATUSES, TRANSITIONS, canTransition, statusFromGelato } from './status.ts';

const MIGRATION = readFileSync(
  new URL('../../migrations/20261117000000_christmas_checkout.sql', import.meta.url),
  'utf8',
);

const pairs = (s: string) => [...s.matchAll(/\('([a-z_]+)',\s*'([a-z_]+)'\)/g)].map((m) => `${m[1]}->${m[2]}`).sort();

test('the database trigger allows exactly the transitions status.ts allows', () => {
  const block = MIGRATION.split('-- transitions:begin')[1]?.split('-- transitions:end')[0];
  assert.ok(block, 'transition markers missing from the migration');
  assert.deepEqual(pairs(block), TRANSITIONS.map(([a, b]) => `${a}->${b}`).sort());
});

test('the status CHECK constraint lists exactly ORDER_STATUSES', () => {
  const check = MIGRATION.match(/status text NOT NULL DEFAULT 'pending' CHECK \(status IN \(([^)]*)\)\)/);
  assert.ok(check, 'status check constraint not found');
  const listed = [...check[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, [...ORDER_STATUSES].sort());
});

test('claim_gift_order claims from exactly CLAIMABLE_FROM', () => {
  const line = MIGRATION.split('\n').find((l) => l.includes('-- claimable:from'));
  assert.ok(line, 'claim marker missing');
  const listed = [...line.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
  assert.deepEqual(listed, [...CLAIMABLE_FROM].sort());
});

test('an order can never be claimed again once it is submitting or with Gelato', () => {
  for (const s of ['submitting', 'in_production', 'shipped', 'delivered', 'cancelled', 'pending'] as const) {
    assert.equal(CLAIMABLE_FROM.includes(s), false, s);
  }
  assert.equal(canTransition('in_production', 'submitting'), false);
  assert.equal(canTransition('submitting', 'submitting'), true, 'same status is not a move');
  assert.equal(canTransition('pending', 'submitting'), false, 'unpaid orders cannot be sent');
  assert.equal(canTransition('pending', 'in_production'), false);
});

test('the happy path is pending -> paid -> submitting -> in_production -> shipped -> delivered', () => {
  const path = ['pending', 'paid', 'submitting', 'in_production', 'shipped', 'delivered'] as const;
  for (let i = 1; i < path.length; i++) assert.ok(canTransition(path[i - 1], path[i]), `${path[i - 1]} -> ${path[i]}`);
});

test("Gelato's fulfillment statuses map onto ours, and unknown ones change nothing", () => {
  assert.equal(statusFromGelato('shipped'), 'shipped');
  assert.equal(statusFromGelato('in_transit'), 'shipped');
  assert.equal(statusFromGelato('delivered'), 'delivered');
  assert.equal(statusFromGelato('canceled'), 'cancelled');
  assert.equal(statusFromGelato('CANCELLED'), 'cancelled');
  for (const s of ['created', 'passed', 'printed', 'on_hold', 'failed', '', 'draft']) assert.equal(statusFromGelato(s), null, s);
  assert.equal(statusFromGelato(undefined), null);
});
