// usage: node tools/snap.js <outdir> <frame|time s> ...   (e.g. 120 or t5.5)
// renders frames of the built HTML with Playwright and writes PNGs (scaled by SCALE env, default 0.5)
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const [outdir, ...specs] = process.argv.slice(2);
  fs.mkdirSync(outdir, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.text()); });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../dancing_with_the_wind_anime.html') + '?test=1');
  const t0 = Date.now();
  await page.waitForFunction(() => window.DWW && window.DWW.ready, null, { timeout: 180000 });
  console.log('assets ready in', Date.now() - t0, 'ms');
  const scale = parseFloat(process.env.SCALE || '0.5');
  for (const s of specs) {
    const dbg = s.startsWith('d:') ? s.split(':') : null;
    const f = dbg ? 0 : s.startsWith('t') ? Math.round(parseFloat(s.slice(1)) * 24) : parseInt(s, 10);
    const res = await page.evaluate(([f, scale, dbg]) => {
      const t = performance.now();
      if (dbg) window.DWW.debug(dbg[1], parseFloat(dbg[2] || '0')); else window.DWW.render(f);
      const ms = performance.now() - t;
      const c = document.getElementById('c');
      const o = document.createElement('canvas'); o.width = Math.round(1920 * scale); o.height = Math.round(1080 * scale);
      o.getContext('2d').drawImage(c, 0, 0, o.width, o.height);
      return { ms, url: o.toDataURL('image/png') };
    }, [f, scale, dbg]);
    const file = path.join(outdir, dbg ? `d_${dbg[1]}_${dbg[2] || 0}.png` : `f${String(f).padStart(4, '0')}.png`);
    fs.writeFileSync(file, Buffer.from(res.url.split(',')[1], 'base64'));
    console.log(file, (f / 24).toFixed(2) + 's', res.ms.toFixed(1) + 'ms');
  }
  await browser.close();
})();
