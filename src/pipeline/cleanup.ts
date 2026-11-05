/**
 * "As drawn": the photo cleaned the way a document scanner cleans a page.
 *
 *   1. Find the sheet of paper and straighten it, ONLY when the finding is
 *      unambiguous. When in doubt, leave the photo uncropped: a background
 *      left in can be retaken, a drawing cut in half cannot be unprinted.
 *   2. Estimate the paper's lighting (shadow, fall-off, colour cast) from
 *      the paper itself and divide it out, so the paper reads evenly white.
 *   3. Stretch faint marks so pencil survives, without thresholding: a hard
 *      cut-off is what erased the faint pencil stand-in in the old pipeline.
 *
 * Nothing here moves, invents or redraws a mark. Every output pixel is the
 * input pixel at the same place on the page, divided by the light on it.
 */
import { Raster, createRaster, luminance, rankFilter, sampleBilinear, shrink, smooth } from './raster';

export type Point = { x: number; y: number };
/** Corners in order: top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

export interface PaperMask {
  /** 1 where the small copy is the sheet (holes the drawing makes filled in). */
  data: Uint8Array;
  width: number;
  height: number;
  /** Full-size pixels per mask pixel. */
  scale: number;
}

export interface PaperResult {
  quad: Quad | null;
  /** Why no quad was used, for the contact sheet. */
  reason: string;
  /** The sheet itself, present whenever quad is. */
  mask?: PaperMask;
}

const polygonArea = (q: Point[]) => {
  let a = 0;
  for (let i = 0; i < q.length; i++) {
    const p = q[i];
    const n = q[(i + 1) % q.length];
    a += p.x * n.y - n.x * p.y;
  }
  return Math.abs(a) / 2;
};

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Find the sheet as the largest bright region of a small copy, after a
 * closing that removes the strokes from it. Refuses anything doubtful.
 */
export function findPaper(src: Raster): PaperResult {
  const k = Math.max(1, Math.round(Math.max(src.width, src.height) / 400));
  const small = shrink(src, k);
  const w = small.width;
  const h = small.height;
  const n = w * h;
  // Close (max then min) so dark strokes do not split the paper into pieces.
  const L = rankFilter(rankFilter(luminance(small), w, h, 4, 'max'), w, h, 4, 'min');

  // Otsu threshold between "paper" and "not paper".
  const hist = new Float64Array(256);
  for (let i = 0; i < n; i++) hist[Math.min(255, Math.max(0, Math.round(L[i])))]++;
  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * hist[t];
  let wB = 0, sumB = 0, best = -1, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = n - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) { best = between; thr = t; }
  }
  let sb = 0, cb = 0, sf = 0, cf = 0;
  for (let i = 0; i < n; i++) {
    if (L[i] > thr) { sf += L[i]; cf++; } else { sb += L[i]; cb++; }
  }
  if (!cb || !cf || sf / cf - sb / cb < 30) return { quad: null, reason: 'paper and background too similar' };

  // Largest bright connected component.
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  let bestLabel = -1, bestSize = 0, next = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || L[s] <= thr) continue;
    let head = 0, tail = 0;
    queue[tail++] = s;
    label[s] = next;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0 && label[i - 1] === -1 && L[i - 1] > thr) { label[i - 1] = next; queue[tail++] = i - 1; }
      if (x < w - 1 && label[i + 1] === -1 && L[i + 1] > thr) { label[i + 1] = next; queue[tail++] = i + 1; }
      if (y > 0 && label[i - w] === -1 && L[i - w] > thr) { label[i - w] = next; queue[tail++] = i - w; }
      if (y < h - 1 && label[i + w] === -1 && L[i + w] > thr) { label[i + w] = next; queue[tail++] = i + w; }
    }
    if (tail > bestSize) { bestSize = tail; bestLabel = next; }
    next++;
  }
  if (bestSize < 0.2 * n) return { quad: null, reason: 'no large sheet found' };

  // Corners by the classic extreme sums (works for any mildly rotated quad).
  let tl = 0, tr = 0, br = 0, bl = 0;
  let mTL = Infinity, mTR = -Infinity, mBR = -Infinity, mBL = Infinity;
  for (let i = 0; i < n; i++) {
    if (label[i] !== bestLabel) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x + y < mTL) { mTL = x + y; tl = i; }
    if (x + y > mBR) { mBR = x + y; br = i; }
    if (x - y > mTR) { mTR = x - y; tr = i; }
    if (x - y < mBL) { mBL = x - y; bl = i; }
  }
  // The sheet as a mask: the component plus every hole the drawing punches
  // in it (anything not reachable from the frame edge without crossing it).
  const sheet = new Uint8Array(n);
  for (let i = 0; i < n; i++) sheet[i] = label[i] === bestLabel ? 1 : 0;
  const outside = new Uint8Array(n);
  {
    let head = 0, tail = 0;
    const push = (i: number) => { if (!sheet[i] && !outside[i]) { outside[i] = 1; queue[tail++] = i; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
    for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      if (x > 0) push(i - 1);
      if (x < w - 1) push(i + 1);
      if (i >= w) push(i - w);
      if (i < n - w) push(i + w);
    }
  }
  for (let i = 0; i < n; i++) if (!outside[i]) sheet[i] = 1;

  const pt = (i: number): Point => ({ x: i % w, y: (i / w) | 0 });
  const q: Quad = [pt(tl), pt(tr), pt(br), pt(bl)];

  // The page already fills the frame: nothing to crop.
  const m = 0.03;
  const nearCorner = (p: Point, cx: number, cy: number) => Math.abs(p.x - cx) < w * m && Math.abs(p.y - cy) < h * m;
  if (nearCorner(q[0], 0, 0) && nearCorner(q[1], w - 1, 0) && nearCorner(q[2], w - 1, h - 1) && nearCorner(q[3], 0, h - 1)) {
    return { quad: null, reason: 'page fills the frame' };
  }

  // The region must actually be quad-shaped (a sheet), not a blob.
  const qa = polygonArea(q);
  const fill = bestSize / qa;
  if (qa < 0.2 * n || fill < 0.88 || fill > 1.08) return { quad: null, reason: `not sheet-shaped (fill ${fill.toFixed(2)})` };
  const sides = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])];
  if (Math.min(...sides) < 0.25 * Math.max(w, h)) return { quad: null, reason: 'sheet edge too short' };

  // Inset slightly to drop the paper's own edge and the shadow line under it,
  // then scale back to full size.
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  const inset = 0.015;
  const full = q.map((p) => ({
    x: (p.x + (cx - p.x) * inset + 0.5) * k,
    y: (p.y + (cy - p.y) * inset + 0.5) * k,
  })) as Quad;
  return { quad: full, reason: 'sheet found', mask: { data: sheet, width: w, height: h, scale: k } };
}

/** Solve the 3x3 homography taking rectangle (0,0)-(W,H) onto quad. */
function homography(quad: Quad, W: number, H: number): number[] {
  const src: Point[] = [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: H }, { x: 0, y: H }];
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = quad[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[piv][c])) piv = r;
    [A[c], A[piv]] = [A[piv], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [...A.map((row, i) => row[8] / row[i]), 1];
}

const straightSize = (quad: Quad) => ({
  W: Math.round(Math.max(dist(quad[0], quad[1]), dist(quad[3], quad[2]))),
  H: Math.round(Math.max(dist(quad[0], quad[3]), dist(quad[1], quad[2]))),
});

/** Straighten the quad to a rectangle sized from its own edge lengths. */
export function straighten(src: Raster, quad: Quad): Raster {
  const { W, H } = straightSize(quad);
  const [a, b, c, d, e, f, g, hh] = homography(quad, W, H);
  const out = createRaster(W, H);
  const s = src.data;
  const sw = src.width;
  const sh = src.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const den = g * x + hh * y + 1;
      const u = (a * x + b * y + c) / den;
      const v = (d * x + e * y + f) / den;
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(u)));
      const y0 = Math.max(0, Math.min(sh - 2, Math.floor(v)));
      const fx = Math.max(0, Math.min(1, u - x0));
      const fy = Math.max(0, Math.min(1, v - y0));
      const p00 = (y0 * sw + x0) * 4;
      const p10 = p00 + 4;
      const p01 = p00 + sw * 4;
      const p11 = p01 + 4;
      const o = (y * W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const top = s[p00 + ch] * (1 - fx) + s[p10 + ch] * fx;
        const bot = s[p01 + ch] * (1 - fx) + s[p11 + ch] * fx;
        out.data[o + ch] = top * (1 - fy) + bot * fy;
      }
      out.data[o + 3] = 255;
    }
  }
  return out;
}

/**
 * The light falling on the paper, per channel, as small planes. Paper pixels
 * are found twice: first as "near the local brightest", then also "near the
 * first estimate's colour", so a yellow crayon is not mistaken for paper.
 * Holes left by the drawing are filled by normalised blurring.
 */
function estimatePaperLight(src: Raster) {
  const k = Math.max(1, Math.round(Math.max(src.width, src.height) / 256));
  const small = shrink(src, k);
  const w = small.width;
  const h = small.height;
  const n = w * h;
  const ch = [0, 1, 2].map((c) => {
    const p = new Float32Array(n);
    for (let i = 0; i < n; i++) p[i] = small.data[i * 4 + c];
    return p;
  });
  const L = luminance(small);
  const localMax = rankFilter(L, w, h, 6, 'max');

  const fill = (mask: Float32Array) => {
    const out: Float32Array[] = [];
    const m1 = smooth(mask, w, h, 6);
    const m2 = smooth(mask, w, h, 24);
    let gs = [0, 0, 0], gc = 0;
    for (let i = 0; i < n; i++) if (mask[i]) { gs = gs.map((v, c) => v + ch[c][i]); gc++; }
    const global = gs.map((v) => (gc ? v / gc : 255));
    for (let c = 0; c < 3; c++) {
      const masked = new Float32Array(n);
      for (let i = 0; i < n; i++) masked[i] = ch[c][i] * mask[i];
      const a1 = smooth(masked, w, h, 6);
      const a2 = smooth(masked, w, h, 24);
      const plane = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        plane[i] = m1[i] > 0.08 ? a1[i] / m1[i] : m2[i] > 0.01 ? a2[i] / m2[i] : global[c];
      }
      out.push(plane);
    }
    return out;
  };

  const mask1 = new Float32Array(n);
  for (let i = 0; i < n; i++) mask1[i] = L[i] >= 0.88 * localMax[i] ? 1 : 0;
  const first = fill(mask1);
  const mask2 = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (!mask1[i]) continue;
    let dev = 0;
    for (let c = 0; c < 3; c++) dev = Math.max(dev, Math.abs(ch[c][i] / Math.max(1, first[c][i]) - 1));
    mask2[i] = dev < 0.12 ? 1 : 0;
  }
  return { planes: fill(mask2), w, h, k };
}

/**
 * After straightening: inside the outer band of the page only, whiten what
 * is not the sheet (table showing past a folded or curled corner). Marks on
 * the sheet are never touched, even at its very edge, and nothing past the
 * band is touched at all, so a misjudged mask can only cost the margin.
 */
export function whiteOutsideSheet(img: Raster, quad: Quad, mask: PaperMask, bandFrac = 0.06): number {
  const { W, H } = straightSize(quad);
  if (W !== img.width || H !== img.height) return 0;
  const [a, b, c, d, e, f, g, hh] = homography(quad, W, H);
  const band = Math.round(Math.min(W, H) * bandFrac);
  let cleared = 0;
  for (let y = 0; y < H; y++) {
    const inY = y < band || y >= H - band;
    for (let x = 0; x < W; x++) {
      if (!inY && x >= band && x < W - band) continue;
      const den = g * x + hh * y + 1;
      const mx = Math.floor((a * x + b * y + c) / den / mask.scale);
      const my = Math.floor((d * x + e * y + f) / den / mask.scale);
      const on = mx >= 0 && my >= 0 && mx < mask.width && my < mask.height && mask.data[my * mask.width + mx];
      if (on) continue;
      const o = (y * W + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
      cleared++;
    }
  }
  return cleared / (W * H);
}

/**
 * Remove debris along the page edge: table showing past a curled corner,
 * the shadow line under the sheet. A mark is removed only if it touches the
 * edge AND sits almost entirely inside the edge band, so a stroke a child ran
 * off the page is kept (most of it lies inside the page).
 */
export function clearEdgeDebris(img: Raster): number {
  const k = Math.max(1, Math.round(Math.max(img.width, img.height) / 750));
  const small = shrink(img, k);
  const w = small.width;
  const h = small.height;
  const n = w * h;
  const band = Math.max(2, Math.round(Math.min(w, h) * 0.04));
  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    ink[i] = 1 - Math.min(small.data[p], small.data[p + 1], small.data[p + 2]) / 255 > 0.15 ? 1 : 0;
  }
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  const remove = new Uint8Array(n);
  let removed = 0;
  for (let s = 0; s < n; s++) {
    if (!ink[s] || label[s] !== -1) continue;
    let head = 0, tail = 0, inBand = 0, touches = false;
    queue[tail++] = s;
    label[s] = s;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      if (x < band || y < band || x >= w - band || y >= h - band) inBand++;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touches = true;
      const nb = [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1];
      for (const j of nb) if (j >= 0 && ink[j] && label[j] === -1) { label[j] = s; queue[tail++] = j; }
    }
    if (touches && inBand >= 0.9 * tail) {
      for (let q = 0; q < tail; q++) remove[queue[q]] = 1;
      removed += tail;
    }
  }
  if (!removed) return 0;
  for (let y = 0; y < img.height; y++) {
    const sy = Math.min(h - 1, (y / k) | 0);
    for (let x = 0; x < img.width; x++) {
      if (!remove[sy * w + Math.min(w - 1, (x / k) | 0)]) continue;
      const o = (y * img.width + x) * 4;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = 255;
    }
  }
  return removed / n;
}

/** Paper reading below this share of its own light is ink; above is paper texture. */
const PAPER_FLOOR = 0.07;

export function flattenToWhite(src: Raster): { image: Raster; gain: number } {
  const { planes, w, h, k } = estimatePaperLight(src);
  const W = src.width;
  const H = src.height;
  const n = W * H;
  // Ink strength per channel: 1 - pixel / paper light at that point.
  const ink = new Float32Array(n * 3);
  const dark = new Float32Array(n);
  for (let y = 0; y < H; y++) {
    const sy = (y + 0.5) / k - 0.5;
    for (let x = 0; x < W; x++) {
      const sx = (x + 0.5) / k - 0.5;
      const i = y * W + x;
      let dmax = 0;
      for (let c = 0; c < 3; c++) {
        const light = Math.max(8, sampleBilinear(planes[c], w, h, sx, sy));
        const q = src.data[i * 4 + c] / light;
        const s = Math.max(0, (1 - q - PAPER_FLOOR) / (1 - PAPER_FLOOR));
        ink[i * 3 + c] = s;
        if (s > dmax) dmax = s;
      }
      dark[i] = dmax;
    }
  }
  // Faint drawings get stretched (at most 2.5x) so the strongest marks read
  // near full strength; bold ones are left as they are.
  const hist = new Uint32Array(256);
  let inkCount = 0;
  for (let i = 0; i < n; i++) {
    if (dark[i] > 0.08) { hist[Math.min(255, (dark[i] * 255) | 0)]++; inkCount++; }
  }
  let p98 = 1;
  if (inkCount > n * 0.002) {
    let acc = 0;
    for (let t = 0; t < 256; t++) {
      acc += hist[t];
      if (acc >= inkCount * 0.98) { p98 = (t + 0.5) / 255; break; }
    }
  }
  const gain = Math.max(1, Math.min(2.5, 0.9 / p98));
  const out = createRaster(W, H);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out.data[i * 4 + c] = 255 * (1 - Math.min(1, ink[i * 3 + c] * gain));
    out.data[i * 4 + 3] = 255;
  }
  return { image: out, gain };
}
