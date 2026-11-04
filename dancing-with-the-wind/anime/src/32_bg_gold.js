/* ===================== backgrounds: golden void sky, gates, palace, bokeh, cracked wall ===================== */
const GOLDCLOUD = { dark: [54, 36, 30], mid: [118, 80, 48], lit: [214, 160, 86], hi: [255, 228, 160], rim: [255, 190, 100], light: [0.15, -1], haze: [120, 80, 40] };
function buildGoldSky(w = 2600, h = H) {
  const [c, x] = mkC(w, h), r = RNG(606);
  vfill(x, 0, 0, w, h, [[0, [26, 18, 14]], [0.45, [44, 30, 22]], [1, [16, 14, 22]]]);
  // light from far above
  glow(x, w * 0.6, -200, 1100, [255, 190, 100], 0.22);
  stars(x, r, 0, 0, w, h * 0.6, 260, [255, 230, 180], h * 0.5);
  const cl = [[300, 760, 900, 330], [1300, 860, 1200, 360], [2200, 740, 900, 300], [800, 420, 700, 220], [1900, 380, 800, 240], [2500, 520, 600, 220]];
  for (const [cx, cy, cw, ch] of cl) cloud(x, r, cx, cy, cw, ch, GOLDCLOUD);
  // light shafts
  x.save(); x.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) {
    const sx = r() * w, sw = 60 + r() * 160;
    x.fillStyle = lg(x, 0, 0, 0, h, [[0, [255, 210, 140], 0.10], [1, [255, 210, 140], 0]]);
    x.beginPath(); x.moveTo(sx, 0); x.lineTo(sx + sw, 0); x.lineTo(sx + sw + 300, h); x.lineTo(sx + 300 - sw * 0.5, h); x.fill();
  }
  x.restore();
  return c;
}
/* golden stairs seen from the side, scrolling. p = steps climbed, at screen origin ox,oy (the climber's step 0 nosing), k = px per unit */
function drawGoldStairs(ctx, p, ox, oy, k, T, R, age) {
  ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.translate(-p * T, p * R);
  const n0 = Math.floor(p) - 14, n1 = Math.floor(p) + 16;
  const line = [92, 60, 24];
  // stringer (side face under the steps)
  const str = new Path2D();
  str.moveTo(n0 * T, -n0 * R + R);
  for (let n = n0; n <= n1; n++) { str.lineTo(n * T, -n * R); str.lineTo((n + 1) * T, -n * R); }
  str.lineTo((n1 + 1) * T, -n1 * R + 260); str.lineTo(n0 * T, -n0 * R + 260 + R); str.closePath();
  ctx.fillStyle = lg(ctx, 0, -n1 * R, 0, -n0 * R + 260, [[0, [230, 180, 90]], [1, [150, 100, 44]]]); ctx.fill(str);
  // embedded photos / letters / gears on every other step face
  for (let n = n0; n <= n1; n++) {
    const kind = ((n % 3) + 3) % 3, cx = n * T + T * 0.5, cy = -n * R + 70;
    ctx.save(); ctx.translate(cx, cy);
    if (kind === 0) { ctx.fillStyle = css([246, 220, 160]); ctx.fillRect(-26, -20, 52, 40); ctx.fillStyle = css([150, 110, 60]); ctx.fillRect(-21, -15, 42, 26); fillP(ctx, ellPath(-8, -4, 5, 6), [240, 200, 140]); fillP(ctx, ellPath(8, -4, 5, 6), [240, 200, 140]); ctx.strokeStyle = css(line); ctx.lineWidth = 2; ctx.strokeRect(-26, -20, 52, 40); }
    else if (kind === 1) { ctx.rotate(0.12); ctx.fillStyle = css([250, 232, 190]); ctx.fillRect(-24, -16, 48, 32); ctx.strokeStyle = css([170, 130, 70], 0.8); ctx.lineWidth = 1.5; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-18, -8 + i * 6); for (let j = 0; j < 6; j++) ctx.lineTo(-18 + j * 7, -8 + i * 6 + (j % 2) * 2); ctx.stroke(); } ctx.strokeStyle = css(line); ctx.lineWidth = 2; ctx.strokeRect(-24, -16, 48, 32); }
    else { ctx.fillStyle = css([255, 214, 120]); ctx.beginPath(); for (let i = 0; i < 20; i++) { const a = (i / 20) * TAU, rr = i % 2 ? 18 : 23; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.closePath(); ctx.fill(); ctx.strokeStyle = css(line); ctx.lineWidth = 2; ctx.stroke(); fillP(ctx, ellPath(0, 0, 6, 6), [150, 100, 44]); }
    ctx.restore();
  }
  // tread tops (seen slightly from above) and nosing highlight
  for (let n = n0; n <= n1; n++) {
    const tp = polyPath([[n * T, -n * R], [(n + 1) * T, -n * R], [(n + 1) * T + 16, -n * R - 12], [n * T + 16, -n * R - 12]]);
    fillP(ctx, tp, [255, 226, 150]);
    ctx.strokeStyle = css([255, 246, 210]); ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(n * T, -n * R); ctx.lineTo((n + 1) * T, -n * R); ctx.stroke();
  }
  ctx.strokeStyle = css(line); ctx.lineWidth = 2.6; ctx.stroke(str);
  ctx.restore();
}

/* gates: low angle up an endless staircase to the palace gate */
function buildGatesBG() {
  const [c, x] = mkC(W, H), r = RNG(707);
  vfill(x, 0, 0, W, H, [[0, [20, 14, 12]], [0.5, [52, 34, 24]], [1, [24, 18, 22]]]);
  stars(x, r, 0, 0, W, 500, 200, [255, 230, 180]);
  for (const [cx, cy, cw, ch] of [[260, 820, 900, 300], [1640, 860, 900, 320], [400, 300, 700, 200], [1560, 260, 800, 220]]) cloud(x, r, cx, cy, cw, ch, GOLDCLOUD);
  // palace on the clouds: tiered halls with upturned Korean eaves, gilded
  const base = 250;
  const tier = (cx, y, bw, bh, rw, col) => {
    const body = polyPath([[cx - bw / 2, y], [cx - bw / 2, y - bh], [cx + bw / 2, y - bh], [cx + bw / 2, y]]);
    x.fillStyle = lg(x, cx - bw / 2, 0, cx + bw / 2, 0, [[0, scl(col, 0.55)], [0.5, col], [1, scl(col, 0.7)]]); x.fill(body); ink(x, body, [60, 38, 20], 2);
    for (let i = 0; i < Math.floor(bw / 26); i++) { const wx = cx - bw / 2 + 10 + i * 26; x.fillStyle = css([255, 226, 160], 0.85); x.fillRect(wx, y - bh * 0.7, 10, bh * 0.4); }
    const roof = crPath([[cx - rw / 2 - 14, y - bh - 4, 1], [cx - rw / 2 + 10, y - bh - 10], [cx - rw * 0.3, y - bh - 26], [cx + rw * 0.3, y - bh - 26], [cx + rw / 2 - 10, y - bh - 10], [cx + rw / 2 + 14, y - bh - 4, 1], [cx + rw / 2 - 20, y - bh + 4], [cx - rw / 2 + 20, y - bh + 4]]);
    celFill(x, roof, [196, 146, 62], [130, 88, 36], 0, -6); ink(x, roof, [60, 38, 20], 2);
  };
  glow(x, 960, base - 120, 500, [255, 200, 120], 0.25);
  for (const sx of [-1, 1]) { tier(960 + sx * 300, base + 20, 120, 90, 170, [186, 136, 64]); tier(960 + sx * 300, base - 74, 80, 60, 120, [196, 146, 70]); }
  tier(960, base + 30, 360, 110, 470, [200, 150, 70]);
  tier(960, base - 84, 260, 80, 340, [208, 158, 76]);
  tier(960, base - 168, 160, 64, 220, [216, 166, 82]);
  const sp = crPath([[960, base - 300], [948, base - 236], [972, base - 236]]); fillP(x, sp, [255, 220, 140]);
  // stairs: trapezoid narrowing upward
  const st = polyPath([[560, H], [1360, H], [1010, base + 50], [910, base + 50]]);
  x.save(); x.clip(st);
  vfill(x, 560, base, 800, H - base, [[0, [190, 140, 70]], [1, [255, 214, 130]]]);
  for (let i = 0; i < 60; i++) { const u = Math.pow(i / 60, 2.2); const y = lerp(base + 50, H, u); x.strokeStyle = css([120, 80, 30], 0.7); x.lineWidth = 1 + u * 4; x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke(); x.strokeStyle = css([255, 240, 200], 0.5); x.lineWidth = 1 + u * 2; x.beginPath(); x.moveTo(0, y + 2 + u * 4); x.lineTo(W, y + 2 + u * 4); x.stroke(); }
  x.restore();
  ink(x, st, [90, 60, 24], 3);
  return c;
}
function drawGateDoors(x, open) {
  const cx = 960, top = 196, bot = 280, hw = 54;
  x.fillStyle = css([40, 26, 18]); x.fillRect(cx - hw, top, hw * 2, bot - top);
  if (open > 0) {
    x.save(); x.globalCompositeOperation = 'lighter';
    const ow = hw * open;
    x.fillStyle = css([255, 236, 190], 0.95); x.fillRect(cx - ow, top, ow * 2, bot - top);
    glow(x, cx, (top + bot) / 2, 200 + 700 * open, [255, 200, 120], 0.35 * open);
    // rays down the stairs
    for (let i = -4; i <= 4; i++) {
      x.fillStyle = lg(x, 0, bot, 0, H, [[0, [255, 220, 150], 0.22 * open], [1, [255, 220, 150], 0]]);
      x.beginPath(); x.moveTo(cx - ow * 0.4 + i * 6, bot); x.lineTo(cx + ow * 0.4 + i * 6, bot); x.lineTo(cx + i * 220 + 90, H); x.lineTo(cx + i * 220 - 90, H); x.fill();
    }
    x.restore();
  }
  for (const sx of [-1, 1]) {
    const dw = hw * (1 - open);
    const d = polyPath([[cx + sx * hw, top], [cx + sx * (hw - dw), top + 6 * open], [cx + sx * (hw - dw), bot - 6 * open], [cx + sx * hw, bot]]);
    fillP(x, d, [196, 146, 64]); ink(x, d, [80, 52, 24], 2);
  }
  const arch = crPath([[cx - hw - 20, bot, 1], [cx - hw - 20, top - 10], [cx, top - 70], [cx + hw + 20, top - 10], [cx + hw + 20, bot, 1]], false);
  ink(x, arch, [220, 170, 90], 8);
}

/* palace ballroom (one-point perspective) */
const PAL3 = { F: 900, HZ: 470, CY: 1.7 };
function pP(X, Y, Z) { return [960 + (PAL3.F * X) / Z, PAL3.HZ - (PAL3.F * (Y - PAL3.CY)) / Z]; }
function buildPalace() {
  const [c, x] = mkC(W, H), r = RNG(808);
  const Zf = 70;
  // far wall with a huge glowing arch
  const fw = polyPath([pP(-11, 0, Zf), pP(-11, 13, Zf), pP(11, 13, Zf), pP(11, 0, Zf)]);
  fillP(x, fw, [180, 130, 60]);
  const a0 = pP(-4, 0, Zf), a1 = pP(4, 9, Zf);
  x.fillStyle = css([255, 236, 190]); x.fillRect(a0[0], a1[1], a1[0] - a0[0], a0[1] - a1[1]);
  glow(x, 960, (a0[1] + a1[1]) / 2, 400, [255, 210, 140], 0.5);
  // ceiling
  const ce = polyPath([pP(-11, 13, 1), pP(-11, 13, Zf), pP(11, 13, Zf), pP(11, 13, 1)]);
  x.save(); x.clip(ce); vfill(x, 0, 0, W, PAL3.HZ, [[0, [60, 36, 24]], [1, [150, 104, 52]]]); x.restore();
  // walls
  for (const sx of [-1, 1]) {
    const wl = polyPath([pP(sx * 11, 0, 1), pP(sx * 11, 13, 1), pP(sx * 11, 13, Zf), pP(sx * 11, 0, Zf)]);
    x.save(); x.clip(wl);
    vfill(x, 0, 0, W, H, [[0, [120, 80, 40]], [0.5, [214, 166, 86]], [1, [130, 88, 44]]]);
    // relief panels: photos & letters in gilded frames
    for (let z = 3; z < Zf; z += 2.2) for (let y = 1.2; y < 11; y += 2.6) {
      const q = polyPath([pP(sx * 11, y, z), pP(sx * 11, y + 1.8, z), pP(sx * 11, y + 1.8, z + 1.5), pP(sx * 11, y, z + 1.5)]);
      fillP(x, q, mix([226, 180, 100], [180, 130, 60], hash2(z * 10, y * 10)));
      ink(x, q, [120, 80, 30], Math.max(0.6, 30 / z));
      const ins = polyPath([pP(sx * 11, y + 0.3, z + 0.25), pP(sx * 11, y + 1.5, z + 0.25), pP(sx * 11, y + 1.5, z + 1.25), pP(sx * 11, y + 0.3, z + 1.25)]);
      fillP(x, ins, mix([170, 120, 60], [246, 214, 150], hash2(z * 7, y * 3)), 0.9);
    }
    x.restore();
  }
  // dancheong beams across the ceiling
  for (let z = 4; z < Zf; z += 5) {
    const bm = polyPath([pP(-11, 13, z), pP(11, 13, z), pP(11, 12.2, z), pP(-11, 12.2, z)]);
    fillP(x, bm, [40, 110, 90]);
    x.save(); x.clip(bm);
    const p0 = pP(-11, 12.6, z), p1 = pP(11, 12.6, z), hh = (PAL3.F * 0.8) / z;
    for (let i = 0; i < 40; i++) { const u = i / 40; const bx = lerp(p0[0], p1[0], u); x.fillStyle = css([[200, 50, 40], [240, 200, 90], [60, 90, 170], [240, 240, 220]][i % 4]); x.beginPath(); x.ellipse(bx, p0[1], (p1[0] - p0[0]) / 100, hh * 0.3, 0, 0, TAU); x.fill(); }
    x.restore();
    ink(x, bm, [30, 20, 14], Math.max(0.8, 40 / z));
  }
  // floor: polished marble, reflects the hall
  const fl = polyPath([pP(-11, 0, 1), pP(-11, 0, Zf), pP(11, 0, Zf), pP(11, 0, 1)]);
  x.save(); x.clip(fl);
  vfill(x, 0, PAL3.HZ, W, H - PAL3.HZ, [[0, [200, 160, 100]], [1, [90, 60, 36]]]);
  x.globalAlpha = 0.35; x.save(); x.translate(0, PAL3.HZ * 2 + (PAL3.F * PAL3.CY * 2) / 70 * 0); x.scale(1, -1); x.drawImage(c, 0, 0); x.restore(); x.globalAlpha = 1;
  for (let z = 2; z < Zf; z *= 1.18) { const a = pP(-11, 0, z), b = pP(11, 0, z); x.strokeStyle = css([110, 76, 40], 0.5); x.lineWidth = Math.max(0.5, 20 / z); x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  for (let X = -11; X <= 11; X += 1.6) { const a = pP(X, 0, 1), b = pP(X, 0, Zf); x.strokeStyle = css([110, 76, 40], 0.4); x.lineWidth = 1.2; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(b[0], b[1]); x.stroke(); }
  // red carpet down the aisle
  const cp = polyPath([pP(-1.4, 0, 1), pP(-1.4, 0, Zf), pP(1.4, 0, Zf), pP(1.4, 0, 1)]);
  fillP(x, cp, [150, 30, 30], 0.85);
  x.restore();
  // columns (red lacquer with gold bands), far to near
  for (let z = Zf - 4; z >= 3; z -= 5) for (const sx of [-1, 1]) {
    const b0 = pP(sx * 7.5 - 0.45, 0, z), b1 = pP(sx * 7.5 + 0.45, 0, z), t0 = pP(sx * 7.5 - 0.45, 12.2, z);
    const cw = b1[0] - b0[0];
    x.fillStyle = lg(x, b0[0], 0, b1[0], 0, [[0, [90, 20, 16]], [0.35, [190, 50, 36]], [0.6, [150, 34, 26]], [1, [70, 14, 12]]]);
    x.fillRect(b0[0], t0[1], cw, b0[1] - t0[1]);
    for (const yy of [0.6, 10.8, 11.6]) { const g0 = pP(sx * 7.5 - 0.5, yy, z), g1 = pP(sx * 7.5 + 0.5, yy + 0.35, z); x.fillStyle = lg(x, g0[0], 0, g1[0], 0, [[0, [150, 100, 40]], [0.4, [255, 220, 130]], [1, [130, 84, 30]]]); x.fillRect(g0[0], g1[1], g1[0] - g0[0], g0[1] - g1[1]); }
    x.strokeStyle = css([40, 10, 8]); x.lineWidth = Math.max(0.6, 30 / z); x.strokeRect(b0[0], t0[1], cw, b0[1] - t0[1]);
    // reflection on the floor
    x.save(); x.globalAlpha = 0.25; x.fillStyle = css([170, 40, 30]); x.fillRect(b0[0], b0[1], cw, (b0[1] - t0[1]) * 0.35); x.restore();
  }
  // warm air
  glow(x, 960, 420, 900, [255, 190, 110], 0.12);
  return c;
}
function chandelier(x, cx, cy, s, flick = 1) {
  glow(x, cx, cy, 260 * s, [255, 190, 110], 0.22 * flick);
  glow(x, cx, cy, 70 * s, [255, 236, 190], 0.6 * flick);
  x.strokeStyle = css([120, 80, 30]); x.lineWidth = Math.max(1, 3 * s);
  x.beginPath(); x.moveTo(cx, cy - 400 * s); x.lineTo(cx, cy - 40 * s); x.stroke();
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; const px = cx + Math.cos(a) * 90 * s, py = cy + Math.sin(a) * 22 * s; x.fillStyle = css([255, 240, 200], 0.9 * flick); x.beginPath(); x.arc(px, py, 4 * s, 0, TAU); x.fill(); x.fillStyle = css([255, 255, 240], 0.7); x.beginPath(); x.arc(px, py + 16 * s, 2.5 * s, 0, TAU); x.fill(); }
  x.strokeStyle = css([220, 170, 80]); x.beginPath(); x.ellipse(cx, cy, 90 * s, 22 * s, 0, 0, TAU); x.stroke();
}

/* tileable out-of-focus palace strip for the dance (w=3840) */
function buildBokehStrip() {
  const w = 3840, [c, x] = mkC(w, H), r = RNG(909);
  vfill(x, 0, 0, w, H, [[0, [70, 40, 22]], [0.5, [150, 96, 46]], [1, [90, 54, 28]]]);
  const wrap = (fn) => { for (const dx of [-w, 0, w]) { x.save(); x.translate(dx, 0); fn(); x.restore(); } };
  // soft red columns
  for (let i = 0; i < 9; i++) { const cx = (i / 9) * w + r() * 100, cw = 120 + r() * 120; wrap(() => { x.fillStyle = lg(x, cx - cw, 0, cx + cw, 0, [[0, [150, 40, 26], 0], [0.5, [170, 50, 30], 0.75], [1, [150, 40, 26], 0]]); x.fillRect(cx - cw, 0, cw * 2, H); }); }
  // bokeh
  for (let i = 0; i < 26; i++) { const bx = r() * w, by = r() * H * 0.6; wrap(() => glow(x, bx, by, 160 + r() * 200, [255, 190, 110], 0.12)); }
  for (let i = 0; i < 90; i++) {
    const bx = r() * w, by = r() * H * 0.7, br = 16 + r() * 60, col = r.pick([[255, 210, 140], [255, 180, 100], [255, 240, 200], [240, 160, 80]]), a = 0.05 + r() * 0.09;
    wrap(() => { x.save(); x.globalCompositeOperation = 'lighter'; const g = x.createRadialGradient(bx, by, 0, bx, by, br); g.addColorStop(0, css(col, a * 0.7)); g.addColorStop(0.85, css(col, a)); g.addColorStop(1, css(col, 0)); x.fillStyle = g; x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill(); x.restore(); });
  }
  return c;
}

/* golden wall of reliefs for the crack shot */
function buildCrackWall() {
  const [c, x] = mkC(W, H), r = RNG(1001);
  vfill(x, 0, 0, W, 860, [[0, [120, 80, 40]], [0.5, [210, 160, 80]], [1, [150, 100, 48]]]);
  for (let gy = 0; gy < 6; gy++) for (let gx = 0; gx < 12; gx++) {
    const px = gx * 165 - 30 + (gy % 2) * 40, py = gy * 150 - 20, pw = 140, ph = 124;
    const kind = Math.floor(hash2(gx, gy) * 3);
    const fr = polyPath([[px, py], [px + pw, py], [px + pw, py + ph], [px, py + ph]]);
    celFill(x, fr, [230, 186, 104], [176, 128, 60], -6, -6); ink(x, fr, [110, 72, 30], 2.5);
    const inn = polyPath([[px + 14, py + 14], [px + pw - 14, py + 14], [px + pw - 14, py + ph - 14], [px + 14, py + ph - 14]]);
    fillP(x, inn, [200, 150, 70]); ink(x, inn, [140, 96, 40], 2);
    x.save(); x.clip(inn);
    if (kind === 0) for (let k = 0; k < 3; k++) { const fx = px + 40 + k * 30; fillP(x, ellPath(fx, py + 50, 10, 12), [240, 200, 120]); fillP(x, crPath([[fx - 16, py + ph], [fx - 12, py + 66], [fx + 12, py + 66], [fx + 16, py + ph]]), [226, 176, 90]); }
    else if (kind === 1) { x.strokeStyle = css([150, 104, 44], 0.8); x.lineWidth = 2; for (let k = 0; k < 6; k++) { x.beginPath(); x.moveTo(px + 26, py + 34 + k * 12); for (let j = 0; j < 8; j++) x.lineTo(px + 26 + j * 12, py + 34 + k * 12 + (j % 2) * 3); x.stroke(); } }
    else { x.fillStyle = css([246, 206, 120]); x.beginPath(); for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU, rr = i % 2 ? 30 : 38; x.lineTo(px + pw / 2 + Math.cos(a) * rr, py + ph / 2 + Math.sin(a) * rr); } x.fill(); x.strokeStyle = css([140, 96, 40]); x.stroke(); }
    x.restore();
  }
  // floor
  vfill(x, 0, 860, W, 220, [[0, [190, 140, 80]], [1, [70, 44, 26]]]);
  x.save(); x.globalAlpha = 0.3; x.translate(0, 1720); x.scale(1, -1); x.drawImage(c, 0, 0, W, 860, 0, 0, W, 860); x.restore();
  x.strokeStyle = css([90, 60, 30]); x.lineWidth = 4; x.beginPath(); x.moveTo(0, 860); x.lineTo(W, 860); x.stroke();
  return c;
}
