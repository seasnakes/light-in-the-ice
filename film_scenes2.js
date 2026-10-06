// Scenes F–I: Cherenkov light, atmospheric background & veto, discovery, epilogue.
(function () {
'use strict';
const { V, W, H, clamp, mix, smooth, ease, env, RNG, noise1, timeColor } = ENG;
const DET = F.det;
const CYAN = [0.45, 0.82, 1.0], ICE = [0.6, 0.8, 1.0], GOLD = [1.0, 0.78, 0.4], AMBER = [1.0, 0.6, 0.25], RED = [1.0, 0.32, 0.25];
const NI = F.N_ICE, TH = F.TH_C;

function basis(d) { const a = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]; const e1 = V.norm(V.cross(d, a)); return [e1, V.cross(d, e1)]; }
function mergeHits(...lists) {
  const m = new Map();
  for (const L of lists) for (const h of L) { const o = m.get(h.dom); if (!o) m.set(h.dom, { ...h }); else { o.t = Math.min(o.t, h.t); o.q += h.q; } }
  const out = [...m.values()].sort((a, b) => a.t - b.t);
  const ta = out[0].t, tb = out[out.length - 1].t; for (const h of out) h.u = (h.t - ta) / (tb - ta);
  return out;
}
// expanding light shell (cascade) — sprites on a sphere
const SPH = (() => { const r = RNG(8), o = []; for (let i = 0; i < 380; i++) o.push(r.sphere()); return o; })();
function lightShell(e, c, t, t0, v, lam, a = 1, col = [0.45, 0.65, 1.0]) {
  if (t < t0) return; const r = (t - t0) * v / NI; const f = Math.exp(-r / lam) * a; if (f < 0.01) return;
  for (const s of SPH) e.sprite(V.add(c, V.mul(s, r)), 3 + r * 0.02, col, 0.55 * f, 0);
}
function flash(e, c, t, t0, size, a = 1, col = [0.85, 0.95, 1.0]) {
  if (t < t0) return; const f = Math.exp(-(t - t0) * 2.2), g = Math.exp(-(t - t0) * 6.0);
  e.sprite(c, size * (0.7 + 0.3 * f), col, a * (0.04 + 0.30 * f), 0);
  e.sprite(c, size * 0.28, col, a * (0.25 + 0.9 * f), 0);
  e.sprite(c, size * 0.1, [1, 1, 1], a * (0.3 + 1.6 * g), 3);
}
function hitSfx(hits, maxN, type, extra = {}) {
  const sel = [...hits].sort((a, b) => b.q - a.q).slice(0, maxN);
  for (const h of sel) F.sfx(h.t, type, Object.assign({ q: Math.min(1, Math.sqrt(h.q) / 6), u: h.u, pan: clamp(h.dom.p[0] / 500, -1, 1) * 0.8 }, extra));
}

// =====================================================================================
// F · CHERENKOV LIGHT  [111, 137)
// =====================================================================================
const VTX = [-130, -170, 70], MD = V.norm([0.82, 0.44, -0.36]), TV = 115.5, VMU = 170, VL = VMU / NI;
const muPos = (t) => V.add(VTX, V.mul(MD, Math.max(0, (t - TV) * VMU)));
const [E1, E2] = basis(MD);
const HITS_F = mergeHits(
  F.buildEvent({ type: 'track', p0: VTX, dir: MD, t0: TV, v: VMU, E: 260, lam: 48, thr: 1.0, sMin: 0, sMax: 1400, seed: 3 }),
  F.buildEvent({ type: 'cascade', c: VTX, t0: TV, v: VMU, E: 260, lam: 45, thr: 1.0, seed: 4 }),
);
const BURST = (() => { const r = RNG(15), o = []; for (let i = 0; i < 70; i++) { const d = V.norm(V.add(MD, V.mul(r.sphere(), 0.9))); o.push({ d, s: r.range(20, 90) }); } return o; })();
F.scene({
  t0: 111, t1: 137, fin: 1.0, fout: 0.6,
  setup() {
    F.chapter(111.4, 144.6, '04', '切伦科夫光', 'CHERENKOV LIGHT');
    F.ui({ t0: 111.8, t1: 115.6, x: 150, y: 470, anchor: 'l', cls: 'body', html: '一个中微子，撞上了冰中的原子核……' });
    F.ui({ t0: 116.4, t1: 121.4, x: 150, y: 470, anchor: 'l', cls: 'body', html: '新生的带电粒子，<br>跑得比冰中的光还快——' });
    F.ui({ t0: 121.8, t1: 127.6, x: 150, y: 450, anchor: 'l', cls: 'body', html: '于是激起一道蓝色光锥：<br>光学的“音爆”' });
    F.ui({ t0: 122.4, t1: 127.6, x: 152, y: 560, anchor: 'l', cls: 'h1-en', html: 'CHERENKOV RADIATION' });
    // cone geometry diagram (top right)
    const ox = 1330, oy = 800, L = 300, th = 41 * Math.PI / 180, al = 49 * Math.PI / 180;
    const svg = `<svg width="1920" height="1080" fill="none" stroke-linecap="round">
      <path id="g0" d="M ${ox} ${oy} L ${ox + L} ${oy}" stroke="#e8f4ff" stroke-width="1.4" pathLength="1" stroke-dasharray="1 1"/>
      <path id="g1" d="M ${ox + L} ${oy} L ${ox + L - 220 * Math.cos(al)} ${oy - 220 * Math.sin(al)} M ${ox + L} ${oy} L ${ox + L - 220 * Math.cos(al)} ${oy + 220 * Math.sin(al)}" stroke="#7fb4ff" stroke-width="1" pathLength="1" stroke-dasharray="1 1"/>
      <path id="g2" d="M ${ox + 70} ${oy} L ${ox + 70 + 150 * Math.cos(th)} ${oy - 150 * Math.sin(th)}" stroke="#9fd8ff" stroke-width="1" stroke-dasharray="4 5"/>
      <path id="g3" d="M ${ox + 130} ${oy} A 60 60 0 0 0 ${ox + 70 + 60 * Math.cos(th)} ${oy - 60 * Math.sin(th)}" stroke="#d9b872" stroke-width="1"/>
    </svg>`;
    F.ui({
      t0: 117.0, t1: 127.6, x: 0, y: 0, anchor: 'tl', html: svg, dy: 0, blur: 0, fin: 0.6,
      update: (el, t) => {
        el.querySelector('#g0').setAttribute('stroke-dashoffset', 1 - ease.out(smooth(117.0, 118.2, t)));
        el.querySelector('#g1').setAttribute('stroke-dashoffset', 1 - ease.out(smooth(117.8, 119.2, t)));
        el.querySelector('#g2').style.opacity = smooth(119.0, 119.8, t); el.querySelector('#g3').style.opacity = smooth(119.4, 120.2, t);
      },
    });
    F.ui({ t0: 119.6, t1: 127.6, x: 1330 + 70 + 70, y: 800 - 44, anchor: 'l', cls: 'mono', html: '<span style="color:#d9b872">θ ≈ 41°</span>' });
    F.ui({ t0: 118.6, t1: 127.6, x: 1330, y: 890, anchor: 'tl', cls: 'note', html: '冰中光速 ≈ 0.76 c<br>粒子速度 ≈ c' , style: { lineHeight: '1.9' } });
    F.ui({ t0: 118.2, t1: 127.6, x: 1330 + 318, y: 800, anchor: 'c', cls: 'mono', html: 'μ' });
    // event reading
    F.ui({ t0: 128.4, t1: 132.4, x: 150, y: 470, anchor: 'l', cls: 'body', html: '每个模块，记下光子到达的<br>时刻与数量' });
    F.ui({ t0: 132.6, t1: 136.6, x: 150, y: 470, anchor: 'l', cls: 'body', html: '把这些时间戳拼在一起，<br>就能重建方向与能量' });
    F.ui({
      t0: 128.8, t1: 136.6, x: 1500, y: 930, anchor: 'c', html: `<div style="display:flex;align-items:center;gap:14px"><span class="note">早</span>
      <div style="width:240px;height:3px;background:linear-gradient(90deg,#ff2e1f,#ff8c1f,#f2e640,#4cff73,#26bfff,#7359ff)"></div><span class="note">晚</span></div>
      <div class="note" style="text-align:center;margin-top:12px;font-size:13px">颜色 = 到达时间 · 大小 = 光子数</div>`,
    });
    F.sfx(111.0, 'deep_bed', { dur: 26 });
    F.sfx(112.0, 'nu_approach', { dur: 3.5 });
    F.sfx(TV, 'vertex', {});
    F.sfx(TV, 'muon', { dur: 7.0 });
    F.sfx(116.2, 'cone_swell', { dur: 8 });
    hitSfx(HITS_F, 70, 'hit_ping');
  },
  draw(e, t, lt) {
    const keys = [
      { t: 111, pos: [-560, -60, 560], target: VTX, fov: 42 },
      { t: 116, pos: [-470, -50, 470], target: VTX, fov: 42 },
      { t: 122.5, pos: [-230, 120, 700], target: V.add(VTX, V.mul(MD, 320)), fov: 44 },
      { t: 128, pos: [-260, 300, 1050], target: V.add(VTX, V.mul(MD, 470)), fov: 44 },
      { t: 135, pos: [-1250, 650, 1850], target: [80, -40, 0], fov: 40 },
      { t: 137, pos: [-1350, 700, 1950], target: [80, -40, 0], fov: 40 },
    ];
    const c = F.camPath(keys, t);
    e.cam.pos = V.add(c.pos, F.drift(t, 7, 11)); e.cam.target = c.target; e.cam.fov = c.fov; e.cam.up = [0, 1, 0]; e.cam.near = 1; e.cam.far = 20000;
    e.bg.mode = 1; e.bg.c0 = [0.0, 0.002, 0.008]; e.bg.c1 = [0.008, 0.025, 0.06]; e.bg.p = [0.2, 0, 0, 0];
    // lattice
    F.drawDetector(e, { alpha: 1, stringAlpha: 0.12, domAlpha: 0.26, px: 2.0, col: [0.55, 0.72, 1.0] });
    // incoming neutrino (ghostly, dashed)
    if (t < TV + 0.3) {
      const n0 = V.sub(VTX, V.mul(MD, 1100)), u = clamp((t - 112.0) / (TV - 112.0));
      for (let i = 0; i < 40; i++) {
        const s = i / 40; if (s > u) break;
        const p = V.lerp(n0, VTX, s), a = 0.08 + 0.35 * Math.exp(-(u - s) * 10);
        e.sprite(p, 3, [0.65, 0.8, 1.0], a, 0);
      }
      if (u > 0 && u < 1) e.sprite(V.lerp(n0, VTX, u), 10, [0.7, 0.9, 1.0], 0.7, 0);
    }
    // vertex flash + hadronic burst + cascade light shell
    flash(e, VTX, t, TV, 180, 1.0);
    if (t > TV) for (const b of BURST) { const a = t - TV, r = b.s * (1 - Math.exp(-a * 3)); const f = Math.exp(-a * 1.2); if (f > 0.02) e.sprite(V.add(VTX, V.mul(b.d, r)), 3, [0.9, 0.85, 1.0], f, 0); }
    lightShell(e, VTX, t, TV, VMU, 55, 0.7);
    // muon + Cherenkov cone
    if (t > TV) {
      const sNow = Math.min((t - TV) * VMU, 1500), head = muPos(t);
      e.line(VTX, head, 2.2, [0.85, 0.92, 1.0], 0.25, 1.0, 1.2);
      e.sprite(head, 9, [0.9, 0.97, 1.0], 1.3, 3);
      const Rmax = 270, step = 5;
      for (let se = Math.max(0, sNow - Rmax * 1.6); se <= sNow; se += step) {
        const age = (sNow - se) / VMU, r = age * VL; if (r > Rmax) continue;
        const base = V.add(VTX, V.mul(MD, se)), f = Math.exp(-r / 125) * (0.55 + 0.45 * smooth(0, 15, r));
        const nphi = 22;
        for (let k = 0; k < nphi; k++) {
          const ph = k / nphi * Math.PI * 2 + se * 0.37;
          const n = V.add(V.mul(E1, Math.cos(ph)), V.mul(E2, Math.sin(ph)));
          const dir = V.add(V.mul(MD, Math.cos(TH)), V.mul(n, Math.sin(TH)));
          e.sprite(V.add(base, V.mul(dir, r)), 3.8, [0.35, 0.55, 1.0], 0.5 * f, 0);
        }
      }
    }
    F.drawHits(e, HITS_F, t, { size: 1 });
    e.post.bloom = 1.05;
  },
});

// =====================================================================================
// F2 · TWO TOPOLOGIES  [137, 145)
// =====================================================================================
const TRK = { p0: [-760, 330, -250], d: V.norm([1, -0.38, 0.28]), t0: 137.7, v: 1100 };
const HITS_T = F.buildEvent({ type: 'track', p0: TRK.p0, dir: TRK.d, t0: TRK.t0, v: TRK.v, E: 260, lam: 50, thr: 0.9, seed: 9 });
const CAS = { c: [40, -60, 30], t0: 139.0, v: 520 };
const HITS_C = F.buildEvent({ type: 'cascade', c: CAS.c, t0: CAS.t0, v: CAS.v, E: 1500, lam: 66, thr: 0.9, seed: 10 });
const XL = (p) => [p[0] * 0.56 - 600, p[1] * 0.56, p[2] * 0.56], XR = (p) => [p[0] * 0.56 + 600, p[1] * 0.56, p[2] * 0.56];
F.scene({
  t0: 137, t1: 145, fin: 0.7, fout: 0.7,
  setup() {
    const lab = (t0, side, zh, en, sub) => {
      F.ui({ t0, t1: 144.4, x: 960 + side * 520, y: 840, anchor: 'c', cls: 'tag center', html: `${zh}<small>${en}</small>`, style: { fontSize: '26px' } });
      F.ui({ t0: t0 + 0.4, t1: 144.4, x: 960 + side * 520, y: 912, anchor: 'c', cls: 'note center', html: sub });
    };
    lab(137.8, -1, '径迹', 'Track', 'μ 子可穿行数公里 · 方向精度约 1°');
    lab(139.2, 1, '簇射', 'Cascade', '能量集中沉积 · 方向约 10°–15°');
    F.sfx(TRK.t0, 'track_zip', { pan: -0.6, dur: 1.6 });
    F.sfx(CAS.t0, 'cascade_bloom', { pan: 0.6 });
    hitSfx(HITS_T, 22, 'hit_ping', { pan: -0.5 });
    hitSfx(HITS_C, 22, 'hit_ping', { pan: 0.5 });
  },
  draw(e, t, lt) {
    e.cam.pos = V.add([0, 520, 2450], F.drift(t, 6, 13)); e.cam.target = [0, -60, 0]; e.cam.fov = 40; e.cam.up = [0, 1, 0];
    e.bg.mode = 1; e.bg.c0 = [0.0, 0.002, 0.008]; e.bg.c1 = [0.008, 0.025, 0.06]; e.bg.p = [0.2, 0, 0, 0];
    for (const [xf, hits, kind] of [[XL, HITS_T, 'T'], [XR, HITS_C, 'C']]) {
      e.xf = xf; e.xs = 0.56;
      F.drawDetector(e, { stringAlpha: 0.12, domAlpha: 0.28, px: 1.7 });
      if (kind === 'T' && t > TRK.t0) {
        const s = (t - TRK.t0) * TRK.v, head = V.add(TRK.p0, V.mul(TRK.d, Math.min(s, 1700)));
        e.line(TRK.p0, head, 1.8, [0.85, 0.92, 1.0], 0.3, 1.0, 1.0);
        if (s < 1700) e.sprite(head, 12, [0.9, 0.97, 1.0], 1.2, 3);
      }
      if (kind === 'C') { flash(e, CAS.c, t, CAS.t0, 120, 0.9); lightShell(e, CAS.c, t, CAS.t0, CAS.v, 70, 0.6); }
      F.drawHits(e, hits, t, { size: 0.8 });
    }
    e.xf = null; e.xs = 1;
  },
});

// =====================================================================================
// G1 · THE ATMOSPHERIC BACKGROUND (side view)  [145, 156.2)
// =====================================================================================
const SV = (p) => [p[0] * 0.42 + 230, p[1] * 0.42 - 270, p[2] * 0.42];
const ATM_Y = 360, SURF_Y = -40;
const SHOWERS = (() => {
  const r = RNG(55), out = []; let t = 145.7;
  while (t < 156) {
    const x0 = r.range(-260, 720);
    const segs = [];
    const grow = (p, ang, len, depth, tt) => {
      const q = [p[0] + Math.sin(ang) * len, p[1] - Math.cos(ang) * len];
      segs.push({ a: p, b: q, t: tt, d: depth });
      if (depth < 3) { const n = 2 + (r() < 0.4 ? 1 : 0); for (let i = 0; i < n; i++) grow(q, ang + r.range(-0.45, 0.45), len * r.range(0.6, 0.85), depth + 1, tt + 0.07); }
    };
    grow([x0, ATM_Y], r.range(-0.15, 0.15), r.range(36, 52), 0, t);
    const muons = [];
    const nm = 2 + Math.floor(r() * 3);
    for (let i = 0; i < nm; i++) {
      const ang = r.range(-0.16, 0.16), z = r.range(-190, 190), x = x0 + r.range(-25, 25);
      muons.push({ x, z, ang, t0: t + 0.2 + r.range(0, 0.08) });
    }
    out.push({ t, x0, segs, muons });
    t += r.range(0.10, 0.36) * mix(1.4, 0.35, (t - 145.7) / 10);
  }
  // DOM hits along muons (scaled coordinates)
  const doms = DET.doms.map(d => ({ d, q: SV(d.p) }));
  const VMS = 1500;
  for (const s of out) for (const m of s.muons) {
    m.hits = [];
    const dir = [Math.sin(m.ang), -Math.cos(m.ang)];
    for (const o of doms) {
      const dy = 300 - o.q[1], tt = dy / Math.cos(m.ang) / VMS; // time from y=300
      const xx = m.x + dir[0] * dy / Math.cos(m.ang) * Math.cos(m.ang) / Math.cos(m.ang);
      const px = m.x + Math.tan(m.ang) * dy;
      const dist = Math.hypot(o.q[0] - px, o.q[2] - m.z);
      if (dist < 26) m.hits.push({ q: o.q, t: m.t0 + tt, w: 1 - dist / 26 });
    }
    m.tIn = m.t0 + (300 - SURF_Y) / VMS;
  }
  return out;
})();
F.scene({
  t0: 145, t1: 156.2, fin: 1.0, fout: 0.6,
  setup() {
    F.chapter(145.4, 171.6, '05', '噪声之海', 'THE ATMOSPHERIC BACKGROUND');
    F.ui({ t0: 145.8, t1: 155.8, x: 1610, y: 120 + 540 - ATM_Y - 6, anchor: 'l', cls: 'note', html: '大气层' });
    F.ui({ t0: 145.8, t1: 155.8, x: 1610, y: 540 - SURF_Y - 18, anchor: 'l', cls: 'note', html: '冰面' });
    F.ui({ t0: 145.8, t1: 155.8, x: 1610, y: 540 + 270 + 120, anchor: 'l', cls: 'note', html: '冰立方<br><span style="font-size:12px">深 1.45–2.45 km</span>' });
    F.ui({ t0: 146.2, t1: 155.8, x: 1610, y: 1000, anchor: 'l', cls: 'note', html: '示意图 · 未按比例', style: { fontSize: '12px' } });
    F.ui({
      t0: 146.0, t1: 155.8, x: 150, y: 150, anchor: 'tl', fin: 0.8,
      html: `<div class="unit-en" style="margin-bottom:8px">Atmospheric muons · counted</div><div class="num-m" id="mc">0</div><div class="note" style="margin-top:8px">约 2,900 个 / 秒 · 每天上亿个</div>`,
      update: (el, t) => { el.querySelector('#mc').textContent = Math.max(0, Math.floor((t - 146.0) * 2900)).toLocaleString('en-US'); },
    });
    F.ui({ t0: 146.6, t1: 150.8, x: 150, y: 600, anchor: 'l', cls: 'body', html: '然而，冰立方看到的<br>绝大多数信号，并非来自宇宙。' });
    F.ui({ t0: 151.0, t1: 155.8, x: 150, y: 580, anchor: 'l', cls: 'body', html: '宇宙线撞击大气，<br>产生的 μ 子如雨落下。' });
    F.ui({ t0: 151.8, t1: 155.8, x: 152, y: 690, anchor: 'l', cls: 'body-s', html: '大气 μ 子与中微子事件之比<br>约为一百万比一' });
    F.sfx(145.0, 'rain_bed', { dur: 11.2 });
    for (const s of SHOWERS) { F.sfx(s.t, 'cr_hit', { pan: (s.x0 - 230) / 800, gain: 0.5 }); for (const m of s.muons) F.sfx(m.tIn + 0.08, 'mu_click', { pan: (m.x - 230) / 800 }); }
  },
  draw(e, t, lt) {
    F.cam2D(e); const d = F.drift(t, 4, 17); e.cam.pos = V.add(e.cam.pos, d); e.cam.target = V.add(e.cam.target, d);
    e.bg.mode = -1; e.bg.c0 = [0.0, 0.004, 0.012]; e.bg.c1 = [0.004, 0.01, 0.03];
    F.drawStars(e, t, 0.3);
    // atmosphere band and ice surface
    for (let k = -3; k <= 3; k++) e.line([-1100, ATM_Y + k * 5, 0], [1100, ATM_Y + k * 5, 0], 1.0, [0.35, 0.55, 1.0], 0.10 * Math.exp(-k * k / 3), 0.10 * Math.exp(-k * k / 3), 0.6);
    e.line([-1100, SURF_Y, 0], [1100, SURF_Y, 0], 1.0, [0.8, 0.9, 1.0], 0.22, 0.22, 0.3);
    e.xf = SV; e.xs = 0.42;
    F.drawDetector(e, { stringAlpha: 0.12, domAlpha: 0.3, px: 1.7 });
    e.xf = null; e.xs = 1;
    for (const s of SHOWERS) {
      if (t < s.t - 0.3 || t > s.t + 2.2) continue;
      // primary
      const u = clamp((t - (s.t - 0.25)) / 0.25);
      if (u < 1) { const p = [s.x0 + (1 - u) * 60, mix(620, ATM_Y, u), 0]; e.sprite(p, 6, [1.0, 0.85, 0.6], 1.0, 0); e.line([s.x0 + 60, 620, 0], p, 1.4, [1.0, 0.8, 0.5], 0, 0.7, 1); }
      flash(e, [s.x0, ATM_Y, 0], t, s.t, 40, 0.5, [1.0, 0.8, 0.55]);
      for (const g of s.segs) {
        const k = clamp((t - g.t) / 0.07); if (k <= 0) continue;
        const fade = Math.exp(-Math.max(0, t - g.t - 0.2) * 2.5);
        e.line([g.a[0], g.a[1], 0], [mix(g.a[0], g.b[0], k), mix(g.a[1], g.b[1], k), 0], 1.1, [1.0, 0.72 + g.d * 0.06, 0.45 + g.d * 0.1], 0.7 * fade, 0.7 * fade, 0.8);
      }
      for (const m of s.muons) {
        const tt = t - m.t0; if (tt < 0) continue;
        const dy = Math.min(tt * 1500, 1100), y = 300 - dy, x = m.x + Math.tan(m.ang) * dy;
        if (y > -760) { e.line([m.x + Math.tan(m.ang) * Math.max(0, dy - 160), 300 - Math.max(0, dy - 160), m.z * 0.0], [x, y, 0], 1.3, [1.0, 0.75, 0.5], 0, 0.85, 0.9); e.sprite([x, y, 0], 4, [1.0, 0.85, 0.65], 0.9, 0); }
        for (const h of m.hits) { if (t < h.t) continue; const f = Math.exp(-(t - h.t) * 3); e.spritePx(h.q, 3 + 6 * h.w * f, [1.0, 0.7, 0.4], (0.3 + f) * h.w, 1); }
      }
    }
  },
});

// =====================================================================================
// G2 · THE VETO  [156.2, 172)
// =====================================================================================
const MA = { p0: [330, 1000, -160], d: V.norm([-0.26, -1, 0.14]), t0: 159.2, v: 900 };
const HITS_MA = F.buildEvent({ type: 'track', p0: MA.p0, dir: MA.d, t0: MA.t0, v: MA.v, E: 220, lam: 45, thr: 0.9, seed: 21 });
const CB = { c: [-30, -90, 40], t0: 163.6, v: 520 };
const HITS_CB = F.buildEvent({ type: 'cascade', c: CB.c, t0: CB.t0, v: CB.v, E: 900, lam: 58, thr: 0.9, seed: 22 }).filter(h => !h.dom.veto);
const entryMA = (() => { let best = null; for (const h of HITS_MA) if (h.dom.veto) { best = h; break; } return best ? best.dom.p : [0, 500, 0]; })();
F.scene({
  t0: 156.2, t1: 172, fin: 0.9, fout: 0.8,
  setup() {
    F.ui({ t0: 156.7, t1: 161.0, x: 150, y: 905, anchor: 'l', cls: 'body', html: '对策：把探测器的外层，当作一道“否决层”。' });
    F.ui({ t0: 157.4, t1: 171.4, x: 150, y: 966, anchor: 'l', cls: 'note', html: '<span class="amber">● 外层模块 · 否决层</span> &nbsp;&nbsp; <span class="cyan">● 内部模块</span>' });
    F.ui({ t0: 161.2, t1: 165.4, x: 150, y: 905, anchor: 'l', cls: 'body', html: '从外部闯入的 μ 子，会先点亮外层——剔除。' });
    F.ui({ t0: 165.6, t1: 171.4, x: 150, y: 905, anchor: 'l', cls: 'body', html: '只保留在内部“凭空”亮起的高能事件。' });
    F.ui({ t0: 167.4, t1: 171.4, x: 1770, y: 905, anchor: 'r', cls: 'body-s', html: '对 6000 个光电子以上的事件<br>可剔除 <span style="color:#fff">99.999%</span> 的大气 μ 子', style: { textAlign: 'right' } });
    const tagAt = (t0, t1, p, html, cls) => F.ui({ t0, t1, x: 0, y: 0, anchor: 'l', cls: 'tag ' + cls, html, fin: 0.6, update: (el) => { const q = F.e.project(p); el.style.left = (q[0] + 40) + 'px'; el.style.top = (q[1] - 30) + 'px'; } });
    tagAt(160.4, 163.2, entryMA, 'VETO · 剔除<small>entering muon</small>', 'red');
    tagAt(165.0, 171.4, CB.c, 'KEEP · 保留<small>starting event</small>', 'gold');
    F.sfx(156.2, 'veto_bed', { dur: 15.8 });
    F.sfx(157.0, 'shell_on', {});
    F.sfx(MA.t0, 'track_zip', { pan: 0.2, dur: 1.4 });
    F.sfx(160.4, 'reject', {});
    F.sfx(CB.t0, 'cascade_bloom', { pan: 0 });
    F.sfx(165.0, 'accept', {});
    hitSfx(HITS_MA, 20, 'hit_ping', { pan: 0.2 });
    hitSfx(HITS_CB, 26, 'hit_ping', { pan: 0 });
  },
  draw(e, t, lt) {
    const a = 2.25 + lt * 0.028;
    e.cam.pos = V.add([Math.sin(a) * 2500, 1000 - lt * 12, Math.cos(a) * 2500], F.drift(t, 8, 19)); e.cam.target = [0, -10, 0]; e.cam.fov = 37; e.cam.up = [0, 1, 0];
    e.bg.mode = 1; e.bg.c0 = [0.0, 0.002, 0.008]; e.bg.c1 = [0.008, 0.022, 0.055]; e.bg.p = [0.2, 0, 0, 0];
    const sh = smooth(156.6, 158.2, t);
    F.drawDetector(e, {
      stringAlpha: 0.12, domAlpha: 0.32, px: 2.1,
      domFn: (d) => d.veto ? [V.lerp([0.55, 0.72, 1.0], AMBER, sh), 1 + sh * 0.6] : [V.lerp([0.55, 0.72, 1.0], [0.4, 0.8, 1.0], sh), 0.75],
    });
    // muon from above (vetoed)
    const fa = 1 - smooth(162.4, 163.4, t);
    if (t > MA.t0 && fa > 0) {
      const s = (t - MA.t0) * MA.v, head = V.add(MA.p0, V.mul(MA.d, Math.min(s, 2000)));
      e.line(MA.p0, head, 1.8, [1.0, 0.75, 0.6], 0.2 * fa, 1.0 * fa, 1.0);
      if (s < 2000) e.sprite(head, 10, [1.0, 0.85, 0.7], 1.1 * fa, 3);
      for (const h of HITS_MA) { if (t < h.t) continue; const f = Math.exp(-(t - h.t) * 4); const r = 1.8 + Math.min(6, Math.sqrt(h.q) * 1.0); const col = h.dom.veto ? RED : [0.55, 0.6, 0.75]; e.spritePx(h.dom.p, r * (1 + f * 0.5), col, fa * (h.dom.veto ? 0.75 + 0.8 * f : 0.35 + 0.4 * f), 1); if (h.dom.veto) e.spritePx(h.dom.p, r * 3.2, RED, fa * (0.08 + 0.3 * f), 0); }
    }
    // contained cascade (kept)
    if (t > CB.t0 - 0.1) { flash(e, CB.c, t, CB.t0, 150, 1.0, [1.0, 0.92, 0.75]); lightShell(e, CB.c, t, CB.t0, CB.v, 70, 0.6, [0.7, 0.75, 1.0]); F.drawHits(e, HITS_CB, t, { size: 1 }); }
  },
});

// =====================================================================================
// H · DISCOVERY  [172, 201)
// =====================================================================================
const BERT = { c: [-170, -230, 140], t0: 173.6 }, ERNIE = { c: [190, 70, -110], t0: 176.0 }, BIGB = { c: [10, -40, 10], t0: 191.8 };
const evOf = (o, E, seed, lam = 62) => F.buildEvent({ type: 'cascade', c: o.c, t0: o.t0, v: 520, E, lam, thr: 0.9, seed });
const HB = evOf(BERT, 1000, 31), HE = evOf(ERNIE, 1100, 32), HBB = evOf(BIGB, 2200, 33, 75);
const SMALL = (() => { const r = RNG(61), o = []; for (let i = 0; i < 35; i++) o.push({ c: [r.range(-380, 380), r.range(-380, 380), r.range(-320, 320)], s: r.range(0.4, 1.0) }); return o; })();
const T_BEAD = []; // appearance times for beads 3..28 and 29..37
for (let i = 0; i < 26; i++) T_BEAD.push(181.6 + i * 0.13);
for (let i = 0; i < 9; i++) T_BEAD.push(189.9 + i * 0.16);
F.scene({
  t0: 172, t1: 201, fin: 1.0, fout: 0.9,
  setup() {
    F.chapter(172.4, 193.8, '06', '来自宇宙', 'THE DISCOVERY');
    // data-taking timeline
    F.ui({
      t0: 172.6, t1: 180.8, x: 960, y: 150, anchor: 'c', html: `<div style="display:flex;align-items:center;gap:22px"><span class="mono">2010.05</span><div style="width:520px;height:1px;background:rgba(190,220,255,.5);position:relative"><div id="tlp" style="position:absolute;left:0;top:-2px;height:5px;background:#bfe6ff;box-shadow:0 0 12px #8fd6ff"></div></div><span class="mono">2012.05</span></div><div class="note center" style="margin-top:14px">IceCube 数据 · 662 天有效观测</div>`,
      update: (el, t) => { el.querySelector('#tlp').style.width = (520 * ease.inOut(smooth(172.8, 177.5, t))) + 'px'; },
    });
    const tagAt = (t0, t1, p, html) => F.ui({ t0, t1, x: 0, y: 0, anchor: 'l', cls: 'tag', html, fin: 0.7, update: (el) => { const q = F.e.project(p); el.style.left = (q[0] + 60) + 'px'; el.style.top = (q[1] - 40) + 'px'; } });
    tagAt(174.3, 180.8, BERT.c, '<span style="font:200 40px Inter">1.04</span> <span class="unit-en">PeV</span><small>“Bert” · 2011</small>');
    tagAt(176.7, 180.8, ERNIE.c, '<span style="font:200 40px Inter">1.14</span> <span class="unit-en">PeV</span><small>“Ernie” · 2012</small>');
    F.ui({ t0: 177.4, t1: 180.8, x: 960, y: 900, cls: 'body center', html: '两个能量超过 1 PeV 的中微子事件' });
    F.ui({ t0: 178.0, t1: 180.8, x: 960, y: 958, cls: 'body-s center', html: '1 PeV = 10¹⁵ 电子伏特 —— 比大型强子对撞机中的质子能量高出百倍以上' });
    // bead counter
    const beadsHtml = () => {
      let h = '<div style="position:relative;width:1000px;height:220px">';
      for (let i = 0; i < 37; i++) h += `<div class="bead" id="b${i}" style="left:${(i % 37) * 26 + 20}px;top:30px;opacity:0"></div>`;
      for (let i = 0; i < 11; i++) h += `<div class="bead bg" id="g${i}" style="left:${i * 26 + 21}px;top:140px;opacity:0;${i === 10 ? 'clip-path:inset(0 40% 0 0)' : ''}"></div>`;
      h += `<div class="unit-en" style="position:absolute;left:20px;top:0">Observed</div><div class="unit-en" style="position:absolute;left:20px;top:112px">Expected atmospheric background</div>`;
      h += `<div id="obs" class="num-m" style="position:absolute;left:1000px;top:10px;font-size:46px">2</div><div class="num-m" id="exp" style="position:absolute;left:1000px;top:120px;font-size:46px;color:rgba(255,190,120,.9);opacity:0">10.6</div>`;
      return h + '</div>';
    };
    F.ui({
      t0: 181.2, t1: 193.8, x: 960 - 520, y: 700, anchor: 'tl', html: beadsHtml(), fin: 0.8,
      update: (el, t) => {
        let n = 2;
        for (let i = 0; i < 37; i++) {
          const ti = i < 2 ? 181.2 : T_BEAD[i - 2]; const k = smooth(ti, ti + 0.25, t);
          el.querySelector('#b' + i).style.opacity = k; if (k > 0.5 && i >= 2) n = i + 1;
          el.querySelector('#b' + i).style.transform = `scale(${1 + 0.8 * Math.exp(-(t - ti) * 8) * (t > ti ? 1 : 0)})`;
        }
        el.querySelector('#obs').textContent = n;
        for (let i = 0; i < 11; i++) el.querySelector('#g' + i).style.opacity = smooth(185.4 + i * 0.07, 185.7 + i * 0.07, t);
        el.querySelector('#exp').style.opacity = smooth(186.0, 186.6, t);
      },
    });
    F.ui({ t0: 186.9, t1: 189.6, x: 960, y: 190, cls: 'body center', html: '纯大气起源被以 <span style="font:200 42px Inter">4σ</span> 排除 —— 宇宙中微子的有力证据', style: { fontSize: '30px' } });
    F.ui({ t0: 187.5, t1: 189.6, x: 960, y: 246, cls: 'note center', html: 'IceCube Collaboration · Science 342, 1242856 (2013)' });
    F.ui({ t0: 189.8, t1: 193.6, x: 960, y: 190, cls: 'body center', html: '加入第三年数据：988 天，37 个事件', style: { fontSize: '30px' } });
    F.ui({ t0: 190.4, t1: 193.6, x: 960, y: 246, cls: 'note center', html: '沉积能量 30 – 2000 TeV' });
    tagAt(192.4, 193.8, BIGB.c, '<span style="font:200 40px Inter">≈ 2</span> <span class="unit-en">PeV</span><small>“Big Bird” · 当时观测到的最高能中微子相互作用</small>');
    // climax
    F.ui({ t0: 194.6, t1: 200.4, x: 960, y: 430, cls: 'huge', html: '5.7σ', anim: 'fade', fin: 1.6, blur: 30, dy: 0, scale: (t) => 0.94 + 0.06 * ease.out(smooth(194.6, 200, t)) });
    F.ui({ t0: 195.8, t1: 200.4, x: 960, y: 640, cls: 'body center', html: '纯大气起源被排除' });
    F.ui({ t0: 196.8, t1: 200.4, x: 960 + 8, y: 720, cls: 'h1 center', html: '宇宙高能中微子，确认存在。', style: { fontSize: '54px' } });
    F.ui({ t0: 197.8, t1: 200.4, x: 960, y: 800, cls: 'note center', html: 'IceCube Collaboration · Phys. Rev. Lett. 113, 101101 (2014) · 到达方向各向同性' });
    F.sfx(172.0, 'discovery_bed', { dur: 22.6 });
    F.sfx(BERT.t0, 'pev_boom', { pan: -0.3 }); F.sfx(ERNIE.t0, 'pev_boom', { pan: 0.3 });
    hitSfx(HB, 30, 'hit_ping', { pan: -0.3 }); hitSfx(HE, 30, 'hit_ping', { pan: 0.3 });
    T_BEAD.forEach((tt, i) => F.sfx(tt, 'bead', { i }));
    F.sfx(185.4, 'expected', {});
    F.sfx(186.9, 'sigma4', { dur: 3 });
    F.sfx(BIGB.t0, 'pev_boom', { pan: 0, big: 1 });
    hitSfx(HBB, 40, 'hit_ping', { pan: 0 });
    F.sfx(192.6, 'riser', { dur: 2.0 });
    F.sfx(194.6, 'climax', { dur: 6.4 });
  },
  draw(e, t, lt) {
    const a = 0.75 + lt * 0.022;
    e.cam.pos = V.add([Math.sin(a) * 2650, 760 - lt * 6, Math.cos(a) * 2650], F.drift(t, 8, 23)); const bz = smooth(180.5, 182, t) * (1 - smooth(191, 192.2, t)); e.cam.target = [0, bz * -330, 0]; e.cam.fov = 37 + 10 * bz - smooth(191, 194, t) * 4; e.cam.up = [0, 1, 0];
    e.bg.mode = 1; e.bg.c0 = [0.0, 0.002, 0.008]; e.bg.c1 = [0.008, 0.022, 0.055]; e.bg.p = [0.2, 0, 0, 0];
    const dim = 1 - 0.55 * smooth(180.5, 182, t) * (1 - smooth(191.0, 191.8, t)) - 0.9 * smooth(194.0, 195.2, t);
    F.drawDetector(e, { alpha: dim, stringAlpha: 0.12, domAlpha: 0.28, px: 2.0 });
    const evA = (1 - 0.7 * smooth(180.5, 182, t)) * (1 - 0.97 * smooth(194.0, 195.2, t));
    for (const [o, hs] of [[BERT, HB], [ERNIE, HE]]) { flash(e, o.c, t, o.t0, 220, evA); lightShell(e, o.c, t, o.t0, 520, 80, 0.7 * evA); F.drawHits(e, hs, t, { size: 1.1, alpha: evA }); }
    // the other events as small flashes when their bead appears
    SMALL.forEach((s, i) => {
      if (i >= T_BEAD.length) return; const tt = T_BEAD[i]; if (t < tt) return;
      const f = Math.exp(-(t - tt) * 2.5), aa = (0.25 + 0.75 * f) * s.s * (1 - 0.95 * smooth(194.0, 195.2, t));
      e.sprite(s.c, 50 + 80 * f, timeColor(0.4 + 0.5 * s.s), aa * 0.6, 0); e.sprite(s.c, 12, [1, 1, 1], aa, 0);
    });
    const bbA = 1 - 0.97 * smooth(194.0, 195.2, t);
    flash(e, BIGB.c, t, BIGB.t0, 380, bbA); lightShell(e, BIGB.c, t, BIGB.t0, 520, 110, 0.9 * bbA); F.drawHits(e, HBB, t, { size: 1.25, alpha: bbA });
    e.post.bloom = 1.0 + 0.6 * env(t, 194.6, 197, 0.2, 2.0);
    e.post.exposure = 1.0 + 0.25 * Math.exp(-Math.max(0, t - 194.6) * 1.5) * (t > 194.6 ? 1 : 0);
  },
});

// =====================================================================================
// I · A NEW ASTRONOMY  [201, 222)
// =====================================================================================
const GR = 420, SP = [0, -GR, 0];
const raDec = (ra, dec, rot) => { const r = ra * Math.PI / 180 + rot, d = dec * Math.PI / 180; return [Math.cos(d) * Math.cos(r), Math.sin(d), Math.cos(d) * Math.sin(r)]; };
const ROT = 1.95;
const SOURCES = [
  { dir: raDec(77.36, 5.69, ROT), t: 202.0, zh: 'TXS 0506+056 · 耀变体', en: '2017 · 首个被指认的高能中微子源' },
  { dir: raDec(40.67, -0.01, ROT), t: 203.7, zh: 'NGC 1068 · 活动星系', en: '2022' },
];
const GAL = (() => { // galactic plane: great circle inclined 62.87° to the equator
  const out = [], r = RNG(71), inc = 62.87 * Math.PI / 180, node = 282.86 * Math.PI / 180 + ROT;
  for (let i = 0; i < 900; i++) {
    const l = r() * Math.PI * 2, b = r.gauss() * 0.06;
    let p = [Math.cos(l) * Math.cos(b), Math.sin(b), Math.sin(l) * Math.cos(b)];
    p = [p[0], p[1] * Math.cos(inc) - p[2] * Math.sin(inc), p[1] * Math.sin(inc) + p[2] * Math.cos(inc)];
    p = [p[0] * Math.cos(node) - p[2] * Math.sin(node), p[1], p[0] * Math.sin(node) + p[2] * Math.cos(node)];
    out.push({ p, m: r() });
  }
  return out;
})();
const GAL_T = 205.4;
F.scene({
  t0: 201, t1: 222, fin: 1.2, fout: 1.4,
  setup() {
    F.chapter(201.4, 209.4, '07', '新的天文学', 'A NEW ASTRONOMY');
    const far = (s) => V.add(SP, V.mul(s.dir, 2600));
    SOURCES.forEach((s) => {
      F.ui({ t0: s.t + 0.5, t1: 209.4, x: 0, y: 0, anchor: 'l', cls: 'tag', html: `${s.zh}<small>${s.en}</small>`, fin: 0.8, update: (el) => { const q = F.e.project(far(s)); el.style.left = clamp(q[0] + 30, 80, 1500) + 'px'; el.style.top = clamp(q[1], 120, 980) + 'px'; } });
      F.sfx(s.t, 'source_chime', { i: SOURCES.indexOf(s) });
    });
    F.ui({ t0: GAL_T + 0.6, t1: 209.4, x: 0, y: 0, anchor: 'l', cls: 'tag', html: '银河系盘面<small>2023</small>', fin: 0.8, update: (el) => { const q = F.e.project(V.add(SP, V.mul(GAL[7].p, 2600))); el.style.left = clamp(q[0] + 30, 80, 1500) + 'px'; el.style.top = clamp(q[1], 120, 980) + 'px'; } });
    F.sfx(GAL_T, 'source_chime', { i: 2 });
    F.ui({ t0: 201.6, t1: 209.4, x: 0, y: 0, anchor: 'l', cls: 'note', html: '冰立方 · 南极', fin: 0.8, update: (el) => { const q = F.e.project(SP); el.style.left = (q[0] + 26) + 'px'; el.style.top = (q[1] + 18) + 'px'; } });
    F.ui({ t0: 206.6, t1: 209.4, x: 960, y: 960, cls: 'body center', html: '一门新的天文学，由此开启。' });
    F.ui({ t0: 210.2, t1: 216.4, x: 960, y: 474, cls: 'q', html: '一立方公里的冰，', anim: 'chars', stagger: 0.08, fin: 1.2 });
    F.ui({ t0: 211.5, t1: 216.4, x: 960, y: 566, cls: 'q', html: '成为了望向宇宙深处的一只眼睛。', anim: 'chars', stagger: 0.08, fin: 1.2 });
    F.ui({ t0: 216.9, t1: 221.6, x: 960, y: 440, cls: 'kicker-zh', html: '2026 年诺贝尔物理学奖' });
    F.ui({ t0: 217.2, t1: 221.6, x: 960 + 12, y: 510, cls: 'name-zh', html: '弗朗西斯·哈尔岑', style: { fontSize: '56px' } });
    F.ui({ t0: 217.5, t1: 221.6, x: 960 + 12, y: 572, cls: 'name-en', html: 'FRANCIS&nbsp;HALZEN', style: { fontSize: '18px' } });
    F.ui({ t0: 218.2, t1: 221.6, x: 960, y: 900, cls: 'note center', html: '资料：NobelPrize.org · IceCube Collaboration, Science 342 (2013) · PRL 113 (2014) · JINST 12 (2017)', style: { fontSize: '13px' } });
    F.ui({ t0: 218.5, t1: 221.6, x: 960, y: 934, cls: 'note center', html: '粒子路径与探测事件为示意动画', style: { fontSize: '13px' } });
    F.sfx(201.0, 'epilogue_bed', { dur: 21 });
    F.sfx(210.0, 'final_swell', { dur: 7 });
    F.sfx(216.9, 'bell', { note: 74, vel: 0.55 });
  },
  draw(e, t, lt) {
    const keys = [
      { t: 201, pos: [260, -760, 880], target: [0, -260, 0], fov: 42 },
      { t: 208.5, pos: [600, -420, 2450], target: [0, -40, 0], fov: 40 },
      { t: 222, pos: [900, 300, 9000], target: [0, 0, 0], fov: 36, ease: ease.sine },
    ];
    const c = F.camPath(keys, t);
    e.cam.pos = V.add(c.pos, F.drift(t, 10, 29)); e.cam.target = c.target; e.cam.fov = c.fov; e.cam.up = [0, 1, 0]; e.cam.near = 1; e.cam.far = 30000;
    e.bg.mode = -1; e.bg.c0 = [0.0, 0.0, 0.004]; e.bg.c1 = [0.003, 0.006, 0.018];
    const late = smooth(209, 212, t);
    F.drawStars(e, t, 0.6 + 0.4 * late);
    const ga = 1 - smooth(208.8, 211.0, t);
    F.drawGlobe(e, [0, 0, 0], GR, t, { rot: 0.3 + lt * 0.01, sun: [0.4, -0.5, 0.8], alpha: ga });
    // IceCube marker at the South Pole
    const pul = 0.7 + 0.3 * Math.sin(t * 2.4);
    e.sprite(SP, 14, [0.7, 0.92, 1.0], 1.2 * pul * ga + 0.25 * late * (1 - smooth(213, 217, t)), 3);
    e.sprite(SP, 70, [0.35, 0.6, 1.0], 0.25 * ga, 0);
    // galactic plane band
    const gk = smooth(GAL_T - 0.6, GAL_T + 1.2, t) * (1 - 0.6 * late);
    if (gk > 0) for (const g of GAL) e.sprite(V.add(SP, V.mul(g.p, 2600)), 18 + g.m * 26, [0.75, 0.65, 1.0], 0.09 * gk * (0.5 + g.m), 0);
    // neutrinos travelling from sources, through the Earth, to the South Pole
    const lines = SOURCES.map(s => ({ dir: s.dir, t: s.t, a: 1 }));
    if (t > GAL_T) for (const i of [7, 120, 333]) lines.push({ dir: GAL[i].p, t: GAL_T + (i % 5) * 0.12, a: 0.55 });
    for (const L of lines) {
      if (t < L.t) continue;
      const far = V.add(SP, V.mul(L.dir, 2600));
      const u = ease.inOut(clamp((t - L.t) / 1.4)), head = V.lerp(far, SP, u);
      const fa = L.a * (1 - smooth(208.8, 211.0, t));
      e.line(far, head, 1.2, CYAN, 0.0, 0.5 * fa, 1.0);
      if (u < 1) e.sprite(head, 12, [0.75, 0.95, 1.0], 1.0 * fa, 0);
      else { const f = Math.exp(-(t - L.t - 1.4) * 2); e.sprite(SP, 60, [0.6, 0.9, 1.0], (0.2 + 0.8 * f) * fa, 0); }
      e.sprite(far, 16, [0.85, 0.9, 1.0], 0.9 * fa * smooth(L.t, L.t + 0.4, t), 3);
    }
  },
});
})();
