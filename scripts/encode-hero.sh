#!/usr/bin/env bash
# Encode a raw hero clip (e.g. a Higgsfield export) into the web assets
# the Fig. 00 hero loop expects: assets/hero/hero-loop.{webm,mp4} + poster.
#
#   scripts/encode-hero.sh path/to/export.mp4 [start_seconds] [duration_seconds]
#
# Output is 1280px wide, silent, ~24fps. Aim for each video < 1.5 MB.
set -euo pipefail

src="${1:?usage: scripts/encode-hero.sh <clip> [start] [duration]}"
start="${2:-0}"
dur="${3:-6}"
out="$(cd "$(dirname "$0")/.." && pwd)/assets/hero"
mkdir -p "$out"

vf="scale=1280:-2:flags=lanczos,fps=24,format=yuv420p"

ffmpeg -loglevel error -y -ss "$start" -t "$dur" -i "$src" -an -vf "$vf" \
    -c:v libvpx-vp9 -b:v 0 -crf 38 -row-mt 1 -deadline good "$out/hero-loop.webm"

ffmpeg -loglevel error -y -ss "$start" -t "$dur" -i "$src" -an -vf "$vf" \
    -c:v libx264 -preset slow -crf 28 -profile:v high -movflags +faststart "$out/hero-loop.mp4"

ffmpeg -loglevel error -y -i "$out/hero-loop.mp4" -frames:v 1 -q:v 3 "$out/hero-loop-poster.jpg"

ls -lh "$out"
