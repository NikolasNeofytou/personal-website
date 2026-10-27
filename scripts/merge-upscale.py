#!/usr/bin/env python3
"""Merge upscaled tiles of a painting into one sharper master, without changing it.

usage: scripts/merge-upscale.py ORIGINAL OUT.png --tile WxH --scale 2 TILE@X,Y [TILE@X,Y ...]

Each TILE is a generative upscale of the ORIGINAL region whose top-left corner
is X,Y (in ORIGINAL pixels). The master keeps the ORIGINAL's colour and shapes
(its low frequencies, Lanczos-upscaled) and takes only the fine detail (the
high frequencies) from the tiles. So the painting cannot drift in colour, and
tiles cannot seam: their detail is cross-faded over the overlaps. --sigma is
the split between the two, in master pixels.

    scripts/merge-upscale.py town-3840.png town-master.png --tile 2512x1080 --scale 2 \\
        t00.png@0,0 t10.png@1328,0 t01.png@0,568 t11.png@1328,568
"""
import argparse
import sys

import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter

Image.MAX_IMAGE_PIXELS = None


def low(a, sigma):
    return gaussian_filter(a, sigma=(sigma, sigma, 0), mode='reflect')


def ramp(n, fade_lo, fade_hi):
    """Weights along one axis: 1 inside, linear fade over the overlapping ends."""
    w = np.ones(n, np.float32)
    if fade_lo:
        w[:fade_lo] = np.linspace(0, 1, fade_lo, dtype=np.float32)
    if fade_hi:
        w[-fade_hi:] = np.minimum(w[-fade_hi:], np.linspace(1, 0, fade_hi, dtype=np.float32))
    return w


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('original')
    ap.add_argument('out')
    ap.add_argument('tiles', nargs='+', help='TILE@X,Y')
    ap.add_argument('--tile', required=True, help='WxH of each tile region, in ORIGINAL pixels')
    ap.add_argument('--scale', type=int, default=2)
    ap.add_argument('--sigma', type=float, default=2.5)
    ap.add_argument('--fade', type=int, default=240, help='cross-fade width in master pixels')
    a = ap.parse_args()

    orig = Image.open(a.original).convert('RGB')
    W, H = orig.width * a.scale, orig.height * a.scale
    base = np.asarray(orig.resize((W, H), Image.LANCZOS), np.float32)
    out = low(base, a.sigma)
    del base

    detail = np.zeros((H, W, 3), np.float32)
    weight = np.zeros((H, W, 1), np.float32)
    tw, th = (int(v) * a.scale for v in a.tile.split('x'))
    for spec in a.tiles:
        path, at = spec.rsplit('@', 1)
        x, y = (int(v) * a.scale for v in at.split(','))
        tile = Image.open(path).convert('RGB')
        src_w, src_h = tile.size
        # fit the tile to the master pixels its region covers, whatever size the upscaler returned
        t = np.asarray(tile.resize((tw, th), Image.LANCZOS), np.float32)
        hp = t - low(t, a.sigma)
        wy = ramp(th, a.fade if y > 0 else 0, a.fade if y + th < H else 0)
        wx = ramp(tw, a.fade if x > 0 else 0, a.fade if x + tw < W else 0)
        w = (wy[:, None] * wx[None, :])[..., None]
        detail[y:y + th, x:x + tw] += hp * w
        weight[y:y + th, x:x + tw] += w
        print(f'{path}: {src_w}x{src_h} -> {tw}x{th} at {x},{y}')

    covered = weight > 0
    detail = np.where(covered, detail / np.maximum(weight, 1e-6), 0)
    out += detail
    Image.fromarray(np.clip(out + 0.5, 0, 255).astype(np.uint8)).save(a.out)
    print(f'{a.out}: {W}x{H}')


if __name__ == '__main__':
    sys.exit(main())
