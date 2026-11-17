import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aSeriesSheet, divideOutPaper, orientSheet, placeArt } from './printGeometry.ts';

test('the framed sheet turns to the drawing, keeping the product size', () => {
  const product = { width: 2896, height: 4096 };
  assert.deepEqual(orientSheet(product, { width: 3000, height: 4000 }), { width: 2896, height: 4096 });
  assert.deepEqual(orientSheet(product, { width: 4000, height: 3000 }), { width: 4096, height: 2896 });
  assert.deepEqual(orientSheet({ width: 2475, height: 1155 }, { width: 100, height: 200 }), { width: 1155, height: 2475 });
});

test('aSeriesSheet matches the old posterFor arithmetic', () => {
  assert.deepEqual(aSeriesSheet({ width: 3, height: 4 }, 1400), { width: Math.round(1400 / Math.SQRT2), height: 1400 });
  assert.deepEqual(aSeriesSheet({ width: 4, height: 3 }, 1400), { width: 1400, height: Math.round(1400 / Math.SQRT2) });
});

test('art is centred inside an 8% margin, aspect kept, never past the margin', () => {
  const sheet = { width: 2896, height: 4096 };
  const r = placeArt({ width: 3000, height: 4000 }, sheet);
  const m = Math.round(2896 * 0.08);
  assert.ok(r.x >= m - 1e-9 && r.y >= m - 1e-9);
  assert.ok(r.x + r.width <= sheet.width - m + 1e-9 && r.y + r.height <= sheet.height - m + 1e-9);
  assert.ok(Math.abs(r.width / r.height - 3000 / 4000) < 1e-9);
  assert.ok(Math.abs(r.x - (sheet.width - r.width) / 2) < 1e-9);
  assert.ok(Math.abs(r.y - (sheet.height - r.height) / 2) < 1e-9);
  // A wide drawing on a wide mug wrap fills the height less the margin.
  const mug = placeArt({ width: 4000, height: 3000 }, { width: 2475, height: 1155 });
  assert.ok(Math.abs(mug.height - (1155 - 2 * Math.round(1155 * 0.08))) < 1e-9);
});

test('dividing out cream turns the paper white and leaves ink colour', () => {
  const cream = [246, 241, 231] as const;
  const px = new Uint8ClampedArray([246, 241, 231, 255, 0, 0, 0, 255, 123, 120, 115, 7]);
  divideOutPaper(px, cream);
  assert.deepEqual([...px.slice(0, 4)], [255, 255, 255, 255]);
  assert.deepEqual([...px.slice(4, 8)], [0, 0, 0, 255]);
  assert.deepEqual([...px.slice(8, 12)], [128, 127, 127, 7]); // half-tone stays half-tone; alpha untouched
});
