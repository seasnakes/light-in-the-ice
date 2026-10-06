// Shared film infrastructure: timeline UI, detector geometry, light-propagation helpers, sky.
(function () {
'use strict';
const { V, W, H, clamp, mix, smooth, ease, env, RNG, noise1, timeColor } = ENG;
const F = window.F = { cues: [], scenes: [] };
const uiRoot = document.getElementById('ui');

// ---------------- audio cue registry (consumed by the score generator) ----------------
F.sfx = (t, type, p = {}) => { F.cues.push(Object.assign({ t: +t.toFixed(4), type }, p)); };

// ---------------- UI items ----------------
F.items = [];
/*
  opt: t0,t1, html, cls, x,y, anchor ('c','l','r','tl','tr','bl','br','cl','cr'),
       anim: 'fade' | 'chars' | 'wipe' | 'none', fin, fout, dy, blur, stagger, z,
       update(el, t, k, item) – custom per-frame hook
*/
F.ui = (opt) => {
  const o = Object.assign({ anim: 'fade', fin: 1.0, fout: 0.8, dy: 14, blur: 8, stagger: 0.06, anchor: 'c', cls: '', opacity: 1 }, opt);
  const el = document.createElement('div');
  el.className = 'el ' + o.cls;
  if (o.anim === 'chars') {
    const txt = o.html;
    el.innerHTML = '';
    o.spans = [];
    for (const ch of txt) {
      const s = document.createElement('span');
      s.textContent = ch; s.style.display = 'inline-block'; s.style.whiteSpace = 'pre';
      el.appendChild(s); o.spans.push(s);
    }
  } else el.innerHTML = o.html;
  if (o.style) Object.assign(el.style, o.style);
  el.style.display = 'none';
  uiRoot.appendChild(el);
  if (['c', 't', 'b'].includes(o.anchor)) { const ls = parseFloat(getComputedStyle(el).letterSpacing) || 0; if (ls > 0) el.style.paddingLeft = ls + 'px'; }
  o.el = el;
  F.items.push(o);
  return o;
};
const ANCH = { c: [-50, -50], l: [0, -50], r: [-100, -50], tl: [0, 0], tr: [-100, 0], bl: [0, -100], br: [-100, -100], t: [-50, 0], b: [-50, -100] };
F.updateUI = (t) => {
  for (const o of F.items) {
    const el = o.el;
    if (t < o.t0 - 0.01 || t > o.t1 + 0.01) { if (el.style.display !== 'none') el.style.display = 'none'; continue; }
    el.style.display = '';
    const kin = smooth(o.t0, o.t0 + o.fin, t), kout = 1 - smooth(o.t1 - o.fout, o.t1, t);
    const a = ANCH[o.anchor] || ANCH.c;
    let x = typeof o.x === 'function' ? o.x(t) : o.x, y = typeof o.y === 'function' ? o.y(t) : o.y;
    let op = Math.min(kin, kout) * o.opacity, dy = 0, bl = 0, sc = 1;
    if (o.anim === 'fade') {
      const ki = ease.out(kin);
      dy = (1 - ki) * o.dy; bl = (1 - ki) * o.blur + (1 - kout) * o.blur * 0.6;
    } else if (o.anim === 'chars') {
      op = kout * o.opacity; bl = (1 - kout) * o.blur * 0.6;
      const n = o.spans.length;
      for (let i = 0; i < n; i++) {
        const k = ease.out(smooth(o.t0 + i * o.stagger, o.t0 + i * o.stagger + o.fin, t));
        const s = o.spans[i];
        s.style.opacity = k.toFixed(3);
        s.style.transform = `translateY(${((1 - k) * o.dy).toFixed(2)}px)`;
        s.style.filter = k < 0.999 ? `blur(${((1 - k) * o.blur).toFixed(2)}px)` : 'none';
      }
    } else if (o.anim === 'wipe') {
      const k = ease.inOut(kin);
      el.style.clipPath = `inset(-20% ${((1 - k) * 100).toFixed(2)}% -20% 0)`;
    }
    if (o.scale) sc = typeof o.scale === 'function' ? o.scale(t) : o.scale;
    el.style.opacity = op.toFixed(3);
    el.style.left = x + 'px'; el.style.top = y + 'px';
    el.style.transform = `translate(${a[0]}%, ${a[1]}%) translateY(${dy.toFixed(2)}px) scale(${sc})`;
    el.style.filter = bl > 0.05 ? `blur(${bl.toFixed(2)}px)` : 'none';
    if (o.update) o.update(el, t, Math.min(kin, kout), o);
  }
};

// Chapter label (top-left) + hairline
F.chapter = (t0, t1, n, zh, en) => {
  F.ui({ t0, t1, x: 96, y: 78, anchor: 'tl', cls: 'chap', html: `<b>${n}</b><span class="zh">${zh}</span>${en}`, anim: 'wipe', fin: 1.4, fout: 0.8 });
  F.ui({ t0: t0 + 0.2, t1, x: 96, y: 112, anchor: 'tl', html: '', cls: 'rule', style: { width: '260px' }, anim: 'wipe', fin: 1.6, fout: 0.8 });
  F.sfx(t0, 'chapter');
};

// ---------------- Detector geometry (metres; origin at detector centre, depth 1950 m) ----------------
const DET = F.det = { strings: [], doms: [] };
(function buildDetector() {
  const sp = 125, R = 5, pts = [];
  for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
    const s = -q - r; if (Math.abs(s) > R) continue;
    pts.push({ q, r, x: sp * (q + r / 2), z: sp * (r * Math.sqrt(3) / 2), ring: Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) });
  }
  // irregular footprint: drop 13 outer-ring positions (deterministic)
  const outer = pts.filter(p => p.ring === R).sort((a, b) => Math.atan2(a.z, a.x) - Math.atan2(b.z, b.x));
  const drop = new Set([0, 1, 2, 3, 4, 10, 11, 12, 18, 19, 20, 26, 27].map(i => outer[i]));
  let std = pts.filter(p => !drop.has(p));
  // outermost layer of the remaining footprint (used as veto shell)
  const has = new Set(std.map(p => p.q + ',' + p.r));
  const nb = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  for (const p of std) p.edge = nb.some(([dq, dr]) => !has.has((p.q + dq) + ',' + (p.r + dr)));
  for (const p of std) {
    const s = { x: p.x, z: p.z, deep: false, edge: p.edge, doms: [] };
    for (let k = 0; k < 60; k++) { const depth = 1450 + 17 * k; s.doms.push(depth); }
    DET.strings.push(s);
  }
  // DeepCore: 8 strings around the centre string
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + 0.3, rr = i % 2 ? 72 : 52;
    const s = { x: Math.cos(a) * rr + 20, z: Math.sin(a) * rr - 30, deep: true, edge: false, doms: [] };
    for (let k = 0; k < 10; k++) s.doms.push(1750 + 10 * k);
    for (let k = 0; k < 50; k++) s.doms.push(2100 + 7 * k);
    DET.strings.push(s);
  }
  DET.strings.forEach((s, si) => {
    s.doms = s.doms.map((d, k) => {
      const y = 1950 - d;
      const dom = { p: [s.x, y, s.z], s: si, k, depth: d, veto: s.edge || d < 1450 + 90 || d > 2440 || (d > 2100 && d < 2160 && !s.deep) };
      DET.doms.push(dom); return dom;
    });
  });
})();

// ---------------- light propagation (visual time units) ----------------
const N_ICE = 1.32, TH_C = Math.acos(1 / N_ICE);
F.N_ICE = N_ICE; F.TH_C = TH_C;
// track: p0, dir (unit), t0, v (m/s visual). returns direct-light arrival time & perpendicular distance
F.trackHit = (p0, d, t0, v, r) => {
  const w = V.sub(r, p0), L = V.dot(w, d), rho = Math.sqrt(Math.max(0, V.dot(w, w) - L * L));
  const vl = v / N_ICE;
  const t = t0 + (L - rho / Math.tan(TH_C)) / v + rho / (Math.sin(TH_C) * vl);
  const sEmit = L - rho / Math.tan(TH_C);
  return { t, rho, L, sEmit };
};
F.cascadeHit = (c, t0, v, r) => { const d = V.len(V.sub(r, c)); return { t: t0 + d / (v / N_ICE), d }; };

// Build an event display from a light source description; returns hits [{dom, t, q}]
F.buildEvent = (opt) => {
  const rng = RNG(opt.seed || 7), hits = [];
  for (const dom of DET.doms) {
    if (opt.skipDeep !== false && DET.strings[dom.s].deep) continue;
    let t, dist, q;
    if (opt.type === 'track') {
      const h = F.trackHit(opt.p0, opt.dir, opt.t0, opt.v, dom.p);
      if (h.sEmit < (opt.sMin ?? -1e9) || h.sEmit > (opt.sMax ?? 1e9)) continue;
      t = h.t; dist = h.rho; q = opt.E * Math.exp(-dist / opt.lam) / (1 + dist / 25);
    } else {
      const h = F.cascadeHit(opt.c, opt.t0, opt.v, dom.p);
      t = h.t; dist = h.d; q = opt.E * Math.exp(-dist / opt.lam) / (1 + (dist / 40) ** 1.6);
    }
    q *= 0.6 + 0.8 * rng();
    if (q < opt.thr) continue;
    t += (dist / (opt.v / N_ICE)) * 0.18 * rng(); // scattering delay
    hits.push({ dom, t, q });
  }
  hits.sort((a, b) => a.t - b.t);
  if (hits.length) { const ta = hits[0].t, tb = hits[hits.length - 1].t; for (const h of hits) h.u = (h.t - ta) / Math.max(1e-6, tb - ta); }
  return hits;
};
// draw event hits at time t (visual seconds)
F.drawHits = (e, hits, t, opt = {}) => {
  const sz = opt.size || 1, al = opt.alpha ?? 1, cp = e.cam.pos;
  for (const h of hits) {
    if (t < h.t) continue;
    const age = t - h.t;
    const flash = Math.exp(-age * 5.0);
    const dist = V.len(V.sub(h.dom.p, cp));
    const df = clamp(1300 / dist, 0.55, 1.35);
    const r = (1.8 + Math.min(8, Math.sqrt(h.q) * 1.25)) * sz * df;
    const col = opt.mono || timeColor(h.u);
    e.spritePx(h.dom.p, r * (1 + flash * 0.6), col, al * (0.75 + flash * 0.9), 1);
    if (opt.glow !== false) e.spritePx(h.dom.p, r * 3.0, col, al * (0.04 + flash * 0.18), 0);
  }
};
// draw detector lattice
F.drawDetector = (e, opt = {}) => {
  const a = opt.alpha ?? 1, col = opt.col || [0.55, 0.75, 1.0];
  const strA = opt.stringAlpha ?? 0.22, domA = opt.domAlpha ?? 0.35, px = opt.px || 2.2;
  const sel = opt.strings;
  DET.strings.forEach((s, si) => {
    if (sel && !sel(s, si)) return;
    const cp = e.xf ? null : e.cam.pos;
    const near = cp ? smooth(30, 260, Math.hypot(s.x - cp[0], s.z - cp[2])) : 1;
    const sa = (opt.strAlphaFn ? opt.strAlphaFn(s, si) : 1) * a * (0.25 + 0.75 * near);
    if (sa <= 0.001) return;
    const top = opt.toSurface ? [s.x, 1950, s.z] : [s.x, s.doms[0].p[1] + 8, s.z];
    const yb = opt.yBottom ? opt.yBottom(s, si) : s.doms[s.doms.length - 1].p[1] - 4;
    e.line(top, [s.x, yb, s.z], opt.lineW || 1.0, col, strA * sa * (opt.toSurface ? 0.35 : 1), strA * sa, 0.3);
    for (const d of s.doms) {
      if (d.p[1] < yb) continue;
      let c = col, aa = domA * sa;
      if (opt.domFn) { const r = opt.domFn(d); if (!r) continue; c = r[0]; aa *= r[1]; }
      if (aa <= 0.002) continue;
      e.spritePx(d.p, px, c, aa, 1);
    }
  });
};

// ---------------- sky & globe helpers ----------------
const STARS = (() => {
  const r = RNG(99), out = [];
  for (let i = 0; i < 2200; i++) {
    const d = r.sphere(), m = Math.pow(r(), 6);
    const tint = r();
    const col = tint < 0.15 ? [1.0, 0.82, 0.65] : tint < 0.35 ? [0.7, 0.82, 1.0] : [0.92, 0.95, 1.0];
    out.push({ d, m, col, ph: r() * 100, tw: 0.5 + r() * 2 });
  }
  return out;
})();
F.drawStars = (e, t, a = 1, dist = 4000, minY = -2) => {
  const c = e.cam.pos;
  for (const s of STARS) {
    if (s.d[1] < minY) continue;
    const tw = 0.75 + 0.25 * Math.sin(t * s.tw + s.ph);
    e.spritePx(V.add(c, V.mul(s.d, dist)), 1.2 + s.m * 3.2, s.col, a * (0.18 + s.m * 1.3) * tw, 0);
  }
};
const GLOBE = (() => {
  const n = 5200, out = [], ga = Math.PI * (3 - Math.sqrt(5));
  const r = RNG(5);
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2, rad = Math.sqrt(1 - y * y), th = ga * i;
    // pseudo-continent mask from smooth noise
    const p = [Math.cos(th) * rad, y, Math.sin(th) * rad];
    const m = noise1(p[0] * 2.3 + 11, 3) + noise1(p[1] * 2.1 + 5, 4) * 0.8 + noise1(p[2] * 2.7 + 2, 5) * 0.9;
    out.push({ p, land: y < -0.84, j: r() });
  }
  return out;
})();
F.drawGlobe = (e, c, R, t, opt = {}) => {
  const a = opt.alpha ?? 1, sun = V.norm(opt.sun || [-1, 0.3, 0.6]);
  const rot = opt.rot || 0, cr = Math.cos(rot), sr = Math.sin(rot);
  const camDir = V.norm(V.sub(e.cam.pos, c));
  for (const g of GLOBE) {
    const p = [g.p[0] * cr - g.p[2] * sr, g.p[1], g.p[0] * sr + g.p[2] * cr];
    const facing = V.dot(p, camDir);
    if (facing < -0.05) continue;
    const lit = clamp(V.dot(p, sun) * 0.7 + 0.45, 0.12, 1);
    const fr = 0.5 + 0.5 * Math.pow(1 - clamp(facing), 1.6);
    const col = g.land ? [0.85, 0.95, 1.0] : [0.35, 0.6, 1.0];
    const ps = clamp(R / 170, 0.45, 1);
    e.spritePx(V.add(c, V.mul(p, R)), (g.land ? 2.2 : 1.6) * ps, col, a * lit * (g.land ? 0.85 : 0.5 * fr) * clamp(facing * 6 + 0.3), 1);
  }
  // atmosphere rim
  const up0 = Math.abs(camDir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = V.norm(V.cross(camDir, up0)), v = V.cross(u, camDir);
  for (let i = 0; i < 180; i++) {
    const an = i / 180 * Math.PI * 2;
    const dir = V.add(V.mul(u, Math.cos(an)), V.mul(v, Math.sin(an)));
    const lit = clamp(V.dot(dir, sun) * 0.7 + 0.45, 0.1, 1);
    e.sprite(V.add(c, V.mul(dir, R * 1.015)), R * 0.06, [0.35, 0.65, 1.0], a * 0.16 * lit, 0);
  }
};

// helper: Catmull-Rom-ish camera path
F.camPath = (keys, t) => {
  // keys: [{t, pos, target, fov}] — piecewise ease-in-out between keys
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const u = (b.ease || ease.inOut)((t - a.t) / (b.t - a.t));
      return { pos: V.lerp(a.pos, b.pos, u), target: V.lerp(a.target, b.target, u), fov: mix(a.fov || 45, b.fov || 45, u) };
    }
  }
  return keys[keys.length - 1];
};
// subtle organic camera drift
F.drift = (t, amp = 1, seed = 0) => [noise1(t * 0.13, seed + 1) * amp, noise1(t * 0.11, seed + 2) * amp * 0.6, noise1(t * 0.09, seed + 3) * amp];

// 2D camera: world units == pixels at z=0, origin at screen centre
F.cam2D = (e, extra = {}) => {
  const D = 540 / Math.tan(22.5 * Math.PI / 180);
  e.cam.pos = [extra.x || 0, extra.y || 0, D]; e.cam.target = [extra.x || 0, extra.y || 0, 0]; e.cam.up = [0, 1, 0]; e.cam.fov = 45; e.cam.near = 1; e.cam.far = 20000;
};
// scene registry
F.scene = (s) => { F.scenes.push(s); return s; };
})();
