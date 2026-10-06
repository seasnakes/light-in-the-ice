// Playwright: use the locally installed package (npm i playwright), fall back to a global install
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
(async()=>{
  const b = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const p = await b.newPage({viewport:{width:1920,height:1080}});
  p.on('pageerror', e=>console.log('PAGEERR',e.message));
  await p.goto('file://'+__dirname+'/index.html');
  await p.waitForFunction(()=>window.READY===true);
  const cues = await p.evaluate(()=>getCues());
  require('fs').writeFileSync(__dirname+'/cues.json', JSON.stringify(cues));
  const counts = {}; for (const c of cues) counts[c.type]=(counts[c.type]||0)+1;
  console.log(cues.length, JSON.stringify(counts));
  await b.close();
})();
