#!/usr/bin/env bash
# Turn the Fig. 01 push-in clips (e.g. Higgsfield exports) into the frame
# sequence the scroll scrub expects:
#   assets/scrub/d/001.webp …  1280px, desktop
#   assets/scrub/m/001.webp …   640px, phones (<810px wide)
#   assets/scrub/poster.webp     last frame, used by the static fallback
#
#   scripts/encode-scrub.sh clip1.mp4 [clip2.mp4 …]
#
# Clips are joined in order; the first frame of each later clip is dropped
# because it repeats the previous clip's end frame. FRAMES (default 96)
# must match data-frames on #signal in index.html. Needs ffmpeg + cwebp.
set -euo pipefail

[ $# -ge 1 ] || { echo "usage: scripts/encode-scrub.sh <clip> [clip …]"; exit 1; }
frames="${FRAMES:-96}"
fit="scale=1280:720:force_original_aspect_ratio=increase:flags=lanczos,crop=1280:720,setsar=1"
out="$(cd "$(dirname "$0")/.." && pwd)/assets/scrub"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

inputs=() chain="" n=0
for clip in "$@"; do
    inputs+=(-i "$clip")
    if [ "$n" -eq 0 ]; then
        chain+="[$n:v]$fit,setpts=PTS-STARTPTS[v$n];"
    else
        chain+="[$n:v]trim=start_frame=1,$fit,setpts=PTS-STARTPTS[v$n];"
    fi
    n=$((n + 1))
done
labels=""; for i in $(seq 0 $((n - 1))); do labels+="[v$i]"; done
ffmpeg -loglevel error -y "${inputs[@]}" -filter_complex \
    "${chain}${labels}concat=n=$n:v=1:a=0,format=yuv420p[out]" \
    -map "[out]" -c:v libx264 -crf 12 -preset slow "$tmp/joined.mp4"

# dump every frame, then keep evenly spaced ones (first and last included)
mkdir -p "$tmp/all" "$tmp/pick"
ffmpeg -loglevel error -y -i "$tmp/joined.mp4" "$tmp/all/%04d.png"
total=$(ls "$tmp/all" | wc -l | tr -d ' ')
for k in $(seq 0 $((frames - 1))); do
    i=$(( (k * (total - 1) * 2 / (frames - 1) + 1) / 2 + 1 ))
    cp "$tmp/all/$(printf %04d "$i").png" "$tmp/pick/f$(printf %03d $((k + 1))).png"
done

rm -rf "$out/d" "$out/m"
mkdir -p "$out/d" "$out/m"
for png in "$tmp"/pick/f*.png; do
    name="$(basename "$png" .png | sed 's/^f//')"
    cwebp -quiet -q 52 -m 6 "$png" -o "$out/d/$name.webp"
    cwebp -quiet -q 45 -m 6 -resize 640 0 "$png" -o "$out/m/$name.webp"
done
last="$(ls "$tmp"/pick/f*.png | tail -1)"
cwebp -quiet -q 80 -m 6 "$last" -o "$out/poster.webp"

echo "$(ls "$out/d" | wc -l | tr -d ' ') frames from $total"
du -sh "$out/d" "$out/m" "$out/poster.webp"
