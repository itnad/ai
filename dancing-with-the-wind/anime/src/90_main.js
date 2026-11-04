/* ===================== main / player ===================== */
const DWW = { ready: false, audioReady: false };
window.DWW = DWW;
(function () {
  const cv = document.getElementById('c');
  const ctx = cv.getContext('2d');
  const playBtn = document.getElementById('play'), loadBar = document.querySelector('#load > i'), loadBox = document.getElementById('load');
  const prog = document.querySelector('#bar > i'), bar = document.getElementById('bar');
  const test = /[?&]test=1/.test(location.search);
  function buildAssets() {
    initPost();
    BG.alley = buildAlley(false);
    BG.ruin = buildAlley(true);
    BG.skyFace = buildSkyClose([1460, 230], 64, 1301);
    BG.skyMoon = buildSkyClose([980, 470], 190, 1302);
    BG.kitchen = buildKitchen();
    BG.tent = buildTentStreet();
    BG.musicbox = buildMusicBoxBG();
    BG.goldsky = buildGoldSky();
    BG.gates = buildGatesBG();
    BG.palace = buildPalace();
    BG.bokeh = buildBokehStrip();
    BG.crackwall = buildCrackWall();
    buildGuestSprites();
  }
  let lastF = -1;
  function render(f) {
    f = Math.max(0, Math.min(NF - 1, f | 0));
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    renderFrame(ctx, f);
    postFX(ctx, f);
    lastF = f;
  }
  DWW.render = render;
  DWW.debug = function (name, t) {
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    DEBUG[name](ctx, t || 0);
  };
  DWW.frameHash = function (f) {
    render(f);
    const d = ctx.getImageData(0, 0, W, H).data; let h = 2166136261 >>> 0;
    for (let i = 0; i < d.length; i += 7) h = Math.imul(h ^ d[i], 16777619) >>> 0;
    return h.toString(16);
  };

  /* ---------- playback ---------- */
  let actx = null, abuf = null, src = null, playing = false, startAt = 0, offset = 0, audioData = null;
  const now = () => (playing ? actx.currentTime - startAt + offset : offset);
  function startSource() {
    src = actx.createBufferSource(); src.buffer = abuf; src.connect(actx.destination);
    startAt = actx.currentTime + 0.05; src.start(startAt, offset);
    src.onended = () => { if (playing && now() >= DUR - 0.05) { playing = false; offset = 0; playBtn.style.display = 'block'; } };
  }
  function play() {
    if (!DWW.audioReady) return;
    if (!actx) {
      actx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
      abuf = actx.createBuffer(2, NS, SR); abuf.getChannelData(0).set(audioData.L); abuf.getChannelData(1).set(audioData.R);
    }
    if (actx.state === 'suspended') actx.resume();
    if (offset >= DUR - 0.05) offset = 0;
    playing = true; startSource(); playBtn.style.display = 'none';
  }
  function pause() { if (!playing) return; offset = now(); playing = false; try { src.stop(); } catch (e) {} playBtn.style.display = 'block'; }
  function seek(t) { const was = playing; if (was) { try { src.onended = null; src.stop(); } catch (e) {} playing = false; } offset = clamp(t, 0, DUR - 0.01); if (was) { playing = true; startSource(); } else render(Math.floor(offset * FPS)); }
  DWW.play = play; DWW.pause = pause; DWW.seek = seek;
  function tick() {
    const t = now(), f = Math.min(NF - 1, Math.floor(t * FPS));
    if (f !== lastF) render(f);
    prog.style.width = ((t / DUR) * 100).toFixed(3) + '%';
    requestAnimationFrame(tick);
  }
  playBtn.addEventListener('click', (e) => { e.stopPropagation(); play(); });
  cv.addEventListener('click', () => { if (!DWW.audioReady) return; playing ? pause() : play(); });
  bar.addEventListener('click', (e) => { const r = bar.getBoundingClientRect(); seek(((e.clientX - r.left) / r.width) * DUR); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.key === 'k') { e.preventDefault(); playing ? pause() : play(); }
    else if (e.key === 'ArrowRight') seek(now() + 5);
    else if (e.key === 'ArrowLeft') seek(now() - 5);
    else if (e.key === 'Home') seek(0);
    else if (e.key === 'f') { const st = document.getElementById('stage'); if (!document.fullscreenElement) st.requestFullscreen && st.requestFullscreen(); else document.exitFullscreen(); }
  });

  /* ---------- export helpers (used by the offline renderer) ---------- */
  DWW.audioChunk = function (ch, start, len) {
    const a = ch === 0 ? audioData.L : audioData.R, n = Math.min(len, NS - start), out = new Int16Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.max(-32767, Math.min(32767, Math.round(a[start + i] * 32767)));
    let s = ''; const u8 = new Uint8Array(out.buffer);
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };

  buildAssets();
  DWW.ready = true;
  render(Math.floor(8.6 * FPS));
  const t0 = performance.now();
  synthesize((p) => { loadBar.style.width = (p * 100).toFixed(0) + '%'; }).then((a) => {
    audioData = a; DWW.audioHash = a.hash; DWW.audioMs = Math.round(performance.now() - t0);
    DWW.audioReady = true; loadBox.style.display = 'none'; playBtn.style.display = 'block';
    render(Math.floor(8.6 * FPS));
    if (!test) requestAnimationFrame(tick);
  });
})();
