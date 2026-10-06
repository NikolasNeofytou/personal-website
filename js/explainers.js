/**
 * Case-study explainers — one small live demo per project, mounted on any
 * element with [data-demo]. Loaded only by work/*.html (see
 * scripts/build-case-studies.py). Each demo ships static fallback markup in
 * the page, which is replaced here.
 */
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const h = (tag, attrs = {}, ...kids) => {
        const n = document.createElement(tag);
        for (const [k, v] of Object.entries(attrs)) {
            if (k === 'class') n.className = v;
            else if (k === 'text') n.textContent = v;
            else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
            else n.setAttribute(k, v);
        }
        kids.flat().forEach(c => c != null && n.append(c));
        return n;
    };
    const svg = (tag, attrs = {}) => {
        const n = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
        return n;
    };
    // run `tick` only while the element is on screen and the tab is visible
    function whileVisible(el, start, stop) {
        let onScreen = false;
        const sync = () => (onScreen && !document.hidden ? start() : stop());
        new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0.2 }).observe(el);
        document.addEventListener('visibilitychange', sync);
    }

    // ======================================================================
    // Plutarch — the search-key pipeline, step by step
    // Same rules as the app's normalise() / normalise_el(): decompose, strip
    // combining marks (U+0300–036F), recompose, lowercase, fold final sigma,
    // drop apostrophes. Accents go before lowercasing — on purpose.
    // ======================================================================
    const STEPS = [
        ['Input', s => s],
        ['NFD · decompose', s => s.normalize('NFD')],
        ['Strip combining marks', s => s.replace(/[\u0300-\u036f]/g, '')],
        ['NFC · recompose', s => s.normalize('NFC')],
        ['Lowercase', s => s.toLowerCase()],
        ['Fold final sigma', s => s.replace(/ς/g, 'σ')],
        ['Drop apostrophes', s => s.replace(/['’ʼ]/g, '')],
    ];
    const keyOf = s => STEPS.reduce((acc, [, f]) => f(acc), s.trim());
    // a tiny slice of the dictionary: lemma → a few of its inflected forms
    // (the real index holds hundreds of thousands of forms, capped per entry; each leads back to its entry)
    const SAMPLE = {
        'ύπνος': ['ύπνου', 'ύπνοι'], 'άνθρωπος': ['ανθρώπου', 'ανθρώπων', 'άνθρωποι'], 'ανθρώπινος': [],
        'καλημέρα': [], 'θάλασσα': ['θάλασσας', 'θάλασσες', 'θαλασσών'], 'θαλασσινός': [],
        'λέξη': ['λέξεις', 'λέξεων'], 'λεξικό': ['λεξικά'], 'ρίζα': ['ρίζες', 'ριζών'], 'ριζικός': [],
        'ψυχή': ['ψυχές'], 'ψυχολογία': [],
    };
    const hex = c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
    const isMark = c => /[\u0300-\u036f]/.test(c);
    // combining marks can't stand alone; show their spacing look-alikes
    const SPACING = { '\u0301': '´', '\u0300': '`', '\u0313': '᾿', '\u0314': '῾', '\u0308': '¨', '\u0342': '῀', '\u0345': 'ͺ', '\u0304': '¯' };
    const shown = c => (isMark(c) ? SPACING[c] || '◌' + c : c);

    function normaliseDemo(root) {
        const input = h('input', { class: 'demo-input', type: 'text', value: 'Ἄνθρωπος', spellcheck: 'false',
            autocomplete: 'off', 'aria-label': 'Greek word to normalise', lang: 'el' });
        const presets = h('div', { class: 'demo-presets' },
            ['Ἄνθρωπος', 'Ύπνος', 'ΚΑΛΗΜΈΡΑ', 'θάλασσας', 'ρίζ’'].map(w =>
                h('button', { type: 'button', class: 'demo-chip', lang: 'el', text: w,
                    onclick: () => { input.value = w; render(); input.focus(); } })));
        const rows = h('ol', { class: 'demo-steps' });
        const result = h('p', { class: 'demo-result', 'aria-live': 'polite' });

        function render() {
            const raw = input.value.slice(0, 40);
            rows.replaceChildren();
            let s = raw.trim(), prev = null;
            STEPS.forEach(([label, f], i) => {
                s = f(s);
                const changed = prev !== null && s !== prev;
                const chips = [...s].map(c => h('span', { class: 'demo-cp' + (isMark(c) ? ' is-mark' : ''),
                    title: isMark(c) ? 'combining mark — will be stripped' : '' }, h('b', { lang: 'el', text: shown(c) }), h('i', { text: hex(c) })));
                rows.append(h('li', { class: 'demo-step' + (changed ? ' is-changed' : '') + (i === STEPS.length - 1 ? ' is-final' : '') },
                    h('span', { class: 'demo-step-label', text: label }),
                    h('span', { class: 'demo-step-cps' }, chips)));
                prev = s;
            });
            const key = s;
            // headword prefix matches first, then exact inflected-form matches
            const hits = [];
            if (key) for (const [lemma, forms] of Object.entries(SAMPLE)) {
                if (keyOf(lemma).startsWith(key)) hits.push([lemma, null]);
                else { const f = forms.find(x => keyOf(x) === key); if (f) hits.push([lemma, f]); }
            }
            result.replaceChildren(
                h('span', { class: 'demo-result-label', text: 'Search key ' }),
                h('code', { lang: 'el', text: key || '—' }),
                h('span', { text: hits.length ? ' → finds ' : ' → no match in this sample' }),
                ...hits.map(([w, via], i) => h('span', { class: 'demo-hit', lang: 'el' },
                    (i ? ', ' : '') + w, via ? h('span', { class: 'demo-via', text: ` (from the form ${via})` }) : null)));
        }
        input.addEventListener('input', render);
        root.replaceChildren(
            h('div', { class: 'demo-bar' }, h('label', { class: 'demo-label', text: 'Type any form ' }, input), presets),
            rows, result);
        render();
    }

    // ======================================================================
    // Cinna — naive "nearest bus" ETA vs a bearing-aware, tiered ETA
    // Buses run both ways on one road; the stop only serves the outbound
    // direction. Naive picks the nearest vehicle regardless of heading;
    // the tiered method only trusts outbound buses still upstream of the
    // stop, caps at 30 min, then falls back to the timetable, then "unknown".
    // ======================================================================
    function etaDemo(root) {
        const W = 640, STOP = 430, OUT_Y = 92, IN_Y = 168;
        const mins = px => Math.max(1, Math.round(px / 12));   // 12 px of road ≈ 1 simulated minute
        const buses = [
            { id: 'A', dir: 1, x: 40, v: 15 }, { id: 'B', dir: 1, x: 360, v: 13 },
            { id: 'C', dir: -1, x: 560, v: 16 }, { id: 'D', dir: -1, x: 300, v: 14 },
            { id: 'E', dir: 0, x: 600, v: 0 },   // parked at the depot: no bearing
        ];
        const score = { naive: 0, tiered: 0, ticks: 0 };

        const s = svg('svg', { viewBox: `0 0 ${W} 240`, class: 'demo-map', role: 'img',
            'aria-label': 'Schematic road with buses moving in both directions and a stop on the outbound side' });
        const road = (y, label, arrowDir) => {
            s.append(svg('line', { x1: 0, y1: y, x2: W, y2: y, class: 'demo-road' }));
            const t = svg('text', { x: arrowDir > 0 ? 8 : W - 8, y: y - 12, class: 'demo-roadlabel', 'text-anchor': arrowDir > 0 ? 'start' : 'end' });
            t.textContent = label; s.append(t);
        };
        road(OUT_Y, 'OUTBOUND →', 1);
        road(IN_Y, '← INBOUND', -1);
        s.append(svg('line', { x1: STOP, y1: OUT_Y - 26, x2: STOP, y2: OUT_Y + 10, class: 'demo-stoppole' }));
        s.append(svg('rect', { x: STOP - 7, y: OUT_Y - 36, width: 14, height: 14, class: 'demo-stopsign' }));
        const stopT = svg('text', { x: STOP + 12, y: OUT_Y - 24, class: 'demo-roadlabel' }); stopT.textContent = 'YOUR STOP'; s.append(stopT);
        const depot = svg('text', { x: 600, y: 230, class: 'demo-roadlabel', 'text-anchor': 'middle' }); depot.textContent = 'DEPOT'; s.append(depot);
        const naiveLink = svg('line', { class: 'demo-link demo-link--naive' });
        const tierLink = svg('line', { class: 'demo-link demo-link--tier' });
        s.append(naiveLink, tierLink);
        const g = buses.map(b => {
            const node = svg('g', { class: 'demo-bus' + (b.dir === 0 ? ' is-parked' : '') });
            node.append(svg('rect', { x: -15, y: -9, width: 30, height: 18, rx: 3 }));
            const t = svg('text', { x: 0, y: 4, 'text-anchor': 'middle' }); t.textContent = b.id; node.append(t);
            s.append(node); return node;
        });
        const yOf = b => (b.dir === 1 ? OUT_Y : b.dir === -1 ? IN_Y : 200);

        const card = (title, sub) => {
            const val = h('p', { class: 'demo-eta-val' }), why = h('p', { class: 'demo-eta-why' }), cnt = h('p', { class: 'demo-eta-count' });
            return { el: h('div', { class: 'demo-eta' }, h('p', { class: 'demo-eta-title', text: title }), h('p', { class: 'demo-eta-sub', text: sub }), val, why, cnt), val, why, cnt };
        };
        const naive = card('Naive', 'nearest vehicle, any heading');
        const tier = card('Cinna', 'bearing-aware · tiered · capped');
        const play = h('button', { type: 'button', class: 'demo-btn' });
        const step = h('button', { type: 'button', class: 'demo-btn', text: 'Step' });

        let running = !reduceMotion, raf = 0, last = 0, acc = 0;
        const truth = () => buses.filter(b => b.dir === 1 && b.x < STOP).sort((a, b) => b.x - a.x)[0];

        function decide() {
            // naive: closest by straight-line distance, whatever its heading
            const nb = buses.slice().sort((a, b) => Math.hypot(a.x - STOP, yOf(a) - OUT_Y) - Math.hypot(b.x - STOP, yOf(b) - OUT_Y))[0];
            const nMin = mins(Math.abs(nb.x - STOP));
            // tiered: outbound and upstream only, ETA capped at 30 min
            const tb = truth();
            const tMin = tb ? mins(STOP - tb.x) : null;
            return { nb, nMin, tb: tMin !== null && tMin <= 30 ? tb : null, tMin };
        }
        function draw() {
            buses.forEach((b, i) => g[i].setAttribute('transform', `translate(${b.x},${yOf(b)})`));
            const { nb, nMin, tb, tMin } = decide();
            const right = truth();
            naiveLink.setAttribute('x1', STOP); naiveLink.setAttribute('y1', OUT_Y);
            naiveLink.setAttribute('x2', nb.x); naiveLink.setAttribute('y2', yOf(nb));
            naive.val.textContent = `${nMin} min`;
            const naiveWrong = nb !== right;
            naive.why.textContent = naiveWrong
                ? (nb.dir === -1 ? `Bus ${nb.id} is heading the other way.` : nb.dir === 0 ? `Bus ${nb.id} is parked at the depot.` : `Bus ${nb.id} already passed the stop.`)
                : `Bus ${nb.id}: correct this time.`;
            naive.el.classList.toggle('is-wrong', naiveWrong);
            if (tb) {
                tierLink.setAttribute('x1', STOP); tierLink.setAttribute('y1', OUT_Y);
                tierLink.setAttribute('x2', tb.x); tierLink.setAttribute('y2', yOf(tb));
                tierLink.style.display = '';
                tier.val.textContent = `${tMin} min`;
                tier.why.textContent = `Bus ${tb.id}: outbound, upstream, bearing matches.`;
            } else {
                tierLink.style.display = 'none';
                tier.val.textContent = 'Scheduled 14:32';
                tier.why.textContent = 'No live bus it can vouch for, so it shows the timetable.';
            }
            naive.cnt.textContent = `Confident-wrong: ${score.naive} of ${score.ticks}`;
            tier.cnt.textContent = `Confident-wrong: ${score.tiered} of ${score.ticks}`;
            return naiveWrong;
        }
        function advance(dt) {
            buses.forEach(b => {
                if (!b.dir) return;
                b.x += b.dir * b.v * dt;
                if (b.x > W + 20) b.x = -20;
                if (b.x < -20) b.x = W + 20;
            });
            acc += dt;
            if (acc >= 1) {            // score once per simulated second
                acc = 0;
                score.ticks++;
                const { nb, tb } = decide();
                if (nb !== truth()) score.naive++;
                if (tb && tb !== truth()) score.tiered++;
            }
        }
        function frame(t) {
            const dt = Math.min(0.05, (t - (last || t)) / 1000);
            last = t;
            advance(dt); draw();
            raf = requestAnimationFrame(frame);
        }
        const start = () => { if (running && !raf) { last = 0; raf = requestAnimationFrame(frame); } };
        const stop = () => { cancelAnimationFrame(raf); raf = 0; };
        const label = () => { play.textContent = running ? 'Pause' : 'Play'; play.setAttribute('aria-pressed', String(running)); };
        play.addEventListener('click', () => { running = !running; label(); running ? start() : stop(); });
        step.addEventListener('click', () => { for (let i = 0; i < 20; i++) advance(0.1); draw(); });
        label();

        root.replaceChildren(
            h('div', { class: 'demo-stage' }, s),
            h('div', { class: 'demo-etas' }, naive.el, tier.el),
            h('div', { class: 'demo-controls' }, play, step,
                h('span', { class: 'demo-note', text: 'Schematic, not real data. It runs the two strategies side by side.' })));
        draw();
        whileVisible(root, start, stop);
    }

    // ======================================================================
    // Week stories — the shared shell for the scroll-driven case-study
    // stories: a pinned stage with a rail of days, a phone (the app) on the
    // left of an SVG, and a caption. Each story builds its own screens and
    // right-hand scene, then hands render(day, t) to start(). Everything is
    // a pure function of scroll progress, so it scrubs both ways.
    // ======================================================================
    const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
    const ease = t => t * t * (3 - 2 * t);

    function weekShell(root, { days, kicker, titles, label }) {
        if (reduceMotion || !('IntersectionObserver' in window)) return null;   // static storyboard stays
        const section = root.closest('.week');
        const S = (tag, attrs = {}, parent) => { const n = svg(tag, attrs); if (parent) parent.append(n); return n; };
        const T = (parent, x, y, text, cls, extra = {}) => { const n = S('text', { x, y, class: cls, ...extra }, parent); n.textContent = text; return n; };

        const rail = h('ol', { class: 'week-rail' }, days.map(([d, t]) => h('li', {}, h('span', { class: 'week-day', text: d }), h('span', { class: 'week-title', text: t }))));
        const railFill = h('span', { class: 'week-rail-fill' });
        const caption = h('p', { class: 'week-caption', 'aria-live': 'polite' });
        const art = S('svg', { viewBox: '0 0 640 440', class: 'week-svg', role: 'img', 'aria-label': label });
        const back = S('g', {}, art);                      // drawn under the phone
        const phone = S('g', {}, art);
        S('rect', { x: 20, y: 18, width: 212, height: 404, rx: 30, class: 'week-phone' }, phone);
        S('rect', { x: 98, y: 30, width: 56, height: 8, rx: 4, class: 'week-notch' }, phone);
        T(phone, 42, 66, kicker, 'week-kicker');
        const screenTitle = T(phone, 42, 90, '', 'week-screen-title');
        const screens = days.map(() => S('g', { class: 'week-screen' }, phone));
        root.replaceChildren(h('div', { class: 'week-head' }, rail, h('span', { class: 'week-rail-track' }, railFill)), art, caption);

        function start(render) {
            let lastDay = -1, queued = false, near = false;
            const frame = p => {
                const s = clamp(p) * days.length;
                const day = Math.min(days.length - 1, Math.floor(s));
                const t = clamp(s - day);
                railFill.style.transform = `scaleX(${clamp(p)})`;
                if (day !== lastDay) {
                    [...rail.children].forEach((li, i) => li.classList.toggle('is-on', i === day));
                    screenTitle.textContent = titles[day];
                    caption.textContent = days[day][2];
                    lastDay = day;
                }
                screens.forEach((g, i) => g.style.opacity = i === day ? clamp(t / 0.08) : 0);
                render(day, t);
            };
            const update = () => {
                queued = false;
                const travel = section.offsetHeight - window.innerHeight;
                frame(travel > 0 ? -section.getBoundingClientRect().top / travel : 0);
            };
            const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
            new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) schedule(); }, { rootMargin: '100% 0px' }).observe(section);
            window.addEventListener('scroll', () => { if (near) schedule(); }, { passive: true });
            window.addEventListener('resize', schedule);
            frame(0);
        }
        return { art, back, phone, screens, S, T, start };
    }

    // ======================================================================
    // Aristophanes — a week in the production (scroll-driven)
    // One production as its own space: the phone on the left is "the app",
    // the seals on the right are the company. Scroll progress p ∈ [0,1]
    // picks the day and how far into it we are; everything is a pure
    // function of p, so it scrubs both ways. Illustrative, not real data.
    // ======================================================================
    function weekDemo(root) {

        const DAYS = [
            ['Mon', 'The call', 'The director posts Thursday’s call. Every member’s phone buzzes.'],
            ['Wed', 'Rehearsal', 'Lysistrata rehearses alone. The app reads the Magistrate; she says her own lines.'],
            ['Thu', 'A quick poll', 'Costume fitting, Saturday or Sunday? The cast votes on the call board.'],
            ['Fri', 'Costumes', 'The costume designer uploads photos. Each actor finds theirs in their wardrobe.'],
            ['Sat', 'Opening night', 'Tickets issued on the web, scanned at the door. Each one admits exactly once.'],
        ];
        const WARM = '#C2603F', COOL = '#3E4A9E', LEAD = '#E3A33B', INK = '#1A1A17';
        const CAST = [
            ['Lysistrata', LEAD], ['Kalonike', WARM], ['Myrrhine', WARM], ['Lampito', WARM], ['Stratyllis', WARM], ['Ismenia', WARM],
            ['Magistrate', COOL], ['Kinesias', COOL], ['Drakes', COOL], ['Strymodoros', COOL],
        ];
        // seat positions: director + costume on the top row, the cast below
        const SEATS = [[330, 70], [420, 70], [510, 70], [600, 70], [330, 165], [420, 165], [510, 165], [600, 165],
                       [330, 260], [420, 260], [510, 260], [600, 260], [420, 355], [510, 355]];
        const members = [
            { name: 'Director', fill: INK, role: 'director', seat: SEATS[0] },
            ...CAST.slice(0, 2).map(([n, f], i) => ({ name: n, fill: f, role: 'cast', seat: SEATS[1 + i] })),
            { name: 'Costume', fill: INK, role: 'costume', seat: SEATS[3] },
            ...CAST.slice(2).map(([n, f], i) => ({ name: n, fill: f, role: 'cast', seat: SEATS[4 + i] })),
        ];
        const HUB = [232, 220];
        const castIdx = members.map((m, i) => (m.role === 'cast' ? i : -1)).filter(i => i >= 0);
        const lyIdx = members.findIndex(m => m.name === 'Lysistrata');
        const costumeIdx = members.findIndex(m => m.role === 'costume');

        const sh = weekShell(root, { days: DAYS, kicker: 'ΛΥΣΙΣΤΡΑΤΗ · ΘΙΑΣΟΣ',
            titles: ['Call board', 'Rehearse', 'Call board', 'Wardrobe', 'Door'],
            label: 'Illustration: the production app on a phone, connected to the members of a theatre company' });
        if (!sh) return false;
        const { art, screens, S, T } = sh;
        const links = S('g', { class: 'week-links' }, sh.back);
        const dots = S('g', {}, sh.back);

        // the company
        const seals = members.map((m, i) => {
            const [cx, cy] = m.seat;
            S('line', { x1: HUB[0], y1: HUB[1], x2: cx - 24, y2: cy, class: 'week-link' }, links);
            const g = S('g', { class: 'week-seal', transform: `translate(${cx},${cy})` }, art);
            const ring = S('circle', { r: 28, class: 'week-ring' }, g);
            const pts = [];
            for (let k = 0; k < 28; k++) {
                const a = (k / 28) * Math.PI * 2, r = k % 2 ? 19.5 : 22;
                pts.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`);
            }
            S('polygon', { points: pts.join(' '), fill: m.fill, class: 'week-wax' }, g);
            const initial = m.role === 'director' ? 'Δ' : m.role === 'costume' ? 'Ε' : m.name[0];
            T(g, 0, 5, initial, 'week-initial', { 'text-anchor': 'middle' });
            T(g, 0, 38, m.name, 'week-name', { 'text-anchor': 'middle' });
            const badge = S('rect', { x: 12, y: -24, width: 10, height: 13, rx: 2, class: 'week-badge' }, g);
            const dot = S('circle', { r: 3.5, class: 'week-dot' }, dots);
            return { g, ring, badge, dot, cx, cy };
        });

        // ---- day screens (built once, revealed by progress)
        // MON: compose + post
        const mon = screens[0];
        S('rect', { x: 42, y: 108, width: 168, height: 92, rx: 8, class: 'week-card' }, mon);
        const monLines = ['Act II run-through', 'Thursday 19:00 · Studio', 'Bring scripts and shoes'].map((txt, i) =>
            ({ full: txt, el: T(mon, 54, 132 + i * 20, '', i ? 'week-text' : 'week-text week-strong') }));
        const postBtn = S('rect', { x: 42, y: 214, width: 168, height: 32, rx: 8, class: 'week-btn' }, mon);
        T(mon, 126, 235, 'Post to call board', 'week-btn-label', { 'text-anchor': 'middle' });
        const monSent = T(mon, 42, 270, '', 'week-small');

        // WED: rehearse, partner lines fill as they're read
        const wed = screens[1];
        const SCRIPT = [
            ['MAGISTRATE', 'Who gave the women the', 'keys to the treasury?', false],
            ['YOU · LYSISTRATA', 'We did. We will keep the', 'money safe from the war.', true],
            ['MAGISTRATE', 'And what do women know', 'of money?', false],
            ['YOU · LYSISTRATA', 'We run every house in', 'Athens. Why not the city?', true],
        ];
        const lines = SCRIPT.map(([who, a, b, mine], i) => {
            const y = 112 + i * 70;
            const g = S('g', {}, wed);
            const bar = S('rect', { x: 36, y: y - 12, width: 3, height: 46, class: 'week-eyeline' }, g);
            T(g, 46, y, who, 'week-who');
            const clipId = `wk-clip-${i}`;
            const clip = S('clipPath', { id: clipId }, art);
            const clipRect = S('rect', { x: 46, y: y + 4, width: 0, height: 34 }, clip);
            [a, b].forEach((txt, k) => T(g, 46, y + 18 + k * 15, txt, 'week-line week-line--base'));
            const fillG = S('g', { 'clip-path': `url(#${clipId})` }, g);
            [a, b].forEach((txt, k) => T(fillG, 46, y + 18 + k * 15, txt, mine ? 'week-line week-line--mine' : 'week-line week-line--read'));
            return { g, bar, clipRect, mine };
        });
        const waves = S('g', { class: 'week-waves' }, art);
        [10, 18, 26].forEach(r => S('path', { d: `M${HUB[0] + 4},${HUB[1] - r} A${r},${r} 0 0 1 ${HUB[0] + 4},${HUB[1] + r}`, class: 'week-wave' }, waves));

        // THU: poll
        const thu = screens[2];
        S('rect', { x: 42, y: 108, width: 168, height: 150, rx: 8, class: 'week-card' }, thu);
        T(thu, 54, 132, 'Costume fitting: which day?', 'week-text week-strong');
        const pollRows = ['Saturday', 'Sunday'].map((label, i) => {
            const y = 160 + i * 44;
            T(thu, 54, y, label, 'week-text');
            S('rect', { x: 54, y: y + 8, width: 144, height: 10, rx: 5, class: 'week-track' }, thu);
            const bar = S('rect', { x: 54, y: y + 8, width: 0, height: 10, rx: 5, class: 'week-bar' }, thu);
            const n = T(thu, 198, y, '0', 'week-text', { 'text-anchor': 'end' });
            return { bar, n };
        });
        const pollNote = T(thu, 54, 248, '', 'week-small');
        const VOTES = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0];   // 7 Saturday · 3 Sunday

        // FRI: wardrobe fills
        const fri = screens[3];
        const tiles = CAST.slice(0, 6).map(([, fill], i) => {
            const x = 42 + (i % 3) * 58, y = 108 + Math.floor(i / 3) * 84;
            const g = S('g', {}, fri);
            S('rect', { x, y, width: 52, height: 76, rx: 6, class: 'week-card' }, g);
            S('path', { d: `M${x + 18},${y + 14} h16 l10 12 l-6 4 l-3 -4 v40 h-18 v-40 l-3 4 l-6 -4 z`, fill }, g);
            return g;
        });
        const friNote = T(fri, 42, 290, '', 'week-small');

        // SAT: the door
        const sat = screens[4];
        const qr = S('g', {}, sat);
        let seed = 7;
        for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
            seed = (seed * 9301 + 49297) % 233280;
            const finder = (r < 3 && c < 3) || (r < 3 && c > 5) || (r > 5 && c < 3);
            if (finder || seed / 233280 > 0.5) S('rect', { x: 80 + c * 10, y: 108 + r * 10, width: 9, height: 9, class: 'week-qr' }, qr);
        }
        const ticketLabel = T(sat, 126, 214, '', 'week-text', { 'text-anchor': 'middle' });
        const verdict = S('rect', { x: 42, y: 226, width: 168, height: 46, rx: 8, class: 'week-verdict' }, sat);
        const verdictText = T(sat, 126, 254, '', 'week-verdict-text', { 'text-anchor': 'middle' });
        const curtain = T(sat, 126, 304, '', 'week-curtain', { 'text-anchor': 'middle' });

        // ---- render: a function of the day and how far into it we are
        sh.start((day, t) => {
            waves.style.opacity = 0;

            // defaults, then each day overrides
            seals.forEach((sl, i) => { sl.ring.style.opacity = 0; sl.dot.style.opacity = 0; sl.badge.style.opacity = day > 3 && members[i].role === 'cast' ? 1 : 0; sl.g.classList.remove('is-dim'); });
            [...links.children].forEach(l => l.classList.remove('is-hot'));

            if (day === 0) {
                monLines.forEach((ln, i) => {
                    const k = clamp((t - i * 0.12) / 0.14);
                    ln.el.textContent = ln.full.slice(0, Math.round(ln.full.length * k));
                });
                postBtn.classList.toggle('is-pressed', t > 0.48);
                let reached = 0;
                seals.forEach((sl, i) => {
                    if (i === 0) return;                         // the director sends, not receives
                    const u = clamp((t - 0.5 - i * 0.018) / 0.22);
                    if (u > 0 && u < 1) {
                        sl.dot.style.opacity = 1;
                        sl.dot.setAttribute('cx', HUB[0] + (sl.cx - 24 - HUB[0]) * ease(u));
                        sl.dot.setAttribute('cy', HUB[1] + (sl.cy - HUB[1]) * ease(u));
                    }
                    if (u >= 1) { sl.ring.style.opacity = 1; reached++; }
                });
                monSent.textContent = t > 0.5 ? `Notified ${reached} of 13 members` : '';
            }

            if (day === 1) {
                const seg = Math.min(3, Math.floor(t * 4)), u = clamp(t * 4 - seg);
                lines.forEach((ln, i) => {
                    const done = i < seg, now = i === seg;
                    ln.clipRect.setAttribute('width', done ? 170 : now ? 170 * (ln.mine ? (u > 0.15 ? 1 : 0) : ease(u)) : 0);
                    ln.bar.style.opacity = now && ln.mine ? 1 : 0;
                    ln.g.style.opacity = i <= seg ? 1 : 0.35;
                });
                const reading = !lines[seg].mine;
                waves.style.opacity = reading ? 0.4 + 0.6 * Math.abs(Math.sin(u * Math.PI * 6)) : 0;
                seals.forEach((sl, i) => { if (i !== lyIdx) sl.g.classList.add('is-dim'); });
                seals[lyIdx].ring.style.opacity = 1;
                links.children[lyIdx].classList.add('is-hot');
            }

            if (day === 2) {
                const tally = [0, 0];
                castIdx.forEach((mi, k) => {
                    const sl = seals[mi];
                    const u = clamp((t - 0.08 - k * 0.06) / 0.14);
                    if (u > 0 && u < 1) {
                        sl.dot.style.opacity = 1;
                        sl.dot.setAttribute('cx', sl.cx - 24 + (HUB[0] - sl.cx + 24) * ease(u));
                        sl.dot.setAttribute('cy', sl.cy + (HUB[1] - sl.cy) * ease(u));
                        sl.ring.style.opacity = 1 - u;
                    }
                    if (u >= 1) tally[VOTES[k]]++;
                });
                pollRows.forEach((r, i) => { r.bar.setAttribute('width', (144 * tally[i]) / CAST.length); r.n.textContent = String(tally[i]); });
                pollNote.textContent = `${tally[0] + tally[1]} of ${CAST.length} voted`;
            }

            if (day === 3) {
                seals[costumeIdx].ring.style.opacity = 1;
                const from = seals[costumeIdx];
                let got = 0;
                castIdx.forEach((mi, k) => {
                    const sl = seals[mi];
                    const u = clamp((t - 0.1 - k * 0.055) / 0.16);
                    if (u > 0 && u < 1) {
                        sl.dot.style.opacity = 1;
                        sl.dot.setAttribute('cx', from.cx + (sl.cx - from.cx) * ease(u));
                        sl.dot.setAttribute('cy', from.cy + (sl.cy - from.cy) * ease(u));
                    }
                    sl.badge.style.opacity = u >= 1 ? 1 : 0;
                    if (u >= 1) got++;
                });
                tiles.forEach((tile, i) => tile.style.opacity = clamp((t - 0.1 - i * 0.1) / 0.1));
                friNote.textContent = `${got} of ${CAST.length} costumes delivered`;
            }

            if (day === 4) {
                const step = Math.min(3, Math.floor(t * 4)), u = clamp(t * 4 - step);
                const STATES = [['Ticket 7A', 'Admitted', 'ok'], ['Ticket 12C', 'Admitted', 'ok'], ['Ticket 7A', 'Already admitted', 'dup'], ['', '', 'curtain']];
                const [ticket, word, kind] = STATES[step];
                const scanned = u > 0.35;
                ticketLabel.textContent = ticket ? (scanned ? ticket : `Scanning ${ticket}…`) : '';
                verdict.setAttribute('class', 'week-verdict' + (kind === 'curtain' ? ' is-hidden' : scanned ? ` is-${kind}` : ''));
                verdictText.textContent = scanned ? word : '';
                verdictText.setAttribute('class', 'week-verdict-text' + (kind === 'dup' ? ' is-dark' : ''));
                qr.style.opacity = kind === 'curtain' ? 0.15 : 1;
                curtain.textContent = kind === 'curtain' ? 'Curtain up' : '';
                if (kind === 'curtain') seals.forEach(sl => sl.ring.style.opacity = ease(u));
            }
        });
    }

    // ======================================================================
    // Cinna — a commuter's week (scroll-driven)
    // The phone is the app; on the right, a schematic of one route through
    // Nicosia. Every beat is in the app except the ticket: live arrivals, the
    // timetable fallback when the feed goes quiet, the trip planner,
    // boarding with a scanned ticket and Ride mode, and the journey summary.
    // Illustrative — the times and figures are examples, not real data.
    // ======================================================================
    function cinnaWeekDemo(root) {
        const DAYS = [
            ['Mon', 'At the stop', 'Bus 30 is coming in live, refreshed from the national feed every 15 seconds. Bus 22 is marked as scheduled, because that’s all it is.'],
            ['Tue', 'The feed goes quiet', 'Bus 30 stops reporting its position. Instead of a stale countdown, Cinna falls back to the timetable and says why.'],
            ['Wed', 'Plan a trip', 'Home to the university: the planner offers the direct bus or a walk and a change, and draws the route.'],
            ['Thu', 'Board and ride', 'Ride mode shows one thing at a time: the next stop. (Wallet tickets, scanned by the driver’s app, are built and stay off until Cinna is licensed.)'],
            ['Fri', 'Journey complete', 'The trip summary: time on board and CO₂ saved compared with driving, added to your week.'],
        ];
        const sh = weekShell(root, { days: DAYS, kicker: 'CINNA · ΛΕΥΚΩΣΙΑ', titles: ['Makariou Ave', 'Makariou Ave', 'Plan a trip', 'Ride', 'Journey'],
            label: 'Illustration: the Cinna app on a phone beside a schematic bus route through Nicosia' });
        if (!sh) return false;
        const { art, screens, S, T } = sh;

        // ---- the map
        const map = S('g', {}, sh.back);
        [[250, 120, 640, 70], [250, 300, 640, 250], [300, 20, 260, 440], [450, 20, 420, 440], [570, 20, 600, 440]]
            .forEach(([x1, y1, x2, y2]) => S('line', { x1, y1, x2, y2, class: 'wk-street' }, map));
        S('path', { d: 'M262,196 L370,190 L480,232 L612,316', class: 'wk-route22' }, map);
        T(map, 270, 186, '22', 'wk-route-tag');
        const D = 'M250,384 L330,330 L395,262 L480,232 L548,160 L632,102';
        S('path', { d: D, class: 'wk-road' }, map);
        const hi = S('path', { d: D, class: 'wk-route-hi' }, map);
        const total = hi.getTotalLength();
        hi.style.strokeDasharray = `0 ${total}`;
        const STOPS = [['Makariou Ave', 330, 330, 'end'], ['Agios Antonios', 395, 262, 'end'], ['Eleftheria Sq.', 480, 232, 'start'], ['University', 548, 160, 'end']];
        // where along the route each stop sits
        const lenAt = (x, y) => { let best = 0, bd = 1e9; for (let l = 0; l <= total; l += 2) { const q = hi.getPointAtLength(l); const d = (q.x - x) ** 2 + (q.y - y) ** 2; if (d < bd) { bd = d; best = l; } } return best; };
        const stopLen = STOPS.map(([, x, y]) => lenAt(x, y));
        const stopEls = STOPS.map(([name, x, y, anchor]) => {
            const c = S('circle', { cx: x, cy: y, r: 6, class: 'wk-stop' }, map);
            T(map, x + (anchor === 'end' ? -12 : 12), y + 4, name, 'wk-stop-label', { 'text-anchor': anchor });
            return c;
        });
        const pin = S('path', { d: 'M548,148 c-9,0 -14,-7 -14,-13 a14,14 0 0 1 28,0 c0,6 -5,13 -14,13 z', class: 'wk-pin' }, map);

        const rider = S('g', {}, art);
        const riderRing = S('circle', { r: 13, class: 'week-ring' }, rider);
        S('circle', { r: 6.5, class: 'wk-rider' }, rider);
        T(rider, 0, -18, 'You', 'wk-you', { 'text-anchor': 'middle' });

        const bus = S('g', {}, art);
        const busWaves = S('g', { class: 'wk-waves' }, bus);
        [9, 15].forEach(r => S('path', { d: `M${-r},-14 A${r},${r} 0 0 1 ${r},-14`, class: 'week-wave' }, busWaves));
        const busBody = S('rect', { x: -18, y: -10, width: 36, height: 20, rx: 5, class: 'wk-bus' }, bus);
        const busText = T(bus, 0, 4, '30', 'wk-bus-text', { 'text-anchor': 'middle' });
        const busRing = S('circle', { r: 24, class: 'week-ring' }, bus);
        const placeBus = len => { const q = hi.getPointAtLength(clamp(len, 0, total)); bus.setAttribute('transform', `translate(${q.x},${q.y})`); return q; };
        const placeRider = (x, y) => rider.setAttribute('transform', `translate(${x},${y})`);

        // ---- phone screens
        const row = (g, y, route, dest, big, small, live) => {
            S('rect', { x: 42, y, width: 168, height: 52, rx: 8, class: 'week-card' }, g);
            S('rect', { x: 52, y: y + 15, width: 26, height: 22, rx: 4, class: 'wk-badge' }, g);
            T(g, 65, y + 30, route, 'wk-badge-text', { 'text-anchor': 'middle' });
            T(g, 86, y + 24, dest, 'week-text week-strong');
            const sm = T(g, 86, y + 39, small, 'week-small');
            const bg = T(g, 202, y + 33, big, 'wk-big', { 'text-anchor': 'end' });
            const dot = S('circle', { cx: 86 + 3, cy: y + 36, r: 0, class: 'wk-live' }, g);
            if (live) { dot.setAttribute('r', 3); sm.setAttribute('x', 95); }
            return { bg, sm, dot };
        };
        // MON
        const mon = screens[0];
        const m30 = row(mon, 108, '30', 'University', '6 min', 'live', true);
        row(mon, 170, '22', 'Strovolos', '12 min', 'scheduled', false);
        // TUE
        const tue = screens[1];
        const t30 = row(tue, 108, '30', 'University', '5 min', 'live', true);
        row(tue, 170, '22', 'Strovolos', '11 min', 'scheduled', false);
        const tueNote = T(tue, 42, 248, '', 'week-small');
        const tueNote2 = T(tue, 42, 262, '', 'week-small');
        // WED
        const wed = screens[2];
        S('rect', { x: 42, y: 104, width: 168, height: 56, rx: 8, class: 'week-card' }, wed);
        T(wed, 52, 126, 'From  Home', 'week-text'); T(wed, 52, 146, 'To      University', 'week-text week-strong');
        const optA = S('rect', { x: 42, y: 172, width: 168, height: 50, rx: 8, class: 'week-card' }, wed);
        T(wed, 52, 192, '30 · direct · 3 stops', 'week-text week-strong'); T(wed, 52, 209, 'arrive 08:51', 'week-small');
        const optB = S('g', {}, wed);
        S('rect', { x: 42, y: 230, width: 168, height: 50, rx: 8, class: 'week-card' }, optB);
        T(optB, 52, 250, 'Walk 6 min + 22', 'week-text'); T(optB, 52, 267, 'arrive 08:58', 'week-small');
        // THU
        const thu = screens[3];
        const ticket = S('g', {}, thu);
        S('rect', { x: 42, y: 104, width: 168, height: 170, rx: 10, class: 'wk-pass' }, ticket);
        T(ticket, 54, 126, 'CINNA', 'wk-pass-kicker'); T(ticket, 54, 146, 'Single · Route 30', 'wk-pass-title');
        let seed = 11;
        for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
            seed = (seed * 9301 + 49297) % 233280;
            if ((r < 2 && c < 2) || (r < 2 && c > 5) || (r > 5 && c < 2) || seed / 233280 > 0.5) S('rect', { x: 86 + c * 10, y: 160 + r * 10, width: 9, height: 9, class: 'wk-pass-qr' }, ticket);
        }
        const tap = S('g', {}, thu);
        S('circle', { cx: 126, cy: 170, r: 40, class: 'wk-tap' }, tap);
        S('path', { d: 'M108,170 l12,12 l24,-26', class: 'wk-tap-check' }, tap);
        T(tap, 126, 238, 'Tap confirmed', 'wk-tap-text', { 'text-anchor': 'middle' });
        const ride = S('g', {}, thu);
        T(ride, 42, 132, 'NEXT STOP', 'week-small');
        const rideStop = T(ride, 42, 166, '', 'wk-ride-stop');
        const rideLeft = T(ride, 42, 190, '', 'week-small');
        const banner = S('g', {}, thu);
        S('rect', { x: 36, y: 300, width: 180, height: 40, rx: 10, class: 'wk-banner' }, banner);
        T(banner, 126, 325, 'Your stop is next', 'wk-banner-text', { 'text-anchor': 'middle' });
        // FRI
        const fri = screens[4];
        S('circle', { cx: 126, cy: 140, r: 26, class: 'wk-tap' }, fri);
        S('path', { d: 'M114,140 l8,8 l16,-17', class: 'wk-tap-check' }, fri);
        T(fri, 126, 196, 'Journey complete', 'wk-tap-text', { 'text-anchor': 'middle' });
        const friMin = T(fri, 60, 240, '', 'wk-big');
        T(fri, 60, 256, 'minutes on board', 'week-small');
        const friCo2 = T(fri, 140, 240, '', 'wk-big');
        T(fri, 140, 256, 'kg CO₂ saved', 'week-small');
        T(fri, 42, 296, 'vs driving the same trip', 'week-small');
        const friWeek = T(fri, 42, 330, '', 'week-text week-strong');

        sh.start((day, t) => {
            const L0 = stopLen[0], L3 = stopLen[3];
            bus.style.opacity = 1; busRing.style.opacity = 0; riderRing.style.opacity = 0;
            busBody.setAttribute('class', 'wk-bus'); busText.textContent = '30';
            busWaves.style.opacity = 0; pin.style.opacity = 0;
            stopEls.forEach(c => c.classList.remove('is-on'));
            placeRider(STOPS[0][1], STOPS[0][2]);
            hi.style.strokeDasharray = `0 ${total}`;
            const drawRoute = (from, to) => { hi.style.strokeDasharray = `0 ${from} ${Math.max(0, to - from)} ${total}`; };
            const pulse = (k = 3) => 0.35 + 0.65 * Math.abs(Math.sin(t * Math.PI * k * 4));

            if (day === 0) {
                const len = L0 * ease(clamp(t / 0.85));
                placeBus(len);
                const mins = Math.ceil(((L0 - len) / L0) * 6);
                m30.bg.textContent = mins <= 0 ? 'Due' : `${mins} min`;
                busWaves.style.opacity = t < 0.85 ? pulse() : 0;
                stopEls[0].classList.add('is-on');
                if (t >= 0.85) riderRing.style.opacity = pulse(2);
            }
            if (day === 1) {
                const lost = t > 0.35;
                const len = L0 * 0.6 * ease(clamp(t / 0.35));
                placeBus(len);
                busWaves.style.opacity = lost ? 0 : pulse();
                busBody.setAttribute('class', 'wk-bus' + (lost ? ' is-lost' : ''));
                busText.textContent = lost ? '30?' : '30';
                t30.bg.textContent = lost ? '07:52' : `${Math.ceil(((L0 - len) / L0) * 6)} min`;
                t30.sm.textContent = lost ? 'scheduled' : 'live';
                t30.dot.setAttribute('class', 'wk-live' + (lost ? ' is-off' : ''));
                tueNote.textContent = lost ? 'Live position lost.' : '';
                tueNote2.textContent = lost ? 'Showing the timetable instead.' : '';
                stopEls[0].classList.add('is-on');
            }
            if (day === 2) {
                bus.style.opacity = 0;
                const k = clamp((t - 0.15) / 0.55);
                drawRoute(L0, L0 + (L3 - L0) * ease(k));
                stopEls.forEach((c, i) => c.classList.toggle('is-on', stopLen[i] <= L0 + (L3 - L0) * ease(k) + 1));
                pin.style.opacity = clamp((t - 0.6) / 0.15);
                optB.style.opacity = clamp((t - 0.1) / 0.15);
                optA.setAttribute('class', 'week-card' + (t > 0.7 ? ' wk-selected' : ''));
            }
            if (day === 3) {
                const ph1 = t < 0.25, ph2 = t >= 0.25 && t < 0.4;
                const len = ph1 ? L0 * (0.5 + 0.5 * ease(t / 0.25)) : ph2 ? L0 : L0 + (L3 - L0) * ease(clamp((t - 0.4) / 0.55));
                const q = placeBus(len);
                busWaves.style.opacity = pulse() * 0.8;
                ticket.style.opacity = ph1 ? 1 : 0;
                tap.style.opacity = ph2 ? clamp((t - 0.25) / 0.05) : 0;
                ride.style.opacity = t >= 0.4 ? 1 : 0;
                if (ph2) busRing.style.opacity = 1;
                if (t >= 0.25) { placeRider(q.x, q.y - 26); drawRoute(L0, len); }
                const next = stopLen.findIndex(l => l > len + 4);
                rideStop.textContent = next < 0 ? 'University' : STOPS[next][0];
                rideLeft.textContent = next < 0 ? 'Arriving' : `${STOPS.length - next} stop${STOPS.length - next > 1 ? 's' : ''} to go`;
                banner.style.opacity = t >= 0.4 && len > stopLen[2] - 2 ? 1 : 0;
                stopEls.forEach((c, i) => c.classList.toggle('is-on', t >= 0.25 && stopLen[i] <= len + 1));
            }
            if (day === 4) {
                drawRoute(L0, L3);
                stopEls.forEach(c => c.classList.add('is-on'));
                placeBus(L3 + (total - L3) * ease(t));
                bus.style.opacity = 1 - clamp(t / 0.6);
                placeRider(STOPS[3][1], STOPS[3][2]);
                riderRing.style.opacity = 1;
                const k = ease(clamp(t / 0.6));
                friMin.textContent = String(Math.round(24 * k));
                friCo2.textContent = (1.8 * k).toFixed(1);
                friWeek.textContent = t > 0.6 ? 'This week: 5 trips' : '';
            }
        });
    }

    // ======================================================================
    // Plutarch (Ρίζα) — a reader's week (scroll-driven)
    // The phone is the dictionary; on the right, the data behind the page:
    // the search key, a lemma with its inflected forms, cited senses, the
    // cross-reference graph and the reports queue. Phone copy is the app's
    // own Greek UI; the glosses are short paraphrases, not quoted entries.
    // ======================================================================
    function plutarchWeekDemo(root) {
        const DAYS = [
            ['Mon', 'No accents', 'A reader types εκανες, no accents. The search key strips them, finds the inflected form, and lands on its verb: κάνω.'],
            ['Tue', 'Cited senses', 'Every sense carries a link to where it came from: Greek Wiktionary, CC BY-SA.'],
            ['Wed', 'The table', 'The conjugation table shows the form they typed, in context.'],
            ['Thu', 'Word of the day', 'Ρίζα, “root”, the dictionary’s own name. Cross-references lead to the words around it.'],
            ['Fri', 'Report a mistake', 'A reader flags an example. It’s sent anonymously, with no account or email, to the reports queue.'],
        ];
        const sh = weekShell(root, { days: DAYS, kicker: 'ΡΙΖΑ · ΛΕΞΙΚΟ', titles: ['Αναζήτηση', 'κάνω', 'κάνω · κλίση', 'Λέξη της ημέρας', 'Αναφορά λάθους'],
            label: 'Illustration: the Ρίζα dictionary on a phone beside the data behind an entry' });
        if (!sh) return false;
        const { art, screens, S, T } = sh;
        const CX = 450, CY = 214;

        // ---- right: the data
        const data = S('g', {}, sh.back);
        T(data, 262, 428, '1 of 95,774 entries · Greek Wiktionary, CC BY-SA', 'week-small');
        // search-key strip
        const strip = S('g', {}, data);
        T(strip, 262, 34, 'SEARCH KEY', 'week-small');
        const chipIn = S('rect', { x: 262, y: 42, width: 78, height: 24, rx: 5, class: 'pl-chip' }, strip);
        const chipInT = T(strip, 301, 58, '', 'pl-chip-text', { 'text-anchor': 'middle' });
        S('path', { d: 'M346,54 h22', class: 'pl-arrow' }, strip);
        S('rect', { x: 372, y: 42, width: 78, height: 24, rx: 5, class: 'pl-chip pl-chip--key' }, strip);
        const chipKeyT = T(strip, 411, 58, '', 'pl-chip-text pl-chip-text--key', { 'text-anchor': 'middle' });
        T(strip, 458, 58, 'accents off, ς → σ', 'week-small');
        // lemma κάνω + its forms
        const verb = S('g', {}, data);
        const FORMS = ['κάνω', 'κάνεις', 'κάνει', 'έκανα', 'έκανες', 'έκανε', 'κάναμε', 'κάνατε'];
        const formEls = FORMS.map((f, i) => {
            const a = (i / FORMS.length) * Math.PI * 2 - Math.PI / 2;
            const x = CX + Math.cos(a) * 138, y = CY + Math.sin(a) * 92;
            const line = S('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'pl-edge' }, verb);
            const g = S('g', { transform: `translate(${x},${y})` }, verb);
            S('rect', { x: -31, y: -11, width: 62, height: 22, rx: 11, class: 'pl-form' }, g);
            T(g, 0, 4, f, 'pl-form-text', { 'text-anchor': 'middle', lang: 'el' });
            return { g, line, f };
        });
        S('circle', { cx: CX, cy: CY, r: 36, class: 'pl-lemma' }, verb);
        T(verb, CX, CY + 6, 'κάνω', 'pl-lemma-text', { 'text-anchor': 'middle', lang: 'el' });
        T(verb, CX, CY + 52, 'ρήμα · 8 of its forms', 'week-small', { 'text-anchor': 'middle' });
        // senses with their source
        const senses = S('g', {}, data);
        [['1', 'φτιάχνω, δημιουργώ'], ['2', 'εκτελώ, πραγματοποιώ']].forEach(([n, txt], i) => {
            const x = 270 + i * 186, y = 344;
            S('line', { x1: CX, y1: CY + 36, x2: x + 86, y2: y, class: 'pl-edge pl-edge--hot' }, senses);
            S('rect', { x, y, width: 172, height: 46, rx: 6, class: 'week-card' }, senses);
            T(senses, x + 10, y + 19, `${n}. ${txt}`, 'week-text week-strong', { lang: 'el' });
            S('rect', { x: x + 10, y: y + 26, width: 64, height: 14, rx: 7, class: 'pl-source' }, senses);
            T(senses, x + 42, y + 36, 'Βικιλεξικό', 'pl-source-text', { 'text-anchor': 'middle', lang: 'el' });
        });
        // ρίζα + cross-references
        const root2 = S('g', {}, data);
        const RELS = [['ριζικός', -150], ['ριζώνω', -30], ['ριζοσπάστης', 90]];
        const relEls = RELS.map(([w, deg]) => {
            const a = (deg * Math.PI) / 180, x = CX + Math.cos(a) * 128, y = CY + Math.sin(a) * 96;
            const line = S('line', { x1: CX, y1: CY, x2: x, y2: y, class: 'pl-edge' }, root2);
            const g = S('g', { transform: `translate(${x},${y})` }, root2);
            S('rect', { x: -44, y: -12, width: 88, height: 24, rx: 12, class: 'pl-form' }, g);
            T(g, 0, 4, w, 'pl-form-text', { 'text-anchor': 'middle', lang: 'el' });
            return { g, line };
        });
        S('circle', { cx: CX, cy: CY, r: 36, class: 'pl-lemma' }, root2);
        T(root2, CX, CY + 6, 'ρίζα', 'pl-lemma-text', { 'text-anchor': 'middle', lang: 'el' });
        T(root2, CX, CY + 52, 'ουσιαστικό · cross-references', 'week-small', { 'text-anchor': 'middle' });
        // reports queue
        const queue = S('g', {}, data);
        S('rect', { x: 470, y: 330, width: 158, height: 64, rx: 8, class: 'week-card' }, queue);
        T(queue, 482, 350, 'REPORTS', 'week-small');
        const qItem = S('g', {}, queue);
        S('rect', { x: 482, y: 358, width: 134, height: 26, rx: 5, class: 'pl-chip' }, qItem);
        T(qItem, 490, 375, 'example · κάνω', 'pl-chip-text');
        T(qItem, 608, 375, '#a91f…', 'pl-hash', { 'text-anchor': 'end' });
        const env = S('rect', { width: 14, height: 10, rx: 2, class: 'pl-env' }, art);

        // ---- phone screens
        // MON: search
        const mon = screens[0];
        S('rect', { x: 42, y: 106, width: 168, height: 34, rx: 17, class: 'week-card' }, mon);
        const typed = T(mon, 58, 128, '', 'pl-typed', { lang: 'el' });
        const caret = S('rect', { x: 58, y: 116, width: 1.5, height: 16, class: 'pl-caret' }, mon);
        const result = S('g', {}, mon);
        S('rect', { x: 42, y: 150, width: 168, height: 56, rx: 8, class: 'week-card wk-selected' }, result);
        T(result, 54, 174, 'κάνω', 'pl-res-lemma', { lang: 'el' });
        T(result, 112, 174, 'ρήμα', 'week-small', { lang: 'el' });
        T(result, 54, 194, 'έκανες → κάνω', 'week-small', { lang: 'el' });
        // TUE: entry
        const tue = screens[1];
        [['1.', 'φτιάχνω, δημιουργώ', 'κάνω ένα τραπέζι'], ['2.', 'εκτελώ, πραγματοποιώ', 'κάνω μια δουλειά']].forEach(([n, s1, ex], i) => {
            const y = 112 + i * 92;
            T(tue, 42, y, n, 'week-small');
            T(tue, 58, y, s1, 'week-text week-strong', { lang: 'el' });
            S('rect', { x: 58, y: y + 10, width: 68, height: 16, rx: 8, class: 'pl-source' }, tue);
            T(tue, 92, y + 22, 'Βικιλεξικό', 'pl-source-text', { 'text-anchor': 'middle', lang: 'el' });
            S('rect', { x: 58, y: y + 36, width: 2, height: 18, class: 'week-eyeline' }, tue);
            T(tue, 66, y + 49, ex, 'pl-example', { lang: 'el' });
        });
        // WED: conjugation (aorist column)
        const wed = screens[2];
        T(wed, 42, 112, 'ΑΟΡΙΣΤΟΣ', 'week-small');
        const AOR = [['α΄', 'έκανα'], ['β΄', 'έκανες'], ['γ΄', 'έκανε'], ['α΄ πλ.', 'κάναμε'], ['β΄ πλ.', 'κάνατε'], ['γ΄ πλ.', 'έκαναν']];
        const aorRows = AOR.map(([p, f], i) => {
            const y = 122 + i * 30;
            const bg = S('rect', { x: 42, y, width: 168, height: 26, rx: 4, class: 'pl-row' }, wed);
            T(wed, 52, y + 17, p, 'week-small', { lang: 'el' });
            T(wed, 104, y + 17, f, 'week-text', { lang: 'el' });
            return bg;
        });
        // THU: word of the day
        const thu = screens[3];
        T(thu, 42, 140, 'ρίζα', 'pl-wotd', { lang: 'el' });
        T(thu, 42, 162, 'ουσιαστικό', 'week-small', { lang: 'el' });
        T(thu, 42, 190, 'το μέρος του φυτού', 'week-text', { lang: 'el' });
        T(thu, 42, 206, 'κάτω από το έδαφος', 'week-text', { lang: 'el' });
        T(thu, 42, 240, 'ΣΧΕΤΙΚΕΣ', 'week-small');
        const thuRel = ['ριζικός', 'ριζώνω', 'ριζοσπάστης'].map((w, i) => T(thu, 42, 262 + i * 20, w, 'pl-rel', { lang: 'el' }));
        // FRI: report
        const fri = screens[4];
        const CATS = ['Λάθος ορισμός', 'Λείπει σημασία ή λέξη', 'Λάθος ετυμολογία', 'Πρόβλημα σε παράδειγμα', 'Ορθογραφικό ή τονισμός', 'Κάτι άλλο'];
        const radios = CATS.map((c, i) => {
            const y = 112 + i * 26;
            const dot = S('circle', { cx: 50, cy: y - 4, r: 5, class: 'pl-radio' }, fri);
            T(fri, 62, y, c, 'week-text', { lang: 'el' });
            return dot;
        });
        const send = S('rect', { x: 42, y: 280, width: 168, height: 32, rx: 8, class: 'week-btn' }, fri);
        const sendT = T(fri, 126, 301, 'Αποστολή', 'week-btn-label', { 'text-anchor': 'middle', lang: 'el' });

        sh.start((day, t) => {
            const word = 'εκανες';
            strip.style.opacity = day === 0 ? 1 : 0.25;
            verb.style.opacity = day === 3 ? 0 : day === 4 ? 0.35 : 1;
            root2.style.opacity = day === 3 ? 1 : 0;
            senses.style.opacity = day === 1 ? clamp(t / 0.3) : 0;
            queue.style.opacity = day === 4 ? 1 : 0;
            env.style.opacity = 0;
            formEls.forEach(fe => { fe.g.classList.remove('is-hot', 'is-dim'); fe.line.classList.remove('pl-edge--hot'); });

            if (day === 0) {
                const n = Math.round(word.length * clamp(t / 0.4));
                typed.textContent = word.slice(0, n);
                caret.setAttribute('x', 58 + typed.getComputedTextLength() + 1);
                caret.style.opacity = t < 0.45 ? (Math.floor(t * 20) % 2 ? 0 : 1) : 0;
                chipInT.textContent = word.slice(0, n) || ' ';
                chipKeyT.textContent = t > 0.45 ? 'εκανεσ' : '';
                result.style.opacity = clamp((t - 0.55) / 0.12);
                const hit = formEls.find(fe => fe.f === 'έκανες');
                if (t > 0.5) { hit.g.classList.add('is-hot'); hit.line.classList.add('pl-edge--hot'); }
                formEls.forEach(fe => { if (fe !== hit && t > 0.5) fe.g.classList.add('is-dim'); });
            }
            if (day === 1) formEls.forEach(fe => fe.g.classList.add('is-dim'));
            if (day === 2) {
                formEls.forEach((fe, i) => { if (t > 0.1 + i * 0.06) fe.g.classList.add('is-hot'); });
                aorRows.forEach((bg, i) => bg.setAttribute('class', 'pl-row' + (i === 1 && t > 0.35 ? ' is-hot' : '')));
            }
            if (day === 3) {
                relEls.forEach((r, i) => {
                    const on = t > 0.2 + i * 0.18;
                    r.g.classList.toggle('is-hot', on); r.line.classList.toggle('pl-edge--hot', on);
                    thuRel[i].classList.toggle('is-hot', on);
                });
            }
            if (day === 4) {
                radios.forEach((r, i) => r.setAttribute('class', 'pl-radio' + (i === 3 && t > 0.2 ? ' is-on' : '')));
                const sent = t > 0.45;
                send.classList.toggle('is-pressed', sent);
                sendT.textContent = sent ? 'Στάλθηκε · ευχαριστούμε' : 'Αποστολή';
                const u = clamp((t - 0.45) / 0.3);
                if (u > 0 && u < 1) {
                    env.style.opacity = 1;
                    env.setAttribute('x', 226 + (482 - 226) * ease(u));
                    env.setAttribute('y', 290 + (366 - 290) * ease(u));
                }
                qItem.style.opacity = clamp((t - 0.75) / 0.08);
            }
        });
    }

    const DEMOS = { normalise: normaliseDemo, eta: etaDemo, week: weekDemo, 'week-cinna': cinnaWeekDemo, 'week-plutarch': plutarchWeekDemo };
    document.querySelectorAll('[data-demo]').forEach(el => {
        const fn = DEMOS[el.dataset.demo];
        // a demo can decline (return false), e.g. under reduced motion, and keep its static fallback
        if (fn && fn(el.querySelector('.demo-body') || el) !== false) el.classList.add('is-live');
    });
})();
