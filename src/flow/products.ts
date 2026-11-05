import { ProductId } from './mockups';

export interface Product {
  id: ProductId;
  name: string;
  detail: string;
  /**
   * DISPLAY ONLY, and a PLACEHOLDER: these are the old seed prices
   * (supabase/migrations/20251128055713, "The Gallery Frame (Oak)" 8900 and
   * "Ceramic Artist Mug" 2400) until Dan sets real ones. What a customer is
   * charged must come from the server, never from this file.
   */
  priceCents: number;
  /** Paper behind the screen-print inks on this product. */
  screenPrintPaper: 'cream' | 'white';
}

export const PRODUCTS: Product[] = [
  { id: 'framed', name: 'Framed print', detail: 'Oak frame, ready to hang', priceCents: 8900, screenPrintPaper: 'cream' },
  // A white mug: cream behind the inks would read as a sticker.
  { id: 'mug', name: 'Mug', detail: '11oz white ceramic', priceCents: 2400, screenPrintPaper: 'white' },
];

export const formatAud = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
