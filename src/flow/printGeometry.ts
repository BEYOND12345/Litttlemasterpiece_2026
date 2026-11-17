/**
 * The arithmetic of a print file, with no DOM, so Node can test it
 * (printGeometry.test.ts). mockups.ts and printFile.ts draw with it, which is
 * what keeps the preview and the file Gelato prints the same picture.
 */

export interface Size {
  width: number;
  height: number;
}

export interface Rect extends Size {
  x: number;
  y: number;
}

/** Share of the sheet's short side left as margin round the art. */
export const SHEET_MARGIN = 0.08;

/**
 * The framed print's sheet: the product's print size, turned to the
 * drawing's orientation, so a landscape drawing is not shrunk into a
 * portrait sheet. (Whether Gelato needs a different product UID for a
 * landscape frame is an owner to-do in docs/PAYMENTS.md.)
 */
export function orientSheet(product: Size, art: Size): Size {
  const artPortrait = art.height >= art.width;
  const sheetPortrait = product.height >= product.width;
  return artPortrait === sheetPortrait
    ? { width: product.width, height: product.height }
    : { width: product.height, height: product.width };
}

/** An A-series sheet (1:sqrt 2) with this long edge, in the art's orientation. */
export function aSeriesSheet(art: Size, longEdge: number): Size {
  const short = Math.round(longEdge / Math.SQRT2);
  return art.height >= art.width ? { width: short, height: longEdge } : { width: longEdge, height: short };
}

/** The art, kept to its aspect, centred inside the sheet less an even margin. */
export function placeArt(art: Size, sheet: Size, margin = SHEET_MARGIN): Rect {
  const m = Math.round(Math.min(sheet.width, sheet.height) * margin);
  const boxW = sheet.width - 2 * m;
  const boxH = sheet.height - 2 * m;
  const s = Math.min(boxW / art.width, boxH / art.height);
  const width = art.width * s;
  const height = art.height * s;
  return { x: (sheet.width - width) / 2, y: (sheet.height - height) / 2, width, height };
}

/**
 * Inks laid on a coloured paper, moved onto white. The screen print is
 * multiplied onto its paper, which is linear per channel, so dividing by the
 * paper colour takes it back out: paper becomes 255, inks keep their own
 * colour. In place, RGBA; alpha untouched.
 */
export function divideOutPaper(data: Uint8ClampedArray, paper: readonly [number, number, number]): void {
  const [pr, pg, pb] = paper;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, (data[i] * 255) / pr);
    data[i + 1] = Math.min(255, (data[i + 1] * 255) / pg);
    data[i + 2] = Math.min(255, (data[i + 2] * 255) / pb);
  }
}
