/**
 * DNGWORKS — site shell behaviour.
 * Loaded on every page. Heavy modules are imported only where they are used,
 * so a reader on an article page never downloads the WebGL scene.
 */

/* ------------------------------------------------------------------ header */
function initHeader() {
  const header = document.querySelector('[data-header]');
  if (!header) return;

  const setScrolled = () => {
    header.dataset.scrolled = String((window.scrollY || 0) > 8);
  };
  setScrolled();
  window.addEventListener('scroll', setScrolled, { passive: true });
}

/* ------------------------------------------------------------------ drawer */
function initDrawer() {
  const toggle = document.querySelector('[data-menu-toggle]');
  const drawer = document.querySelector('[data-drawer]');
  if (!toggle || !drawer) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    drawer.dataset.open = String(open);
    toggle.setAttribute('aria-label', toggle.dataset[open ? 'labelClose' : 'labelOpen'] || '');
    document.documentElement.style.overflow = open ? 'hidden' : '';
  };

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  drawer.addEventListener('click', (event) => {
    if (event.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  /* A resize into the desktop breakpoint must not leave the body locked. */
  window.matchMedia('(min-width: 62rem)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}

/* -------------------------------------------------------------------- copy */
function initCopyButtons() {
  for (const button of document.querySelectorAll('[data-copy]')) {
    button.addEventListener('click', async () => {
      const source = document.querySelector(button.dataset.copy);
      const text = source ? (source.value ?? source.textContent ?? '').trim() : '';
      if (!text) return;

      const done = () => {
        const original = button.dataset.labelCopy || button.textContent;
        button.textContent = button.dataset.labelCopied || 'Copied';
        button.disabled = true;
        window.setTimeout(() => {
          button.textContent = original;
          button.disabled = false;
        }, 1800);
      };

      try {
        await navigator.clipboard.writeText(text);
        done();
      } catch {
        /* Clipboard is blocked without a secure context or permission —
           select the text so the reader can copy it by hand. */
        if (source && source.select) {
          source.focus();
          source.select();
        } else if (source) {
          const range = document.createRange();
          range.selectNodeContents(source);
          const selection = window.getSelection();
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      }
    });
  }
}

/* --------------------------------------------------------- hero 3D (home) */
async function initHero() {
  const stage = document.querySelector('[data-hero-stage]');
  if (!stage) return;

  const rail = document.querySelectorAll('[data-hero-rail] > li');
  const setStage = (index) => {
    rail.forEach((item, i) => {
      item.dataset.active = String(i === index);
    });
  };
  setStage(0);

  try {
    const { default: GrowthArchitectureHero } = await import('./hero-growth-architecture.js');
    const hero = new GrowthArchitectureHero(stage, {
      onStage: setStage,
      debug: new URLSearchParams(location.search).has('debug3d'),
    });
    const ok = hero.init();
    if (new URLSearchParams(location.search).has('debug3d')) {
      window.__DNG_3D = hero;
      /* eslint-disable-next-line no-console */
      console.info('[dng] hero diagnostics', hero.diagnostics);
    }
    if (!ok) stage.dataset.renderState = 'failed';
  } catch (error) {
    /* A failed module fetch must leave the art-directed poster in place. */
    stage.dataset.renderState = 'failed';
    /* eslint-disable-next-line no-console */
    console.warn('[dng] hero scene unavailable', error);
  }
}

/* ------------------------------------------------------- in-article index */
function initArticleToc() {
  const toc = document.querySelector('[data-toc]');
  if (!toc) return;
  const links = [...toc.querySelectorAll('a')];
  const targets = links
    .map((link) => document.getElementById(decodeURIComponent(link.hash.slice(1))))
    .filter(Boolean);
  if (!targets.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const link of links) {
          link.setAttribute('aria-current', String(link.hash.slice(1) === entry.target.id));
        }
      }
    },
    { rootMargin: '-25% 0px -65% 0px' }
  );
  for (const target of targets) observer.observe(target);
}

/* ------------------------------------------------------------------- boot */
function boot() {
  initHeader();
  initDrawer();
  initCopyButtons();
  initArticleToc();
  initHero();

  if (document.querySelector('[data-tools]')) import('./tools.js');
  if (document.querySelector('[data-newsroom]')) import('./newsroom.js');
  if (document.querySelector('[data-contact-form]')) import('./contact.js');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
  boot();
}
