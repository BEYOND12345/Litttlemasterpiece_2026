/**
 * Blurry-photo detection, run on the raw upload BEFORE any processing, so a
 * parent is asked for a retake before they have spent anything.
 *
 * Why not plain variance-of-Laplacian (VoL)?
 * VoL is the standard measure and it is reported here, but it measures
 * contrast as much as sharpness. On the Phase 1 stand-in set a sharp faint
 * pencil drawing scored VoL 123 while a camera-shaken marker drawing scored
 * 222: any VoL threshold that rejects the shaken photo also rejects the faint
 * pencil one. Children's drawings span faint pencil to heavy texta, so that
 * failure is the common case, not an edge case.
 *
 * What gates instead: for each of four directions (0, 90, 45, 135 degrees)
 * the ratio of second-derivative energy to first-derivative energy, summed
 * over the artwork region. Blur spreads an edge, which lowers the second
 * derivative much faster than the first; contrast scales both equally and
 * cancels. The score is the WEAKEST direction, because camera shake blurs
 * along one axis and leaves strokes parallel to it sharp, so an isotropic
 * measure averages the damage away.
 *
 * "The artwork region" is the set of 32px tiles whose intensity varies
 * enough to hold marks (blank paper, flat table and sensor noise drop out).
 * That keeps a sheet of mostly empty paper from reading as blur.
 *
 * Everything is measured at a fixed analysis size (long edge 1024, or the
 * native size if smaller) so the threshold means the same thing for a 12MP
 * phone photo and a 3MP one. Shake small enough to vanish at 1024 is also
 * small enough to vanish in an A3 print.
 *
 * The threshold is PROVISIONAL: calibrated on stand-ins derived from the two
 * real drawings in public/, not on Dan's eight photos. Re-check it with
 * /batch-test once those arrive.
 */

export const ANALYSIS_LONG_EDGE = 1024;
const TILE = 32;
/** Intensity std-dev (0-255) a tile needs to count as part of the artwork. */
const CONTENT_STD = 6;
/** Fewer content tiles than this and there is too little to judge. */
const MIN_CONTENT_TILES = 8;
/**
 * Second-to-first derivative ratio a sharp photo produces in each direction
 * (0, 90, 45, 135 degrees): stand-in 1 (clean, flat, well lit) measured in
 * Chromium through exactly this path, box-downsampled to analysis size.
 */
const SHARP_BASELINE = [1.62, 1.62, 1.72, 1.72];
/**
 * Below this the photo is treated as blurry. Calibration, in Chromium, on
 * 3024x4032 stand-ins (shake lengths are in 12MP pixels; 10px is about 1mm
 * of smear across an A3 print):
 *   sharp stand-ins 1-4, 6-8       0.71 to 1.00   pass
 *   2px gaussian, 8px shake        0.56 to 0.70   pass
 *   12px shake                     0.43 to 0.53   mostly caught
 *   16px shake and worse, 3px+ gaussian   0.46 and below   caught
 *   stand-in 5 (40px shake)        0.36           caught
 * The real phone photo (stand-in 4) is the lowest sharp score, so the
 * margin that matters most is 0.71 against 0.5.
 */
export const SHARPNESS_THRESHOLD = 0.5;

export type SharpnessVerdict = 'sharp' | 'blurry' | 'unknown';

export interface SharpnessResult {
  verdict: SharpnessVerdict;
  /** Weakest-direction sharpness, 1.0 = as sharp as a clean photo. null when there was too little content. */
  score: number | null;
  threshold: number;
  /** Standard variance-of-Laplacian over the artwork region, for reference. */
  laplacianVariance: number | null;
  /** Raw per-direction ratios: 0, 90, 45, 135 degrees. */
  directions: number[] | null;
  /** Share of tiles that held marks. */
  contentFraction: number;
  analysisWidth: number;
  analysisHeight: number;
}

/**
 * Pure measurement over RGBA pixels already at analysis size. No DOM, so it
 * can be tested without a browser.
 */
export function measureSharpnessFromPixels(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
): SharpnessResult {
  const L = new Float32Array(width * height);
  for (let i = 0, p = 0; i < L.length; i++, p += 4) {
    L[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }

  // Interior pixels only (1px border has no full neighbourhood).
  const iw = width - 2;
  const ih = height - 2;
  const tx = Math.floor(iw / TILE);
  const ty = Math.floor(ih / TILE);
  const base: SharpnessResult = {
    verdict: 'unknown',
    score: null,
    threshold: SHARPNESS_THRESHOLD,
    laplacianVariance: null,
    directions: null,
    contentFraction: 0,
    analysisWidth: width,
    analysisHeight: height,
  };
  if (tx < 1 || ty < 1) return base;

  // Sums of squared first (d1) and second (d2) differences per direction,
  // over content tiles only. Directions: 0=x, 1=y, 2=diag(\), 3=diag(/).
  const d1 = [0, 0, 0, 0];
  const d2 = [0, 0, 0, 0];
  let lapVarSum = 0;
  let contentTiles = 0;

  for (let by = 0; by < ty; by++) {
    for (let bx = 0; bx < tx; bx++) {
      // Pass 1: is this tile part of the artwork?
      let s = 0;
      let ss = 0;
      for (let y = 0; y < TILE; y++) {
        const row = (by * TILE + y + 1) * width + bx * TILE + 1;
        for (let x = 0; x < TILE; x++) {
          const v = L[row + x];
          s += v;
          ss += v * v;
        }
      }
      const n = TILE * TILE;
      const mean = s / n;
      const std = Math.sqrt(Math.max(0, ss / n - mean * mean));
      if (std <= CONTENT_STD) continue;
      contentTiles++;

      // Pass 2: derivatives.
      let ls = 0;
      let lss = 0;
      const t1 = [0, 0, 0, 0];
      const t2 = [0, 0, 0, 0];
      for (let y = 0; y < TILE; y++) {
        const i0 = (by * TILE + y + 1) * width + bx * TILE + 1;
        for (let x = 0; x < TILE; x++) {
          const i = i0 + x;
          const c = L[i];
          const l = L[i - 1];
          const r = L[i + 1];
          const u = L[i - width];
          const d = L[i + width];
          const ul = L[i - width - 1];
          const dr = L[i + width + 1];
          const ur = L[i - width + 1];
          const dl = L[i + width - 1];

          const lap = l + r + u + d - 4 * c;
          ls += lap;
          lss += lap * lap;

          const gx = (r - l) / 2;
          const gy = (d - u) / 2;
          const g1 = (dr - ul) / 2;
          const g2 = (dl - ur) / 2;
          const sx = r - 2 * c + l;
          const sy = d - 2 * c + u;
          const s1 = dr - 2 * c + ul;
          const s2 = dl - 2 * c + ur;
          t1[0] += gx * gx; t1[1] += gy * gy; t1[2] += g1 * g1; t1[3] += g2 * g2;
          t2[0] += sx * sx; t2[1] += sy * sy; t2[2] += s1 * s1; t2[3] += s2 * s2;
        }
      }
      const lm = ls / n;
      lapVarSum += lss / n - lm * lm;
      for (let k = 0; k < 4; k++) {
        d1[k] += t1[k];
        d2[k] += t2[k];
      }
    }
  }

  base.contentFraction = contentTiles / (tx * ty);
  if (contentTiles < MIN_CONTENT_TILES) return base;

  // Each direction relative to what a sharp photo produces in it, so 1.0
  // reads "as sharp as stand-in 1" in every direction. The diagonal stencils
  // span a longer step, so their raw ratio differs from the axes'; dividing
  // by a per-direction baseline is what makes the four comparable, and the
  // weakest of them is the one camera shake ran along.
  const directions = [0, 1, 2, 3].map((k) => d2[k] / Math.max(d1[k], 1e-6)).map(Math.sqrt);
  const score = Math.min(...directions.map((r, k) => r / SHARP_BASELINE[k]));

  return {
    ...base,
    verdict: score < SHARPNESS_THRESHOLD ? 'blurry' : 'sharp',
    score,
    laplacianVariance: lapVarSum / contentTiles,
    directions,
  };
}

/**
 * Shrink by an integer factor k, each output pixel the mean of a k x k block.
 * Done here rather than by canvas drawImage because every browser resamples
 * differently (Chromium's "high" quality read about 20% sharper than a plain
 * bilinear on the same photo), and the threshold must mean the same thing in
 * iOS Safari, where parents are, as in the Chromium it was calibrated in.
 */
export function boxDownsample(
  rgba: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  k: number,
): { data: Uint8ClampedArray; width: number; height: number } {
  if (k <= 1) return { data: new Uint8ClampedArray(rgba), width, height };
  const w = Math.floor(width / k);
  const h = Math.floor(height / k);
  const out = new Uint8ClampedArray(w * h * 4);
  const n = k * k;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let dy = 0; dy < k; dy++) {
        let p = ((y * k + dy) * width + x * k) * 4;
        for (let dx = 0; dx < k; dx++, p += 4) {
          r += rgba[p];
          g += rgba[p + 1];
          b += rgba[p + 2];
        }
      }
      const o = (y * w + x) * 4;
      out[o] = r / n;
      out[o + 1] = g / n;
      out[o + 2] = b / n;
      out[o + 3] = 255;
    }
  }
  return { data: out, width: w, height: h };
}

/**
 * iOS Safari refuses canvases over about 16.7 megapixels. Photos up to this
 * size are read at native resolution; only bigger ones (a 24MP iPhone 15
 * default, a 48MP ProRAW) take one browser resample first.
 */
const MAX_DECODE_PIXELS = 16_000_000;

/** Decode an image (data URL, object URL or Blob) and measure it. Browser only. */
export async function measureSharpness(src: string | Blob): Promise<SharpnessResult> {
  const url = typeof src === 'string' ? src : URL.createObjectURL(src);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Could not read the photo'));
      el.src = url;
    });
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const pre = Math.min(1, Math.sqrt(MAX_DECODE_PIXELS / (nw * nh)));
    const w = Math.max(1, Math.floor(nw * pre));
    const h = Math.max(1, Math.floor(nh * pre));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('No canvas context');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);
    canvas.width = 0; // release the full-size bitmap now, not at GC
    // Nearest integer factor: a 4032px photo reads at 1008, a 1184px one at
    // native size rather than being halved to 592.
    const small = boxDownsample(data, w, h, Math.max(1, Math.round(Math.max(w, h) / ANALYSIS_LONG_EDGE)));
    return measureSharpnessFromPixels(small.data, small.width, small.height);
  } finally {
    if (typeof src !== 'string') URL.revokeObjectURL(url);
  }
}
