/**
 * Pixel-art Studio Drummer stage for Oddmeter.
 *
 * Uses a crisp virtual pixel buffer (`imageSmoothingEnabled = false`) with
 * tight close-up hero framing (`VH = 80`, `MIN_KIT_VW = 172`) and strict 1:1
 * square-pixel scaling so the drummer stays large and clear on phones (both
 * portrait and landscape) while expanding edge-to-edge without stretching on
 * desktop and 3440px+ ultrawide monitors.
 */

export const drummerStorageKey = 'oddmeter-drummer-v1';

export const DRUM_VOICE_MAP = {
  click:     { name: 'Click',     color: '#ff5d4f', piece: 'tom',       hand: 'right' },
  hat:       { name: 'Hi-hat',    color: '#e2e6f0', piece: 'hat',       hand: 'left'  },
  cowbell:   { name: 'Cowbell',   color: '#6cb4ff', piece: 'cowbell',   hand: 'right' },
  kick:      { name: 'Kick',      color: '#ffb04f', piece: 'kick',      hand: 'foot'  },
  snare:     { name: 'Snare',     color: '#4ce3a8', piece: 'snare',     hand: 'left'  },
  rimshot:   { name: 'Rimshot',   color: '#ff84be', piece: 'snare',     hand: 'left', rimshot: true },
  woodblock: { name: 'Woodblock', color: '#c98a5b', piece: 'woodblock', hand: 'right' },
  clave:     { name: 'Clave',     color: '#4fdce3', piece: 'clave',     hand: 'right' },
};

const VH = 80;
const MIN_KIT_VW = 172;

export function computeStageViewport(cssW, cssH, dpr = 1) {
  const safeW = Math.max(1, Math.floor(cssW));
  const safeH = Math.max(1, Math.floor(cssH));
  const safeDpr = Math.min(Math.max(1, dpr || 1), 2);
  // Strict 1:1 uniform square pixel scale: zoomed in on the drummer+kit so
  // phones get a large, clear hero view while guaranteeing the full kit
  // (MIN_KIT_VW = 172) never clips horizontally on 320px phones and never
  // stretches on 3440px / 5120px ultrawide screens.
  const scale = Math.min(safeH / VH, safeW / MIN_KIT_VW);
  const vw = Math.max(MIN_KIT_VW, Math.ceil(safeW / scale));
  const vh = Math.max(VH, Math.ceil(safeH / scale));
  const drawW = vw * scale;
  const drawH = vh * scale;
  return {
    cssW: safeW,
    cssH: safeH,
    dpr: safeDpr,
    canvasW: Math.floor(safeW * safeDpr),
    canvasH: Math.floor(safeH * safeDpr),
    vw,
    vh,
    scale,
    drawW,
    drawH,
    ox: Math.floor((safeW - drawW) / 2),
    oy: Math.floor((safeH - drawH) / 2),
  };
}

function drawLine(ctx, x0, y0, x1, y1, color, size = 1) {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  ctx.fillStyle = color;
  for (let steps = 0; steps < 160; steps++) {
    ctx.fillRect(x0, y0, size, size);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx)  { err += dx; y0 += sy; }
  }
}

function drawEllipse(ctx, cx, cy, rx, ry, fill, stroke = null) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const irx = Math.max(1, Math.round(rx));
  const iry = Math.max(1, Math.round(ry));
  const rx2 = irx * irx;
  const ry2 = iry * iry;
  const inRx = Math.max(0.5, irx - 1.15);
  const inRy = Math.max(0.5, iry - 1.15);
  const inRx2 = inRx * inRx;
  const inRy2 = inRy * inRy;

  for (let y = -iry; y <= iry; y++) {
    for (let x = -irx; x <= irx; x++) {
      const d = (x * x) / rx2 + (y * y) / ry2;
      if (d <= 1.02) {
        const isEdge = stroke && ((x * x) / inRx2 + (y * y) / inRy2 > 1.0);
        ctx.fillStyle = isEdge ? stroke : fill;
        ctx.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
}

function drawDrumShell(ctx, cx, topY, rx, ry, height, headColor, shellColor, shellDark, lugColor, rimColor = '#0b0e18') {
  cx = Math.round(cx);
  topY = Math.round(topY);
  const left = cx - rx;
  const width = rx * 2 + 1;

  ctx.fillStyle = rimColor;
  ctx.fillRect(left - 1, topY, width + 2, height + ry);
  ctx.fillStyle = shellColor;
  ctx.fillRect(left, topY, width, height);
  ctx.fillStyle = shellDark;
  ctx.fillRect(left, topY, Math.max(2, Math.floor(width * 0.2)), height);
  ctx.fillRect(left + width - Math.max(2, Math.floor(width * 0.22)), topY, Math.max(2, Math.floor(width * 0.22)), height);
  drawEllipse(ctx, cx, topY + height, rx, ry, shellDark, rimColor);
  ctx.fillStyle = lugColor;
  const lugY = topY + Math.max(3, Math.floor(height * 0.35));
  const lugH = Math.max(2, Math.floor(height * 0.4));
  ctx.fillRect(cx - Math.floor(rx * 0.62), lugY, 2, lugH);
  ctx.fillRect(cx - 1, lugY, 2, lugH);
  ctx.fillRect(cx + Math.floor(rx * 0.62) - 1, lugY, 2, lugH);
  drawEllipse(ctx, cx, topY, rx + 1, ry + 1, rimColor);
  drawEllipse(ctx, cx, topY, rx, ry, headColor, '#cbd5e1');
}

function drawCymbal(ctx, cx, cy, rx, ry, tiltPx, flash, bodyColor, highlightColor, undersideColor) {
  cx = Math.round(cx);
  cy = Math.round(cy);
  const bright = flash > 0.22;
  drawEllipse(ctx, cx, cy + 1, rx + 1, ry, '#0b0e18');
  drawEllipse(ctx, cx, cy + 1, rx, Math.max(2, ry - 1), undersideColor);
  for (let x = -rx; x <= rx; x++) {
    const nx = x / rx;
    const spanY = Math.round(Math.sqrt(Math.max(0, 1 - nx * nx)) * ry);
    const yShift = Math.round(nx * tiltPx);
    for (let y = -spanY; y <= spanY; y++) {
      const isOutline = Math.abs(x) === rx || Math.abs(y) === spanY;
      if (isOutline) {
        ctx.fillStyle = '#0b0e18';
      } else if (bright) {
        ctx.fillStyle = y <= 0 ? '#ffffff' : highlightColor;
      } else if (y < 0 && x > -rx * 0.5 && x < rx * 0.45) {
        ctx.fillStyle = highlightColor;
      } else {
        ctx.fillStyle = bodyColor;
      }
      ctx.fillRect(cx + x, cy + y + yShift, 1, 1);
    }
  }
  drawEllipse(ctx, cx, cy - 1, Math.max(3, Math.round(rx * 0.25)), 2, bright ? '#ffffff' : highlightColor, '#0b0e18');
  ctx.fillStyle = '#e2e6f0';
  ctx.fillRect(cx, cy - 3, 1, 2);
}

export function createDrummerStage({ canvas, statusBadge = null, onTapPiece = null } = {}) {
  let ctx = null;
  let buf = null;
  let g = null;
  let canvasChecked = false;

  function ensureCanvas() {
    if (canvasChecked) return Boolean(ctx && g);
    canvasChecked = true;
    if (!canvas || typeof document === 'undefined') return false;
    const ua = (typeof window !== 'undefined' ? window.navigator?.userAgent : '') || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
    if (/jsdom/i.test(ua || '')) return false;
    try {
      ctx = canvas.getContext?.('2d') ?? null;
    } catch {
      ctx = null;
    }
    if (!ctx) return false;
    buf = document.createElement('canvas');
    g = buf.getContext('2d');
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', resize);
      if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
        resizeObserver = new ResizeObserver(() => {
          if (enabled) {
            resize();
            render();
          }
        });
        resizeObserver.observe(canvas.parentElement);
      }
    }
    return Boolean(ctx && g);
  }

  let enabled = false;
  let playing = false;
  let idleRaf = 0;
  let lastTime = 0;
  let tick = 0;
  let vw = 360;
  let vh = VH;
  let blit = computeStageViewport(360, 170, 1);
  let lastCssW = 0;
  let lastCssH = 0;
  let lastDpr = 0;
  let resizeObserver = null;

  // Musical state synced from Oddmeter
  const music = {
    beats: 3,
    activeBeat: -1,
    visualPhase: 0,
    countIn: false,
    countBeat: 0,
    inRepeat: false,
    repeatPass: 0,
    repeatTimes: 0,
    laneMuted: [false, false, false],
    laneSounds: ['click', 'hat', 'cowbell'],
    laneFlash: [0, 0, 0],
    beatEnabled: null,
    visualStarts: null,
    visualWidths: null,
    visualTotal: 3,
  };

  // Relative kit offsets from center `cx` and stage top `y0 = vh - VH`
  const KIT = {
    crash:     { dx: -64, y: 24, r: 15, flash: 0, tilt: 0, color: '#fde047', sound: 'click',     accent: true  },
    hat:       { dx: -49, y: 42, r: 12, flash: 0, tilt: 0, color: '#e2e6f0', sound: 'hat',       accent: false },
    snare:     { dx: -31, y: 52, r: 13, flash: 0, tilt: 0, color: '#4ce3a8', sound: 'snare',     accent: false, rim: false },
    tom:       { dx: -15, y: 39, r: 11, flash: 0, tilt: 0, color: '#ff5d4f', sound: 'click',     accent: false },
    kick:      { dx:   0, y: 57, r: 16, flash: 0, tilt: 0, color: '#ffb04f', sound: 'kick',      accent: true  },
    cowbell:   { dx:  17, y: 34, r:  9, flash: 0, tilt: 0, color: '#6cb4ff', sound: 'cowbell',   accent: false },
    woodblock: { dx:  35, y: 42, r:  9, flash: 0, tilt: 0, color: '#c98a5b', sound: 'woodblock', accent: false },
    clave:     { dx:  50, y: 36, r:  9, flash: 0, tilt: 0, color: '#4fdce3', sound: 'clave',     accent: false },
    ride:      { dx:  64, y: 25, r: 15, flash: 0, tilt: 0, color: '#fde047', sound: 'hat',       accent: true  },
  };

  const hands = {
    left:  { restDx: -27, restY: 45, targetDx: -27, targetY: 45, prevDx: -27, prevY: 36, strike: 0, color: '#e2e6f0' },
    right: { restDx:  19, restY: 40, targetDx:  19, targetY: 40, prevDx:  19, prevY: 32, strike: 0, color: '#6cb4ff' },
  };

  let downbeatFlash = 0;
  let countInFlash = 0;
  let headNod = 0;
  let ampPump = 0;
  let callout = { text: '', color: '#fde047', timer: 0 };
  const particles = [];
  const shockwaves = [];
  const hitLog = [];

  function reducedMotion() {
    return Boolean(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  }

  function measureCssSize() {
    const rect = canvas?.getBoundingClientRect?.();
    const cssW = Math.max(1, Math.floor(rect?.width || canvas?.clientWidth || 360));
    const cssH = Math.max(1, Math.floor(rect?.height || canvas?.clientHeight || 170));
    const dpr = Math.min(Math.max(1, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1), 2);
    return { cssW, cssH, dpr };
  }

  function resize() {
    if (!ensureCanvas() || !canvas) return;
    const { cssW, cssH, dpr } = measureCssSize();
    const vp = computeStageViewport(cssW, cssH, dpr);
    lastCssW = vp.cssW;
    lastCssH = vp.cssH;
    lastDpr = vp.dpr;
    vw = vp.vw;
    vh = vp.vh;
    blit = vp;

    if (canvas.width !== vp.canvasW || canvas.height !== vp.canvasH) {
      canvas.width = vp.canvasW;
      canvas.height = vp.canvasH;
    }
    if (buf.width !== vp.vw || buf.height !== vp.vh) {
      buf.width = vp.vw;
      buf.height = vp.vh;
    }
  }

  function spawnParticles(dx, y, color, count = 7) {
    if (reducedMotion()) return;
    for (let i = 0; i < count; i++) {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const sp = 14 + Math.random() * 26;
      particles.push({
        dx, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 12,
        life: 0.28 + Math.random() * 0.24,
        max: 0.52,
        color,
        size: Math.random() > 0.45 ? 2 : 1,
      });
    }
  }

  function spawnWave(dx, y, maxR, color) {
    if (reducedMotion()) return;
    shockwaves.push({ dx, y, r: 3, maxR, life: 0.26, max: 0.26, color });
  }

  function updateBadge() {
    if (!statusBadge) return;
    if (music.countIn && music.countBeat > 0) {
      statusBadge.textContent = `Count ${music.countBeat}/${music.beats}`;
      statusBadge.dataset.state = 'count-in';
    } else if (playing && music.activeBeat >= 0) {
      const passSuffix = music.inRepeat && music.repeatTimes > 1 ? ` · ${music.repeatPass}/${music.repeatTimes}` : '';
      statusBadge.textContent = `Beat ${music.activeBeat + 1}/${music.beats}${passSuffix}`;
      statusBadge.dataset.state = music.inRepeat ? 'repeat' : 'playing';
    } else if (music.laneMuted.every(Boolean)) {
      statusBadge.textContent = 'Muted';
      statusBadge.dataset.state = 'muted';
    } else {
      statusBadge.textContent = 'Tap kit';
      statusBadge.dataset.state = 'idle';
    }
  }

  function triggerHit({ lane = 0, sound = 'click', accented = false, beat = -1 } = {}) {
    if (sound === 'off') return;
    const meta = DRUM_VOICE_MAP[sound] || DRUM_VOICE_MAP.click;
    const color = meta.color;
    hitLog.push({ lane, sound, accented: Boolean(accented), beat });
    if (hitLog.length > 64) hitLog.shift();

    if (lane >= 0 && lane < 3) music.laneFlash[lane] = 1.0;

    if (accented && (sound === 'click' || sound === 'kick' || lane === 0)) {
      const cymbal = (beat === 0 || sound === 'click' || sound === 'kick') ? KIT.crash : KIT.ride;
      cymbal.flash = 1.0;
      cymbal.tilt = 1.0;
      cymbal.color = color;
      downbeatFlash = 1.0;
      const side = cymbal === KIT.crash ? 'left' : 'right';
      hands[side].prevDx = hands[side].targetDx;
      hands[side].prevY = hands[side].targetY;
      hands[side].targetDx = cymbal.dx + (side === 'left' ? 4 : -4);
      hands[side].targetY = cymbal.y;
      hands[side].strike = 1.0;
      hands[side].color = '#fde047';
      spawnParticles(cymbal.dx, cymbal.y - 2, '#fde047', 11);
      spawnWave(cymbal.dx, cymbal.y, 18, '#fde047');
    }

    const piece = KIT[meta.piece];
    if (piece) {
      piece.flash = 1.0;
      piece.tilt = (Math.random() > 0.5 ? 1 : -1) * 1.0;
      piece.color = color;
      if (meta.piece === 'snare') piece.rim = Boolean(meta.rimshot);
      spawnParticles(piece.dx, piece.y - 2, color, accented ? 10 : 6);
      spawnWave(piece.dx, piece.y, accented ? 17 : 12, color);

      if (meta.hand === 'foot') {
        ampPump = 1.0;
        headNod = Math.max(headNod, 0.9);
      } else {
        let side = meta.hand;
        if (hands[side].strike > 0.72) {
          const other = side === 'left' ? 'right' : 'left';
          if (hands[other].strike < 0.45 && Math.abs(piece.dx) < 34) side = other;
        }
        hands[side].prevDx = hands[side].targetDx;
        hands[side].prevY = hands[side].targetY;
        hands[side].targetDx = piece.dx;
        hands[side].targetY = piece.y - 2;
        hands[side].strike = 1.0;
        hands[side].color = color;
      }
    }

    if (accented) {
      headNod = 1.0;
      ampPump = Math.max(ampPump, 0.85);
      callout = {
        text: beat >= 0 ? `${beat + 1}!` : `${meta.name.toUpperCase()}!`,
        color: '#fde047',
        timer: 0.34,
      };
    } else if (lane === 0) {
      headNod = Math.max(headNod, 0.68);
    }
  }

  function triggerCountIn(beat, total) {
    music.countIn = true;
    music.countBeat = beat;
    music.beats = total;
    countInFlash = 1.0;
    headNod = 0.85;
    // Overhead crossed drumsticks click cleanly in clear headroom
    hands.left.prevDx = hands.left.targetDx;
    hands.left.prevY = hands.left.targetY;
    hands.right.prevDx = hands.right.targetDx;
    hands.right.prevY = hands.right.targetY;
    hands.left.targetDx = -3;
    hands.left.targetY = 9;
    hands.right.targetDx = 3;
    hands.right.targetY = 9;
    hands.left.strike = 1.0;
    hands.right.strike = 1.0;
    hands.left.color = '#ffb04f';
    hands.right.color = '#ffb04f';
    spawnParticles(0, 9, '#ffb04f', 10);
    spawnWave(0, 9, 14, '#ffb04f');
    callout = { text: `${beat}`, color: '#ffb04f', timer: 0.36 };
    updateBadge();
  }

  function updateConfig({ beats, laneMuted, laneSounds, beatEnabled, layout } = {}) {
    if (Number.isInteger(beats) && beats > 0) music.beats = beats;
    if (Array.isArray(laneMuted)) music.laneMuted = laneMuted.slice(0, 3);
    if (Array.isArray(laneSounds)) music.laneSounds = laneSounds.slice(0, 3);
    if (beatEnabled !== undefined) music.beatEnabled = beatEnabled;
    if (layout) {
      music.visualStarts = layout.visualStarts;
      music.visualWidths = layout.visualWidths;
      music.visualTotal = layout.visualTotal;
    }
    updateBadge();
    if (enabled && !playing) render();
  }

  function advancePhysics(now) {
    const dt = lastTime > 0 ? Math.min(0.05, Math.max(0.001, (now - lastTime) / 1000)) : 0.016;
    lastTime = now;
    tick += dt * 60;

    downbeatFlash = Math.max(0, downbeatFlash - dt * 3.8);
    countInFlash = Math.max(0, countInFlash - dt * 4.4);
    headNod = Math.max(0, headNod - dt * 5.6);
    ampPump = Math.max(0, ampPump - dt * 5.8);
    callout.timer = Math.max(0, callout.timer - dt);
    hands.left.strike = Math.max(0, hands.left.strike - dt * 5.6);
    hands.right.strike = Math.max(0, hands.right.strike - dt * 5.6);
    for (const piece of Object.values(KIT)) {
      piece.flash = Math.max(0, piece.flash - dt * 4.8);
    }
    for (let i = 0; i < 3; i++) {
      music.laneFlash[i] = Math.max(0, music.laneFlash[i] - dt * 4.8);
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) particles.splice(i, 1);
      else { p.dx += p.vx * dt; p.y += p.vy * dt; p.vy += 42 * dt; }
    }
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      shockwaves[i].life -= dt;
      if (shockwaves[i].life <= 0) shockwaves.splice(i, 1);
    }
  }

  function render() {
    if (!enabled || !ensureCanvas()) return;
    const measured = measureCssSize();
    if (
      canvas.width === 0 ||
      canvas.height === 0 ||
      measured.cssW !== lastCssW ||
      measured.cssH !== lastCssH ||
      measured.dpr !== lastDpr
    ) {
      resize();
    }

    const cx = Math.floor(vw / 2);
    // Anchor stage riser to bottom so extra vertical headroom on narrow 320px
    // screens extends the cozy wall smoothly above instead of leaving floor gap.
    const y0 = Math.max(0, vh - VH);
    const allMuted = music.laneMuted.every(Boolean);
    const reduce = reducedMotion();

    // 1. Studio Ceiling & Back Wall
    g.fillStyle = '#0b0e17';
    g.fillRect(0, 0, vw, vh);

    const wallBottom = y0 + 46;
    g.fillStyle = '#131828';
    g.fillRect(0, 6, vw, wallBottom - 6);
    g.fillStyle = '#181f34';
    for (let x = (cx % 14); x < vw; x += 14) {
      g.fillRect(x, 6, 2, wallBottom - 6);
    }
    // Mid-wall wainscot rail & baseboard
    g.fillStyle = '#1d253d';
    g.fillRect(0, y0 + 28, vw, 1);
    g.fillStyle = '#252f4c';
    g.fillRect(0, wallBottom - 2, vw, 2);

    // Compact Ceiling Lighting Truss (y: 0..6) with integrated Metronome Pendulum Bar!
    g.fillStyle = '#151b2c';
    g.fillRect(0, 0, vw, 6);
    g.fillStyle = '#242e48';
    g.fillRect(0, 4, vw, 2);
    g.fillStyle = '#313f63';
    for (let x = 4; x < vw; x += 12) g.fillRect(x, 1, 4, 3);

    const spotAccent = music.countIn
      ? '#ffb04f'
      : (music.inRepeat ? '#b18cff' : (downbeatFlash > 0.2 ? '#fde047' : '#ff5d4f'));

    // Sleek overhead metronome pendulum LED track embedded inside truss (zero overlap with drummer!)
    const railW = 68;
    const railX = cx - Math.floor(railW / 2);
    g.fillStyle = '#070a12';
    g.fillRect(railX - 1, 1, railW + 2, 4);
    g.fillStyle = '#1b243c';
    g.fillRect(railX, 2, railW, 2);
    if (playing) {
      const pend = Math.sin(music.visualPhase * music.beats * Math.PI);
      const ledX = Math.round(cx + pend * 28);
      g.fillStyle = spotAccent;
      g.fillRect(ledX - 3, 1, 6, 4);
      g.fillStyle = '#ffffff';
      g.fillRect(ledX - 1, 2, 2, 2);
    }

    // Overhead spotlight cans
    for (const sx of [cx - 60, cx + 60]) {
      g.fillStyle = '#0b0e17';
      g.fillRect(sx - 4, 5, 8, 4);
      g.fillStyle = '#334155';
      g.fillRect(sx - 3, 6, 6, 2);
      g.fillStyle = (downbeatFlash > 0.2 || countInFlash > 0.2 || music.inRepeat) ? spotAccent : '#64748b';
      g.fillRect(sx - 2, 8, 4, 1);
    }

    // Soft volumetric stage spotlight cone
    if (!reduce) {
      const beamAlpha = 0.045 + (downbeatFlash * 0.11) + (countInFlash * 0.1) + (music.inRepeat ? 0.04 : 0);
      g.save();
      g.globalAlpha = beamAlpha;
      g.fillStyle = spotAccent;
      for (let i = 0; i < 58; i++) {
        const spread = Math.floor(i * 1.15);
        g.fillRect(cx - 16 - spread, y0 + 7 + i, 32 + spread * 2, 1);
      }
      g.restore();
    }

    // 2. Studio Wall Props (expand gracefully across phones, desktops, and ultrawides!)
    const drawAcousticPanel = (px, py) => {
      if (px + 24 < 0 || px > vw) return;
      g.fillStyle = '#0d1220';
      g.fillRect(px, py, 24, 15);
      g.fillStyle = '#1f2944';
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 4; c++) {
          g.fillRect(px + 2 + c * 6, py + 2 + r * 4, 4, 2);
        }
      }
    };

    // Stereo Live 3-Lane EQ Wall Monitors tucked cleanly left & right of drummer!
    const drawEqPanel = (ex, ey) => {
      if (ex + 22 < 2 || ex > vw - 2) return;
      g.fillStyle = '#070a12';
      g.fillRect(ex, ey, 22, 12);
      g.fillStyle = (downbeatFlash > 0.2 || countInFlash > 0.2) ? spotAccent : '#2a3656';
      g.fillRect(ex, ey, 22, 1);
      g.fillRect(ex, ey + 11, 22, 1);
      g.fillRect(ex, ey, 1, 12);
      g.fillRect(ex + 21, ey, 1, 12);
      for (let i = 0; i < 3; i++) {
        const muted = music.laneMuted[i];
        const sound = music.laneSounds[i] || 'click';
        const col = DRUM_VOICE_MAP[sound]?.color || '#64748b';
        const amp = (!playing || muted)
          ? 2
          : Math.min(8, Math.max(2, Math.round(2 + music.laneFlash[i] * 6 + (reduce ? 0 : Math.abs(Math.sin(tick * 0.16 + i)) * 1.2))));
        g.fillStyle = muted ? '#27314a' : col;
        g.fillRect(ex + 3 + i * 6, ey + 10 - amp, 4, amp);
      }
    };
    drawEqPanel(cx - 88, y0 + 10);
    drawEqPanel(cx + 66, y0 + 10);

    if (vw >= 260) {
      drawAcousticPanel(cx - 122, y0 + 11);
      drawAcousticPanel(cx + 98, y0 + 11);
    }
    if (vw >= 340) {
      // Framed gold vinyl record plaque (left)
      const rx = cx - 152;
      g.fillStyle = '#0b0e17';
      g.fillRect(rx, y0 + 10, 18, 18);
      g.fillStyle = '#2b3656';
      g.fillRect(rx + 1, y0 + 11, 16, 16);
      g.fillStyle = '#131828';
      g.fillRect(rx + 2, y0 + 12, 14, 14);
      drawEllipse(g, rx + 9, y0 + 19, 5, 5, '#eab308', '#0b0e17');
      drawEllipse(g, rx + 9, y0 + 19, 2, 2, '#ff5d4f');

      // Framed studio waveform art (right)
      const wx = cx + 132;
      g.fillStyle = '#0b0e17';
      g.fillRect(wx, y0 + 11, 26, 14);
      g.fillStyle = '#25314d';
      g.fillRect(wx + 1, y0 + 12, 24, 12);
      g.fillStyle = '#0e1424';
      g.fillRect(wx + 2, y0 + 13, 22, 10);
      const waveCols = ['#ff5d4f', '#e2e6f0', '#6cb4ff', '#4ce3a8'];
      for (let i = 0; i < 6; i++) {
        const wh = 2 + ((i * 3 + 2) % 6);
        g.fillStyle = waveCols[i % waveCols.length];
        g.fillRect(wx + 4 + i * 3, y0 + 18 - Math.floor(wh / 2), 2, wh);
      }
    }
    if (vw >= 460) {
      // Colorful vinyl record shelf (far left)
      const sx = cx - 230;
      g.fillStyle = '#0b0e17';
      g.fillRect(sx, y0 + 12, 40, 20);
      g.fillStyle = '#251e34';
      g.fillRect(sx + 1, y0 + 13, 38, 18);
      g.fillStyle = '#15192a';
      g.fillRect(sx + 2, y0 + 14, 36, 7);
      g.fillRect(sx + 2, y0 + 23, 36, 7);
      const spines = ['#ff5d4f', '#ffb04f', '#4ce3a8', '#6cb4ff', '#b18cff', '#e2e6f0', '#4fdce3'];
      for (let i = 0; i < 11; i++) {
        g.fillStyle = spines[i % spines.length];
        g.fillRect(sx + 3 + i * 3, y0 + 15, 2, 6);
        g.fillStyle = spines[(i + 3) % spines.length];
        g.fillRect(sx + 3 + i * 3, y0 + 24, 2, 6);
      }
      drawAcousticPanel(cx + 184, y0 + 11);
      drawAcousticPanel(cx - 266, y0 + 11);
    }
    if (vw >= 600) {
      // Tile subtle acoustic panels smoothly across desktop & ultrawide (3440px / 5120px+)
      for (let dist = 290; dist < cx - 28; dist += 116) {
        drawAcousticPanel(cx - dist - 24, y0 + 11);
        drawAcousticPanel(cx + dist, y0 + 11);
      }
    }

    // 3. Warm Wood Studio Floor
    g.fillStyle = '#1e1827';
    g.fillRect(0, wallBottom, vw, vh - wallBottom);
    g.fillStyle = '#251e31';
    for (let y = wallBottom + 4; y < vh; y += 7) g.fillRect(0, y, vw, 1);
    g.fillStyle = '#181320';
    for (let y = wallBottom; y < vh; y += 14) {
      const offset = (y % 28 === 0) ? 0 : 18;
      for (let x = offset; x < vw; x += 36) g.fillRect(x, y, 1, 7);
    }

    // 4. Left Floor Props: Vintage Studio Amp (pumps on Kick!) + Warm Floor Lamp + Guitar
    const ampX = cx - 114;
    const ampY = y0 + 29;
    if (ampX + 26 > 2) {
      g.fillStyle = '#0b0e17';
      g.fillRect(ampX - 1, ampY - 1, 28, 28);
      g.fillStyle = '#20263b';
      g.fillRect(ampX, ampY, 26, 26);
      g.fillStyle = '#2f3957';
      g.fillRect(ampX + 1, ampY + 1, 24, 5);
      g.fillStyle = '#94a3b8';
      g.fillRect(ampX + 3, ampY + 3, 2, 2);
      g.fillRect(ampX + 7, ampY + 3, 2, 2);
      g.fillRect(ampX + 11, ampY + 3, 2, 2);
      g.fillStyle = '#4ce3a8';
      g.fillRect(ampX + 21, ampY + 3, 2, 2);
      g.fillStyle = '#0e1220';
      g.fillRect(ampX + 3, ampY + 8, 20, 15);
      const conePump = !reduce && ampPump > 0.35;
      drawEllipse(g, ampX + 13, ampY + 15, conePump ? 7 : 6, conePump ? 6 : 5, '#1a2238', conePump ? '#ffb04f' : '#334155');
      drawEllipse(g, ampX + 13, ampY + 15, 2, 2, conePump ? '#fde047' : '#475569');
    }

    const lampX = cx - 136;
    if (lampX > 4) {
      g.fillStyle = '#475569';
      g.fillRect(lampX + 3, y0 + 29, 2, 26);
      g.fillRect(lampX - 1, y0 + 54, 10, 2);
      g.fillStyle = '#0b0e17';
      g.fillRect(lampX - 3, y0 + 20, 14, 10);
      g.fillStyle = '#d97706';
      g.fillRect(lampX - 2, y0 + 21, 12, 8);
      g.fillStyle = '#f59e0b';
      g.fillRect(lampX - 1, y0 + 22, 10, 4);
      g.fillStyle = '#fef08a';
      g.fillRect(lampX, y0 + 27, 8, 2);
    }

    if (vw >= 340) {
      const gx = cx - 170;
      g.fillStyle = '#475569';
      g.fillRect(gx + 3, y0 + 53, 10, 2);
      g.fillStyle = '#0b0e17';
      g.fillRect(gx + 6, y0 + 24, 4, 16);
      g.fillStyle = '#d97706';
      g.fillRect(gx + 7, y0 + 25, 2, 14);
      drawEllipse(g, gx + 8, y0 + 46, 6, 7, '#ff5d4f', '#0b0e17');
      drawEllipse(g, gx + 8, y0 + 40, 4, 4, '#ff5d4f', '#0b0e17');
      g.fillStyle = '#f8fafc';
      g.fillRect(gx + 6, y0 + 44, 4, 4);
      g.fillStyle = '#1e293b';
      g.fillRect(gx + 7, y0 + 38, 2, 10);
    }

    // 5. Right Floor Props: Studio Desk + Monitor Speaker + Mixer + Steaming Coffee Mug
    const deskX = cx + 88;
    const deskY = y0 + 37;
    if (deskX < vw - 4) {
      g.fillStyle = '#0b0e17';
      g.fillRect(deskX - 1, deskY, 44, 20);
      g.fillStyle = '#2a2234';
      g.fillRect(deskX, deskY + 1, 42, 18);
      g.fillStyle = '#413452';
      g.fillRect(deskX, deskY + 1, 42, 2);
      g.fillStyle = '#0b0e17';
      g.fillRect(deskX + 3, deskY - 13, 15, 14);
      g.fillStyle = '#1c243a';
      g.fillRect(deskX + 4, deskY - 12, 13, 12);
      g.fillStyle = '#0d1220';
      g.fillRect(deskX + 6, deskY - 10, 9, 8);
      drawEllipse(g, deskX + 10, deskY - 6, 3, 3, '#23304f', (!reduce && ampPump > 0.3) ? '#38bdf8' : '#475569');
      const ledColors = ['#ff5d4f', '#e2e6f0', '#6cb4ff', '#4ce3a8'];
      for (let k = 0; k < 4; k++) {
        const lit = playing && !allMuted && (((Math.floor(tick / 8) + k) % 2) === 0);
        g.fillStyle = lit ? ledColors[k] : '#26314c';
        g.fillRect(deskX + 21 + k * 4, deskY - 3, 2, 3);
      }
      g.fillStyle = '#f8fafc';
      g.fillRect(deskX + 29, deskY - 5, 5, 5);
      g.fillStyle = '#78350f';
      g.fillRect(deskX + 30, deskY - 4, 3, 2);
      if (!reduce) {
        const steam = Math.floor((tick / 14) % 5);
        g.fillStyle = 'rgba(226, 232, 240, 0.42)';
        g.fillRect(deskX + 31, deskY - 8 - steam, 1, 2);
      }
    }

    if (vw >= 340) {
      const kx = cx + 144;
      g.fillStyle = '#475569';
      drawLine(g, kx + 4, y0 + 44, kx + 22, y0 + 56, '#475569', 1);
      drawLine(g, kx + 22, y0 + 44, kx + 4, y0 + 56, '#475569', 1);
      g.fillStyle = '#0b0e17';
      g.fillRect(kx, y0 + 37, 28, 8);
      g.fillStyle = '#1e293b';
      g.fillRect(kx + 1, y0 + 38, 26, 6);
      g.fillStyle = '#f8fafc';
      g.fillRect(kx + 2, y0 + 41, 24, 3);
      g.fillStyle = '#0f172a';
      for (let i = 0; i < 6; i++) g.fillRect(kx + 4 + i * 4, y0 + 41, 1, 2);
      g.fillStyle = music.laneFlash[2] > 0.2 ? '#6cb4ff' : '#38bdf8';
      g.fillRect(kx + 3, y0 + 39, 4, 1);
    }

    if (vw >= 460) {
      // Right studio VU rack tower
      const tx = cx + 196;
      g.fillStyle = '#0b0e17';
      g.fillRect(tx, y0 + 21, 26, 36);
      g.fillStyle = '#1c2338';
      g.fillRect(tx + 1, y0 + 22, 24, 34);
      for (let r = 0; r < 4; r++) {
        g.fillStyle = '#0e1322';
        g.fillRect(tx + 3, y0 + 25 + r * 8, 20, 5);
        g.fillStyle = r === 0 ? '#4ce3a8' : (r === 1 ? '#38bdf8' : (r === 2 ? '#ffb04f' : '#ff5d4f'));
        g.fillRect(tx + 5, y0 + 27 + r * 8, 4 + ((r * 3 + (playing ? Math.floor(tick / 6) % 5 : 2)) % 8), 2);
        g.fillStyle = '#64748b';
        g.fillRect(tx + 19, y0 + 27 + r * 8, 2, 2);
      }
    }

    if (vw >= 580) {
      const drawPlant = (px) => {
        g.fillStyle = '#0b0e17';
        g.fillRect(px + 2, y0 + 44, 12, 13);
        g.fillStyle = '#9a4f38';
        g.fillRect(px + 3, y0 + 45, 10, 11);
        g.fillStyle = '#b96548';
        g.fillRect(px + 2, y0 + 45, 12, 2);
        drawEllipse(g, px + 8, y0 + 38, 7, 5, '#15803d', '#0b0e17');
        drawEllipse(g, px + 5, y0 + 34, 4, 4, '#22c55e', '#0b0e17');
        drawEllipse(g, px + 11, y0 + 35, 4, 4, '#4ade80', '#0b0e17');
      };
      drawPlant(cx - 268);
      drawPlant(cx + 254);
    }

    // 6. Raised 2.5D Wooden Drum Riser + Patterned Studio Drum Rug
    const riserW = 166;
    const riserX = cx - Math.floor(riserW / 2);
    g.fillStyle = 'rgba(0, 0, 0, 0.45)';
    g.fillRect(riserX - 2, y0 + 77, riserW + 4, 3);
    g.fillStyle = '#0b0e17';
    g.fillRect(riserX - 1, y0 + 49, riserW + 2, 29);
    g.fillStyle = '#2d2238';
    g.fillRect(riserX, y0 + 50, riserW, 21);
    g.fillStyle = '#3c2142';
    g.fillRect(cx - 75, y0 + 52, 150, 17);
    g.fillStyle = downbeatFlash > 0.25 ? '#ff5d4f' : '#5e315d';
    g.fillRect(cx - 73, y0 + 53, 146, 1);
    g.fillRect(cx - 73, y0 + 67, 146, 1);
    g.fillRect(cx - 73, y0 + 53, 1, 15);
    g.fillRect(cx + 72, y0 + 53, 1, 15);
    g.fillStyle = '#2d1836';
    g.fillRect(cx - 71, y0 + 55, 142, 11);
    g.fillStyle = '#c9a67d';
    for (let y = y0 + 53; y <= y0 + 67; y += 3) {
      g.fillRect(cx - 77, y, 2, 1);
      g.fillRect(cx + 75, y, 2, 1);
    }
    // Riser front wooden apron (houses Beat LEDs!)
    g.fillStyle = '#3f3152';
    g.fillRect(riserX, y0 + 71, riserW, 1);
    g.fillStyle = '#14101d';
    g.fillRect(riserX, y0 + 72, riserW, 6);

    // 7. HERO PIXEL DRUMMER (bigger, expressive close-up behind the kit at `cx`)
    const nodY = reduce ? 0 : Math.round(headNod * 2.2);
    const breathY = (!playing || allMuted) && !reduce ? Math.round(Math.sin(tick * 0.08) * 0.6) : 0;
    const dy = y0 + nodY + breathY;
    const blink = (Math.floor(tick) % 160) > 154;

    // Drum throne stem
    g.fillStyle = '#475569';
    g.fillRect(cx - 1, y0 + 50, 3, 14);

    // Shaded Studio Hoodie Torso
    g.fillStyle = '#0b0e17';
    g.fillRect(cx - 14, 31 + dy, 28, 22);
    g.fillStyle = '#2f3fa8';
    g.fillRect(cx - 13, 32 + dy, 26, 20);
    g.fillStyle = '#586ee8';
    g.fillRect(cx - 12, 32 + dy, 24, 4);
    g.fillStyle = '#1e2870';
    g.fillRect(cx - 13, 36 + dy, 3, 15);
    g.fillRect(cx + 10, 36 + dy, 3, 15);
    g.fillStyle = '#1b224a';
    g.fillRect(cx - 5, 32 + dy, 10, 3);
    g.fillStyle = '#cbd5e1';
    g.fillRect(cx - 3, 35 + dy, 1, 5);
    g.fillRect(cx + 2, 35 + dy, 1, 5);
    g.fillStyle = downbeatFlash > 0.2 ? '#fde047' : '#ff5d4f';
    g.fillRect(cx - 4, 41 + dy, 2, 4);
    g.fillStyle = '#38bdf8';
    g.fillRect(cx - 1, 39 + dy, 2, 6);
    g.fillStyle = '#4ce3a8';
    g.fillRect(cx + 2, 40 + dy, 2, 5);

    // Neck
    g.fillStyle = '#d49d7a';
    g.fillRect(cx - 3, 28 + dy, 6, 4);

    // Over-Ear Studio Headphone Arch
    g.fillStyle = '#0b0e17';
    g.fillRect(cx - 11, 10 + dy, 22, 4);
    g.fillRect(cx - 12, 13 + dy, 3, 6);
    g.fillRect(cx + 9, 13 + dy, 3, 6);
    g.fillStyle = '#38bdf8';
    g.fillRect(cx - 9, 11 + dy, 18, 2);
    g.fillStyle = '#bae6fd';
    g.fillRect(cx - 5, 11 + dy, 10, 1);

    // Head Silhouette & Layered Hair (20x16 px hero head!)
    g.fillStyle = '#0b0e17';
    g.fillRect(cx - 10, 13 + dy, 20, 16);
    g.fillStyle = '#1b2240';
    g.fillRect(cx - 9, 14 + dy, 18, 5);
    g.fillStyle = '#2d3966';
    g.fillRect(cx - 7, 14 + dy, 8, 2);
    g.fillRect(cx + 2, 15 + dy, 5, 2);
    // Face skin + warm cheek/chin shading
    g.fillStyle = '#f6d2b4';
    g.fillRect(cx - 9, 18 + dy, 18, 10);
    g.fillStyle = '#e6b896';
    g.fillRect(cx - 9, 26 + dy, 18, 2);
    g.fillStyle = '#f2a494';
    g.fillRect(cx - 8, 24 + dy, 2, 1);
    g.fillRect(cx + 6, 24 + dy, 2, 1);

    // Over-Ear Headphone Cups
    const cupLed = countInFlash > 0.2 ? '#ffb04f' : (downbeatFlash > 0.25 ? '#fde047' : '#ff5d4f');
    g.fillStyle = '#0b0e17';
    g.fillRect(cx - 13, 17 + dy, 4, 8);
    g.fillRect(cx + 9, 17 + dy, 4, 8);
    g.fillStyle = '#1e293b';
    g.fillRect(cx - 12, 18 + dy, 2, 6);
    g.fillRect(cx + 10, 18 + dy, 2, 6);
    g.fillStyle = cupLed;
    g.fillRect(cx - 12, 20 + dy, 2, 2);
    g.fillRect(cx + 10, 20 + dy, 2, 2);

    // Expressive Eyes & Mouth
    if (allMuted) {
      g.fillStyle = '#1e293b';
      g.fillRect(cx - 6, 21 + dy, 3, 1);
      g.fillRect(cx + 3, 21 + dy, 3, 1);
      g.fillStyle = '#9a5b42';
      g.fillRect(cx - 2, 25 + dy, 4, 1);
      const zb = reduce ? 0 : Math.round(Math.sin(tick * 0.1) * 2);
      g.fillStyle = '#94a3b8';
      g.fillRect(cx + 14, y0 + 11 + zb, 4, 1);
      g.fillRect(cx + 16, y0 + 12 + zb, 1, 1);
      g.fillRect(cx + 14, y0 + 13 + zb, 4, 1);
    } else if (downbeatFlash > 0.35) {
      g.fillStyle = '#0b0e17';
      g.fillRect(cx - 6, 21 + dy, 1, 1); g.fillRect(cx - 5, 20 + dy, 1, 1); g.fillRect(cx - 4, 21 + dy, 1, 1);
      g.fillRect(cx + 3, 21 + dy, 1, 1); g.fillRect(cx + 4, 20 + dy, 1, 1); g.fillRect(cx + 5, 21 + dy, 1, 1);
      g.fillStyle = '#9a3412';
      g.fillRect(cx - 3, 24 + dy, 6, 2);
      g.fillStyle = '#ffffff';
      g.fillRect(cx - 2, 24 + dy, 4, 1);
    } else if (blink) {
      g.fillStyle = '#0b0e17';
      g.fillRect(cx - 6, 21 + dy, 3, 1);
      g.fillRect(cx + 3, 21 + dy, 3, 1);
      g.fillStyle = '#9a5b42';
      g.fillRect(cx - 2, 25 + dy, 4, 1);
    } else {
      g.fillStyle = '#0b0e17';
      g.fillRect(cx - 6, 20 + dy, 2, 3);
      g.fillRect(cx + 4, 20 + dy, 2, 3);
      g.fillStyle = '#ffffff';
      g.fillRect(cx - 6, 20 + dy, 1, 1);
      g.fillRect(cx + 4, 20 + dy, 1, 1);
      g.fillStyle = '#9a5b42';
      g.fillRect(cx - 2, 25 + dy, 4, 1);
    }

    // 8. FULL 2.5D PIXEL DRUM KIT (layered cleanly back-to-front!)
    const drawStand = (sx, topY, bottomY) => {
      g.fillStyle = '#475569';
      g.fillRect(sx, topY, 2, bottomY - topY);
      g.fillStyle = '#94a3b8';
      g.fillRect(sx, topY, 1, bottomY - topY);
      drawLine(g, sx, bottomY - 4, sx - 6, bottomY, '#64748b', 1);
      drawLine(g, sx + 1, bottomY - 4, sx + 7, bottomY, '#64748b', 1);
    };
    drawStand(cx + KIT.crash.dx, y0 + KIT.crash.y + 2, y0 + 64);
    drawStand(cx + KIT.hat.dx, y0 + KIT.hat.y + 3, y0 + 66);
    drawStand(cx + KIT.ride.dx, y0 + KIT.ride.y + 2, y0 + 64);
    drawStand(cx + KIT.woodblock.dx + 8, y0 + KIT.clave.y + 2, y0 + 64);

    // Crash Cymbal (left) & Ride Cymbal (right)
    const crashTilt = reduce ? 0 : Math.sin(KIT.crash.flash * 12) * KIT.crash.flash * 3;
    drawCymbal(g, cx + KIT.crash.dx, y0 + KIT.crash.y, 14, 4, crashTilt, KIT.crash.flash, '#eab308', '#fef08a', '#92400e');
    const rideTilt = reduce ? 0 : Math.sin(KIT.ride.flash * 12) * KIT.ride.flash * 2.5;
    drawCymbal(g, cx + KIT.ride.dx, y0 + KIT.ride.y, 14, 4, rideTilt, KIT.ride.flash, '#d97706', '#fde68a', '#78350f');

    // Hi-Hat (dual silver ellipses)
    const hatOpen = !reduce && KIT.hat.flash > 0.22 ? 2 : 0;
    drawCymbal(g, cx + KIT.hat.dx, y0 + KIT.hat.y + 2, 10, 3, 0, KIT.hat.flash * 0.5, '#94a3b8', '#cbd5e1', '#475569');
    drawCymbal(g, cx + KIT.hat.dx, y0 + KIT.hat.y - hatOpen, 11, 3, reduce ? 0 : (KIT.hat.flash > 0.2 ? 1 : 0), KIT.hat.flash, '#cbd5e1', '#ffffff', '#64748b');

    // High Tom / Click Drum (coral shell)
    const tomBounce = !reduce && KIT.tom.flash > 0.22 ? 1 : 0;
    drawDrumShell(
      g,
      cx + KIT.tom.dx,
      y0 + KIT.tom.y + tomBounce,
      10,
      4,
      9,
      KIT.tom.flash > 0.22 ? '#ffffff' : '#f1f5f9',
      KIT.tom.flash > 0.22 ? '#ff857a' : '#ff5d4f',
      '#b83227',
      '#e2e6f0',
    );
    if (KIT.tom.flash > 0.22) {
      drawEllipse(g, cx + KIT.tom.dx, y0 + KIT.tom.y + tomBounce, 7, 2, '#ff5d4f');
    }

    // Mounted Cowbell (blue steel bell)
    const cbShift = !reduce && KIT.cowbell.flash > 0.2 ? (KIT.cowbell.tilt > 0 ? 1 : -1) : 0;
    const cbx = cx + KIT.cowbell.dx + cbShift;
    const cby = y0 + KIT.cowbell.y;
    g.fillStyle = '#64748b';
    g.fillRect(cbx - 1, cby + 5, 2, 12);
    g.fillStyle = '#0b0e17';
    g.fillRect(cbx - 6, cby - 5, 12, 12);
    g.fillStyle = KIT.cowbell.flash > 0.22 ? '#ffffff' : '#6cb4ff';
    g.fillRect(cbx - 4, cby - 4, 8, 3);
    g.fillRect(cbx - 5, cby - 1, 10, 6);
    g.fillStyle = '#93c5fd';
    g.fillRect(cbx - 3, cby - 3, 3, 7);
    g.fillStyle = '#1e3a8a';
    g.fillRect(cbx - 4, cby + 3, 8, 2);

    // Woodblock (warm walnut block on right rack)
    const wbY = y0 + KIT.woodblock.y + (!reduce && KIT.woodblock.flash > 0.22 ? 1 : 0);
    g.fillStyle = '#0b0e17';
    g.fillRect(cx + KIT.woodblock.dx - 7, wbY - 4, 14, 9);
    g.fillStyle = KIT.woodblock.flash > 0.22 ? '#fde68a' : '#c98a5b';
    g.fillRect(cx + KIT.woodblock.dx - 6, wbY - 3, 12, 7);
    g.fillStyle = '#e6b087';
    g.fillRect(cx + KIT.woodblock.dx - 6, wbY - 3, 12, 2);
    g.fillStyle = '#451a03';
    g.fillRect(cx + KIT.woodblock.dx - 5, wbY, 10, 2);

    // Clave / Jam Block (electric cyan)
    const clY = y0 + KIT.clave.y + (!reduce && KIT.clave.flash > 0.22 ? 1 : 0);
    g.fillStyle = '#0b0e17';
    g.fillRect(cx + KIT.clave.dx - 6, clY - 3, 13, 7);
    g.fillStyle = KIT.clave.flash > 0.22 ? '#ffffff' : '#4fdce3';
    g.fillRect(cx + KIT.clave.dx - 5, clY - 2, 11, 5);
    g.fillStyle = '#a5f3fc';
    g.fillRect(cx + KIT.clave.dx - 5, clY - 2, 11, 1);

    // Floor Tom (front-right)
    drawDrumShell(
      g,
      cx + 35,
      y0 + 52,
      11,
      4,
      14,
      '#eef2f7',
      '#334155',
      '#1e293b',
      '#cbd5e1',
    );
    g.fillStyle = '#64748b';
    g.fillRect(cx + 25, y0 + 64, 1, 6);
    g.fillRect(cx + 45, y0 + 64, 1, 6);

    // Snare Drum (front-left)
    const snY = y0 + KIT.snare.y + (!reduce && KIT.snare.flash > 0.22 ? 1 : 0);
    drawStand(cx + KIT.snare.dx, snY + 9, y0 + 69);
    const snRimFlash = KIT.snare.flash > 0.22;
    drawDrumShell(
      g,
      cx + KIT.snare.dx,
      snY,
      12,
      4,
      9,
      snRimFlash ? '#ffffff' : '#f1f5f9',
      snRimFlash ? (KIT.snare.rim ? '#ff84be' : '#4ce3a8') : '#2bb583',
      '#136e4d',
      '#e2e6f0',
      snRimFlash && KIT.snare.rim ? '#ff84be' : '#0b0e18',
    );
    if (snRimFlash) {
      drawEllipse(g, cx + KIT.snare.dx, snY, 8, 2, KIT.snare.rim ? '#ff84be' : '#4ce3a8');
    }

    // HERO CENTER BASS DRUM (front & center with Oddmeter 3-bar emblem!)
    const kickPunch = !reduce && KIT.kick.flash > 0.3;
    const kickR = kickPunch ? 16 : 15;
    const kickY = y0 + KIT.kick.y;
    drawLine(g, cx - 14, kickY + 6, cx - 19, kickY + 13, '#94a3b8', 1);
    drawLine(g, cx + 14, kickY + 6, cx + 19, kickY + 13, '#94a3b8', 1);
    drawEllipse(g, cx, kickY + 1, kickR + 1, kickR, '#0b0e17');
    drawEllipse(g, cx, kickY, kickR, kickR, kickPunch ? '#ffb04f' : '#29324a', '#0b0e17');
    drawEllipse(g, cx, kickY, kickR - 2, kickR - 2, kickPunch ? '#fffbeb' : '#f2efe6', kickPunch ? '#fde047' : '#94a3b8');
    g.fillStyle = kickPunch ? '#fde68a' : '#dcd7c8';
    g.fillRect(cx - 9, kickY + 9, 18, 2);
    g.fillStyle = '#cbd5e1';
    for (const [lx, ly] of [[-13, -5], [12, -5], [-13, 4], [12, 4], [0, -14]]) {
      g.fillRect(cx + lx, kickY + ly, 2, 2);
    }
    drawEllipse(g, cx + 6, kickY + 5, 2, 2, '#0b0e17');
    g.fillStyle = kickPunch ? '#ff5d4f' : '#1e2436';
    g.fillRect(cx - 6, kickY - 2, 3, 6);
    g.fillRect(cx - 1, kickY - 6, 3, 10);
    g.fillRect(cx + 4, kickY - 4, 3, 8);

    // 9. ARTICULATED PIXEL ARMS + OUTLINED DRUMSTICKS + MOTION SMEAR ARCS
    const drawArm = (side, shoulderX, shoulderY) => {
      const h = hands[side];
      const s = h.strike;
      const lift = reduce
        ? 0
        : (s > 0.72 ? (1 - s) * 10 : (s > 0.14 ? Math.sin(((s - 0.14) / 0.58) * Math.PI) * 8 : 0));
      const blend = Math.min(1, s * 2.4);
      const tipX = cx + h.restDx + (h.targetDx - h.restDx) * blend;
      const tipY = y0 + h.restY + (h.targetY - h.restY) * blend - lift;

      const elbowX = side === 'left' ? shoulderX - 10 : shoulderX + 10;
      const elbowY = shoulderY + 7 - Math.round(lift * 0.4);
      const handX = Math.round(elbowX + (tipX - elbowX) * 0.44);
      const handY = Math.round(elbowY + (tipY - elbowY) * 0.44) - 1;

      if (!reduce && s > 0.55) {
        g.save();
        g.globalAlpha = (s - 0.55) * 1.4;
        drawLine(g, handX, handY, tipX, tipY - 7, h.color, 1);
        drawLine(g, handX, handY, tipX, tipY - 4, '#ffffff', 1);
        g.restore();
      }

      drawLine(g, shoulderX, shoulderY, elbowX, elbowY, '#0b0e17', 4);
      drawLine(g, shoulderX, shoulderY, elbowX, elbowY, '#2f3fa8', 2);
      drawLine(g, elbowX, elbowY, handX, handY, '#0b0e17', 3);
      drawLine(g, elbowX, elbowY, handX, handY, '#495fd4', 2);
      g.fillStyle = '#0b0e17';
      g.fillRect(handX - 2, handY - 2, 5, 5);
      g.fillStyle = '#f6d2b4';
      g.fillRect(handX - 1, handY - 1, 3, 3);
      drawLine(g, handX, handY + 1, tipX, tipY + 1, '#0b0e17', 1);
      drawLine(g, handX, handY, tipX, tipY, '#fef3c7', 1);
      g.fillStyle = s > 0.42 ? h.color : '#fde68a';
      g.fillRect(Math.round(tipX) - 1, Math.round(tipY) - 1, 2, 2);
    };

    if (!allMuted) {
      drawArm('left', cx - 13, 35 + dy);
      drawArm('right', cx + 13, 35 + dy);
    } else {
      drawLine(g, cx - 13, 35 + dy, cx - 18, 44 + dy, '#2f3fa8', 2);
      drawLine(g, cx + 13, 35 + dy, cx + 18, 44 + dy, '#2f3fa8', 2);
    }

    // 10. Impact Shockwaves & Voice-Colored Pixel Sparks
    for (const sw of shockwaves) {
      const prog = 1 - sw.life / sw.max;
      const r = sw.r + (sw.maxR - sw.r) * prog;
      g.save();
      g.globalAlpha = Math.max(0, sw.life / sw.max) * 0.78;
      g.strokeStyle = sw.color;
      g.lineWidth = 1;
      g.beginPath();
      g.arc(Math.round(cx + sw.dx) + 0.5, Math.round(y0 + sw.y) + 0.5, Math.round(r), 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }

    for (const p of particles) {
      g.save();
      g.globalAlpha = Math.max(0, p.life / p.max);
      g.fillStyle = p.color;
      g.fillRect(Math.round(cx + p.dx), Math.round(y0 + p.y), p.size, p.size);
      g.restore();
    }

    // 11. Integrated Riser Floor Beat LEDs (proportional to beat trims/extensions!)
    const ledTotalW = riserW - 10;
    const ledX0 = riserX + 5;
    const ledY = y0 + 73;
    const count = Math.max(1, music.beats);
    const totalSpan = music.visualTotal > 0 ? music.visualTotal : count;
    const gap = count > 16 ? 1 : 2;
    for (let b = 0; b < count; b++) {
      const startFrac = music.visualStarts ? music.visualStarts[b] / totalSpan : b / count;
      const widthFrac = music.visualWidths ? music.visualWidths[b] / totalSpan : 1 / count;
      const bx = Math.round(ledX0 + startFrac * ledTotalW);
      const bw = Math.max(2, Math.round(widthFrac * ledTotalW) - gap);
      const skipped = music.beatEnabled ? music.beatEnabled[b] === false : false;
      const active = playing && (music.countIn ? (b === music.countBeat - 1) : (b === music.activeBeat));

      if (skipped && !music.countIn) {
        g.fillStyle = '#1b1826';
        g.fillRect(bx, ledY + 1, bw, 2);
      } else if (active) {
        g.fillStyle = music.countIn ? '#ffb04f' : (music.inRepeat ? '#b18cff' : (b === 0 ? '#fde047' : '#ff5d4f'));
        g.fillRect(bx, ledY, bw, 4);
        g.fillStyle = '#ffffff';
        g.fillRect(bx + 1, ledY + 1, Math.max(1, bw - 2), 1);
      } else {
        g.fillStyle = '#262d46';
        g.fillRect(bx, ledY + 1, bw, 2);
      }
    }

    // 12. Blit Crisp Virtual Pixel Buffer to High-DPI Canvas (strict 1:1 square pixels!)
    const { cssW, cssH, dpr, scale, drawW, drawH, ox, oy } = blit;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0e17';
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(buf, 0, 0, vw, vh, ox, oy, drawW, drawH);

    // Crisp high-DPI floating accent / count-in callout in clear space beside headphones
    if (callout.timer > 0) {
      const tx = ox + (cx + 24) * scale;
      const ty = oy + (y0 + 14 - (reduce ? 0 : (0.36 - callout.timer) * 10)) * scale;
      ctx.globalAlpha = Math.min(1, callout.timer * 3.6);
      ctx.font = '800 14px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#090d17';
      ctx.fillText(callout.text, tx + 1, ty + 1);
      ctx.fillStyle = callout.color;
      ctx.fillText(callout.text, tx, ty);
    }
    ctx.restore();
  }

  function stopIdleLoop() {
    if (idleRaf) {
      if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(idleRaf);
      idleRaf = 0;
    }
  }

  function startIdleLoop() {
    if (!enabled || playing || idleRaf || !ensureCanvas()) return;
    if (typeof requestAnimationFrame !== 'function') return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const loop = (now) => {
      idleRaf = 0;
      if (!enabled || playing || (typeof document !== 'undefined' && document.visibilityState === 'hidden')) return;
      advancePhysics(now);
      render();
      idleRaf = requestAnimationFrame(loop);
    };
    idleRaf = requestAnimationFrame(loop);
  }

  function setEnabled(next) {
    enabled = Boolean(next);
    if (!enabled) {
      stopIdleLoop();
      return;
    }
    resize();
    updateBadge();
    render();
    if (!playing) startIdleLoop();
  }

  function setPlaying(next) {
    playing = Boolean(next);
    if (playing) {
      stopIdleLoop();
    } else {
      music.activeBeat = -1;
      music.countIn = false;
      music.countBeat = 0;
      music.inRepeat = false;
      music.repeatPass = 0;
      music.repeatTimes = 0;
      updateBadge();
      if (enabled) startIdleLoop();
    }
  }

  function syncFrame(now, frameState = {}) {
    if (frameState.visualPhase !== undefined) music.visualPhase = frameState.visualPhase;
    if (frameState.beat !== undefined) music.activeBeat = frameState.beat;
    if (frameState.beats !== undefined) music.beats = frameState.beats;
    if (frameState.countIn !== undefined) music.countIn = frameState.countIn;
    if (frameState.countBeat !== undefined) music.countBeat = frameState.countBeat;
    if (frameState.inRepeat !== undefined) music.inRepeat = frameState.inRepeat;
    if (frameState.repeatPass !== undefined) music.repeatPass = frameState.repeatPass;
    if (frameState.repeatTimes !== undefined) music.repeatTimes = frameState.repeatTimes;
    if (frameState.layout) {
      music.visualStarts = frameState.layout.visualStarts;
      music.visualWidths = frameState.layout.visualWidths;
      music.visualTotal = frameState.layout.visualTotal;
      music.beatEnabled = frameState.layout.enabled;
    }
    updateBadge();
    if (!enabled) return;
    advancePhysics(now);
    render();
  }

  function handleVisibilityChange() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      stopIdleLoop();
    } else if (enabled && !playing) {
      startIdleLoop();
    }
  }

  function handleCanvasClick(event) {
    if (!enabled || !canvas) return;
    const rect = canvas.getBoundingClientRect?.();
    let best = null;
    if (rect && rect.width > 0 && blit.scale > 0) {
      const vx = (event.clientX - rect.left - blit.ox) / blit.scale;
      const vy = (event.clientY - rect.top - blit.oy) / blit.scale;
      const cx = Math.floor(blit.vw / 2);
      const y0 = Math.max(0, blit.vh - VH);
      let bestDist = 24;
      for (const piece of Object.values(KIT)) {
        const dist = Math.hypot(vx - (cx + piece.dx), vy - (y0 + piece.y));
        if (dist < bestDist) {
          bestDist = dist;
          best = piece;
        }
      }
    }
    const target = best || KIT.kick;
    triggerHit({ lane: 0, sound: target.sound, accented: target.accent, beat: -1 });
    onTapPiece?.(target.sound, target.accent);
    if (!playing) {
      render();
      startIdleLoop();
    }
  }

  if (canvas) {
    canvas.addEventListener('click', handleCanvasClick);
  }

  function destroy() {
    stopIdleLoop();
    resizeObserver?.disconnect();
    if (canvas) canvas.removeEventListener('click', handleCanvasClick);
    if (canvasChecked && ctx && typeof window !== 'undefined') window.removeEventListener('resize', resize);
  }

  return {
    setEnabled,
    setPlaying,
    updateConfig,
    syncFrame,
    triggerHit,
    triggerCountIn,
    handleVisibilityChange,
    destroy,
    get isEnabled() { return enabled; },
    get recentHits() { return hitLog.slice(); },
    clearRecentHits() { hitLog.length = 0; },
  };
}
