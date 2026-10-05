#!/usr/bin/env bash
# Encode a raw Bookshelf plate clip (a Higgsfield export started from the
# plate's painting) into assets/books/plates/<slug>-loop.{webm,mp4}.
#
#   scripts/encode-plate.sh path/to/export.mp4 <slug> [--flop] [--xfade SECONDS | --pingpong SECONDS] [--width PX]
#
#   --flop        mirror it, for plates whose still is mirrored (republic, theban)
#   --xfade N     make a free-running clip loop: play from N s to the end, then
#                 crossfade the last N s into the first N s
#   --pingpong N  loop the first N s forward then backward (for a clip that
#                 drifts somewhere unwanted after N s; suits swaying motion)
#   --width PX    output width (default 960; chapter close-ups use 1280)
#   --freeze "CX,CY,RX,RY"  hold a soft-edged ellipse (percent of the frame:
#                 centre and radii) at the clip's first frame, for a region
#                 the model kept changing (a crack spreading, a stray cloud)
#   Use neither --xfade nor --pingpong for clips generated with the painting
#   as both start and end frame (already seamless).
#
# Output is silent, 24fps. Aim for each video < 600 KB.
set -euo pipefail

usage="usage: scripts/encode-plate.sh <clip> <slug> [--flop] [--xfade SECONDS | --pingpong SECONDS] [--width PX] [--freeze CX,CY,RX,RY]"
src="${1:?$usage}"
slug="${2:?$usage}"
shift 2
flip=""
xfade=""
pingpong=""
width=960
freeze=""
while [ $# -gt 0 ]; do
    case "$1" in
        --flop) flip="hflip," ;;
        --xfade) xfade="${2:?$usage}"; shift ;;
        --pingpong) pingpong="${2:?$usage}"; shift ;;
        --width) width="${2:?$usage}"; shift ;;
        --freeze) freeze="${2:?$usage}"; shift ;;
        *) echo "$usage" >&2; exit 1 ;;
    esac
    shift
done
out="$(cd "$(dirname "$0")/.." && pwd)/assets/books/plates"
mkdir -p "$out"

if [ -n "$freeze" ]; then
    tmp="$(mktemp -d)"
    trap 'rm -rf "$tmp"' EXIT
    IFS=, read -r fcx fcy frx fry <<< "$freeze"
    IFS=x read -r fw fh <<< "$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0:s=x "$src")"
    ffmpeg -loglevel error -y -i "$src" -frames:v 1 "$tmp/first.png"
    magick -size "${fw}x${fh}" xc:black -fill white \
        -draw "ellipse $((fw * fcx / 100)),$((fh * fcy / 100)) $((fw * frx / 100)),$((fh * fry / 100)) 0,360" \
        -blur "0x$((fh / 45))" "$tmp/mask.png"
    ffmpeg -loglevel error -y -i "$src" -loop 1 -i "$tmp/first.png" -loop 1 -i "$tmp/mask.png" -filter_complex \
        "[2:v]format=gray[m];[1:v]format=rgba[f];[f][m]alphamerge[fz];[0:v][fz]overlay=shortest=1,format=yuv420p" \
        -an -c:v libx264 -crf 12 -preset slow "$tmp/frozen.mp4"
    src="$tmp/frozen.mp4"
fi

look="${flip}scale=${width}:-2:flags=lanczos,fps=24,format=yuv420p"
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
