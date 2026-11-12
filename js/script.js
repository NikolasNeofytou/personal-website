/**
 * Nikolas Neofytou — refined-technical portfolio
 */

// ==========================================
// Sidebar scroll-spy — highlight active section
// ==========================================
(function () {
    const navLinks = [...document.querySelectorAll('.side-nav .nav-link')];
    if (!navLinks.length || !('IntersectionObserver' in window)) return;

    const byId = {};
    const sections = [];
    navLinks.forEach(link => {
        const id = link.getAttribute('href').slice(1);
        const section = document.getElementById(id);
        if (section) { byId[id] = link; sections.push(section); }
    });

    const setActive = (id) => navLinks.forEach(l => l.classList.toggle('active', byId[id] === l));
    if (sections[0]) setActive(sections[0].id);

    const spy = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id); });
    }, { rootMargin: '-40% 0px -55% 0px', threshold: 0 });

    sections.forEach(s => spy.observe(s));
})();

// ==========================================
// Mini nav — below 1024px there is no sidebar: once the work at the top
// has scrolled away, a slim bar keeps the work and the contact one tap away
// ==========================================
(function () {
    const bar = document.querySelector('[data-mini-nav]');
    const top = document.querySelector('.ap');
    if (!bar || !top || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([e]) => bar.classList.toggle('is-shown', !e.isIntersecting)).observe(top);
})();

// ==========================================
// Signal trace — a PCB-style trace down the left gutter that connects the
// sections like pads on a board. Routed from live element positions (so
// it follows layout changes), drawn up to ~55% of the viewport as you
// scroll; each section's via lights as the signal reaches it, and the
// route terminates in a ground symbol at the footer.
// ==========================================
(function () {
    const main = document.querySelector('.main');
    const sidebar = document.querySelector('.sidebar');
    if (!main || !sidebar || !('ResizeObserver' in window)) return;

    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, parent) => {
        const n = document.createElementNS(NS, tag);
        for (const k in attrs) n.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(n);
        return n;
    };
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const desktop = window.matchMedia('(min-width: 1024px)');

    const svg = el('svg', { class: 'trace', 'aria-hidden': 'true', focusable: 'false' });
    main.prepend(svg);

    let total = 0, samples = [], nodes = [], gnd = null, tip = null, glow = null, live = null;
    let queued = false, building = false;

    // things the trace connects to, top to bottom; the footer is the ground
    function anchors() {
        return [...main.querySelectorAll('.section-head, .cs-hero')]
            .filter(n => n.getClientRects().length)
            .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    }

    function build() {
        building = false;
        const m = main.getBoundingClientRect();
        // gutter = gap to the sidebar on desktop, the page padding on phones
        const gutter = desktop.matches ? m.left - sidebar.getBoundingClientRect().right : m.left;
        if (gutter < 16) { svg.style.display = 'none'; return; }
        svg.style.display = '';

        const x = Math.round(gutter / 2) + 0.5;
        const jog = Math.max(4, Math.round(gutter / 8));
        const ys = anchors().map(a => {
            const r = a.getBoundingClientRect();
            // headings: their middle; a case study's cover: just inside its top
            return Math.round((a.classList.contains('section-head') ? r.top + r.height / 2 : r.top + 24) - m.top) + 0.5;
        });
        const footer = main.querySelector('.site-footer');
        const yEnd = Math.round((footer ? footer.getBoundingClientRect().top : m.bottom - 40) - m.top) + 0.5;
        if (!ys.length) return;

        svg.setAttribute('width', gutter);
        svg.setAttribute('height', m.height);
        svg.style.left = `${-gutter}px`;
        svg.replaceChildren();

        // route: straight down between pads, with a 45° jog in each run
        let d = `M${x},${ys[0]}`;
        const stops = [...ys, yEnd];
        for (let i = 1; i < stops.length; i++) {
            const y0 = stops[i - 1], y1 = stops[i], gap = y1 - y0;
            const j = (i % 2 ? jog : -jog);
            if (gap > jog * 8) {
                const a = y0 + gap * 0.3, b = y0 + gap * 0.7;
                d += ` L${x},${a} L${x + j},${a + Math.abs(j)} L${x + j},${b} L${x},${b + Math.abs(j)}`;
            }
            d += ` L${x},${y1}`;
        }
        el('path', { class: 'trace-base', d }, svg);
        live = el('path', { class: 'trace-live', d }, svg);
        total = live.getTotalLength();
        live.style.strokeDasharray = `${total} ${total}`;

        // length ↔ y lookup (the route only ever moves down)
        samples = [];
        for (let len = 0; len <= total; len += 6) samples.push([len, live.getPointAtLength(len).y]);
        samples.push([total, live.getPointAtLength(total).y]);

        nodes = ys.map(y => {
            const g = el('g', { class: 'trace-node' }, svg);
            el('path', { class: 'trace-stub', d: `M${x},${y} H${gutter - 10}` }, g);
            el('rect', { class: 'trace-pad', x: gutter - 10, y: y - 3, width: 6, height: 6 }, g);
            el('circle', { class: 'trace-ring', cx: x, cy: y, r: 4 }, g);
            el('circle', { class: 'trace-via', cx: x, cy: y, r: 4 }, g);
            return { g, len: lengthAt(y) };
        });

        gnd = el('path', { class: 'trace-gnd',
            d: `M${x - 8},${yEnd} H${x + 8} M${x - 5},${yEnd + 4} H${x + 5} M${x - 2},${yEnd + 8} H${x + 2}` }, svg);
        glow = el('circle', { class: 'trace-glow', r: 7 }, svg);
        tip = el('circle', { class: 'trace-tip', r: 2.5 }, svg);

        if (reduceMotion) {
            svg.classList.add('is-static', 'is-done');
            live.style.strokeDashoffset = 0;
            nodes.forEach(n => n.g.classList.add('is-lit'));
            return;
        }
        update();
    }

    function lengthAt(y) {
        let lo = 0, hi = samples.length - 1;
        if (y <= samples[0][1]) return 0;
        if (y >= samples[hi][1]) return total;
        while (hi - lo > 1) {
            const mid = (lo + hi) >> 1;
            if (samples[mid][1] < y) lo = mid; else hi = mid;
        }
        const [l0, y0] = samples[lo], [l1, y1] = samples[hi];
        return y1 === y0 ? l1 : l0 + (l1 - l0) * (y - y0) / (y1 - y0);
    }

    function update() {
        queued = false;
        if (!live || reduceMotion) return;
        const top = main.getBoundingClientRect().top;
        const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2;
        const drawn = atBottom ? total : lengthAt(window.innerHeight * 0.55 - top);

        live.style.strokeDashoffset = total - drawn;
        const p = live.getPointAtLength(drawn);
        tip.setAttribute('cx', p.x); tip.setAttribute('cy', p.y);
        glow.setAttribute('cx', p.x); glow.setAttribute('cy', p.y);
        const showTip = drawn > 0 && drawn < total;
        tip.style.opacity = glow.style.opacity = showTip ? '' : 0;
        nodes.forEach(n => n.g.classList.toggle('is-lit', drawn >= n.len - 1));
        svg.classList.toggle('is-done', drawn >= total - 1);
    }

    const schedule = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
    const rebuild = () => { if (!building) { building = true; requestAnimationFrame(build); } };

    new ResizeObserver(rebuild).observe(main);
    window.addEventListener('resize', rebuild);
    window.addEventListener('scroll', schedule, { passive: true });
    if (document.fonts) document.fonts.ready.then(rebuild);
    rebuild();
})();

// ==========================================
// Back to top
// ==========================================
(function () {
    const btn = document.getElementById('backToTop');
    if (!btn) return;
    window.addEventListener('scroll', () => {
        btn.classList.toggle('visible', window.pageYOffset > 500);
    }, { passive: true });
    btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

// ==========================================
// Writing — latest Substack posts from assets/substack.json, a same-origin
// snapshot kept fresh by .github/workflows/substack-feed.yml (no runtime
// third-party proxy). Built with DOM nodes, so feed text is never parsed
// as HTML.
// ==========================================
(function () {
    const container = document.getElementById('substackPosts');
    if (!container) return;

    const fallback = () => {
        container.innerHTML = '<div class="writing-placeholder">Visit my Substack for essays on philosophy, history, and more.</div>';
    };
    const make = (tag, cls, text) => {
        const n = document.createElement(tag);
        n.className = cls;
        if (text) n.textContent = text;
        return n;
    };

    fetch('assets/substack.json')
        .then(res => { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(({ posts }) => {
            if (!posts || !posts.length) throw new Error('no posts');
            container.replaceChildren(...posts.map(post => {
                const card = make('a', 'writing-card');
                card.href = post.link;
                card.target = '_blank';
                card.rel = 'noopener noreferrer';
                const date = new Date(post.date + 'T12:00:00Z')
                    .toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                card.append(make('div', 'writing-date', date), make('h3', 'writing-title', post.title));
                if (post.excerpt) card.append(make('p', 'writing-excerpt', post.excerpt));
                return card;
            }));
        })
        .catch(fallback);
})();

// ==========================================
// Bookshelf — the spines are tabs; picking one takes its book off the
// shelf (plate, cover, a line on it). Without JS every book is listed.
// Each painting has a seamless loop over its still: only the open book's
// plays, only on screen, and only when motion and data are welcome.
// ==========================================
(function () {
    const shelf = document.querySelector('[data-shelf]');
    if (!shelf) return;
    const spines = [...shelf.querySelectorAll('.spine')];
    const panels = spines.map(s => document.getElementById(s.getAttribute('aria-controls')));
    if (!spines.length || panels.includes(null)) return;

    // Hidden lazy images never load; fetch a book's images on intent.
    const warm = i => panels[i].querySelectorAll('img').forEach(img => { img.loading = 'eager'; });

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    const live = !reduceMotion && !saveData && 'IntersectionObserver' in window;
    const loops = panels.map(p => p.querySelector('.book-loop'));
    let current = 0;
    let onScreen = false;

    // The loop's first frame is the still, so fading it in once it plays is seamless.
    loops.forEach(v => v && v.addEventListener('playing', () => v.classList.add('is-playing')));

    function playCurrent() {
        loops.forEach((v, k) => {
            if (!v) return;
            if (live && onScreen && k === current && !panels[k].querySelector('.is-focused')) {
                v.preload = 'auto';
                v.play().catch(() => {});
            } else if (!v.paused) {
                v.pause();
            }
        });
    }

    function select(i, focus) {
        const prev = current;
        current = i;
        spines.forEach((s, k) => {
            const on = k === i;
            s.setAttribute('aria-selected', on ? 'true' : 'false');
            s.tabIndex = on ? 0 : -1;
            panels[k].hidden = !on;
        });
        if (prev !== i) {
            panels[prev].dispatchEvent(new CustomEvent('book:hide'));
            if (loops[prev]) {
                loops[prev].pause();
                loops[prev].classList.remove('is-playing');
                loops[prev].currentTime = 0;
            }
        }
        if (focus) spines[i].focus();
        playCurrent();
    }

    // Watch the open book's painting, not the whole shelf: with five shelves
    // the shelf is taller than a phone screen and would never be 25% visible.
    const plates = panels.map(p => p.querySelector('.book-plate') || p);
    if (live) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.target === plates[current]) onScreen = e.isIntersecting; });
            playCurrent();
        }, { threshold: 0.25 });
        plates.forEach(p => io.observe(p));
    }

    // A book opened from an upper shelf can land below the fold: bring it into
    // view (on click only, so arrow keys along the shelf never jump the page).
    function reveal(i) {
        const r = panels[i].getBoundingClientRect();
        if (r.top > innerHeight * 0.6 || r.bottom < 0) {
            panels[i].scrollIntoView({ block: 'start', behavior: reduceMotion ? 'auto' : 'smooth' });
        }
    }
    // A chapter tour back at its whole painting hands motion back to the loop.
    shelf.addEventListener('tour:overview', playCurrent);

    spines.forEach((s, i) => {
        s.addEventListener('click', () => { select(i); reveal(i); });
        s.addEventListener('pointerenter', () => warm(i));
        s.addEventListener('focus', () => warm(i));
    });

    // Arrows wrap; Home / End jump to the ends of the shelf.
    shelf.querySelector('[role="tablist"]').addEventListener('keydown', (e) => {
        const cur = spines.indexOf(document.activeElement);
        const n = spines.length;
        const map = { ArrowRight: cur + 1, ArrowLeft: cur - 1, Home: 0, End: n - 1 };
        if (cur < 0 || !(e.key in map)) return;
        e.preventDefault();
        const i = (map[e.key] + n) % n;
        warm(i);
        select(i, true);
    });

    shelf.classList.add('is-ready');
    select(0);
})();

// ==========================================
// Chapter tour — a book whose plate is one panorama with a region per
// chapter (data-focus="x% y% zoom"). Picking a chapter moves the camera
// there and the full-resolution still carries the close-up; once the
// camera arrives, the chapter's own loop (data-loop) fades in over it.
// "Whole painting" or Escape glides back. Reduced motion jumps instead,
// and like Save-Data it keeps every close-up still.
// ==========================================
(function () {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    const live = !reduceMotion && !saveData && 'IntersectionObserver' in window;
    const ext = document.createElement('video').canPlayType('video/webm; codecs="vp9"') ? '.webm' : '.mp4';
    const ARRIVE_MS = 1400;   // the camera's glide (.plate-view transition)

    document.querySelectorAll('[data-tour]').forEach(plate => {
        const panel = plate.closest('.book-panel');
        const view = plate.querySelector('.plate-view');
        const still = plate.querySelector('.plate-still');
        const loop = plate.querySelector('.book-loop');
        const buttons = [...panel.querySelectorAll('.chapter')];
        const whole = buttons.find(b => !b.dataset.focus);
        const name = panel.querySelector('.book-fig-name');
        const note = panel.querySelector('.chapter-note');
        const overview = name.textContent;
        const hint = 'Pick a chapter and the painting moves to it.';
        const closeUp = plate.querySelector('.chapter-loop');
        let arrival = 0;
        let onScreen = true;

        function stopCloseUp() {
            clearTimeout(arrival);
            if (!closeUp) return;
            closeUp.classList.remove('is-playing');
            closeUp.pause();
        }
        function startCloseUp(btn) {
            if (!live || !closeUp || !btn.dataset.loop) return;
            const src = btn.dataset.loop + ext;
            arrival = setTimeout(() => {
                if (closeUp.dataset.src !== src) {
                    closeUp.src = src;
                    closeUp.dataset.src = src;
                }
                closeUp.currentTime = 0;
                if (onScreen) closeUp.play().catch(() => {});
            }, ARRIVE_MS);
        }
        if (live && closeUp) {
            closeUp.addEventListener('playing', () => closeUp.classList.add('is-playing'));
            new IntersectionObserver(([e]) => {
                onScreen = e.isIntersecting;
                if (!closeUp.classList.contains('is-playing')) return;
                if (onScreen) closeUp.play().catch(() => {});
                else closeUp.pause();
            }, { threshold: 0.25 }).observe(plate);
        }

        function show(btn) {
            if (btn !== whole && btn.getAttribute('aria-pressed') === 'true') return;
            stopCloseUp();
            buttons.forEach(b => b.setAttribute('aria-pressed', b === btn ? 'true' : 'false'));
            note.classList.toggle('is-hint', btn === whole);
            if (btn === whole) {
                view.style.transform = '';
                // hold the loop back until the camera has settled on the whole painting
                if (plate.classList.contains('is-focused')) {
                    plate.classList.add('is-returning');
                    clearTimeout(plate._returning);
                    plate._returning = setTimeout(() => plate.classList.remove('is-returning'), 2000);
                }
                plate.classList.remove('is-focused');
                name.textContent = overview;
                note.textContent = hint;
                panel.dispatchEvent(new CustomEvent('tour:overview', { bubbles: true }));
                return;
            }
            const [fx, fy, zoom] = btn.dataset.focus.split(' ').map(Number);
            // Put the chapter's point at the centre, without showing past the edges.
            const edge = v => Math.min(0, Math.max(100 - 100 * zoom, v));
            // Ask for a source sharp enough for the close-up before the camera arrives.
            still.sizes = Math.round(plate.clientWidth * zoom) + 'px';
            plate.classList.add('is-focused');
            if (loop) loop.pause();
            view.style.transform = `translate(${edge(50 - zoom * fx)}%, ${edge(50 - zoom * fy)}%) scale(${zoom})`;
            name.textContent = btn.lastChild.textContent;
            note.textContent = btn.dataset.label ? `${btn.dataset.label}. ${btn.dataset.note}` : btn.dataset.note;
            startCloseUp(btn);
        }

        buttons.forEach(b => b.addEventListener('click', () => show(b)));
        panel.addEventListener('keydown', e => {
            if (e.key === 'Escape' && plate.classList.contains('is-focused')) show(whole);
        });
        panel.addEventListener('book:hide', () => show(whole));
        note.textContent = hint;
        note.classList.add('is-hint');
    });
})();

// ==========================================
// Copy the email address — an email link opens a mail app many people never
// set up, so copying the address is the way round it. The buttons stay
// hidden without the Clipboard API.
// ==========================================
(function () {
    const buttons = [...document.querySelectorAll('[data-copy]')];
    if (!buttons.length || !navigator.clipboard || !window.isSecureContext) return;
    const status = document.createElement('p');
    status.className = 'copy-status';
    status.setAttribute('role', 'status');
    document.body.append(status);
    buttons.forEach(btn => {
        const label = btn.textContent;
        btn.hidden = false;
        btn.addEventListener('click', async () => {
            let done = true;
            try { await navigator.clipboard.writeText(btn.dataset.copy); } catch (e) { done = false; }
            btn.textContent = done ? 'Copied' : 'Couldn’t copy';
            status.textContent = done ? `Copied ${btn.dataset.copy}` : '';
            clearTimeout(btn.reset);
            btn.reset = setTimeout(() => { btn.textContent = label; }, 2000);
        });
    });
})();

// ==========================================
// Recorded loops — a card's first screen is a still; its recorded loop
// is fetched only when the screen comes near the viewport,
// plays only while the frame is on screen, and is never loaded under
// reduced motion or Save-Data (the still stands, as it does without JS).
// ==========================================
(function () {
    const loops = [...document.querySelectorAll('.ap-loop[data-mp4]')];
    if (!loops.length) return;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    if (reduceMotion || saveData || !('IntersectionObserver' in window)) return;

    // The loop's first frame is the still, so fading it in once it plays is seamless.
    const arm = (v) => {
        if (v.dataset.armed) return;
        v.dataset.armed = '1';
        [['webm', 'video/webm'], ['mp4', 'video/mp4']].forEach(([k, type]) => {
            if (!v.dataset[k]) return;
            const s = document.createElement('source');
            s.src = v.dataset[k];
            s.type = type;
            v.appendChild(s);
        });
        v.addEventListener('playing', () => v.classList.add('is-playing'), { once: true });
        v.load();
    };

    const io = new IntersectionObserver((entries) => {
        entries.forEach(e => {
            const v = e.target;
            if (e.isIntersecting) {
                arm(v);
                v.play().catch(() => {});
            } else if (!v.paused) {
                v.pause();
            }
        });
    }, { rootMargin: '0px 0px 15% 0px', threshold: 0.2 });
    loops.forEach(v => io.observe(v));
})();

// ==========================================
// Work, icons first — once the six icons have passed under the top of the
// screen, a bar of the same icons slides down and marks the card you are on.
// It leaves again after the last card. Without JS there is no bar: the icons
// are links to the cards.
// ==========================================
(function () {
    const bar = document.querySelector('[data-ap-bar]');
    const icons = document.querySelector('.ap-icons');
    const work = document.querySelector('.ap-work');
    if (!bar || !icons || !work || !('IntersectionObserver' in window)) return;

    let iconsGone = false, inWork = false;
    const update = () => bar.classList.toggle('is-shown', iconsGone && inWork);
    new IntersectionObserver(([e]) => {
        iconsGone = !e.isIntersecting && e.boundingClientRect.top < 0;
        update();
    }, { rootMargin: '-72px 0px 0px 0px' }).observe(icons);
    new IntersectionObserver(([e]) => { inWork = e.isIntersecting; update(); }).observe(work);

    // mark the card in view; chips for projects without a card link to the case study
    const chips = [...bar.querySelectorAll('.ap-chip')];
    const cards = [...work.querySelectorAll('.ap-card')];
    const row = bar.querySelector('.ap-chips');
    const mark = (id) => chips.forEach(c => {
        const on = c.getAttribute('href') === '#' + id;
        c.classList.toggle('is-on', on);
        if (!on) { c.removeAttribute('aria-current'); return; }
        c.setAttribute('aria-current', 'true');
        // on a phone the chips scroll sideways: keep the marked one in view
        if (row.scrollWidth > row.clientWidth) {
            const left = c.offsetLeft - (row.clientWidth - c.offsetWidth) / 2;
            row.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
        }
    });
    const spy = new IntersectionObserver((entries) => {
        entries.forEach(e => { if (e.isIntersecting) mark(e.target.id); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    cards.forEach(c => spy.observe(c));
    if (cards[0]) mark(cards[0].id);
})();
