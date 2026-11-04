// offline render of every frame + synthesized audio -> MP4 (H.264 1080p24 + AAC)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs'); const { spawn } = require('child_process');
(async () => {
  const out = process.argv[2], tmp = process.argv[3];
  fs.mkdirSync(tmp, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  page.on('pageerror', (e) => console.log('[pageerror]', e.message));
  await page.goto('file://' + path.resolve(__dirname, '../dancing_with_the_wind_anime.html') + '?test=1');
  await page.waitForFunction(() => window.DWW && window.DWW.audioReady, null, { timeout: 300000 });
  // audio -> wav
  const NS = await page.evaluate(() => NS), SR = await page.evaluate(() => SR);
  const pcm = Buffer.alloc(NS * 4);
  for (let ch = 0; ch < 2; ch++) for (let s = 0; s < NS; s += 441000) {
    const b = Buffer.from(await page.evaluate(([ch, s]) => DWW.audioChunk(ch, s, 441000), [ch, s]), 'base64');
    for (let i = 0; i < b.length / 2; i++) pcm.writeInt16LE(b.readInt16LE(i * 2), ((s + i) * 2 + ch) * 2);
  }
  const hdr = Buffer.alloc(44);
  hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + pcm.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
  hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(pcm.length, 40);
  const wav = path.join(tmp, 'audio.wav'); fs.writeFileSync(wav, Buffer.concat([hdr, pcm]));
  console.log('wav written', wav);
  const NF = await page.evaluate(() => NF);
  const ff = spawn('ffmpeg', ['-y', '-v', 'error', '-f', 'image2pipe', '-framerate', '24', '-c:v', 'mjpeg', '-i', '-', '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', '24',
    '-c:a', 'aac', '-b:a', '256k', '-movflags', '+faststart', '-shortest', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < NF; f++) {
    const url = await page.evaluate((f) => { DWW.render(f); return document.getElementById('c').toDataURL('image/jpeg', 0.95); }, f);
    const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % 24 === 0) { fs.writeFileSync(path.join(tmp, `f${String(f).padStart(4, '0')}.jpg`), buf); }
    if (f % 240 === 0) console.log('frame', f, ((Date.now() - t0) / 1000).toFixed(0) + 's');
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  console.log('done', out);
})();
