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
    // Aristophanes — ports & adapters you can swap at runtime
    // `PracticeEngine.run` is the domain: it only knows the two ports. The
    // code panel prints this exact function, so what you read is what runs.
    // ======================================================================
    const SCENE = [
        { who: 'MAGISTRATE', mine: false, text: 'The council meets at dawn. Are you ready?' },
        { who: 'YOU', mine: true, text: 'Ready as I will ever be. Give me my cue.' },
        { who: 'CHORUS', mine: false, text: 'Then speak, and let the whole city hear it.' },
        { who: 'YOU', mine: true, text: 'I will say it once, and clearly.' },
    ];
    const PracticeEngine = {
        async run(scene, { tts, store, awaitActor }) {
            const started = Date.now();
            for (const line of scene) {
                if (line.mine) await awaitActor(line);   // the actor says it, taps Done
                else await tts.speak(line.text);         // the partner reads it
            }
            await store.save({ lines: scene.length, ms: Date.now() - started });
            return store.count();
        },
    };
    const TTS = {
        voice: (log) => ({
            name: 'Device voice',
            speak: text => new Promise(resolve => {
                if (!('speechSynthesis' in window)) { log('speechSynthesis unavailable, so nothing spoken'); return resolve(); }
                const u = new SpeechSynthesisUtterance(text);
                u.rate = 1.05;
                u.onend = u.onerror = () => resolve();
                log(`TtsPort.speak → Web Speech API`);
                speechSynthesis.speak(u);
            }),
        }),
        fake: (log) => ({
            name: 'Silent fake',
            speak: text => new Promise(resolve => { log(`TtsPort.speak → fake (silent): “${text.slice(0, 28)}…”`); setTimeout(resolve, 350); }),
        }),
    };
    const STORE = {
        local: (log) => ({
            name: 'localStorage',
            async save(s) { try { const all = JSON.parse(localStorage.getItem('ar-demo-sessions') || '[]'); all.push(s); localStorage.setItem('ar-demo-sessions', JSON.stringify(all)); } catch (e) { /* storage blocked */ } log(`SessionStore.save → localStorage`); },
            async count() { try { return JSON.parse(localStorage.getItem('ar-demo-sessions') || '[]').length; } catch (e) { return 0; } },
        }),
        memory: (log, mem) => ({
            name: 'In-memory',
            async save(s) { mem.push(s); log(`SessionStore.save → in-memory array`); },
            async count() { return mem.length; },
        }),
    };

    function adaptersDemo(root) {
        const mem = [];
        const logEl = h('ol', { class: 'demo-log', 'aria-live': 'polite' });
        const log = msg => { logEl.append(h('li', { text: msg })); logEl.scrollTop = logEl.scrollHeight; };
        const choice = { tts: 'fake', store: 'memory' };
        const seg = (port, opts) => h('div', { class: 'demo-seg', role: 'radiogroup', 'aria-label': port },
            opts.map(([key, label]) => {
                const b = h('button', { type: 'button', role: 'radio', class: 'demo-seg-btn', text: label,
                    onclick: () => { choice[port] = key; sync(); } });
                b.dataset.key = key; b.dataset.port = port;
                return b;
            }));
        const ttsSeg = seg('tts', [['fake', 'Silent fake'], ['voice', 'Device voice']]);
        const storeSeg = seg('store', [['memory', 'In-memory'], ['local', 'localStorage']]);
        function sync() {
            root.querySelectorAll('.demo-seg-btn').forEach(b => {
                const on = choice[b.dataset.port] === b.dataset.key;
                b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(on));
            });
            portTts.textContent = choice.tts === 'voice' ? 'Device voice' : 'Silent fake';
            portStore.textContent = choice.store === 'local' ? 'localStorage' : 'In-memory';
        }
        const portTts = svg('text', { x: 52, y: 64, class: 'demo-adapter', 'text-anchor': 'middle' });
        const portStore = svg('text', { x: 268, y: 64, class: 'demo-adapter', 'text-anchor': 'middle' });
        const hexSvg = svg('svg', { viewBox: '0 0 320 150', class: 'demo-hex', 'aria-hidden': 'true' });
        hexSvg.append(
            svg('polygon', { points: '215,75 187.5,122 132.5,122 105,75 132.5,28 187.5,28', class: 'demo-hex-core' }),
            svg('line', { x1: 105, y1: 75, x2: 70, y2: 75, class: 'demo-hex-wire' }),
            svg('line', { x1: 215, y1: 75, x2: 250, y2: 75, class: 'demo-hex-wire' }),
            svg('rect', { x: 2, y: 46, width: 100, height: 28, class: 'demo-hex-adapter' }),
            svg('rect', { x: 218, y: 46, width: 100, height: 28, class: 'demo-hex-adapter' }),
            portTts, portStore);
        [['DOMAIN', 160, 72, 'demo-hex-title'], ['PracticeEngine', 160, 88, 'demo-hex-sub'], ['TtsPort', 52, 38, 'demo-hex-port'], ['SessionStore', 268, 38, 'demo-hex-port']]
            .forEach(([t, x, y, c]) => { const n = svg('text', { x, y, class: c, 'text-anchor': 'middle' }); n.textContent = t; hexSvg.append(n); });

        const cue = h('p', { class: 'demo-cue', 'aria-live': 'polite', text: 'Pick adapters, then run the scene.' });
        const done = h('button', { type: 'button', class: 'demo-btn demo-btn--accent', text: 'Done', disabled: '' });
        const run = h('button', { type: 'button', class: 'demo-btn demo-btn--accent', text: 'Run scene' });
        let busy = false;
        run.addEventListener('click', async () => {
            if (busy) return;
            busy = true; run.disabled = true; logEl.replaceChildren();
            const tts = TTS[choice.tts](log), store = STORE[choice.store](log, mem);
            log(`wired: TtsPort ⇐ ${tts.name}, SessionStore ⇐ ${store.name}`);
            const awaitActor = line => new Promise(resolve => {
                cue.textContent = `Your line: “${line.text}” Say it, then tap Done.`;
                done.disabled = false; done.focus();
                done.onclick = () => { done.disabled = true; done.onclick = null; log('actor tapped Done'); resolve(); };
            });
            const n = await PracticeEngine.run(SCENE, {
                tts: { speak: t => { cue.textContent = `Partner reads: “${t}”`; return tts.speak(t); } },
                store, awaitActor,
            });
            cue.textContent = `Scene complete. Sessions in ${store.name}: ${n}.`;
            log(`run() returned ${n}. Domain code unchanged.`);
            busy = false; run.disabled = false;
        });

        const src = PracticeEngine.run.toString().split('\n');
        const indent = Math.min(...src.slice(1).filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
        const code = h('pre', { class: 'demo-code' }, h('code', { text: [src[0], ...src.slice(1).map(l => l.slice(indent))].join('\n') }));
        root.replaceChildren(
            h('div', { class: 'demo-grid' },
                h('div', {},
                    hexSvg,
                    h('div', { class: 'demo-ports' },
                        h('p', { class: 'demo-port-label', text: 'TtsPort adapter' }), ttsSeg,
                        h('p', { class: 'demo-port-label', text: 'SessionStore adapter' }), storeSeg)),
                h('div', {},
                    h('p', { class: 'demo-port-label', text: 'Domain · the exact function running this demo' }), code)),
            h('div', { class: 'demo-run' }, h('div', { class: 'demo-controls' }, run, done), cue),
            logEl);
        sync();
    }

    const DEMOS = { normalise: normaliseDemo, eta: etaDemo, adapters: adaptersDemo };
    document.querySelectorAll('[data-demo]').forEach(el => {
        const fn = DEMOS[el.dataset.demo];
        if (fn) { el.classList.add('is-live'); fn(el.querySelector('.demo-body') || el); }
    });
})();
