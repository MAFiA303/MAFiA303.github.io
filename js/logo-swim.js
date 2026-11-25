// Mafium skull-octopus emblem + 2s slow-mo underwater tentacle wing-flap animation.
// Partitions the mafium.com emblem into a locked skull head + 4 independent tentacles
// driven by anisotropic fluid drag (uncurl upward like slow underwater wings, then
// sweep smoothly back into the resting spiral). Plays once on load and replays on click.

export const LOGO_SWIM_DURATION_MS = 2000;
export const PHYSICS_BAKE_SEC = 1.6;
export const TENTACLE_ORDER = ['UL', 'LL', 'LR', 'UR'];

export const LOGO_PNG_DATA_URI = 'data:image/png;base64,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';

const RAW_SPINES = {
  UL: [
    [0.390, 0.505], [0.325, 0.510], [0.255, 0.478], [0.190, 0.456],
    [0.130, 0.468], [0.088, 0.515], [0.078, 0.572], [0.098, 0.618],
    [0.126, 0.628],
  ],
  LL: [
    [0.455, 0.505], [0.432, 0.562], [0.382, 0.618], [0.312, 0.660],
    [0.238, 0.698], [0.178, 0.752], [0.155, 0.822], [0.180, 0.888],
    [0.242, 0.922], [0.296, 0.902], [0.296, 0.862],
  ],
  LR: [
    [0.525, 0.505], [0.542, 0.575], [0.575, 0.642], [0.625, 0.698],
    [0.695, 0.730], [0.778, 0.742], [0.855, 0.768], [0.905, 0.825],
    [0.906, 0.892], [0.862, 0.940], [0.808, 0.938],
  ],
  UR: [
    [0.622, 0.495], [0.678, 0.498], [0.738, 0.468], [0.798, 0.456],
    [0.856, 0.478], [0.886, 0.528], [0.880, 0.580], [0.848, 0.614],
    [0.812, 0.606],
  ],
};

// Slow underwater wing-flap parameters: each tentacle uncoils its curl upward
// like a slow bird/manta wing in water, then flaps smoothly back down into its
// resting spiral under anisotropic fluid drag, staggered asynchronously across all 4 arms.
export const TENTACLE_CONFIGS = {
  UL: {
    side: -1, phaseShift: 0.00, lockBones: 2, halfWidth: 0.085,
    lift: 0.24, uncurl: 0.76, stiff: 0.48, damp: 0.095, dragN: 1.65, dragQ: 2.8,
  },
  LL: {
    side: -1, phaseShift: 0.11, lockBones: 1, halfWidth: 0.115,
    lift: 0.19, uncurl: 0.66, stiff: 0.44, damp: 0.105, dragN: 1.95, dragQ: 3.2,
  },
  UR: {
    side: 1, phaseShift: 0.22, lockBones: 2, halfWidth: 0.085,
    lift: 0.24, uncurl: 0.76, stiff: 0.48, damp: 0.095, dragN: 1.65, dragQ: 2.8,
  },
  LR: {
    side: 1, phaseShift: 0.33, lockBones: 1, halfWidth: 0.115,
    lift: 0.20, uncurl: 0.68, stiff: 0.42, damp: 0.108, dragN: 2.00, dragQ: 3.3,
  },
};

// Pixel-verified bottom contour of the skull cheekbones & jaw so ZERO skull pixels move.
const SKULL_CUT_X = [0.00, 0.22, 0.24, 0.26, 0.28, 0.30, 0.33, 0.37, 0.41, 0.495, 0.58, 0.62, 0.66, 0.69, 0.71, 0.73, 0.76, 1.00];
const SKULL_CUT_Y = [0.00, 0.34, 0.37, 0.39, 0.418, 0.464, 0.476, 0.482, 0.496, 0.520, 0.496, 0.476, 0.472, 0.464, 0.440, 0.395, 0.35, 0.00];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function smoothstep(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}

function interpPiecewise(x, xs, ys) {
  if (x <= xs[0]) return ys[0];
  const last = xs.length - 1;
  if (x >= xs[last]) return ys[last];
  for (let i = 0; i < last; i += 1) {
    if (x <= xs[i + 1]) {
      const f = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + (ys[i + 1] - ys[i]) * f;
    }
  }
  return ys[last];
}

function resamplePolyline(pts, count = 10) {
  const cum = [0];
  for (let i = 1; i < pts.length; i += 1) {
    const dx = pts[i][0] - pts[i - 1][0];
    const dy = pts[i][1] - pts[i - 1][1];
    cum.push(cum[i - 1] + Math.hypot(dx, dy));
  }
  const total = cum[cum.length - 1] || 1;
  const out = [];
  for (let k = 0; k < count; k += 1) {
    const target = (k / (count - 1)) * total;
    let seg = 0;
    while (seg < cum.length - 2 && cum[seg + 1] < target) seg += 1;
    const span = cum[seg + 1] - cum[seg] || 1;
    const f = clamp((target - cum[seg]) / span, 0, 1);
    out.push([
      pts[seg][0] + (pts[seg + 1][0] - pts[seg][0]) * f,
      pts[seg][1] + (pts[seg + 1][1] - pts[seg][1]) * f,
    ]);
  }
  return out;
}

export const TENTACLE_SPINES = Object.fromEntries(
  TENTACLE_ORDER.map((key) => [key, resamplePolyline(RAW_SPINES[key], 10)])
);

/**
 * Whole-body pose stays in place by default; optional subtle underwater buoyancy
 * recoil surges gently up-left on the downstroke and floats back on recovery.
 */
export function computeLogoSwimPose(progress, { recoil = false } = {}) {
  const t = clamp(progress, 0, 1);
  if (!recoil) return { dx: 0, dy: 0, rot: 0, scale: 1, opacity: 1 };
  const w = 2 * Math.PI * t;
  const surge = -Math.sin(w - 1.15) * 0.5 + 0.5;
  const dx = -0.045 * (surge - 0.5);
  const dy = -0.055 * (surge - 0.5);
  const rot = -0.025 * Math.sin(w - 0.8);
  return { dx, dy, rot, scale: 1, opacity: 1 };
}

const PHYSICS_SAMPLES = 120;

function simulateWaterTentacle(rest, cfg, { periodic }) {
  const m = rest.length - 1;
  const L = new Float64Array(m);
  const theta0 = new Float64Array(m);
  for (let i = 0; i < m; i += 1) {
    const dx = rest[i + 1][0] - rest[i][0];
    const dy = rest[i + 1][1] - rest[i][1];
    L[i] = Math.hypot(dx, dy);
    theta0[i] = Math.atan2(dy, dx);
  }

  const thUnwrapped = new Float64Array(m);
  thUnwrapped[0] = theta0[0];
  for (let i = 1; i < m; i += 1) {
    let diff = theta0[i] - theta0[i - 1];
    while (diff > Math.PI) diff -= 2 * Math.PI;
    while (diff < -Math.PI) diff += 2 * Math.PI;
    thUnwrapped[i] = thUnwrapped[i - 1] + diff;
  }
  const restTurn = new Float64Array(m);
  for (let i = 1; i < m; i += 1) restTurn[i] = thUnwrapped[i] - thUnwrapped[i - 1];

  const dirSign = -cfg.side;
  const K = new Float64Array(m);
  const D = new Float64Array(m);
  const width = new Float64Array(m);
  const I = new Float64Array(m);
  const qOpen = new Float64Array(m);

  for (let i = 0; i < m; i += 1) {
    const s = (i + 0.5) / m;
    K[i] = cfg.stiff * ((1 - 0.72 * s) ** 1.35);
    D[i] = cfg.damp * ((1 - 0.58 * s) ** 1.15);
    width[i] = 1 - 0.62 * s;
  }
  for (let j = 0; j < m; j += 1) {
    let arm = 0;
    let inert = 0.00022;
    for (let i = j; i < m; i += 1) {
      arm += L[i];
      inert += (L[i] * width[i] * 0.7) * (arm * arm) * 0.5;
    }
    I[j] = inert;
    if (j >= cfg.lockBones) {
      const u = (j - cfg.lockBones) / Math.max(1, m - 1 - cfg.lockBones);
      const shoulderLift = dirSign * cfg.lift * Math.exp(-(((u - 0.12) / 0.34) ** 2));
      const inwardCurl = Math.max(0, -restTurn[j] * dirSign);
      const uncurl = dirSign * cfg.uncurl * inwardCurl * (0.35 + 0.65 * u);
      qOpen[j] = shoulderLift + uncurl;
    }
  }

  const q = new Float64Array(m);
  const dq = new Float64Array(m);
  const px = new Float64Array(m + 1);
  const py = new Float64Array(m + 1);
  const mx = new Float64Array(m);
  const my = new Float64Array(m);
  const prevMx = new Float64Array(m);
  const prevMy = new Float64Array(m);
  const th = new Float64Array(m);
  const Fx = new Float64Array(m);
  const Fy = new Float64Array(m);

  const fk = () => {
    px[0] = rest[0][0];
    py[0] = rest[0][1];
    let acc = 0;
    for (let i = 0; i < m; i += 1) {
      acc += q[i];
      const a = theta0[i] + acc;
      th[i] = a;
      px[i + 1] = px[i] + L[i] * Math.cos(a);
      py[i + 1] = py[i] + L[i] * Math.sin(a);
      mx[i] = 0.5 * (px[i] + px[i + 1]);
      my[i] = 0.5 * (py[i] + py[i + 1]);
    }
  };

  fk();
  prevMx.set(mx);
  prevMy.set(my);

  const substeps = 3;
  const stepsPerCycle = PHYSICS_SAMPLES * substeps;
  const dt = PHYSICS_BAKE_SEC / stepsPerCycle;
  const warmupSteps = periodic ? stepsPerCycle * 4 : 0;
  const totalSteps = warmupSteps + stepsPerCycle;

  const framesQ = [];
  for (let step = 0; step < totalSteps; step += 1) {
    let flapAct = 0;
    if (periodic) {
      const ph = ((step % stepsPerCycle) / stepsPerCycle + cfg.phaseShift) % 1;
      const w = 2 * Math.PI * ph;
      flapAct = clamp(0.44 - 0.54 * Math.cos(w) + 0.14 * Math.sin(w) - 0.08 * Math.sin(2 * w), -0.18, 1.08);
    } else {
      const t = step / stepsPerCycle;
      const t0 = cfg.phaseShift * 0.34;
      const t1 = Math.min(0.88, t0 + 0.72);
      if (t > t0 && t < t1) {
        const u = (t - t0) / (t1 - t0);
        const w = 2 * Math.PI * u;
        flapAct = clamp((0.5 - 0.5 * Math.cos(w)) * (1.08 + 0.16 * Math.sin(w)), 0, 1.14);
      }
    }

    fk();
    for (let i = 0; i < m; i += 1) {
      const vx = (mx[i] - prevMx[i]) / dt;
      const vy = (my[i] - prevMy[i]) / dt;
      prevMx[i] = mx[i];
      prevMy[i] = my[i];
      const tx = Math.cos(th[i]);
      const ty = Math.sin(th[i]);
      const nx = -ty;
      const ny = tx;
      const vn = vx * nx + vy * ny;
      const vt = vx * tx + vy * ty;
      const area = L[i] * width[i];
      const fn = -(cfg.dragN + cfg.dragQ * Math.abs(vn)) * vn * area;
      const ft = -(cfg.dragN * 0.07) * vt * area;
      Fx[i] = fn * nx + ft * tx;
      Fy[i] = fn * ny + ft * ty;
    }

    for (let j = cfg.lockBones; j < m; j += 1) {
      let tw = 0;
      const pxj = px[j];
      const pyj = py[j];
      for (let i = j; i < m; i += 1) {
        tw += (mx[i] - pxj) * Fy[i] - (my[i] - pyj) * Fx[i];
      }
      const targetQ = qOpen[j] * flapAct;
      const tau = K[j] * (targetQ - q[j]) + tw - D[j] * dq[j];
      dq[j] = clamp(dq[j] + (tau / I[j]) * dt, -10, 10);
      q[j] = clamp(q[j] + dq[j] * dt, -0.68, 0.68);
    }

    if (step >= warmupSteps && (step - warmupSteps) % substeps === 0) {
      framesQ.push(new Float32Array(q));
    }
  }

  const nFrames = framesQ.length;
  if (periodic) {
    const startQ = framesQ[0];
    const endQ = new Float32Array(q);
    for (let f = 0; f < nFrames; f += 1) {
      const blend = f / nFrames;
      const row = framesQ[f];
      for (let j = 0; j < m; j += 1) {
        row[j] += (startQ[j] - endQ[j]) * blend;
      }
    }
  } else {
    for (let f = 0; f < nFrames; f += 1) {
      const t = f / (nFrames - 1);
      const tailFade = 1 - smoothstep(0.84, 1.0, t);
      const row = framesQ[f];
      for (let j = 0; j < m; j += 1) row[j] *= tailFade;
    }
    framesQ[0].fill(0);
    framesQ[nFrames - 1].fill(0);
  }

  return { L, theta0, framesQ };
}

const PERIODIC_CACHE = new Map();
const ONESHOT_CACHE = new Map();
const RIG_CACHE = new Map();

function getPhysicsTrack(key, periodic) {
  const cache = periodic ? PERIODIC_CACHE : ONESHOT_CACHE;
  if (!cache.has(key)) {
    cache.set(key, simulateWaterTentacle(TENTACLE_SPINES[key], TENTACLE_CONFIGS[key], { periodic }));
  }
  return cache.get(key);
}

/**
 * Computes arc-length-preserving bent spine points and segment angles for tentacle `key`
 * from the slender-body underwater fluid-drag simulation.
 * - `periodic: false` (default one-shot): starts & ends at exact rest (t=0 === t=1 === 0).
 * - `periodic: true` (looping): continuous seamless limit cycle (t=0 === t=1).
 */
export function computeTentacleBones(key, progress, { periodic = false } = {}) {
  const rest = TENTACLE_SPINES[key];
  const m = rest.length - 1;
  const track = getPhysicsTrack(key, periodic);
  const { L, theta0, framesQ } = track;
  const n = framesQ.length;

  const t = periodic ? (((progress % 1) + 1) % 1) : clamp(progress, 0, 1);
  const pos = periodic ? t * n : t * (n - 1);
  const i0 = Math.floor(pos) % n;
  const i1 = periodic ? (i0 + 1) % n : Math.min(n - 1, i0 + 1);
  const frac = pos - Math.floor(pos);

  const q0 = framesQ[i0];
  const q1 = framesQ[i1];
  const points = new Array(rest.length);
  points[0] = [rest[0][0], rest[0][1]];
  const phis = new Float32Array(m);

  let cumAngle = 0;
  for (let i = 0; i < m; i += 1) {
    cumAngle += q0[i] + (q1[i] - q0[i]) * frac;
    phis[i] = cumAngle;
    const a = theta0[i] + cumAngle;
    points[i + 1] = [
      points[i][0] + L[i] * Math.cos(a),
      points[i][1] + L[i] * Math.sin(a),
    ];
  }

  return { points, phis };
}

function closestDistSqToSpine(px, py, poly) {
  let best = 1e9;
  for (let i = 0; i < poly.length - 1; i += 1) {
    const ax = poly[i][0];
    const ay = poly[i][1];
    const dx = poly[i + 1][0] - ax;
    const dy = poly[i + 1][1] - ay;
    const len2 = dx * dx + dy * dy + 1e-12;
    const proj = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
    const rx = px - (ax + proj * dx);
    const ry = py - (ay + proj * dy);
    const d2 = rx * rx + ry * ry;
    if (d2 < best) best = d2;
  }
  return best;
}

function getSegmentedTextures(img, texSize) {
  if (RIG_CACHE.has(texSize)) return RIG_CACHE.get(texSize);

  const work = document.createElement('canvas');
  work.width = texSize;
  work.height = texSize;
  let wctx = null;
  try { wctx = work.getContext('2d', { willReadFrequently: true }); } catch { wctx = null; }
  if (!wctx) return null;
  wctx.clearRect(0, 0, texSize, texSize);
  wctx.drawImage(img, 0, 0, texSize, texSize);
  const src = wctx.getImageData(0, 0, texSize, texSize).data;

  const headCanvas = document.createElement('canvas');
  headCanvas.width = texSize;
  headCanvas.height = texSize;
  let hctx = null;
  try { hctx = headCanvas.getContext('2d'); } catch { hctx = null; }
  if (!hctx) return null;
  const headImg = hctx.createImageData(texSize, texSize);
  const headData = headImg.data;

  const tentacleTex = TENTACLE_ORDER.map(() => new Uint8ClampedArray(texSize * texSize * 4));
  const spines = TENTACLE_ORDER.map((k) => TENTACLE_SPINES[k]);

  for (let y = 0; y < texSize; y += 1) {
    const py = (y + 0.5) / texSize;
    for (let x = 0; x < texSize; x += 1) {
      const idx4 = (y * texSize + x) * 4;
      const a = src[idx4 + 3];
      if (a === 0) continue;

      const px = (x + 0.5) / texSize;
      const yCut = interpPiecewise(px, SKULL_CUT_X, SKULL_CUT_Y);
      const isCenterBridge = px > 0.39 && px < 0.60;
      const headW = (1 - smoothstep(yCut - (isCenterBridge ? 0.012 : 0.004), yCut + (isCenterBridge ? 0.020 : 0.006), py))
        * smoothstep(0.18, 0.21, px)
        * (1 - smoothstep(0.79, 0.82, px));

      const r = src[idx4];
      const g = src[idx4 + 1];
      const b = src[idx4 + 2];

      if (headW > 0.002) {
        headData[idx4] = r;
        headData[idx4 + 1] = g;
        headData[idx4 + 2] = b;
        headData[idx4 + 3] = Math.round(a * headW);
      }

      const underHead = isCenterBridge
        ? (1 - smoothstep(0.72, 0.96, headW))
        : (1 - smoothstep(0.08, 0.28, headW));
      if (underHead <= 0.002) continue;

      const d0 = Math.sqrt(closestDistSqToSpine(px, py, spines[0])) + ((px > 0.415 || py > 0.655) ? 1 : 0);
      const d1 = Math.sqrt(closestDistSqToSpine(px, py, spines[1])) + (px > 0.496 ? 1 : 0);
      const d2 = Math.sqrt(closestDistSqToSpine(px, py, spines[2])) + ((px < 0.490 || (px > 0.61 && py < 0.545)) ? 1 : 0);
      const d3 = Math.sqrt(closestDistSqToSpine(px, py, spines[3])) + ((px < 0.595 || py > 0.640) ? 1 : 0);

      let owner = 0;
      let best = d0;
      if (d1 < best) { best = d1; owner = 1; }
      if (d2 < best) { best = d2; owner = 2; }
      if (d3 < best) { owner = 3; }

      const dst = tentacleTex[owner];
      dst[idx4] = r;
      dst[idx4 + 1] = g;
      dst[idx4 + 2] = b;
      dst[idx4 + 3] = Math.round(a * underHead);
    }
  }

  hctx.putImageData(headImg, 0, 0);
  const rig = { texSize, headCanvas, tentacleTex };
  RIG_CACHE.set(texSize, rig);
  return rig;
}

function createCreatureRenderer(rig, spriteSize) {
  const pad = 0.24;
  const span = 1 + 2 * pad;
  const sigma2 = 0.032 * 0.032;
  const { texSize, headCanvas, tentacleTex } = rig;

  const spriteCanvas = document.createElement('canvas');
  spriteCanvas.width = spriteSize;
  spriteCanvas.height = spriteSize;
  let sctx = null;
  try { sctx = spriteCanvas.getContext('2d'); } catch { sctx = null; }
  if (!sctx) return null;

  const imgData = sctx.createImageData(spriteSize, spriteSize);
  const outBytes = imgData.data;
  const accR = new Float32Array(spriteSize * spriteSize);
  const accG = new Float32Array(spriteSize * spriteSize);
  const accB = new Float32Array(spriteSize * spriteSize);
  const accA = new Float32Array(spriteSize * spriteSize);

  const headPadPx = (pad / span) * spriteSize;
  const headDrawSize = (1 / span) * spriteSize;

  function render(progress, { periodic = false } = {}) {
    accR.fill(0);
    accG.fill(0);
    accB.fill(0);
    accA.fill(0);

    for (let ti = 0; ti < TENTACLE_ORDER.length; ti += 1) {
      const key = TENTACLE_ORDER[ti];
      const rest = TENTACLE_SPINES[key];
      const cfg = TENTACLE_CONFIGS[key];
      const tex = tentacleTex[ti];
      const { points, phis } = computeTentacleBones(key, progress, { periodic });
      const m = rest.length - 1;
      const hw = cfg.halfWidth + 0.02;
      const hw2 = hw * hw;

      let minX = 1e9; let maxX = -1e9;
      let minY = 1e9; let maxY = -1e9;
      for (let i = 0; i <= m; i += 1) {
        const px = points[i][0];
        const py = points[i][1];
        if (px < minX) minX = px;
        if (px > maxX) maxX = px;
        if (py < minY) minY = py;
        if (py > maxY) maxY = py;
      }

      const xStart = Math.max(0, Math.floor(((minX - hw) + pad) / span * spriteSize));
      const xEnd = Math.min(spriteSize, Math.ceil(((maxX + hw) + pad) / span * spriteSize));
      const yStart = Math.max(0, Math.floor(((minY - hw) + pad) / span * spriteSize));
      const yEnd = Math.min(spriteSize, Math.ceil(((maxY + hw) + pad) / span * spriteSize));
      if (xEnd <= xStart || yEnd <= yStart) continue;

      const axArr = new Float32Array(m);
      const ayArr = new Float32Array(m);
      const dxArr = new Float32Array(m);
      const dyArr = new Float32Array(m);
      const invLen2Arr = new Float32Array(m);
      const m1xArr = new Float32Array(m);
      const m1yArr = new Float32Array(m);
      const m0xArr = new Float32Array(m);
      const m0yArr = new Float32Array(m);
      const cosArr = new Float32Array(m);
      const sinArr = new Float32Array(m);

      for (let i = 0; i < m; i += 1) {
        const ax = points[i][0];
        const ay = points[i][1];
        const bx = points[i + 1][0];
        const by = points[i + 1][1];
        const dx = bx - ax;
        const dy = by - ay;
        axArr[i] = ax;
        ayArr[i] = ay;
        dxArr[i] = dx;
        dyArr[i] = dy;
        invLen2Arr[i] = 1 / (dx * dx + dy * dy + 1e-12);
        m1xArr[i] = 0.5 * (ax + bx);
        m1yArr[i] = 0.5 * (ay + by);
        m0xArr[i] = 0.5 * (rest[i][0] + rest[i + 1][0]);
        m0yArr[i] = 0.5 * (rest[i][1] + rest[i + 1][1]);
        cosArr[i] = Math.cos(-phis[i]);
        sinArr[i] = Math.sin(-phis[i]);
      }

      for (let pyIdx = yStart; pyIdx < yEnd; pyIdx += 1) {
        const ny = ((pyIdx + 0.5) / spriteSize) * span - pad;
        const rowOff = pyIdx * spriteSize;
        for (let pxIdx = xStart; pxIdx < xEnd; pxIdx += 1) {
          const nx = ((pxIdx + 0.5) / spriteSize) * span - pad;

          let wSum = 0;
          let uAcc = 0;
          let vAcc = 0;
          let minD2 = 1e9;

          for (let i = 0; i < m; i += 1) {
            const dx = dxArr[i];
            const dy = dyArr[i];
            const rx0 = nx - axArr[i];
            const ry0 = ny - ayArr[i];
            let proj = (rx0 * dx + ry0 * dy) * invLen2Arr[i];
            if (proj < 0) proj = 0;
            else if (proj > 1) proj = 1;
            const ex = rx0 - proj * dx;
            const ey = ry0 - proj * dy;
            const d2 = ex * ex + ey * ey;
            if (d2 < minD2) minD2 = d2;

            const inv = 1 / (d2 + sigma2);
            const w = inv * inv;
            const mx = nx - m1xArr[i];
            const my = ny - m1yArr[i];
            const c = cosArr[i];
            const sn = sinArr[i];
            wSum += w;
            uAcc += w * (m0xArr[i] + mx * c - my * sn);
            vAcc += w * (m0yArr[i] + mx * sn + my * c);
          }

          if (minD2 > hw2 || wSum <= 0) continue;

          const fx = (uAcc / wSum) * texSize - 0.5;
          const fy = (vAcc / wSum) * texSize - 0.5;
          const x0 = Math.floor(fx);
          const y0 = Math.floor(fy);
          if (x0 < 0 || x0 >= texSize - 1 || y0 < 0 || y0 >= texSize - 1) continue;

          const tx = fx - x0;
          const ty = fy - y0;
          const omx = 1 - tx;
          const omy = 1 - ty;
          const w00 = omx * omy;
          const w10 = tx * omy;
          const w01 = omx * ty;
          const w11 = tx * ty;

          const i00 = (y0 * texSize + x0) * 4;
          const i10 = i00 + 4;
          const i01 = i00 + texSize * 4;
          const i11 = i01 + 4;

          const a = (tex[i00 + 3] * w00 + tex[i10 + 3] * w10 + tex[i01 + 3] * w01 + tex[i11 + 3] * w11) / 255;
          if (a <= 0.002) continue;

          const r = tex[i00] * w00 + tex[i10] * w10 + tex[i01] * w01 + tex[i11] * w11;
          const g = tex[i00 + 1] * w00 + tex[i10 + 1] * w10 + tex[i01 + 1] * w01 + tex[i11 + 1] * w11;
          const b = tex[i00 + 2] * w00 + tex[i10 + 2] * w10 + tex[i01 + 2] * w01 + tex[i11 + 2] * w11;

          const pIdx = rowOff + pxIdx;
          const invA = 1 - a;
          accR[pIdx] = r * a + accR[pIdx] * invA;
          accG[pIdx] = g * a + accG[pIdx] * invA;
          accB[pIdx] = b * a + accB[pIdx] * invA;
          accA[pIdx] = a + accA[pIdx] * invA;
        }
      }
    }

    const totalPx = spriteSize * spriteSize;
    for (let i = 0; i < totalPx; i += 1) {
      const a = accA[i];
      const o = i * 4;
      if (a <= 0.002) {
        outBytes[o] = 0;
        outBytes[o + 1] = 0;
        outBytes[o + 2] = 0;
        outBytes[o + 3] = 0;
      } else {
        const inv = 1 / a;
        outBytes[o] = Math.min(255, Math.round(accR[i] * inv));
        outBytes[o + 1] = Math.min(255, Math.round(accG[i] * inv));
        outBytes[o + 2] = Math.min(255, Math.round(accB[i] * inv));
        outBytes[o + 3] = Math.min(255, Math.round(a * 255));
      }
    }

    sctx.putImageData(imgData, 0, 0);
    sctx.drawImage(headCanvas, headPadPx, headPadPx, headDrawSize, headDrawSize);
    return spriteCanvas;
  }

  return { render, span };
}

/**
 * Plays the slow-mo 2s underwater tentacle wing-flap animation on page load
 * and replays it on click. Stays strictly in place with skull locked solid,
 * stops cleanly at the exact resting emblem, and respects prefers-reduced-motion.
 */
export function startLogoSwimIntro({
  container,
  trigger = container,
  durationMs = LOGO_SWIM_DURATION_MS,
  loop = false,
  recoil = false,
  contentScale = 1,
  clipToBox = false,
  playOnClick = true,
  autoStart = true,
  canvasClass = 'mark-swim',
  createImage = () => new window.Image(),
} = {}) {
  let destroyed = false;
  let running = false;
  let playCount = 0;
  let rafId = 0;
  let stageCanvas = null;
  let loadedImg = null;
  let pendingPlay = false;
  let visListener = null;
  let pagehideListener = null;
  let clickListener = null;

  const stopRun = () => {
    running = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
    if (stageCanvas) {
      stageCanvas.remove();
      stageCanvas = null;
    }
    if (container) {
      delete container.dataset.swimming;
    }
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    stopRun();
    if (visListener) {
      document.removeEventListener('visibilitychange', visListener);
      visListener = null;
    }
    if (pagehideListener) {
      window.removeEventListener('pagehide', pagehideListener);
      pagehideListener = null;
    }
    if (clickListener && trigger) {
      trigger.removeEventListener('click', clickListener);
      clickListener = null;
    }
  };

  const isReducedMotion = () => Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);

  if (!container || typeof document === 'undefined' || typeof window === 'undefined') {
    return { destroy, replay: () => {}, isRunning: () => false, playCount: () => 0 };
  }

  const ua = (typeof window !== 'undefined' ? window.navigator?.userAgent : '') || (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  if (/jsdom/i.test(ua || '') || typeof requestAnimationFrame !== 'function') {
    return { destroy, replay: () => {}, isRunning: () => false, playCount: () => 0 };
  }

  const startCycle = (img) => {
    if (destroyed || !img || isReducedMotion()) return;
    stopRun();

    const rect = container.getBoundingClientRect?.();
    const boxSize = Math.max(20, Math.round(rect?.width || container.clientWidth || 34));
    const emblemSize = boxSize * contentScale;
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    const texSize = Math.min(192, Math.max(96, Math.round(emblemSize * dpr)));
    const spriteSize = Math.min(192, Math.max(104, Math.round(emblemSize * 1.48 * dpr)));

    const rig = getSegmentedTextures(img, texSize);
    const creature = rig ? createCreatureRenderer(rig, spriteSize) : null;
    if (!creature) return;

    const pad = clipToBox ? 0 : 0.26;
    const offset = clipToBox ? 0 : Math.round(pad * boxSize);
    const cssSize = boxSize + offset * 2;
    const restCenter = offset + boxSize * 0.5;

    stageCanvas = document.createElement('canvas');
    stageCanvas.className = canvasClass;
    stageCanvas.setAttribute('aria-hidden', 'true');
    if (clipToBox) {
      stageCanvas.style.inset = '0';
      stageCanvas.style.width = '100%';
      stageCanvas.style.height = '100%';
    } else {
      stageCanvas.style.left = `${-offset}px`;
      stageCanvas.style.top = `${-offset}px`;
      stageCanvas.style.width = `${cssSize}px`;
      stageCanvas.style.height = `${cssSize}px`;
    }
    stageCanvas.width = Math.max(1, Math.round(cssSize * dpr));
    stageCanvas.height = Math.max(1, Math.round(cssSize * dpr));

    let ctx = null;
    try { ctx = stageCanvas.getContext('2d'); } catch { ctx = null; }
    if (!ctx) {
      stopRun();
      return;
    }

    running = true;
    playCount += 1;
    container.dataset.swimming = '';
    container.append(stageCanvas);

    let startTime = null;
    const drawSize = emblemSize * creature.span;

    const step = (now) => {
      rafId = 0;
      if (destroyed || !running) return;
      if (startTime === null) startTime = now;
      const elapsed = Math.max(0, now - startTime);
      const progress = durationMs > 0
        ? (loop ? (elapsed % durationMs) / durationMs : Math.min(1, elapsed / durationMs))
        : 1;

      if (!loop && progress >= 1) {
        stopRun();
        return;
      }

      const pose = computeLogoSwimPose(progress, { recoil });
      const sprite = creature.render(progress, { periodic: loop });

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, cssSize, cssSize);
      ctx.save();
      ctx.globalAlpha = pose.opacity;
      ctx.translate(restCenter + pose.dx * emblemSize, restCenter + pose.dy * emblemSize);
      ctx.rotate(pose.rot);
      ctx.scale(pose.scale, pose.scale);
      ctx.drawImage(sprite, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      ctx.restore();

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
  };

  const replay = () => {
    if (destroyed || isReducedMotion()) return;
    if (loadedImg) {
      startCycle(loadedImg);
    } else {
      pendingPlay = true;
    }
  };

  const onImageReady = (img) => {
    if (destroyed) return;
    loadedImg = img;
    if (!pendingPlay) return;
    pendingPlay = false;
    if (document.visibilityState === 'hidden') {
      if (!visListener) {
        visListener = () => {
          if (document.visibilityState !== 'hidden') {
            document.removeEventListener('visibilitychange', visListener);
            visListener = null;
            startCycle(loadedImg);
          }
        };
        document.addEventListener('visibilitychange', visListener);
      }
    } else {
      startCycle(loadedImg);
    }
  };

  if (playOnClick && trigger) {
    clickListener = () => replay();
    trigger.addEventListener('click', clickListener);
  }

  pagehideListener = () => stopRun();
  window.addEventListener('pagehide', pagehideListener);

  if (autoStart && !isReducedMotion()) {
    pendingPlay = true;
  }

  const img = createImage();
  img.decoding = 'sync';
  img.onload = () => onImageReady(img);
  img.onerror = () => stopRun();
  img.src = LOGO_PNG_DATA_URI;
  if (img.complete && img.naturalWidth > 0) {
    onImageReady(img);
  }

  return {
    destroy,
    replay,
    isRunning: () => running,
    playCount: () => playCount,
  };
}
