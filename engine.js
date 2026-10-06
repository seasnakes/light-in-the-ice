// Minimal deterministic WebGL2 engine: HDR additive sprites + ribbon lines,
// procedural background, physically-based bloom, filmic composite.
(function(){
'use strict';
const W = 1920, H = 1080;

// ---------- math ----------
const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
  lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
};
function perspective(fovy, aspect, near, far) {
  const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
}
function lookAt(eye, target, up) {
  const z = V.norm(V.sub(eye, target)), x = V.norm(V.cross(up, z)), y = V.cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -V.dot(x, eye), -V.dot(y, eye), -V.dot(z, eye), 1]);
}
function mat4mul(a, b) {
  const o = new Float32Array(16);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s;
  }
  return o;
}

// ---------- easing / helpers ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const mix = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const ease = {
  inOut: (t) => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
  out: (t) => { t = clamp(t); return 1 - Math.pow(1 - t, 3); },
  in: (t) => { t = clamp(t); return t * t * t; },
  expoOut: (t) => { t = clamp(t); return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
  quintInOut: (t) => { t = clamp(t); return t < .5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2; },
  sine: (t) => { t = clamp(t); return -(Math.cos(Math.PI * t) - 1) / 2; },
};
// window in/out envelope
const env = (t, a, b, fin = 0.8, fout = 0.8) => Math.min(smooth(a, a + fin, t), 1 - smooth(b - fout, b, t));

// seeded RNG (mulberry32)
function RNG(seed) {
  let s = seed >>> 0;
  const f = () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  f.range = (a, b) => a + (b - a) * f();
  f.gauss = () => { let u = 0, v = 0; while (u === 0) u = f(); while (v === 0) v = f(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  f.sphere = () => { const z = f() * 2 - 1, a = f() * Math.PI * 2, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), z, r * Math.sin(a)]; };
  return f;
}
// smooth 1D value noise
function noise1(x, seed = 0) {
  const h = (n) => { const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return mix(h(i), h(i + 1), u) * 2 - 1;
}

// time-colour palette used by IceCube-like event displays (early=red → late=blue/violet)
function timeColor(u) {
  u = clamp(u);
  const stops = [[1.0, 0.18, 0.12], [1.0, 0.55, 0.12], [0.95, 0.9, 0.25], [0.3, 1.0, 0.45], [0.15, 0.75, 1.0], [0.45, 0.35, 1.0]];
  const x = u * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  return V.lerp(stops[i], stops[i + 1], f);
}

// ---------- GL ----------
class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    this.gl = gl;
    gl.getExtension('EXT_color_buffer_float');
    gl.getExtension('OES_texture_float_linear');
    this.quad = this._buf(new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    this.progSprite = this._prog(SPRITE_VS, SPRITE_FS);
    this.progLine = this._prog(LINE_VS, LINE_FS);
    this.progBg = this._prog(FS_VS, BG_FS);
    this.progDown = this._prog(FS_VS, DOWN_FS);
    this.progUp = this._prog(FS_VS, UP_FS);
    this.progComp = this._prog(FS_VS, COMP_FS);
    this.spriteBuf = gl.createBuffer();
    this.lineBuf = gl.createBuffer();
    this.sceneRT = this._rt(W, H);
    this.bgRT = this._rt(W / 4, H / 4);
    this.mips = [];
    let w = W / 2, h = H / 2;
    for (let i = 0; i < 5; i++) { w = Math.max(1, Math.floor(w / 2)); h = Math.max(1, Math.floor(h / 2)); this.mips.push(this._rt(w, h)); }
    this.sprites = []; this.lines = [];
    this.spriteData = new Float32Array(12 * 200000);
    this.lineData = new Float32Array(16 * 120000);
    this.cam = { pos: [0, 0, 10], target: [0, 0, 0], up: [0, 1, 0], fov: 45 };
    this.bg = { mode: 0, c0: [0, 0, 0], c1: [0, 0, 0], p: [0, 0, 0, 0] };
    this.post = { bloom: 0.9, exposure: 1.0, vignette: 0.55, grain: 0.035, ca: 0.0015, fade: 1.0, lift: 0.0 };
    this.frameNo = 0; this.time = 0;
  }
  _buf(data) { const gl = this.gl, b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; }
  _sh(type, src) {
    const gl = this.gl, s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src);
    return s;
  }
  _prog(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this._sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, this._sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); p.u[info.name] = gl.getUniformLocation(p, info.name); }
    return p;
  }
  _rt(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb, w, h };
  }

  // ---- draw-list API ----
  // world-space glow sprite. size = world radius. shape: 0 glow, 1 disc, 2 ring, 3 soft star (glow + cross flare)
  sprite(p, size, col, a = 1, shape = 0) { if (this.xf) { p = this.xf(p); size *= this.xs || 1; } this.sprites.push(p[0], p[1], p[2], size, col[0], col[1], col[2], a, shape, 0, 0, 0); }
  // screen-space (pixel) sprite at world position
  spritePx(p, px, col, a = 1, shape = 0) { if (this.xf) p = this.xf(p); this.sprites.push(p[0], p[1], p[2], px, col[0], col[1], col[2], a, shape, 1, 0, 0); }
  // world-space ribbon line, width in px, alpha per end
  line(p0, p1, wpx, col, a0 = 1, a1 = a0, glow = 1) {
    if (this.xf) { p0 = this.xf(p0); p1 = this.xf(p1); }
    this.lines.push(p0[0], p0[1], p0[2], a0, p1[0], p1[1], p1[2], a1, col[0], col[1], col[2], wpx, glow, 0, 0, 0);
  }
  polyline(pts, wpx, col, a = 1, glow = 1, alphaFn = null) {
    for (let i = 0; i < pts.length - 1; i++) {
      const a0 = alphaFn ? alphaFn(i / (pts.length - 1)) * a : a, a1 = alphaFn ? alphaFn((i + 1) / (pts.length - 1)) * a : a;
      this.line(pts[i], pts[i + 1], wpx, col, a0, a1, glow);
    }
  }

  matrices() {
    const c = this.cam;
    const view = lookAt(c.pos, c.target, c.up || [0, 1, 0]);
    const proj = perspective(c.fov * Math.PI / 180, W / H, c.near || 0.1, c.far || 5000);
    this.view = view; this.proj = proj; this.vp = mat4mul(proj, view);
    return { view, proj };
  }
  // project world → pixel coords (for DOM labels)
  project(p) {
    const m = this.vp;
    const x = m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12];
    const y = m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13];
    const w = m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15];
    return [(x / w * 0.5 + 0.5) * W, (1 - (y / w * 0.5 + 0.5)) * H, w];
  }

  _fs(prog) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }

  render() {
    const gl = this.gl;
    this.matrices();
    const { view, proj } = this;
    gl.disable(gl.DEPTH_TEST);
    // background (half res)
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bgRT.fb); gl.viewport(0, 0, this.bgRT.w, this.bgRT.h);
    gl.disable(gl.BLEND);
    gl.useProgram(this.progBg);
    const b = this.bg, pu = this.progBg.u;
    gl.uniform1i(pu.uMode, b.mode); gl.uniform3fv(pu.uC0, b.c0); gl.uniform3fv(pu.uC1, b.c1); gl.uniform4fv(pu.uP, b.p);
    gl.uniform1f(pu.uTime, this.time); gl.uniform2f(pu.uRes, W, H);
    gl.uniformMatrix4fv(pu.uInvVP, false, invert(this.vp));
    gl.uniform3fv(pu.uCam, this.cam.pos);
    if (b.mode >= 0) this._fs(this.progBg);

    // scene
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.sceneRT.fb); gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    // lines
    const nl = this.lines.length / 16;
    if (nl > 0) {
      const p = this.progLine; gl.useProgram(p);
      gl.uniformMatrix4fv(p.u.uView, false, view); gl.uniformMatrix4fv(p.u.uProj, false, proj); gl.uniform2f(p.u.uRes, W, H);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0);
      const d = this.lineData; d.set(this.lines.length > d.length ? this.lines.slice(0, d.length) : this.lines);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.lineBuf); gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, Math.min(this.lines.length, d.length)), gl.STREAM_DRAW);
      for (let i = 0; i < 4; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 64, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.min(nl, d.length / 16));
      for (let i = 0; i < 4; i++) { gl.vertexAttribDivisor(1 + i, 0); gl.disableVertexAttribArray(1 + i); }
    }
    // sprites
    const ns = this.sprites.length / 12;
    if (ns > 0) {
      const p = this.progSprite; gl.useProgram(p);
      gl.uniformMatrix4fv(p.u.uView, false, view); gl.uniformMatrix4fv(p.u.uProj, false, proj); gl.uniform2f(p.u.uRes, W, H);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.vertexAttribDivisor(0, 0);
      const d = this.spriteData; d.set(this.sprites.length > d.length ? this.sprites.slice(0, d.length) : this.sprites);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.spriteBuf); gl.bufferData(gl.ARRAY_BUFFER, d.subarray(0, Math.min(this.sprites.length, d.length)), gl.STREAM_DRAW);
      for (let i = 0; i < 3; i++) { gl.enableVertexAttribArray(1 + i); gl.vertexAttribPointer(1 + i, 4, gl.FLOAT, false, 48, i * 16); gl.vertexAttribDivisor(1 + i, 1); }
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, Math.min(ns, d.length / 12));
      for (let i = 0; i < 3; i++) { gl.vertexAttribDivisor(1 + i, 0); gl.disableVertexAttribArray(1 + i); }
    }
    gl.disable(gl.BLEND);

    // bloom: downsample chain
    gl.useProgram(this.progDown);
    let src = this.sceneRT;
    for (let i = 0; i < this.mips.length; i++) {
      const dst = this.mips[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb); gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
      gl.uniform1i(this.progDown.u.uTex, 0); gl.uniform2f(this.progDown.u.uTexel, 1 / src.w, 1 / src.h);
      gl.uniform1i(this.progDown.u.uFirst, i === 0 ? 1 : 0);
      this._fs(this.progDown);
      src = dst;
    }
    // upsample (additive)
    gl.useProgram(this.progUp);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.mips.length - 1; i > 0; i--) {
      const s = this.mips[i], d = this.mips[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, d.fb); gl.viewport(0, 0, d.w, d.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex);
      gl.uniform1i(this.progUp.u.uTex, 0); gl.uniform2f(this.progUp.u.uTexel, 1 / s.w, 1 / s.h);
      this._fs(this.progUp);
    }
    gl.disable(gl.BLEND);

    // composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
    const cp = this.progComp; gl.useProgram(cp);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.sceneRT.tex); gl.uniform1i(cp.u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.mips[0].tex); gl.uniform1i(cp.u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.bgRT.tex); gl.uniform1i(cp.u.uBg, 2);
    const q = this.post;
    gl.uniform1f(cp.u.uBloomAmt, q.bloom); gl.uniform1f(cp.u.uExposure, q.exposure); gl.uniform1f(cp.u.uVignette, q.vignette);
    gl.uniform1f(cp.u.uGrain, q.grain); gl.uniform1f(cp.u.uCA, q.ca); gl.uniform1f(cp.u.uFade, q.fade); gl.uniform1f(cp.u.uLift, q.lift);
    gl.uniform1f(cp.u.uFrame, this.frameNo); gl.uniform2f(cp.u.uRes, W, H);
    gl.uniform1i(cp.u.uBgMode, b.mode < 0 ? 1 : 0); gl.uniform3fv(cp.u.uG0, b.c0); gl.uniform3fv(cp.u.uG1, b.c1);
    this._fs(cp);
    this.sprites.length = 0; this.lines.length = 0;
  }
}

function invert(m) {
  const inv = new Float32Array(16);
  const a00 = m[0], a01 = m[1], a02 = m[2], a03 = m[3], a10 = m[4], a11 = m[5], a12 = m[6], a13 = m[7],
    a20 = m[8], a21 = m[9], a22 = m[10], a23 = m[11], a30 = m[12], a31 = m[13], a32 = m[14], a33 = m[15];
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11,
    b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30,
    b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06; det = 1 / det;
  inv[0] = (a11 * b11 - a12 * b10 + a13 * b09) * det; inv[1] = (a02 * b10 - a01 * b11 - a03 * b09) * det;
  inv[2] = (a31 * b05 - a32 * b04 + a33 * b03) * det; inv[3] = (a22 * b04 - a21 * b05 - a23 * b03) * det;
  inv[4] = (a12 * b08 - a10 * b11 - a13 * b07) * det; inv[5] = (a00 * b11 - a02 * b08 + a03 * b07) * det;
  inv[6] = (a32 * b02 - a30 * b05 - a33 * b01) * det; inv[7] = (a20 * b05 - a22 * b02 + a23 * b01) * det;
  inv[8] = (a10 * b10 - a11 * b08 + a13 * b06) * det; inv[9] = (a01 * b08 - a00 * b10 - a03 * b06) * det;
  inv[10] = (a30 * b04 - a31 * b02 + a33 * b00) * det; inv[11] = (a21 * b02 - a20 * b04 - a23 * b00) * det;
  inv[12] = (a11 * b07 - a10 * b09 - a12 * b06) * det; inv[13] = (a00 * b09 - a01 * b07 + a02 * b06) * det;
  inv[14] = (a31 * b01 - a30 * b03 - a32 * b00) * det; inv[15] = (a20 * b03 - a21 * b01 + a22 * b00) * det;
  return inv;
}

// ---------- shaders ----------
const SPRITE_VS = `#version 300 es
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aPos;   // xyz, size
layout(location=2) in vec4 aCol;   // rgb, alpha
layout(location=3) in vec4 aMisc;  // shape, pixelMode
uniform mat4 uView, uProj; uniform vec2 uRes;
out vec2 vUv; out vec4 vCol; flat out float vShape; out float vPx;
void main(){
  vec4 vp = uView * vec4(aPos.xyz,1.0);
  vUv = aQ; vCol = aCol; vShape = aMisc.x;
  float s = aPos.w;
  if (aMisc.y > 0.5) {
    vec4 cp = uProj * vp;
    cp.xy += aQ * s * 2.0 / uRes * cp.w;
    gl_Position = cp; vPx = s;
  } else {
    vp.xy += aQ * s;
    gl_Position = uProj * vp;
    vPx = s * uProj[1][1] * uRes.y * 0.5 / max(0.001, -vp.z);
  }
  if (vp.z > -0.05 || aCol.a <= 0.0) gl_Position = vec4(2.0,2.0,2.0,1.0);
}`;
const SPRITE_FS = `#version 300 es
precision highp float;
in vec2 vUv; in vec4 vCol; flat in float vShape; in float vPx;
out vec4 o;
void main(){
  float d = length(vUv);
  if (d > 1.0) discard;
  float a;
  if (vShape < 0.5) {           // glow: bright core + soft halo
    a = exp(-d*d*9.0)*0.85 + exp(-d*d*42.0)*1.4 + (1.0-d)*(1.0-d)*0.05;
  } else if (vShape < 1.5) {    // anti-aliased disc with soft rim glow
    float aa = 1.5/max(vPx,1.0);
    a = smoothstep(0.62+aa, 0.62-aa, d) * 0.9 + exp(-d*d*5.0)*0.25;
  } else if (vShape < 2.5) {    // ring
    float aa = 1.5/max(vPx,1.0);
    a = smoothstep(aa*2.0, 0.0, abs(d-0.8)) * 0.9 + exp(-(d-0.8)*(d-0.8)*80.0)*0.3;
  } else {                      // star flare
    vec2 q = abs(vUv);
    float cross = exp(-q.x*60.0)*exp(-q.y*2.2) + exp(-q.y*60.0)*exp(-q.x*2.2);
    a = exp(-d*d*16.0)*1.2 + exp(-d*d*120.0)*2.0 + cross*0.55;
  }
  o = vec4(vCol.rgb * a * vCol.a, 1.0);
}`;
const LINE_VS = `#version 300 es
layout(location=0) in vec2 aQ;
layout(location=1) in vec4 aP0;  // xyz a0
layout(location=2) in vec4 aP1;  // xyz a1
layout(location=3) in vec4 aCW;  // rgb width
layout(location=4) in vec4 aG;   // glow
uniform mat4 uView, uProj; uniform vec2 uRes;
out float vAcross; out float vA; out vec3 vCol; out float vW; out float vGlow;
void main(){
  vec4 v0 = uView*vec4(aP0.xyz,1.0), v1 = uView*vec4(aP1.xyz,1.0);
  // clip segment against near plane
  float n = -0.1;
  if (v0.z > n && v1.z > n) { gl_Position = vec4(2,2,2,1); return; }
  if (v0.z > n) v0 = mix(v0, v1, (v0.z-n)/(v0.z-v1.z));
  if (v1.z > n) v1 = mix(v1, v0, (v1.z-n)/(v1.z-v0.z));
  vec4 c0 = uProj*v0, c1 = uProj*v1;
  vec2 s0 = c0.xy/c0.w*uRes*0.5, s1 = c1.xy/c1.w*uRes*0.5;
  vec2 dir = s1-s0; float L = length(dir); dir = L>1e-4 ? dir/L : vec2(1,0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float w = aCW.w*0.5 + 2.0 + aG.x*aCW.w*1.5;
  float t = aQ.x*0.5+0.5;
  vec4 c = mix(c0, c1, t);
  vec2 s = mix(s0, s1, t) + nrm*aQ.y*w + dir*(aQ.x)*w*0.5;
  c.xy = s/(uRes*0.5)*c.w;
  gl_Position = c;
  vAcross = aQ.y*w; vA = mix(aP0.w, aP1.w, t); vCol = aCW.rgb; vW = aCW.w*0.5; vGlow = aG.x;
}`;
const LINE_FS = `#version 300 es
precision highp float;
in float vAcross; in float vA; in vec3 vCol; in float vW; in float vGlow;
out vec4 o;
void main(){
  float d = abs(vAcross);
  float core = smoothstep(vW+1.0, max(vW-1.0,0.0), d);
  float halo = exp(-d*d/(max(vW,0.7)*max(vW,0.7)*6.0+1.0))*0.6*vGlow;
  o = vec4(vCol*(core*0.9+halo)*vA, 1.0);
}`;
const FS_VS = `#version 300 es
layout(location=0) in vec2 aQ; out vec2 vUv;
void main(){ vUv = aQ*0.5+0.5; gl_Position = vec4(aQ,0.0,1.0); }`;
const BG_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform int uMode; uniform vec3 uC0, uC1; uniform vec4 uP; uniform float uTime; uniform vec2 uRes;
uniform mat4 uInvVP; uniform vec3 uCam;
float h(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*0.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<3;i++){ s+=a*n2(p); p*=2.03; a*=0.5; } return s; }
vec3 rayDir(){ vec4 a = uInvVP*vec4(vUv*2.0-1.0, 1.0, 1.0); return normalize(a.xyz/a.w - uCam); }
void main(){
  vec3 col = vec3(0.0);
  if (uMode == 0) {           // vertical gradient + subtle haze
    col = mix(uC0, uC1, smoothstep(0.0,1.0,vUv.y));
    col *= 0.85 + 0.3*fbm(vUv*vec2(3.0,2.0) + uTime*0.01);
  } else if (uMode == 1) {    // deep-ice volume: direction-based gradient, soft caustic shafts from above
    vec3 d = rayDir();
    float up = d.y*0.5+0.5;
    col = mix(uC0, uC1, pow(up, 1.6));
    float sh = fbm(vec2(atan(d.x,d.z)*3.0, uTime*0.05)) ;
    col += uC1 * pow(max(d.y,0.0),3.0) * sh * uP.x;
    col *= 0.9 + 0.2*fbm(d.xz*4.0 + d.y*2.0 + uTime*0.02);
  } else if (uMode == 2) {    // polar sky: horizon glow + aurora curtains
    vec3 d = rayDir();
    float el = d.y;
    col = mix(uC0, uC1, smoothstep(-0.05, 0.6, el));
    col += vec3(0.25,0.32,0.45) * exp(-abs(el)*28.0) * uP.y; // horizon glow
    float u = d.x / max(0.25, -d.z);
    float lower = 0.11 + 0.045*sin(u*1.3 + uTime*0.12) + 0.04*fbm(vec2(u*1.6, uTime*0.08));
    float band = el - lower;
    float curtain = smoothstep(-0.035, 0.03, band) * exp(-max(band,0.0)*4.5);
    float rays = 0.35 + pow(fbm(vec2(u*22.0, uTime*0.22)), 2.0) * 1.6;
    float span = smoothstep(-1.9, -0.6, u) * smoothstep(1.7, 0.4, u);
    vec3 ac = mix(vec3(0.12,0.8,0.56), vec3(0.4,0.3,0.85), smoothstep(0.04, 0.32, band));
    col += ac * curtain * rays * span * uP.x;
    if (el < 0.0) { // snow plain
      float t = -uCam.y / min(el, -1e-3);
      vec2 g = uCam.xz + d.xz*t;
      float sn = fbm(g*0.02) * 0.6 + 0.4;
      col = mix(vec3(0.075,0.095,0.14)*sn, uC0*1.4 + vec3(0.05,0.065,0.09)*uP.y, exp(el*40.0)) * uP.z;
    }
  }
  o = vec4(col, 1.0);
}`;
const DOWN_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel; uniform int uFirst;
void main(){
  if (uFirst == 1) {   // 4x4 box from full res via 4 bilinear taps, with soft threshold
    vec2 t = uTexel;
    vec3 s = (texture(uTex, vUv + t*vec2(-1,-1)).rgb + texture(uTex, vUv + t*vec2(1,-1)).rgb + texture(uTex, vUv + t*vec2(-1,1)).rgb + texture(uTex, vUv + t*vec2(1,1)).rgb)*0.25;
    float br = max(s.r, max(s.g, s.b));
    o = vec4(s * smoothstep(0.03, 0.5, br), 1.0);
    return;
  }
  vec2 t = uTexel;
  vec3 a = texture(uTex, vUv + t*vec2(-2, 2)).rgb, b = texture(uTex, vUv + t*vec2(0, 2)).rgb, c = texture(uTex, vUv + t*vec2(2, 2)).rgb;
  vec3 d = texture(uTex, vUv + t*vec2(-2, 0)).rgb, e = texture(uTex, vUv).rgb, f = texture(uTex, vUv + t*vec2(2, 0)).rgb;
  vec3 g = texture(uTex, vUv + t*vec2(-2,-2)).rgb, h = texture(uTex, vUv + t*vec2(0,-2)).rgb, i = texture(uTex, vUv + t*vec2(2,-2)).rgb;
  vec3 j = texture(uTex, vUv + t*vec2(-1, 1)).rgb, k = texture(uTex, vUv + t*vec2(1, 1)).rgb;
  vec3 l = texture(uTex, vUv + t*vec2(-1,-1)).rgb, m = texture(uTex, vUv + t*vec2(1,-1)).rgb;
  vec3 s = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
  o = vec4(s, 1.0);
}`;
const UP_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o; uniform sampler2D uTex; uniform vec2 uTexel;
void main(){
  vec2 t = uTexel;
  vec3 s = texture(uTex, vUv).rgb*4.0;
  s += (texture(uTex, vUv+vec2(-t.x,0)).rgb + texture(uTex, vUv+vec2(t.x,0)).rgb + texture(uTex, vUv+vec2(0,t.y)).rgb + texture(uTex, vUv+vec2(0,-t.y)).rgb)*2.0;
  s += texture(uTex, vUv+t).rgb + texture(uTex, vUv-t).rgb + texture(uTex, vUv+vec2(t.x,-t.y)).rgb + texture(uTex, vUv+vec2(-t.x,t.y)).rgb;
  o = vec4(s/16.0*0.85, 1.0);
}`;
const COMP_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uScene, uBloom, uBg;
uniform float uBloomAmt, uExposure, uVignette, uGrain, uCA, uFade, uLift, uFrame; uniform vec2 uRes;
uniform int uBgMode; uniform vec3 uG0, uG1;
float hash(vec2 p){ p = fract(p*vec2(443.897,441.423)); p += dot(p, p.yx+19.19); return fract((p.x+p.y)*p.x); }
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0); }
void main(){
  vec2 c = vUv - 0.5;
  float r2 = dot(c,c);
  vec3 sc = texelFetch(uScene, ivec2(gl_FragCoord.xy), 0).rgb;
  vec3 bl = texture(uBloom, vUv).rgb;
  vec3 bg = uBgMode == 1 ? mix(uG0, uG1, smoothstep(0.0, 1.0, vUv.y)) * (1.0 - r2*0.6) : texture(uBg, vUv).rgb;
  vec3 col = bg + sc + bl*uBloomAmt;
  col *= uExposure;
  col = aces(col);
  col += uLift;
  float vig = 1.0 - uVignette * smoothstep(0.15, 0.85, r2*2.2);
  col *= vig * uFade;
  float g = hash(gl_FragCoord.xy + vec2(uFrame*13.1, uFrame*7.7)) - 0.5;
  col += g * uGrain * (0.4 + 0.6*(1.0-col));
  o = vec4(col, 1.0);
}`;

window.ENG = { Engine, V, W, H, clamp, mix, smooth, ease, env, RNG, noise1, timeColor, lookAt, perspective };
})();
