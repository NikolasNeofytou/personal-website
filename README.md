# nikolasneofytou.com

The personal site of Nikolas Neofytou: embedded systems and the full-stack apps around them.

**Live:** https://nikolasneofytou.com/

It is hand-written HTML, CSS and JavaScript with no framework and no build step at serve time. It is served by GitHub Pages straight from `main`, on a custom domain (`CNAME`) registered with Cloudflare. The site itself is part of the portfolio, so it is held to a budget: Lighthouse 94+ on mobile, 100 for accessibility, best practices and SEO, and zero layout shift.

## What's on it

- **Selected work.** Six case studies (`work/*.html`), each with an interactive explainer or a scroll-driven "week with" story (`js/explainers.js`).
- **Fig. 00 / Fig. 01.** A looping hero clip and a scroll-scrubbed canvas (bench → board → silicon).
- **Signal trace.** An SVG PCB trace in the gutter, routed from live element positions.
- **Bookshelf.** 26 books on five shelves. Each book is one painted panorama with a camera tour of its chapters and animated close-ups.
- **Writing and photography.** Writing comes from a Substack snapshot; photography has EXIF capture data in a lightbox.

Motion is skipped under `prefers-reduced-motion` and Save-Data, and every interactive section has static markup without JavaScript.

## Layout

```
index.html            front page
work/*.html           case studies (generated, do not edit by hand)
css/styles.css        all styles
js/script.js          site behaviour: nav, trace, scrub, shelf, lightbox
js/explainers.js      case-study demos
content/              sources for the generated parts (not published)
scripts/              generators and media encoders (not published)
assets/               fonts, images, video, OG cards, CV
```

## Editing

The generated regions are rebuilt from `content/` with Python 3 (standard library only):

```bash
python3 scripts/build-case-studies.py
python3 scripts/build-shelf.py
python3 scripts/fetch-substack.py
python3 scripts/build-cv.py
```

- `build-case-studies.py` writes `work/*.html` and the project cards in `index.html` from `content/work/`.
- `build-shelf.py` writes the Bookshelf from `content/books.json`.
- `build-cv.py` prints `content/cv.html` to `assets/cv.pdf` with headless Chrome and fails if it spills onto a second page.
- `fetch-substack.py` snapshots the latest posts into `assets/substack.json`. Run it after publishing a post, because Substack blocks CI runners.

The `scripts/encode-*.sh` helpers (ffmpeg) turn raw video exports into the hero loop, scrub frames and plate loops.

When CSS or JS changes, bump the `?v=` asset version in `index.html`, then re-run `build-case-studies.py` so the case studies pick it up.

## Running locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Rights

The code is here to read. The writing and photographs are © Nikolas Neofytou, and the generated paintings and video were made for this site; please ask before reusing any of them. Book covers belong to their publishers. Icons are from Font Awesome Free (CC BY 4.0). Instrument Serif, Inter and DM Mono are under the SIL Open Font License.
