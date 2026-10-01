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
    // (the real index holds ~650k forms; any of them leads back to the entry)
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
    // Aristophanes — a week in the production (scroll-driven)
    // One production as its own space: the phone on the left is "the app",
    // the seals on the right are the company. Scroll progress p ∈ [0,1]
    // picks the day and how far into it we are; everything is a pure
    // function of p, so it scrubs both ways. Illustrative, not real data.
    // ======================================================================
    function weekDemo(root) {
        const section = root.closest('.week');
        if (reduceMotion || !('IntersectionObserver' in window)) return false;   // static storyboard stays

        const NS = 'http://www.w3.org/2000/svg';
        const S = (tag, attrs = {}, parent) => { const n = svg(tag, attrs); if (parent) parent.append(n); return n; };
        const T = (parent, x, y, text, cls, extra = {}) => { const n = S('text', { x, y, class: cls, ...extra }, parent); n.textContent = text; return n; };
        const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
        const ease = t => t * t * (3 - 2 * t);

        const DAYS = [
            ['Mon', 'The call', 'The director posts Thursday’s call. Every member’s phone buzzes.'],
            ['Wed', 'Rehearsal', 'Lysistrata rehearses alone. The app reads the Magistrate; she says her own lines.'],
            ['Thu', 'A quick poll', 'Costume fitting, Saturday or Sunday? The cast votes on the call board.'],
            ['Fri', 'Costumes', 'The costume designer uploads photos. Each actor finds theirs in their wardrobe.'],
            ['Sat', 'Opening night', 'Tickets sold on the web, scanned at the door. Each one admits exactly once.'],
        ];
        const WARM = '#C2603F', COOL = '#3E4A9E', LEAD = '#E3A33B', INK = '#1A1A17';
        const CAST = [
            ['Lysistrata', LEAD], ['Kalonike', WARM], ['Myrrhine', WARM], ['Lampito', WARM], ['Stratyllis', WARM], ['Ismenia', WARM],
            ['Magistrate', COOL], ['Kinesias', COOL], ['Herald', COOL], ['Drakes', COOL], ['Strymodoros', COOL], ['Prytanis', COOL],
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

        // ---- stage skeleton
        const rail = h('ol', { class: 'week-rail' }, DAYS.map(([d, t]) => h('li', {}, h('span', { class: 'week-day', text: d }), h('span', { class: 'week-title', text: t }))));
        const railFill = h('span', { class: 'week-rail-fill' });
        const caption = h('p', { class: 'week-caption', 'aria-live': 'polite' });
        const art = S('svg', { viewBox: '0 0 640 440', class: 'week-svg', role: 'img',
            'aria-label': 'Illustration: the production app on a phone, connected to fourteen members of a theatre company' });

        const links = S('g', { class: 'week-links' }, art);
        const dots = S('g', {}, art);
        // the phone
        const phone = S('g', {}, art);
        S('rect', { x: 20, y: 18, width: 212, height: 404, rx: 30, class: 'week-phone' }, phone);
        S('rect', { x: 98, y: 30, width: 56, height: 8, rx: 4, class: 'week-notch' }, phone);
        T(phone, 42, 66, 'ΛΥΣΙΣΤΡΑΤΗ · ΘΙΑΣΟΣ', 'week-kicker');
        const screenTitle = T(phone, 42, 90, '', 'week-screen-title');
        const screens = DAYS.map(() => S('g', { class: 'week-screen' }, phone));

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
        const VOTES = [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1];   // 8 Saturday · 4 Sunday

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

        root.replaceChildren(h('div', { class: 'week-head' }, rail, h('span', { class: 'week-rail-track' }, railFill)), art, caption);

        // ---- render: everything is a function of scroll progress p
        let lastDay = -1;
        function render(p) {
            const s = clamp(p) * DAYS.length;
            const day = Math.min(DAYS.length - 1, Math.floor(s));
            const t = clamp(s - day);
            railFill.style.transform = `scaleX(${clamp(p)})`;
            if (day !== lastDay) {
                [...rail.children].forEach((li, i) => li.classList.toggle('is-on', i === day));
                screenTitle.textContent = ['Call board', 'Rehearse', 'Call board', 'Wardrobe', 'Door'][day];
                caption.textContent = DAYS[day][2];
                lastDay = day;
            }
            screens.forEach((g, i) => g.style.opacity = i === day ? clamp(t / 0.08) : 0);
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
                pollRows.forEach((r, i) => { r.bar.setAttribute('width', (144 * tally[i]) / 12); r.n.textContent = String(tally[i]); });
                pollNote.textContent = `${tally[0] + tally[1]} of 12 voted`;
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
                friNote.textContent = `${got} of 12 costumes delivered`;
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
        }

        // ---- scroll wiring (same pattern as Fig. 01)
        let queued = false, near = false;
        const update = () => {
            queued = false;
            const travel = section.offsetHeight - window.innerHeight;
            render(travel > 0 ? -section.getBoundingClientRect().top / travel : 0);
        };
        const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
        new IntersectionObserver(([e]) => { near = e.isIntersecting; if (near) schedule(); }, { rootMargin: '100% 0px' }).observe(section);
        window.addEventListener('scroll', () => { if (near) schedule(); }, { passive: true });
        window.addEventListener('resize', schedule);
        render(0);
    }

    const DEMOS = { normalise: normaliseDemo, eta: etaDemo, week: weekDemo };
    document.querySelectorAll('[data-demo]').forEach(el => {
        const fn = DEMOS[el.dataset.demo];
        // a demo can decline (return false), e.g. under reduced motion, and keep its static fallback
        if (fn && fn(el.querySelector('.demo-body') || el) !== false) el.classList.add('is-live');
    });
})();
