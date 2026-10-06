// Scenes A–E: cold open, title, ghost particle, messengers, the ice, the array, the DOM.
(function () {
'use strict';
const { V, W, H, clamp, mix, smooth, ease, env, RNG, noise1, timeColor } = ENG;
const DET = F.det;
const px2 = (x, y) => [960 + x, 540 - y];      // 2D-camera world → pixel
const CYAN = [0.45, 0.82, 1.0], ICE = [0.6, 0.8, 1.0], GOLD = [1.0, 0.8, 0.45];

// =====================================================================================
// A · COLD OPEN  [0, 15)
// =====================================================================================
F.scene({
  t0: 0, t1: 15, fin: 1.5, fout: 0.9,
  setup() {
    F.ui({ t0: 1.8, t1: 14.2, x: 960, y: 330, cls: 'kicker', html: 'The Nobel Prize in Physics &nbsp;·&nbsp; 2026', fin: 1.6 });
    F.ui({ t0: 2.5, t1: 14.2, x: 960, y: 376, cls: 'kicker-zh', html: '2026 年诺贝尔物理学奖', fin: 1.6 });
    F.ui({ t0: 4.6, t1: 14.2, x: 960, y: 478, cls: 'name-zh', html: '弗朗西斯·哈尔岑', anim: 'chars', stagger: 0.11, fin: 1.4, blur: 14, dy: 10 });
    F.ui({ t0: 5.7, t1: 14.2, x: 960, y: 566, cls: 'name-en', html: 'FRANCIS&nbsp;HALZEN', fin: 1.8 });
    F.ui({ t0: 6.5, t1: 14.2, x: 960, y: 612, cls: 'affil', html: '美国威斯康星大学麦迪逊分校 · 冰立方首席研究员', fin: 1.6 });
    F.ui({ t0: 7.6, t1: 14.2, x: 960, y: 668, cls: 'rule', html: '', style: { width: '160px', background: 'linear-gradient(90deg,rgba(217,184,114,0),rgba(217,184,114,.8),rgba(217,184,114,0))' }, anim: 'wipe', fin: 1.4 });
    F.ui({ t0: 8.4, t1: 14.2, x: 960, y: 770, cls: 'cite', html: '表彰他对冰立方中微子天文台<br>及发现天体物理起源高能中微子的决定性贡献', fin: 1.8 });
    F.sfx(0.0, 'open_bed', { dur: 15 });
    F.sfx(1.8, 'bell', { note: 74, vel: 0.5 });
    F.sfx(4.6, 'name_swell', { dur: 3.0 });
    F.sfx(8.4, 'shimmer', { dur: 4.0 });
    F.sfx(12.9, 'streak_whoosh', { dur: 2.0 });
  },
  draw(e, t, lt) {
    F.cam2D(e); e.cam.pos[2] -= lt * 6;
    e.bg.mode = -1; e.bg.c0 = [0.0, 0.0, 0.003]; e.bg.c1 = [0.004, 0.008, 0.02];
    e.post.bloom = 1.0;
    F.drawStars(e, t, smooth(0, 6, lt) * 0.8);
    const k = smooth(0.4, 7.5, lt), src = [0, 365, 0];
    const pulse = 1 + 0.08 * Math.sin(lt * 2.1);
    e.sprite(src, 30 * k * pulse, [0.78, 0.9, 1.0], 1.1 * k, 3);
    e.sprite(src, 140 * k, [0.35, 0.55, 1.0], 0.07 * k, 0);
    // a single neutrino leaves the source and falls toward the viewer's world
    if (lt > 12.9) {
      const u = ease.in((lt - 12.9) / 1.9), y = mix(365, -700, u);
      e.line(src, [0, y, 0], 1.6, CYAN, 0.0, 0.9, 1.2);
      e.sprite([0, y, 0], 9, [0.7, 0.95, 1.0], 1.2, 0);
    }
  },
});

// =====================================================================================
// B · QUESTION + TITLE  [15, 27)
// =====================================================================================
F.scene({
  t0: 15, t1: 27, fin: 1.6, fout: 0.8,
  setup() {
    F.ui({ t0: 15.6, t1: 20.5, x: 960, y: 470, cls: 'q', html: '一立方公里的南极冰，', anim: 'chars', stagger: 0.075, fin: 1.1 });
    F.ui({ t0: 16.9, t1: 20.5, x: 960, y: 562, cls: 'q', html: '怎样变成一架望远镜？', anim: 'chars', stagger: 0.075, fin: 1.1 });
    F.ui({ t0: 21.05, t1: 26.4, x: 960 + 33, y: 468, cls: 'title', html: '冰中之光', anim: 'chars', stagger: 0.2, fin: 1.6, blur: 22, dy: 0 });
    F.ui({ t0: 22.1, t1: 26.4, x: 960 + 11, y: 600, cls: 'title-en', html: 'LIGHT IN THE ICE', fin: 1.8 });
    F.ui({ t0: 22.7, t1: 26.4, x: 960, y: 650, cls: 'title-sub', html: '冰立方与宇宙高能中微子的发现', fin: 1.8 });
    F.sfx(15.2, 'pad_bed', { dur: 6 });
    F.sfx(18.6, 'riser', { dur: 2.4 });
    F.sfx(21.0, 'impact', { gain: 1.0 });
    F.sfx(21.0, 'title_chord', { dur: 6 });
  },
  draw(e, t, lt) {
    const a = 0.55 + lt * 0.032;
    e.cam.pos = [Math.sin(a) * 2500, 420 - lt * 14, Math.cos(a) * 2500]; e.cam.target = [0, -30, 0]; e.cam.fov = 37; e.cam.up = [0, 1, 0];
    e.bg.mode = -1; e.bg.c0 = [0.0, 0.003, 0.01]; e.bg.c1 = [0.0, 0.01, 0.03];
    const intro = smooth(0, 3.5, lt), wave = lt > 5.9 && lt < 8 ? 1 : 0;
    const yf = 650 - (lt - 6.0) * 1000;
    F.drawDetector(e, {
      alpha: intro, stringAlpha: 0.16 + 0.1 * smooth(6, 6.8, lt), domAlpha: 0.32 + 0.12 * smooth(6, 7, lt), px: 2.3,
      domFn: (d) => {
        const h = (d.s * 61 + d.k * 17) % 97 / 97;
        const tw = Math.max(0, Math.sin((lt * 0.35 + h) * 6.283 * 1.0) - 0.96) * 25;
        let w = wave ? Math.exp(-(((d.p[1] - yf) / 45) ** 2)) * 6 : 0;
        const c = w > 0.05 ? V.lerp(ICE, [0.9, 0.97, 1.0], clamp(w / 3)) : ICE;
        return [c, 1 + tw + w];
      },
    });
    if (wave) e.post.bloom = 1.0 + Math.exp(-(lt - 6.0) * 2) * 0.8;
  },
});

// =====================================================================================
// C1 · THE GHOST PARTICLE  [27, 43)
// =====================================================================================
const STREAKS = (() => { const r = RNG(31), o = []; for (let i = 0; i < 420; i++) o.push({ y: r.range(-520, 520), z: r.range(-420, 420), ts: r.range(-2.5, 16.5), sp: r.range(1500, 2100), w: r.range(0.8, 1.7), b: r.range(0.4, 1.0), hero: r() < 0.06 }); return o; })();
F.scene({
  t0: 27, t1: 43.2, fin: 1.2, fout: 0.7,
  setup() {
    F.chapter(27.5, 59.5, '01', '幽灵粒子', 'THE GHOST PARTICLE');
    F.ui({ t0: 28.4, t1: 34.4, x: 150, y: 392, anchor: 'l', cls: 'h1', html: '中微子' });
    F.ui({ t0: 28.9, t1: 34.4, x: 154, y: 462, anchor: 'l', cls: 'h1-en', html: 'NEUTRINO' });
    F.ui({ t0: 29.6, t1: 34.4, x: 152, y: 532, anchor: 'l', cls: 'body-s', html: '不带电荷 · 质量近乎为零 · 只参与弱相互作用' });
    F.ui({ t0: 34.9, t1: 42.5, x: 150, y: 420, anchor: 'l', cls: 'body', html: '每一秒，约有 650 亿个来自太阳的中微子，<br>穿过你身体的每一平方厘米。' });
    F.ui({ t0: 38.4, t1: 42.5, x: 152, y: 548, anchor: 'l', cls: 'body-s', html: '而它们几乎全部，不留痕迹地穿了过去。' });
    F.sfx(27.0, 'nu_bed', { dur: 16.2 });
    // whooshes for hero streaks crossing the frame
    for (const s of STREAKS) if (s.hero) { const tc = 27 + s.ts + 2400 / s.sp; if (tc > 28 && tc < 42.5) F.sfx(tc - 0.35, 'pass', { pan: 0, gain: 0.35 }); }
  },
  draw(e, t, lt) {
    e.cam.pos = V.add([0, 70, 1500 - lt * 10], F.drift(t, 12, 3)); e.cam.target = [40, 0, 0]; e.cam.fov = 40; e.cam.up = [0, 1, 0];
    e.bg.mode = -1; e.bg.c0 = [0.0, 0.0, 0.004]; e.bg.c1 = [0.003, 0.006, 0.018];
    F.drawStars(e, t, 0.55);
    const gc = [360, -10, 0];
    F.drawGlobe(e, gc, 300, t, { rot: 1.2 + lt * 0.045, sun: [-1, 0.25, 0.5], alpha: smooth(0, 2.5, lt) });
    const dens = mix(0.25, 1.0, smooth(7.5, 11, lt));
    STREAKS.forEach((s, i) => {
      if (i / STREAKS.length > dens) return;
      const x = -2400 + s.sp * (lt - s.ts), len = s.hero ? 520 : 300;
      if (x < -2600 || x - len > 2600) return;
      const col = s.hero ? [0.7, 0.95, 1.0] : CYAN;
      e.line([x - len, s.y, s.z], [x, s.y, s.z], s.hero ? 2.0 : s.w, col, 0.0, (s.hero ? 1.0 : 0.55) * s.b, s.hero ? 1.4 : 0.8);
      e.sprite([x, s.y, s.z], s.hero ? 7 : 3.5, [0.75, 0.95, 1.0], s.hero ? 1.1 : 0.6 * s.b, 0);
    });
  },
});

// =====================================================================================
// C2 · MESSENGERS  [43.2, 60)
// =====================================================================================
const SRC = [-760, 40, 0], EARTH = [760, 40, 0], CLOUD = [-250, 40, 0], FIELD = [230, 40, 0], SPEED = 520;
const T_PH = 44.0, T_PR = 47.0, T_NU = 51.0;
const CLOUD_PTS = (() => { const r = RNG(77), o = []; for (let i = 0; i < 700; i++) o.push([CLOUD[0] + r.gauss() * 62, CLOUD[1] + r.gauss() * 85, r.gauss() * 40, r()]); return o; })();
const PROTON_PATH = (() => {
  const pts = []; let p = [SRC[0] + 60, SRC[1]], v = [SPEED, 0], dt = 1 / 240;
  for (let i = 0; i < 240 * 6; i++) {
    const dx = p[0] - FIELD[0], dy = p[1] - FIELD[1], r = Math.hypot(dx, dy);
    const B = r < 280 ? 3.1 * (1 - r / 280) ** 0.5 : 0;
    const ang = B * dt; const c = Math.cos(ang), s = Math.sin(ang);
    v = [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
    p = [p[0] + v[0] * dt, p[1] + v[1] * dt];
    pts.push({ t: i * dt, p: [p[0], p[1], 0] });
  }
  return pts;
})();
F.scene({
  t0: 43.2, t1: 60, fin: 1.0, fout: 0.8,
  setup() {
    const lab = (t0, x, y, zh, en, cls = '') => F.ui({ t0, t1: 59.3, x: px2(x, y)[0], y: px2(x, y)[1], anchor: 'c', cls: 'tag center ' + cls, html: `${zh}<small>${en}</small>`, fin: 0.9 });
    lab(43.8, SRC[0], SRC[1] - 120, '宇宙加速器', 'Cosmic accelerator');
    lab(44.3, -520, 150, '光子 γ', 'photon');
    F.ui({ t0: 45.4, t1: 59.3, ...xy(CLOUD[0], CLOUD[1] - 175), cls: 'note center', html: '被尘埃与气体吸收', fin: 0.8 });
    lab(47.3, -110, 150, '宇宙线 p⁺', 'cosmic ray');
    F.ui({ t0: 49.4, t1: 59.3, ...xy(FIELD[0] + 10, FIELD[1] - 210), cls: 'note center', html: '带电，被星际磁场偏转', fin: 0.8 });
    lab(51.3, 260, -60, '中微子 ν', 'neutrino', 'cyan');
    F.ui({ t0: 53.9, t1: 59.3, ...xy(EARTH[0], EARTH[1] - 130), cls: 'note center', html: '笔直抵达，指向源头', fin: 0.8 });
    F.ui({ t0: 54.9, t1: 59.4, x: 960, y: 858, cls: 'body center', html: '最理想的宇宙信使，也最难被捕捉。' });
    F.ui({ t0: 56.3, t1: 59.4, x: 960, y: 922, cls: 'body-s center', html: '要抓住它，探测器必须以“立方公里”来计量。' });
    F.sfx(43.2, 'space_bed', { dur: 16.8 });
    F.sfx(T_PH, 'emit', { kind: 'photon', pan: -0.6 });
    F.sfx(T_PH + 1.0, 'absorb', { pan: -0.3 });
    F.sfx(T_PR, 'emit', { kind: 'proton', pan: -0.6 });
    F.sfx(T_PR + 1.6, 'deflect', { pan: 0.2, dur: 2.2 });
    F.sfx(T_NU, 'emit', { kind: 'nu', pan: -0.6 });
    F.sfx(T_NU + (EARTH[0] - 70 - SRC[0] - 60) / SPEED, 'arrive', { pan: 0.6 });
  },
  draw(e, t, lt) {
    F.cam2D(e); const d = F.drift(t, 6, 9); e.cam.pos = V.add(e.cam.pos, d); e.cam.target = V.add(e.cam.target, d);
    e.bg.mode = -1; e.bg.c0 = [0.0, 0.0, 0.004]; e.bg.c1 = [0.003, 0.005, 0.016];
    F.drawStars(e, t, 0.45);
    const k = smooth(43.2, 44.4, t);
    // source with jets
    e.sprite(SRC, 34, [0.8, 0.9, 1.0], 1.2 * k, 3);
    e.sprite(SRC, 120, [0.4, 0.55, 1.0], 0.10 * k, 0);
    const ja = 1.15;
    for (const sg of [1, -1]) for (let i = 0; i < 26; i++) {
      const u = i / 26, q = (u + t * 0.35) % 1, r = q * 150;
      e.sprite([SRC[0] + Math.cos(ja) * r * sg, SRC[1] + Math.sin(ja) * r * sg, 0], 5 + q * 10, [0.5, 0.7, 1.0], 0.35 * (1 - q) * k, 0);
    }
    // dust cloud
    for (const c of CLOUD_PTS) e.sprite([c[0], c[1], c[2]], 16 + c[3] * 10, [0.62, 0.42, 0.28], 0.05 * k * (0.7 + 0.3 * Math.sin(t * 0.5 + c[3] * 9)), 0);
    // magnetic field lines
    for (let j = 0; j < 7; j++) {
      const rx = 70 + j * 30, ry = 120 + j * 26, pts = [];
      for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2; pts.push([FIELD[0] + Math.cos(a) * rx, FIELD[1] + Math.sin(a) * ry + Math.sin(a * 3 + t * 0.4 + j) * 6, 0]); }
      e.polyline(pts, 1.0, [0.55, 0.45, 1.0], 0.07 * k, 0.5);
    }
    // Earth
    F.drawGlobe(e, EARTH, 70, t, { rot: t * 0.1, sun: [-1, 0.2, 0.6], alpha: k });
    // --- photon: straight, absorbed in the cloud
    if (t > T_PH) {
      const x = Math.min(SRC[0] + 60 + SPEED * (t - T_PH), -120), x0 = SRC[0] + 60;
      const ab = (xx) => xx < CLOUD[0] - 110 ? 1 : Math.exp(-(xx - (CLOUD[0] - 110)) / 45);
      const tail = Math.max(x0, x - 240);
      e.line([x0, SRC[1], 0], [x, SRC[1], 0], 1.0, [1.0, 0.9, 0.7], 0.12, 0.12 * ab(x), 0.3);
      e.line([tail, SRC[1], 0], [x, SRC[1], 0], 2.0, [1.0, 0.92, 0.75], 0.0, 0.95 * ab(x), 1.2);
      if (ab(x) > 0.02) e.sprite([x, SRC[1], 0], 9, [1.0, 0.92, 0.75], ab(x), 0);
      const puff = env(t, T_PH + 0.75, T_PH + 2.4, 0.2, 1.2);
      if (puff > 0) for (let i = 0; i < 14; i++) { const a = i * 2.4, r = 20 + (t - T_PH - 0.75) * 30; e.sprite([CLOUD[0] - 90 + Math.cos(a) * r, SRC[1] + Math.sin(a) * r, 0], 12, [1.0, 0.75, 0.5], 0.25 * puff, 0); }
    }
    // --- proton: curved in the field
    if (t > T_PR) {
      const tt = t - T_PR; let n = PROTON_PATH.findIndex(p => p.t > tt); if (n < 0) n = PROTON_PATH.length;
      const pts = PROTON_PATH.slice(0, n).filter((_, i) => i % 4 === 0).map(p => p.p);
      pts.unshift([SRC[0] + 60, SRC[1], 0]);
      if (pts.length > 1) {
        e.polyline(pts, 1.0, [1.0, 0.55, 0.35], 0.14, 0.3);
        const tail = pts.slice(Math.max(0, pts.length - 30));
        e.polyline(tail, 2.0, [1.0, 0.6, 0.38], 1.0, 1.2, (u) => u);
        e.sprite(pts[pts.length - 1], 9, [1.0, 0.65, 0.45], 1.0, 0);
      }
    }
    // --- neutrino: straight through everything
    if (t > T_NU) {
      const x0 = SRC[0] + 60, xe = EARTH[0] - 70;
      const x = Math.min(x0 + SPEED * (t - T_NU), xe), tail = Math.max(x0, x - 260);
      e.line([x0, SRC[1], 0], [x, SRC[1], 0], 1.2, CYAN, 0.22, 0.22, 0.4);
      e.line([tail, SRC[1], 0], [x, SRC[1], 0], 2.4, [0.6, 0.92, 1.0], 0.0, 1.0, 1.4);
      e.sprite([x, SRC[1], 0], 10, [0.75, 0.95, 1.0], 1.2, 0);
      const ta = T_NU + (xe - x0) / SPEED;
      if (t > ta) { const f = Math.exp(-(t - ta) * 1.6); e.sprite([xe, SRC[1], 0], 60, [0.6, 0.9, 1.0], 0.6 * f + 0.15, 0); }
    }
  },
});
function xy(x, y) { const p = px2(x, y); return { x: p[0], y: p[1] }; }

// =====================================================================================
// D1 · SOUTH POLE SURFACE  [60, 69.5)
// =====================================================================================
const SNOW = (() => { const r = RNG(12), o = []; for (let i = 0; i < 900; i++) o.push([r.range(-70, 70), r.range(0, 14), r.range(-120, 40), r()]); return o; })();
const DRILL = [0, 0, -330];
F.scene({
  t0: 60, t1: 69.5, fin: 1.4, fout: 0.25,
  setup() {
    F.chapter(60.4, 97.4, '02', '冰之望远镜', 'A TELESCOPE OF ICE');
    F.ui({ t0: 60.9, t1: 68.4, x: 150, y: 386, anchor: 'l', cls: 'h1', html: '南极点' });
    F.ui({ t0: 61.4, t1: 68.4, x: 154, y: 454, anchor: 'l', cls: 'h1-en', html: 'SOUTH POLE · 90°S' });
    F.ui({ t0: 62.0, t1: 68.4, x: 152, y: 522, anchor: 'l', cls: 'body-s', html: '冰盖厚近 3 公里' });
    F.ui({ t0: 63.8, t1: 68.4, x: 152, y: 566, anchor: 'l', cls: 'body-s', html: '4.8 兆瓦热水钻：不到两天，钻透两公里以上的冰层' });
    F.ui({ t0: 63.2, t1: 68.0, ...{ x: 960, y: 600 }, cls: 'note center', html: '钻探现场', fin: 0.8, update: (el) => { const p = F.e.project([DRILL[0], 28, DRILL[2]]); el.style.left = p[0] + 'px'; el.style.top = (p[1] - 26) + 'px'; } });
    F.sfx(60.0, 'wind', { dur: 9.6 });
    F.sfx(62.8, 'drill', { dur: 6.8 });
    F.sfx(68.4, 'plunge', { dur: 1.6 });
  },
  draw(e, t, lt) {
    const tilt = ease.inOut(smooth(6.2, 9.5, lt));
    const z = 90 - lt * 14 - tilt * 130;
    e.cam.pos = V.add([0, 6 + tilt * 30, z], F.drift(t, 0.5, 4)); e.cam.target = [0, mix(5, -40, tilt), mix(-300, DRILL[2], tilt)]; e.cam.fov = 52; e.cam.up = [0, 1, 0];
    e.bg.mode = 2; e.bg.c0 = [0.035, 0.05, 0.085]; e.bg.c1 = [0.002, 0.006, 0.02]; e.bg.p = [0.32, 0.9, 1.0, 0];
    F.drawStars(e, t, 0.75, 4000, 0.03);
    // drill site lights
    e.line(DRILL, [DRILL[0], 26, DRILL[2]], 1.2, [1.0, 0.75, 0.45], 0.7, 0.4, 0.6);
    e.sprite([DRILL[0], 27, DRILL[2]], 1.8, [1.0, 0.25, 0.2], 0.6 + 0.6 * (Math.sin(t * 5) > 0.6 ? 1 : 0), 0);
    for (let i = 0; i < 9; i++) e.sprite([DRILL[0] - 12 + i * 3, 2 + (i % 3), DRILL[2] + (i % 2) * 4], 1.6, [1.0, 0.85, 0.6], 0.8, 0);
    e.sprite([DRILL[0], 4, DRILL[2]], 30, [1.0, 0.7, 0.4], 0.12, 0);
    // steam from the hot-water drill
    for (let i = 0; i < 40; i++) { const q = (i / 40 + t * 0.12) % 1; e.sprite([DRILL[0] + Math.sin(i * 7 + t) * 3 + q * 10, 2 + q * 30, DRILL[2]], 3 + q * 9, [0.9, 0.9, 1.0], 0.08 * (1 - q), 0); }
    // blowing snow
    for (const s of SNOW) {
      const x = ((s[0] + t * 11 + 70) % 140 + 140) % 140 - 70;
      const p = [x, s[1] * (0.6 + 0.4 * Math.sin(t + s[3] * 6)), e.cam.pos[2] + s[2]];
      e.line(p, [p[0] - 0.6, p[1], p[2]], 1.0, [0.85, 0.9, 1.0], 0.0, 0.25 * s[3], 0.2);
    }
    e.post.lift = smooth(8.9, 9.5, lt) * 0.55;
    e.post.vignette = 0.6;
  },
});

// =====================================================================================
// D2 · DESCENT INTO THE ICE  [69.5, 81.5)
// =====================================================================================
const depthAt = (lt) => {
  if (lt < 5.6) return mix(10, 1420, ease.inOut(lt / 5.6));
  return mix(1420, 2405, ease.inOut((lt - 5.6) / 6.4) * 0.6 + smooth(0, 6.4, lt - 5.6) * 0.4);
};
const NEIGH = [[125, 0], [62.5, 108.3], [-62.5, 108.3], [-125, 0], [-62.5, -108.3], [62.5, -108.3], [250, 0], [187.5, 108.3], [-187.5, 108.3], [-250, 0], [125, 216.5], [-125, -216.5], [0, 216.5], [0, -216.5]];
const BUB = (() => { const r = RNG(21), o = []; for (let i = 0; i < 1700; i++) o.push([r.range(-80, 80), r.range(0, 360), r.range(-80, 80), r()]); return o; })();
F.scene({
  t0: 69.5, t1: 81.5, fin: 0.5, fout: 0.6,
  setup() {
    F.ui({ t0: 71.0, t1: 75.9, x: 150, y: 450, anchor: 'l', cls: 'body', html: '1.4 公里以下，冰中的气泡几乎消失' });
    F.ui({ t0: 71.6, t1: 75.9, x: 152, y: 512, anchor: 'l', cls: 'body-s', html: '清澈、黑暗、宁静——天然的探测介质' });
    F.ui({ t0: 76.3, t1: 81.0, x: 150, y: 450, anchor: 'l', cls: 'body', html: '每根缆线串起 60 个光学模块' });
    F.ui({ t0: 76.9, t1: 81.0, x: 152, y: 512, anchor: 'l', cls: 'body-s', html: '分布在 1450 至 2450 米深处，每隔 17 米一个' });
    // depth gauge
    const g = F.ui({
      t0: 69.8, t1: 81.1, x: 1640, y: 180, anchor: 'tl', fin: 0.8, html: `
      <div style="position:absolute;left:120px;top:0;width:1px;height:720px;background:linear-gradient(180deg,rgba(190,220,255,.05),rgba(190,220,255,.45),rgba(190,220,255,.05))"></div>
      ${[0, 500, 1000, 1450, 2000, 2450].map(d => `<div class="gauge-tick" style="left:${d === 1450 || d === 2450 ? 104 : 112}px;top:${d / 2500 * 720}px;width:${d === 1450 || d === 2450 ? 32 : 16}px"></div>
      <div class="mono" style="position:absolute;left:144px;top:${d / 2500 * 720 - 9}px;font-size:12px">${d} m</div>`).join('')}
      <div class="note" style="position:absolute;left:144px;top:${1450 / 2500 * 720 + 10}px;font-size:12px;color:rgba(143,214,255,.75)">探测区上沿</div>
      <div class="note" style="position:absolute;left:144px;top:${2450 / 2500 * 720 + 10}px;font-size:12px;color:rgba(143,214,255,.75)">探测区底部</div>
      <div id="gmark" style="position:absolute;left:96px;width:48px;height:1px;background:#bfe6ff;box-shadow:0 0 10px #8fd6ff"></div>
      <div id="gnum" class="num-m" style="position:absolute;right:-60px;top:0;text-align:right;width:300px;font-size:40px"></div>
      <div class="unit-en" style="position:absolute;left:-140px;top:-26px">DEPTH</div>`,
      update: (el) => {
        const d = F.state.depth || 0;
        const m = el.querySelector('#gmark'), n = el.querySelector('#gnum');
        const y = d / 2500 * 720;
        m.style.top = y + 'px'; n.style.top = (y - 24) + 'px'; n.style.right = '86px';
        n.innerHTML = Math.round(d).toLocaleString('en-US') + '<span class="unit" style="font-size:16px;margin-left:8px">m</span>';
      },
    });
    F.sfx(69.5, 'descent', { dur: 12 });
    // soft ticks as the camera passes modules on the main string
    let prev = depthAt(0);
    for (let i = 1; i <= 12 * 120; i++) {
      const lt = i / 120, d = depthAt(lt);
      for (let k = 0; k < 60; k++) { const dd = 1450 + 17 * k + 4; if (prev < dd && d >= dd) F.sfx(69.5 + lt, 'dom_pass', { k, gain: k % 2 ? 0.5 : 0.8 }); }
      prev = d;
    }
    // crossing into the array
    for (let i = 1; i <= 12 * 120; i++) { const lt = i / 120; if (depthAt(lt - 1 / 120) < 1450 && depthAt(lt) >= 1450) F.sfx(69.5 + lt, 'threshold', {}); }
  },
  draw(e, t, lt) {
    const depth = depthAt(lt); F.state.depth = depth;
    const vel = (depthAt(lt + 0.02) - depthAt(lt)) / 0.02;
    const y = -depth;
    e.cam.pos = V.add([26, y + 4, 34], F.drift(t, 1.2, 6)); e.cam.target = [0, y - 22, 0]; e.cam.fov = 56; e.cam.up = [0, 1, 0]; e.cam.near = 0.5; e.cam.far = 3000;
    const df = smooth(0, 1500, depth);
    e.bg.mode = 1; e.bg.c0 = [0.0, 0.003, 0.01]; e.bg.c1 = V.lerp([0.2, 0.42, 0.62], [0.008, 0.03, 0.075], df); e.bg.p = [0.7 * (1 - df), 0, 0, 0];
    e.post.lift = (1 - smooth(0, 0.6, lt)) * 0.55;
    // main string + modules
    e.line([0, 0, 0], [0, -2460, 0], 1.4, [0.7, 0.8, 0.95], 0.25, 0.25, 0.2);
    for (let k = 0; k < 60; k++) {
      const p = [0, -(1450 + 17 * k), 0], dist = V.len(V.sub(p, e.cam.pos));
      const fog = Math.exp(-dist / 260);
      e.sprite(p, 0.75, [0.85, 0.92, 1.0], 0.9 * fog, 1);
      e.sprite(p, 3.2, [0.45, 0.75, 1.0], 0.18 * fog, 0);
      e.sprite([0, p[1] + 0.25, 0.1], 0.12, [0.4, 1.0, 0.6], 0.8 * fog * (Math.sin(t * 3 + k) > 0.7 ? 1 : 0.2), 0);
    }
    // neighbouring strings (fogged)
    for (const [x, z] of NEIGH) {
      const dd = Math.hypot(x - 26, z - 34), fog = Math.exp(-dd / 240);
      e.line([x, 0, z], [x, -2460, z], 1.0, [0.6, 0.75, 0.95], 0.18 * fog, 0.18 * fog, 0.2);
      for (let k = 0; k < 60; k++) {
        const p = [x, -(1450 + 17 * k), z], dy = Math.abs(p[1] - y);
        if (dy > 400) continue;
        e.spritePx(p, 3.4, [0.7, 0.85, 1.0], 1.0 * fog * Math.exp(-dy / 300), 1);
        e.spritePx(p, 10, [0.4, 0.7, 1.0], 0.12 * fog * Math.exp(-dy / 300), 0);
      }
    }
    // bubbles / ice crystals, world-static, motion-streaked
    const bubbleAmt = mix(1.0, 0.18, smooth(1100, 1500, depth));
    const st = clamp(Math.abs(vel) * 0.022, 0.3, 18);
    for (const b of BUB) {
      if (b[3] > bubbleAmt + 0.15) continue;
      const by = y - 180 + (((b[1] - (y - 180)) % 360) + 360) % 360;
      const p = [b[0], by, b[2]], dist = V.len(V.sub(p, e.cam.pos));
      const a = Math.exp(-dist / 70) * 0.32 * (b[3] < bubbleAmt ? 1 : 0.25);
      if (a < 0.01) continue;
      e.line(p, [p[0], p[1] + st, p[2]], 1.2, [0.75, 0.88, 1.0], a, 0, 0.4);
    }
  },
});

// =====================================================================================
// D3 · THE ARRAY  [81.5, 98)
// =====================================================================================
const ORDER = DET.strings.map((s, i) => ({ i, d: Math.hypot(s.x, s.z) + (s.deep ? 1000 : 0) })).sort((a, b) => a.d - b.d).map((o, r) => ({ ...o, r }));
const ST_T = {}; ORDER.forEach(o => { ST_T[o.i] = 82.0 + o.r * 0.052; });
F.scene({
  t0: 81.5, t1: 98, fin: 1.0, fout: 0.8,
  setup() {
    const stat = (t0, y, num, zh, en, cnt) => F.ui({
      t0, t1: 97.3, x: 1270, y, anchor: 'l', fin: 0.9,
      html: `<div class="stat"><div class="num-m">${num}</div><div class="lab"><span class="unit">${zh}</span><span class="unit-en">${en}</span></div></div>`,
      update: cnt ? (el, t) => { const k = ease.out(smooth(t0, t0 + 1.3, t)); el.querySelector('.num-m').textContent = cnt(k); } : null,
    });
    stat(86.6, 292, '86', '根缆线', 'Strings', (k) => Math.round(86 * k));
    stat(87.5, 392, '5,160', '个数字光学模块', 'Digital optical modules', (k) => Math.round(5160 * k).toLocaleString('en-US'));
    stat(88.4, 492, '1,450–2,450', '米 · 深度', 'Depth (m)');
    stat(89.3, 592, '125 / 17', '米 · 缆线间距 / 模块间距', 'Spacing (m)');
    stat(90.2, 692, '1 km³', '约 10 亿吨冰', 'Instrumented ice');
    F.ui({ t0: 91.6, t1: 97.3, x: 1272, y: 800, anchor: 'l', cls: 'mono', html: '2010.12.18 &nbsp;最后一根缆线就位 &nbsp;·&nbsp; 2011 全阵列运行' });
    F.ui({ t0: 92.6, t1: 97.3, x: 150, y: 930, anchor: 'l', cls: 'body', html: '冰本身，成为了探测器。' });
    F.ui({ t0: 85.5, t1: 97.0, x: 0, y: 0, cls: 'mono', html: '1 km', fin: 1.0, update: (el) => { const p = F.e.project(F.state.scaleMid || [0, 0, 0]); el.style.left = p[0] + 'px'; el.style.top = (p[1] + 26) + 'px'; } });
    ORDER.forEach(o => F.sfx(ST_T[o.i], 'string_drop', { r: o.r, pan: clamp(DET.strings[o.i].x / 600, -1, 1) * 0.7 }));
    [86.6, 87.5, 88.4, 89.3, 90.2].forEach(tt => F.sfx(tt, 'stat_tick', {}));
    F.sfx(81.5, 'array_bed', { dur: 16.5 });
    F.sfx(92.4, 'array_swell', { dur: 5 });
  },
  draw(e, t, lt) {
    const keys = [
      { t: 0, pos: [160, 380, 520], target: [0, 160, 0], fov: 46 },
      { t: 5.0, pos: [1350, 760, 1750], target: [0, 0, 0], fov: 40, ease: ease.inOut },
      { t: 16.5, pos: [2150, 880, 1350], target: [0, -40, 0], fov: 38, ease: ease.sine },
    ];
    const c = F.camPath(keys, lt);
    const fwd = V.norm(V.sub(c.target, c.pos)), right = V.norm(V.cross(fwd, [0, 1, 0]));
    const shift = smooth(3.5, 6.5, lt) * 420;
    e.cam.pos = V.add(V.add(c.pos, V.mul(right, shift)), F.drift(t, 8, 8)); e.cam.target = V.add(c.target, V.mul(right, shift)); e.cam.fov = c.fov; e.cam.up = [0, 1, 0]; e.cam.near = 1; e.cam.far = 20000;
    e.bg.mode = 1; e.bg.c0 = [0.0, 0.002, 0.008]; e.bg.c1 = [0.01, 0.03, 0.07]; e.bg.p = [0.25, 0, 0, 0];
    const breath = 1 + 0.12 * Math.sin(t * 1.3);
    DET.strings.forEach((s, si) => {
      const ts = ST_T[si]; if (t < ts) return;
      const g = ease.out(clamp((t - ts) / 0.7));
      const top = s.doms[0].p[1] + 8, bot = s.doms[s.doms.length - 1].p[1] - 4, yb = mix(top, bot, g);
      e.line([s.x, top + 1450, s.z], [s.x, top, s.z], 1.0, [0.6, 0.75, 1.0], 0.0, 0.10, 0.2);
      e.line([s.x, top, s.z], [s.x, yb, s.z], 1.0, [0.6, 0.78, 1.0], 0.22, 0.22, 0.3);
      for (const d of s.doms) {
        if (d.p[1] < yb) continue;
        const age = t - ts - (top - d.p[1]) / (top - bot) * 0.7;
        const fl = Math.exp(-Math.max(0, age) * 3.5);
        const col = s.deep ? [0.55, 0.95, 0.9] : [0.6, 0.82, 1.0];
        e.spritePx(d.p, 2.4 + fl * 3, col, (0.42 * breath + fl * 1.2), 1);
      }
    });
    // 1 km scale bar along the bottom front edge
    const sk = smooth(85.0, 86.4, t);
    if (sk > 0) {
      const a = [-500, -560, 470], b = [500, -560, 470];
      e.line(a, V.lerp(a, b, ease.inOut(sk)), 1.0, [0.8, 0.9, 1.0], 0.5, 0.5, 0.2);
      e.line(a, [a[0], a[1] + 25, a[2]], 1.0, [0.8, 0.9, 1.0], 0.5 * sk, 0.5 * sk, 0.2);
      e.line(b, [b[0], b[1] + 25, b[2]], 1.0, [0.8, 0.9, 1.0], 0.5 * sk, 0.5 * sk, 0.2);
      F.state.scaleMid = [0, -560, 470];
    }
    e.post.bloom = 1.0;
  },
});

// =====================================================================================
// E · THE DIGITAL OPTICAL MODULE  [98, 111)
// =====================================================================================
const DOMC = [-280, -10]; // sphere centre in 2D world (px from centre)
const PHOTONS = (() => { const r = RNG(41), o = []; for (let i = 0; i < 18; i++) o.push({ t: 103.2 + i * 0.36 + r.range(-0.1, 0.1), a: r.range(-2.3, -0.85), q: r() }); return o; })();
F.scene({
  t0: 98, t1: 111, fin: 1.0, fout: 0.8,
  setup() {
    F.chapter(98.4, 110.6, '03', '冰中之眼', 'THE DIGITAL OPTICAL MODULE');
    const cx = 960 + DOMC[0], cy = 540 - DOMC[1], R = 230, Rp = 178;
    const paths = [];
    const P = (d, t0, t1, extra = '') => paths.push({ d, t0, t1, extra });
    // glass sphere (double line)
    P(`M ${cx} ${cy - R} A ${R} ${R} 0 1 1 ${cx - 0.01} ${cy - R}`, 98.6, 100.4, 'stroke-width="1.4"');
    P(`M ${cx} ${cy - R + 9} A ${R - 9} ${R - 9} 0 1 1 ${cx - 0.01} ${cy - R + 9}`, 98.8, 100.6, 'stroke-width="0.7" opacity=".6"');
    // waist band
    P(`M ${cx - R - 6} ${cy - 6} L ${cx + R + 6} ${cy - 6} M ${cx - R - 6} ${cy + 6} L ${cx + R + 6} ${cy + 6}`, 99.6, 100.8, 'stroke-width="1" opacity=".7"');
    // PMT bulb (lower hemisphere) + neck
    P(`M ${cx - Rp} ${cy + 40} A ${Rp} ${Rp - 30} 0 0 0 ${cx + Rp} ${cy + 40} Q ${cx + Rp - 10} ${cy + 5} ${cx + 52} ${cy - 2} L ${cx + 40} ${cy - 60} L ${cx - 40} ${cy - 60} L ${cx - 52} ${cy - 2} Q ${cx - Rp + 10} ${cy + 5} ${cx - Rp} ${cy + 40} Z`, 99.4, 101.4, 'stroke-width="1.3" stroke="#9fe0ff"');
    // photocathode shading lines
    for (let i = 1; i <= 5; i++) { const rr = Rp - i * 22; P(`M ${cx - rr} ${cy + 40} A ${rr} ${(Rp - 30) * rr / Rp} 0 0 0 ${cx + rr} ${cy + 40}`, 99.9 + i * 0.1, 101.4, 'stroke-width="0.6" opacity=".35" stroke="#9fe0ff"'); }
    // mu-metal cage
    for (let i = -3; i <= 3; i++) P(`M ${cx + i * 48} ${cy + 18} Q ${cx + i * 54} ${cy + 120} ${cx + i * 20} ${cy + 190}`, 100.2, 101.6, 'stroke-width="0.6" opacity=".35"');
    // boards
    P(`M ${cx - 120} ${cy - 92} L ${cx + 120} ${cy - 92} L ${cx + 120} ${cy - 76} L ${cx - 120} ${cy - 76} Z`, 100.6, 101.6, 'stroke-width="1.1" stroke="#ffd59a"');
    P(`M ${cx - 140} ${cy - 128} L ${cx + 140} ${cy - 128} L ${cx + 140} ${cy - 118} L ${cx - 140} ${cy - 118} Z`, 100.9, 101.8, 'stroke-width="1" stroke="#b9f2c9"');
    P(`M ${cx - 70} ${cy - 160} L ${cx + 70} ${cy - 160} L ${cx + 70} ${cy - 150} L ${cx - 70} ${cy - 150} Z`, 101.1, 102.0, 'stroke-width="1" stroke="#ffd59a" opacity=".8"');
    for (let i = -2; i <= 2; i++) P(`M ${cx + i * 50} ${cy - 76} L ${cx + i * 50} ${cy - 60}`, 101.2, 101.8, 'stroke-width="0.8" opacity=".6"');
    // penetrator + cable
    P(`M ${cx - 16} ${cy - R - 2} L ${cx - 16} ${cy - R - 34} L ${cx + 16} ${cy - R - 34} L ${cx + 16} ${cy - R - 2}`, 101.4, 102.2, 'stroke-width="1.1"');
    P(`M ${cx} ${cy - R - 34} C ${cx + 10} ${cy - R - 120} ${cx + 120} ${cy - R - 110} ${cx + 140} ${cy - R - 240}`, 101.6, 102.6, 'stroke-width="1.6"');
    const leaders = [
      { t: 102.4, from: [cx + 16, cy - R - 20], to: [1200, 250], zh: '穿透器与缆线：供电和通讯', en: 'Penetrator & cable' },
      { t: 103.2, from: [cx + 140, cy - 123], to: [1200, 380], zh: 'LED 闪光板：在冰中互相校准', en: 'LED flasher board' },
      { t: 104.0, from: [cx + 120, cy - 84], to: [1200, 500], zh: '主板：波形数字化，纳秒级计时', en: 'Main board · digitizer & clock' },
      { t: 104.8, from: [cx + R * 0.94, cy + R * 0.34], to: [1200, 620], zh: '耐压玻璃球 · 直径 33 厘米', en: '13-inch pressure sphere' },
      { t: 105.6, from: [cx + 110, cy + 150], to: [1200, 740], zh: '光电倍增管 · 25 厘米', en: '10-inch photomultiplier tube' },
    ];
    let svg = `<svg width="1920" height="1080" viewBox="0 0 1920 1080" fill="none" stroke="#cfe6ff" stroke-linecap="round">`;
    paths.forEach((p, i) => { svg += `<path id="dp${i}" d="${p.d}" ${p.extra} pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`; });
    leaders.forEach((l, i) => { svg += `<path id="dl${i}" d="M ${l.from[0]} ${l.from[1]} L ${l.to[0] - 60} ${l.to[1]} L ${l.to[0] - 16} ${l.to[1]}" stroke="rgba(190,225,255,.55)" stroke-width="0.8" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/><circle id="dc${i}" cx="${l.from[0]}" cy="${l.from[1]}" r="3" fill="#bfe6ff" stroke="none" opacity="0"/>`; });
    svg += `</svg>`;
    F.ui({
      t0: 98.4, t1: 110.4, x: 0, y: 0, anchor: 'tl', html: svg, fin: 0.5, fout: 0.8, dy: 0, blur: 0,
      update: (el, t) => {
        paths.forEach((p, i) => { el.querySelector('#dp' + i).setAttribute('stroke-dashoffset', (1 - ease.inOut(smooth(p.t0, p.t1, t))).toFixed(4)); });
        leaders.forEach((l, i) => { el.querySelector('#dl' + i).setAttribute('stroke-dashoffset', (1 - ease.out(smooth(l.t, l.t + 0.7, t))).toFixed(4)); el.querySelector('#dc' + i).setAttribute('opacity', smooth(l.t, l.t + 0.3, t).toFixed(3)); });
      },
    });
    leaders.forEach((l) => {
      F.ui({ t0: l.t + 0.4, t1: 110.4, x: l.to[0], y: l.to[1], anchor: 'l', cls: 'tag', html: `${l.zh}<small>${l.en}</small>`, fin: 0.8 });
      F.sfx(l.t, 'label_tick', {});
    });
    F.ui({ t0: 106.4, t1: 110.5, x: 960, y: 900, cls: 'body center', html: '每一个模块，都把冰中极其微弱的光，变成带时间戳的数字信号。' });
    F.ui({ t0: 107.4, t1: 110.5, x: 960, y: 958, cls: 'note center', html: '截至 2016 年，98.4% 的模块运行正常 · 探测器在线率约 99%' });
    F.sfx(98.0, 'dom_bed', { dur: 13 });
    F.sfx(98.6, 'draw_sweep', { dur: 4 });
    for (const p of PHOTONS) F.sfx(p.t + 0.55, 'photon_ping', { q: p.q, pan: -0.25 });
  },
  draw(e, t, lt) {
    F.cam2D(e);
    e.bg.mode = -1; e.bg.c0 = [0.0, 0.002, 0.008]; e.bg.c1 = [0.004, 0.012, 0.03];
    const k = smooth(98.2, 100, t);
    e.sprite([DOMC[0], DOMC[1], 0], 330, [0.25, 0.5, 1.0], 0.09 * k, 0);
    e.sprite([DOMC[0], DOMC[1] - 60, 0], 160, [0.4, 0.75, 1.0], 0.07 * k, 0);
    // incoming photons that strike the photocathode
    for (const p of PHOTONS) {
      const u = (t - p.t) / 0.55; if (u < 0 || u > 4) continue;
      const end = [DOMC[0] + Math.cos(p.a) * 150, DOMC[1] + Math.sin(p.a) * 120 - 40, 0];
      const start = [end[0] + Math.cos(p.a) * 520, end[1] + Math.sin(p.a) * 520, 0];
      if (u < 1) { const pos = V.lerp(start, end, u); e.line(V.lerp(start, end, Math.max(0, u - 0.25)), pos, 1.6, [0.45, 0.65, 1.0], 0, 0.9, 1.2); e.sprite(pos, 6, [0.6, 0.8, 1.0], 1.0, 0); }
      else { const f = Math.exp(-(u - 1) * 3); e.sprite(end, 14 + 20 * (1 - f), [0.6, 0.85, 1.0], 0.9 * f, 0); }
    }
    // tiny flasher LEDs blinking
    if (t > 104.8) for (let i = 0; i < 6; i++) { const on = Math.sin(t * 9 + i * 1.7) > 0.85; e.sprite([DOMC[0] - 110 + i * 44, DOMC[1] + 123, 0], 4, [0.5, 0.6, 1.0], on ? 1.2 : 0.15, 0); }
  },
});
})();
