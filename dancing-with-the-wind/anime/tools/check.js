// determinism + timing check: loads page twice, compares audio hash and frame hashes
const { chromium } = require('playwright'); const path = require('path');
(async () => {
  const browser = await chromium.launch();
  const res = [];
  for (let run = 0; run < 2; run++) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
    page.on('pageerror', (e) => console.log('[pageerror]', e.message));
    await page.goto('file://' + path.resolve(__dirname, '../dancing_with_the_wind_anime.html') + '?test=1');
    await page.waitForFunction(() => window.DWW && window.DWW.audioReady, null, { timeout: 300000 });
    const r = await page.evaluate(() => {
      const frames = [0, 100, 300, 500, 760, 900, 1000, 1200, 1400, 1500, 1640, 1800, 1900, 2050, 2183];
      const hashes = frames.map((f) => DWW.frameHash(f));
      const times = []; for (let f = 0; f < 2184; f += 6) { const t = performance.now(); DWW.render(f); times.push(performance.now() - t); }
      times.sort((a, b) => a - b);
      return { audio: DWW.audioHash, audioMs: DWW.audioMs, hashes, p50: times[times.length >> 1], p95: times[Math.floor(times.length * 0.95)], max: times[times.length - 1] };
    });
    res.push(r); console.log(JSON.stringify(r));
    await page.close();
  }
  console.log('audio identical:', res[0].audio === res[1].audio, ' frames identical:', JSON.stringify(res[0].hashes) === JSON.stringify(res[1].hashes));
  await browser.close();
})();
