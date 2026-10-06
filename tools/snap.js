// usage: node snap.js out_dir t1 t2 ...
// Playwright: use the locally installed package (npm i playwright), fall back to a global install
let pw; try { pw = require('playwright'); } catch (e) { pw = require('/opt/npm-tools/node_modules/playwright'); }
const { chromium } = pw;
(async()=>{
  const [out, ...ts] = process.argv.slice(2);
  require('fs').mkdirSync(out, {recursive:true});
  const b = await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const p = await b.newPage({viewport:{width:1920,height:1080}});
  p.on('pageerror', e=>console.log('PAGEERR',e.message)); p.on('console', m=>{ if(m.type()==='error') console.log('CONSOLE', m.text()); });
  await p.goto('file://'+require('path').resolve(__dirname,'..','index.html'));
  await p.waitForFunction(()=>window.READY===true, null, {timeout:60000});
  await p.evaluate(()=>document.fonts.ready);
  for (const t of ts) {
    const t0 = Date.now();
    await p.evaluate(t=>seek(t), +t);
    await p.screenshot({path:`${out}/t${(+t).toFixed(2).padStart(7,'0')}.jpg`, type:'jpeg', quality:90});
    console.log('t', t, Date.now()-t0, 'ms');
  }
  await b.close();
})();
