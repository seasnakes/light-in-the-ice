(function () {
'use strict';
const { smooth } = ENG;
window.FPS = 24; window.DUR = 222;
F.state = {};
const e = F.e = new ENG.Engine(document.getElementById('gl'));
for (const s of F.scenes) s.setup && s.setup();
F.cues.sort((a, b) => a.t - b.t);
window.getCues = () => F.cues;
window.seek = (t) => {
  e.time = t; e.frameNo = Math.round(t * FPS);
  e.post = { bloom: 0.9, exposure: 1.0, vignette: 0.55, grain: 0.024, ca: 0, fade: 1.0, lift: 0.0 };
  e.bg = { mode: -1, c0: [0, 0, 0], c1: [0, 0, 0], p: [0, 0, 0, 0] };
  e.cam = { pos: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0], fov: 45, near: 1, far: 20000 };
  e.xf = null; e.xs = 1;
  const s = F.scenes.find(s => t >= s.t0 && t < s.t1);
  if (s) {
    s.draw(e, t, t - s.t0);
    e.post.fade *= Math.min(smooth(s.t0, s.t0 + (s.fin || 0.01), t), 1 - smooth(s.t1 - (s.fout || 0.01), s.t1, t));
  } else e.post.fade = 0;
  e.render();
  F.updateUI(t);
  return true;
};
window.READY = true;
})();
