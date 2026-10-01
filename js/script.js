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
// Hero loop — reveal once the poster exists; only play when motion
// and data are welcome, and only while on screen
// ==========================================
(function () {
    const fig = document.getElementById('heroLoop');
    const video = fig && fig.querySelector('video');
    if (!video) return;

    const poster = new Image();
    poster.onload = () => {
        video.poster = poster.src;
        fig.hidden = false;

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const saveData = navigator.connection && navigator.connection.saveData;
        if (reduceMotion || saveData || !('IntersectionObserver' in window)) return;

        video.preload = 'auto';
        new IntersectionObserver((entries) => {
            entries.forEach(e => {
                if (e.isIntersecting) video.play().catch(() => {});
                else video.pause();
            });
        }, { threshold: 0.25 }).observe(video);
    };
    poster.src = video.dataset.poster;
})();

// ==========================================
// Fig. 01 scrub — scroll position picks a frame of the bench → silicon
// push-in and draws it to a pinned canvas (Apple-style image sequence).
// Frames load coarse-to-fine; until a frame arrives the nearest loaded one
// is drawn. Without motion/data consent the section stays a static figure.
// ==========================================
(function () {
    const sec = document.getElementById('signal');
    if (!sec) return;
    const canvas = sec.querySelector('.scrub-canvas');
    const ctx = canvas && canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const saveData = navigator.connection && navigator.connection.saveData;
    if (!ctx || reduceMotion || saveData || !('IntersectionObserver' in window)) return;

    const count = parseInt(sec.dataset.frames, 10);
    const small = window.matchMedia('(max-width: 809px)').matches;
    const dir = small ? sec.dataset.srcSmall : sec.dataset.src;
    const url = i => `${dir}/${String(i + 1).padStart(3, '0')}.webp`;
    const frames = new Array(count);
    const steps = [...sec.querySelectorAll('.scrub-step')];
    const fill = sec.querySelector('.scrub-fill');

    let target = 0, drawn = null, queued = false, loading = false;

    sec.classList.add('is-live', 'is-waiting');

    function load(i) {
        if (frames[i]) return;
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { img.ready = true; schedule(); };
        img.src = url(i);
        frames[i] = img;
    }

    // every 16th frame first, then fill in at 8, 4, 2, 1 — any scroll
    // position has a close-enough frame early on
    function loadAll() {
        if (loading) return;
        loading = true;
        load(0);
        for (const stride of [16, 8, 4, 2, 1]) {
            for (let i = 0; i < count; i += stride) load(i);
        }
    }

    function nearest(i) {
        for (let d = 0; d < count; d++) {
            const a = frames[i - d], b = frames[i + d];
            if (a && a.ready) return a;
            if (b && b.ready) return b;
        }
        return null;
    }

    function size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(canvas.clientWidth * dpr);
        canvas.height = Math.round(canvas.clientHeight * dpr);
        drawn = null;
    }

    function update() {
        queued = false;
        const travel = sec.offsetHeight - window.innerHeight;
        const p = Math.min(Math.max(-sec.getBoundingClientRect().top / travel, 0), 1);
        target = Math.round(p * (count - 1));

        const img = nearest(target);
        if (img && img !== drawn) {
            // cover-fit: the stage is taller than 16:9, so crop the sides
            const k = Math.max(canvas.width / img.naturalWidth, canvas.height / img.naturalHeight);
            const w = img.naturalWidth * k, h = img.naturalHeight * k;
            ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
            drawn = img;
            sec.classList.remove('is-waiting');
        }
        steps.forEach(s => s.classList.toggle('is-on', p >= +s.dataset.from && p < +s.dataset.to));
        if (fill) fill.style.transform = `scaleX(${p})`;
    }

    function schedule() {
        if (!queued) { queued = true; requestAnimationFrame(update); }
    }

    let near = false;
    new IntersectionObserver((entries) => {
        near = entries[0].isIntersecting;
        if (near) { loadAll(); schedule(); }
    }, { rootMargin: '200% 0px' }).observe(sec);

    window.addEventListener('scroll', () => { if (near) schedule(); }, { passive: true });
    window.addEventListener('resize', () => { size(); schedule(); });
    size();
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
// Substack RSS feed (Writing)
// ==========================================
(function () {
    const container = document.getElementById('substackPosts');
    if (!container) return;

    const RSS_URL = 'https://nikolasneofytou.substack.com/feed';
    const PROXY_URL = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(RSS_URL);

    fetch(PROXY_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'ok' || !data.items || !data.items.length) throw new Error('no posts');
            container.innerHTML = data.items.slice(0, 5).map(post => {
                const date = new Date(post.pubDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                const desc = post.description.replace(/<[^>]*>/g, '').trim().substring(0, 140).trim() + '…';
                return `
                    <a href="${post.link}" class="writing-card" target="_blank" rel="noopener noreferrer">
                        <div class="writing-date">${date}</div>
                        <h3 class="writing-title">${post.title}</h3>
                        <p class="writing-excerpt">${desc}</p>
                    </a>`;
            }).join('');
        })
        .catch(() => {
            container.innerHTML = `<div class="writing-placeholder">Visit my Substack for essays on philosophy, history, and more.</div>`;
        });
})();

// ==========================================
// Photography lightbox (grid → click → EXIF readout)
// ==========================================
(function () {
    const lightbox = document.getElementById('photoLightbox');
    const items = [...document.querySelectorAll('.photo-item')];
    if (!lightbox || !items.length) return;

    const imgEl = document.getElementById('photoLightboxImg');
    const closeBtn = document.getElementById('photoLightboxClose');
    const prevBtn = document.getElementById('photoPrev');
    const nextBtn = document.getElementById('photoNext');
    const fields = {
        camera: document.getElementById('exifCamera'),
        lens: document.getElementById('exifLens'),
        focal: document.getElementById('exifFocal'),
        aperture: document.getElementById('exifAperture'),
        shutter: document.getElementById('exifShutter'),
        iso: document.getElementById('exifIso'),
        date: document.getElementById('exifDate')
    };
    let current = 0;
    let lastFocused = null;

    function render(i) {
        current = (i + items.length) % items.length;
        const d = items[current].dataset;
        imgEl.src = d.full;
        imgEl.alt = d.title || 'Photograph by Nikolas Neofytou';
        Object.keys(fields).forEach(k => { if (fields[k]) fields[k].textContent = d[k] || '—'; });
    }
    function open(i) {
        lastFocused = document.activeElement;
        render(i);
        lightbox.classList.add('open');
        document.body.style.overflow = 'hidden';
        closeBtn.focus();
    }
    function close() {
        lightbox.classList.remove('open');
        document.body.style.overflow = '';
        if (lastFocused) lastFocused.focus();
    }

    items.forEach((el, i) => el.addEventListener('click', () => open(i)));
    closeBtn.addEventListener('click', close);
    if (prevBtn) prevBtn.addEventListener('click', () => render(current - 1));
    if (nextBtn) nextBtn.addEventListener('click', () => render(current + 1));
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) close(); });
    document.addEventListener('keydown', (e) => {
        if (!lightbox.classList.contains('open')) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') render(current - 1);
        else if (e.key === 'ArrowRight') render(current + 1);
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
