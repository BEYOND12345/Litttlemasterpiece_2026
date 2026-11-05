# Image quality gate

Status on 2026-11-05: **two-look pipeline built and run on stand-ins; waiting for Dan's
photos and his verdict on both looks.** Nothing commercial starts before that.

## What a parent gets: two looks, no editing

`src/pipeline/` replaces the four styles, inks, backgrounds and upscaler for the new flow.
Deterministic, in the browser, no network calls, no keys, no generative model. Nothing is
redrawn: every mark keeps its shape and place.

- **As drawn** (`cleanup.ts`): find the sheet and straighten it only when the finding is
  unambiguous (otherwise leave it uncropped, so a crop can never cut the drawing); divide
  out the light on the paper (shadow, fall-off, colour cast); stretch faint marks instead of
  thresholding them; whiten table showing past the sheet, in the edge band only.
- **Screen print** (`screenprint.ts`): the drawing's own colours, snapped to a fixed palette
  of 14 inks (1 to 3 per drawing), laid flat, slightly off register, with ink grain. Cream
  paper for framed prints; white available for mugs.
- **Two sizes, one algorithm** (`looks.ts`): a 1600px preview for the parent, and the print
  file at the photo's own pixels (capped at 4096, inside iOS Safari's canvas limit). Every
  step works in proportions of the image, so the print is the preview at more pixels.

The old studio (`SimplifiedStudio`, `intelligentStyleService`) is untouched and still what
the live app runs. The new flow gets built around the two looks once Dan approves them.

## Run it on the real photos

Put the photos in one folder, then either:

- `npm run dev`, open `http://localhost:5173/batch-test`, choose the photos, press Run; or
- `npm run batch-test -- <folder>` (headless; needs Playwright with Chromium). Prints each
  photo's blur verdict and preview time, every print file's size and dpi, and writes
  `contact-sheet.png` and `results.json` to `<folder>/batch-out/`.

`/batch-test` is dev only: `src/main.tsx` mounts it behind `import.meta.env.DEV`, and a
production build contains no trace of it.

## Stand-in run (not Dan's photos)

`npm run standin-photos -- <dir>` builds 8 stand-ins from the only two real drawings in
`public/`, upsampled to 3024x4032. Their real detail is capped by those sources, so read
pipeline behaviour off them, not print sharpness. Times are headless Chromium on a server;
a phone will be slower and has not been measured.

| # | Input | Blur | Preview | Page | As drawn | Screen print |
|---|---|---|---|---|---|---|
| 1 | Clean | sharp 1.00 | 0.6s | fills frame | clean | Red + Navy |
| 2 | Shadow | sharp 1.00 | 0.6s | uncropped | shadow gone | Red + Navy |
| 3 | Keystoned | sharp 0.99 | 0.4s | straightened | straight, clean | Red + Navy |
| 4 | Wooden bench | sharp 0.71 | 0.8s | straightened | faint crease marks at the crumpled sheet's edge | Leaf + Teal + Navy |
| 5 | Camera shake | **blurry 0.36** | 0.5s | fills frame | soft (caught at upload) | Red + Navy |
| 6 | Faint pencil | sharp 1.00 | 0.4s | uncropped | grey lines kept | Charcoal, solid lines |
| 7 | Bold texta | sharp 0.84 | 0.5s | fills frame | clean | Cobalt |
| 8 | Coloured paper | sharp 0.99 | 0.4s | fills frame | paper turned white | Red + Navy |

Print files: 16 of 16 at 3000px or more on the long edge, at the photo's own resolution
(3024x4032 where the page fills the frame; 2642x3208 and 2965x3374 where the sheet was
cropped out of a wider shot). Print files take 2 to 4s each.

For comparison, the old pipeline on the same set (keyless local fallback): 25 to 40s per
photo; shadow, bench and faint pencil failed outright; every output stretched to 4000px wide.

## Blurry-photo rejection

`src/utils/sharpness.ts`, run on the raw upload in `SimplifiedStudio` before anything is
processed. A blurry photo gets "Retake Photo" as the main action and "Use It Anyway" as the
secondary one. Plain variance-of-Laplacian could not do this job (faint pencil scored 220,
the shaken photo 326); the file header explains the measure used instead. The threshold
(0.5) is provisional and should be re-checked against Dan's photos 1 and 5.

## Found on the way, not fixed (decisions for Dan)

- **In the old studio, what prints is not the style the parent picked.** `processedUrl`,
  sent to Gelato as `fileUrl`, is the un-styled master. The new flow must send the chosen
  look's print file.
- **On failure the old studio ships the raw photo as "complete".**
- **iOS Safari canvas limit.** The old master is 21.3MP, over Safari's ~16.7MP limit. The new
  pipeline stays under it by design; neither has been run on an iPhone.
- **Gelato wrapping paper:** not found in Gelato's catalogue; confirm with Gelato before
  building for it.
