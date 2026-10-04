#!/usr/bin/env bash
# Encode a raw Bookshelf plate clip (a Higgsfield export started from the
# plate's painting) into assets/books/plates/<slug>-loop.{webm,mp4}.
#
#   scripts/encode-plate.sh path/to/export.mp4 <slug> [--flop] [--xfade SECONDS | --pingpong SECONDS]
#
#   --flop        mirror it, for plates whose still is mirrored (republic, theban)
#   --xfade N     make a free-running clip loop: play from N s to the end, then
#                 crossfade the last N s into the first N s
#   --pingpong N  loop the first N s forward then backward (for a clip that
#                 drifts somewhere unwanted after N s; suits swaying motion)
#   Use neither for clips generated with the painting as both start and end
#   frame (already seamless).
#
# Output is 960px wide, silent, 24fps. Aim for each video < 600 KB.
set -euo pipefail

usage="usage: scripts/encode-plate.sh <clip> <slug> [--flop] [--xfade SECONDS | --pingpong SECONDS]"
src="${1:?$usage}"
slug="${2:?$usage}"
shift 2
flip=""
xfade=""
pingpong=""
while [ $# -gt 0 ]; do
    case "$1" in
        --flop) flip="hflip," ;;
        --xfade) xfade="${2:?$usage}"; shift ;;
        --pingpong) pingpong="${2:?$usage}"; shift ;;
        *) echo "$usage" >&2; exit 1 ;;
    esac
    shift
done
out="$(cd "$(dirname "$0")/.." && pwd)/assets/books/plates"
mkdir -p "$out"

look="${flip}scale=960:-2:flags=lanczos,fps=24,format=yuv420p"
if [ -n "$xfade" ]; then
    dur="$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$src")"
    tail_start="$(echo "$dur - $xfade - 0.05" | bc -l)"
    graph="[0:v]${look},split=3[a][b][c];
        [a]trim=0:${xfade},setpts=PTS-STARTPTS[head];
        [b]trim=${xfade}:${tail_start},setpts=PTS-STARTPTS[body];
        [c]trim=${tail_start},setpts=PTS-STARTPTS[tail];
        [tail][head]xfade=transition=fade:duration=${xfade}:offset=0[seam];
        [body][seam]concat=n=2:v=1[v]"
elif [ -n "$pingpong" ]; then
    frames="$(printf '%.0f' "$(echo "$pingpong * 24" | bc -l)")"
    graph="[0:v]trim=0:${pingpong},setpts=PTS-STARTPTS,${look},split[f][r];
        [r]reverse,trim=start_frame=1:end_frame=$((frames - 1)),setpts=PTS-STARTPTS[back];
        [f][back]concat=n=2:v=1[v]"
else
    graph="[0:v]${look}[v]"
fi

ffmpeg -loglevel error -y -i "$src" -an -filter_complex "$graph" -map "[v]" \
    -c:v libvpx-vp9 -b:v 0 -crf 40 -row-mt 1 -deadline good "$out/$slug-loop.webm"

ffmpeg -loglevel error -y -i "$src" -an -filter_complex "$graph" -map "[v]" \
    -c:v libx264 -preset slow -crf 28 -profile:v high -movflags +faststart "$out/$slug-loop.mp4"

ls -lh "$out/$slug-loop."*
