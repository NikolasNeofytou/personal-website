#!/usr/bin/env python3
"""Encode one painting into the AVIF + WebP sizes the site serves.

usage: scripts/encode-still.py SRC OUT_PREFIX --sizes 1280 1920 2560 3840 [--zoom 5120 7680]

Writes OUT_PREFIX-<width>.avif and OUT_PREFIX-<width>.webp for every size, each
downsized from SRC with Lanczos. --sizes are the ones a page loads first, so
they are kept small (1280 and below leanest: phones start there); --zoom sizes
load only for close-ups, so they get a higher quality to keep the brushwork.
Needs ImageMagick, avifenc and cwebp.

    scripts/encode-still.py town-master.png assets/town/town \\
        --sizes 1280 1920 2560 3840 --zoom 5120 7680
"""
import argparse
import os
import subprocess
import sys
import tempfile

# quality per kind: (avifenc -q, cwebp -q)
Q_LEAN = (52, 74)     # 1280 and below: what phones start on, so the LCP image stays lean
Q_SCREEN = (56, 74)   # AVIF at least as close to the source as the WebP (SSIM)
Q_ZOOM = (64, 82)


def run(cmd):
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL,
                   stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('src')
    ap.add_argument('out_prefix')
    ap.add_argument('--sizes', type=int, nargs='+', required=True)
    ap.add_argument('--zoom', type=int, nargs='*', default=[])
    a = ap.parse_args()

    out_dir = os.path.dirname(a.out_prefix) or '.'
    os.makedirs(out_dir, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        for w in a.sizes + a.zoom:
            qa, qw = Q_ZOOM if w in a.zoom else Q_LEAN if w <= 1280 else Q_SCREEN
            png = os.path.join(tmp, f'{w}.png')
            run(['magick', a.src, '-filter', 'Lanczos', '-resize', f'{w}x', '-strip', png])
            avif, webp = f'{a.out_prefix}-{w}.avif', f'{a.out_prefix}-{w}.webp'
            run(['avifenc', '-q', str(qa), '-s', '4', '-j', 'all', png, avif])
            run(['cwebp', '-q', str(qw), '-m', '6', '-mt', png, '-o', webp])
            print(f'{w:>5}  avif {os.path.getsize(avif) // 1024:>5} KB   webp {os.path.getsize(webp) // 1024:>5} KB')


if __name__ == '__main__':
    sys.exit(main())
