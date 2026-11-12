#!/usr/bin/env python3
"""Build the case-study pages: work/<slug>.html.

Each page = the shared shell (head, icon sprite, sidebar, footer — taken
from index.html so there is one source of truth) + an article from
content/work/<slug>.html, described by content/work/projects.json. It also
regenerates the work on the homepage (the six app icons, their bar and the
App Store-style cards, between the APPS, APPBAR and APPCARDS markers) from the
same file, so a project's facts live in one place.

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


def write_apps(projects: list) -> None:
    """Regenerate the work, icons first, from each project's `app` block: the six
    app icons on the first screen (APPS markers), the same six in the bar that
    follows you through the cards (APPBAR), and an App Store-style card for each
    project that has screens (APPCARDS): icon and one line, a strip of true
    numbers, the real screens with a caption each. A card's first screen can
    carry its recorded loop; js/script.js plays it only while it is on screen,
    never under reduced motion or Save-Data, and without JS the still stands.
    An icon without a card links to the project's case study."""
    path = ROOT / "index.html"
    text = path.read_text()

    def put(text: str, name: str, indent: str, block: str) -> str:
        a = text.index("\n", text.index(f"<!-- {name}:START")) + 1
        b = text.index(f"{indent}<!-- {name}:END -->")
        return text[:a] + block + text[b:]

    def href(p: dict) -> str:
        return f"#app-{p['slug']}" if p["app"].get("shots") else f"work/{p['slug']}.html"

    def name(p: dict) -> str:
        return html.escape(p["app"].get("name", p["title"]))

    def state(p: dict) -> str:
        return " ap-st--bench" if p["app"]["state"] == "bench" else ""

    I = " " * 12
    icons = []
    for p in projects:
        a = p["app"]
        icons.append(f"""{I}<li class="ap-app"><a href="{href(p)}">
{I}    <img class="ap-icon" src="{a['icon']}" width="288" height="288" alt="" decoding="async">
{I}    <span class="ap-app-name">{name(p)}</span>
{I}    <span class="ap-app-kind">{html.escape(a['kind'])}</span>
{I}    <span class="ap-st{state(p)}">{html.escape(a['status'])}</span>
{I}</a></li>""")
    text = put(text, "APPS", "        ", f'{I[:-4]}<ul class="ap-icons">\n' + "\n".join(icons) + f"\n{I[:-4]}</ul>\n")

    J = " " * 12
    chips = "\n".join(
        f'{J}<a class="ap-chip" href="{href(p)}"><img src="{p["app"]["icon"]}" width="288" height="288" alt="" '
        f'loading="lazy" decoding="async">{name(p)}</a>' for p in projects)
    text = put(text, "APPBAR", "        ", chips + "\n")

    K = " " * 8
    cards = []
    total = len(projects)
    for i, p in enumerate(projects):
        a = p["app"]
        if not a.get("shots"):
            continue
        s = p["slug"]
        facts = "\n".join(
            f'{K}        <li><span class="ap-fact-k">{html.escape(k)}</span><b>{html.escape(v)}</b>'
            f'<span class="ap-fact-v">{html.escape(t)}</span></li>' for k, v, t in a["facts"])
        shots = []
        for sh in a["shots"]:
            w, h = 600, 1305
            loop = ""
            if sh.get("loop"):
                loop = (f'\n{K}                <video class="ap-loop" muted loop playsinline preload="none" '
                        f'data-webm="{sh["loop"]}.webm" data-mp4="{sh["loop"]}.mp4" aria-hidden="true" tabindex="-1"></video>')
            rec = f'\n{K}            <span class="ap-rec">{html.escape(sh["rec"])}</span>' if sh.get("rec") else ""
            shots.append(f"""{K}        <figure class="ap-shot">
{K}            <div class="ap-screen">
{K}                <img src="{sh['src']}" width="{w}" height="{h}" alt="{html.escape(sh['alt'], quote=True)}" loading="lazy" decoding="async">{loop}
{K}            </div>{rec}
{K}            <figcaption><b>{html.escape(sh['b'])}</b> {html.escape(sh['t'])}</figcaption>
{K}        </figure>""")
        how = f'href="work/{s}.html"'
        cards.append(f"""{K}<!-- {html.escape(p['title'])} -->
{K}<article class="ap-card" id="app-{s}" aria-labelledby="app-{s}-h">
{K}    <div class="ap-head">
{K}        <img class="ap-icon" src="{a['icon']}" width="288" height="288" alt="" loading="lazy" decoding="async">
{K}        <div class="ap-title">
{K}            <p class="ap-k">{i + 1} of {total} · {html.escape(a['kind'])}</p>
{K}            <h2 class="ap-h" id="app-{s}-h">{name(p)}</h2>
{K}            <p class="ap-line">{html.escape(a['line'])}</p>
{K}        </div>
{K}        <a class="ap-how" {how}>How it&#x27;s built</a>
{K}    </div>
{K}    <ul class="ap-facts" aria-label="{name(p)} in numbers">
{facts}
{K}    </ul>
{K}    <div class="ap-shots">
{chr(10).join(shots)}
{K}    </div>
{K}    <a class="ap-how ap-how--foot" {how}>How it&#x27;s built</a>
{K}</article>""")
    text = put(text, "APPCARDS", "        ", "\n".join(cards) + "\n")
    path.write_text(text)
    print(f"index.html: {len(projects)} icons, {len(cards)} cards")


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
                        <h3 class="more-name">{name}</h3>
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
    write_apps(projects)
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
