#!/usr/bin/env python3
"""Build the case-study pages: work/<slug>.html.

Each page = the shared shell (head, icon sprite, sidebar, footer — taken
from index.html so there is one source of truth) + an article from
content/work/<slug>.html, described by content/work/projects.json. It also
regenerates the Selected Work cards in index.html (between the CASES markers)
from the same file, so a project's facts live in one place.

    python3 scripts/build-case-studies.py

Re-run after editing index.html's sidebar/footer or anything under
content/work/, then commit the generated work/*.html. Stdlib only.
"""
import html
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "work"
OUT = ROOT / "work"
SITE = "https://nikolasneofytou.github.io/personal-website"


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
    cards = "".join(render_card(p, i + 1, len(projects)) for i, p in enumerate(projects))
    text = text[:start] + cards + text[end:]
    text = re.sub(r'(<span id="caseTotal">)\d+(</span>)', rf"\g<1>{len(projects):02d}\g<2>", text)
    path.write_text(text)
    print(f"index.html: {len(projects)} cards")


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
    write_cards(projects)
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
    <meta property="og:image" content="{SITE}/assets/og-image.jpg">
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
