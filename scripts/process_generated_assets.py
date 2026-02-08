#!/usr/bin/env python3
"""
Process "checkerboard background" PNG exports into real transparent PNG assets.

Inputs (committed for reproducibility):
  - scripts/assets_inbox/vfx_v1.png
  - scripts/assets_inbox/vfx_v2.png

Outputs:
  - public/assets/vfx/*.png (sprite sheets)
  - public/assets/monsters/*.png (monster sprites)

This is intentionally dependency-light: Pillow + numpy (both commonly available).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, List, Optional, Tuple

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
INBOX = ROOT / "scripts" / "assets_inbox"
OUT_VFX = ROOT / "public" / "assets" / "vfx"
OUT_MON = ROOT / "public" / "assets" / "monsters"


def _ensure_dirs() -> None:
    OUT_VFX.mkdir(parents=True, exist_ok=True)
    OUT_MON.mkdir(parents=True, exist_ok=True)


def _quantize_rgb(arr: np.ndarray, bits: int = 5) -> np.ndarray:
    shift = 8 - bits
    return (arr >> shift) << shift


def _pick_bg_greys(arr_rgb: np.ndarray) -> List[np.ndarray]:
    """
    Pick the two most common "grey-ish" colors in the image as checkerboard background.
    """
    flat = arr_rgb.reshape(-1, 3).astype(np.uint8)
    mx = flat.max(axis=1).astype(np.int16)
    mn = flat.min(axis=1).astype(np.int16)
    delta = mx - mn
    lum = (0.2126 * flat[:, 0] + 0.7152 * flat[:, 1] + 0.0722 * flat[:, 2]).astype(np.float32)
    # Prefer mid greys (checkerboards) and ignore very dark borders.
    mask = (delta <= 10) & (lum >= 60) & (lum <= 210)
    sample = flat[mask]
    if sample.size == 0 or (mask.mean() < 0.08):
        # fallback: allow darker greys if we failed to sample enough
        mask = (delta <= 10) & (lum >= 35) & (lum <= 220)
        sample = flat[mask]

    if sample.size == 0:
        return [np.array([80, 80, 80], dtype=np.float32), np.array([110, 110, 110], dtype=np.float32)]

    # Use a quantized histogram to find two strong seeds, then refine via k-means (k=2).
    q = _quantize_rgb(sample, bits=6)
    colors, counts = np.unique(q, axis=0, return_counts=True)
    idx = np.argsort(-counts)
    seed1 = colors[idx[0]].astype(np.float32)
    seed2 = None
    for i in idx[1:]:
        c = colors[i].astype(np.float32)
        if np.linalg.norm(c - seed1) >= 10:
            seed2 = c
            break
    if seed2 is None:
        seed2 = seed1 + np.array([24, 24, 24], dtype=np.float32)

    c1 = seed1
    c2 = seed2
    pts = sample.astype(np.float32)
    for _ in range(12):
        d1 = np.sum((pts - c1[None, :]) ** 2, axis=1)
        d2 = np.sum((pts - c2[None, :]) ** 2, axis=1)
        m1 = d1 <= d2
        if m1.mean() < 0.01 or m1.mean() > 0.99:
            break
        nc1 = pts[m1].mean(axis=0)
        nc2 = pts[~m1].mean(axis=0)
        if np.linalg.norm(nc1 - c1) < 0.5 and np.linalg.norm(nc2 - c2) < 0.5:
            c1, c2 = nc1, nc2
            break
        c1, c2 = nc1, nc2

    # order by luminance (dark, light)
    l1 = float(0.2126 * c1[0] + 0.7152 * c1[1] + 0.0722 * c1[2])
    l2 = float(0.2126 * c2[0] + 0.7152 * c2[1] + 0.0722 * c2[2])
    if l1 <= l2:
        return [c1.astype(np.float32), c2.astype(np.float32)]
    return [c2.astype(np.float32), c1.astype(np.float32)]


def _rgb_dist(arr_rgb: np.ndarray, color: np.ndarray) -> np.ndarray:
    d = arr_rgb.astype(np.float32) - color.astype(np.float32)
    return np.sqrt(np.sum(d * d, axis=2))


def remove_checkerboard_to_alpha(img: Image.Image) -> Image.Image:
    """
    Convert an opaque PNG that visually shows transparency via a checkerboard
    into a real RGBA with alpha. Also removes large black background areas while
    preserving dark outlines near foreground.
    """
    im = img.convert("RGBA")
    arr = np.array(im, dtype=np.uint8)
    rgb = arr[:, :, :3]

    bg1, bg2 = _pick_bg_greys(rgb)
    d1 = _rgb_dist(rgb, bg1)
    d2 = _rgb_dist(rgb, bg2)
    dgrey = np.minimum(d1, d2)
    # best bg per pixel (for decontamination)
    use_bg1 = d1 <= d2
    bg = np.where(use_bg1[:, :, None], bg1[None, None, :], bg2[None, None, :]).astype(np.float32)

    # Compute a "strong foreground" mask first (for outline preservation).
    # - far from checkerboard AND not too dark/neutral.
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]).astype(np.float32)
    sat = (rgb.max(axis=2) - rgb.min(axis=2)).astype(np.float32)
    strong = (dgrey >= 34.0) & ((lum >= 42.0) | (sat >= 18.0))

    # Dilate strong mask by 2px to keep outlines/shadows adjacent to colored pixels.
    keep = strong.copy()
    for _ in range(2):
        p = np.pad(keep, 1, mode="constant", constant_values=False)
        keep = (
            p[0:-2, 0:-2]
            | p[0:-2, 1:-1]
            | p[0:-2, 2:]
            | p[1:-1, 0:-2]
            | p[1:-1, 1:-1]
            | p[1:-1, 2:]
            | p[2:, 0:-2]
            | p[2:, 1:-1]
            | p[2:, 2:]
        )

    # Background confidence: very close to checkerboard OR very dark and not near foreground.
    bg_hard = dgrey <= 14.0
    dark = lum <= 20.0
    neutral = sat <= 8.0
    bg_black = dark & neutral & (~keep)

    # Soft alpha based on distance to checkerboard; black background is fully transparent.
    # Tight threshold to avoid leaving grey squares.
    t0 = 14.0
    t1 = 70.0
    a = (dgrey - t0) / (t1 - t0)
    a = np.clip(a, 0.0, 1.0)
    # make edges a bit crisper
    a = np.sqrt(a)
    a = np.where(bg_hard | bg_black, 0.0, a)
    # Preserve foreground: strong pixels become fully opaque; the dilated "keep" area
    # becomes mostly opaque to retain outlines/shadows without leaving checkerboard.
    a = np.where(keep & (~strong), np.maximum(a, 0.92), a)
    a = np.where(strong, 1.0, a)

    alpha = (a * 255.0).astype(np.uint8)

    # Decontaminate edges by solving fg = (obs - (1-a)*bg)/a
    obs = rgb.astype(np.float32)
    aa = np.maximum(a[:, :, None], 1e-6)
    fg = (obs - (1.0 - a[:, :, None]) * bg) / aa
    fg = np.clip(fg, 0.0, 255.0).astype(np.uint8)

    out = np.zeros_like(arr)
    out[:, :, :3] = fg
    out[:, :, 3] = alpha
    return Image.fromarray(out, mode="RGBA")

def _corner_mean(rgb: np.ndarray, k: int = 6) -> np.ndarray:
    h, w, _ = rgb.shape
    k = max(1, min(k, min(h, w) // 2))
    corners = [
        rgb[0:k, 0:k, :],
        rgb[0:k, w - k:w, :],
        rgb[h - k:h, 0:k, :],
        rgb[h - k:h, w - k:w, :],
    ]
    pts = np.concatenate([c.reshape(-1, 3) for c in corners], axis=0)
    return pts.mean(axis=0).astype(np.float32)

def remove_solid_color_to_alpha(img: Image.Image, key_rgb: Optional[Tuple[int, int, int]] = None) -> Image.Image:
    """
    Convert a solid-color background (e.g. green screen) to transparency.
    Uses the average corner color as the key if key_rgb is not provided.
    """
    im = img.convert("RGBA")
    arr = np.array(im, dtype=np.uint8)
    rgb = arr[:, :, :3]

    key = np.array(key_rgb, dtype=np.float32) if key_rgb else _corner_mean(rgb)
    d = _rgb_dist(rgb, key)

    # tight threshold for solid backgrounds
    t0 = 18.0
    t1 = 70.0
    a = (d - t0) / (t1 - t0)
    a = np.clip(a, 0.0, 1.0)
    a = np.sqrt(a)
    alpha = (a * 255.0).astype(np.uint8)

    # Decontaminate edges
    obs = rgb.astype(np.float32)
    aa = np.maximum(a[:, :, None], 1e-6)
    fg = (obs - (1.0 - a[:, :, None]) * key[None, None, :]) / aa
    fg = np.clip(fg, 0.0, 255.0).astype(np.uint8)

    out = np.zeros_like(arr)
    out[:, :, :3] = fg
    out[:, :, 3] = alpha
    return Image.fromarray(out, mode="RGBA")

def _mask_segments_1d(values: np.ndarray, threshold: float) -> List[Tuple[int, int]]:
    segs: List[Tuple[int, int]] = []
    inside = values > threshold
    n = int(inside.shape[0])
    i = 0
    while i < n:
        if not inside[i]:
            i += 1
            continue
        j = i
        while j < n and inside[j]:
            j += 1
        segs.append((i, j))
        i = j
    return segs


@dataclass
class Strip:
    y0: int
    y1: int
    frames: List[Tuple[int, int]]

def has_transparency(im: Image.Image) -> bool:
    try:
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        a = np.array(im, dtype=np.uint8)[:, :, 3]
        mn, mx = int(a.min()), int(a.max())
        return mn < 250 or mx < 255
    except Exception:
        return False

def transparency_ratio(im: Image.Image) -> float:
    try:
        if im.mode != "RGBA":
            im = im.convert("RGBA")
        a = np.array(im, dtype=np.uint8)[:, :, 3]
        return float((a < 5).mean())
    except Exception:
        return 0.0

def slice_grid(im: Image.Image, rows: int, cols: int) -> List[Strip]:
    w, h = im.size
    if rows <= 0 or cols <= 0:
        return []
    row_h = h / rows
    col_w = w / cols
    strips: List[Strip] = []
    for r in range(rows):
        y0 = int(round(r * row_h))
        y1 = int(round((r + 1) * row_h))
        frames: List[Tuple[int, int]] = []
        for c in range(cols):
            x0 = int(round(c * col_w))
            x1 = int(round((c + 1) * col_w))
            frames.append((x0, x1))
        strips.append(Strip(y0=y0, y1=y1, frames=frames))
    return strips


def slice_strips_and_frames(im: Image.Image) -> List[Strip]:
    arr = np.array(im, dtype=np.uint8)
    a = arr[:, :, 3].astype(np.float32)
    row_sum = a.sum(axis=1)
    col_sum = a.sum(axis=0)
    # relative thresholds (robust across sizes)
    row_thr = max(2000.0, row_sum.max() * 0.08)
    col_thr = max(2000.0, col_sum.max() * 0.08)
    rows = _mask_segments_1d(row_sum, row_thr)
    strips: List[Strip] = []
    for (y0, y1) in rows:
        # compute columns within this strip
        col = a[y0:y1, :].sum(axis=0)
        frames = _mask_segments_1d(col, col_thr)
        if len(frames) <= 0:
            continue
        strips.append(Strip(y0=y0, y1=y1, frames=frames))
    return strips


def _bbox_alpha(arr_a: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
    ys, xs = np.where(arr_a > 0)
    if ys.size == 0 or xs.size == 0:
        return None
    y0 = int(ys.min())
    y1 = int(ys.max()) + 1
    x0 = int(xs.min())
    x1 = int(xs.max()) + 1
    return (x0, y0, x1, y1)


def _extract_frame(im: Image.Image, x0: int, y0: int, x1: int, y1: int, pad: int = 6) -> Image.Image:
    w, h = im.size
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad)
    y1 = min(h, y1 + pad)
    crop = im.crop((x0, y0, x1, y1))
    # tighten to real alpha bbox again (after padding)
    arr = np.array(crop, dtype=np.uint8)
    bb = _bbox_alpha(arr[:, :, 3])
    if bb:
        cx0, cy0, cx1, cy1 = bb
        crop = crop.crop((cx0, cy0, cx1, cy1))
    return crop


def _center_fit(frame: Image.Image, out_size: Tuple[int, int] = (256, 256), max_inner: int = 244) -> Image.Image:
    fw, fh = frame.size
    ow, oh = out_size
    if fw <= 0 or fh <= 0:
        return Image.new("RGBA", out_size, (0, 0, 0, 0))
    scale = min(max_inner / fw, max_inner / fh, 1.0)
    if scale < 1.0:
        nw = max(1, int(round(fw * scale)))
        nh = max(1, int(round(fh * scale)))
        frame = frame.resize((nw, nh), resample=Image.Resampling.LANCZOS)
        fw, fh = frame.size
    out = Image.new("RGBA", out_size, (0, 0, 0, 0))
    out.paste(frame, ((ow - fw) // 2, (oh - fh) // 2), frame)
    return out


def build_sheet_from_strip(
    im: Image.Image,
    strip: Strip,
    frame_target: Tuple[int, int] = (256, 256),
    frames_wanted: int = 8,
) -> Image.Image:
    frames: List[Image.Image] = []
    for (x0, x1) in strip.frames:
        f = _extract_frame(im, x0, strip.y0, x1, strip.y1, pad=8)
        frames.append(_center_fit(f, out_size=frame_target))
    if not frames:
        return Image.new("RGBA", (frame_target[0] * frames_wanted, frame_target[1]), (0, 0, 0, 0))
    # normalize to wanted count by repeating last frame
    while len(frames) < frames_wanted:
        frames.append(frames[-1].copy())
    frames = frames[:frames_wanted]
    out = Image.new("RGBA", (frame_target[0] * frames_wanted, frame_target[1]), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        out.paste(f, (i * frame_target[0], 0), f)
    return out


def extract_monsters_from_strip(im: Image.Image, strip: Strip) -> List[Image.Image]:
    mons: List[Image.Image] = []
    for (x0, x1) in strip.frames:
        f = _extract_frame(im, x0, strip.y0, x1, strip.y1, pad=10)
        mons.append(_center_fit(f, out_size=(128, 128), max_inner=120))
    return mons


def main() -> int:
    _ensure_dirs()

    src1 = INBOX / "vfx_v1.png"
    src2 = INBOX / "vfx_v2.png"
    if not src1.exists() or not src2.exists():
        print("Missing inputs. Expected:")
        print(" -", src1)
        print(" -", src2)
        return 2

    im1_raw = Image.open(src1).convert("RGBA")
    if has_transparency(im1_raw):
        im1 = im1_raw
    else:
        cb = remove_checkerboard_to_alpha(im1_raw)
        im1 = cb if transparency_ratio(cb) >= 0.01 else remove_solid_color_to_alpha(im1_raw)
    strips1 = slice_strips_and_frames(im1)
    if len(strips1) < 4:
        # Fallback: strict grid (5 rows x 8 columns) if alpha segmentation fails.
        strips1 = slice_grid(im1, rows=5, cols=8)

    # v1 ordering in the provided composite:
    # 0: fire rain, 1: hail, 2: arrow, 3: cleave, 4+: flurry/crit bits
    names1 = ["fireball", "hail", "arrow", "cleave", "flurry"]
    for i, name in enumerate(names1):
        if i >= len(strips1):
            break
        sheet = build_sheet_from_strip(im1, strips1[i], frame_target=(256, 256), frames_wanted=8)
        sheet.save(OUT_VFX / f"{name}.png")

    im2_raw = Image.open(src2).convert("RGBA")
    if has_transparency(im2_raw):
        im2 = im2_raw
    else:
        cb = remove_checkerboard_to_alpha(im2_raw)
        im2 = cb if transparency_ratio(cb) >= 0.01 else remove_solid_color_to_alpha(im2_raw)
    strips2 = slice_strips_and_frames(im2)
    if len(strips2) < 3:
        # Fallback: strict grid (3 rows x 8 columns)
        strips2 = slice_grid(im2, rows=3, cols=8)

    # v2 ordering:
    # 0: level up starburst, 1: rare drop rainbow shine, 2: monsters row
    level_sheet = build_sheet_from_strip(im2, strips2[0], frame_target=(256, 256), frames_wanted=8)
    level_sheet.save(OUT_VFX / "level_up.png")
    rare_sheet = build_sheet_from_strip(im2, strips2[1], frame_target=(256, 256), frames_wanted=8)
    rare_sheet.save(OUT_VFX / "rare_drop.png")

    monsters = extract_monsters_from_strip(im2, strips2[2])
    # expected ordering per the composite: pink, green, blue, crown
    mon_names = ["poring_pink", "poring_green", "poring_blue", "poring_elite"]
    for m, n in zip(monsters, mon_names):
        m.save(OUT_MON / f"{n}.png")

    print("Wrote:")
    for p in sorted(list(OUT_VFX.glob("*.png")) + list(OUT_MON.glob("*.png"))):
        print(" -", p.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
