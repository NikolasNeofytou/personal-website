// /v2/ — the scroll story. Runs only when the head script set html.mode-run (JS, motion allowed, no Save-Data).
// Five beats over the pinned section: 1 the first screen holds · 2 the camera closes in on the 400 ·
// 3 Cinna's field opens from the bus · 4 it fills the screen · 5 Cinna's frame, the real app looping.
// The data is Cinna's recorded hour (Mon 26 Oct, from 06:08), cut by scripts/build-v2-data.py.
(function () {
    const root = document.documentElement;
    if (!root.classList.contains('mode-run')) return;

    const $ = (id) => document.getElementById(id);
    const NS = 'http://www.w3.org/2000/svg';
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const ss = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
    const mix = (a, b, t) => a + (b - a) * t;
    const stills = () => { root.classList.remove('mode-run'); root.classList.add('mode-stills'); };

    let D = null;
    fetch('../assets/v2/cinna-hour.json')
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d) => { D = d; (window.requestIdleCallback || setTimeout)(build, { timeout: 600 }); })
        .catch(stills);

    // ---- drawing, once ----
    const PAPER = { park: '#E9E5D8', river: '#A9BCCD', rw: 1.8, road: '#1A1A17', o: [.42, .24, .12], route: '#1F3BFF', ro: .26, hero: '#1F3BFF', ho: .9 };
    const FIELD = { park: '#134A50', river: '#22838A', rw: 2.4, road: '#EEF7F6', o: [.34, .2, .1], route: '#35A5AB', ro: .5, hero: '#A6DBDE', ho: .38 };
    const pd = (lines, close) => lines.map((l) => {
        let s = 'M' + l[0] + ' ' + l[1];
        for (let i = 2; i < l.length; i += 2) s += 'L' + l[i] + ' ' + l[i + 1];
        return close ? s + 'Z' : s;
    }).join('');
    const el = (parent, tag, attrs) => {
        const e = document.createElementNS(NS, tag);
        for (const k in attrs) e.setAttribute(k, attrs[k]);
        parent.appendChild(e);
        return e;
    };
    const line = (g, d, attrs) => el(g, 'path', Object.assign({ d, fill: 'none', 'vector-effect': 'non-scaling-stroke', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, attrs));
    function world(g, k) {
        const L = D.layers;
        el(g, 'path', { d: pd(L.parks, true), fill: k.park });
        line(g, pd(L.river), { stroke: k.river, 'stroke-width': k.rw });
        [['secondary', k.o[2], .8], ['primary', k.o[1], 1.2], ['trunk', k.o[0], 2]].forEach(([n, o, w]) => line(g, pd(L[n]), { stroke: k.road, 'stroke-opacity': o, 'stroke-width': w }));
        el(g, 'path', { d: pd(L.walls, true), fill: k.road, 'fill-opacity': .05, stroke: k.road, 'stroke-opacity': .7, 'stroke-width': 1.4, 'vector-effect': 'non-scaling-stroke' });
        line(g, pd(D.routes), { stroke: k.route, 'stroke-opacity': k.ro, 'stroke-width': 1.3 });
        line(g, pd(D.heroRoute), { stroke: k.hero, 'stroke-opacity': k.ho, 'stroke-width': 3.2 });
    }

    let dots, stopP, stopF, heroP, heroF, heroT, ahead, path;
    function build() {
        world($('paperW'), PAPER);
        world($('fieldW'), FIELD);
        ahead = [line($('fieldW'), 'M0 0', { stroke: '#0A2B2F', 'stroke-width': 9 }), line($('fieldW'), 'M0 0', { stroke: '#A6DBDE', 'stroke-width': 4.5 })];
        dots = D.buses.map(() => [el($('paperM'), 'circle', { r: 3.6, fill: '#1F3BFF' }), el($('fieldM'), 'circle', { r: 5, fill: '#EEF7F6', stroke: '#22838A', 'stroke-width': 2 })]);
        stopP = el($('paperM'), 'circle', { r: 7, fill: '#F5F4EF', stroke: '#1A1A17', 'stroke-width': 2.5 });
        stopF = [el($('fieldM'), 'circle', { r: 11, fill: '#EEF7F6', stroke: '#0F3B40', 'stroke-width': 3 }), el($('fieldM'), 'circle', { r: 4, fill: '#0F3B40' })];
        heroP = [el($('paperM'), 'circle', { r: 16, fill: '#1F3BFF', 'fill-opacity': .16 }), el($('paperM'), 'circle', { r: 8, fill: '#1F3BFF', stroke: '#F5F4EF', 'stroke-width': 3 })];
        heroF = [el($('fieldM'), 'circle', { r: 34, fill: '#A6DBDE', 'fill-opacity': .14 }), el($('fieldM'), 'circle', { r: 21, fill: '#FFFFFF', stroke: '#22838A', 'stroke-width': 3 })];
        heroT = el($('fieldM'), 'text', { 'text-anchor': 'middle', 'font-family': 'Inter, sans-serif', 'font-weight': 650, 'font-size': 13, fill: '#0F3B40' });
        heroT.textContent = D.route;
        path = D.hero.path;
        root.classList.add('ready');
        update();
    }

    // where a track is at time T (positions every D.step seconds; null while the bus isn't out)
    function at(track, T) {
        const k = (T - D.t0) / D.step, n = track.length / 2;
        const i0 = clamp(Math.floor(k), 0, n - 1), i1 = Math.min(i0 + 1, n - 1), u = clamp(k - i0);
        const x0 = track[2 * i0], x1 = track[2 * i1];
        if (x0 == null || x1 == null) return null;
        return [mix(x0, x1, u), mix(track[2 * i0 + 1], track[2 * i1 + 1], u)];
    }

    // ---- the loop in Cinna's frame: armed near frame 3, played only while it shows ----
    const loop = $('loop');
    let armed = false;
    function arm() {
        if (armed) return;
        armed = true;
        [['../assets/work/cinna/loop.webm', 'video/webm'], ['../assets/work/cinna/loop.mp4', 'video/mp4']].forEach(([src, type]) => {
            const s = document.createElement('source'); s.src = src; s.type = type; loop.appendChild(s);
        });
        loop.addEventListener('playing', () => loop.classList.add('is-playing'), { once: true });
        loop.load();
    }

    const show = (e, o) => { e.style.opacity = o; e.style.visibility = o < .02 ? 'hidden' : 'visible'; };
    const hms = (t) => [Math.floor(t / 3600), Math.floor(t % 3600 / 60), t % 60].map((v) => String(v).padStart(2, '0')).join(':');

    function update() {
        const W = innerWidth, H = innerHeight, run = $('run'), span = run.offsetHeight - H;
        if (!W || !H || span <= 0) return;
        const p = clamp(-run.getBoundingClientRect().top / span);
        const phone = W <= 600;

        // the camera: frame 1's wide view, then frame 2's, then a little closer
        const C = phone
            ? { s1: Math.max(W / 7500, H / 16200), z: 2.115, b1: [W * .385, H * .735], b2: [W * .385, H * .664], r2: W * .64, cap: [74, 74], k: 60 / 62 }
            : { s1: Math.max(W / 16300, H / 10200), z: 2.265, b1: [W * .557, H * .69], b2: [W * .667, H * .622], r2: Math.min(H * .456, W * .285), cap: [H * .262, H * .222], k: 96 / 124 };
        const k2 = ss(.1, .34, p), k4 = ss(.56, .8, p);

        // words that don't need the data
        const out1 = ss(.1, .24, p);
        $('f1').style.opacity = 1 - out1; $('f1').style.transform = `translateY(${-40 * out1}px)`;
        show($('six'), 1 - ss(.08, .16, p));
        const inC = ss(.22, .34, p), grow = ss(.62, .82, p);
        for (const c of document.querySelectorAll('.cin')) {
            c.style.opacity = inC;
            c.style.top = mix(C.cap[0], C.cap[1], grow) + 'px';
            c.style.transform = `translateY(${(1 - inC) * 30}px) scale(${mix(C.k, 1, grow)})`;
        }
        for (const e of document.querySelectorAll('.tf')) e.style.opacity = ss(.84, .92, p);
        const f3 = ss(.78, .92, p);
        $('arches').style.opacity = f3;
        $('device').style.transform = `translateY(${(1 - ss(.8, .95, p)) * 110}%)`;
        show($('rec'), ss(.88, .96, p));
        show($('more'), ss(.88, .96, p));
        if (p > .5 && !$('devstill').src) $('devstill').src = $('devstill').dataset.src;   // the poster, only once frame 3 is near
        if (p > .6) arm();
        if (armed) { if (p > .72 && loop.paused) loop.play().catch(() => {}); else if (p < .66 && !loop.paused) loop.pause(); }
        if (!D || !dots) return;

        // the clock runs 90 s of the recorded hour across the scroll, so the 400 creeps toward its stop
        const T = D.t0 + 90 * ss(.08, .78, p);
        const [hx, hy] = at(D.hero.track, T);
        const S = Math.exp(mix(Math.log(C.s1), Math.log(C.s1 * C.z), k2)) * mix(1, 1.25, k4);
        const bx = mix(C.b1[0], C.b2[0], k2), by = mix(C.b1[1], C.b2[1], k2);
        const tx = bx - S * hx, ty = by - S * hy, P = (x, y) => [tx + S * x, ty + S * y];
        const tf = `translate(${tx.toFixed(1)} ${ty.toFixed(1)}) scale(${S.toFixed(5)})`;
        $('paperW').setAttribute('transform', tf);
        $('fieldW').setAttribute('transform', tf);

        // Cinna's field: a circle from the bus, opening in beat 3 and filling the screen in beat 4
        const far = Math.max(Math.hypot(bx, by), Math.hypot(W - bx, by), Math.hypot(bx, H - by), Math.hypot(W - bx, H - by)) + 40;
        const r = ss(.32, .5, p) * C.r2 + k4 * (far - C.r2);
        for (const [a, v] of [['cx', bx], ['cy', by], ['r', r]]) $('clipc').setAttribute(a, v);
        const ring = $('ring');
        ring.setAttribute('cx', bx); ring.setAttribute('cy', by); ring.setAttribute('r', r + 18); ring.setAttribute('opacity', r > 4 && r < far * .9 ? 1 : 0);
        $('fade1').style.fill = phone ? 'url(#fp1)' : 'url(#fd1)'; $('fade1').setAttribute('opacity', 1 - k2);
        $('fade2').style.fill = phone ? 'url(#fp2)' : 'url(#fd2)'; $('fade2').setAttribute('opacity', k2);
        $('LB').style.clipPath = `circle(${r.toFixed(1)}px at ${bx.toFixed(1)}px ${by.toFixed(1)}px)`;
        const outside = `radial-gradient(circle at ${bx.toFixed(1)}px ${by.toFixed(1)}px, transparent ${r.toFixed(1)}px, #000 ${(r + .6).toFixed(1)}px)`;
        $('LA').style.webkitMaskImage = outside; $('LA').style.maskImage = outside;
        const navY = phone ? 30 : 44;   // the name and the links change colour each when the field reaches them
        $('nav').classList.toggle('name-on-field', Math.hypot((phone ? 70 : 130) - bx, navY - by) < r);
        $('nav').classList.toggle('links-on-field', Math.hypot(W - (phone ? 90 : 150) - bx, navY - by) < r);

        // the buses, the stop, the 400 and the stretch it has left to the stop
        D.buses.forEach((track, i) => {
            const q = at(track, T);
            for (const e of dots[i]) {
                if (!q) { e.setAttribute('opacity', 0); continue; }
                const [x, y] = P(q[0], q[1]);
                e.setAttribute('cx', x.toFixed(1)); e.setAttribute('cy', y.toFixed(1)); e.setAttribute('opacity', 1);
            }
        });
        const [sx, sy] = P(D.stop.at[0], D.stop.at[1]);
        for (const e of [stopP, ...stopF]) { e.setAttribute('cx', sx); e.setAttribute('cy', sy); }
        for (const e of [...heroP, ...heroF]) { e.setAttribute('cx', bx); e.setAttribute('cy', by); }
        heroT.setAttribute('x', bx); heroT.setAttribute('y', by + 4.6);
        const k = (T - D.t0) / D.step, i0 = Math.floor(k), hd = mix(D.hero.d[i0], D.hero.d[Math.min(i0 + 1, D.hero.d.length - 1)], k - i0);
        let d = 'M' + hx.toFixed(0) + ' ' + hy.toFixed(0);
        for (let i = 0; i < path.length; i += 3) if (path[i + 2] > hd) d += 'L' + path[i] + ' ' + path[i + 1];
        for (const a of ahead) a.setAttribute('d', d);
        fieldOpacity(f3, p);

        // labels that ride on the map
        const mins = Math.max(1, Math.ceil((D.board - T) / 60));   // from the recorded boarding time
        $('cardtxt').textContent = `Apolloneio Hospital in ${mins} min`;
        $('etatxt').textContent = `${mins} min`;
        const card = $('card');
        card.style.opacity = 1 - ss(.24, .32, p);
        card.style.transform = phone ? `translate(${W * .05}px, ${by + 26}px)` : `translate(${bx + 26}px, ${by - 22}px)`;
        const ys = $('ys');
        ys.style.opacity = 1 - ss(.16, .26, p); ys.style.transform = `translate(${sx + 14}px, ${sy + 6}px)`;
        const tag = ss(.42, .5, p) * (1 - ss(.7, .78, p)), eta = $('eta'), sn = $('sn');
        const wl = Math.max(sn.offsetWidth, eta.offsetWidth), toRight = sx - 16 - wl < 8;
        for (const e of [eta, sn]) { e.style.opacity = tag; e.style.left = (toRight ? sx + 16 : sx - 16 - e.offsetWidth) + 'px'; }
        eta.style.top = (sy - (phone ? 42 : 36)) + 'px'; sn.style.top = (sy + 6) + 'px';
        const t = Math.round(T);
        for (const c of document.querySelectorAll('.credit')) {
            c.style.opacity = 1 - f3;
            c.textContent = `recorded ${hms(t)} · ${D.date} · © OpenStreetMap` + (phone ? '' : ' contributors');
        }
    }
    function fieldOpacity(f3, p) {
        $('fieldW').style.opacity = 1 - f3;
        $('fieldM').style.opacity = 1 - ss(.72, .84, p);
    }

    let queued = false;
    const tick = () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; update(); }); } };
    addEventListener('scroll', tick, { passive: true });
    addEventListener('resize', tick);
    if ('IntersectionObserver' in window) {
        new IntersectionObserver(([e]) => { if (!e.isIntersecting && !loop.paused) loop.pause(); }).observe($('run'));
    }
    window.__frame = update;   // scripts/dev-capture.py renders a frame on request
    update();
})();
