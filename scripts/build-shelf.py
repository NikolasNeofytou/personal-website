#!/usr/bin/env python3
"""Build the Bookshelf (spines + book panels) from content/books.json.

    python3 scripts/build-shelf.py

Rewrites index.html between the SHELF markers. Each book is a spine (tab)
and a panel: one panorama painting with a region per chapter, its living
loop, the cover, a line on the book, and the chapter buttons.

Per book in books.json (shelf order = list order; plates are numbered I, II, ...):
  slug, shelf (the shelf it stands on), spine {title, w, h}, title, by, idea,
  cover {file, w, h, alt?}, overview (caption for the whole painting), alt,
  chapters: [{tag, name, label, note, focus: "x% y% zoom"}]
"focus" is the point (percent of the painting) the camera centres on and
how far it zooms in. Panorama files: assets/books/plates/<slug>-pano-
{1344,2560,3840}.webp and <slug>-pano-loop.{webm,mp4} (scripts/encode-plate.sh).
A chapter whose close-up loop exists (<slug>-ch<n>-loop.{webm,mp4}, n = its
position in the book's chapter list) gets a data-loop and plays it once the
camera arrives.
"""
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'content/books.json'
INDEX = ROOT / 'index.html'
START, END = '<!-- SHELF:START', '<!-- SHELF:END -->'
e = html.escape
I = ' ' * 16


def roman(n):
    out = ''
    for v, r in ((10, 'X'), (9, 'IX'), (5, 'V'), (4, 'IV'), (1, 'I')):
        while n >= v:
            out, n = out + r, n - v
    return out


def spine(b, first):
    s = b['spine']
    return (f'{I}            <button class="spine" type="button" role="tab" id="spine-{b["slug"]}" aria-controls="book-{b["slug"]}"'
            f' aria-selected="{"true" if first else "false"}" style="--w: {s["w"]}px; --h: {s["h"]}px">'
            f'<span class="spine-num" aria-hidden="true">{b["num"]}</span><span class="spine-title">{e(s["title"])}</span></button>')


def chapter(b, n, c):
    tag = f'<span class="chapter-no">{e(c["tag"])}</span>' if c.get('tag') else ''
    label = f' data-label="{e(c["label"])}"' if c.get('label') else ''
    loop = f'assets/books/plates/{b["slug"]}-ch{n}-loop'
    if (ROOT / f'{loop}.webm').exists() and (ROOT / f'{loop}.mp4').exists():
        label += f' data-loop="{loop}"'
    return (f'{I}                <button class="chapter" type="button" aria-pressed="false" data-focus="{c["focus"]}"{label}'
            f' data-note="{e(c["note"])}">{tag}{e(c["name"])}</button>')


def panel(b):
    s, p = b['slug'], f'assets/books/plates/{b["slug"]}-pano'
    chapters = '\n'.join(chapter(b, n, c) for n, c in enumerate(b['chapters']))
    return f'''{I}    <article class="book-panel book-panel--tour" id="book-{s}" role="tabpanel" aria-labelledby="spine-{s}">
{I}        <div class="book-plate" data-tour>
{I}            <div class="plate-view">
{I}                <img class="plate-still" src="{p}-1344.webp"
{I}                     srcset="{p}-1344.webp 1344w, {p}-2560.webp 2560w, {p}-3840.webp 3840w"
{I}                     sizes="(max-width: 1023px) 92vw, 600px" width="3840" height="2160" loading="lazy" decoding="async"
{I}                     alt="{e(b["alt"])}">
{I}                <video class="book-loop" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1">
{I}                    <source src="{p}-loop.webm" type="video/webm">
{I}                    <source src="{p}-loop.mp4" type="video/mp4">
{I}                </video>
{I}            </div>
{I}            <video class="chapter-loop" muted loop playsinline preload="none" aria-hidden="true" tabindex="-1"></video>
{I}        </div>
{I}        <div class="book-cover"><img src="assets/books/{b["cover"]["file"]}" width="{b["cover"]["w"]}" height="{b["cover"]["h"]}" loading="lazy" decoding="async" alt="{e(b["cover"].get("alt") or f'Cover of {b["title"]}, Penguin Classics')}"></div>
{I}        <div class="book-body">
{I}            <p class="book-fig"><span>Plate {b["num"]}</span> <span class="book-fig-name">{e(b["overview"])}</span></p>
{I}            <h4 class="book-title">{e(b["title"])}</h4>
{I}            <p class="book-by">{e(b["by"])}</p>
{I}            <p class="book-idea">{e(b["idea"])}</p>
{I}            <div class="chapters" role="group" aria-label="Look closer at a chapter of {e(b["title"])}">
{chapters}
{I}                <button class="chapter chapter--all" type="button" aria-pressed="true">Whole painting</button>
{I}            </div>
{I}            <p class="chapter-note" aria-live="polite"></p>
{I}        </div>
{I}    </article>'''


def main():
    books = json.loads(DATA.read_text(encoding='utf-8'))
    for i, b in enumerate(books):
        b['num'] = roman(i + 1)
        for c in b['chapters']:
            x, y, z = map(float, c['focus'].split())
            assert 0 <= x <= 100 and 0 <= y <= 100 and z >= 1, f'{b["slug"]}: bad focus {c["focus"]}'
    shelves = {}
    for b in books:
        shelves.setdefault(b['shelf'], []).append(b)
    rails = []
    for name, row in shelves.items():
        spines = '\n'.join(spine(b, b is books[0]) for b in row)
        rails.append(f'''{I}        <div class="shelf-rail" role="none">
{spines}
{I}            <span class="shelf-label" aria-hidden="true">{e(name)} · {len(row):02d}</span>
{I}        </div>''')
    panels = '\n'.join(panel(b) for b in books)
    block = f'''{START} (generated by scripts/build-shelf.py from content/books.json; edit there) -->
{I}<div class="shelf" data-shelf>
{I}    <div class="shelf-case" role="tablist" aria-label="Books on my shelves">
{chr(10).join(rails)}
{I}    </div>
{panels}
{I}</div>
{I}{END}'''
    page = INDEX.read_text(encoding='utf-8')
    if START not in page:
        sys.exit('index.html has no SHELF markers')
    page = re.sub(re.escape(START) + r'.*?' + re.escape(END), lambda _: block, page, flags=re.S)
    INDEX.write_text(page, encoding='utf-8')
    print(f'{len(books)} books on {len(shelves)} shelves, {sum(len(b["chapters"]) for b in books)} chapters')


if __name__ == '__main__':
    main()
