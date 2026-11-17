/**
 * The file Gelato prints, made in the browser from the ORIGINAL photo at
 * print size, in the look the parent chose. Only this canvas-made PNG is ever
 * uploaded: the photo itself (which can carry EXIF, GPS included) never
 * leaves the device. Drawing to a canvas and encoding a PNG writes no EXIF.
 *
 *  - framed: posterOnSheet at the product's print size, turned to the
 *            drawing's orientation; as drawn on white, screen print on cream.
 *  - mug:    the look centred on white at the product's print size; the
 *            screen print's cream is divided back out so the inks sit on the
 *            white mug, exactly as the mug preview shows it.
 */
import { PRINT_LONG_EDGE, type LookId, makeLooks, toCanvas } from '../pipeline/looks';
import { onWhite, posterOnSheet, type ProductId } from './mockups';
import { orientSheet, placeArt, type Size } from './printGeometry';

/** The look's own paper: the screen print is made on cream (src/pipeline/screenprint.ts). */
const paperOf = (look: LookId): 'white' | 'cream' => (look === 'screen_print' ? 'cream' : 'white');

export function mugPrint(art: HTMLCanvasElement, paper: 'white' | 'cream', sheet: Size): HTMLCanvasElement {
  const flat = onWhite(art, paper);
  const c = document.createElement('canvas');
  c.width = sheet.width;
  c.height = sheet.height;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('No canvas context');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, sheet.width, sheet.height);
  const at = placeArt(flat, sheet);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(flat, at.x, at.y, at.width, at.height);
  flat.width = 0;
  return c;
}

const toPng = (c: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) =>
    c.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the print file'))), 'image/png'),
  );

export async function makePrintFile(photo: string, look: LookId, product: ProductId, print: Size): Promise<Blob> {
  const res = await makeLooks(photo, { longEdge: PRINT_LONG_EDGE });
  const chosen = res.looks.find((l) => l.id === look);
  if (!chosen) throw new Error(`No ${look} look`);
  const art = toCanvas(chosen.image);
  let sheet: HTMLCanvasElement | null = null;
  try {
    sheet =
      product === 'framed'
        ? posterOnSheet(art, paperOf(look), orientSheet(print, art))
        : mugPrint(art, paperOf(look), print);
    return await toPng(sheet);
  } finally {
    // iOS Safari counts canvas memory against a small budget; give it back now.
    art.width = 0;
    if (sheet) sheet.width = 0;
  }
}
