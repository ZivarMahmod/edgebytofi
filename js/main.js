/* EDGE by Tofi — main.js
   Vanilla JS. Hero slideshow, sticky header, mobile menu, scroll reveal.
   Respects prefers-reduced-motion.
*/

(() => {
  'use strict';

  // BOKA-DIREKT-URL: hydrate all [data-boka] links at load.
  // Change this constant when the salon's real Boka Direkt URL is known.
  const BOKA_URL = 'https://www.bokadirekt.se/places/edge-by-tofi-136651';

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)'
  ).matches;

  // ---- Hydrate Boka links ----
  function hydrateBokaLinks() {
    document.querySelectorAll('[data-boka]').forEach((el) => {
      el.setAttribute('href', BOKA_URL);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    });
  }

  // ---- Sticky header — add class on scroll ----
  function setupStickyHeader() {
    const header = document.getElementById('siteHeader');
    if (!header) return;
    const onScroll = () => {
      if (window.scrollY > 12) {
        header.classList.add('is-scrolled');
      } else {
        header.classList.remove('is-scrolled');
      }
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // ---- Mobile menu ----
  function setupMobileMenu() {
    const toggle = document.getElementById('menuToggle');
    const menu = document.getElementById('mobileMenu');
    const close = document.getElementById('menuClose');
    const overlay = document.getElementById('mobileMenuOverlay');
    if (!toggle || !menu || !overlay) return;

    const open = () => {
      menu.classList.add('is-open');
      menu.setAttribute('aria-hidden', 'false');
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('is-visible'));
      toggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
    };
    const closeMenu = () => {
      menu.classList.remove('is-open');
      menu.setAttribute('aria-hidden', 'true');
      overlay.classList.remove('is-visible');
      setTimeout(() => { overlay.hidden = true; }, 520);
      toggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
    };

    toggle.addEventListener('click', open);
    close.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);
    menu.querySelectorAll('a').forEach((a) =>
      a.addEventListener('click', closeMenu)
    );
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.classList.contains('is-open')) closeMenu();
    });
  }

  // ---- Hero slideshow ----
  function setupHero() {
    const slidesRoot = document.getElementById('heroSlides');
    const headlineEl = document.getElementById('heroHeadline');
    const dotsRoot = document.getElementById('heroDots');
    const prevBtn = document.getElementById('heroPrev');
    const nextBtn = document.getElementById('heroNext');
    if (!slidesRoot || !headlineEl) return;

    const slides = Array.from(slidesRoot.querySelectorAll('.hero-slide'));
    if (slides.length < 2) return;

    let index = 0;
    let timerId = null;
    const AUTO_MS = 6500;

    // Build dots
    slides.forEach((slide, i) => {
      const dot = document.createElement('button');
      dot.className = 'hero-dot';
      dot.type = 'button';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `Visa bild ${i + 1}`);
      if (i === 0) dot.classList.add('is-active');
      dot.addEventListener('click', () => goTo(i, true));
      dotsRoot.appendChild(dot);
    });

    const dots = Array.from(dotsRoot.querySelectorAll('.hero-dot'));

    function goTo(next, userInitiated) {
      if (next === index) return;
      slides[index].classList.remove('is-active');
      dots[index].classList.remove('is-active');
      index = (next + slides.length) % slides.length;
      slides[index].classList.add('is-active');
      dots[index].classList.add('is-active');

      // Swap headline text — single <h1>, content rotates with slide.
      const h = slides[index].dataset.headline;
      if (h) headlineEl.textContent = h;

      if (userInitiated) restartAuto();
    }

    function next() { goTo(index + 1, false); }

    function startAuto() {
      if (prefersReducedMotion) return;
      timerId = window.setInterval(next, AUTO_MS);
    }
    function stopAuto() {
      if (timerId) {
        window.clearInterval(timerId);
        timerId = null;
      }
    }
    function restartAuto() {
      stopAuto();
      startAuto();
    }

    if (prevBtn) prevBtn.addEventListener('click', () => goTo(index - 1, true));
    if (nextBtn) nextBtn.addEventListener('click', () => goTo(index + 1, true));

    // Keyboard nav when slideshow region focused
    slidesRoot.parentElement.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { goTo(index - 1, true); e.preventDefault(); }
      if (e.key === 'ArrowRight') { goTo(index + 1, true); e.preventDefault(); }
    });

    // Pause when tab hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopAuto();
      else if (!prefersReducedMotion) restartAuto();
    });

    startAuto();
  }

  // ---- Scroll reveal ----
  function setupScrollReveal() {
    if (prefersReducedMotion) return;
    if (!('IntersectionObserver' in window)) return;

    const targets = document.querySelectorAll(
      '.section-head, .menu-group, .about-media, .about-text, .plats-info, .plats-map, .cta-wrap'
    );
    if (!targets.length) return;

    // Opt in to hidden state only once observer is ready.
    document.documentElement.classList.add('js-reveal');
    targets.forEach((el) => el.classList.add('reveal'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px 10% 0px', threshold: 0.01 }
    );

    targets.forEach((el) => io.observe(el));

    // Safety: if anything still hidden after 2.5s (e.g. obs never fires
    // for items already in viewport at load), reveal it.
    window.setTimeout(() => {
      targets.forEach((el) => {
        if (!el.classList.contains('is-visible')) {
          el.classList.add('is-visible');
        }
      });
    }, 2500);
  }

  // ---- Live rating (Bokadirekt via /api/rating) ----
  // Progressiv uppdatering. HTML-defaulten (5,0 / 12) står kvar om
  // endpointen saknas/failar — rör aldrig DOM utan giltiga siffror.
  function setupLiveRating() {
    const valEl = document.querySelector('[data-rating-value]');
    const cntEl = document.querySelector('[data-rating-count]');
    if (!valEl && !cntEl) return;

    fetch('/api/rating', { headers: { Accept: 'application/json' } })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        if (!d || typeof d !== 'object') return;
        if (valEl && typeof d.rating === 'number' && isFinite(d.rating)) {
          const s = d.rating.toFixed(1).replace('.', ',');
          if (valEl.textContent !== s) valEl.textContent = s;
        }
        if (cntEl && Number.isInteger(d.count) && d.count > 0) {
          const s = String(d.count);
          if (cntEl.textContent !== s) cntEl.textContent = s;
        }
      })
      .catch((err) => {
        // Tyst: behåll HTML-default. Inga konsolfel.
        if (window.console && console.debug) console.debug('rating skipped', err);
      });
  }

  // ---- Init ----
  function init() {
    hydrateBokaLinks();
    setupStickyHeader();
    setupMobileMenu();
    setupHero();
    setupScrollReveal();
    setupLiveRating();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
