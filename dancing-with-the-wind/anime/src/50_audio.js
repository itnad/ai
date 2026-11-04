/* ===================== deterministic audio synthesis (pure JS, no files) ===================== */
const SR = 44100, NS = DUR * SR;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

function Mixer() {
  this.L = new Float32Array(NS); this.R = new Float32Array(NS);
  this.vL = new Float32Array(NS); this.vR = new Float32Array(NS); // reverb send
  this.tmp = new Float32Array(SR * 12);
}
/* mix a mono temp buffer (length n) starting at sample i0 */
Mixer.prototype.put = function (i0, n, pan = 0, gain = 1, rev = 0.25) {
  const th = ((clamp(pan, -1, 1) + 1) * Math.PI) / 4, gl = Math.cos(th) * gain, gr = Math.sin(th) * gain;
  const T = this.tmp, L = this.L, R = this.R, vL = this.vL, vR = this.vR;
  for (let k = 0; k < n; k++) {
    const i = i0 + k; if (i < 0) continue; if (i >= NS) break;
    const v = T[k]; L[i] += v * gl; R[i] += v * gr; vL[i] += v * gl * rev; vR[i] += v * gr * rev;
  }
};
/* sum of exponentially decaying partials (recurrence oscillators) into tmp */
function partials(tmp, n, f0, parts, attack = 0.002, release = null) {
  tmp.fill(0, 0, n);
  for (const [ratio, amp, tau, phase] of parts) {
    const f = f0 * ratio; if (f > SR * 0.45) continue;
    const w = (TAU * f) / SR, k = 2 * Math.cos(w);
    let s1 = Math.sin(phase || 0), s2 = Math.sin((phase || 0) - w), a = amp;
    const d = Math.exp(-1 / (tau * SR));
    for (let i = 0; i < n; i++) { const s = k * s1 - s2; s2 = s1; s1 = s; tmp[i] += s * a; a *= d; if (a < 1e-5) break; }
  }
  const na = Math.max(1, Math.floor(attack * SR));
  for (let i = 0; i < na && i < n; i++) tmp[i] *= i / na;
  if (release) { const r0 = Math.floor(release[0] * SR), rn = Math.floor(release[1] * SR); for (let i = r0; i < n; i++) tmp[i] *= Math.max(0, 1 - (i - r0) / rn); }
}
/* band-limited saw wavetable */
const SAWT = (() => { const N = 4096, t = new Float32Array(N + 1); for (let i = 0; i <= N; i++) { let v = 0; for (let h = 1; h <= 28; h++) v += Math.sin((TAU * h * i) / N) / h; t[i] = v * 0.55; } return t; })();
function Biquad(type, f, q) { this.set(type, f, q); this.x1 = this.x2 = this.y1 = this.y2 = 0; }
Biquad.prototype.set = function (type, f, q) {
  const w = (TAU * clamp(f, 10, SR * 0.45)) / SR, cs = Math.cos(w), al = Math.sin(w) / (2 * q);
  let b0, b1, b2, a0, a1, a2;
  if (type === 'lp') { b0 = (1 - cs) / 2; b1 = 1 - cs; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + cs) / 2; b1 = -(1 + cs); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; }
  a0 = 1 + al; a1 = -2 * cs; a2 = 1 - al;
  this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
};
Biquad.prototype.p = function (x) {
  const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
  this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y;
};

/* ---------------- instruments ---------------- */
const INST = {
  musicbox(M, t, m, vel, o = {}) {
    const f = mtof(m) * Math.pow(2, (o.cents || 0) / 1200), n = Math.floor(3.2 * SR);
    partials(M.tmp, n, f, [[1, 1, 1.6], [2.0, 0.35, 0.7], [3.01, 0.12, 0.35], [4.17, 0.16, 0.22], [5.43, 0.06, 0.12], [7.9, 0.04, 0.06]], 0.0015);
    const r = RNG((m * 131 + Math.floor(t * 1000)) >>> 0);
    for (let i = 0; i < 260; i++) M.tmp[i] += (r() - 0.5) * 0.3 * (1 - i / 260);
    M.put(Math.floor(t * SR), n, o.pan ?? 0.15, vel * 0.22, o.rev ?? 0.35);
  },
  piano(M, t, m, vel, dur, o = {}) {
    const f = mtof(m), tau = 1.5 * Math.pow(261 / f, 0.45) * (o.sus ?? 1), n = Math.floor(Math.min(10, dur + 1.2 + tau * 2) * SR);
    const parts = [];
    for (let h = 1; h <= 9; h++) { const B = 0.00035; parts.push([h * Math.sqrt(1 + B * h * h), Math.pow(h, -1.25) * (h === 1 ? 1 : 0.8) * (1 + (vel - 0.5) * 0.3 * (h > 3 ? 1 : 0)), tau / (1 + 0.55 * (h - 1)), h * 0.3]); }
    partials(M.tmp, n, f, parts, 0.003, [dur + 0.05, 0.35]);
    const r = RNG((m * 977 + Math.floor(t * 997)) >>> 0), hp = new Biquad('bp', f * 3, 1.2);
    for (let i = 0; i < 400; i++) M.tmp[i] += hp.p(r() - 0.5) * 0.25 * (1 - i / 400);
    M.put(Math.floor(t * SR), n, o.pan ?? ((m - 64) / 40), vel * 0.2, o.rev ?? 0.3);
  },
  /* string/brass pad: detuned wavetable saws through a lowpass */
  pad(M, t, m, vel, dur, o = {}) {
    const att = o.att ?? 0.5, rel = o.rel ?? 0.9, n = Math.floor((dur + rel) * SR);
    const T = M.tmp; T.fill(0, 0, n);
    const f = mtof(m), voices = o.voices ?? 3, det = o.det ?? 7;
    const lp = new Biquad('lp', o.cut ?? 2200, 0.7), lp2 = new Biquad('lp', o.cut ?? 2200, 0.7);
    const ph = [], inc = [];
    for (let v = 0; v < voices; v++) { ph.push(hash2(m, v) * 4096); inc.push((f * Math.pow(2, ((v - (voices - 1) / 2) * det) / 1200) * 4096) / SR); }
    const vib = (TAU * (o.vibF ?? 5.1)) / SR, vd = o.vib ?? 0.0025;
    for (let i = 0; i < n; i++) {
      const tt = i / SR;
      const env = Math.min(1, tt / att) * (tt > dur ? Math.max(0, 1 - (tt - dur) / rel) : 1) * (o.swell ? Math.min(1, 0.3 + 0.7 * tt / dur) : 1);
      const vm = 1 + Math.sin(i * vib) * vd * Math.min(1, tt / 0.6);
      let s = 0;
      for (let v = 0; v < voices; v++) { ph[v] += inc[v] * vm; if (ph[v] >= 4096) ph[v] -= 4096; const p = ph[v], i0 = p | 0, fr = p - i0; s += SAWT[i0] + (SAWT[i0 + 1] - SAWT[i0]) * fr; }
      T[i] = lp2.p(lp.p(s / voices)) * env;
    }
    M.put(Math.floor(t * SR), n, o.pan ?? 0, vel * 0.18, o.rev ?? 0.45);
  },
  flute(M, t, m, vel, dur, o = {}) {
    const f = mtof(m), n = Math.floor((dur + 0.3) * SR), T = M.tmp; T.fill(0, 0, n);
    const r = RNG((m * 31 + Math.floor(t * 100)) >>> 0), bp = new Biquad('bp', f * 2, 3);
    let ph = 0; const vib = (TAU * 5.3) / SR;
    for (let i = 0; i < n; i++) {
      const tt = i / SR, env = Math.min(1, tt / 0.06) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.3) : 1);
      ph += (TAU * f * (1 + Math.sin(i * vib) * 0.004 * Math.min(1, tt / 0.4))) / SR;
      T[i] = (Math.sin(ph) + 0.22 * Math.sin(2 * ph) + 0.06 * Math.sin(3 * ph) + bp.p(r() - 0.5) * 0.25) * env;
    }
    M.put(Math.floor(t * SR), n, o.pan ?? -0.1, vel * 0.16, o.rev ?? 0.4);
  },
  bell(M, t, m, vel, o = {}) {
    const n = Math.floor(4 * SR);
    partials(M.tmp, n, mtof(m), [[1, 1, 1.8], [2.76, 0.5, 0.9], [5.4, 0.3, 0.4], [8.93, 0.15, 0.2], [0.5, 0.2, 2.2]], 0.001);
    M.put(Math.floor(t * SR), n, o.pan ?? 0, vel * 0.18, o.rev ?? 0.5);
  },
  timp(M, t, m, vel, o = {}) {
    const n = Math.floor(1.6 * SR), T = M.tmp, f = mtof(m), r = RNG(Math.floor(t * 1000) + 7);
    let ph = 0;
    for (let i = 0; i < n; i++) { const tt = i / SR; ph += (TAU * f * (1 + 0.5 * Math.exp(-tt * 30))) / SR; T[i] = (Math.sin(ph) * Math.exp(-tt * 2.6) + (r() - 0.5) * Math.exp(-tt * 40) * 0.6); }
    M.put(Math.floor(t * SR), n, o.pan ?? 0, vel * 0.5, o.rev ?? 0.3);
  },
};

/* ---------------- noise based effects ---------------- */
const FX = {
  burst(M, t, dur, o) { // filtered noise burst with exp decay
    const n = Math.floor(dur * SR), T = M.tmp, r = RNG(o.seed ?? (Math.floor(t * 9973) + 1));
    const f1 = new Biquad(o.type || 'bp', o.f || 1500, o.q || 1), f2 = new Biquad(o.type || 'bp', o.f || 1500, o.q || 1);
    const k = o.decay || 30;
    for (let i = 0; i < n; i++) { const tt = i / SR; T[i] = f2.p(f1.p(r() * 2 - 1)) * Math.exp(-tt * k) * Math.min(1, tt / (o.att || 0.0005)); }
    M.put(Math.floor(t * SR), n, o.pan ?? 0, o.g ?? 0.5, o.rev ?? 0.2);
  },
  clap(M, t, g, pan, seed) { FX.burst(M, t, 0.06, { f: 1100 + hash1(seed) * 900, q: 0.9, decay: 70, g: g, pan, seed, rev: 0.35 }); },
  thump(M, t, g, o = {}) {
    const n = Math.floor(0.35 * SR), T = M.tmp, r = RNG(Math.floor(t * 1000) + 3);
    let ph = 0; const f0 = o.f || 70;
    for (let i = 0; i < n; i++) { const tt = i / SR; ph += (TAU * f0 * (1 + Math.exp(-tt * 40))) / SR; T[i] = Math.sin(ph) * Math.exp(-tt * 18) + (r() - 0.5) * Math.exp(-tt * 90) * 0.5; }
    M.put(Math.floor(t * SR), n, o.pan ?? 0, g, o.rev ?? 0.25);
  },
  shing(M, t, g) { // golden transformation shimmer
    const n = Math.floor(2.6 * SR), T = M.tmp; T.fill(0, 0, n);
    for (let v = 0; v < 6; v++) { let ph = 0; const f0 = 1200 + v * 370; for (let i = 0; i < n; i++) { const tt = i / SR; ph += (TAU * f0 * (1 + tt * 0.25)) / SR; T[i] += Math.sin(ph) * Math.exp(-tt * (1.3 + v * 0.2)) * Math.min(1, tt / 0.15) * 0.2; } }
    const r = RNG(Math.floor(t * 100)), hp = new Biquad('hp', 5000, 0.7);
    for (let i = 0; i < n; i++) { const tt = i / SR; T[i] += hp.p(r() - 0.5) * Math.exp(-tt * 3) * Math.min(1, tt / 0.3) * 0.5; }
    M.put(Math.floor(t * SR), n, 0.1, g, 0.6);
  },
  rumble(M, t, dur, g, o = {}) {
    const n = Math.floor(dur * SR), T = M.tmp, r = RNG(Math.floor(t * 13) + 5), lp = new Biquad('lp', o.f || 90, 0.8), lp2 = new Biquad('lp', o.f || 90, 0.8);
    for (let i = 0; i < n; i++) { const u = i / n; T[i] = lp2.p(lp.p(r() * 2 - 1)) * 3 * Math.sin(Math.PI * Math.min(1, u * (o.shape || 1.5))) * (o.decay ? Math.exp(-u * o.decay) : 1); }
    M.put(Math.floor(t * SR), n, 0, g, 0.3);
  },
  creak(M, t, dur, g) {
    const n = Math.floor(dur * SR), T = M.tmp, lp = new Biquad('lp', 700, 2);
    let ph = 0;
    for (let i = 0; i < n; i++) { const u = i / n, tt = i / SR; const f = 48 + 10 * Math.sin(tt * 3.1) + 6 * noise1(tt * 9, 3); ph += f / SR; const saw = (ph % 1) * 2 - 1; T[i] = lp.p(saw) * Math.sin(Math.PI * u) * (0.6 + 0.4 * noise1(tt * 20, 4)); }
    M.put(Math.floor(t * SR), n, -0.1, g, 0.5);
  },
  murmur(M, t0, dur, g) { // muffled voices behind the tent
    const n = Math.floor(dur * SR), T = M.tmp, r = RNG(808), bp = new Biquad('bp', 450, 1.5), bp2 = new Biquad('bp', 900, 2);
    for (let i = 0; i < n; i++) { const tt = i / SR; const syl = Math.max(0, Math.sin(tt * 26 + 3 * noise1(tt * 3, 1))) * (0.4 + 0.6 * noise1(tt * 1.7, 2)); const x = r() * 2 - 1; T[i] = (bp.p(x) + bp2.p(x) * 0.4) * syl * Math.min(1, tt / 0.4) * Math.min(1, (dur - tt) / 0.15); }
    M.put(Math.floor(t0 * SR), n, 0, g, 0.25);
  },
};
function windTrack(M) {
  // gain keyframes (time, gain, brightness)
  const K = [[0, 0, 0.5], [1.5, 0.55, 0.6], [12.6, 0.6, 0.6], [13.2, 0.08, 0.2], [19.6, 0.08, 0.2], [20.4, 0.3, 0.45], [24.6, 0.3, 0.45], [25.3, 0.04, 0.2], [29.6, 0.05, 0.3],
    [30.4, 0.75, 0.8], [36.8, 0.75, 0.8], [37.4, 0.45, 0.6], [40.8, 0.45, 0.6], [41.2, 0.04, 0.3], [55.8, 0.04, 0.3], [56.4, 0.12, 0.4], [61.8, 0.14, 0.5], [62.4, 0.12, 0.3],
    [80.6, 0.06, 0.3], [81.4, 0.22, 0.4], [84.6, 0.22, 0.4], [85.4, 0.6, 0.55], [89, 0.55, 0.5], [91, 0, 0.4]];
  const at = (t) => { for (let i = 0; i < K.length - 1; i++) if (t <= K[i + 1][0]) { const u = inv(K[i][0], K[i + 1][0], t); return [lerp(K[i][1], K[i + 1][1], u), lerp(K[i][2], K[i + 1][2], u)]; } return [0, 0.4]; };
  for (const [ch, seed, off] of [[M.L, 41, 0], [M.R, 42, 0.37]]) {
    const r = RNG(seed);
    const bp = new Biquad('bp', 500, 0.7), lp = new Biquad('lp', 300, 0.7), wh = new Biquad('bp', 900, 18);
    let g = 0, br = 0;
    for (let i = 0; i < NS; i++) {
      if ((i & 63) === 0) {
        const t = i / SR, gs = gust(t + off), [kg, kb] = at(t);
        g = kg * (0.35 + 0.75 * gs); br = kb;
        bp.set('bp', 220 + 1500 * gs * br, 0.6); lp.set('lp', 160 + 500 * br, 0.7); wh.set('bp', 700 + 700 * gs + 200 * Math.sin(t * 0.7 + off), 25);
      }
      const x = r() * 2 - 1;
      ch[i] += (bp.p(x) * 0.9 + lp.p(x) * 1.4 + wh.p(x) * 2.2 * br) * g * 0.55;
    }
  }
}
function freeverb(M, room = 0.86, damp = 0.25, wet = 0.32) {
  const cl = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], al = [556, 441, 341, 225];
  for (const [src, dst, sp] of [[M.vL, M.L, 0], [M.vR, M.R, 23]]) {
    const combs = cl.map((l) => ({ b: new Float32Array(l + sp), i: 0, s: 0 })), aps = al.map((l) => ({ b: new Float32Array(l + sp), i: 0 }));
    for (let n = 0; n < NS; n++) {
      const x = src[n] * 0.015; let o = 0;
      for (const c of combs) { const y = c.b[c.i]; c.s = y * (1 - damp) + c.s * damp; c.b[c.i] = x + c.s * room; if (++c.i >= c.b.length) c.i = 0; o += y; }
      for (const a of aps) { const bo = a.b[a.i]; const y = -o + bo; a.b[a.i] = o + bo * 0.5; if (++a.i >= a.b.length) a.i = 0; o = y; }
      dst[n] += o * wet * 2.2;
    }
  }
}

/* ---------------- score ---------------- */
const TH1 = [[[69, 1], [74, 1], [76, 1]], [[77, 2], [76, 1]], [[74, 1], [76, 1], [81, 1]], [[79, 3]], [[77, 1], [79, 1], [81, 1]], [[82, 2], [81, 1]], [[79, 1], [77, 1], [76, 1]], [[76, 3]]];
const TH2 = [[[69, 1], [74, 1], [76, 1]], [[77, 2], [81, 1]], [[86, 2], [84, 1]], [[81, 3]], [[82, 1], [81, 1], [79, 1]], [[77, 2], [76, 1]], [[74, 1], [76, 1], [73, 1]], [[74, 3]]];
const CH = { Dm: [38, [62, 65, 69]], Bb: [46, [58, 62, 65]], F: [41, [60, 65, 69]], C: [48, [60, 64, 67]], Gm: [43, [58, 62, 67]], A: [45, [61, 64, 69]], A7: [45, [61, 64, 67]],
  D: [38, [62, 66, 69]], G: [43, [59, 62, 66]], Bm: [47, [59, 62, 66]], Em: [40, [59, 64, 67]] };
const PROG1 = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Gm', 'C', 'A'];
const PROG_MAJ = ['D', 'G', 'Bm', 'Em', 'D', 'G', 'A', 'A'];
const toMajor = (m) => { const pc = ((m % 12) + 12) % 12; return pc === 5 || pc === 10 || pc === 0 ? m + 1 : m; };
/* schedule a melody: bars[] of [midi, beats]; barDur number or array; returns end time */
function melody(bars, t0, barDur, fn, from = 0, to = bars.length) {
  let t = t0;
  for (let b = from; b < to; b++) {
    const bd = Array.isArray(barDur) ? barDur[b - from] : barDur, beat = bd / 3;
    for (const [m, beats] of bars[b]) { fn(t, m, beats * beat, b); t += beats * beat; }
  }
  return t;
}

async function synthesize(progress) {
  const M = new Mixer();
  const step = async (p) => { if (progress) progress(p); await new Promise((r) => setTimeout(r, 0)); };
  await step(0.02);
  windTrack(M);
  await step(0.25);
  const mb = (t, m, v, o) => INST.musicbox(M, t, m, v, o);
  const pn = (t, m, v, d, o) => INST.piano(M, t, m, v, d, o);

  /* A: 0-13 wind, music box theme, faint pad */
  melody(TH1, 2.0, 2.5, (t, m) => mb(t, m + 12, 0.9), 0, 4);
  INST.pad(M, 4.0, 50, 0.25, 8.5, { att: 3, rel: 2, cut: 900 }); INST.pad(M, 4.0, 57, 0.18, 8.5, { att: 3, rel: 2, cut: 900 });
  FX.burst(M, 11.25, 0.6, { type: 'bp', f: 700, q: 0.6, decay: 5, att: 0.2, g: 0.25 });
  for (let i = 0; i < 14; i++) FX.burst(M, 0.8 + hash1(i * 7) * 12, 0.25, { f: 2500 + hash1(i) * 2000, q: 0.7, decay: 14, att: 0.03, g: 0.05, pan: hash1(i * 3) * 2 - 1 });
  await step(0.32);

  /* B: 13-30 piano waltz of the sacrifices */
  const bB = 2.125;
  melody(TH1, 13.0, bB, (t, m, d) => pn(t, m, 0.62, d * 0.95), 0, 8);
  PROG1.forEach((c, b) => {
    const t = 13.0 + b * bB, [bass, tones] = CH[c], beat = bB / 3;
    pn(t, bass + 12, 0.5, beat * 2.6, { sus: 1.2 });
    for (const k of [1, 2]) tones.forEach((m) => pn(t + k * beat, m - 12, 0.28, beat * 0.8));
    INST.pad(M, t, tones[0] - 12, 0.14, bB, { att: 0.6, rel: 0.6, cut: 1200 });
  });
  // music box doubles the end of the phrase, then freezes
  melody(TH1, 13.0, bB, (t, m) => { if (t >= 25.2 && t < 28.4) mb(t, m + 12, 0.8); }, 0, 8);
  for (let s = 13.0; s < 17.0; s += 1) FX.burst(M, s, 0.03, { type: 'hp', f: 3500, q: 0.7, decay: 220, g: 0.18, pan: -0.5 });
  FX.shing(M, 17.0, 0.35); FX.shing(M, 23.0, 0.3); FX.shing(M, 28.4, 0.4);
  FX.murmur(M, 20.0, 3.0, 0.5);
  for (const t of [20.6, 21.4, 22.3]) INST.bell(M, t, 96 + Math.floor(hash1(t * 10) * 4), 0.25, { pan: 0.2 });
  await step(0.45);

  /* C: 30-41 the ascent */
  const bC = 1.5;
  ['Dm', 'Bb', 'Gm', 'A', 'Dm', 'Bb'].forEach((c, b) => {
    const t = 30.0 + b * bC, [bass, tones] = CH[c];
    for (let k = 0; k < 6; k++) INST.pad(M, t + k * bC / 6, bass + 12, 0.32, bC / 6 * 0.7, { att: 0.01, rel: 0.08, cut: 1400, voices: 2 });
    INST.timp(M, t, bass + 12 >= 50 ? bass : bass + 12, 0.7);
    INST.pad(M, t, tones[1], 0.12 + b * 0.03, bC, { att: 0.3, rel: 0.3, cut: 1600 + b * 300 });
  });
  melody(TH1, 33.0, bC, (t, m, d) => { INST.pad(M, t, m - 12, 0.32, d * 0.95, { att: 0.05, rel: 0.25, cut: 2600, det: 10, vib: 0.004, rev: 0.4 }); }, 0, 4);
  for (let n = 1; n <= 11; n++) { const t = 30 + (n - 0.4) / 1.5; if (t < 37) { FX.thump(M, t, 0.35, { f: 90, pan: -0.1 }); INST.bell(M, t + 0.005, 88, 0.05, { pan: -0.1, rev: 0.3 }); } }
  // swell to the gates
  INST.pad(M, 39.0, 45, 0.5, 2.0, { att: 1.8, rel: 0.6, cut: 1200, swell: 1 }); INST.pad(M, 39.0, 57, 0.4, 2.0, { att: 1.8, rel: 0.6, cut: 1800 }); INST.pad(M, 39.0, 64, 0.35, 2.0, { att: 1.8, rel: 0.6, cut: 2200 });
  FX.burst(M, 38.6, 2.4, { type: 'hp', f: 4000, q: 0.5, decay: -0.6, att: 2.2, g: 0.12, rev: 0.5 });
  FX.creak(M, 38.3, 1.8, 0.45); FX.rumble(M, 38.3, 2.6, 0.5, { f: 70 });
  await step(0.58);

  /* D: 41-56 the palace waltz in D major */
  const bD = 1.875;
  melody(TH1, 41.0, bD, (t, m, d) => { INST.flute(M, t, toMajor(m), 0.85, d * 0.92); INST.pad(M, t, toMajor(m) - 12, 0.16, d, { att: 0.08, rel: 0.4, cut: 2400 }); }, 0, 8);
  PROG_MAJ.forEach((c, b) => {
    const t = 41.0 + b * bD, [bass, tones] = CH[c], beat = bD / 3;
    pn(t, bass + 12, 0.55, beat * 0.9); INST.pad(M, t, bass, 0.25, beat * 0.6, { att: 0.01, rel: 0.2, cut: 600, voices: 2 });
    for (const k of [1, 2]) tones.forEach((m) => { pn(t + k * beat, m, 0.3, beat * 0.5); INST.pad(M, t + k * beat, m, 0.1, beat * 0.45, { att: 0.02, rel: 0.15, cut: 2000 }); });
    if (b >= 4) INST.bell(M, t, tones[2] + 12, 0.35, { pan: 0.3 });
  });
  // applause: natural, many hands
  for (let i = 0; i < 520; i++) { const t = 41.0 + hash1(i * 13 + 1) * 6.4; const fade = 1 - inv(45.5, 47.6, t); FX.clap(M, t, (0.06 + hash1(i * 5) * 0.06) * Math.min(1, (t - 40.9) * 3) * fade, hash1(i * 17) * 1.8 - 0.9, i); }
  INST.bell(M, 52.6, 86, 0.6, { pan: -0.2 }); INST.bell(M, 52.6, 90, 0.4, { pan: 0.1 }); INST.bell(M, 52.62, 93, 0.35, { pan: 0.25 }); FX.shing(M, 52.6, 0.25);
  await step(0.7);

  /* E: 56-62 the mechanical repetition */
  for (let k = 1; k < 12; k += 2) { const t = 56 + k * 0.25; for (let j = 0; j < 30; j++) FX.clap(M, t, 0.07, (j / 15) - 1, 7); }
  const bE = [1.875, 2.15, 2.6];
  melody(TH1, 56.0, bE, (t, m, d, b) => mb(t, toMajor(m) + 12, 0.8, { cents: (hash1(Math.floor(t * 100)) - 0.5) * 50 * (1 + b) }), 0, 3);
  for (const [m, g] of [[38, 0.25], [39, 0.2], [45, 0.2]]) INST.pad(M, 56.5, m, g, 5.3, { att: 3, rel: 1, cut: 700, det: 18 });
  INST.pad(M, 59.0, 86, 0.12, 3.0, { att: 1.2, rel: 0.6, cut: 5000, det: 30, vib: 0.02, vibF: 11 }); INST.pad(M, 59.0, 87, 0.1, 3.0, { att: 1.2, rel: 0.6, cut: 5000, det: 30, vib: 0.02, vibF: 12 });
  for (const t of [59.4, 60.2, 61.0, 61.8]) FX.thump(M, t, 0.4, { f: 55 });
  FX.burst(M, 60.95, 0.08, { type: 'hp', f: 3000, q: 0.8, decay: 60, g: 0.35 });
  for (let i = 0; i < 6; i++) FX.burst(M, 61.0 + i * 0.1, 0.03, { type: 'hp', f: 4000, q: 0.8, decay: 120, g: 0.15 });
  await step(0.78);

  /* F: 62-68 the wall cracks, memories spill out */
  FX.burst(M, 62.2, 0.5, { type: 'hp', f: 1500, q: 0.6, decay: 9, g: 0.9, rev: 0.6 }); FX.thump(M, 62.2, 1.0, { f: 45, rev: 0.6 });
  for (let i = 0; i < 9; i++) FX.burst(M, 62.3 + i * 0.08 + hash1(i) * 0.05, 0.12, { type: 'hp', f: 2000 + hash1(i * 3) * 2000, q: 0.7, decay: 30, g: 0.3, pan: hash1(i * 5) - 0.5 });
  FX.rumble(M, 62.2, 4.5, 0.9, { f: 80, decay: 1.5, shape: 6 });
  for (let i = 0; i < 26; i++) {
    const h = (k) => hash3(i, 99, k);
    const t0 = 1.3 + h(1) * 3.2, sy = 200 + h(2) * 600, g = 900, land = 900 + h(5) * 120;
    const t = 62 + t0 + Math.sqrt((2 * (land - sy)) / g), kind = Math.floor(h(6) * 4), pan = clamp(h(3) - 0.5);
    if (kind === 2) INST.bell(M, t, 84 + Math.floor(h(7) * 8), 0.18, { pan });
    else if (kind === 3) mb(t, 81 + Math.floor(h(7) * 6), 0.6, { pan });
    else FX.burst(M, t, 0.08, { f: 1800, q: 0.5, decay: 50, g: 0.12, pan });
  }
  [76, 81, 74, 77].forEach((m, i) => mb(65.2 + i * 0.9, m + 12, 0.55, { cents: i === 2 ? -45 : 0 }));
  await step(0.84);

  /* G: 68-73 solo piano, slow */
  melody(TH1, 68.0, 2.5, (t, m, d) => pn(t, m, 0.5, d, { sus: 1.6, rev: 0.45 }), 0, 2);
  [['Dm', 68.0], ['Bb', 70.5]].forEach(([c, t]) => { const [bass, tones] = CH[c]; pn(t, bass + 12, 0.35, 2.4, { sus: 1.6 }); tones.forEach((m, k) => pn(t + 0.12 * (k + 1), m - 12, 0.22, 2.2, { sus: 1.6 })); });

  /* H: 73-81 the last dance */
  const bH = [2.0, 2.2, 2.4, 1.4];
  melody(TH2, 73.0, bH, (t, m, d) => pn(t, m, 0.55, Math.min(d, 2.5), { sus: 1.5, rev: 0.5 }), 0, 4);
  [['Dm', 73.0], ['Bb', 75.0], ['Bb', 77.2], ['F', 79.6]].forEach(([c, t], b) => { const [bass, tones] = CH[c]; pn(t, bass + 12, 0.4, 2, { sus: 1.4 }); tones.forEach((m) => pn(t + bH[b] / 3, m - 12, 0.2, 0.6)); tones.forEach((m) => pn(t + 2 * bH[b] / 3, m - 12, 0.18, 0.6)); });
  INST.pad(M, 73.0, 74, 0.16, 7.5, { att: 2, rel: 2.5, cut: 2600, det: 9 }); INST.pad(M, 73.0, 81, 0.12, 7.5, { att: 2.5, rel: 2.5, cut: 3000, det: 9 });
  for (let i = 0; i < 110; i++) { const t = 74.3 + hash1(i * 3 + 9) * 5; INST.bell(M, t, 96 + Math.floor(hash1(i * 7) * 12), 0.035, { pan: hash1(i) * 2 - 1, rev: 0.7 }); }
  INST.bell(M, 80.2, 79, 0.35, { pan: -0.2, rev: 0.9 }); INST.bell(M, 80.45, 79, 0.15, { pan: -0.3, rev: 0.9 });
  await step(0.9);

  /* I-J: 81-91 emptiness, the walk away, the music box winds down */
  INST.pad(M, 81.0, 38, 0.3, 3.4, { att: 1.5, rel: 1.5, cut: 500, voices: 2 });
  for (let i = 0; i < 18; i++) INST.bell(M, 81.2 + hash1(i * 11) * 3, 98 + Math.floor(hash1(i * 13) * 8), 0.03 * (1 - i / 18), { pan: 0.4, rev: 0.8 });
  for (let k = 1; k < 7; k++) { const t = 85 + k * 0.8333; if (t < 90.5) FX.thump(M, t, 0.22 * (1 - k * 0.11), { f: 110, rev: 0.4 }); FX.burst(M, t + 0.01, 0.08, { f: 900, q: 0.6, decay: 40, g: 0.06 * (1 - k * 0.1) }); }
  let tw = 86.0, slow = 1;
  for (const [m, beats] of [[69, 1], [74, 1], [76, 1], [77, 2], [76, 1], [74, 1]]) { if (tw > 89.6) break; mb(tw, m + 12 - (slow - 1) * 0.6, 0.7 / slow, { cents: -(slow - 1) * 60, rev: 0.5 }); tw += beats * 0.85 * slow; slow *= 1.22; }
  await step(0.95);

  freeverb(M);
  // master: fades, soft clip, normalise to -1 dBFS peak
  let peak = 0;
  for (let i = 0; i < NS; i++) {
    const t = i / SR, g = Math.min(1, t / 1.2) * Math.min(1, (DUR - t) / 2.0);
    M.L[i] = Math.tanh(M.L[i] * g * 1.1); M.R[i] = Math.tanh(M.R[i] * g * 1.1);
    peak = Math.max(peak, Math.abs(M.L[i]), Math.abs(M.R[i]));
  }
  const k = peak > 0 ? 0.89 / peak : 1;
  let hsh = 2166136261 >>> 0;
  for (let i = 0; i < NS; i++) { M.L[i] *= k; M.R[i] *= k; if ((i & 15) === 0) { hsh = Math.imul(hsh ^ ((M.L[i] * 32767) | 0), 16777619) >>> 0; hsh = Math.imul(hsh ^ ((M.R[i] * 32767) | 0), 16777619) >>> 0; } }
  await step(1);
  return { L: M.L, R: M.R, hash: hsh.toString(16) };
}
