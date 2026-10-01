#!/usr/bin/env python3
"""Snapshot the latest Substack posts into assets/substack.json.

The Writing section reads this same-origin file instead of calling a
third-party RSS-to-JSON proxy at runtime. Run by
.github/workflows/substack-feed.yml on a schedule; safe to run locally.

Only rewrites the file when the posts themselves change, so scheduled runs
don't produce empty commits. Stdlib only.
"""
import email.utils
import html
import json
import pathlib
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

FEED = "https://nikolasneofytou.substack.com/feed"
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "substack.json"
LIMIT = 5
EXCERPT = 140


def excerpt(markup: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", markup or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= EXCERPT else text[:EXCERPT].rstrip() + "…"


def main() -> int:
    try:
        req = urllib.request.Request(FEED, headers={"User-Agent": "personal-website feed snapshot"})
        with urllib.request.urlopen(req, timeout=30) as res:
            root = ET.fromstring(res.read())
    except Exception as exc:  # keep the last good snapshot
        print(f"::warning::could not fetch {FEED}: {exc}")
        return 0

    posts = []
    for item in root.findall("./channel/item")[:LIMIT]:
        published = email.utils.parsedate_to_datetime(item.findtext("pubDate", ""))
        posts.append({
            "title": html.unescape(item.findtext("title", "")).strip(),
            "link": item.findtext("link", "").strip(),
            "date": published.date().isoformat(),
            "excerpt": excerpt(item.findtext("description", "")),
        })
    if not posts:
        print("::warning::feed had no posts; keeping the last snapshot")
        return 0

    old = json.loads(OUT.read_text()) if OUT.exists() else {}
    if old.get("posts") == posts:
        print("feed unchanged")
        return 0

    OUT.write_text(json.dumps({"source": FEED, "posts": posts}, ensure_ascii=False, indent=2) + "\n")
    print(f"wrote {len(posts)} posts to {OUT.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
