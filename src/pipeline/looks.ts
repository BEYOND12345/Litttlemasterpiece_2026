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
import { Quad, clearEdgeDebris, findPaper, flattenToWhite, straighten, whiteOutsideSheet } from './cleanup';
import { PAPER, screenPrint } from './screenprint';

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

export interface LooksResult {
  looks: LookResult[];
  quad: Quad | null;
  paperReason: string;
  inks: string[];
  gain: number;
  /** Share of the page cleared as edge debris (table, sheet shadow). */
  edgeCleared: number;
  ms: { decode: number; paper: number; flatten: number; screenPrint: number; total: number };
}

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
  opts: { paper?: 'cream' | 'white'; longEdge?: number } = {},
): Promise<LooksResult> {
  const t0 = performance.now();
  const raw = await decodeToRaster(src, opts.longEdge ?? PREVIEW_LONG_EDGE);
  const t1 = performance.now();
  await yieldToBrowser();

  const paper = findPaper(raw);
  const page = paper.quad ? straighten(raw, paper.quad) : raw;
  const t2 = performance.now();
  await yieldToBrowser();

  const { image: asDrawn, gain } = flattenToWhite(page);
  let edgeCleared = paper.quad && paper.mask ? whiteOutsideSheet(asDrawn, paper.quad, paper.mask) : 0;
  edgeCleared += clearEdgeDebris(asDrawn);
  const t3 = performance.now();
  await yieldToBrowser();

  const sp = screenPrint(asDrawn, PAPER[opts.paper ?? 'cream']);
  const t4 = performance.now();

  return {
    looks: [
      { id: 'as_drawn', image: asDrawn },
      { id: 'screen_print', image: sp.image },
    ],
    quad: paper.quad,
    paperReason: paper.reason,
    inks: sp.inks,
    gain,
    edgeCleared,
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
