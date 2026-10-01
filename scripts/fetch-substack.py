#!/usr/bin/env python3
"""Snapshot the latest Substack posts into assets/substack.json.

The Writing section reads this same-origin file instead of calling a
third-party RSS-to-JSON proxy at runtime. Run it after publishing a post,
then commit the JSON:

    python3 scripts/fetch-substack.py

It can't run from GitHub Actions: Substack's CDN answers 403 to GitHub's
runner IPs (tested 2026-10-01), and api.rss2json.com is blocked the same
way. Only rewrites the file when the posts change. Stdlib only.
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
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36",
    "Accept": "application/rss+xml, application/xml;q=0.9, */*;q=0.8",
}
OUT = pathlib.Path(__file__).resolve().parent.parent / "assets" / "substack.json"
LIMIT = 5
EXCERPT = 140


def excerpt(markup: str) -> str:
    text = html.unescape(re.sub(r"<[^>]+>", " ", markup or ""))
    text = re.sub(r"\s+", " ", text).strip()
    return text if len(text) <= EXCERPT else text[:EXCERPT].rstrip() + "…"


def get(url: str) -> bytes:
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=30) as res:
        return res.read()


def from_feed() -> list:
    root = ET.fromstring(get(FEED))
    posts = []
    for item in root.findall("./channel/item")[:LIMIT]:
        published = email.utils.parsedate_to_datetime(item.findtext("pubDate", ""))
        posts.append({
            "title": html.unescape(item.findtext("title", "")).strip(),
            "link": item.findtext("link", "").strip(),
            "date": published.date().isoformat(),
            "excerpt": excerpt(item.findtext("description", "")),
        })
    return posts


def main() -> int:
    try:
        posts = from_feed()
    except Exception as exc:  # keep the last good snapshot
        print(f"::warning::could not fetch {FEED}: {exc}")
        return 0

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
