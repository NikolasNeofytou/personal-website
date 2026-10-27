# nikolasneofytou.com

The personal site of Nikolas Neofytou: embedded systems and the full-stack apps around them.

**Live:** https://nikolasneofytou.com/

It is hand-written HTML, CSS and JavaScript with no framework and no build step at serve time. It is served by GitHub Pages straight from `main`, on a custom domain (`CNAME`) registered with Cloudflare. The site itself is part of the portfolio, so it is held to a budget: Lighthouse 94+ on mobile, 100 for accessibility, best practices and SEO, and zero layout shift.

## What's on it

- **Landing.** One painted town (`assets/town/`) with the six projects as places in it. Picking a place glides a camera there and opens its placard; the pins, tabs and placards are generated from `content/work/projects.json`.
- **Selected work.** Six case studies (`work/*.html`), each with an interactive explainer or a scroll-driven "week with" story (`js/explainers.js`).
- **How I work.** The three kinds of work, each tied to a case study, and how a project runs. Every case study ends with a way to start a project or ask for a walkthrough.
- **Signal trace.** An SVG PCB trace in the gutter, routed from live element positions.
- **Bookshelf.** 26 books on five shelves. Each book is one painted panorama with a camera tour of its chapters and animated close-ups.
- **Writing.** The latest Substack posts, from a snapshot.

- **A new first screen, in preview (`/v2/`).** Built in parallel with the live landing and not linked from it (`noindex`). Cinna's real network is drawn in SVG from a recorded hour. As you scroll, the camera closes in on one bus and Cinna's colours open from it until they fill the screen and become Cinna's see-it frame, with the real app looping. Its own `v2/v2.css` and `v2/v2.js`. Without JavaScript, or with reduced motion or Save-Data, it shows the two stills instead.

Motion is skipped under `prefers-reduced-motion` and Save-Data, and every interactive section has static markup without JavaScript.

## Layout

```
index.html            front page
work/*.html           case studies (generated, do not edit by hand)
css/styles.css        all styles
js/script.js          site behaviour: nav, town, trace, shelf, copy
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

`scripts/encode-plate.sh` (ffmpeg) turns raw video exports into the bookshelf's plate loops.

Paintings are encoded with `scripts/encode-still.py` (ImageMagick, avifenc, cwebp) into the AVIF and WebP sizes the pages serve, with close-up-only sizes at a higher quality. `scripts/merge-upscale.py` (NumPy, Pillow, SciPy) builds a sharper master from generative upscales of a painting's tiles: it keeps the original's colour and shapes and takes only fine detail from the tiles, so the painting cannot change and the tiles cannot seam. The town's 7680 px master was made this way from four tiles.

`scripts/build-v2-data.py` cuts Cinna's recorded hour (the stage data built from OpenStreetMap and the national feed, Mon 26 Oct 2026) down to what `/v2/` shows: `assets/v2/cinna-hour.json`. That is 105 s of every bus, the streets in view, and the 400's path to its stop. The input carries no plates, vehicle IDs or trip IDs. The first-screen stills in `assets/v2/frame1-*` are screenshots of `/v2/` at the top of the scroll with the words hidden, since the words are HTML.

When CSS or JS changes, bump the `?v=` asset version in `index.html`, then re-run `build-case-studies.py` so the case studies pick it up.

## Running locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765.

## Rights

The code is here to read. The writing and photographs are © Nikolas Neofytou, and the generated paintings and video were made for this site; please ask before reusing any of them. Book covers belong to their publishers. Icons are from Font Awesome Free (CC BY 4.0). Instrument Serif, Inter and DM Mono are under the SIL Open Font License.
