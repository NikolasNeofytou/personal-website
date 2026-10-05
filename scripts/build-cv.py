#!/usr/bin/env python3
"""Print content/cv.html to assets/cv.pdf with headless Chrome (one A4 page).

    python3 scripts/build-cv.py

Set CHROME_PATH if Chrome is not in the default macOS location.
"""
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'content' / 'cv.html'
OUT = ROOT / 'assets' / 'cv.pdf'
CHROME = os.environ.get('CHROME_PATH', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')

subprocess.run([
    CHROME, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
    '--run-all-compositor-stages-before-draw', '--virtual-time-budget=5000',
    f'--print-to-pdf={OUT}', SRC.as_uri(),
], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

pages = len(re.findall(rb'/Type\s*/Page[^s]', OUT.read_bytes()))
print(f'{OUT.relative_to(ROOT)}: {pages} page(s), {OUT.stat().st_size // 1024} KB')
if pages != 1:
    sys.exit('The CV must fit on one page; tighten content/cv.html.')
