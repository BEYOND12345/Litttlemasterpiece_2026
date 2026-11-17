/**
 * Photo in, the two looks out. The whole of the new image path, in the
 * browser, with no network calls, no keys and no generative model.
 *
 * Two sizes, one algorithm: a PREVIEW small enough to show in about a
 * second, and the PRINT file at the photo's own resolution. Every step works
 * in proportions of the image, not fixed pixels, so the print is the preview
 * at more pixels, not a different picture. Neither is ever stretched past
 * the photo's own pixels: an upscaler adds pixels, not detail.
 */
import { Raster } from './raster';
import { PaperMask, Quad, findPaper, flattenToWhite, straighten, whiteOutsideSheet } from './cleanup';
import { PAPER, ScreenPrintPalette, screenPrint } from './screenprint';

/** Shown to the parent while they choose. */
export const PREVIEW_LONG_EDGE = 1600;
/**
 * The print file. 4096 keeps a 4032px phone photo whole and stays inside
 * iOS Safari's canvas limit (about 16.7MP) for any aspect a sheet can have.
 */
export const PRINT_LONG_EDGE = 4096;

export type LookId = 'as_drawn' | 'screen_print';

export interface LookResult {
  id: LookId;
  image: Raster;
}

/**
 * Every decision the preview makes about a photo. The print file passes
 * these back in, so it is the preview at more pixels: the same crop, the
 * same stretch, the same inks. Proportional, so they apply at any size.
 */
export interface LookDecisions {
  /** Sheet corners as proportions (0 to 1) of the photo, or null when not cropped. */
  quad: Quad | null;
  mask: { data: Uint8Array; width: number; height: number } | null;
  gain: number;
  palette: ScreenPrintPalette;
}

export interface LooksResult {
  looks: LookResult[];
  quad: Quad | null;
  paperReason: string;
  inks: string[];
  gain: number;
  /** Share of the page cleared as table past the sheet's edge. */
  edgeCleared: number;
  /** Share of the cleaned page carrying marks; near zero means no drawing was found. */
  inkCoverage: number;
  /** Mean brightness of the photo (0-255); very low means too dark to print. */
  brightness: number;
  /**
   * False when the page is mostly "ink" (coloured or dark paper, a full-page
   * painting) or the table shows round it: the screen print would flood it
   * or ink the table, so it is not offered.
   */
  screenPrintSuitable: boolean;
  /**
   * Share of the cleaned image's outer edge carrying colour when no sheet
   * was cropped: high means the table (or a hand, a bench) is probably in
   * the picture. The flow suggests a closer photo; it never crops on this.
   */
  edgeInk: number;
  decisions: LookDecisions;
  ms: { decode: number; paper: number; flatten: number; screenPrint: number; total: number };
}

/** Below this share of the page in ink, there is no drawing to print. */
export const MIN_INK_COVERAGE = 0.001;
/** Above this share in ink, the page is coloured or dark paper: no screen print. */
export const MAX_SCREEN_PRINT_COVERAGE = 0.6;
/** Photos darker than this on average (0-255) are refused as too dark. */
export const MIN_PHOTO_BRIGHTNESS = 30;

/**
 * AUTO-CROP IS OFF, deliberately (2026-11-17). Two rounds of review built
 * photos where the automatic crop cut the drawing: a close-up with a big
 * red fill kept 26% of it, brown ground drawn on a sheet on a wood table
 * kept 17%, a black road on a grey counter 32%. Each fix exposed the next
 * case. A crop the parent has not seen can cut their child's drawing; a
 * photo left uncropped shows the table in the preview, the flow asks for a
 * closer photo, and nothing is lost. findPaper still runs, only to tell the
 * flow when the sheet is small. Turning this back on needs the parent to
 * confirm the crop on screen, not a better guess.
 */
const AUTO_CROP = false;

const yieldToBrowser = () => new Promise((r) => setTimeout(r, 0));

export async function decodeToRaster(src: string | Blob, longEdge: number): Promise<Raster> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the photo'));
      el.src = url;
    });
    const s = Math.min(1, longEdge / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * s));
    const h = Math.max(1, Math.round(img.naturalHeight * s));
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No canvas context');
    // White under the photo: a transparent PNG otherwise reads as black
    // paper and the whole page prints black (review, 2026-11-17).
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    c.width = 0;
    return { data, width: w, height: h };
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
}

export async function makeLooks(
  src: string | Blob,
  opts: { paper?: 'cream' | 'white'; longEdge?: number; decisions?: LookDecisions } = {},
): Promise<LooksResult> {
  const t0 = performance.now();
  const raw = await decodeToRaster(src, opts.longEdge ?? PREVIEW_LONG_EDGE);
  let lsum = 0;
  for (let p = 0; p < raw.data.length; p += 16) lsum += 0.299 * raw.data[p] + 0.587 * raw.data[p + 1] + 0.114 * raw.data[p + 2];
  const brightness = lsum / Math.ceil(raw.data.length / 16);
  const t1 = performance.now();
  await yieldToBrowser();

  const fixed = opts.decisions;
  let quad: Quad | null;
  let mask: PaperMask | undefined;
  let paperReason: string;
  if (fixed) {
    quad = fixed.quad ? (fixed.quad.map((p) => ({ x: p.x * raw.width, y: p.y * raw.height })) as Quad) : null;
    mask = fixed.mask ? { ...fixed.mask, scale: raw.width / fixed.mask.width } : undefined;
    paperReason = 'as previewed';
  } else {
    const paper = findPaper(raw);
    quad = AUTO_CROP ? paper.quad : null;
    mask = AUTO_CROP ? paper.mask : undefined;
    paperReason = paper.reason;
  }
  const page = quad ? straighten(raw, quad) : raw;
  const t2 = performance.now();
  await yieldToBrowser();

  const { image: asDrawn, gain } = flattenToWhite(page, fixed?.gain);
  const edgeCleared = quad && mask ? whiteOutsideSheet(asDrawn, quad, mask) : 0;
  let inked = 0;
  const d = asDrawn.data;
  for (let p = 0; p < d.length; p += 4) if (1 - Math.min(d[p], d[p + 1], d[p + 2]) / 255 > 0.15) inked++;
  const inkCoverage = inked / (asDrawn.width * asDrawn.height);
  let edgeInk = 0;
  if (!quad) {
    const W = asDrawn.width, H = asDrawn.height;
    const band = Math.max(2, Math.round(Math.min(W, H) * 0.03));
    let edge = 0, edgeInked = 0;
    for (let y = 0; y < H; y++) {
      const inY = y < band || y >= H - band;
      for (let x = 0; x < W; x++) {
        if (!inY && x >= band && x < W - band) continue;
        edge++;
        const p = (y * W + x) * 4;
        if (1 - Math.min(d[p], d[p + 1], d[p + 2]) / 255 > 0.15) edgeInked++;
      }
    }
    edgeInk = edgeInked / edge;
  }
  const t3 = performance.now();
  await yieldToBrowser();

  const sp = screenPrint(asDrawn, PAPER[opts.paper ?? 'cream'], fixed?.palette);
  const t4 = performance.now();

  return {
    looks: [
      { id: 'as_drawn', image: asDrawn },
      { id: 'screen_print', image: sp.image },
    ],
    quad,
    paperReason,
    inks: sp.inks,
    gain,
    edgeCleared,
    inkCoverage,
    brightness,
    // Also not when the table shows round the drawing: with no crop, the
    // screen print inks the table too, and a big grey counter swamped a
    // drawing's small red cheeks into Brown. A closer photo brings it back.
    screenPrintSuitable: inkCoverage <= MAX_SCREEN_PRINT_COVERAGE && edgeInk <= 0.3,
    edgeInk,
    decisions: {
      quad: quad ? (quad.map((p) => ({ x: p.x / raw.width, y: p.y / raw.height })) as Quad) : null,
      mask: mask ? { data: mask.data, width: mask.width, height: mask.height } : null,
      gain,
      palette: sp.palette,
    },
    ms: {
      decode: Math.round(t1 - t0),
      paper: Math.round(t2 - t1),
      flatten: Math.round(t3 - t2),
      screenPrint: Math.round(t4 - t3),
      total: Math.round(t4 - t0),
    },
  };
}

/** Raster to a canvas, for display, mockups and export. */
export function toCanvas(r: Raster): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = r.width;
  c.height = r.height;
  c.getContext('2d')!.putImageData(new ImageData(r.data, r.width, r.height), 0, 0);
  return c;
}
