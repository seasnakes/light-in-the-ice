// usage: node render.js <name> <t0> <t1>   → renders frames [round(t0*FPS), round(t1*FPS)) to chunks/<name>.mp4
// Playwright: use the locally installed package (npm i playwright), fall back to a global install
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
const { spawn } = require('child_process');
const fs = require('fs');
(async () => {
  const [name, t0s, t1s] = process.argv.slice(2);
  const FPS = 24, f0 = Math.round(+t0s * FPS), f1 = Math.round(+t1s * FPS);
  fs.mkdirSync(__dirname + '/chunks', { recursive: true });
  const out = `${__dirname}/chunks/${name}.mp4`;
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-tune', 'film', '-pix_fmt', 'yuv420p', '-x264-params', 'keyint=48:min-keyint=24',
    '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('PAGEERR', e.message));
  await p.goto('file://' + __dirname + '/index.html');
  await p.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  await p.evaluate(() => document.fonts.ready);
  const st = Date.now();
  for (let f = f0; f < f1; f++) {
    await p.evaluate(t => seek(t), f / FPS);
    const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if ((f - f0) % 48 === 0) console.log(`${name} frame ${f - f0}/${f1 - f0}  ${((Date.now() - st) / (f - f0 + 1)).toFixed(0)} ms/f`);
  }
  ff.stdin.end();
  await new Promise(r => ff.on('close', r));
  await b.close();
  console.log(`${name} done ${((Date.now() - st) / 1000).toFixed(0)}s`);
})();
