# Phase 1: image quality gate

Status on 2026-11-05: **built, run on stand-ins, waiting for Dan's 8 photos.**
Phase 2 does not start until Dan has looked at real output and said go.

## Run it on the real photos

Put the 8 photos in one folder, then either:

- `npm run dev`, open `http://localhost:5173/batch-test`, choose the photos, press Run; or
- `npm run batch-test -- <folder>` (headless; needs Playwright with Chromium). Prints every
  output's size, flags any long edge under 3000px, and writes `contact-sheet.png` and
  `results.json` to `<folder>/batch-out/`.

Run it with the real `.env`. The sheet lists every network call per photo, so it shows
whether Remove.bg and Gemini actually ran or the local fallbacks did. The stand-in run
below had no keys, so it is the fallback path only.

`/batch-test` is dev only: `src/main.tsx` mounts it behind `import.meta.env.DEV`, and a
production build contains no trace of it (checked by grepping `dist/`, and checked that
the same grep finds it in a build with DEV on).

## Blurry-photo rejection

`src/utils/sharpness.ts`, run on the raw upload in `SimplifiedStudio` before anything is
processed. A blurry photo gets "Retake Photo" as the main action and "Use It Anyway" as
the secondary one.

Plain variance-of-Laplacian could not do this job: on the stand-ins, faint pencil (sharp)
scored 220 and the shaken photo 326, so any cut that rejects photo 5 rejects photo 6. The
gate uses a contrast-normalised, per-direction version instead; the file header explains
why. The threshold (0.5) is provisional, calibrated on stand-ins, and should be re-checked
against Dan's photos 1 and 5.

`analyzePhotoForV1` (Gemini) returns a `drawing_quality.blurry` flag, but nothing reads it:
the only use of that analysis is a `console.log` of `user_message`. It also needs a key and
a network round trip. The new check is local and deterministic.

## Stand-in run (not Dan's photos)

`npm run standin-photos -- <dir>` builds 8 stand-ins from the only two real drawings in
`public/`, upsampled to 3024x4032. Their real detail is capped by those sources (a
1200x1770 scan and an 864x1184 phone photo), so read pipeline behaviour off them, not
print sharpness.

| # | Input | Blur check | What the pipeline did (local fallback path) |
|---|---|---|---|
| 1 | Clean, flat, white | sharp 1.00 | Fine at a glance; 1:1 crops show holes punched in stroke edges |
| 2 | Shadow, uneven light | sharp 1.00 | **Failed.** The shadow is kept as a shape; duotone floods it terracotta |
| 3 | Keystoned | sharp 0.99 | Not straightened; mono and duotone show the trapezoid page |
| 4 | Wooden bench (real photo) | sharp 0.71 | **Failed.** Wood and shadow kept, crayon fill shredded into blotches |
| 5 | Camera shake | **blurry 0.36** | Caught. Outputs are soft, as expected |
| 6 | Faint pencil | sharp 1.00 | **Failed.** Strokes erased to dotted ghosts in all four styles |
| 7 | Bold texta | sharp 0.84 | Best result. Crisp; slight stair-stepping on edges at 1:1 |
| 8 | Coloured paper | sharp 0.99 | Good. Paper removed, strokes kept; edge speckle as in 1 |

All 32 outputs are 4000x5333 (long edge 5333, so >= 3000 and >= 4961). That pass means
little: `upscaleImage` always stretches to 4000px wide, so the 864x1184 bench photo
"passes" while holding about 72dpi of real detail at A3.

Every style, every input: `enhanced_print` darkens the whole image by up to 20% toward the
corners (`applySubtleVignette(0.2)`), so white paper prints grey at the edges.

## Found on the way, not fixed (decisions for Dan)

- **What prints is not the style the parent picked.** `processedUrl`, which `orderService`
  sends to Gelato as `fileUrl`, is `cleanedUrl`, which is set to the un-styled master
  (`SimplifiedStudio.tsx`, `setCleanedUrl(masterResult.masterUrl)`). The chosen variant
  (`currentVariantUrl`) is only ever displayed. The first variant is also never generated
  after upload: `generateCurrentStyle()` runs before `masterUrl` state updates and returns
  early.
- **On failure the raw photo ships as "complete".** `runAutomaticRestoration`'s catch sets
  the raw upload as the cleaned image and marks status COMPLETE.
- **iOS Safari canvas limit, unverified.** Safari refuses canvases over about 16.7MP; the
  master is 4000x5333 = 21.3MP. If that limit applies here, the pipeline fails on an
  iPhone. Nothing in this sandbox can run WebKit, so this needs a real iPhone.
- **The brief's 3000px bar is about 181dpi on A3.** True 300dpi A3 is 4961px.
- Perspective correction and shadow removal are no-ops (`enhancementService.ts`, "skipping
  ... performance optimization"). Gemini's `paper_bbox` and `rotation_degrees` are
  returned and never used.
