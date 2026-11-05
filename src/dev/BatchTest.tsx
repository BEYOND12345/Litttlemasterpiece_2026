/**
 * /batch-test: the Phase 1 image-quality gate. DEV ONLY (main.tsx mounts it
 * behind import.meta.env.DEV, so it is not in the production bundle).
 *
 * Runs every photo through the same two calls the studio makes
 * (createArtworkMaster, then generateStyleVariant per style) with the
 * studio's default options, and lays out a contact sheet: the photo, then
 * each style with its output size, a 1:1 detail crop, and a full-size link.
 *
 * Two numbers are printed per output and they mean different things:
 *   - OUTPUT long edge: what the pipeline produced. upscaleImage always
 *     stretches to 4000px wide, so this passes on almost any input.
 *   - SOURCE dpi at A3: real detail, from the photo's own pixels. This is
 *     the number that predicts a sharp print. Interpolation adds pixels, not
 *     detail.
 *
 * Every network call made while a photo is processed is logged, so the sheet
 * says which path ran (Remove.bg or the local fallback, Gemini or nothing)
 * rather than assuming it from which keys happen to be set.
 *
 * Headless: scripts/batch-test.mjs drives this page and reads window.__batch.
 */
import React, { useRef, useState } from 'react';
import {
  createArtworkMaster,
  generateStyleVariant,
  StyleOptions,
  StyleType,
} from '../services/intelligentStyleService';
import { BRAND_BACKGROUNDS, BRAND_INKS, DUOTONE_PAIRS } from '../constants/constants';
import { measureSharpness, SharpnessResult } from '../utils/sharpness';

const STYLES: StyleType[] = ['original_clean', 'enhanced_print', 'monochrome', 'duotone'];
const A3_LONG_INCHES = 420 / 25.4;
/** The brief's bar. Note it is about 181dpi on A3, not 300. */
const BRIEF_MIN_LONG_EDGE = 3000;
/** What 300dpi on A3 actually needs. */
const A3_300DPI_LONG_EDGE = Math.round(A3_LONG_INCHES * 300);

/** The studio's defaults (SimplifiedStudio initial state). */
const STYLE_OPTIONS: Record<StyleType, StyleOptions> = {
  original_clean: { backgroundColor: BRAND_BACKGROUNDS[0].hex },
  enhanced_print: { backgroundColor: BRAND_BACKGROUNDS[0].hex },
  monochrome: { backgroundColor: BRAND_BACKGROUNDS[0].hex, inkColor: BRAND_INKS[0].hex },
  duotone: {
    backgroundColor: BRAND_BACKGROUNDS[0].hex,
    duotoneDark: DUOTONE_PAIRS[0].dark,
    duotoneLight: DUOTONE_PAIRS[0].light,
  },
};

interface NetCall {
  host: string;
  status: number | 'failed';
}

export interface BatchOutput {
  style: StyleType;
  width: number;
  height: number;
  longEdge: number;
  meetsBrief: boolean;
  meets300dpi: boolean;
  ms: number;
  steps: string[];
  error?: string;
}

export interface BatchRow {
  name: string;
  nativeWidth: number;
  nativeHeight: number;
  sourceDpiAtA3: number;
  sharpness: SharpnessResult;
  masterWidth: number;
  masterHeight: number;
  masterMs: number;
  geminiAnalysed: boolean;
  network: NetCall[];
  outputs: BatchOutput[];
  error?: string;
}

interface Visual {
  original: string;
  outputs: Record<string, { thumb: string; detail: string; full: string }>;
}

declare global {
  interface Window {
    __batch?: { done: boolean; rows: BatchRow[] };
  }
}

// Record every request made while a photo is in the pipeline. Installed once.
let netLog: NetCall[] | null = null;
if (!(window as unknown as { __batchFetchWrapped?: boolean }).__batchFetchWrapped) {
  (window as unknown as { __batchFetchWrapped?: boolean }).__batchFetchWrapped = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const host = url.startsWith('data:') || url.startsWith('blob:') ? '' : new URL(url, location.href).host;
    try {
      const res = await original(input, init);
      if (netLog && host && host !== location.host) netLog.push({ host, status: res.status });
      return res;
    } catch (e) {
      if (netLog && host && host !== location.host) netLog.push({ host, status: 'failed' });
      throw e;
    }
  };
}

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onloadend = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = src;
  });

/** Whole image at long edge `max`, as a small JPEG. */
const thumbnail = (img: HTMLImageElement, max: number) => {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * s);
  c.height = Math.round(img.naturalHeight * s);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
};

/** A 1:1 crop from the centre: what the print looks like up close. */
const detailCrop = (img: HTMLImageElement, size: number) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  const sx = Math.max(0, Math.round(img.naturalWidth / 2 - size / 2));
  const sy = Math.max(0, Math.round(img.naturalHeight / 2 - size / 2));
  ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.92);
};

const toObjectUrl = async (dataUrl: string) => URL.createObjectURL(await (await fetch(dataUrl)).blob());

const fmt = (n: number | null | undefined, d = 2) => (n == null ? 'n/a' : n.toFixed(d));

export const BatchTest: React.FC = () => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [visuals, setVisuals] = useState<Visual[]>([]);
  const [progress, setProgress] = useState('');
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    setRows([]);
    setVisuals([]);
    const done: BatchRow[] = [];
    window.__batch = { done: false, rows: done };

    // One photo at a time: each master is about 21 megapixels, and holding
    // several in flight at once is how a laptop tab runs out of memory.
    for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
      const row: BatchRow = {
        name: file.name,
        nativeWidth: 0,
        nativeHeight: 0,
        sourceDpiAtA3: 0,
        sharpness: null as unknown as SharpnessResult,
        masterWidth: 0,
        masterHeight: 0,
        masterMs: 0,
        geminiAnalysed: false,
        network: [],
        outputs: [],
      };
      const visual: Visual = { original: '', outputs: {} };
      netLog = row.network;
      try {
        setProgress(`${file.name}: reading`);
        const raw = await readAsDataUrl(file);
        const rawImg = await loadImage(raw);
        row.nativeWidth = rawImg.naturalWidth;
        row.nativeHeight = rawImg.naturalHeight;
        row.sourceDpiAtA3 = Math.round(Math.max(row.nativeWidth, row.nativeHeight) / A3_LONG_INCHES);
        visual.original = thumbnail(rawImg, 360);

        setProgress(`${file.name}: blur check`);
        row.sharpness = await measureSharpness(raw);

        setProgress(`${file.name}: master`);
        const t0 = performance.now();
        const master = await createArtworkMaster('batch-test', raw, (s) => setProgress(`${file.name}: ${s}`));
        row.masterMs = Math.round(performance.now() - t0);
        row.masterWidth = master.metadata.resolution.width;
        row.masterHeight = master.metadata.resolution.height;
        row.geminiAnalysed = !!master.metadata.v1Analysis;

        for (const style of STYLES) {
          setProgress(`${file.name}: ${style}`);
          const t1 = performance.now();
          try {
            const v = await generateStyleVariant(master.masterUrl, style, STYLE_OPTIONS[style], master.metadata);
            const ms = Math.round(performance.now() - t1);
            const img = await loadImage(v.variantUrl);
            const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
            row.outputs.push({
              style,
              width: img.naturalWidth,
              height: img.naturalHeight,
              longEdge,
              meetsBrief: longEdge >= BRIEF_MIN_LONG_EDGE,
              meets300dpi: longEdge >= A3_300DPI_LONG_EDGE,
              ms,
              steps: v.processingApplied,
            });
            visual.outputs[style] = {
              thumb: thumbnail(img, 360),
              detail: detailCrop(img, 360),
              full: await toObjectUrl(v.variantUrl),
            };
          } catch (e) {
            row.outputs.push({
              style, width: 0, height: 0, longEdge: 0, meetsBrief: false, meets300dpi: false,
              ms: Math.round(performance.now() - t1), steps: [], error: String(e),
            });
          }
        }
      } catch (e) {
        row.error = String(e);
      }
      netLog = null;
      done.push(row);
      setRows([...done]);
      setVisuals((prev) => [...prev, visual]);
    }
    setProgress('Done');
    setRunning(false);
    window.__batch = { done: true, rows: done };
  };

  const outputs = rows.flatMap((r) => r.outputs);
  const short = outputs.filter((o) => !o.meetsBrief).length;

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <h1 className="font-serif text-3xl mb-1">Batch test</h1>
      <p className="text-sm text-stone-600 mb-4 max-w-3xl">
        Dev only. Every photo goes through the studio pipeline at all four styles with the studio defaults.
        Output size passes on almost anything because the upscaler stretches to 4000px wide; source dpi at A3
        is the honest number.
      </p>

      <div className="flex items-center gap-3 mb-6">
        <input
          ref={inputRef}
          data-testid="batch-files"
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        <button
          data-testid="batch-run"
          disabled={!files.length || running}
          onClick={run}
          className="px-4 py-2 bg-stone-900 text-white rounded disabled:opacity-40"
        >
          Run {files.length || ''} photo{files.length === 1 ? '' : 's'}
        </button>
        <span className="text-sm text-stone-600" data-testid="batch-progress">{progress}</span>
      </div>

      {outputs.length > 0 && (
        <p className="text-sm mb-4">
          {outputs.length} outputs. Under {BRIEF_MIN_LONG_EDGE}px long edge: <b>{short}</b>. Under{' '}
          {A3_300DPI_LONG_EDGE}px (true 300dpi A3): <b>{outputs.filter((o) => !o.meets300dpi).length}</b>.
        </p>
      )}

      <div className="space-y-6">
        {rows.map((r, i) => (
          <div key={r.name} className="bg-white border border-stone-200 rounded p-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3 text-sm">
              <span className="font-semibold">{r.name}</span>
              <span>source {r.nativeWidth}x{r.nativeHeight}, <b>{r.sourceDpiAtA3} dpi at A3</b></span>
              <span className={r.sharpness?.verdict === 'blurry' ? 'text-red-700 font-semibold' : ''}>
                blur check: {r.sharpness?.verdict ?? 'n/a'} (score {fmt(r.sharpness?.score)}, threshold{' '}
                {fmt(r.sharpness?.threshold)}, VoL {fmt(r.sharpness?.laplacianVariance, 0)})
              </span>
              <span>master {r.masterWidth}x{r.masterHeight} in {(r.masterMs / 1000).toFixed(1)}s</span>
              <span>Gemini analysis: {r.geminiAnalysed ? 'yes' : 'no'}</span>
              <span>
                network:{' '}
                {r.network.length
                  ? r.network.map((n) => `${n.host} ${n.status}`).join(', ')
                  : 'none (local background removal, canvas upscale)'}
              </span>
              {r.error && <span className="text-red-700">error: {r.error}</span>}
            </div>
            <div className="grid grid-cols-5 gap-3">
              <figure>
                <img src={visuals[i]?.original} alt="" className="w-full border border-stone-200" />
                <figcaption className="text-xs mt-1">photo</figcaption>
              </figure>
              {STYLES.map((s) => {
                const o = r.outputs.find((x) => x.style === s);
                const v = visuals[i]?.outputs[s];
                return (
                  <figure key={s}>
                    {v ? (
                      <>
                        <img src={v.thumb} alt="" className="w-full border border-stone-200" />
                        <img src={v.detail} alt="" className="w-full mt-1 border border-stone-200" title="1:1 centre crop" />
                      </>
                    ) : (
                      <div className="aspect-square bg-stone-100" />
                    )}
                    <figcaption className="text-xs mt-1">
                      <div className="font-semibold">{s}</div>
                      {o?.error ? (
                        <div className="text-red-700">{o.error}</div>
                      ) : (
                        o && (
                          <>
                            <div className={o.meetsBrief ? '' : 'text-red-700 font-semibold'}>
                              {o.width}x{o.height} {o.meetsBrief ? '' : `SHORT of ${BRIEF_MIN_LONG_EDGE}`}
                            </div>
                            <div>{(o.ms / 1000).toFixed(1)}s, 1:1 crop below thumb</div>
                            {v && (
                              <a className="underline" href={v.full} target="_blank" rel="noreferrer">full size</a>
                            )}
                          </>
                        )
                      )}
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
