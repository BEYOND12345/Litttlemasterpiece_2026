/**
 * The business behind the site, in one place, so a correction lands on the
 * footer and every legal page at once.
 *
 * Anything the owner has not confirmed is NOT written here as a value. It is a
 * visible [TO CONFIRM: ...] marker in the page (see ToConfirm in LegalKit), so
 * it cannot ship unnoticed. Before launch: search the repo for "TO CONFIRM".
 */
export const BUSINESS = {
  tradingName: 'Little Masterpiece',
  legalName: 'MotionStory Pty Ltd',
  // Taken from the owner's other business's website; the footer carries the
  // TO CONFIRM marker that says so until it is checked on the ABN Lookup.
  abn: '58 600 491 085',
  location: 'Byron Bay, Australia',
} as const;
