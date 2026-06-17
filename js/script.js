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
