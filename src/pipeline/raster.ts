/**
 * The smallest set of pixel helpers the two looks need. Pure functions over
 * RGBA buffers, no DOM, so every step is deterministic and testable.
 */
export interface Raster {
  data: Uint8ClampedArray; // RGBA
  width: number;
  height: number;
}

export const createRaster = (width: number, height: number): Raster => ({
  data: new Uint8ClampedArray(width * height * 4),
  width,
  height,
});

/** Area-average shrink by an integer factor. */
export function shrink(src: Raster, k: number): Raster {
  if (k <= 1) return { data: new Uint8ClampedArray(src.data), width: src.width, height: src.height };
  const w = Math.max(1, Math.floor(src.width / k));
  const h = Math.max(1, Math.floor(src.height / k));
  const out = createRaster(w, h);
  const n = k * k;
  const s = src.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0;
      for (let dy = 0; dy < k; dy++) {
        let p = ((y * k + dy) * src.width + x * k) * 4;
        for (let dx = 0; dx < k; dx++, p += 4) {
          r += s[p]; g += s[p + 1]; b += s[p + 2];
        }
      }
      const o = (y * w + x) * 4;
      out.data[o] = r / n; out.data[o + 1] = g / n; out.data[o + 2] = b / n; out.data[o + 3] = 255;
    }
  }
  return out;
}

export function luminance(src: Raster): Float32Array {
  const L = new Float32Array(src.width * src.height);
  const d = src.data;
  for (let i = 0, p = 0; i < L.length; i++, p += 4) L[i] = 0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2];
  return L;
}

/** Separable box blur with clamped edges, radius r. */
export function boxBlur(src: Float32Array, w: number, h: number, r: number): Float32Array {
  if (r < 1) return new Float32Array(src);
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  const win = 2 * r + 1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += src[row + Math.min(w - 1, Math.max(0, i))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / win;
      acc += src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let i = -r; i <= r; i++) acc += tmp[Math.min(h - 1, Math.max(0, i)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / win;
      acc += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Three box passes: close enough to a Gaussian for lighting estimates. */
export const smooth = (src: Float32Array, w: number, h: number, r: number) =>
  boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r);

/** Separable running max (dilate) or min (erode), radius r. Naive O(r); only used on small images. */
export function rankFilter(src: Float32Array, w: number, h: number, r: number, mode: 'max' | 'min'): Float32Array {
  const pick = mode === 'max' ? Math.max : Math.min;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = src[y * w + x];
      for (let i = Math.max(0, x - r); i <= Math.min(w - 1, x + r); i++) v = pick(v, src[y * w + i]);
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let v = tmp[y * w + x];
      for (let i = Math.max(0, y - r); i <= Math.min(h - 1, y + r); i++) v = pick(v, tmp[i * w + x]);
      out[y * w + x] = v;
    }
  }
  return out;
}

/** Bilinear sample of a float plane at a fractional position (clamped). */
export function sampleBilinear(plane: Float32Array, w: number, h: number, x: number, y: number): number {
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(y)));
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = Math.max(0, Math.min(1, x - x0));
  const fy = Math.max(0, Math.min(1, y - y0));
  const a = plane[y0 * w + x0] * (1 - fx) + plane[y0 * w + x1] * fx;
  const b = plane[y1 * w + x0] * (1 - fx) + plane[y1 * w + x1] * fx;
  return a * (1 - fy) + b * fy;
}
