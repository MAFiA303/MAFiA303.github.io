import { startLogoSwimIntro } from './js/logo-swim.js?v=8';

// Dynamic single-page controller:
// - Scrollspy (native scroll-target-group + IntersectionObserver fallback)
// - Scroll progress hairline fallback
// - Two-state Light/Dark theme toggle synced to <meta name="color-scheme">
// - Discipline filter & Showcase/Compact view switcher with View Transitions
// - Native <dialog> lightbox with top-layer exit & light-dismiss fallbacks
// - Interactive Hardy Z(t) critical-line plot & Oddmeter multi-preset pulse canvas

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
const redraws = new Set();

function isDarkActive() {
  const content = colorSchemeMeta?.content;
  if (content === 'dark') return true;
  if (content === 'light') return false;
  return darkQuery.matches;
}

function themeColor(token) {
  const suffix = isDarkActive() ? 'dark' : 'light';
  return getComputedStyle(document.documentElement).getPropertyValue(`--${token}-${suffix}`).trim();
}

function triggerRedraws() {
  requestAnimationFrame(() => {
    for (const draw of redraws) draw();
  });
}

// 1. Two-state Light/Dark theme toggle (reverts to system when matching OS preference)
const themeToggle = document.getElementById('theme-toggle');
function applyStoredScheme(value) {
  if (!colorSchemeMeta) return;
  colorSchemeMeta.content = value === 'light' || value === 'dark' ? value : 'light dark';
  triggerRedraws();
}

themeToggle?.addEventListener('click', () => {
  const target = isDarkActive() ? 'light' : 'dark';
  const osScheme = darkQuery.matches ? 'dark' : 'light';
  try {
    if (target === osScheme) {
      localStorage.removeItem('color-scheme');
      applyStoredScheme(null);
    } else {
      localStorage.setItem('color-scheme', target);
      applyStoredScheme(target);
    }
  } catch {
    applyStoredScheme(target === osScheme ? null : target);
  }
});

window.addEventListener('storage', (event) => {
  if (event.key === 'color-scheme') applyStoredScheme(event.newValue);
});

// 2. Scroll progress fallback when animation-timeline: scroll() is unsupported
const progressEl = document.getElementById('scroll-progress');
if (progressEl && !CSS.supports('animation-timeline', 'scroll()')) {
  const updateProgress = () => {
    if (reducedMotionQuery.matches) {
      progressEl.style.transform = 'scaleX(0)';
      return;
    }
    const scrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const ratio = Math.max(0, Math.min(1, window.scrollY / scrollable));
    progressEl.style.transform = `scaleX(${ratio})`;
  };
  window.addEventListener('scroll', updateProgress, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();
}

// 3. Scrollspy (native scroll-target-group + IntersectionObserver fallback)
const nav = document.querySelector('.masthead-nav');
const navLinks = [...document.querySelectorAll('.masthead-nav a[href^="#"]')];

if (nav && navLinks.length) {
  if (CSS.supports('scroll-target-group: auto')) {
    const syncAriaCurrent = () => {
      const currentLink = nav.querySelector('a:target-current');
      for (const link of navLinks) {
        link.setAttribute('aria-current', link === currentLink ? 'true' : 'false');
      }
    };
    syncAriaCurrent();
    document.addEventListener('scrollend', syncAriaCurrent);
  } else {
    const observed = navLinks
      .map((link) => document.querySelector(link.getAttribute('href')))
      .filter(Boolean);
    const setActive = (id) => {
      for (const link of navLinks) {
        const active = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('target-current', active);
        link.setAttribute('aria-current', String(active));
      }
    };
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );
    for (const section of observed) observer.observe(section);
  }

  // Horizontal edge fade fallback for narrow viewports
  if (!CSS.supports('animation-timeline', 'scroll()') && navLinks.length >= 2) {
    const [first, last] = [navLinks[0], navLinks[navLinks.length - 1]];
    const fadeObserver = new IntersectionObserver(
      (entries) => {
        for (const { target, intersectionRatio } of entries) {
          nav.classList.toggle(target === first ? 'more-start' : 'more-end', intersectionRatio < 1);
        }
      },
      { root: nav, threshold: 1, rootMargin: '1px' },
    );
    fadeObserver.observe(first);
    fadeObserver.observe(last);
  }
}

// 4. Dynamic discipline filter & Showcase / Compact view switcher with View Transitions
const stream = document.getElementById('work-stream');
const bands = [...document.querySelectorAll('.work-band')];
const filterButtons = [...document.querySelectorAll('.filter-btn')];
const viewButtons = [...document.querySelectorAll('.view-btn')];
let activeFilter = 'all';

function runTransition(updateFn) {
  if (document.startViewTransition && !reducedMotionQuery.matches) {
    const transition = document.startViewTransition(() => updateFn());
    transition.finished.finally(() => triggerRedraws());
  } else {
    updateFn();
    triggerRedraws();
  }
}

function setFilter(nextFilter) {
  const target = nextFilter === activeFilter && nextFilter !== 'all' ? 'all' : nextFilter;
  activeFilter = target;
  runTransition(() => {
    for (const btn of filterButtons) {
      btn.setAttribute('aria-pressed', String(btn.dataset.filter === activeFilter));
    }
    for (const band of bands) {
      band.hidden = activeFilter !== 'all' && band.dataset.category !== activeFilter;
    }
  });
}

for (const btn of filterButtons) {
  btn.addEventListener('click', () => setFilter(btn.dataset.filter || 'all'));
}

// Clicking a sticky nav section link clears an incompatible filter so the target is visible
for (const link of navLinks) {
  link.addEventListener('click', () => {
    const id = link.getAttribute('href')?.slice(1);
    if (id && activeFilter !== 'all' && id !== activeFilter && id !== 'about') {
      activeFilter = 'all';
      for (const btn of filterButtons) {
        btn.setAttribute('aria-pressed', String(btn.dataset.filter === 'all'));
      }
      for (const band of bands) band.hidden = false;
      triggerRedraws();
    }
  });
}

for (const btn of viewButtons) {
  btn.addEventListener('click', () => {
    const mode = btn.dataset.view || 'showcase';
    if (!stream || stream.dataset.view === mode) return;
    runTransition(() => {
      stream.dataset.view = mode;
      for (const item of viewButtons) {
        item.setAttribute('aria-pressed', String(item === btn));
      }
    });
  });
}

// 5. Native <dialog> Lightbox (Fuzia gameplay shots & @mafia303 photography)
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightbox-img');
const lightboxTitle = document.getElementById('lightbox-title');
const lightboxSub = document.getElementById('lightbox-sub');
const lightboxCount = document.getElementById('lightbox-count');
const lightboxLink = document.getElementById('lightbox-link');
const lightboxPrev = document.getElementById('lightbox-prev');
const lightboxNext = document.getElementById('lightbox-next');

let supportsDisplayTransition;
function canTransitionDisplay() {
  if (supportsDisplayTransition !== undefined) return supportsDisplayTransition;
  if (!window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransition;
}

function supportsTopLayerExit() {
  return window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay();
}

async function closeTopLayer(dialog) {
  if (!dialog.open) return;
  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((r) => setTimeout(r, 1500)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }
  dialog.close();
}

if (lightbox) {
  const triggers = [...document.querySelectorAll('[data-lightbox-group]')];
  let currentGroup = [];
  let currentIndex = 0;

  function renderLightboxItem() {
    const item = currentGroup[currentIndex];
    if (!item) return;
    const imgEl = item.querySelector('img');
    if (lightboxImg) {
      lightboxImg.src = item.dataset.lightboxSrc || '';
      lightboxImg.alt = imgEl?.alt || item.dataset.lightboxTitle || '';
    }
    if (lightboxTitle) lightboxTitle.textContent = item.dataset.lightboxTitle || '';
    if (lightboxSub) lightboxSub.textContent = item.dataset.lightboxSub || '';
    if (lightboxCount) lightboxCount.textContent = `${currentIndex + 1} / ${currentGroup.length}`;
    if (lightboxLink) {
      lightboxLink.href = item.dataset.lightboxHref || '#';
      lightboxLink.textContent = item.dataset.lightboxLinkLabel || 'Open ↗';
    }
  }

  for (const trigger of triggers) {
    trigger.addEventListener('click', () => {
      const groupName = trigger.dataset.lightboxGroup;
      currentGroup = triggers.filter((el) => el.dataset.lightboxGroup === groupName);
      currentIndex = Math.max(0, currentGroup.indexOf(trigger));
      renderLightboxItem();
      lightbox.removeAttribute('data-closing');
      lightbox.showModal();
    });
  }

  lightboxPrev?.addEventListener('click', () => {
    if (!currentGroup.length) return;
    currentIndex = (currentIndex - 1 + currentGroup.length) % currentGroup.length;
    renderLightboxItem();
  });

  lightboxNext?.addEventListener('click', () => {
    if (!currentGroup.length) return;
    currentIndex = (currentIndex + 1) % currentGroup.length;
    renderLightboxItem();
  });

  lightbox.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      lightboxPrev?.click();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      lightboxNext?.click();
    }
  });

  lightbox.addEventListener('cancel', (event) => {
    if (!supportsTopLayerExit()) {
      event.preventDefault();
      closeTopLayer(lightbox);
    }
  });

  lightbox.addEventListener('close', () => {
    lightbox.returnValue = '';
  });

  // Light-dismiss fallback when <dialog closedby="any"> is unsupported
  if (!('closedBy' in HTMLDialogElement.prototype)) {
    const isOutside = (event) => {
      const rect = lightbox.getBoundingClientRect();
      return (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      );
    };
    let pressedOutside = false;
    lightbox.addEventListener('pointerdown', (event) => {
      pressedOutside = isOutside(event);
    });
    lightbox.addEventListener('pointerup', (event) => {
      if (pressedOutside && isOutside(event)) closeTopLayer(lightbox);
    });
  }
}

// 6. Specimen 01: Riemann-Siegel Hardy Z(t) along critical line with clickable zero jumps
const KNOWN_ZEROS = [14.1347, 21.022, 25.0109, 30.4249, 32.9351, 37.5862];

function riemannTheta(t) {
  return (t / 2) * Math.log(t / (2 * Math.PI)) - t / 2 - Math.PI / 8 + 1 / (48 * t) + 7 / (5760 * t * t * t);
}

function hardyZ(t) {
  const theta = riemannTheta(t);
  const N = Math.floor(Math.sqrt(t / (2 * Math.PI)));
  let sum = 0;
  for (let n = 1; n <= N; n++) {
    sum += Math.cos(theta - t * Math.log(n)) / Math.sqrt(n);
  }
  const p = Math.sqrt(t / (2 * Math.PI)) - N;
  const denom = Math.cos(2 * Math.PI * p);
  const psi = Math.abs(denom) > 1e-6 ? Math.cos(2 * Math.PI * (p * p - p - 1 / 16)) / denom : 0;
  const rem = (N % 2 === 0 ? -1 : 1) * Math.pow(t / (2 * Math.PI), -0.25) * psi;
  return 2 * sum + rem;
}

function initZetaSpecimen() {
  const canvas = document.getElementById('zeta-specimen');
  const readout = document.getElementById('zeta-readout');
  const zeroButtons = [...document.querySelectorAll('[data-zero]')];
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tMin = 8;
  const tMax = 40;
  let hoverT = 14.1347;

  function syncZeroButtons() {
    for (const btn of zeroButtons) {
      const val = Number(btn.dataset.zero);
      btn.setAttribute('aria-pressed', String(Math.abs(hoverT - val) < 0.08));
    }
  }

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const padX = 22;
    const padY = 24;
    const plotW = w - padX * 2;
    const plotH = h - padY * 2;
    const midY = padY + plotH * 0.54;
    const scaleY = plotH * 0.145;

    const toX = (t) => padX + ((t - tMin) / (tMax - tMin)) * plotW;
    const toY = (z) => midY - z * scaleY;

    const ink = themeColor('ink');
    const muted = themeColor('muted');
    const rule = themeColor('rule');
    const vermilion = themeColor('vermilion');
    const cobalt = themeColor('cobalt');

    ctx.clearRect(0, 0, w, h);

    ctx.strokeStyle = rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 10; t <= 40; t += 5) {
      const x = Math.round(toX(t)) + 0.5;
      ctx.moveTo(x, padY * 0.5);
      ctx.lineTo(x, h - padY * 0.5);
    }
    ctx.stroke();

    ctx.strokeStyle = muted;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(padX, Math.round(midY) + 0.5);
    ctx.lineTo(w - padX, Math.round(midY) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = cobalt;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const steps = Math.max(240, Math.round(plotW));
    for (let i = 0; i <= steps; i++) {
      const t = tMin + (i / steps) * (tMax - tMin);
      const x = toX(t);
      const y = toY(hardyZ(t));
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.font = '500 10.5px "Lexend", system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const zero of KNOWN_ZEROS) {
      const x = toX(zero);
      const active = Math.abs(hoverT - zero) < 0.08;
      ctx.fillStyle = vermilion;
      ctx.beginPath();
      ctx.arc(x, midY, active ? 5.5 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = active ? ink : muted;
      ctx.fillText(zero.toFixed(2), x, midY + 18);
    }

    const hx = toX(hoverT);
    const hz = hardyZ(hoverT);
    const hy = toY(hz);
    ctx.strokeStyle = vermilion;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, padY * 0.5);
    ctx.lineTo(hx, h - padY * 0.5);
    ctx.stroke();

    ctx.fillStyle = ink;
    ctx.beginPath();
    ctx.arc(hx, hy, 4.5, 0, Math.PI * 2);
    ctx.fill();

    if (readout) {
      readout.textContent = `t = ${hoverT.toFixed(2)}  ·  Z(t) = ${hz >= 0 ? '+' : ''}${hz.toFixed(2)}`;
    }
    syncZeroButtons();
  }

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const padX = 22;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - padX) / (rect.width - padX * 2)));
    hoverT = tMin + ratio * (tMax - tMin);
    draw();
  });

  for (const btn of zeroButtons) {
    btn.addEventListener('click', () => {
      hoverT = Number(btn.dataset.zero) || 14.1347;
      draw();
    });
  }

  redraws.add(draw);
}

// 7. Specimen 02: Functional embedded Oddmeter metronome with URL & Share sync
function initOddmeterEmbed() {
  const frame = document.getElementById('oddmeter-frame');
  const openLink = document.getElementById('oddmeter-open');
  if (!frame) return;

  const setupPrefix = '#setup=';
  let lastSyncedHash = '';
  const applyInitialHash = () => {
    const hash = window.location.hash;
    if (hash.startsWith(setupPrefix) && hash !== lastSyncedHash) {
      const targetSrc = `./oddmeter/?embed=1${hash}`;
      if (frame.getAttribute('src') !== targetSrc) frame.src = targetSrc;
      if (openLink) openLink.href = `./oddmeter/${hash}`;
    }
  };
  applyInitialHash();

  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'oddmeter:setup') {
      if (typeof data.hash === 'string' && data.hash.startsWith(setupPrefix)) {
        lastSyncedHash = data.hash;
        if (window.location.hash !== data.hash) {
          window.history.replaceState(window.history.state, '', data.hash);
        }
      }
      if (openLink && typeof data.fullHref === 'string') {
        openLink.href = data.fullHref;
      }
    } else if (data.type === 'oddmeter:resize' && Number.isFinite(data.height)) {
      frame.style.height = `${Math.max(320, Math.ceil(data.height))}px`;
    }
  });

  window.addEventListener('hashchange', applyInitialHash);
}

// 8. Mafium skull-octopus underwater tentacle animation (on load + click)
// Samples directly from the live full-color mafium-hero <img> so skull & sucker
// lighting match the original reference artwork bit-for-bit across the animation.
function initBrandLogoAnimation() {
  const heroWrap = document.getElementById('hero-emblem-wrap');
  const heroImg = heroWrap?.querySelector('img.hero-emblem') ?? null;
  const wordmarkMark = document.getElementById('wordmark-mark');
  const wordmarkLink = document.getElementById('wordmark-link');
  const heroCrop = { x: 32 / 480, y: 32 / 480, w: 416 / 480, h: 416 / 480 };
  const heroBg = [11, 10, 13];

  if (heroWrap) {
    startLogoSwimIntro({
      container: heroWrap,
      trigger: heroWrap,
      sourceImg: heroImg,
      sourceCrop: heroCrop,
      keyBg: heroBg,
      fillBg: '#0b0a0d',
      cacheKey: 'mafium-hero',
      contentScale: 416 / 480,
      clipToBox: true,
      canvasClass: 'logo-swim-canvas',
    });
  }
  if (wordmarkMark) {
    startLogoSwimIntro({
      container: wordmarkMark,
      trigger: wordmarkLink ?? wordmarkMark,
      sourceImg: heroImg,
      sourceCrop: heroCrop,
      keyBg: heroBg,
      fillBg: '#0b0a0d',
      cacheKey: 'mafium-hero',
      contentScale: 0.935,
      clipToBox: true,
      canvasClass: 'logo-swim-canvas',
    });
  }
}

initBrandLogoAnimation();
initZetaSpecimen();
initOddmeterEmbed();

window.addEventListener('resize', triggerRedraws);
darkQuery.addEventListener('change', triggerRedraws);
triggerRedraws();
