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
import { Raster, boxBlur, createRaster, luminance, sampleBilinear, shrink, smooth } from './raster';

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
 * Find the sheet by finding the TABLE: the colour all round the frame's
 * edge. The sheet is the largest region that is not table, so a grass strip
 * or a coloured band along the paper's edge is part of the sheet, not cut
 * off. (The first version took the largest BRIGHT region as the sheet, which
 * cropped a sheet's coloured bottom strip off and, on a full-page painting,
 * cropped to the sky alone.)
 *
 * Refuses (no crop) whenever it is not sure:
 *   - the frame's edge is not one surface (a full-page painting, a busy
 *     bench, the page itself filling the frame);
 *   - the region is not sheet-shaped, or is too small;
 *   - just outside any edge of the sheet is not table, which means the
 *     drawing carries on past where the crop would be.
 * A background left in can be retaken; a drawing cut in half cannot be
 * unprinted.
 */
export function findPaper(src: Raster): PaperResult {
  const k = Math.max(1, Math.round(Math.max(src.width, src.height) / 400));
  const small = shrink(src, k);
  const w = small.width;
  const h = small.height;
  const n = w * h;
  if (w < 16 || h < 16) return { quad: null, reason: 'photo too small to find a sheet' };

  // Slightly blurred channels, so wood grain and sensor noise read as one surface.
  const ch = [0, 1, 2].map((c) => {
    const plane = new Float32Array(n);
    for (let i = 0; i < n; i++) plane[i] = small.data[i * 4 + c];
    return boxBlur(plane, w, h, 1);
  });
  const L = new Float32Array(n);
  const cr = new Float32Array(n);
  const cg = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = ch[0][i], g = ch[1][i], b = ch[2][i];
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    const sum = r + g + b + 1;
    cr[i] = r / sum;
    cg[i] = g / sum;
  }

  // The table: median colour of the frame's outer band.
  const bandW = Math.max(2, Math.round(Math.min(w, h) * 0.03));
  const band: number[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (x < bandW || y < bandW || x >= w - bandW || y >= h - bandW) band.push(y * w + x);
    }
  }
  const median = (vals: number[]) => {
    const a = vals.slice().sort((p, q) => p - q);
    return a[a.length >> 1];
  };
  const bgL = median(band.map((i) => L[i]));
  const bgR = median(band.map((i) => cr[i]));
  const bgG = median(band.map((i) => cg[i]));
  // Table: about the edge's chromaticity, and not much brighter than it (a
  // shadow on the table is still table; paper on a same-coloured table is
  // brighter than it). Wide enough for real wood under a lamp, whose grain
  // and fall-off vary a lot: white paper sits about 0.11 from wood in
  // chromaticity, far outside 0.045.
  //
  // A COLOURED surface (wood, say) is recognised by its colour alone, plus
  // deep shadow: real wood under a lamp ran from L 194 at the lit end to 70
  // in the shadow under the sheet, which no brightness rule covers, while
  // white paper sits about 0.15 from wood in chromaticity. A NEUTRAL surface
  // (grey or white counter) has the same chromaticity as paper, so there the
  // test is brightness: table is not much brighter than the edge.
  //
  // Tried and rejected on 2026-11-17: recognising a coloured table by HUE.
  // Under a warm lamp the PAPER takes the wood's hue too, so most of the
  // sheet read as table and the crop cut straight through the drawing. A
  // missed crop leaves table in the picture, which the parent sees in the
  // preview and can retake; a wrong crop cuts the drawing. So: strict.
  const isTable = (i: number) => Math.hypot(cr[i] - bgR, cg[i] - bgG) < 0.045 && L[i] <= bgL * 1.3 + 10;
  let bandTable = 0;
  for (const i of band) if (isTable(i)) bandTable++;
  const paperLikeEdge = bgL > 170 && Math.abs(bgR - 1 / 3) < 0.04 && Math.abs(bgG - 1 / 3) < 0.04;
  // Is the frame's edge one surface? Mostly table (60%+): yes. Partly table
  // (40%+) is still fine if everything else on the edge is plain paper, the
  // sheet itself touching the frame (a sheet on a bench, shot close). If the
  // rest is colour or dark marks, the DRAWING reaches the frame edge (a
  // full-page painting, a drawn grass strip) and cropping would cut it.
  // Share alone could not tell these apart: the bench photo was 57% table,
  // a full-page landscape 52%.
  const bandShare = bandTable / band.length;
  if (bandShare < 0.6) {
    let other = 0, plainPaper = 0;
    for (const i of band) {
      if (isTable(i)) continue;
      other++;
      if (L[i] > 150 && Math.hypot(cr[i] - 1 / 3, cg[i] - 1 / 3) < 0.04) plainPaper++;
    }
    const paperShare = other ? plainPaper / other : 0;
    if (bandShare < 0.4 || paperShare < 0.8) {
      return {
        quad: null,
        reason: `frame edge is not one surface (${Math.round(bandShare * 100)}% table, ${Math.round(paperShare * 100)}% of the rest plain paper)`,
      };
    }
  }

  // Largest connected region that is not table.
  const label = new Int32Array(n).fill(-1);
  const queue = new Int32Array(n);
  const notTable = new Uint8Array(n);
  let tableCount = 0;
  for (let i = 0; i < n; i++) {
    notTable[i] = isTable(i) ? 0 : 1;
    if (!notTable[i]) tableCount++;
  }
  let bestLabel = -1, bestSize = 0, next = 0;
  for (let s = 0; s < n; s++) {
    if (label[s] !== -1 || !notTable[s]) continue;
    let head = 0, tail = 0;
    queue[tail++] = s;
    label[s] = next;
    while (head < tail) {
      const i = queue[head++];
      const x = i % w;
      const y = (i / w) | 0;
      if (x > 0 && label[i - 1] === -1 && notTable[i - 1]) { label[i - 1] = next; queue[tail++] = i - 1; }
      if (x < w - 1 && label[i + 1] === -1 && notTable[i + 1]) { label[i + 1] = next; queue[tail++] = i + 1; }
      if (y > 0 && label[i - w] === -1 && notTable[i - w]) { label[i - w] = next; queue[tail++] = i - w; }
      if (y < h - 1 && label[i + w] === -1 && notTable[i + w]) { label[i + w] = next; queue[tail++] = i + w; }
    }
    if (tail > bestSize) { bestSize = tail; bestLabel = next; }
    next++;
  }
  if (bestSize < 0.2 * n) {
    // A small sheet is one compact block; a page that fills the frame (on
    // coloured paper, say) leaves only scattered strokes as "not table".
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let i = 0; i < n; i++) {
      if (label[i] !== bestLabel) continue;
      const x = i % w;
      const y = (i / w) | 0;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
    const compact = bestSize / Math.max(1, (x1 - x0 + 1) * (y1 - y0 + 1));
    const smallSheet = !paperLikeEdge && tableCount > 0.6 * n && bestSize > 0.02 * n && compact > 0.8;
    return { quad: null, reason: smallSheet ? 'sheet is small in the photo' : 'page fills the frame' };
  }

  // The sheet as a mask: the region plus every hole in it (anything not
  // reachable from the frame edge without crossing it).
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
  let sheetArea = 0;
  for (let i = 0; i < n; i++) if (!outside[i]) { sheet[i] = 1; sheetArea++; }

  // Corners by the classic extreme sums (works for any mildly rotated quad).
  let tl = 0, tr = 0, br = 0, bl = 0;
  let mTL = Infinity, mTR = -Infinity, mBR = -Infinity, mBL = Infinity;
  for (let i = 0; i < n; i++) {
    if (!sheet[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    if (x + y < mTL) { mTL = x + y; tl = i; }
    if (x + y > mBR) { mBR = x + y; br = i; }
    if (x - y > mTR) { mTR = x - y; tr = i; }
    if (x - y < mBL) { mBL = x - y; bl = i; }
  }
  const pt = (i: number): Point => ({ x: i % w, y: (i / w) | 0 });
  const q: Quad = [pt(tl), pt(tr), pt(br), pt(bl)];

  // The page already fills the frame: nothing to crop.
  const m = 0.03;
  const nearCorner = (p: Point, cx: number, cy: number) => Math.abs(p.x - cx) < w * m && Math.abs(p.y - cy) < h * m;
  if (nearCorner(q[0], 0, 0) && nearCorner(q[1], w - 1, 0) && nearCorner(q[2], w - 1, h - 1) && nearCorner(q[3], 0, h - 1)) {
    return { quad: null, reason: 'page fills the frame' };
  }

  // The region must actually be quad-shaped (a sheet), not a blob. Over 1
  // means the region is bigger than its corner quad: folded or curled
  // corners pull the corners in (the crumpled bench sheet measured 1.08); a
  // round blob measures about 1.57.
  const qa = polygonArea(q);
  const fill = sheetArea / qa;
  if (qa < 0.2 * n || fill < 0.88 || fill > 1.15) return { quad: null, reason: `not sheet-shaped (fill ${fill.toFixed(2)})` };
  const sides = [dist(q[0], q[1]), dist(q[1], q[2]), dist(q[2], q[3]), dist(q[3], q[0])];
  if (Math.min(...sides) < 0.25 * Math.max(w, h)) return { quad: null, reason: 'sheet edge too short' };

  // Just outside every edge must be table, or plain paper (a curled or
  // folded edge bulging past the corner quad). Anything else, colour or a
  // dark mark, means the drawing carries on past where the crop would fall:
  // do not crop.
  const cx = (q[0].x + q[1].x + q[2].x + q[3].x) / 4;
  const cy = (q[0].y + q[1].y + q[2].y + q[3].y) / 4;
  const step = Math.max(2, 0.025 * Math.max(w, h));
  for (let e = 0; e < 4; e++) {
    const a = q[e];
    const b = q[(e + 1) % 4];
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    let nx = -(b.y - a.y);
    let ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (nx * (mx - cx) + ny * (my - cy) < 0) { nx = -nx; ny = -ny; }
    let seen = 0, table = 0;
    for (let t = 0.1; t <= 0.9 + 1e-9; t += 0.1) {
      const x = Math.round(a.x + (b.x - a.x) * t + nx * step);
      const y = Math.round(a.y + (b.y - a.y) * t + ny * step);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      seen++;
      const j = y * w + x;
      if (isTable(j) || (L[j] > 150 && Math.hypot(cr[j] - 1 / 3, cg[j] - 1 / 3) < 0.04)) table++;
    }
    if (seen >= 3 && table < seen * 0.6) return { quad: null, reason: 'drawing reaches past the sheet edge' };
  }

  // Last guard: every mark in the photo must be inside the crop. A mark is
  // anything that is neither table nor plain paper. If more than 2% of them
  // fall outside, whatever the cause, do not crop. "Outside" is past the
  // quad grown by 3% from its centre: the sheet's own edge pixels sit on the
  // quad's line and are neither table nor paper.
  const grown = q.map((p) => ({ x: cx + (p.x - cx) * 1.03, y: cy + (p.y - cy) * 1.03 }));
  const inside = (x: number, y: number) => {
    for (let e = 0; e < 4; e++) {
      const a = grown[e];
      const b = grown[(e + 1) % 4];
      const side = (b.x - a.x) * (y - a.y) - (b.y - a.y) * (x - a.x);
      const centre = (b.x - a.x) * (cy - a.y) - (b.y - a.y) * (cx - a.x);
      if (side * centre < 0) return false;
    }
    return true;
  };
  let marks = 0, marksOutside = 0;
  for (let i = 0; i < n; i++) {
    if (isTable(i) || (L[i] > 150 && Math.hypot(cr[i] - 1 / 3, cg[i] - 1 / 3) < 0.04)) continue;
    marks++;
    if (!inside(i % w, (i / w) | 0)) marksOutside++;
  }
  if (marks && marksOutside > 0.02 * marks) {
    return { quad: null, reason: `crop would leave ${Math.round((100 * marksOutside) / marks)}% of the marks out` };
  }

  // Inset slightly to drop the paper's own edge and the shadow line under it,
  // then scale back to full size.
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
 * The light falling on the paper, per channel, as small planes.
 *
 * Paper is recognised by its COLOUR across the whole page, not by brightness
 * in a small window. (The first version compared each pixel with the
 * brightest pixel nearby, so the middle of any fill wider than that window
 * counted as paper and was divided out to white: hollow suns, a missing
 * sky. Found by review on 2026-11-17.)
 *
 *   1. The paper's colour: the median chromaticity of the brightest 30%.
 *   2. Candidates: every pixel of that chromaticity, at any brightness, as
 *      shadowed paper keeps its chromaticity.
 *   3. A coarse light field from the candidates; paper is a candidate at
 *      least 72% as bright as it. That drops grey and black marks, which
 *      share white paper's chromaticity.
 *   4. The light field from paper alone, the drawing's holes filled from
 *      the paper around them.
 *
 * When the brightest part of the photo is not paper-coloured (blue or green
 * dominant: a painting that fills the frame) or paper is under 12% of it,
 * the light is one even colour, the photo's own white point. Better no
 * local correction than a wrong one.
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
  const cr = new Float32Array(n);
  const cg = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const sum = ch[0][i] + ch[1][i] + ch[2][i] + 1;
    cr[i] = ch[0][i] / sum;
    cg[i] = ch[1][i] / sum;
  }
  const median = (vals: number[]) => {
    if (!vals.length) return 0;
    const a = vals.slice().sort((p, q) => p - q);
    return a[a.length >> 1];
  };
  const percentile = (arr: Float32Array, p: number) => {
    const a = Float32Array.from(arr).sort();
    return a[Math.min(a.length - 1, Math.floor(p * a.length))];
  };

  // One even light, the same in every channel: the photo's own white point.
  // Neutral on purpose: dividing each channel by its own brightest value
  // shifted a full-page painting's sky to cyan.
  const whitePoint = () => {
    const v = Math.max(128, ...[0, 1, 2].map((c) => percentile(ch[c], 0.99)));
    return { planes: [0, 1, 2].map(() => new Float32Array(n).fill(v)), w, h, k };
  };

  // 1. The paper's colour.
  const bright = percentile(L, 0.7);
  const rs: number[] = [];
  const gs: number[] = [];
  for (let i = 0; i < n; i++) if (L[i] >= bright) { rs.push(cr[i]); gs.push(cg[i]); }
  const refR = median(rs);
  const refG = median(gs);
  const refB = 1 - refR - refG;
  const paperColoured = refB <= refR + 0.04 && refG <= Math.max(refR, refB) + 0.04;
  if (!paperColoured) return whitePoint();

  // 2 and 3. Candidates by colour, then paper by brightness against a coarse field.
  const cand = new Float32Array(n);
  for (let i = 0; i < n; i++) cand[i] = Math.hypot(cr[i] - refR, cg[i] - refG) < 0.03 ? 1 : 0;
  const cm = smooth(cand, w, h, 24);
  const masked = new Float32Array(n);
  for (let i = 0; i < n; i++) masked[i] = L[i] * cand[i];
  const cl = smooth(masked, w, h, 24);
  const paper = new Float32Array(n);
  let paperCount = 0;
  for (let i = 0; i < n; i++) {
    const coarse = cm[i] > 0.01 ? cl[i] / cm[i] : bright;
    if (cand[i] && L[i] >= 0.72 * coarse) { paper[i] = 1; paperCount++; }
  }
  if (paperCount < 0.12 * n) return whitePoint();

  // 4. The light from paper alone; holes filled from the paper round them.
  const m1 = smooth(paper, w, h, 6);
  const m2 = smooth(paper, w, h, 24);
  const global = [0, 1, 2].map((c) => {
    let sum = 0;
    for (let i = 0; i < n; i++) if (paper[i]) sum += ch[c][i];
    return sum / paperCount;
  });
  const planes = [0, 1, 2].map((c) => {
    const mc = new Float32Array(n);
    for (let i = 0; i < n; i++) mc[i] = ch[c][i] * paper[i];
    const a1 = smooth(mc, w, h, 6);
    const a2 = smooth(mc, w, h, 24);
    const plane = new Float32Array(n);
    for (let i = 0; i < n; i++) plane[i] = m1[i] > 0.08 ? a1[i] / m1[i] : m2[i] > 0.01 ? a2[i] / m2[i] : global[c];
    return plane;
  });
  return { planes, w, h, k };
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

/** Paper reading below this share of its own light is ink; above is paper texture. */
const PAPER_FLOOR = 0.07;

/**
 * Divide out the paper's light and stretch faint marks. `fixedGain` reuses
 * the stretch the preview chose, so the print file is the preview at more
 * pixels rather than a second, independent decision.
 */
export function flattenToWhite(src: Raster, fixedGain?: number): { image: Raster; gain: number } {
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
  const gain = fixedGain ?? Math.max(1, Math.min(2.5, 0.9 / p98));
  const out = createRaster(W, H);
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) out.data[i * 4 + c] = 255 * (1 - Math.min(1, ink[i * 3 + c] * gain));
    out.data[i * 4 + 3] = 255;
  }
  return { image: out, gain };
}
