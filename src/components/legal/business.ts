/**
 * The business behind the site, in one place, so a correction lands on the
 * footer and every legal page at once.
 *
 * Facts the owner has not confirmed are PLACEHOLDERS (his call, 2026-11-18:
 * "put placeholder information in for the moment"). Each is wrapped in
 * <Placeholder> in the page, listed in docs/LAUNCH_CHECKLIST.md, and found
 * with `grep -rn "<Placeholder" src`. None may be left at launch.
 */
export const BUSINESS = {
  tradingName: 'Little Masterpiece',
  legalName: 'MotionStory Pty Ltd',
  // PLACEHOLDER: taken from the owner's other business's website (the SMASH
  // footer); check on the ABN Lookup that it is MotionStory Pty Ltd's.
  abn: '58 600 491 085',
  location: 'Byron Bay, Australia',
  /** PLACEHOLDER: an address the owner must create or replace. */
  contactEmail: 'hello@littlemasterpiece.com.au',
  /** PLACEHOLDER: the date the legal pages take effect. */
  effectiveDate: '18 November 2026',
} as const;
