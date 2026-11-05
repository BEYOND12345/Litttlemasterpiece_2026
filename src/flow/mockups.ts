/**
 * Product previews drawn in code: a framed print and an 11oz mug, each with
 * the parent's chosen look on it. Instant, offline, no upload, and nothing
 * borrowed: the stock mockup photos in public/ are AI-generated, carry a
 * Gemini watermark, and the mug one has its left half in deep shadow.
 *
 * These show placement and proportion honestly (the framed print is the
 * print file inside a frame; the mug wraps the art round a cylinder), and
 * are deliberately a clean product shot rather than a lifestyle photo.
 */

export type ProductId = 'framed' | 'mug';

/** Background of every preview, so the two products read as a set. */
const WALL = '#EFEAE2';

/** Paper colours used by the two looks (must match src/pipeline/screenprint.ts PAPER). */
const CREAM = [246, 241, 231];

function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d')! };
}

/** Fit art inside a box, keeping its aspect. */
function contain(aw: number, ah: number, bw: number, bh: number) {
  const s = Math.min(bw / aw, bh / ah);
  return { w: aw * s, h: ah * s };
}

/**
 * The print file a framed print would get: the art centred on its own paper
 * with an even margin, on an A-series sheet in the art's orientation.
 */
export function posterFor(art: HTMLCanvasElement, paper: 'white' | 'cream', long = 1400): HTMLCanvasElement {
  const portrait = art.height >= art.width;
  const W = portrait ? Math.round(long / Math.SQRT2) : long;
  const H = portrait ? long : Math.round(long / Math.SQRT2);
  const { c, ctx } = canvas(W, H);
  ctx.fillStyle = paper === 'cream' ? `rgb(${CREAM.join(',')})` : '#FFFFFF';
  ctx.fillRect(0, 0, W, H);
  const margin = Math.round(Math.min(W, H) * 0.08);
  const fit = contain(art.width, art.height, W - 2 * margin, H - 2 * margin);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art, (W - fit.w) / 2, (H - fit.h) / 2, fit.w, fit.h);
  return c;
}

export function framedMockup(art: HTMLCanvasElement, paper: 'white' | 'cream', size = 900): HTMLCanvasElement {
  const { c, ctx } = canvas(size, size);
  const wall = ctx.createLinearGradient(0, 0, 0, size);
  wall.addColorStop(0, '#F3EFE8');
  wall.addColorStop(1, '#E6E0D6');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, size, size);

  const poster = posterFor(art, paper);
  const box = contain(poster.width, poster.height, size * 0.62, size * 0.78);
  const frame = Math.round(size * 0.028);
  const x = (size - box.w) / 2;
  const y = (size - box.h) / 2 - size * 0.01;

  // Shadow on the wall, then the oak frame.
  ctx.save();
  ctx.shadowColor = 'rgba(60, 45, 30, 0.28)';
  ctx.shadowBlur = size * 0.035;
  ctx.shadowOffsetY = size * 0.016;
  ctx.fillStyle = '#C9A57D';
  ctx.fillRect(x - frame, y - frame, box.w + 2 * frame, box.h + 2 * frame);
  ctx.restore();
  const wood = ctx.createLinearGradient(x - frame, 0, x + box.w + frame, 0);
  wood.addColorStop(0, '#BF9A70');
  wood.addColorStop(0.5, '#D1AE86');
  wood.addColorStop(1, '#B89169');
  ctx.fillStyle = wood;
  ctx.fillRect(x - frame, y - frame, box.w + 2 * frame, box.h + 2 * frame);

  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(poster, x, y, box.w, box.h);
  // The frame's lip casts a little shade on the paper's top and left.
  const lip = ctx.createLinearGradient(0, y, 0, y + size * 0.02);
  lip.addColorStop(0, 'rgba(0,0,0,0.16)');
  lip.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lip;
  ctx.fillRect(x, y, box.w, size * 0.02);
  return c;
}

/** Inks laid on cream, moved onto white: multiply onto paper is linear, so divide it back out. */
function onWhite(art: HTMLCanvasElement, paper: 'white' | 'cream', maxLong: number): HTMLCanvasElement {
  const s = Math.min(1, maxLong / Math.max(art.width, art.height));
  const { c, ctx } = canvas(Math.round(art.width * s), Math.round(art.height * s));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(art, 0, 0, c.width, c.height);
  if (paper === 'cream') {
    const img = ctx.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.min(255, (d[i] * 255) / CREAM[0]);
      d[i + 1] = Math.min(255, (d[i + 1] * 255) / CREAM[1]);
      d[i + 2] = Math.min(255, (d[i + 2] * 255) / CREAM[2]);
    }
    ctx.putImageData(img, 0, 0);
  }
  return c;
}

export function mugMockup(art: HTMLCanvasElement, paper: 'white' | 'cream', size = 900): HTMLCanvasElement {
  const { c, ctx } = canvas(size, size);
  ctx.fillStyle = WALL;
  ctx.fillRect(0, 0, size, size);

  // An 11oz mug is about 8.2cm across and 9.5cm tall.
  const bodyH = size * 0.5;
  const bodyW = bodyH * (8.2 / 9.5);
  const left = (size - bodyW) / 2 - size * 0.05;
  const top = (size - bodyH) / 2;
  const rim = bodyW * 0.09; // ellipse half-height of the rim and base
  const cx = left + bodyW / 2;
  const r = bodyW / 2;

  // Floor shadow.
  ctx.save();
  ctx.fillStyle = 'rgba(70, 55, 40, 0.18)';
  ctx.filter = `blur(${Math.round(size * 0.015)}px)`;
  ctx.beginPath();
  ctx.ellipse(cx + size * 0.02, top + bodyH + rim * 0.6, r * 1.15, rim * 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Handle on the right.
  ctx.save();
  ctx.lineWidth = bodyW * 0.11;
  ctx.strokeStyle = '#E9E6E1';
  ctx.beginPath();
  ctx.ellipse(left + bodyW + bodyW * 0.08, top + bodyH * 0.47, bodyW * 0.2, bodyH * 0.26, 0, -Math.PI / 2, Math.PI / 2);
  ctx.stroke();
  ctx.lineWidth = bodyW * 0.03;
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.stroke();
  ctx.restore();

  // Body: a cylinder lit from the front left.
  const body = new Path2D();
  body.moveTo(left, top);
  body.lineTo(left, top + bodyH);
  body.ellipse(cx, top + bodyH, r, rim, 0, Math.PI, 0, true);
  body.lineTo(left + bodyW, top);
  body.ellipse(cx, top, r, rim, 0, 0, Math.PI, false);
  body.closePath();
  const shade = ctx.createLinearGradient(left, 0, left + bodyW, 0);
  shade.addColorStop(0, '#D9D5CF');
  shade.addColorStop(0.3, '#FBFAF8');
  shade.addColorStop(0.62, '#F4F2EE');
  shade.addColorStop(1, '#CFCAC3');
  ctx.fillStyle = shade;
  ctx.fill(body);

  // The art, wrapped round the cylinder: each column of the visible face
  // samples the flat print at its arc length, so it compresses toward the
  // edges the way a printed mug does. Multiplied, so the body's shading
  // shows through the ink.
  const flat = onWhite(art, paper, 900);
  const artH = bodyH * 0.72;
  const artW = (flat.width / flat.height) * artH;
  const arcMax = r * Math.asin(0.98); // usable face, edge to edge
  const layer = canvas(size, size);
  layer.ctx.fillStyle = '#FFFFFF';
  layer.ctx.fillRect(0, 0, size, size);
  const artTop = top + (bodyH - artH) / 2 + rim * 0.3;
  for (let x = Math.ceil(left); x < left + bodyW; x++) {
    const t = Math.max(-0.98, Math.min(0.98, (x + 0.5 - cx) / r));
    const arc = r * Math.asin(t);
    if (Math.abs(arc) > Math.min(arcMax, artW / 2)) continue;
    const sx = ((arc + artW / 2) / artW) * flat.width;
    layer.ctx.drawImage(flat, Math.max(0, Math.min(flat.width - 1, sx)), 0, 1, flat.height, x, artTop, 1, artH);
  }
  ctx.save();
  ctx.clip(body);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(layer.c, 0, 0);
  ctx.restore();

  // Glaze highlight and the rim's opening.
  ctx.save();
  ctx.clip(body);
  const gloss = ctx.createLinearGradient(left, 0, left + bodyW, 0);
  gloss.addColorStop(0.18, 'rgba(255,255,255,0)');
  gloss.addColorStop(0.26, 'rgba(255,255,255,0.45)');
  gloss.addColorStop(0.34, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(left, top, bodyW, bodyH + rim);
  ctx.restore();
  ctx.fillStyle = '#E4E0DA';
  ctx.beginPath();
  ctx.ellipse(cx, top, r, rim, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#CFC9C1';
  ctx.beginPath();
  ctx.ellipse(cx, top + rim * 0.12, r * 0.9, rim * 0.78, 0, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

export function productMockup(product: ProductId, art: HTMLCanvasElement, paper: 'white' | 'cream') {
  return product === 'framed' ? framedMockup(art, paper) : mugMockup(art, paper);
}
