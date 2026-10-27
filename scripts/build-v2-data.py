#!/usr/bin/env python3
"""Cut Cinna's recorded hour down to what the /v2/ landing shows: assets/v2/cinna-hour.json.

Input is the stage data built from OpenStreetMap and the recorded national feed
(map.json and buses.json from build-stage-cinna.py, Mon 26 Oct 2026, 06:00–07:00).
The landing plays 105 seconds of it, from four minutes before the 400 reaches
Apolloneio Hospital, so this keeps:
  - the streets, river, parks, walls and routes inside the area the camera can see,
    simplified to about 4 m and rounded to whole metres;
  - every bus out in those 105 s, as positions every 3 s (no plates, vehicle or trip IDs:
    the input carries none);
  - the 400's own path from where it starts to the stop, so the lit stretch can shrink.

Usage: python3 scripts/build-v2-data.py <map.json> <buses.json>
"""
import bisect, json, math, sys
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'v2' / 'cinna-hour.json'
LEAD, PLAY, STEP = 240, 105, 3      # start 4 min before boarding; play 105 s; a position every 3 s
STOP_NAME = 'Apolloneio Hospital'
# what the camera can see, in metres, with where the 400 sits on screen (fractions):
# desktop frame 1 shows 16.3 x 10.2 km, phone frame 1 7.5 x 16.2 km
VIEWS = [(16300, 10200, 802 / 1440, 621 / 900), (7500, 16200, 150 / 390, 620 / 844)]
MARGIN = 1200

m = json.loads(Path(sys.argv[1]).read_text())
rep = json.loads(Path(sys.argv[2]).read_text())
FW, FH = m['frame']
story = rep['story']
T0 = story['board']['t'] - LEAD

shapes = []
for n in m['network']:
    p, cum = n['pts'], [0.0]
    for i in range(2, len(p), 2):
        cum.append(cum[-1] + math.hypot(p[i] - p[i - 2], p[i + 1] - p[i - 1]))
    shapes.append((p, cum))

def at(b, t):
    k = (t - b['t0']) / rep['step']
    if k < 0 or k > len(b['d']) - 1:
        return None
    i0 = int(k)
    d = b['d'][i0] + (b['d'][min(i0 + 1, len(b['d']) - 1)] - b['d'][i0]) * (k - i0)
    p, cum = shapes[b['s']]
    hi = min(max(bisect.bisect_right(cum, d), 1), len(cum) - 1)
    lo = hi - 1
    u = max(0.0, min(1.0, (d - cum[lo]) / ((cum[hi] - cum[lo]) or 1)))
    return (p[lo * 2] + (p[hi * 2] - p[lo * 2]) * u, p[lo * 2 + 1] + (p[hi * 2 + 1] - p[lo * 2 + 1]) * u, d)

hero = rep['buses'][story['bus']]
hx, hy, hd0 = at(hero, T0)
x0 = min(hx - w * fx for w, h, fx, fy in VIEWS) - MARGIN
x1 = max(hx + w * (1 - fx) for w, h, fx, fy in VIEWS) + MARGIN
y0 = min(hy - h * fy for w, h, fx, fy in VIEWS) - MARGIN
y1 = max(hy + h * (1 - fy) for w, h, fx, fy in VIEWS) + MARGIN
inside = lambda x, y: x0 <= x <= x1 and y0 <= y <= y1

def simplify(pts, tol=4.0):
    """Ramer–Douglas–Peucker on a flat [x, y, x, y, ...] list."""
    n = len(pts) // 2
    if n < 3:
        return pts
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay, bx, by = pts[2 * a], pts[2 * a + 1], pts[2 * b], pts[2 * b + 1]
        L = math.hypot(bx - ax, by - ay) or 1e-9
        far, fi = 0.0, -1
        for i in range(a + 1, b):
            dd = abs((bx - ax) * (ay - pts[2 * i + 1]) - (ax - pts[2 * i]) * (by - ay)) / L
            if dd > far:
                far, fi = dd, i
        if far > tol:
            keep[fi] = True
            stack += [(a, fi), (fi, b)]
    return [v for i in range(n) if keep[i] for v in (pts[2 * i], pts[2 * i + 1])]

def clip(pts, closed=False):
    """The runs of a line that fall inside the view, each with one point beyond the edge."""
    n = len(pts) // 2
    ins = [inside(pts[2 * i], pts[2 * i + 1]) for i in range(n)]
    if closed:
        return [pts] if any(ins) else []
    runs, cur = [], []
    for i in range(n):
        near = ins[i] or (i > 0 and ins[i - 1]) or (i < n - 1 and ins[i + 1])
        if near:
            cur += [pts[2 * i], pts[2 * i + 1]]
        elif cur:
            runs.append(cur); cur = []
    if cur:
        runs.append(cur)
    return [r for r in runs if len(r) >= 4]

def simplify_ring(pts):
    """A closed ring starts and ends on the same point, which RDP would collapse: split it at the
    point farthest from the start and simplify the two halves."""
    n = len(pts) // 2
    j = max(range(n), key=lambda i: (pts[2 * i] - pts[0]) ** 2 + (pts[2 * i + 1] - pts[1]) ** 2)
    a, b = simplify(pts[:2 * j + 2]), simplify(pts[2 * j:])
    return a + b[2:]

def lines(list_, closed=False):
    out = []
    for p in list_:
        for r in clip(p, closed):
            r = simplify_ring(r) if closed else simplify(r)
            out.append([round(v) for v in r])
    return out

L = m['layers']
layers = {k: lines(L[k], closed=k in ('parks', 'walls')) for k in ('parks', 'walls', 'river', 'trunk', 'primary', 'secondary')}
routes = lines([n['pts'] for n in m['network'] if n['route'] != story['route']])
hero_route = lines([n['pts'] for n in m['network'] if n['route'] == story['route']])

# buses: a position every STEP seconds over the play; null where the bus isn't out
n_steps = PLAY // STEP + 1
buses = []
for i, b in enumerate(rep['buses']):
    if i == story['bus']:
        continue
    track = []
    for k in range(n_steps):
        q = at(b, T0 + k * STEP)
        track += [round(q[0]), round(q[1])] if q else [None, None]
    if any(v is not None for v in track):
        buses.append(track)

# the 400: its position and distance at each step, and its path from where it starts to the stop
hp, hcum = shapes[hero['s']]
stop = (story['board']['at'][0] - FW / 2, story['board']['at'][1] - FH / 2)
iv = min((i for i in range(len(hcum)) if hcum[i] > hd0),
         key=lambda i: (hp[2 * i] - stop[0]) ** 2 + (hp[2 * i + 1] - stop[1]) ** 2)
hero_track, hero_d = [], []
for k in range(n_steps):
    x, y, d = at(hero, T0 + k * STEP)
    hero_track += [round(x), round(y)]
    hero_d.append(round(d))
path = [v for i in range(len(hcum)) if hd0 < hcum[i] <= hcum[iv] for v in (round(hp[2 * i]), round(hp[2 * i + 1]), round(hcum[i]))]

out = {
    'about': 'Cinna, recorded Mon 26 Oct 2026 from the national feed; streets © OpenStreetMap contributors. Built by scripts/build-v2-data.py.',
    'date': 'Mon 26 Oct', 't0': T0, 'step': STEP, 'board': story['board']['t'],
    'route': story['route'], 'stop': {'name': STOP_NAME, 'at': [round(stop[0]), round(stop[1])]},
    'layers': layers, 'routes': routes, 'heroRoute': hero_route,
    'buses': buses, 'hero': {'track': hero_track, 'd': hero_d, 'path': path},
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(out, separators=(',', ':')))
print(f'{OUT.relative_to(OUT.parent.parent.parent)}: {OUT.stat().st_size // 1024} KB, '
      f'{sum(len(v) for v in layers.values())} street lines, {len(routes)} route runs, {len(buses)} buses, '
      f'view {round((x1 - x0) / 1000, 1)} x {round((y1 - y0) / 1000, 1)} km')
