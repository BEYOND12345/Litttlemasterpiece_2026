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
  decisions: LookDecisions;
  ms: { decode: number; paper: number; flatten: number; screenPrint: number; total: number };
}

/** Below this share of the page in ink, there is no drawing to print. */
export const MIN_INK_COVERAGE = 0.001;

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
    quad = paper.quad;
    mask = paper.mask;
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
