/**
 * "Screen print": the cleaned drawing recoloured as a 1 to 3 ink screen
 * print. The child's marks keep their exact shapes; only their colour
 * changes, to the nearest ink in a fixed palette, laid flat, with each ink a
 * few pixels off register and a little ink texture, the way a real pull looks.
 *
 * The colours come FROM the drawing (its own dominant colours, snapped to the
 * palette), so a red-and-blue drawing stays red and blue, just as inks.
 */
import { Raster, boxBlur, createRaster } from './raster';

/** A small set of screen-print inks. Snapping to it is what makes the look consistent. */
export const INKS: { name: string; rgb: [number, number, number] }[] = [
  { name: 'Charcoal', rgb: [35, 32, 31] },
  { name: 'Navy', rgb: [31, 42, 68] },
  { name: 'Cobalt', rgb: [47, 79, 162] },
  { name: 'Sky', rgb: [91, 164, 216] },
  { name: 'Teal', rgb: [30, 127, 122] },
  { name: 'Forest', rgb: [46, 94, 62] },
  { name: 'Leaf', rgb: [141, 179, 58] },
  { name: 'Mustard', rgb: [224, 165, 38] },
  { name: 'Orange', rgb: [238, 123, 44] },
  { name: 'Tomato', rgb: [224, 72, 47] },
  // A true marker red. A cool red (217,88,103) sat equidistant between a
  // scarlet and Pink and flipped between them photo to photo.
  { name: 'Red', rgb: [208, 48, 64] },
  { name: 'Pink', rgb: [231, 123, 160] },
  { name: 'Plum', rgb: [107, 63, 143] },
  { name: 'Brown', rgb: [122, 75, 42] },
];

/** Paper behind the inks: warm cream for prints, white for a white mug. */
export const PAPER = { cream: [246, 241, 231] as const, white: [255, 255, 255] as const };

const srgbToLinear = (v: number) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
function toLab(r: number, g: number, b: number): [number, number, number] {
  const R = srgbToLinear(r), G = srgbToLinear(g), B = srgbToLinear(b);
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(X), fy = f(Y), fz = f(Z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
/** Hue and chroma matter more than lightness: a stroke's light edge is the same ink. */
const L_WEIGHT = 0.5;
const labDist = (a: number[], b: number[]) =>
  Math.hypot((a[0] - b[0]) * L_WEIGHT, a[1] - b[1], a[2] - b[2]);

const INK_LAB = INKS.map((i) => toLab(...i.rgb));

/** Darkness of a cleaned pixel: how much ink, in its strongest channel. */
const darkness = (d: Uint8ClampedArray, p: number) => 1 - Math.min(d[p], d[p + 1], d[p + 2]) / 255;

/** Deterministic per-pixel noise in [0, 1). */
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/**
 * Every choice the screen print makes about a drawing: its colours, the inks
 * they snap to, and where ink starts. The preview makes these choices; the
 * print file reuses them, so the inks printed are the inks the parent saw.
 * (Decided twice, a kraft-paper drawing previewed Red + Navy and printed
 * Red + Charcoal. Found by review on 2026-11-17.)
 */
export interface ScreenPrintPalette {
  centres: number[][];
  inkOf: number[];
  used: number[];
  lo: number;
  span: number;
}

export interface ScreenPrintResult {
  image: Raster;
  inks: string[];
  palette: ScreenPrintPalette;
}

/**
 * Is a pale colour a different colour from an ink, rather than a lighter
 * edge of it? By hue, not distance: a light blue edge of a blue stroke is
 * far from blue in Lab but the same hue. Near-grey pale pixels never count
 * (pencil, soft edges); a coloured pale beside a grey or black ink does
 * (a pink fill inside a black outline).
 */
function distinctHue(pale: number[], ink: number[]): boolean {
  const cp = Math.hypot(pale[1], pale[2]);
  const ci = Math.hypot(ink[1], ink[2]);
  if (cp < 12) return false;
  if (ci < 12) return true;
  const cos = (pale[1] * ink[1] + pale[2] * ink[2]) / (cp * ci);
  return Math.acos(Math.max(-1, Math.min(1, cos))) > Math.PI / 6;
}

/** At most this many inks, as a real screen print would have. */
const MAX_INKS = 4;

export function screenPrint(
  clean: Raster,
  paper: readonly [number, number, number] = PAPER.cream,
  fixed?: ScreenPrintPalette,
): ScreenPrintResult {
  const { width: W, height: H, data } = clean;
  const n = W * H;

  // 1. The drawing's own colours: cluster the solidly inked pixels.
  let centres: number[][] = fixed ? fixed.centres : [];
  const samples: number[][] = [];
  if (!fixed) {
    const stride = Math.max(1, Math.floor(n / 60000));
    for (let i = 0; i < n; i += stride) {
      const p = i * 4;
      if (darkness(data, p) > 0.45) samples.push(toLab(data[p], data[p + 1], data[p + 2]));
    }
  }
  if (samples.length) {
    // Farthest-point start, deterministic: darkest sample first.
    centres.push(samples.reduce((a, b) => (b[0] < a[0] ? b : a)));
    while (centres.length < MAX_INKS) {
      let far = samples[0], fd = -1;
      for (const s of samples) {
        const d = Math.min(...centres.map((c) => labDist(s, c)));
        if (d > fd) { fd = d; far = s; }
      }
      if (fd < 18) break; // nothing distinct left: fewer inks
      centres.push(far);
    }
    for (let iter = 0; iter < 8; iter++) {
      const sum = centres.map(() => [0, 0, 0, 0]);
      for (const s of samples) {
        let bi = 0, bd = Infinity;
        centres.forEach((c, j) => { const d = labDist(s, c); if (d < bd) { bd = d; bi = j; } });
        sum[bi][0] += s[0]; sum[bi][1] += s[1]; sum[bi][2] += s[2]; sum[bi][3]++;
      }
      // Drop colours under 5% of the inked area: specks, not inks. Except
      // the darkest near-black one: a drawing's outline is often a small
      // share of its ink but carries the whole drawing, and dropping it
      // printed a black line in Sky blue (review, 2026-11-17).
      const keep = sum.map((s) => s[3] >= samples.length * 0.05);
      let darkest = -1, darkestL = Infinity;
      sum.forEach((s, j) => {
        if (s[3] >= Math.max(15, samples.length * 0.001) && s[0] / s[3] < darkestL) { darkestL = s[0] / s[3]; darkest = j; }
      });
      if (darkest >= 0 && darkestL < 35) keep[darkest] = true;
      // And a small but clearly distinct colour: red cheeks are a small share
      // of a drawing's ink, and in an uncropped photo (the sheet's own edge
      // inked too) they fell under 5% and printed Brown (review, 2026-11-17).
      const mean = (g: number[]) => [g[0] / g[3], g[1] / g[3], g[2] / g[3]];
      sum.forEach((g, j) => {
        if (keep[j] || g[3] < samples.length * 0.01) return;
        const c = mean(g);
        if (Math.hypot(c[1], c[2]) < 25) return;
        if (sum.every((o, k) => !keep[k] || distinctHue(c, mean(o)))) keep[j] = true;
      });
      centres = sum.filter((_, j) => keep[j]).map(mean);
    }
  }
  // Pale colours of their own: a pink fill or a yellow sun is lighter than
  // 0.45, so the clustering above never sees it, and it printed in the
  // nearest dark ink (a pink fill as a solid Charcoal block; review,
  // 2026-11-17). A pale pixel only founds a new ink when it is FAR from
  // every existing colour: the soft light edge of a navy stroke is close to
  // navy and must not become an ink of its own (sampling everything over
  // 0.2 did exactly that, edging strokes in Teal and dropping a red).
  if (!fixed && centres.length && centres.length < MAX_INKS) {
    const stride = Math.max(1, Math.floor(n / 60000));
    const pale: number[][] = [];
    let paleAll = 0;
    for (let i = 0; i < n; i += stride) {
      const p = i * 4;
      const d = darkness(data, p);
      if (d <= 0.2 || d > 0.45) continue;
      paleAll++;
      const lab = toLab(data[p], data[p + 1], data[p + 2]);
      if (centres.every((c) => distinctHue(lab, c))) pale.push(lab);
    }
    if (pale.length >= Math.max(20, 0.03 * (samples.length + paleAll))) {
      const extra: number[][] = [pale.reduce((a, b) => (b[0] < a[0] ? b : a))];
      while (centres.length + extra.length < MAX_INKS) {
        let far = pale[0], fd = -1;
        for (const q of pale) {
          const d = Math.min(...extra.map((c) => labDist(q, c)));
          if (d > fd) { fd = d; far = q; }
        }
        if (fd < 18) break;
        extra.push(far);
      }
      let groups = extra;
      for (let iter = 0; iter < 6; iter++) {
        const sum = groups.map(() => [0, 0, 0, 0]);
        for (const q of pale) {
          let bi = 0, bd = Infinity;
          groups.forEach((c, j) => { const d = labDist(q, c); if (d < bd) { bd = d; bi = j; } });
          sum[bi][0] += q[0]; sum[bi][1] += q[1]; sum[bi][2] += q[2]; sum[bi][3]++;
        }
        groups = sum.filter((g) => g[3] >= pale.length * 0.2).map((g) => [g[0] / g[3], g[1] / g[3], g[2] / g[3]]);
      }
      centres = centres.concat(groups);
    }
  }
  if (!centres.length) centres = [toLab(35, 32, 31)];

  // 2. Snap each colour to the nearest palette ink; merge any that collide,
  //    and any two that are near twins (Navy and Charcoal): one marker split
  //    across two dark inks reads as a speckled line, not as two inks.
  let inkOf: number[];
  let used: number[];
  if (fixed) {
    inkOf = fixed.inkOf;
    used = fixed.used;
  } else {
    inkOf = centres.map((c) => {
      let bi = 0, bd = Infinity;
      INK_LAB.forEach((k, j) => { const d = labDist(c, k); if (d < bd) { bd = d; bi = j; } });
      return bi;
    });
    for (let a = 0; a < inkOf.length; a++) {
      for (let b = 0; b < a; b++) {
        if (labDist(INK_LAB[inkOf[a]], INK_LAB[inkOf[b]]) < 25) inkOf[a] = inkOf[b];
      }
    }
    used = [...new Set(inkOf)];
    // Lightest ink first, so darker inks overprint it like a real run.
    used.sort((a, b) => INK_LAB[b][0] - INK_LAB[a][0]);
  }

  // 3. Each pixel: how much ink (coverage) and which ink (nearest centre).
  //    Darkness is softened over a radius in proportion to the image first:
  //    a print file resolves pencil grain the preview averages away, and
  //    without this a faint pencil line that previews solid prints as dots.
  const grainRadius = Math.max(1, Math.round(Math.max(W, H) / 1500));
  const dark = new Float32Array(n);
  for (let i = 0; i < n; i++) dark[i] = darkness(data, i * 4);
  const soft = boxBlur(dark, W, H, grainRadius);
  // Where ink starts, relative to this drawing's own strongest marks: bold
  // texta keeps a 0.20 cut, faint pencil (strongest marks near 0.45) gets
  // about 0.11, so its lightest lines are not dropped from the print.
  let lo: number;
  let span: number;
  if (fixed) {
    lo = fixed.lo;
    span = fixed.span;
  } else {
    const hist = new Uint32Array(101);
    let inked = 0;
    for (let i = 0; i < n; i++) if (soft[i] > 0.08) { hist[Math.min(100, Math.round(soft[i] * 100))]++; inked++; }
    let ref = 1;
    for (let t = 0, acc = 0; t <= 100 && inked; t++) { acc += hist[t]; if (acc >= inked * 0.9) { ref = t / 100; break; } }
    lo = Math.max(0.08, Math.min(0.2, 0.25 * ref));
    span = Math.max(0.06, Math.min(0.14, 0.15 * ref));
  }
  const label = new Uint8Array(n);
  const cover = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * 4;
    const d = soft[i];
    // Soft step: flat fills, but stroke edges stay as wobbly as drawn.
    const t = Math.max(0, Math.min(1, (d - lo) / span));
    cover[i] = t * t * (3 - 2 * t);
    if (cover[i] === 0) continue;
    const lab = toLab(data[p], data[p + 1], data[p + 2]);
    let bi = 0, bd = Infinity;
    centres.forEach((c, j) => { const dd = labDist(lab, c); if (dd < bd) { bd = dd; bi = j; } });
    label[i] = used.indexOf(inkOf[bi]);
  }

  // 4. Lay the inks: multiply onto paper, each ink slightly off register,
  //    with a little texture so a flat fill reads as ink, not as a screen.
  const out = createRaster(W, H);
  for (let i = 0; i < n; i++) {
    out.data[i * 4] = paper[0]; out.data[i * 4 + 1] = paper[1]; out.data[i * 4 + 2] = paper[2]; out.data[i * 4 + 3] = 255;
  }
  const shift = Math.max(1, Math.round(Math.max(W, H) * 0.0012));
  // Grain cell in proportion to the image, so the print file's texture
  // matches the preview's rather than being three times finer.
  const cell = grainRadius;
  const offsets = [[0, 0], [shift, -shift], [-shift, shift]];
  used.forEach((inkIndex, layer) => {
    const [ox, oy] = offsets[layer % offsets.length];
    const rgb = INKS[inkIndex].rgb;
    for (let y = 0; y < H; y++) {
      const sy = y - oy;
      if (sy < 0 || sy >= H) continue;
      for (let x = 0; x < W; x++) {
        const sx = x - ox;
        if (sx < 0 || sx >= W) continue;
        const si = sy * W + sx;
        if (label[si] !== layer || cover[si] === 0) continue;
        const a = cover[si] * (0.86 + 0.14 * hash((x / cell) | 0, (y / cell) | 0));
        const o = (y * W + x) * 4;
        for (let c = 0; c < 3; c++) out.data[o + c] = out.data[o + c] * (1 - a + (a * rgb[c]) / 255);
      }
    }
  });
  return { image: out, inks: used.map((i) => INKS[i].name), palette: { centres, inkOf, used, lo, span } };
}
