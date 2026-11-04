/* ===================== shot timeline ===================== */
function grade(ctx, col, a, op = 'multiply') { if (a <= 0) return; ctx.save(); ctx.globalCompositeOperation = op; ctx.globalAlpha = clamp(a); ctx.fillStyle = css(col); ctx.fillRect(0, 0, W, H); ctx.restore(); }
function zoomAbout(ctx, s, cx, cy) { ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); }
/* turn the current frame (inside an optional clip) into gilded relief */
function goldify(ctx, amt, clip) {
  if (amt <= 0) return;
  ctx.save(); if (clip) ctx.clip(clip);
  grade(ctx, [128, 128, 128], 0.9 * amt, 'saturation');
  grade(ctx, [255, 200, 116], amt, 'multiply');
  grade(ctx, [150, 96, 24], 0.55 * amt, 'screen');
  ctx.restore();
}
function glint(ctx, x, y, r, a) {
  if (a <= 0) return;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  soft(ctx, x, y, r * 0.6, [255, 240, 200], a * 0.6);
  ctx.fillStyle = css([255, 250, 230], a);
  ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y, x, y - r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.quadraticCurveTo(x, y, x, y + r); ctx.quadraticCurveTo(x, y, x - r, y); ctx.fill();
  ctx.restore();
}
const LEAF = (() => { const p = new Path2D(); p.moveTo(-10, 0); p.quadraticCurveTo(0, -6, 10, 0); p.quadraticCurveTo(0, 6, -10, 0); return p; })();
/* wind-blown leaves / paper, positions are pure functions of time */
function debris(ctx, T, o) {
  const span = W + 600;
  for (let i = 0; i < o.n; i++) {
    const h = (k) => hash3(i, o.seed, k);
    const sp = o.speed * (0.6 + 0.8 * h(1));
    let x = ((h(2) * span + T * sp) % span) - 300;
    if (o.dir < 0) x = W - x;
    const y = lerp(o.y0, o.y1, h(3)) + Math.sin(T * (1.2 + h(4) * 2) + i) * o.amp + ((x / W) - 0.5) * (o.fall || 0) * (h(5) - 0.3);
    const sz = lerp(o.s0, o.s1, h(6));
    ctx.save(); ctx.translate(x, y); ctx.rotate(T * (2 + h(7) * 5) * (h(8) < 0.5 ? -1 : 1) + i);
    ctx.scale(sz / 10, (sz / 10) * Math.cos(T * (3 + h(9) * 5) + i));
    const paper = o.kind === 'paper' || (o.kind === 'mix' && h(10) < 0.3);
    const col = paper ? o.paper : o.cols[Math.floor(h(11) * o.cols.length)];
    if (paper) { ctx.fillStyle = css(col, o.alpha ?? 1); ctx.fillRect(-9, -11, 18, 22); ctx.strokeStyle = css(scl(col, 0.6), o.alpha ?? 1); ctx.lineWidth = 1.5 * 10 / sz; ctx.strokeRect(-9, -11, 18, 22); }
    else { ctx.fillStyle = css(col, o.alpha ?? 1); ctx.fill(LEAF); ctx.strokeStyle = css(scl(col, 0.5), o.alpha ?? 1); ctx.lineWidth = 1.2 * 10 / sz; ctx.stroke(LEAF); }
    ctx.restore();
  }
}
function dust(ctx, T, o) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < o.n; i++) {
    const h = (k) => hash3(i, o.seed, k);
    const x = (((h(1) * (W + 200) + T * o.vx * (0.5 + h(2))) % (W + 200)) + W + 200) % (W + 200) - 100;
    const y = (((h(3) * (H + 200) + T * o.vy * (0.5 + h(4)) + Math.sin(T * 1.3 + i) * 20) % (H + 200)) + H + 200) % (H + 200) - 100;
    const tw = 0.55 + 0.45 * Math.sin(T * (2 + h(5) * 4) + i * 3);
    const r = lerp(o.s0, o.s1, h(6));
    const c = o.col || [255, 214, 140];
    ctx.fillStyle = css(c, (o.a ?? 0.8) * tw); ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    if (h(7) < 0.2) soft(ctx, x, y, r * 5, c, 0.15 * tw * (o.a ?? 0.8));
  }
  ctx.restore();
}
function confetti(ctx, T, o) {
  for (let i = 0; i < o.n; i++) {
    const h = (k) => hash3(i, o.seed, k);
    const fallT = (T * (o.vy * (0.6 + 0.6 * h(1))) + h(2) * (H + 100)) % (H + 100) - 50;
    const x = h(3) * W + Math.sin(T * (1 + h(4)) + i) * 30;
    ctx.save(); ctx.translate(x, fallT); ctx.rotate(T * 3 * (h(5) - 0.5) + i);
    ctx.scale(1, Math.cos(T * (4 + h(6) * 4) + i));
    const c = h(7) < 0.5 ? [255, 214, 120] : [255, 240, 200];
    ctx.fillStyle = css(c, o.a ?? 0.9); ctx.fillRect(-o.s / 2, -o.s / 3, o.s, o.s * 0.66);
    ctx.restore();
  }
}
const NIGHT = [124, 138, 196];

/* -------------------- shot renderers: (ctx, lt, T, f, tq) -------------------- */
function shotAlleyOpen(ctx, lt, T, f, tq) {
  const off = lerp(0, ALLEY.CH - H, E.ioC(inv(0.6, 5.4, lt)));
  const push = 1 + 0.05 * E.io(inv(4.6, 7.2, lt));
  ctx.save(); zoomAbout(ctx, push, 960, 560);
  ctx.drawImage(BG.alley, 0, -off);
  const Z = 6.2, feet = aP(0, 0, Z), k = (ALLEY.F * 1.75) / Z / 600;
  ctx.save(); ctx.translate(feet[0], feet[1] - off); ctx.scale(k, k);
  softE(ctx, 0, 0, 120, 18, [0, 0, 0], 0.5);
  const lookUp = E.io(inv(5.2, 6.6, lt));
  drawManFrontal(ctx, { pal: makePal(0, NIGHT, [10, 6, 0]), s: k, lw: 1.6, t: tq, wind: 0.6 + 0.4 * gust(T), look: [0.2, lerp(0, -1, lookUp)], headTilt: -0.05 * lookUp });
  ctx.restore();
  ctx.restore();
  debris(ctx, T, { n: 34, seed: 11, speed: 520, y0: 80, y1: 1000, amp: 60, s0: 7, s1: 20, kind: 'mix', cols: [[120, 96, 66], [96, 80, 60], [140, 110, 70]], paper: [176, 182, 206], fall: 200 });
}
function shotFaceUp(ctx, lt, T, f, tq) {
  const push = 1 + 0.03 * lt / 3;
  ctx.save(); zoomAbout(ctx, push, 960, 540);
  ctx.drawImage(BG.skyFace, 0, 0);
  ctx.save(); ctx.translate(840, 600); ctx.rotate(-0.16); ctx.scale(2.0, 2.0);
  drawHeadQ(ctx, { pal: makePal(0, [176, 186, 228], [6, 6, 12]), s: 2.0, lw: 3.2, t: tq + 7, wind: 0.7 + 0.5 * gust(T), look: [-0.2, -0.85], rim: [200, 214, 255], blink: lt > 1.6 && lt < 1.75 ? 1 : 0 });
  ctx.restore();
  ctx.restore();
  debris(ctx, T, { n: 10, seed: 21, speed: 900, y0: 100, y1: 1000, amp: 80, s0: 26, s1: 60, kind: 'leaf', cols: [[90, 74, 56], [110, 86, 60]], paper: [180, 180, 200], fall: 300 });
}
function shotHandMoon(ctx, lt, T, f, tq) {
  ctx.drawImage(BG.skyMoon, 0, 0);
  const rise = E.outC(inv(0, 0.9, lt));
  const curl = lt < 1.3 ? 0 : lt < 1.9 ? E.io(inv(1.3, 1.9, lt)) : lt < 2.4 ? 1 : lerp(1, 0.25, E.io(inv(2.4, 2.9, lt)));
  const tc = Math.floor((lt * FPS) / 2) * 2 / FPS;
  const cq = tc < 1.3 ? 0 : tc < 1.9 ? E.io(inv(1.3, 1.9, tc)) : tc < 2.4 ? 1 : lerp(1, 0.25, E.io(inv(2.4, 2.9, tc)));
  ctx.save(); ctx.translate(980 + Math.sin(tq * 3) * 4, lerp(1500, 760, rise)); ctx.rotate(-0.12); ctx.scale(2.0, 2.0);
  const hp = handSilParts(cq);
  ctx.save(); ctx.translate(-2.5, -2); fillParts(ctx, hp, [190, 205, 255]); ctx.restore();
  fillParts(ctx, hp, [8, 10, 20]);
  ctx.restore();
  // a leaf escaping between the fingers as it opens
  const le = inv(2.4, 3.0, lt);
  if (le > 0) { ctx.save(); ctx.translate(lerp(1000, 1900, E.inQ(le)), lerp(560, 300, le)); ctx.rotate(lt * 6); ctx.scale(3, 3 * Math.cos(lt * 9)); ctx.fillStyle = css([150, 120, 80]); ctx.fill(LEAF); ctx.restore(); }
  debris(ctx, T, { n: 8, seed: 31, speed: 700, y0: 100, y1: 900, amp: 60, s0: 12, s1: 30, kind: 'leaf', cols: [[30, 32, 46]], paper: [30, 32, 46], fall: 100 });
  void curl;
}
function shotKitchen(ctx, lt, T, f, tq) {
  const frozen = 4.0; // lt when time stops
  const push = 1 + 0.04 * E.io(inv(4.5, 7, lt));
  ctx.save(); zoomAbout(ctx, push, 960, 520);
  ctx.drawImage(BG.kitchen, 0, 0);
  // wall clock (stops when gold)
  const ck = [300, 130]; const ts = Math.min(tq, frozen);
  fillP(ctx, ellPath(ck[0], ck[1], 52, 52), [240, 230, 206]); ink(ctx, ellPath(ck[0], ck[1], 52, 52), [90, 60, 40], 5);
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; ctx.fillStyle = css([90, 60, 40]); ctx.fillRect(ck[0] + Math.cos(a) * 42 - 2, ck[1] + Math.sin(a) * 42 - 2, 4, 4); }
  const ha = (a, l, w) => { ctx.strokeStyle = css([60, 40, 30]); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(...ck); ctx.lineTo(ck[0] + Math.cos(a) * l, ck[1] + Math.sin(a) * l); ctx.stroke(); };
  ha(-Math.PI / 2 + 2.3, 26, 5); ha(-Math.PI / 2 + 0.9, 38, 3.5); ha(-Math.PI / 2 + Math.floor(ts) / 60 * TAU + 3.1, 42, 1.5);
  drawFamily(ctx, tq, frozen);
  drawKitchenTable(ctx);
  // steam from the bowls (stops)
  const st = Math.min(lt, frozen);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (const bx of [700, 860, 1060, 1220]) for (let k = 0; k < 4; k++) { const ph = (st * 0.4 + k / 4) % 1; softE(ctx, bx + Math.sin(st * 2 + k + bx) * 14, 680 - ph * 160, 18 + ph * 20, 26 + ph * 20, [255, 240, 220], 0.12 * (1 - ph)); }
  ctx.restore();
  ctx.restore();
  // doorway frame + Jiho's silhouette leaving (foreground)
  ctx.fillStyle = css([24, 14, 10]); ctx.fillRect(0, 0, 150, H); ctx.fillRect(1770, 0, 150, H); ctx.fillRect(0, 0, W, 40);
  const leave = E.inQ(inv(1.8, 3.6, lt));
  if (leave < 1) {
    ctx.save(); ctx.translate(lerp(1440, 2400, leave), 1300); ctx.scale(1.75, 1.75);
    drawManFrontal(ctx, { pal: makePal(0.05), s: 1.75, back: true, t: tq, wind: 0.1, walk: lt > 1.8 ? lt * 0.9 : null, sil: [28, 18, 14] });
    ctx.restore();
  }
  // the golden freeze
  const g = E.io(inv(frozen, frozen + 1.4, lt));
  if (g > 0) {
    const wx = lerp(-300, W + 300, g);
    const clip = new Path2D(); clip.rect(0, 0, wx, H);
    goldify(ctx, 1, clip);
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lg(ctx, wx - 260, 0, wx + 60, 0, [[0, [255, 220, 150], 0], [0.85, [255, 236, 190], 0.5], [1, [255, 236, 190], 0]]); ctx.fillRect(wx - 260, 0, 320, H);
    ctx.restore();
    for (let i = 0; i < 14; i++) { const gx = hash2(i, 7) * W, gy = 200 + hash2(i, 8) * 700; if (gx < wx) glint(ctx, gx, gy, 18 + hash2(i, 9) * 26, 0.8 * Math.max(0, Math.sin(lt * 3 + i))); }
  }
}
function shotTent(ctx, lt, T, f, tq) {
  const frozen = 3.0;
  ctx.drawImage(BG.tent, 0, 0);
  const g = E.io(inv(frozen, frozen + 1.0, lt));
  drawTentShadows(ctx, tq, frozen, g);
  // steam above the tent
  const st = Math.min(lt, frozen + 0.3);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 6; k++) { const ph = (st * 0.35 + k / 6) % 1; softE(ctx, 900 + k * 40 + Math.sin(st + k) * 30, 360 - ph * 260, 40 + ph * 50, 50 + ph * 40, [255, 220, 200], 0.08 * (1 - ph)); }
  ctx.restore();
  if (g > 0) {
    const tent = new Path2D(); tent.rect(660, 340, 680, 380);
    goldify(ctx, g, tent);
    for (let i = 0; i < 8; i++) glint(ctx, 720 + hash2(i, 3) * 560, 400 + hash2(i, 4) * 280, 20, g * Math.max(0, Math.sin(lt * 4 + i)));
  }
  // Jiho walking past in the foreground (silhouette, rim lit by the tent)
  const wx = lerp(2300, -500, inv(0.2, 3.0, lt));
  if (wx > -400 && wx < 2300) {
    const pose = gaitSteps(lt * 2.4, 130, 0, 0.6);
    for (const [dx, col] of [[-5, [255, 160, 80]], [4, [255, 150, 70]], [0, [14, 10, 14]]]) {
      ctx.save(); ctx.translate(wx + dx, 1220); ctx.scale(-1.45, 1.45); ctx.translate(-pose.hip[0], 0);
      drawManSide(ctx, { pal: makePal(0.15), s: 1.45, t: tq, pose, lean: 0.05, sil: col, wind: 0.5 });
      ctx.restore();
    }
  }
  debris(ctx, T, { n: 12, seed: 41, speed: 600, y0: 100, y1: 900, amp: 60, s0: 8, s1: 18, kind: 'leaf', cols: [[90, 60, 40], [120, 80, 50]], paper: [150, 140, 150], fall: 200 });
}
function shotMusicBox(ctx, lt, T, f, tq) {
  const frozen = 3.4;
  const push = 1 + 0.07 * E.io(inv(0, 5, lt));
  ctx.save(); zoomAbout(ctx, push, 1050, 600);
  ctx.drawImage(BG.musicbox, 0, 0);
  const spinT = lt < frozen ? lt : frozen + (1 - Math.exp(-(lt - frozen) * 3)) / 3;
  const spin = spinT * 2.4;
  drawMusicBox(ctx, tq, spin, 0);
  const g = E.io(inv(frozen, frozen + 1.0, lt));
  if (g > 0) {
    const wy = lerp(940, 300, g);
    ctx.save(); ctx.beginPath(); ctx.rect(0, wy, W, H); ctx.clip();
    drawMusicBox(ctx, tq, spin, 1);
    ctx.restore();
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lg(ctx, 0, wy - 30, 0, wy + 30, [[0, [255, 230, 170], 0], [0.5, [255, 236, 190], 0.55 * (1 - g * 0.5)], [1, [255, 230, 170], 0]]); ctx.fillRect(600, wy - 30, 800, 60);
    ctx.restore();
    glint(ctx, 1050, 470, 40, Math.max(0, Math.sin((lt - frozen) * 3)) * g);
    glint(ctx, 760, 720, 26, Math.max(0, Math.sin((lt - frozen) * 4 + 1)) * g);
  }
  ctx.restore();
  dust(ctx, T, { n: 50, seed: 51, vx: 10, vy: -14, s0: 1, s1: 2.6, a: 0.5, col: [255, 220, 170] });
}
const STAIR = { T: 96, R: 58 };
function shotStairs(ctx, lt, T, f, tq) {
  const gx = (lt * 50) % 600;
  ctx.drawImage(BG.goldsky, -gx - 200, 0);
  const p = 0.4 + tq * 1.5, k = 0.8;
  const age = lerp(0.12, 0.48, inv(0, 7, lt));
  const ox = 820, oy = 860;
  drawGoldStairs(ctx, p, ox, oy, k, STAIR.T, STAIR.R, age);
  ctx.save(); ctx.translate(ox, oy); ctx.scale(k, k); ctx.translate(-p * STAIR.T, p * STAIR.R);
  drawManSide(ctx, { pal: makePal(age, [255, 222, 176], [8, 4, 0]), s: k, t: tq, pose: gaitSteps(p, STAIR.T, STAIR.R), lean: lerp(0.2, 0.32, inv(0, 7, lt)), wind: 0.8 + 0.3 * gust(T), coatWind: 1.3 });
  ctx.restore();
  dust(ctx, T, { n: 80, seed: 61, vx: -260, vy: 30, s0: 1, s1: 3.2, a: 0.7 });
  grade(ctx, [255, 200, 140], 0.12, 'screen');
}
function shotGates(ctx, lt, T, f, tq) {
  const tilt = lerp(60, 0, E.io(inv(0, 4, lt)));
  const push = 1 + 0.06 * E.io(inv(0, 4, lt));
  ctx.save(); zoomAbout(ctx, push, 960, 250); ctx.translate(0, tilt);
  ctx.drawImage(BG.gates, 0, 0);
  const open = E.ioC(inv(1.3, 3.0, lt));
  drawGateDoors(ctx, open);
  // the tiny climber
  const cy = lerp(700, 660, inv(0, 4, lt));
  ctx.save(); ctx.translate(960, cy); ctx.scale(0.12, 0.12);
  drawManFrontal(ctx, { pal: makePal(0.5), s: 0.12, back: true, t: tq, walk: lt * 0.8, sil: [30, 20, 14], wind: 0.6 });
  ctx.restore();
  ctx.restore();
  dust(ctx, T, { n: 60, seed: 71, vx: -40, vy: -20, s0: 1, s1: 3, a: 0.6 });
  grade(ctx, [255, 236, 200], E.inQ(inv(3.2, 4.0, lt)) * 0.95, 'screen');
}
function guestsInHall(ctx, tq, opts) {
  const list = [];
  const r = RNG(1212);
  for (let z = 3.2; z < 40; z += 1.15) for (const sx of [-1, 1]) for (const X of [2.1, 2.9, 3.8, 4.8]) {
    if (r() < 0.25) continue;
    list.push({ X: sx * (X + r() * 0.3), Z: z + r() * 0.6, v: r.int(0, 5), ph: r() });
  }
  return list;
}
function drawGuestList(ctx, list, tq, zMin, zMax, mech, flicker) {
  for (const g of list) {
    if (g.Z < zMin || g.Z >= zMax) continue;
    const ft = pP(g.X, 0, g.Z), k = (PAL3.F * 1.7) / g.Z / 455;
    let pose;
    if (mech) pose = Math.floor(tq * 4) % 2 ? 2 : 1;
    else pose = Math.floor(tq * 5.5 + g.ph * 7) % 2 ? 2 : 1;
    blitGuest(ctx, g.v, pose, ft[0], ft[1], k, 0.22, true);
    blitGuest(ctx, g.v, pose, ft[0], ft[1], k);
  }
}
let HALL_GUESTS = null;
function shotPalaceWalk(ctx, lt, T, f, tq) {
  if (!HALL_GUESTS) HALL_GUESTS = guestsInHall();
  const push = 1 + 0.08 * E.io(inv(0, 7, lt));
  ctx.save(); zoomAbout(ctx, push, 960, 480);
  ctx.drawImage(BG.palace, 0, 0);
  for (const z of [44, 32, 24, 16, 10]) { const c = pP(0, 10.5, z); chandelier(ctx, c[0], c[1], 6 / z); }
  const Zj = lerp(2.4, 6.5, inv(0, 7, lt));
  drawGuestList(ctx, HALL_GUESTS, tq, Zj, 99, false);
  const ft = pP(0, 0, Zj), k = (PAL3.F * 1.75) / Zj / 600;
  ctx.save(); ctx.translate(ft[0], ft[1]); ctx.scale(k, k);
  softE(ctx, 0, 0, 110, 16, [60, 20, 10], 0.5);
  drawManFrontal(ctx, { pal: makePal(0.62, [255, 224, 180], [10, 4, 0]), s: k, lw: 2.2, back: true, t: tq, walk: lt * 0.85, wind: 0.25 });
  ctx.restore();
  drawGuestList(ctx, HALL_GUESTS, tq, 0, Zj, false);
  ctx.restore();
  confetti(ctx, T, { n: 70, seed: 81, vy: 120, s: 12 });
  dust(ctx, T, { n: 40, seed: 82, vx: 20, vy: -10, s0: 1, s1: 2.5, a: 0.5 });
  grade(ctx, [255, 230, 190], (1 - E.outQ(inv(0, 1.2, lt))) * 0.95, 'screen');
}
function shotWaltz(ctx, lt, T, f, tq) {
  const off = (lt * 420) % 3840;
  ctx.drawImage(BG.bokeh, -off, 0); ctx.drawImage(BG.bokeh, 3840 - off, 0);
  const crownT = inv(3.4, 4.6, lt);
  const crown = crownT > 0 ? { dy: lerp(-320, 0, E.outC(crownT)), rot: -0.12 } : null;
  const bliss = sstep(4.8, 5.4, lt);
  drawWaltz(ctx, { pal: makePal(0.62, [255, 228, 186], [8, 4, 0]), wpal: makeWomanPal([255, 236, 210], [6, 4, 0]), t: tq, sway: 1, crown, manBlink: bliss, manMouth: 0.6 * bliss, wind: 0.6 });
  if (crownT > 0.9) glint(ctx, 780, 300, 50, Math.max(0, Math.sin((lt - 4.5) * 3)));
  confetti(ctx, T, { n: 40, seed: 91, vy: 90, s: 14, a: 0.8 });
  dust(ctx, T, { n: 50, seed: 92, vx: -200, vy: -10, s0: 1, s1: 3, a: 0.6 });
  grade(ctx, [255, 220, 170], 0.1, 'screen');
}
function flick(T) { const s = Math.floor(T * 12); return 0.55 + 0.45 * (hash2(s, 77) > 0.3 ? 1 : hash2(s, 78)); }
function shotUncannyCrowd(ctx, lt, T, f, tq) {
  ctx.drawImage(BG.bokeh, 900, 0, 1920, 1080, 0, 0, W, H);
  const fl = flick(T);
  grade(ctx, [0, 0, 0], 0.35 * (1 - fl) + 0.2, 'source-over');
  const rows = [[0.62, 760, 230, 0], [0.8, 880, 300, 1], [1.05, 1040, 380, 2]];
  const step = Math.floor(lt * 4) % 2 ? 2 : 1; // perfectly synchronised, stepped
  const bob = Math.floor(lt * 4) % 2 ? 6 : 0;
  for (const [k, y, gap, ri] of rows) {
    for (let i = -1; i < 9; i++) blitGuest(ctx, (i + ri * 2 + 12) % 6, step, 960 + (i - 3.5) * gap + (ri % 2) * gap / 2, y + bob * k, k);
  }
  const drain = inv(0, 3, lt);
  grade(ctx, [128, 128, 128], 0.5 * drain, 'saturation');
  grade(ctx, [200, 170, 110], 0.5, 'multiply');
  grade(ctx, [255, 230, 180], 0.08 * fl, 'screen');
}
function shotWomanFace(ctx, lt, T, f, tq) {
  ctx.drawImage(BG.bokeh, 2000, 0, 1920, 1080, 0, 0, W, H);
  const fl = flick(T + 0.3);
  grade(ctx, [40, 30, 20], 0.5, 'source-over');
  const push = 1 + 0.06 * lt / 3;
  ctx.save(); zoomAbout(ctx, push, 960, 480);
  ctx.translate(960, 500); ctx.scale(2.5, 2.5);
  drawHeadFront(ctx, { pal: makeWomanPal(mix([255, 236, 210], [220, 214, 210], inv(0, 3, lt)), [6, 6, 6]), kind: 'woman', bust: true, s: 2.5, lw: 3.4, t: 0, wind: 0.2, smile: 1, porcelain: 0.3 + 0.7 * inv(0, 2, lt), glassy: inv(0.3, 1.5, lt), crack: E.outQ(inv(1.9, 2.6, lt)), look: [0, 0] });
  ctx.restore();
  grade(ctx, [128, 128, 128], 0.35, 'saturation');
  grade(ctx, [200, 180, 140], 0.35, 'multiply');
  grade(ctx, [0, 0, 0], (1 - fl) * 0.35, 'source-over');
}
function crackPath() {
  if (crackPath.c) return crackPath.c;
  const r = RNG(4242); const main = []; let x = 960, y = 880;
  while (y > -20) { main.push([x, y]); y -= 30 + r() * 40; x += (r() - 0.5) * 70; }
  const branches = [];
  for (let i = 2; i < main.length - 1; i += 2) { const b = [main[i]]; let bx = main[i][0], by = main[i][1]; const dir = r.sign(); for (let k = 0; k < 4; k++) { bx += dir * (30 + r() * 50); by += (r() - 0.6) * 50; b.push([bx, by]); } branches.push(b); }
  crackPath.c = { main, branches };
  return crackPath.c;
}
function shotCrack(ctx, lt, T, f, tq) {
  const shake = lt > 0.2 && lt < 1.4 ? (1 - inv(0.2, 1.4, lt)) * 14 : 0;
  ctx.save(); ctx.translate((hash1(f * 3) - 0.5) * shake, (hash1(f * 5 + 1) - 0.5) * shake);
  ctx.drawImage(BG.crackwall, 0, 0);
  const cp = crackPath(), grow = E.outC(inv(0.2, 1.0, lt)), open = E.ioC(inv(1.0, 2.6, lt));
  const n = Math.max(2, Math.floor(cp.main.length * grow));
  // the gap
  if (open > 0) {
    const left = [], right = [];
    for (let i = 0; i < n; i++) { const [px, py] = cp.main[i]; const wdt = open * 26 * Math.sin((i / cp.main.length) * Math.PI + 0.3); left.push([px - wdt, py]); right.push([px + wdt, py]); }
    const gap = polyPath([...left, ...right.reverse()]);
    fillP(ctx, gap, [255, 190, 110]);
    glow(ctx, 960, 450, 300 + 500 * open, [255, 170, 80], 0.3 * open);
  }
  ctx.strokeStyle = css([60, 30, 10]); ctx.lineWidth = 4; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(...cp.main[0]); for (let i = 1; i < n; i++) ctx.lineTo(...cp.main[i]); ctx.stroke();
  ctx.lineWidth = 2.5;
  for (const b of cp.branches) { const bi = cp.main.indexOf(b[0]); if (bi >= n) continue; const m = Math.max(1, Math.floor(b.length * inv(bi / cp.main.length, 1, grow))); ctx.beginPath(); ctx.moveTo(...b[0]); for (let i = 1; i < m; i++) ctx.lineTo(...b[i]); ctx.stroke(); }
  // spilling memories
  const items = 26;
  for (let i = 0; i < items; i++) {
    const h = (k) => hash3(i, 99, k);
    const t0 = 1.3 + h(1) * 3.2, u = lt - t0;
    if (u < 0) continue;
    const sy = 200 + h(2) * 600, vx = (h(3) - 0.5) * 500, g = 900;
    let x = 960 + vx * u, y = sy + 0.5 * g * u * u;
    let rot = u * (h(4) - 0.5) * 8;
    if (y > 900 + h(5) * 120) { const tl = Math.sqrt(2 * (900 + h(5) * 120 - sy) / g); const us = u - tl; y = 900 + h(5) * 120 + us * 60; x = 960 + vx * tl + vx * 0.5 * (1 - Math.exp(-us * 2)); rot = tl * (h(4) - 0.5) * 8; }
    const kind = Math.floor(h(6) * 4);
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); const sc = 0.8 + (y - 200) / 900;
    ctx.scale(sc, sc);
    if (kind === 0) drawPhoto(ctx, 70, 86, 1.6, 1, i);
    else if (kind === 1) { ctx.fillStyle = css([248, 236, 210]); ctx.fillRect(-36, -26, 72, 52); ctx.strokeStyle = css([150, 120, 90]); ctx.lineWidth = 1.5; ctx.strokeRect(-36, -26, 72, 52); ctx.beginPath(); ctx.moveTo(-36, -26); ctx.lineTo(0, 4); ctx.lineTo(36, -26); ctx.stroke(); }
    else if (kind === 2) { ctx.fillStyle = css([220, 176, 90]); ctx.beginPath(); for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, rr = k % 2 ? 16 : 21; ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } ctx.fill(); ctx.strokeStyle = css([110, 72, 30]); ctx.lineWidth = 1.5; ctx.stroke(); fillP(ctx, ellPath(0, 0, 5, 5), [110, 72, 30]); }
    else { ctx.scale(0.8, 0.8); drawBallerina(ctx, 1.4, 0.2); }
    ctx.restore();
  }
  // dust burst
  if (lt > 0.2) dust(ctx, T, { n: 90, seed: 101, vx: (hash1(1) - 0.5) * 80, vy: 60, s0: 1, s1: 3.4, a: 0.7 * (1 - inv(2, 6, lt)) });
  // Jiho watching, small, back to us
  ctx.save(); ctx.translate(1500, 1060); ctx.scale(0.62, 0.62);
  drawManFrontal(ctx, { pal: makePal(0.65), s: 0.62, back: true, t: tq, wind: 0.2, sil: [40, 24, 14] });
  ctx.restore();
  ctx.restore();
  grade(ctx, [128, 128, 128], 0.35, 'saturation');
  grade(ctx, [220, 190, 150], 0.3, 'multiply');
}
function shotHandsHold(ctx, lt, T, f, tq) {
  ctx.drawImage(BG.musicbox, 0, 0); grade(ctx, [70, 40, 20], 0.55, 'source-over');
  const push = 1 + 0.05 * lt / 2.5;
  ctx.save(); zoomAbout(ctx, push, 960, 600);
  ctx.translate(960, 600); ctx.scale(1.85, 1.85);
  drawHandsUp(ctx, { pal: makePal(0.65, [255, 214, 170], [6, 2, 0]), s: 1.85, t: tq, tremble: 1, curl: 0.3 });
  ctx.save(); ctx.translate(-120, -10); ctx.rotate(-0.18); drawPhoto(ctx, 130, 160, 2, 1); ctx.restore();
  ctx.save(); ctx.translate(120, 40); ctx.scale(1.5, 1.5); drawBallerina(ctx, 1.6, 0.4); ctx.restore();
  ctx.restore();
  glow(ctx, 300, 200, 700, [255, 170, 80], 0.12);
}
function shotTear(ctx, lt, T, f, tq) {
  ctx.drawImage(BG.musicbox, 0, 0); grade(ctx, [60, 34, 18], 0.6, 'source-over');
  ctx.save(); ctx.translate(980, 520); ctx.rotate(0.12); ctx.scale(2.1, 2.1);
  drawHeadQ(ctx, { pal: makePal(0.66, [255, 214, 176], [6, 2, 0]), s: 2.1, lw: 3.2, t: tq, wind: 0.15, look: [-0.5, 0.7], brow: 1, mouth: -0.6, tear: inv(0.5, 2.5, lt), rim: [255, 190, 110] });
  ctx.restore();
  glow(ctx, 200, 300, 600, [255, 170, 80], 0.15);
  dust(ctx, T, { n: 30, seed: 111, vx: 30, vy: -20, s0: 1, s1: 2.5, a: 0.5 });
}
let DISSOLVE = null;
function shotLastDance(ctx, lt, T, f, tq) {
  const off = (lt * lerp(300, 120, inv(0, 8, lt)) + 1200) % 3840;
  ctx.drawImage(BG.bokeh, -off, 0); ctx.drawImage(BG.bokeh, 3840 - off, 0);
  const dark = E.io(inv(2.5, 6.0, lt));
  grade(ctx, [6, 4, 8], 0.35 + 0.65 * dark, 'source-over');
  const dis = inv(1.3, 5.6, lt);
  const crownFall = inv(6.2, 7.2, lt);
  const crown = { dy: E.inQ(crownFall) * 700, rot: -0.12 - crownFall * 2.5 };
  const pal = makePal(lerp(0.65, 0.85, inv(4, 8, lt)), mix([255, 226, 180], [190, 180, 190], dark), [4, 2, 0]);
  const wpal = makeWomanPal([255, 236, 210], [8, 6, 0]);
  const base = { pal, wpal, t: tq, sway: lerp(1, 0.5, dark), crown, wind: 0.5, manBlink: 1 };
  // the woman into a buffer, eaten away by gold dust
  if (dis < 1) {
    if (!DISSOLVE) DISSOLVE = mkC(W, H);
    const [bc, bx] = DISSOLVE;
    bx.setTransform(1, 0, 0, 1, 0, 0); bx.clearRect(0, 0, W, H);
    bx.save(); bx.translate(Math.sin(tq * 1.9) * 14, 0); drawWomanDance(bx, base); bx.restore();
    if (dis > 0) {
      const gld = clamp(dis * 2.2);
      bx.globalCompositeOperation = 'source-atop';
      bx.fillStyle = css([255, 200, 110], 0.75 * gld); bx.fillRect(0, 0, W, H);
      bx.globalCompositeOperation = 'destination-out';
      const holes = new Path2D();
      for (let i = 0; i < 4200; i++) { const hx_ = 820 + hash2(i, 1) * 1000, hy = 260 + hash2(i, 2) * 860; const th = (1 - (hx_ - 820) / 1000) * 0.78 + hash2(i, 3) * 0.22; if (th < dis) { const rr = 5 + 22 * inv(th, th + 0.08, dis); holes.moveTo(hx_ + rr, hy); holes.arc(hx_, hy, rr, 0, TAU); } }
      bx.fill(holes);
      bx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1 - E.inQ(dis); ctx.drawImage(bc, 0, 0); ctx.globalAlpha = 1;
  }
  drawWaltz(ctx, Object.assign({}, base, { drawWoman: false }));
  // particles streaming off her
  if (dis > 0 && dis < 1.3) dust(ctx, T, { n: 160, seed: 121, vx: 140, vy: -90, s0: 1.2, s1: 4, a: 0.9 * Math.sin(Math.min(1, dis) * Math.PI) + 0.2 });
  dust(ctx, T, { n: 40, seed: 122, vx: 60, vy: -40, s0: 1, s1: 2.5, a: 0.4 });
  // top light on him
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lg(ctx, 0, 0, 0, H, [[0, [255, 210, 150], 0.12 * dark], [1, [255, 210, 150], 0]]); ctx.beginPath(); ctx.moveTo(620, 0); ctx.lineTo(1000, 0); ctx.lineTo(1100, H); ctx.lineTo(520, H); ctx.fill(); ctx.restore();
}
function shotOldHands(ctx, lt, T, f, tq) {
  vfill(ctx, 0, 0, W, H, [[0, [24, 20, 26]], [1, [4, 4, 8]]]);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = lg(ctx, 0, 0, 0, H, [[0, [220, 200, 170], 0.14], [1, [220, 200, 170], 0]]); ctx.beginPath(); ctx.moveTo(700, 0); ctx.lineTo(1220, 0); ctx.lineTo(1400, H); ctx.lineTo(520, H); ctx.fill(); ctx.restore();
  const push = 1 + 0.05 * lt / 4;
  ctx.save(); zoomAbout(ctx, push, 960, 540);
  const P = makePal(1, [200, 196, 206], [4, 4, 8]);
  ctx.save(); ctx.translate(960, 830); ctx.scale(0.95, 0.95);
  // shoulders behind
  const sh = crPath([[-420, 400, 1], [-380, -60], [-200, -200], [200, -200], [380, -60], [420, 400, 1]]); celFill(ctx, sh, P.coat, P.coatS, -30, -10); ink(ctx, sh, P.line, 3);
  ctx.restore();
  ctx.save(); ctx.translate(960, 410); ctx.rotate(0.02); ctx.scale(1.25, 1.25);
  drawHeadFront(ctx, { pal: P, s: 1.25, lw: 3, t: tq, wind: 0.4, look: [0, 1], blink: 0.6, brow: 0.8, smile: -0.4 });
  ctx.restore();
  ctx.save(); ctx.translate(960, 880); ctx.scale(1.15, 1.15);
  drawHandsUp(ctx, { pal: P, s: 1.15, t: tq, tremble: 0.6, curl: 0.35 });
  ctx.restore();
  ctx.restore();
  dust(ctx, T, { n: 60, seed: 131, vx: 160, vy: -60, s0: 1, s1: 3, a: 0.8 * (1 - inv(1, 4, lt)) });
}
function shotRuinWalk(ctx, lt, T, f, tq) {
  const off = ALLEY.CH - H;
  ctx.drawImage(BG.ruin, 0, -off);
  const Z = lerp(3.6, 13, inv(0.3, 6, lt)), ft = aP(0.2, 0, Z), k = (ALLEY.F * 1.65) / Z / 600;
  ctx.save(); ctx.translate(ft[0], ft[1] - off); ctx.scale(k, k);
  drawManFrontal(ctx, { pal: makePal(1, [150, 158, 196], [6, 8, 16]), s: k, lw: 2, back: true, t: tq, walk: lt * 0.6, wind: 0.8, windDir: 1, stoop: 1 });
  ctx.restore();
  debris(ctx, T, { n: 22, seed: 141, speed: 420, y0: 300, y1: 1050, amp: 50, s0: 6, s1: 16, kind: 'mix', cols: [[40, 40, 46], [56, 52, 50]], paper: [70, 72, 84], fall: 100 });
  dust(ctx, T, { n: 40, seed: 142, vx: 200, vy: 10, s0: 1, s1: 2, a: 0.25, col: [160, 170, 200] });
  grade(ctx, [46, 58, 92], 0.35, 'screen');
}

/* -------------------- timeline -------------------- */
const SHOTS = [
  { t0: 0, t1: 7, fn: shotAlleyOpen },
  { t0: 7, t1: 10, fn: shotFaceUp },
  { t0: 10, t1: 13, fn: shotHandMoon },
  { t0: 13, t1: 20, fn: shotKitchen, xin: 0.8 },
  { t0: 20, t1: 25, fn: shotTent, xin: 0.7 },
  { t0: 25, t1: 30, fn: shotMusicBox, xin: 0.7 },
  { t0: 30, t1: 37, fn: shotStairs, xin: 0.9 },
  { t0: 37, t1: 41, fn: shotGates },
  { t0: 41, t1: 48, fn: shotPalaceWalk },
  { t0: 48, t1: 56, fn: shotWaltz, xin: 0.6 },
  { t0: 56, t1: 59, fn: shotUncannyCrowd },
  { t0: 59, t1: 62, fn: shotWomanFace },
  { t0: 62, t1: 68, fn: shotCrack },
  { t0: 68, t1: 70.5, fn: shotHandsHold, xin: 0.5 },
  { t0: 70.5, t1: 73, fn: shotTear },
  { t0: 73, t1: 81, fn: shotLastDance, xin: 0.8 },
  { t0: 81, t1: 85, fn: shotOldHands, xin: 1.0 },
  { t0: 85, t1: 91, fn: shotRuinWalk },
];
let XBUF = null;
function drawShot(ctx, i, T, f) {
  const s = SHOTS[i], lt = T - s.t0;
  const tq = Math.floor(f / 2) * 2 / FPS - s.t0;
  ctx.save(); s.fn(ctx, lt, T, f, tq); ctx.restore();
}
function blackLevel(T) {
  return Math.max(1 - inv(0, 1.4, T), inv(84.5, 85.0, T) * (1 - inv(85.0, 85.7, T)), inv(88.6, 91, T));
}
function renderFrame(ctx, f) {
  const T = f / FPS;
  let i = SHOTS.findIndex((s) => T >= s.t0 && T < s.t1);
  if (i < 0) i = SHOTS.length - 1;
  drawShot(ctx, i, T, f);
  const s = SHOTS[i];
  if (s.xin && T < s.t0 + s.xin && i > 0) {
    if (!XBUF) XBUF = mkC(W, H);
    const [bc, bx] = XBUF; bx.setTransform(1, 0, 0, 1, 0, 0); bx.globalAlpha = 1; bx.globalCompositeOperation = 'source-over';
    drawShot(bx, i - 1, T, f);
    ctx.save(); ctx.globalAlpha = 1 - E.io(inv(s.t0, s.t0 + s.xin, T)); ctx.drawImage(bc, 0, 0); ctx.restore();
  }
  const b = blackLevel(T);
  if (b > 0) grade(ctx, [0, 0, 0], b, 'source-over');
}
