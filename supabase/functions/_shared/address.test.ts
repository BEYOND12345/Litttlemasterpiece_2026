import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AddressError,
  SHIP_TO_COUNTRIES,
  marketingOptIn,
  shippingFromSession,
  splitName,
  toGelatoAddress,
  type StripeSessionLike,
} from './address.ts';

const au = { line1: '12 Wattle St', line2: 'Unit 3', city: 'Newtown', state: 'NSW', postal_code: '2042', country: 'AU' };

const basil = (over: Partial<StripeSessionLike> = {}): StripeSessionLike => ({
  id: 'cs_test_basil',
  customer_details: { email: 'parent@example.com', phone: '+61400000000', name: 'Billing Name' },
  collected_information: { shipping_details: { name: 'Jane  Q Citizen', address: au } },
  ...over,
});

test('reads the 2025-03-31.basil+ shape (collected_information.shipping_details)', () => {
  assert.deepEqual(shippingFromSession(basil()), {
    name: 'Jane Q Citizen',
    email: 'parent@example.com',
    phone: '+61400000000',
    address: { line1: '12 Wattle St', line2: 'Unit 3', city: 'Newtown', state: 'NSW', postal_code: '2042', country: 'AU' },
  });
});

test('reads the pre-basil shape (shipping_details) too', () => {
  const rec = shippingFromSession({
    id: 'cs_test_old',
    customer_details: { email: 'p@example.com', phone: null },
    shipping_details: { name: 'Sam Lee', phone: '+61411111111', address: { ...au, line2: null } },
  });
  assert.equal(rec.name, 'Sam Lee');
  assert.equal(rec.phone, '+61411111111');
  assert.equal(rec.address.line2, null);
});

test('refuses an address it cannot deliver to, naming what is missing', () => {
  assert.throws(() => shippingFromSession(basil({ collected_information: { shipping_details: null } })), /shipping details/);
  assert.throws(
    () => shippingFromSession(basil({ collected_information: { shipping_details: { name: 'A B', address: { ...au, state: '' } } } })),
    /state/,
  );
  assert.throws(() => shippingFromSession(basil({ customer_details: { email: null } })), /email/);
  assert.throws(
    () => shippingFromSession(basil({ collected_information: { shipping_details: { name: 'A B', address: { ...au, country: 'KP' } } } })),
    AddressError,
  );
});

test('ships worldwide from one list; state is required only where an address needs one', () => {
  for (const c of ['AU', 'NZ', 'US', 'GB', 'DE', 'JP']) assert.ok((SHIP_TO_COUNTRIES as readonly string[]).includes(c), c);
  assert.equal(new Set(SHIP_TO_COUNTRIES).size, SHIP_TO_COUNTRIES.length, 'no duplicates');
  const gb = { line1: '1 High St', city: 'London', postal_code: 'N1 1AA', country: 'GB', state: null };
  assert.equal(shippingFromSession(basil({ collected_information: { shipping_details: { name: 'A B', address: gb } } })).address.country, 'GB');
  const us = { ...gb, city: 'Austin', postal_code: '73301', country: 'US' };
  assert.throws(() => shippingFromSession(basil({ collected_information: { shipping_details: { name: 'A B', address: us } } })), /state/);
});

test('marketing consent is true ONLY for an explicit opt_in', () => {
  assert.equal(marketingOptIn({ consent: { promotions: 'opt_in' } }), true);
  assert.equal(marketingOptIn({ consent: { promotions: 'opt_out' } }), false);
  assert.equal(marketingOptIn({ consent: { promotions: null } }), false);
  assert.equal(marketingOptIn({ consent: null }), false);
  assert.equal(marketingOptIn({}), false);
});

test('splits one name field into Gelato first and last names', () => {
  assert.deepEqual(splitName('Jane Q Citizen'), { firstName: 'Jane', lastName: 'Q Citizen' });
  assert.deepEqual(splitName('  Cher '), { firstName: 'Cher', lastName: 'Cher' });
  assert.throws(() => splitName('   '), AddressError);
});

test('maps to Gelato shippingAddress, leaving out empty optional fields', () => {
  assert.deepEqual(toGelatoAddress(shippingFromSession(basil())), {
    firstName: 'Jane',
    lastName: 'Q Citizen',
    addressLine1: '12 Wattle St',
    addressLine2: 'Unit 3',
    city: 'Newtown',
    postCode: '2042',
    state: 'NSW',
    country: 'AU',
    email: 'parent@example.com',
    phone: '+61400000000',
  });
  const bare = toGelatoAddress({
    name: 'A B',
    email: 'a@b.c',
    phone: null,
    address: { line1: 'x', line2: null, city: 'y', state: null, postal_code: 'z', country: 'GB' },
  });
  assert.equal('addressLine2' in bare, false);
  assert.equal('state' in bare, false);
  assert.equal('phone' in bare, false);
});
