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
    // Aristophanes — who can do what in a production
    // `can` below is a line-for-line port of the app's
    // lib/domain/accounts/capability.dart (ADR-047). In the app it only
    // decides which buttons a member sees; the server never trusts it —
    // Postgres row-level security mirrors the same matrix and has the final
    // say. The "tampered client" switch makes that split visible.
    // ======================================================================
    const ROLES = [
        ['organizer', 'Organizer'], ['director', 'Director'], ['assistantDirector', 'Assistant director'],
        ['costume', 'Costume (ενδυματολόγος)'], ['sound', 'Sound'], ['music', 'Music'], ['cast', 'Cast'],
    ];
    const CAPS = [
        ['manageMembers', 'Add or remove members, share invites'],
        ['assignRolesAndCasting', 'Assign roles and cast parts'],
        ['editCalendar', 'Edit the rehearsal calendar'],
        ['postToBoard', 'Post to the call board'],
        ['openWardrobe', 'Open the wardrobe'],
        ['editWardrobe', 'Upload costume photos'],
        ['runBoxOffice', 'Run the box office and the door'],
        ['viewOwnRoleAndPart', 'See your own role and part'],
        ['practiceOwnPart', 'Practise your own part'],
    ];
    function can(roles, cap) {
        if (roles.has('organizer')) return true;              // superuser (A7)
        switch (cap) {
            case 'manageMembers': return false;               // organizer-only
            case 'assignRolesAndCasting': return roles.has('director');
            case 'openWardrobe':
            case 'editWardrobe': return roles.has('director') || roles.has('costume');
            case 'editCalendar':
            case 'postToBoard': return roles.has('director') || roles.has('assistantDirector');
            case 'runBoxOffice': return roles.has('director'); // canManageBoxOffice + the admit RPC
            case 'viewOwnRoleAndPart':
            case 'practiceOwnPart': return true;              // every member
        }
        return false;
    }
    const DART = `bool can(Set<ProductionRole> roles, Capability action) {
  if (roles.contains(ProductionRole.organizer)) return true;
  switch (action) {
    case Capability.manageMembers:
      return false; // organizer-only
    case Capability.assignRolesAndCasting:
      return roles.contains(ProductionRole.director);
    case Capability.openWardrobe:
    case Capability.editWardrobe:
      return roles.contains(ProductionRole.director) ||
          roles.contains(ProductionRole.costume);
    case Capability.editCalendar:
    case Capability.postToBoard:
      return roles.contains(ProductionRole.director) ||
          roles.contains(ProductionRole.assistantDirector);
    case Capability.viewOwnRoleAndPart:
    case Capability.practiceOwnPart:
      return true; // every member
  }
}`;

    function rolesDemo(root) {
        const held = new Set(['cast']);
        let tampered = false;
        const chips = ROLES.map(([key, label]) => {
            const b = h('button', { type: 'button', class: 'demo-role', text: label, 'aria-pressed': 'false',
                onclick: () => {
                    if (held.has(key) && held.size === 1) return;   // every member holds at least one role
                    held.has(key) ? held.delete(key) : held.add(key);
                    render();
                } });
            b.dataset.role = key;
            return b;
        });
        const tamper = h('button', { type: 'button', class: 'demo-btn', 'aria-pressed': 'false',
            onclick: () => { tampered = !tampered; render(); } });
        const rows = h('tbody');
        const summary = h('p', { class: 'demo-roles-summary', 'aria-live': 'polite' });

        function render() {
            chips.forEach(b => {
                const on = held.has(b.dataset.role);
                b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on));
            });
            tamper.textContent = tampered ? 'Client: tampered — every button shown' : 'Client: honest';
            tamper.setAttribute('aria-pressed', String(tampered));
            tamper.classList.toggle('is-warn', tampered);
            let allowed = 0, blocked = 0;
            rows.replaceChildren(...CAPS.map(([cap, label]) => {
                const ok = can(held, cap);
                const shown = ok || tampered;
                if (ok) allowed++;
                if (shown && !ok) blocked++;
                return h('tr', { class: ok ? 'is-ok' : shown ? 'is-blocked' : 'is-off' },
                    h('th', { scope: 'row', text: label }),
                    h('td', { class: 'demo-gate' }, h('span', { text: shown ? 'Shown' : 'Hidden' })),
                    h('td', { class: 'demo-gate' }, h('span', { text: !shown ? '—' : ok ? 'Allowed' : 'Refused by RLS' })));
            }));
            const who = ROLES.filter(([k]) => held.has(k)).map(([, l]) => l.replace(/ \(.*\)/, '')).join(' + ');
            summary.textContent = tampered && blocked
                ? `${who}: ${blocked} extra button${blocked > 1 ? 's' : ''} now visible, and the server still refuses every one.`
                : `${who}: ${allowed} of ${CAPS.length} actions.`;
        }

        root.replaceChildren(
            h('p', { class: 'demo-port-label', text: 'This member holds (a person can hold several roles)' }),
            h('div', { class: 'demo-roles' }, chips),
            h('div', { class: 'demo-grid' },
                h('div', {},
                    h('table', { class: 'demo-matrix' },
                        h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Action' }), h('th', { scope: 'col', text: 'In the app' }), h('th', { scope: 'col', text: 'On the server' }))),
                        rows),
                    h('div', { class: 'demo-controls demo-tamper' }, tamper),
                    summary),
                h('div', {},
                    h('p', { class: 'demo-port-label', text: 'The app’s permission map (Dart, pure domain)' }),
                    h('pre', { class: 'demo-code' }, h('code', { text: DART })),
                    h('p', { class: 'demo-code-note', text: 'Box-office access is a separate check (organizer or director), enforced again by the server’s admit-once function.' }))));
        render();
    }

    const DEMOS = { normalise: normaliseDemo, eta: etaDemo, roles: rolesDemo };
    document.querySelectorAll('[data-demo]').forEach(el => {
        const fn = DEMOS[el.dataset.demo];
        if (fn) { el.classList.add('is-live'); fn(el.querySelector('.demo-body') || el); }
    });
})();
