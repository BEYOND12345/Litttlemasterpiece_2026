/**
 * /batch-test: the image-quality gate. DEV ONLY (main.tsx mounts it behind
 * import.meta.env.DEV, so it is not in the production bundle).
 *
 * Runs every photo through the two looks a parent chooses between, "As
 * drawn" and "Screen print" (src/pipeline), twice: at preview size, timed,
 * because that is the wait a parent sees; and at print size, because that
 * is the file Gelato prints. The sheet shows the photo, each look, a 1:1
 * crop of the PRINT file, its size and its real dpi at A4 and A3.
 *
 * The pipeline makes no network calls. Every request made while a photo is
 * processed is still logged, so if that ever changes the sheet says so.
 *
 * Headless: scripts/batch-test.mjs drives this page and reads window.__batch.
 */
import React, { useState } from 'react';
import { measureSharpness, SharpnessResult } from '../utils/sharpness';
import { LookId, PREVIEW_LONG_EDGE, PRINT_LONG_EDGE, makeLooks, toCanvas } from '../pipeline/looks';
import { Raster } from '../pipeline/raster';

const LOOKS: { id: LookId; label: string }[] = [
  { id: 'as_drawn', label: 'As drawn' },
  { id: 'screen_print', label: 'Screen print' },
];
const A4_LONG_INCHES = 297 / 25.4;
const A3_LONG_INCHES = 420 / 25.4;
/** The brief's bar for the print file's long edge. */
const BRIEF_MIN_LONG_EDGE = 3000;

interface NetCall {
  host: string;
  status: number | 'failed';
}

export interface BatchOutput {
  style: LookId;
  width: number;
  height: number;
  longEdge: number;
  dpiA4: number;
  dpiA3: number;
  meetsBrief: boolean;
  error?: string;
}

export interface BatchRow {
  name: string;
  nativeWidth: number;
  nativeHeight: number;
  sourceDpiAtA3: number;
  sharpness: SharpnessResult;
  paper: string;
  inks: string[];
  previewMs: number;
  printMs: number;
  network: NetCall[];
  outputs: BatchOutput[];
  error?: string;
}

interface Visual {
  original: string;
  looks: Record<string, { thumb: string; detail: string; full: string }>;
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
const thumbnail = (src: CanvasImageSource & { width: number; height: number }, max: number) => {
  const s = Math.min(1, max / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * s);
  c.height = Math.round(src.height * s);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
};

/** A 1:1 crop from the centre of the print file: what the print looks like up close. */
const detailCrop = (src: HTMLCanvasElement, size: number) => {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const sx = Math.max(0, Math.round(src.width / 2 - size / 2));
  const sy = Math.max(0, Math.round(src.height / 2 - size / 2));
  c.getContext('2d')!.drawImage(src, sx, sy, size, size, 0, 0, size, size);
  return c.toDataURL('image/jpeg', 0.92);
};

const toPngUrl = (c: HTMLCanvasElement) =>
  new Promise<string>((resolve) => c.toBlob((b) => resolve(b ? URL.createObjectURL(b) : ''), 'image/png'));

const fmt = (n: number | null | undefined, d = 2) => (n == null ? 'n/a' : n.toFixed(d));

export const BatchTest: React.FC = () => {
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

    for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) {
      const row: BatchRow = {
        name: file.name,
        nativeWidth: 0,
        nativeHeight: 0,
        sourceDpiAtA3: 0,
        sharpness: null as unknown as SharpnessResult,
        paper: '',
        inks: [],
        previewMs: 0,
        printMs: 0,
        network: [],
        outputs: [],
      };
      const visual: Visual = { original: '', looks: {} };
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

        setProgress(`${file.name}: preview`);
        const preview = await makeLooks(raw, { longEdge: PREVIEW_LONG_EDGE });
        row.previewMs = preview.ms.total;
        row.paper = preview.paperReason;
        row.inks = preview.inks;

        setProgress(`${file.name}: print file`);
        const print = await makeLooks(raw, { longEdge: PRINT_LONG_EDGE });
        row.printMs = print.ms.total;

        for (const { id } of LOOKS) {
          const pv = preview.looks.find((l) => l.id === id)!.image as Raster;
          const pr = print.looks.find((l) => l.id === id)!.image as Raster;
          const longEdge = Math.max(pr.width, pr.height);
          row.outputs.push({
            style: id,
            width: pr.width,
            height: pr.height,
            longEdge,
            dpiA4: Math.round(longEdge / A4_LONG_INCHES),
            dpiA3: Math.round(longEdge / A3_LONG_INCHES),
            meetsBrief: longEdge >= BRIEF_MIN_LONG_EDGE,
          });
          const printCanvas = toCanvas(pr);
          visual.looks[id] = {
            thumb: thumbnail(toCanvas(pv), 420),
            detail: detailCrop(printCanvas, 420),
            full: await toPngUrl(printCanvas),
          };
          printCanvas.width = 0;
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

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 p-6 font-sans">
      <h1 className="font-serif text-3xl mb-1">Batch test</h1>
      <p className="text-sm text-stone-600 mb-4 max-w-3xl">
        Dev only. Each photo, both looks. Preview time is the wait a parent sees; the crop under each look is
        the print file at 1:1.
      </p>

      <div className="flex items-center gap-3 mb-6">
        <input
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

      <div className="space-y-6">
        {rows.map((r, i) => (
          <div key={r.name} className="bg-white border border-stone-200 rounded p-4">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mb-3 text-sm">
              <span className="font-semibold">{r.name}</span>
              <span>source {r.nativeWidth}x{r.nativeHeight}</span>
              <span className={r.sharpness?.verdict === 'blurry' ? 'text-red-700 font-semibold' : ''}>
                blur check: {r.sharpness?.verdict ?? 'n/a'} ({fmt(r.sharpness?.score)} vs {fmt(r.sharpness?.threshold)})
              </span>
              <span><b>preview {(r.previewMs / 1000).toFixed(1)}s</b>, print file {(r.printMs / 1000).toFixed(1)}s</span>
              <span>page: {r.paper}</span>
              <span>inks: {r.inks.join(' + ')}</span>
              <span>network: {r.network.length ? r.network.map((n) => `${n.host} ${n.status}`).join(', ') : 'none'}</span>
              {r.error && <span className="text-red-700">error: {r.error}</span>}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <figure>
                <img src={visuals[i]?.original} alt="" className="w-full border border-stone-200" />
                <figcaption className="text-xs mt-1">photo</figcaption>
              </figure>
              {LOOKS.map(({ id, label }) => {
                const o = r.outputs.find((x) => x.style === id);
                const v = visuals[i]?.looks[id];
                return (
                  <figure key={id}>
                    {v ? (
                      <div className="grid grid-cols-2 gap-2">
                        <img src={v.thumb} alt="" className="w-full border border-stone-200" />
                        <img src={v.detail} alt="" className="w-full border border-stone-200" title="print file, 1:1" />
                      </div>
                    ) : (
                      <div className="aspect-square bg-stone-100" />
                    )}
                    <figcaption className="text-xs mt-1">
                      <span className="font-semibold">{label}</span>
                      {o && (
                        <>
                          {' '}print {o.width}x{o.height}, {o.dpiA4}dpi A4, {o.dpiA3}dpi A3
                          {!o.meetsBrief && <span className="text-red-700 font-semibold"> under {BRIEF_MIN_LONG_EDGE}px</span>}
                          {v && <> · <a className="underline" href={v.full} target="_blank" rel="noreferrer">print file</a></>}
                        </>
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
