const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch({ args: process.env.GPU ? ['--enable-gpu', '--use-angle=swiftshader'] : [] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('file://' + path.resolve(__dirname, '../dancing_with_the_wind_anime.html') + '?test=1');
  await page.waitForFunction(() => window.DWW && window.DWW.ready, null, { timeout: 300000 });
  const r = await page.evaluate(() => {
    const c = document.getElementById('c').getContext('2d');
    const out = [];
    for (const s of SHOTS) {
      const ts = [];
      for (let f = Math.ceil(s.t0 * 24) + 1; f < s.t1 * 24; f += 5) { const t = performance.now(); DWW.render(f); c.getImageData(0, 0, 1, 1); ts.push(performance.now() - t); }
      ts.sort((a, b) => a - b);
      out.push([s.fn.name, s.t0, ts[ts.length >> 1].toFixed(1), ts[ts.length - 1].toFixed(1)]);
    }
    return out;
  });
  for (const x of r) console.log(x.join('\t'));
  await browser.close();
})();
