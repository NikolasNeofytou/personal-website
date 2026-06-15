/**
 * Nikolas Neofytou — Portfolio
 * Minimal, clean JavaScript
 */

// ==========================================
// Mobile Navigation
// ==========================================
const mobileMenuToggle = document.getElementById('mobileMenuToggle');
const navMenu = document.getElementById('navMenu');

if (mobileMenuToggle && navMenu) {
    mobileMenuToggle.addEventListener('click', () => {
        const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
        navMenu.classList.toggle('active');
        mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
    });

    // Close on link click
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            navMenu.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        });
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
            navMenu.classList.remove('active');
            mobileMenuToggle.setAttribute('aria-expanded', 'false');
        }
    });
}

// ==========================================
// Smooth Scrolling
// ==========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            const offset = target.offsetTop - 70;
            window.scrollTo({ top: offset, behavior: 'smooth' });
        }
    });
});

// ==========================================
// Back to Top Button
// ==========================================
const backToTop = document.getElementById('backToTop');

if (backToTop) {
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 400) {
            backToTop.classList.add('visible');
        } else {
            backToTop.classList.remove('visible');
        }
    });

    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

// ==========================================
// Intersection Observer — fade-in on scroll
// (with accessibility + no-scroll failsafes so content is never trapped invisible)
// ==========================================
const revealTargets = document.querySelectorAll('.section, .project-card, .skill-category, .lab-card, .timeline-item, .contact-item');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const revealAll = () => revealTargets.forEach(el => el.classList.add('visible'));

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
    // No animation: show everything immediately, never hide it.
    revealAll();
} else {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    revealTargets.forEach(el => {
        el.classList.add('fade-in');
        observer.observe(el);
    });

    // Failsafe: if the observer hasn't revealed everything within 2s
    // (slow JS, no scroll event, full-page/headless capture), force it.
    window.setTimeout(revealAll, 2000);
}

// ==========================================
// Substack RSS Feed
// ==========================================
const substackContainer = document.getElementById('substackPosts');

if (substackContainer) {
    const RSS_URL = 'https://nikolasneofytou.substack.com/feed';
    const PROXY_URL = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(RSS_URL);

    fetch(PROXY_URL)
        .then(res => res.json())
        .then(data => {
            if (data.status !== 'ok' || !data.items || data.items.length === 0) {
                throw new Error('No posts found');
            }

            const posts = data.items.slice(0, 6);
            substackContainer.innerHTML = posts.map(post => {
                const date = new Date(post.pubDate).toLocaleDateString('en-US', {
                    year: 'numeric', month: 'short', day: 'numeric'
                });
                // Strip HTML tags for a clean description
                const desc = post.description
                    .replace(/<[^>]*>/g, '')
                    .substring(0, 150)
                    .trim() + '...';

                return `
                    <a href="${post.link}" class="writing-card" target="_blank" rel="noopener noreferrer">
                        <div class="writing-date">${date}</div>
                        <h3 class="writing-title">${post.title}</h3>
                        <p class="writing-excerpt">${desc}</p>
                        <span class="writing-read-more">Read on Substack <i class="fas fa-arrow-right"></i></span>
                    </a>
                `;
            }).join('');
        })
        .catch(() => {
            substackContainer.innerHTML = `
                <div class="writing-placeholder">
                    <i class="fas fa-newspaper fa-2x"></i>
                    <p>Visit my Substack to read my latest articles on philosophy, history, and more.</p>
                </div>
            `;
        });
}

// ==========================================
// Active nav link on scroll
// ==========================================
const sections = document.querySelectorAll('section[id]');

window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset + 100;
    
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        const link = document.querySelector(`.nav-link[href="#${id}"]`);
        
        if (link) {
            if (scrollY >= top && scrollY < top + height) {
                link.style.color = 'var(--accent)';
            } else {
                link.style.color = '';
            }
        }
    });
});

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
        Object.keys(fields).forEach(k => {
            if (fields[k]) fields[k].textContent = d[k] || '—';
        });
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
