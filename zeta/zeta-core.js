// zeta-core.js — Riemann zeta on the whole complex plane, in plain doubles.
// Complex numbers are [re, im] pairs. Works in the browser (window.ZetaCore) and in node (require).
(function (root) {
  'use strict';
  const PI = Math.PI, LN2 = Math.LN2, LNPI = Math.log(PI), LN2PI = Math.log(2 * PI);

  // ---- small complex helpers ----
  const cmul = (a, b, c, d) => [a * c - b * d, a * d + b * c];
  const cdiv = (a, b, c, d) => { const q = c * c + d * d; return [(a * c + b * d) / q, (b * c - a * d) / q]; };
  const clog = (a, b) => [0.5 * Math.log(a * a + b * b), Math.atan2(b, a)];
  const cexp = (a, b) => { const m = Math.exp(a); return [m * Math.cos(b), m * Math.sin(b)]; };
  const csin = (x, y) => [Math.sin(x) * Math.cosh(y), Math.cos(x) * Math.sinh(y)];

  // ---- Borwein's algorithm (1991): zeta(s) = eta(s) / (1 - 2^(1-s)) with an accelerated alternating sum ----
  // d_k = n * sum_{i<=k} (n+i-1)! 4^i / ((n-i)! (2i)!)
  const cache = new Map();
  function borwein(n) {
    let r = cache.get(n);
    if (r) return r;
    const d = new Float64Array(n + 1);
    let t = 1 / n, sum = t;
    d[0] = n * sum;
    for (let i = 0; i < n; i++) {
      t *= (4 * (n + i) * (n - i)) / ((2 * i + 1) * (2 * i + 2));
      sum += t;
      d[i + 1] = n * sum;
    }
    const dn = d[n], w = new Float64Array(n), L = new Float64Array(n);
    for (let k = 0; k < n; k++) { w[k] = ((k & 1) ? -1 : 1) * (dn - d[k]) / dn; L[k] = Math.log(k + 1); }
    r = { w, L };
    cache.set(n, r);
    return r;
  }
  // Error ~ (3+sqrt8)^-n * e^(pi|t|/2): this n keeps it near 1e-13 or better.
  const termsFor = (t) => Math.min(380, 24 + Math.ceil(0.95 * Math.abs(t)));

  // Direct series. Accurate for Re(s) > -0.5 or so; used for Re(s) >= 1/2 by default.
  function zetaDirect(sr, si) {
    const { w, L } = borwein(termsFor(si));
    let ar = 0, ai = 0;
    for (let k = 0; k < w.length; k++) {
      const m = w[k] * Math.exp(-sr * L[k]), a = si * L[k];
      ar += m * Math.cos(a);
      ai -= m * Math.sin(a);
    }
    const m2 = Math.exp((1 - sr) * LN2), a2 = -si * LN2; // 2^(1-s)
    const dr = 1 - m2 * Math.cos(a2), di = -m2 * Math.sin(a2);
    if (dr * dr + di * di < 1e-26) {
      if (Math.abs(sr - 1) < 1e-12 && Math.abs(si) < 1e-12) return [Infinity, 0]; // the pole at s = 1
      return zetaDirect(sr, si + 1e-7); // removable 0/0 at s = 1 + 2*pi*i*k/ln2
    }
    return cdiv(ar, ai, dr, di);
  }

  // log Gamma, Lanczos (g = 7, 9 terms), valid for Re(z) >= 1/2. Returns the continuous branch.
  const LG = 7, LC = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lnGammaPos(re, im) {
    const zr = re - 1, zi = im;
    let xr = LC[0], xi = 0;
    for (let i = 1; i < 9; i++) {
      const dr = zr + i, q = dr * dr + zi * zi;
      xr += LC[i] * dr / q;
      xi -= LC[i] * zi / q;
    }
    const tr = zr + LG + 0.5, ti = zi;
    const [lr, li] = clog(tr, ti);
    const ar = zr + 0.5;
    const [sr, si] = clog(xr, xi);
    return [0.5 * LN2PI + ar * lr - zi * li - tr + sr, ar * li + zi * lr - ti + si];
  }
  // Everywhere except the poles, via Gamma(z) Gamma(1-z) = pi / sin(pi z). Imag part is mod 2*pi here.
  function lnGamma(re, im) {
    if (re >= 0.5) return lnGammaPos(re, im);
    const [lsr, lsi] = clog(...csin(PI * re, PI * im));
    const [gr, gi] = lnGammaPos(1 - re, -im);
    return [LNPI - lsr - gr, -lsi - gi];
  }

  // zeta(s) everywhere (analytic continuation). Left half uses the functional equation
  // zeta(s) = 2^s pi^(s-1) sin(pi s / 2) Gamma(1-s) zeta(1-s).
  function zeta(sr, si) {
    if (sr >= 0.5 || (sr * sr + si * si) < 0.01) return zetaDirect(sr, si);
    const [gr, gi] = lnGammaPos(1 - sr, -si);
    const [lsr, lsi] = clog(...csin(PI * sr / 2, PI * si / 2));
    const pre = cexp(sr * LN2 + (sr - 1) * LNPI + gr + lsr, si * LN2 + si * LNPI + gi + lsi);
    const z = zetaDirect(1 - sr, -si);
    return cmul(pre[0], pre[1], z[0], z[1]);
  }

  // Completed zeta, straight from the definition: xi(s) = 1/2 s (s-1) pi^(-s/2) Gamma(s/2) zeta(s).
  // Uses zetaDirect, so it is honest for 0 < Re(s) < 1 (no functional equation baked in).
  function xiFromDef(sr, si) {
    if (Math.hypot(sr - 1, si) < 1e-9 || Math.hypot(sr, si) < 1e-9) return [0.5, 0];
    const [gr, gi] = lnGamma(sr / 2, si / 2);
    const f = cexp(-(sr / 2) * LNPI + gr, -(si / 2) * LNPI + gi);
    const p = cmul(sr, si, sr - 1, si);
    const z = zetaDirect(sr, si);
    const a = cmul(p[0] * 0.5, p[1] * 0.5, f[0], f[1]);
    return cmul(a[0], a[1], z[0], z[1]);
  }
  // xi for plotting anywhere: left half reflected through Re(s) = 1/2 (xi(s) = xi(1-s)).
  const xi = (sr, si) => (sr >= 0.5 ? xiFromDef(sr, si) : xiFromDef(1 - sr, -si));

  // Riemann–Siegel theta and Hardy's Z: Z(t) = e^(i theta(t)) zeta(1/2 + i t) is real for real t.
  function theta(t) {
    const g = lnGammaPos(1.25, t / 2);           // lnGamma(1/4 + it/2) = lnGamma(5/4 + it/2) - ln(1/4 + it/2)
    return g[1] - Math.atan2(t / 2, 0.25) - (t / 2) * LNPI;
  }
  function hardyZ(t) {
    const z = zetaDirect(0.5, t), th = theta(t);
    const r = cmul(Math.cos(th), Math.sin(th), z[0], z[1]);
    return { re: r[0], im: r[1] };                 // im should be ~0: a built-in check
  }

  // Zeros of zeta on the critical line with from < t <= to, by sign changes of Z and bisection.
  // Scans include the endpoint, so consecutive calls (0.5, 120) then (120, 360) miss nothing.
  function criticalZeros(from, to, step) {
    step = step || 0.05;
    const out = [], N = Math.max(1, Math.round((to - from) / step));
    let a = from, fa = hardyZ(a).re;
    for (let i = 1; i <= N; i++) {
      const b = i === N ? to : from + i * step, fb = hardyZ(b).re;
      if (fa === 0 || fa * fb < 0) {
        let lo = a, hi = b, flo = fa;
        for (let i = 0; i < 60; i++) {
          const mid = 0.5 * (lo + hi), fm = hardyZ(mid).re;
          if (flo * fm <= 0) hi = mid; else { lo = mid; flo = fm; }
        }
        out.push(0.5 * (lo + hi));
      }
      a = b; fa = fb;
    }
    return out;
  }

  const api = { zeta, zetaDirect, xi, xiFromDef, lnGamma, theta, hardyZ, criticalZeros, cmul, cdiv };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZetaCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
