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
// Mini nav — below 1024px there is no sidebar: once the landing has
// scrolled away, a slim bar keeps the work and the contact one tap away
// ==========================================
(function () {
    const bar = document.querySelector('[data-mini-nav]');
    const landing = document.querySelector('.landing');
    if (!bar || !landing || !('IntersectionObserver' in window)) return;
    new IntersectionObserver(([e]) => bar.classList.toggle('is-shown', !e.isIntersecting)).observe(landing);
})();

// ==========================================
// Landing town — one painting, six places. The tabs and the pins glide a
// camera to a place and open its placard; "Whole town" (or Escape, or a
// click on the painting) pulls back. Without JS the tabs stay plain links
// to the case studies and the painting shows whole.
// ==========================================
(function () {
    const town = document.querySelector('[data-town]');
    if (!town) return;
    const view = town.querySelector('.town-view');
    const cam = town.querySelector('.town-cam');
    const img = town.querySelector('.town-img');
    const cards = town.querySelector('.town-cards');
    const pins = [...town.querySelectorAll('.town-pin')];
    const tabs = [...town.querySelectorAll('.town-tab')];        // the six places, then the whole town
    const panels = tabs.map(t => document.getElementById(t.dataset.panel));
    const ALL = tabs.length - 1;
    if (!pins.length || pins.length !== ALL || panels.some(p => !p)) return;

    const IW = +img.getAttribute('width'), IH = +img.getAttribute('height');
    const at = pins.map(p => p.dataset.at.split(' ').map(Number));          // % of the painting
    const focus = pins.map(p => p.dataset.focus.split(' ').map(Number));   // centre (%) and zoom
    const phone = matchMedia('(max-width: 760px)');
    const saveData = navigator.connection && navigator.connection.saveData;
    let current = ALL;
    let sharp = false;

    const list = town.querySelector('.town-tabs');
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Places in the town');
    tabs.forEach((t, i) => {
        t.setAttribute('role', 'tab');
        t.setAttribute('aria-controls', panels[i].id);
        panels[i].setAttribute('role', 'tabpanel');
        panels[i].setAttribute('aria-labelledby', t.id);
    });
    tabs[ALL].hidden = false;   // last in the row, so showing it moves nothing

    // The painting is laid out at cover size and moved with one transform;
    // the pins follow in screen space, so they never scale.
    function frame(cx, cy, z, whole) {
        const vw = view.clientWidth, vh = view.clientHeight;
        const s = Math.max(vw / IW, vh / IH);
        const w = IW * s, h = IH * s, W = w * z, H = h * z;
        let tx, ty;
        if (whole) { tx = (vw - W) * cx; ty = (vh - H) * cy; }            // = object-position: going live doesn't jump
        else { tx = vw * 0.5 - cx * W; ty = vh * 0.56 - cy * H; }
        tx = Math.min(0, Math.max(vw - W, tx));
        ty = Math.min(0, Math.max(vh - H, ty));
        cam.style.width = w + 'px';
        cam.style.height = h + 'px';
        cam.style.transform = `translate(${tx}px, ${ty}px) scale(${z})`;
        pins.forEach((p, i) => {
            const x = tx + at[i][0] / 100 * W, y = ty + at[i][1] / 100 * H;
            p.style.transform = `translate(${x}px, ${y}px)`;
            p.classList.toggle('is-off', x < 8 || x > vw - 8 || y < 8 || y > vh - 8);
            p.classList.toggle('is-flip', x > vw - p.lastElementChild.offsetWidth - 32);
        });
        return W;
    }

    function select(k, focusTab) {
        current = k;
        tabs.forEach((t, j) => {
            const on = j === k;
            t.setAttribute('aria-selected', String(on));
            t.tabIndex = on ? 0 : -1;
            panels[j].hidden = !on;
        });
        pins.forEach((p, i) => p.classList.toggle('is-on', i === k));
        town.classList.toggle('is-zoomed', k !== ALL);
        if (k === ALL) {
            const pos = getComputedStyle(img).objectPosition.split(' ').map(v => parseFloat(v) / 100);
            frame(pos[0], pos[1], 1, true);
        } else {
            const [fx, fy, z] = focus[k];
            const W = frame(fx / 100, fy / 100, phone.matches ? z * 0.75 : z, false);
            cards.classList.toggle('is-left', fx > 60);
            // close up, the screen-sized source goes soft: let srcset pick a bigger one
            // (phones stop at the 5120 copy rather than decode 25 megapixels)
            if (!sharp && !saveData) {
                sharp = true;
                const px = phone.matches ? Math.min(W, 5120 / devicePixelRatio) : W;
                cam.querySelectorAll('source, img').forEach(el => { el.sizes = Math.ceil(px) + 'px'; });
            }
        }
        // on phones the row scrolls: keep the picked tab in it
        const t = tabs[k];
        if (list.scrollWidth > list.clientWidth) {
            const r = t.getBoundingClientRect(), lr = list.getBoundingClientRect();
            list.scrollTo({ left: list.scrollLeft + r.left - lr.left - (lr.width - r.width) / 2 });
        }
        if (focusTab) t.focus();
    }

    // reposition without the glide (first paint, resize)
    function settle() {
        town.classList.add('is-still');
        select(current);
        requestAnimationFrame(() => requestAnimationFrame(() => town.classList.remove('is-still')));
    }

    const plain = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;   // open-in-new-tab still works
    tabs.forEach((t, i) => {
        t.addEventListener('click', (e) => {
            if (plain(e)) return;
            e.preventDefault();
            select(i);
        });
        t.addEventListener('keydown', (e) => {
            const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: ALL }[e.key];
            if (to === undefined) return;
            e.preventDefault();
            select((to + tabs.length) % tabs.length, true);
        });
    });
    pins.forEach((p, i) => p.addEventListener('click', (e) => {
        if (plain(e) || current === i) return;     // a second click on the picked place opens its case study
        e.preventDefault();
        e.stopPropagation();
        select(i);
    }));
    view.addEventListener('click', (e) => {
        if (current !== ALL && !e.target.closest('.town-pin')) select(ALL);
    });
    town.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && current !== ALL) select(ALL, town.contains(document.activeElement));
    });

    town.classList.add('is-live');
    settle();
    new ResizeObserver(settle).observe(view);
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
// Selected work — horizontal snap gallery
// (Apple-style scroll-container + paddlenav)
// ==========================================
(function () {
    const track = document.getElementById('caseTrack');
    if (!track) return;
    const cards = [...track.querySelectorAll('.case')];
    if (cards.length < 2) return;

    const prevBtn = document.getElementById('casePrev');
    const nextBtn = document.getElementById('caseNext');
    const indexEl = document.getElementById('caseIndex');
    const totalEl = document.getElementById('caseTotal');
    const fill = document.getElementById('caseProgressFill');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const pad2 = n => String(n).padStart(2, '0');
    if (totalEl) totalEl.textContent = pad2(cards.length);
    if (fill) fill.style.width = (100 / cards.length) + '%';

    // Left edge of the snapport (scroll-padding-left), so card positions line up with it.
    const snapPadLeft = () => parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    // Where a card sits when snapped to the start edge.
    const targetFor = i => cards[i].offsetLeft - snapPadLeft();

    let current = 0;

    function nearestIndex() {
        const x = track.scrollLeft;
        let best = 0, bestD = Infinity;
        cards.forEach((_, i) => {
            const d = Math.abs(targetFor(i) - x);
            if (d < bestD) { bestD = d; best = i; }
        });
        // At the far right the last card may not reach the start edge — treat max scroll as "last".
        if (track.scrollLeft >= track.scrollWidth - track.clientWidth - 2) best = cards.length - 1;
        return best;
    }

    function setDisabled(btn, v) {
        if (!btn) return;
        btn.setAttribute('aria-disabled', v ? 'true' : 'false');
        btn.tabIndex = v ? -1 : 0;
    }

    function render(i) {
        current = i;
        cards.forEach((c, k) => c.classList.toggle('is-active', k === i));
        if (indexEl) indexEl.textContent = pad2(i + 1);
        if (fill) fill.style.transform = `translateX(${i * 100}%)`;
        setDisabled(prevBtn, i === 0);
        setDisabled(nextBtn, i === cards.length - 1);
    }

    function goTo(i) {
        i = Math.max(0, Math.min(cards.length - 1, i));
        track.scrollTo({ left: targetFor(i), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
        render(i);
    }

    // Track native scrolling (trackpad / touch / scrollbar) with rAF throttling.
    let ticking = false;
    track.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            const i = nearestIndex();
            if (i !== current) render(i);
        });
    }, { passive: true });

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(current + 1));

    // Keyboard: arrows / Home / End while the track has focus.
    track.addEventListener('keydown', (e) => {
        const map = { ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: cards.length - 1 };
        if (!(e.key in map)) return;
        e.preventDefault();
        goTo(map[e.key]);
    });

    // Keep the snapped card aligned when the column width changes.
    let resizeTimer;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => track.scrollTo({ left: targetFor(current), behavior: 'auto' }), 120);
    });

    render(0);
})();
