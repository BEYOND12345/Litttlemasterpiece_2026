/**
 * Where the parcel goes: the Stripe Checkout Session's collected details, to
 * the record we store, to Gelato's shippingAddress.
 *
 * Stripe moved the shipping block between API versions: 2025-03-31.basil and
 * later put it at `collected_information.shipping_details`, earlier versions
 * at `shipping_details`. stripe-webhook re-reads the session with the pinned
 * SDK (stripe@18.5.0, API 2025-08-27.basil), but the mapping takes either so
 * a dashboard API-version change cannot silently drop an address.
 *
 * Pure: no Deno, no network.
 */

export interface AddressLike {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

/** The parts of a Stripe Checkout Session this code reads. */
export interface StripeSessionLike {
  id: string;
  client_reference_id?: string | null;
  metadata?: Record<string, string> | null;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer_details?: {
    email?: string | null;
    phone?: string | null;
    name?: string | null;
    address?: AddressLike | null;
  } | null;
  collected_information?: {
    shipping_details?: { name?: string | null; address?: AddressLike | null } | null;
  } | null;
  shipping_details?: { name?: string | null; phone?: string | null; address?: AddressLike | null } | null;
  consent?: { promotions?: string | null } | null;
}

/**
 * Marketing consent from Checkout's consent_collection. Stripe shows the box
 * in some countries only; anything but an explicit 'opt_in' is a no.
 */
export const marketingOptIn = (session: Pick<StripeSessionLike, 'consent'>): boolean =>
  session.consent?.promotions === 'opt_in';

/** What gift_orders.shipping holds. */
export interface ShippingRecord {
  name: string;
  email: string;
  phone: string | null;
  address: {
    line1: string;
    line2: string | null;
    city: string;
    state: string | null;
    postal_code: string;
    country: string;
  };
}

export interface GelatoAddress {
  firstName: string;
  lastName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  postCode: string;
  state?: string;
  country: string;
  email: string;
  phone?: string;
}

export class AddressError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AddressError';
  }
}

const clean = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim().replace(/\s+/g, ' ') : '');

/**
 * Where we ship: the ONE list. create-checkout gives it to Stripe as
 * shipping_address_collection.allowed_countries, and the webhook refuses to
 * send Gelato an address outside it. Every code is also checked against
 * Stripe's own AllowedCountry type by `npm run typecheck:functions`.
 *
 * NOT YET CHECKED AGAINST GELATO. This is a broad list of countries Gelato
 * is believed to deliver to; before going live, compare it with Gelato's
 * shipping list for the two products actually chosen and delete any it does
 * not deliver to (docs/PAYMENTS.md, owner to-do).
 */
export const SHIP_TO_COUNTRIES = [
  // Oceania
  'AU', 'NZ',
  // North America
  'US', 'CA', 'MX',
  // UK and Ireland
  'GB', 'IE',
  // European Union
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IT',
  'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE',
  // Rest of Europe
  'NO', 'CH', 'IS', 'LI', 'MC',
  // Asia
  'JP', 'KR', 'SG', 'HK', 'TW', 'MY', 'TH', 'PH', 'ID', 'IN', 'VN',
  // Middle East and Africa
  'AE', 'SA', 'QA', 'IL', 'ZA',
  // South America
  'BR', 'CL', 'AR', 'CO', 'PE',
] as const;

/** Countries whose addresses are not deliverable without a state or province. */
const STATE_REQUIRED = ['AU', 'US', 'CA'];

export function shippingFromSession(session: StripeSessionLike): ShippingRecord {
  const ship = session.collected_information?.shipping_details ?? session.shipping_details ?? null;
  const a = ship?.address;
  const missing: string[] = [];
  const name = clean(ship?.name) || clean(session.customer_details?.name);
  const email = clean(session.customer_details?.email);
  const line1 = clean(a?.line1);
  const city = clean(a?.city);
  const postal = clean(a?.postal_code);
  const country = clean(a?.country).toUpperCase();
  const state = clean(a?.state);
  if (!ship) missing.push('shipping details');
  if (!name) missing.push('name');
  if (!email) missing.push('email');
  if (!line1) missing.push('address line 1');
  if (!city) missing.push('city');
  if (!postal) missing.push('postcode');
  if (!country) missing.push('country');
  if (STATE_REQUIRED.includes(country) && !state) missing.push('state');
  if (missing.length) throw new AddressError(`Stripe session ${session.id} has no ${missing.join(', ')}`);
  if (!(SHIP_TO_COUNTRIES as readonly string[]).includes(country)) {
    throw new AddressError(`Stripe session ${session.id} ships to ${country}, which we do not ship to`);
  }
  const phone = clean(session.customer_details?.phone) || clean(session.shipping_details?.phone) || null;
  return {
    name,
    email,
    phone,
    address: { line1, line2: clean(a?.line2) || null, city, state: state || null, postal_code: postal, country },
  };
}

/**
 * Stripe collects one name field; Gelato wants two. Everything after the
 * first word is the last name. A single word is used for both, the same rule
 * the old client checkout used, so a one-name customer is still deliverable.
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = clean(full).split(' ').filter(Boolean);
  if (parts.length === 0) throw new AddressError('Empty name');
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ') || firstName;
  return { firstName, lastName };
}

export function toGelatoAddress(rec: ShippingRecord): GelatoAddress {
  const { firstName, lastName } = splitName(rec.name);
  const out: GelatoAddress = {
    firstName,
    lastName,
    addressLine1: rec.address.line1,
    city: rec.address.city,
    postCode: rec.address.postal_code,
    country: rec.address.country,
    email: rec.email,
  };
  if (rec.address.line2) out.addressLine2 = rec.address.line2;
  if (rec.address.state) out.state = rec.address.state;
  if (rec.phone) out.phone = rec.phone;
  return out;
}
