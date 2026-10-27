#!/usr/bin/env python3
"""Build the case-study pages: work/<slug>.html.

Each page = the shared shell (head, icon sprite, sidebar, footer — taken
from index.html so there is one source of truth) + an article from
content/work/<slug>.html, described by content/work/projects.json. It also
regenerates the Selected Work cards (between the CASES markers) and the landing
town (TOWN markers) in index.html from the same file, so a project's facts
live in one place.

    python3 scripts/build-case-studies.py

Re-run after editing index.html's sidebar/footer or anything under
content/work/, then commit the generated work/*.html. Stdlib only.
"""
import html
import json
import pathlib
import re
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "work"
OUT = ROOT / "work"
SITE = "https://nikolasneofytou.com"


def between(text: str, start: str, end: str) -> str:
    """The slice from `start` up to and including the first `end` after it."""
    i = text.index(start)
    return text[i:text.index(end, i) + len(end)]


def relink(fragment: str) -> str:
    """Point index-relative links one directory up; in-page anchors go home."""
    def fix(m: re.Match) -> str:
        attr, url = m.group(1), m.group(2)
        if url.startswith("#i-"):                      # sprite references stay local
            return m.group(0)
        if url.startswith("#"):
            url = "../index.html" + (url if url != "#top" else "")
        elif not re.match(r"[a-z]+:|//|/", url):
            url = "../" + url
        return f'{attr}="{url}"'
    return re.sub(r'\b(href|src)="([^"]*)"', fix, fragment)


ICON = '<svg class="icon" aria-hidden="true" focusable="false"><use href="#i-{}"></use></svg>'
EMAIL = "nikolas@nikolasneofytou.com"


def mailto(subject: str, body: str = "") -> str:
    """A mailto: link, escaped for an HTML attribute."""
    q = "subject=" + urllib.parse.quote(subject) + ("&body=" + urllib.parse.quote(body) if body else "")
    return html.escape(f"mailto:{EMAIL}?{q}", quote=True)


# the project enquiry, prefilled with the questions the contact section asks (index.html uses the same link)
ENQUIRY = mailto("Project enquiry",
                 "Hi Nikolas,\n\nWhat it's for:\n\nWho will use it:\n\nWhen you need it:\n\nBudget (a rough range is fine):\n")


def render_card(p: dict, i: int, total: int) -> str:
    """One Selected Work card for index.html, from projects.json."""
    c, slug, title = p["card"], p["slug"], html.escape(p["title"])
    bullets = "\n".join(f"                            <li>{b}</li>" for b in c["bullets"])
    tags = "".join(f'<span class="tech-tag">{t}</span>' for t in c["tags"])
    links = "\n".join(f"                            {l}" for l in c["links"])
    return f"""                <!-- {p['title']} -->
                <div class="case" role="group" aria-roledescription="slide" aria-label="Project {i} of {total}">
                    <div class="case-cover" aria-hidden="true">
                        <a href="work/{slug}.html" class="case-cover-link" tabindex="-1">
                        <img src="assets/covers/{slug}-1344.webp" style="view-transition-name: cover-{slug}"
                             srcset="assets/covers/{slug}-672.webp 672w, assets/covers/{slug}-1344.webp 1344w"
                             sizes="(max-width: 1023px) 86vw, 700px"
                             width="1344" height="752" alt="" loading="lazy" decoding="async">
                        </a>
                    </div>
                    <div class="case-rule" aria-hidden="true"><span>{p['num']}</span></div>
                    <div class="case-body">
                        <header class="case-head">
                            <h3 class="case-title" style="view-transition-name: title-{slug}">{title}</h3>
                            {c['flag_html']}
                        </header>
                        <p class="case-role">{c['role']}</p>
                        <p class="case-line"><span class="case-k">Problem</span> {c['problem']}</p>
                        <p class="case-line"><span class="case-k">Approach</span> {c['approach']}</p>
                        <ul class="case-decisions">
{bullets}
                        </ul>
                        <p class="case-line"><span class="case-k">Outcome</span> {c['outcome']}</p>
                        <div class="case-tech">
                            {tags}
                        </div>
                        <div class="case-links">
                            <a class="case-badge case-badge--read" href="work/{slug}.html">Read the case study {ICON.format('arrow-right')}</a>
{links}
                        </div>
                    </div>
                </div>

"""


def write_cards(projects: list) -> None:
    """Regenerate the cards between the CASES markers in index.html."""
    path = ROOT / "index.html"
    text = path.read_text()
    start = text.index("<!-- CASES:START")
    start = text.index("\n", start) + 1
    end = text.index("                <!-- CASES:END -->")
    # a project with a `see` frame above the gallery is not repeated as a card
    carded = [p for p in projects if "see" not in p]
    cards = "".join(render_card(p, i + 1, len(carded)) for i, p in enumerate(carded))
    text = text[:start] + cards + text[end:]
    text = re.sub(r'(<span id="caseTotal">)\d+(</span>)', rf"\g<1>{len(carded):02d}\g<2>", text)
    path.write_text(text)
    print(f"index.html: {len(carded)} cards")


def rgba(hex_: str, alpha: float) -> str:
    """#RRGGBB at an alpha, as CSS rgba()."""
    r, g, b = (int(hex_.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    return f"rgba({r},{g},{b},{alpha})"


def write_see(projects: list) -> None:
    """Regenerate the see-it frames between the SEE markers in index.html: one
    full-width frame per project that has a `see` block (its own colours, one
    line, the real app on screen). The still is always there; js/script.js adds
    the recorded loop only when the frame is on screen, never under reduced
    motion or Save-Data. Without JS the still stands."""
    path = ROOT / "index.html"
    text = path.read_text()
    start = text.index("<!-- SEE:START")
    start = text.index("\n", start) + 1
    end = text.index("        <!-- SEE:END -->")
    I = " " * 8
    total = ROMAN[len(projects) - 1]
    frames = []
    for i, p in enumerate(projects):
        if "see" not in p:
            continue
        s, v, n = p["slug"], p["see"], ROMAN[i]
        c = v["colors"]
        a1, a2, a3 = c["arch"]
        colours = (f"--see-field: {c['field']}; --see-accent: {c['accent']}; --see-text: {c['text']}; "
                   f"--see-ring-1: {rgba(a3, 0.14)}; --see-ring-2: {rgba(a2, 0.16)}; "
                   f"--see-ring-3: {rgba(a1, 0.26)}; --see-ring-4: {rgba(a1, 0.16)}")
        alt = html.escape(v["alt"], quote=True)
        frames.append(f"""{I}<!-- {p['title']} -->
{I}<section class="see" id="see-{s}" aria-labelledby="see-{s}-h" style="{colours}">
{I}    <div class="see-inner">
{I}        <div class="see-arches" aria-hidden="true"></div>
{I}        <div class="see-copy">
{I}            <p class="see-num">{n} / {total} · {html.escape(p['title'])}</p>
{I}            <h2 class="see-h" id="see-{s}-h">{v['line']}</h2>
{I}            <p class="see-line"><span class="status-pulse" aria-hidden="true"></span>{html.escape(v['status'])}</p>
{I}        </div>
{I}        <p class="see-rec"><i aria-hidden="true"></i>{html.escape(v['rec'])}</p>
{I}        <figure class="see-device">
{I}            <img class="see-still" src="{v['assets']}/poster.jpg" width="788" height="1713" alt="{alt}" loading="lazy" decoding="async">
{I}            <video class="see-loop" muted loop playsinline preload="none" data-webm="{v['assets']}/loop.webm" data-mp4="{v['assets']}/loop.mp4" aria-hidden="true" tabindex="-1"></video>
{I}        </figure>
{I}        <a class="see-more" href="work/{s}.html">How it&#x27;s built {ICON.format('arrow-down')}</a>
{I}    </div>
{I}</section>
""")
    text = text[:start] + "".join(frames) + text[end:]
    path.write_text(text)
    print(f"index.html: {len(frames)} see-it frame(s)")


ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
TOWN_W, TOWN_H = 3840, 1648                 # one painting, encoded at assets/town/town-<w>.{avif,webp}
TOWN_SIZES = [1280, 1920, 2560, 3840]
TOWN_ALT = ("A painted Mediterranean town on a hillside above the sea at golden hour: a road winding down "
            "to a harbour, a stadium, a round temple on a knoll where an augur watches a flock of birds, "
            "a theatre carved into the hill, a workshop with paper drying on lines, and a library under "
            "an old olive tree.")


def write_town(projects: list) -> None:
    """Regenerate the landing town between the TOWN markers in index.html: the
    painting, one pin and tab per project (a place in the town), and a placard each.
    Without JS the tabs are plain links to the case studies and the whole town shows."""
    path = ROOT / "index.html"
    text = path.read_text()
    start = text.index("<!-- TOWN:START")
    start = text.index("\n", start) + 1
    end = text.index("        <!-- TOWN:END -->")
    I = " " * 8

    srcset = lambda ext: ", ".join(f"assets/town/town-{w}.{ext} {w}w" for w in TOWN_SIZES)
    sizes = "(max-width: 760px) 160vw, 100vw"
    pins, tabs, cards, places = [], [], [], []
    for i, p in enumerate(projects):
        s, t, n = p["slug"], p["town"], ROMAN[i]
        name, place = html.escape(p["title"]), html.escape(t["place"])
        focus = " ".join(str(v) for v in t["focus"])
        pins.append(f'{I}            <a class="town-pin" href="work/{s}.html" tabindex="-1" data-at="{t["pin"][0]} {t["pin"][1]}" '
                    f'data-focus="{focus}" style="--d: {0.3 + 0.12 * i:.2f}s"><i></i><b>{n}<span> · {name}</span></b></a>')
        tabs.append(f'{I}        <a class="town-tab" id="town-k-{s}" href="work/{s}.html" data-panel="town-p-{s}"><span>{n}</span>{name}</a>')
        meas = "".join(f"<div><dt>{html.escape(k)}</dt><dd>{html.escape(v)}</dd></div>" for k, v in t["meas"])
        state = " town-status--bench" if t.get("bench") else ""
        cards.append(f"""{I}        <div class="town-card" id="town-p-{s}" hidden>
{I}            <p class="town-card-head">Place {n} <span class="town-status{state}"><span class="town-dot" aria-hidden="true"></span>{html.escape(t["status"])}</span></p>
{I}            <p class="town-name">{name}</p>
{I}            <p class="town-place">{place}</p>
{I}            <p class="town-line">{html.escape(t["line"])}</p>
{I}            <dl class="town-meas">{meas}</dl>
{I}            <a class="town-link" href="work/{s}.html">Read the case study <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"></use></svg></a>
{I}        </div>""")
        places.append(f"{place[0].lower() + place[1:]} is {name}")
    block = f"""{I}<div class="town" data-town>
{I}    <div class="town-view">
{I}        <picture class="town-cam"><source type="image/avif" srcset="{srcset('avif')}" sizes="{sizes}"><img class="town-img" src="assets/town/town-1920.webp" srcset="{srcset('webp')}" sizes="{sizes}" width="{TOWN_W}" height="{TOWN_H}" alt="{html.escape(TOWN_ALT)}" fetchpriority="high"></picture>
{I}        <div class="town-pins" aria-hidden="true">
{chr(10).join(pins)}
{I}        </div>
{I}    </div>
{I}    <div class="town-tabs">
{chr(10).join(tabs)}
{I}        <a class="town-tab town-tab--all" id="town-k-all" href="#work" data-panel="town-p-all" hidden>Whole town</a>
{I}    </div>
{I}    <div class="town-cards">
{I}        <p class="town-card town-card--all" id="town-p-all">In the whole town, {"; ".join(places)}.</p>
{chr(10).join(cards)}
{I}    </div>
{I}</div>
"""
    path.write_text(text[:start] + block + text[end:])
    print(f"index.html: town with {len(projects)} places")


def write_more(items: list) -> None:
    """Regenerate the compact "More projects" list between the MORE markers."""
    path = ROOT / "index.html"
    text = path.read_text()
    start = text.index("\n", text.index("<!-- MORE:START")) + 1
    end = text.index("                <!-- MORE:END -->")
    rows = []
    for m in items:
        name = html.escape(m["name"])
        if m.get("url"):
            name = (f'<a href="{html.escape(m["url"])}" target="_blank" rel="noopener noreferrer">{name} '
                    f'{ICON.format("arrow-right")}</a>')
        rows.append(f"""                    <li class="more-item">
                        <h4 class="more-name">{name}</h4>
                        <p class="more-line">{html.escape(m["line"])}</p>
                        <p class="more-meta">{html.escape(m["stack"])} <span class="more-status">{html.escape(m["status"])}</span></p>
                    </li>""")
    block = '                <ul class="more-projects">\n' + "\n".join(rows) + "\n                </ul>\n"
    path.write_text(text[:start] + block + text[end:])
    print(f"index.html: {len(items)} more projects")


def main() -> None:
    index = (ROOT / "index.html").read_text()
    version = re.search(r'css/styles\.css\?v=([\w-]+)', index).group(1)
    sprite = between(index, "    <!-- Icon sprite", "</svg>\n")
    sidebar = relink(between(index, '<header class="sidebar"', "</header>"))
    sidebar = sidebar.replace('href="../index.html#work" class="nav-link"',
                              'href="../index.html#work" class="nav-link active" aria-current="page"')
    footer = between(index, '<footer class="site-footer">', "</footer>")

    # hidden projects stay in the manifest unpublished; numbering follows order
    projects = [p for p in json.loads((CONTENT / "projects.json").read_text()) if not p.get("hidden")]
    for i, p in enumerate(projects):
        p["num"] = f"{i + 1:02d}"
    write_see(projects)
    write_cards(projects)
    write_town(projects)
    write_more(json.loads((CONTENT / "more.json").read_text()))
    index = (ROOT / "index.html").read_text()   # re-read: the shell below is lifted from it
    OUT.mkdir(exist_ok=True)
    for i, p in enumerate(projects):
        nxt = projects[(i + 1) % len(projects)]
        body = (CONTENT / f"{p['slug']}.html").read_text().rstrip()
        e = {k: html.escape(str(v), quote=True) for k, v in p.items() if not isinstance(v, (list, dict))}
        meta = "\n".join(
            f'                        <div><dt>{html.escape(k)}</dt><dd>{v}</dd></div>' for k, v in p["meta"].items())
        url = f"{SITE}/work/{p['slug']}.html"
        demo_js = (f'\n    <script src="../js/explainers.js?v={version}" defer></script>'
                   if "data-demo=" in body else "")
        # badge: "Public"/"Private" by default; a project can override it (e.g. "Live")
        open_ = p["public"] or "flag" in p
        flag = html.escape(p.get("flag", "Public" if p["public"] else "Private"))
        # link previews: the cover cropped to 1200x630 when there is one, else the site card
        og_image = (f"{SITE}/assets/og/{p['slug']}.jpg"
                    if (ROOT / "assets" / "og" / f"{p['slug']}.jpg").exists() else f"{SITE}/assets/og-town.jpg")
        # private repos: offer a walkthrough of the code
        walk_line = "" if p["public"] else " The code is private, and I'm happy to walk you through it."
        walk_link = ("" if p["public"] else
                     f'\n                    <a class="contact-alt" href="{mailto("Walkthrough: " + p["title"])}">'
                     f'Ask for a walkthrough of {e["title"]} {ICON.format("arrow-right")}</a>')
        page = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Generated by scripts/build-case-studies.py from content/work/ — edit there, not here. -->
    <title>{e['title']} — case study · Nikolas Neofytou</title>
    <meta name="description" content="{e['description']}">
    <meta name="author" content="Nikolas Neofytou">
    <meta name="theme-color" content="#F5F4EF">
    <link rel="canonical" href="{url}">
    <meta property="og:title" content="{e['title']} — case study · Nikolas Neofytou">
    <meta property="og:description" content="{e['description']}">
    <meta property="og:type" content="article">
    <meta property="og:url" content="{url}">
    <meta property="og:site_name" content="Nikolas Neofytou">
    <meta property="og:image" content="{og_image}">
    <meta property="og:image:alt" content="{e['alt']}">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" type="image/svg+xml" href="../assets/favicon.svg">
    <link rel="stylesheet" href="../css/styles.css?v={version}">
    <link rel="preload" href="../assets/fonts/instrument-serif.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="../assets/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="../assets/covers/{e['slug']}-1344.webp" as="image" fetchpriority="high">
</head>
<body class="cs-page">
{sprite}
    <a class="skip-link" href="#content">Skip to content</a>

    <div class="layout">
        {sidebar}

        <main class="main" id="top">
            <article class="cs" id="content">
                <a class="cs-crumb" href="../index.html#work"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-chevron-left"></use></svg> Selected work</a>

                <header class="cs-head">
                    <p class="cs-kicker"><span class="section-num">{e['num']}</span> Case study <span class="case-flag{' case-flag--open' if open_ else ''}"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-{'unlock' if open_ else 'lock'}"></use></svg> {flag}</span></p>
                    <h1 class="cs-title" style="view-transition-name: title-{e['slug']}">{e['title']}</h1>
                    <p class="cs-lede">{p['lede']}</p>
                    <dl class="cs-meta">
{meta}
                    </dl>
                </header>

                <figure class="cs-hero">
                    <img src="../assets/covers/{e['slug']}-1344.webp" width="1344" height="752" alt="{e['alt']}"
                         style="view-transition-name: cover-{e['slug']}" fetchpriority="high" decoding="async">
                </figure>

{body}
            </article>

            <aside class="cs-cta" aria-labelledby="cs-cta-h">
                <h2 class="cs-cta-h" id="cs-cta-h">Something like {e['title']} for your business or team?</h2>
                <p class="cs-cta-line">Tell me what it's for, who will use it and when you need it.{walk_line}</p>
                <div class="contact-ctas">
                    <a class="contact-cta" href="{ENQUIRY}">{ICON.format('envelope')} Email me about a project</a>{walk_link}
                    <button class="copy-btn" type="button" data-copy="{EMAIL}" hidden>Copy email address</button>
                </div>
            </aside>

            <nav class="cs-next" aria-label="Next case study">
                <a href="{nxt['slug']}.html" class="cs-next-link">
                    <span class="cs-next-label">Next case study <svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-right"></use></svg></span>
                    <span class="cs-next-title">{html.escape(nxt['title'])}</span>
                    <span class="cs-next-lede">{html.escape(nxt['tagline'])}</span>
                </a>
            </nav>

            {footer}
        </main>
    </div>

    <button class="back-to-top" id="backToTop" aria-label="Back to top"><svg class="icon" aria-hidden="true" focusable="false"><use href="#i-arrow-up"></use></svg></button>
    <script src="../js/script.js?v={version}"></script>{demo_js}
</body>
</html>
"""
        (OUT / f"{p['slug']}.html").write_text(page)
        print(f"work/{p['slug']}.html")


if __name__ == "__main__":
    main()
