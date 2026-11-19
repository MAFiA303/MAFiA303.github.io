// Accessible tab controller (Science / Music / AI) + live mathematical/rhythmic specimen canvases.
const tabs = [...document.querySelectorAll('.tablist [role="tab"]')];
const panels = new Map(
  [...document.querySelectorAll('.tab-panels > [role="tabpanel"]')].map((panel) => [
    panel.getAttribute('aria-labelledby'),
    panel,
  ]),
);

const redraws = new Set();

function selectTab(nextTab, { focus = false, updateHash = false } = {}) {
  if (!nextTab) return;
  for (const tab of tabs) {
    const active = tab === nextTab;
    tab.setAttribute('aria-selected', String(active));
    tab.tabIndex = active ? 0 : -1;
    tab.toggleAttribute('focusgroupstart', active);
    const panel = panels.get(tab.id);
    if (panel) {
      if (active) {
        panel.removeAttribute('hidden');
        panel.tabIndex = 0;
      } else {
        panel.setAttribute('hidden', 'until-found');
        panel.removeAttribute('tabindex');
      }
    }
  }
  nextTab.scrollIntoView?.({ block: 'nearest', inline: 'nearest', container: 'nearest' });
  if (focus) nextTab.focus({ preventScroll: true });
  if (updateHash && nextTab.dataset.tab) {
    const target = `#${nextTab.dataset.tab}`;
    if (window.location.hash !== target) {
      window.history.replaceState(window.history.state, '', target);
    }
  }
  requestAnimationFrame(() => {
    for (const draw of redraws) draw();
  });
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectTab(tab, { updateHash: true }));
  tab.addEventListener('keydown', (event) => {
    const index = tabs.indexOf(tab);
    let next = -1;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    if (next === -1) return;
    event.preventDefault();
    selectTab(tabs[next], { focus: true });
  });
}

for (const [tabId, panel] of panels) {
  panel.addEventListener('beforematch', () => {
    const owner = tabs.find((tab) => tab.id === tabId);
    if (owner) selectTab(owner);
  });
}

function syncFromHash() {
  const name = window.location.hash.slice(1).toLowerCase();
  const match = tabs.find((tab) => tab.dataset.tab === name);
  if (match) selectTab(match);
}

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function themeColor(token) {
  const suffix = darkQuery.matches ? 'dark' : 'light';
  return getComputedStyle(document.documentElement).getPropertyValue(`--${token}-${suffix}`).trim();
}

// Specimen 01: Real Riemann-Siegel Z(t) along the critical line (first 6 non-trivial zeros).
// Uses Riemann-Siegel main sum + theta(t) asymptotic expansion (accurate across t in [8, 40]).
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
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const tMin = 8;
  const tMax = 40;
  let hoverT = 14.1347;

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
    const padY = 26;
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

    // Subtle vertical coordinate ticks every 5 units
    ctx.strokeStyle = rule;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let t = 10; t <= 40; t += 5) {
      const x = Math.round(toX(t)) + 0.5;
      ctx.moveTo(x, padY * 0.5);
      ctx.lineTo(x, h - padY * 0.5);
    }
    ctx.stroke();

    // Critical zero axis Z(t) = 0
    ctx.strokeStyle = muted;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(padX, Math.round(midY) + 0.5);
    ctx.lineTo(w - padX, Math.round(midY) + 0.5);
    ctx.stroke();
    ctx.setLineDash([]);

    // Plot Z(t)
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

    // Mark real non-trivial zeros
    ctx.font = '500 10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (const zero of KNOWN_ZEROS) {
      const x = toX(zero);
      ctx.fillStyle = vermilion;
      ctx.beginPath();
      ctx.arc(x, midY, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = muted;
      ctx.fillText(zero.toFixed(2), x, midY + 18);
    }

    // Interactive cursor probe
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
  }

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const padX = 22;
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left - padX) / (rect.width - padX * 2)));
    hoverT = tMin + ratio * (tMax - tMin);
    draw();
  });

  redraws.add(draw);
}

// Specimen 02: Exact rational pulse diagram of Oddmeter's 3-row default 3/4 pattern
// Beat: 1,1,1 | Subdiv 1 (offbeats): x3, x2, x2 | Subdiv 2 (offbeats): x4, x5, x5
function initRhythmSpecimen() {
  const canvas = document.getElementById('rhythm-specimen');
  const readout = document.getElementById('rhythm-readout');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let hoverPhase = 0;

  const lanes = [
    { label: 'BEAT', counts: [1, 1, 1], offbeats: false, accentBeat: 0, colorToken: 'vermilion' },
    { label: 'S1', counts: [3, 2, 2], offbeats: true, altBeat: 2, colorToken: 'ink' },
    { label: 'S2', counts: [4, 5, 5], offbeats: true, accentFirst: true, colorToken: 'cobalt' },
  ];

  function draw() {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 10 || rect.height < 10) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = rect.width;
    const h = rect.height;
    const left = 52;
    const right = 22;
    const plotW = w - left - right;
    const top = 30;
    const rowH = (h - top - 16) / 3;

    const ink = themeColor('ink');
    const muted = themeColor('muted');
    const rule = themeColor('rule');
    const well = themeColor('well');
    const vermilion = themeColor('vermilion');
    const cobalt = themeColor('cobalt');

    ctx.clearRect(0, 0, w, h);

    // Beat guides (3/4)
    ctx.font = '600 10px "IBM Plex Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    for (let beat = 0; beat <= 3; beat++) {
      const x = Math.round(left + (beat / 3) * plotW) + 0.5;
      ctx.strokeStyle = beat === 0 ? vermilion : rule;
      ctx.setLineDash(beat === 0 || beat === 3 ? [] : [3, 4]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, top - 6);
      ctx.lineTo(x, h - 12);
      ctx.stroke();
      ctx.setLineDash([]);
      if (beat < 3) {
        ctx.fillStyle = beat === 0 ? ink : muted;
        ctx.fillText(String(beat + 1), x, top - 12);
      }
    }

    // Lanes
    lanes.forEach((lane, idx) => {
      const y = top + rowH * idx + rowH * 0.5;
      const color = themeColor(lane.colorToken);

      ctx.font = '600 10px "IBM Plex Mono", ui-monospace, monospace';
      ctx.textAlign = 'left';
      ctx.fillStyle = color;
      ctx.fillText(lane.label, 14, y + 3.5);

      ctx.strokeStyle = rule;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(left + plotW, y);
      ctx.stroke();

      let hitIdx = 0;
      lane.counts.forEach((count, beat) => {
        const start = lane.offbeats ? 1 : 0;
        for (let part = start; part < count; part++) {
          const phase = (beat * count + part) / (3 * count);
          const x = left + phase * plotW;
          const accented = (lane.accentBeat === beat && part === 0) || (lane.accentFirst && hitIdx === 0);
          const alt = lane.altBeat === beat;
          const markerColor = alt ? cobalt : color;
          const near = Math.abs(phase - hoverPhase) < 0.025;

          const mw = accented ? 12 : 10;
          const mh = accented ? 18 : 10;
          ctx.fillStyle = accented || near ? markerColor : well;
          ctx.strokeStyle = markerColor;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(x - mw / 2, y - mh / 2, mw, mh, 2.5);
          ctx.fill();
          ctx.stroke();
          if (alt && !accented && !near) {
            ctx.fillStyle = markerColor;
            ctx.fillRect(x - 2, y - 2, 4, 4);
          }
          hitIdx++;
        }
      });
    });

    // Interactive playhead scrub
    const px = left + hoverPhase * plotW;
    ctx.strokeStyle = vermilion;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, top - 6);
    ctx.lineTo(px, h - 12);
    ctx.stroke();

    if (readout) {
      const beat = Math.min(3, Math.floor(hoverPhase * 3) + 1);
      readout.textContent = `3/4 · BEAT ${beat} · ×3/2/2 & ×4/5/5`;
    }
  }

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const left = 52;
    const right = 22;
    hoverPhase = Math.max(0, Math.min(0.999, (event.clientX - rect.left - left) / (rect.width - left - right)));
    draw();
  });

  redraws.add(draw);
}

initZetaSpecimen();
initRhythmSpecimen();
syncFromHash();

window.addEventListener('hashchange', syncFromHash);
window.addEventListener('resize', () => {
  for (const draw of redraws) draw();
});
darkQuery.addEventListener('change', () => {
  for (const draw of redraws) draw();
});
requestAnimationFrame(() => {
  for (const draw of redraws) draw();
});
