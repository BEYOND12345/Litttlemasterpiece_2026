#!/usr/bin/env python3
"""
Build eight STAND-IN test photos for the Phase 1 batch test, one per capture
category in the brief, at iPhone resolution (3024x4032).

These are not Dan's photos and must never be reported as if they were. They
exist so the batch test and the blur detector can be exercised before the real
set arrives. Only two real children's drawings ship in public/, so every
stand-in is derived from one of them:

  SCAN  public/ab00b5010ed2a40346fd8549b29a3d16.jpg  1200x1770, marker, scanned
  PHOTO public/before image.png                      864x1184, crayon, phone photo
                                                    on a wooden table

Both sources are smaller than a phone photo, so every stand-in is UPSAMPLED to
3024x4032. That makes the pipeline's memory, timing and output dimensions
realistic, but the real detail in each stand-in is capped by its source. Do not
read print sharpness off them; that is what Dan's set is for.

Usage: python3 scripts/make-standin-photos.py <out-dir>
Needs numpy and Pillow. Deterministic (fixed seed).
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCAN = os.path.join(ROOT, "public", "ab00b5010ed2a40346fd8549b29a3d16.jpg")
PHOTO = os.path.join(ROOT, "public", "before image.png")
W, H = 3024, 4032
rng = np.random.default_rng(20261105)


def f32(im):
    return np.asarray(im.convert("RGB"), dtype=np.float32)


def to_im(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))


def sensor_noise(a, sigma=2.5):
    return a + rng.normal(0, sigma, a.shape).astype(np.float32)


def fit(im, w, h):
    """Upsample to fill w x h, cropping the overflow (centre)."""
    s = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)
    x, y = (im.width - w) // 2, (im.height - h) // 2
    return im.crop((x, y, x + w, y + h))


def paper_on_white():
    """The scan filling the frame with a white margin, like a careful phone shot."""
    scan = Image.open(SCAN).convert("RGB")
    s = min((W * 0.92) / scan.width, (H * 0.92) / scan.height)
    scan = scan.resize((round(scan.width * s), round(scan.height * s)), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), (246, 245, 242))
    canvas.paste(scan, ((W - scan.width) // 2, (H - scan.height) // 2))
    return canvas


def perspective_coeffs(src_quad, dst_quad):
    """Coefficients for PIL's PERSPECTIVE transform mapping dst -> src."""
    m = []
    for (x, y), (u, v) in zip(dst_quad, src_quad):
        m.append([x, y, 1, 0, 0, 0, -u * x, -u * y])
        m.append([0, 0, 0, x, y, 1, -v * x, -v * y])
    b = np.array(src_quad, dtype=np.float64).reshape(8)
    return np.linalg.solve(np.array(m, dtype=np.float64), b).tolist()


def motion_blur(a, length, angle_deg):
    """Camera shake: average of shifted copies along a line."""
    out = np.zeros_like(a)
    t = np.radians(angle_deg)
    for i in range(length):
        d = i - (length - 1) / 2
        dx, dy = int(round(d * np.cos(t))), int(round(d * np.sin(t)))
        out += np.roll(np.roll(a, dy, axis=0), dx, axis=1)
    return out / length


def wood(w, h):
    """Low-frequency warm grain, enough to read as a table top."""
    x = np.linspace(0, 1, w, dtype=np.float32)[None, :]
    y = np.linspace(0, 1, h, dtype=np.float32)[:, None]
    grain = np.sin((x * 38 + np.sin(y * 9) * 0.6) * np.pi) * 0.5 + 0.5
    base = np.array([176, 128, 84], dtype=np.float32)
    a = base[None, None, :] * (0.82 + 0.18 * grain[..., None])
    return np.broadcast_to(a, (h, w, 3)).copy()


def make_all(out):
    os.makedirs(out, exist_ok=True)
    clean = f32(paper_on_white())

    shots = {}

    # 1. Clean, well lit, flat on white.
    shots["1_clean"] = sensor_noise(clean)

    # 2. Shadow / uneven light: a side fall-off plus the soft shadow of a phone
    #    held over the page, and a warm indoor cast.
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    falloff = 1.0 - 0.42 * (xx / W)
    blob = np.exp(-(((xx - W * 0.35) / (W * 0.28)) ** 2 + ((yy - H * 0.30) / (H * 0.18)) ** 2))
    light = (falloff * (1.0 - 0.38 * blob))[..., None]
    warm = np.array([1.0, 0.93, 0.80], dtype=np.float32)[None, None, :]
    shots["2_shadow"] = sensor_noise(clean * light * warm, 3.5)

    # 3. Keystoned: the page shot from low, so the top edge is narrower, on a
    #    grey counter.
    page = Image.open(SCAN).convert("RGB")
    pw, ph = page.size
    dst = [(W * 0.22, H * 0.10), (W * 0.80, H * 0.13), (W * 0.95, H * 0.93), (W * 0.06, H * 0.90)]
    src = [(0, 0), (pw, 0), (pw, ph), (0, ph)]
    warped = page.transform((W, H), Image.PERSPECTIVE, perspective_coeffs(src, dst), Image.BICUBIC,
                            fillcolor=(0, 0, 0))
    mask = Image.new("L", page.size, 255).transform((W, H), Image.PERSPECTIVE,
                                                   perspective_coeffs(src, dst), Image.BICUBIC)
    counter = Image.new("RGB", (W, H), (128, 126, 122))
    counter.paste(warped, (0, 0), mask)
    shots["3_keystone"] = sensor_noise(f32(counter))

    # 4. Kitchen bench, background clutter: the real phone photo, upsampled.
    shots["4_bench"] = sensor_noise(f32(fit(Image.open(PHOTO), W, H)))

    # 5. Camera shake: 1 is the same scene, moved 1.3% of the frame width
    #    during the exposure, at an angle.
    shots["5_blurry"] = sensor_noise(motion_blur(clean, 40, 20.0))

    # 6. Faint pencil: grey strokes at a quarter of the original contrast.
    grey = f32(Image.open(SCAN).convert("L").convert("RGB"))
    faint = 255 - (255 - grey) * 0.25
    faint_page = Image.new("RGB", (W, H), (246, 245, 242))
    fp = to_im(faint)
    s = min((W * 0.92) / fp.width, (H * 0.92) / fp.height)
    fp = fp.resize((round(fp.width * s), round(fp.height * s)), Image.LANCZOS)
    faint_page.paste(fp, ((W - fp.width) // 2, (H - fp.height) // 2))
    shots["6_faint_pencil"] = sensor_noise(f32(faint_page), 2.0)

    # 7. Bold texta: the marker strokes thickened about three times and
    #    pushed to a saturated ink.
    thick = paper_on_white().filter(ImageFilter.MinFilter(13))
    t = f32(thick)
    ink = (t.mean(axis=2, keepdims=True) < 140)
    t = np.where(ink, np.array([24, 52, 170], dtype=np.float32)[None, None, :], t)
    shots["7_bold_texta"] = sensor_noise(t)

    # 8. Coloured, textured paper: the drawing multiplied onto kraft sugar
    #    paper with low-frequency fibre texture.
    fibre = Image.fromarray((rng.normal(0, 1, (H // 8, W // 8)) * 40 + 128).clip(0, 255).astype(np.uint8))
    fibre = f32(fibre.resize((W, H), Image.BICUBIC).filter(ImageFilter.GaussianBlur(3)))[..., :1] / 128.0
    kraft = np.array([214, 178, 128], dtype=np.float32)[None, None, :] * (0.92 + 0.08 * fibre)
    shots["8_coloured_paper"] = sensor_noise(clean / 255.0 * kraft)

    for name, a in shots.items():
        path = os.path.join(out, f"{name}.jpg")
        to_im(a).save(path, quality=88)
        print(path)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: make-standin-photos.py <out-dir>")
    make_all(sys.argv[1])
