/* ===================== 3/4 close-up head (faces screen-left) =====================
   local units: eye line y=0, chin y~104, crown y~-140. caller sets transform. */
function drawHeadQ(ctx, o) {
  const P = o.pal, s = o.s || 1, lw = (o.lw || 3.0) / s, age = P.age ?? 0;
  const t = o.t || 0, wind = o.wind ?? 0.6;
  const L = o.light || [-9, -7];
  const look = o.look || [0, 0];
  const gaunt = clamp((age - 0.5) * 2);

  /* ---- shoulders / coat / shirt / neck / collar ---- */
  const body = o.body !== false;
  if (body) {
    const coat = crPath([[-40, 150], [-140, 188], [-236, 236, 1], [-290, 560, 1], [320, 560, 1], [280, 236, 1], [190, 186], [86, 142]]);
    celFill(ctx, coat, P.coat, P.coatS, -40, -10); ink(ctx, coat, P.line, lw);
    const sh = crPath([[-44, 170, 1], [64, 162, 1], [76, 300], [70, 560, 1], [-46, 560, 1], [-56, 300]]);
    celFill(ctx, sh, P.shirt, P.shirtS, -14, -6); ink(ctx, sh, P.line, lw);
  }
  const neck = crPath([[-24, 86], [-26, 130], [-28, 172, 1], [4, 244, 1], [44, 168, 1], [54, 120], [58, 60]]);
  fillP(ctx, neck, P.skin);
  shadeIn(ctx, neck, crPath([[-40, 80], [70, 40], [70, 140], [10, 122], [-40, 108]]), P.skinS);
  shadeIn(ctx, neck, crPath([[20, 150], [60, 150], [60, 260], [10, 250]]), P.skinS, 0.8);
  ink(ctx, neck, P.line, lw);
  if (body) {
    const ad = new Path2D(); ad.moveTo(-12, 128); ad.quadraticCurveTo(-18, 138, -14, 150); ink(ctx, ad, P.lineSoft, lw * 0.6);
    const cv = new Path2D(); cv.moveTo(-6, 196); cv.quadraticCurveTo(2, 202, 12, 196); ink(ctx, cv, P.lineSoft, lw * 0.5);
    const colL = crPath([[-24, 146, 1], [-60, 172], [-50, 228, 1], [2, 246, 1], [-28, 178]]);
    celFill(ctx, colL, P.shirt, P.shirtS, -6, -4); ink(ctx, colL, P.line, lw);
    const colR = crPath([[50, 142, 1], [88, 168], [84, 222, 1], [8, 246, 1], [44, 172]]);
    celFill(ctx, colR, P.shirt, P.shirtS, -6, -4); ink(ctx, colR, P.line, lw);
    const lapL = crPath([[-42, 156, 1], [-114, 214], [-126, 330], [-70, 560, 1], [-44, 380], [-52, 240]]);
    celFill(ctx, lapL, P.coatH, P.coat, -14, 0); ink(ctx, lapL, P.line, lw);
    const lapR = crPath([[88, 150, 1], [156, 210], [158, 320], [104, 560, 1], [80, 380], [84, 240]]);
    celFill(ctx, lapR, P.coat, P.coatS, -10, 0); ink(ctx, lapR, P.line, lw);
  }
  /* ---- ear ---- */
  const ear = crPath([[58, -6], [74, -16], [86, -4], [86, 18], [76, 34], [62, 36]]);
  celFill(ctx, ear, P.skin, P.skinS, -5, -3); ink(ctx, ear, P.line, lw);
  const earIn = new Path2D(); earIn.moveTo(78, -4); earIn.quadraticCurveTo(70, 6, 76, 18); earIn.quadraticCurveTo(72, 24, 66, 22);
  ink(ctx, earIn, P.lineSoft, lw * 0.7);

  /* ---- face ---- */
  const cheek = lerp(0, 5, gaunt);
  const face = crPath([
    [-18, -112], [-56, -88], [-68, -50], [-66, -16], [-72 + cheek * 0.3, 6], [-66 + cheek, 34],
    [-54, 66], [-38, 92], [-24, 104], [-4, 104], [24, 88], [50, 66], [64, 46], [70, 20], [74, -20], [66, -70], [36, -104],
  ]);
  fillP(ctx, face, P.skin);
  ctx.save(); ctx.clip(face);
  // shading: jaw side and under the hairline
  fillP(ctx, crPath([[96, -40], [70, 60], [40, 90], [6, 112], [80, 140], [120, 40]]), P.skinS);
  fillP(ctx, crPath([[-90, -70], [-40, -50], [20, -60], [60, -40], [90, -60], [90, -140], [-90, -140]]), P.skinS);
  // cheekbone shadow (aging / gaunt)
  if (gaunt > 0) fillP(ctx, crPath([[-60, 30], [-44, 50], [-10, 66], [-30, 40]]), P.skinS, gaunt * 0.7);
  // blush
  if (o.blush) { softE(ctx, -50, 36, 20, 9, P.blush, 0.35 * o.blush); softE(ctx, 6, 36, 26, 11, P.blush, 0.3 * o.blush); }
  // rim light on the far contour
  if (o.rim) { ctx.strokeStyle = css(o.rim, 0.85); ctx.lineWidth = lw * 2.2; ctx.stroke(crPath([[-56, -88], [-68, -50], [-66, -16], [-72, 6], [-66, 34], [-54, 66], [-38, 92]], false)); }
  ctx.restore();
  ink(ctx, face, P.line, lw);

  /* ---- eyes ---- */
  const bl = clamp(o.blink || 0);
  eyeQ(ctx, P, lw, { x: 2, y: 4, w: 46, open: 1 - bl, look, near: true, age, tearLine: o.tear > 0 });
  eyeQ(ctx, P, lw, { x: -52, y: 4, w: 24, open: 1 - bl, look, near: false, age });
  // brows
  const br = o.brow || 0; // >0 = raised (sad), <0 = frown
  const bn = crPath([[-16, -22 - br * 4], [6, -30 - br * 2], [32, -24 + br * 4], [30, -19 + br * 4], [6, -24 - br * 2], [-14, -16 - br * 4]]);
  fillP(ctx, bn, P.hairS); ink(ctx, bn, P.line, lw * 0.5);
  const bf = crPath([[-44, -20 - br * 4], [-54, -25 - br * 3], [-64, -20 + br * 2], [-62, -17 + br * 2], [-54, -20 - br * 3], [-44, -15 - br * 4]]);
  fillP(ctx, bf, P.hairS); ink(ctx, bf, P.line, lw * 0.5);
  /* ---- nose ---- */
  const nose = new Path2D(); nose.moveTo(-34, 8); nose.bezierCurveTo(-38, 22, -48, 32, -54, 40); nose.quadraticCurveTo(-52, 46, -42, 45);
  ink(ctx, nose, P.line, lw * 0.8);
  shadeIn(ctx, face, crPath([[-36, 22], [-28, 40], [-36, 46], [-44, 44]]), P.skinS, 0.8);
  const nos = new Path2D(); nos.moveTo(-40, 44); nos.quadraticCurveTo(-36, 41, -33, 43); ink(ctx, nos, P.line, lw * 0.6);
  /* ---- mouth ---- */
  const m = new Path2D();
  const mo = o.mouth || 0; // 0 neutral, >0 slight smile, <0 sad
  m.moveTo(-48, 67 - mo * 2); m.quadraticCurveTo(-34, 69 + mo * 3 - Math.max(0, -mo) * 2, -18, 65 - mo * 4);
  ink(ctx, m, P.line, lw * 0.8);
  if (o.mouthOpen) { const mm = crPath([[-46, 68], [-34, 71 + o.mouthOpen * 8], [-20, 67]], false); ink(ctx, mm, P.lineSoft, lw * 0.6); }
  const lip = new Path2D(); lip.moveTo(-40, 77); lip.lineTo(-30, 77); ink(ctx, lip, P.lineSoft, lw * 0.5);
  /* ---- age lines ---- */
  if (age > 0.25) {
    const a = clamp((age - 0.25) / 0.5);
    const w1 = new Path2D(); w1.moveTo(28, -4); w1.lineTo(36, -9); w1.moveTo(28, 6); w1.lineTo(37, 7); ink(ctx, w1, P.lineSoft, lw * 0.5, a);
    const fold = new Path2D(); fold.moveTo(-36, 50); fold.quadraticCurveTo(-28, 60, -16, 78); ink(ctx, fold, P.lineSoft, lw * 0.55, a * 0.8);
    const fh = new Path2D(); fh.moveTo(-30, -48); fh.quadraticCurveTo(0, -54, 30, -48); fh.moveTo(-24, -40); fh.quadraticCurveTo(0, -45, 22, -40); ink(ctx, fh, P.lineSoft, lw * 0.45, a * 0.7);
    const bag = new Path2D(); bag.moveTo(-14, 22); bag.quadraticCurveTo(4, 30, 20, 20); ink(ctx, bag, P.lineSoft, lw * 0.45, a * 0.7);
  }
  if (gaunt > 0) {
    const gl = new Path2D(); gl.moveTo(-58, 44); gl.quadraticCurveTo(-48, 70, -32, 88); gl.moveTo(40, 10); gl.quadraticCurveTo(46, 40, 40, 58);
    ink(ctx, gl, P.lineSoft, lw * 0.5, gaunt * 0.8);
    const fh2 = new Path2D(); fh2.moveTo(-34, -60); fh2.quadraticCurveTo(0, -66, 34, -60); ink(ctx, fh2, P.lineSoft, lw * 0.45, gaunt * 0.7);
  }
  // the mole below the outer corner of the left eye (near eye on this view)
  fillP(ctx, ellPath(30, 22, 2.4, 2.4), scl(P.line, 1.3));

  /* ---- hair ---- */
  drawHairQ(ctx, P, lw, t, wind, age, o.hairSeed || 1);
  /* ---- tear ---- */
  if (o.tear > 0) {
    const tt = clamp(o.tear);
    const ty = lerp(16, 92, E.inQ(tt)), tx = lerp(4, -2, tt);
    ctx.strokeStyle = css([210, 230, 255], 0.55); ctx.lineWidth = lw * 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, 16); ctx.quadraticCurveTo(2, (16 + ty) / 2, tx, ty); ctx.stroke();
    const d = crPath([[tx, ty - 9], [tx + 5, ty + 2], [tx, ty + 6], [tx - 5, ty + 2]]);
    fillP(ctx, d, [215, 235, 255], 0.9); ink(ctx, d, [120, 150, 190], lw * 0.5);
    fillP(ctx, ellPath(tx - 1.5, ty, 1.6, 2.2), [255, 255, 255]);
  }
}

function eyeQ(ctx, P, lw, e) {
  const { x, y, w, near } = e;
  const open = clamp(e.open);
  const hh = (near ? 13 : 11) * open;
  const ix = x - w / 2, ox = x + w / 2;
  const up = near ? [[ix, y + 2, 1], [x - w * 0.05, y - hh - 1], [ox, y - 1, 1]] : [[ox + 2, y + 2, 1], [x + w * 0.1, y - hh], [ix - 2, y - 2, 1]];
  const lo = near ? [[ox - 3, y + 2], [x, y + 3 + hh * 0.55], [ix + 2, y + 3]] : [[ix, y + 1], [x, y + 2 + hh * 0.5], [ox, y + 3]];
  if (open > 0.08) {
    const eyeP = crPath([...up, ...lo]);
    fillP(ctx, eyeP, P.eyeW);
    ctx.save(); ctx.clip(eyeP);
    const lk = e.look;
    const icx = x + lk[0] * w * 0.22 + (near ? -2 : -1), icy = y + 1 + lk[1] * 6;
    const irx = near ? 10.5 : 6.5, iry = 13;
    fillP(ctx, ellPath(icx, icy, irx, iry), P.iris);
    softE(ctx, icx, icy + 5, irx * 0.8, iry * 0.5, P.irisL, 0.55);
    fillP(ctx, ellPath(icx, icy - 1, irx * 0.48, iry * 0.48), scl(P.iris, 0.5));
    fillP(ctx, ellPath(icx - irx * 0.35, icy - iry * 0.42, near ? 3.2 : 2.2, near ? 3.6 : 2.6), [255, 255, 255]);
    fillP(ctx, ellPath(icx + irx * 0.3, icy + iry * 0.35, 1.4, 1.4), [255, 255, 255], 0.8);
    // lid shadow on the eye white
    fillP(ctx, crPath([[ix - 4, y - 20], [ox + 4, y - 20], [ox + 4, y - hh + 3], [x, y - hh + 5], [ix - 4, y - hh + 4]]), P.skinS, 0.35);
    ctx.restore();
  }
  // upper lid line, thick
  const lid = crPath(up, false);
  ink(ctx, lid, P.line, lw * (near ? 1.9 : 1.6));
  if (open > 0.08) {
    const low = crPath(near ? [[ox - 6, y + 4], [x - 4, y + 4 + hh * 0.55]] : [[ix + 2, y + 3], [x + 2, y + 3 + hh * 0.5]], false);
    ink(ctx, low, P.lineSoft, lw * 0.7);
  }
  // crease
  if (near) {
    const cr = new Path2D(); cr.moveTo(ix + 6, y - hh - 6); cr.quadraticCurveTo(x, y - hh - 10 - (1 - open) * 2, ox - 4, y - hh - 4);
    ink(ctx, cr, P.lineSoft, lw * 0.55, 0.8);
  }
}

/* hair clump: rootA -> bulge -> sharp tip -> bulge -> rootB */
function clump(a, b, tip, bulge = 10, bend = 0) {
  const ax = tip[0] - (a[0] + b[0]) / 2, ay = tip[1] - (a[1] + b[1]) / 2, len = Math.hypot(ax, ay) || 1;
  const nx = -ay / len, ny = ax / len;
  const m1 = [lerp(a[0], tip[0], 0.5) + nx * (bulge + bend), lerp(a[1], tip[1], 0.5) + ny * (bulge + bend)];
  const m2 = [lerp(b[0], tip[0], 0.5) - nx * (bulge - bend), lerp(b[1], tip[1], 0.5) - ny * (bulge - bend)];
  return crPath([[a[0], a[1]], m1, [tip[0], tip[1], 1], m2, [b[0], b[1]]]);
}
function drawHairQ(ctx, P, lw, t, wind, age, seed) {
  const thin = clamp((age - 0.6) / 0.4);
  const w = (i, a) => (Math.sin(t * 6.1 + i * 1.7) * 0.7 + Math.sin(t * 2.3 + i * 0.9) * 0.3) * a * wind;
  const old = thin > 0.5;
  const mass = crPath(!old ? [
    [-60, -40], [-74, -80], [-56, -120], [-14, -150], [40, -156],
    [112 + w(1, 6), -176 + w(2, 8), 1], [96, -134],
    [150 + w(3, 8), -126 + w(4, 9), 1], [112, -98],
    [160 + w(5, 8), -64 + w(6, 8), 1], [114, -50],
    [144 + w(7, 7), -6 + w(8, 7), 1], [104, 2],
    [112 + w(9, 5), 36 + w(10, 5), 1], [82, 24], [68, 10, 1],
    [70, -20], [54, -26], [50, 8, 1], [42, -36], [18, -66], [-24, -70], [-52, -56],
  ] : [
    [-36, -88], [-30, -116], [-2, -138], [42, -144],
    [100 + w(1, 4), -150 + w(2, 5), 1], [90, -122],
    [130 + w(3, 5), -96 + w(4, 6), 1], [106, -74],
    [130 + w(5, 5), -30 + w(6, 5), 1], [104, -16],
    [110 + w(7, 4), 20 + w(8, 4), 1], [84, 22], [68, 10, 1],
    [70, -20], [56, -26], [52, 6, 1], [46, -44], [26, -84], [0, -100], [-20, -98],
  ]);
  celFill(ctx, mass, P.hair, P.hairS, -10, -16);
  ctx.save(); ctx.clip(mass);
  // soft sheen band + strand highlights following the flow toward the back
  ctx.strokeStyle = css(P.hairH, 0.85); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const y0 = -128 + i * 10;
    ctx.lineWidth = lw * (1.4 - i * 0.15);
    ctx.beginPath(); ctx.moveTo(-30 + i * 10, y0 + 12); ctx.bezierCurveTo(0, y0 - 6, 40, y0 - 8, 92 + i * 3, y0 + 14 + i * 3); ctx.stroke();
  }
  ctx.restore();
  ink(ctx, mass, P.line, lw);
  const sl = new Path2D();
  sl.moveTo(96, -134); sl.quadraticCurveTo(60, -130, 30, -118);
  sl.moveTo(112, -98); sl.quadraticCurveTo(80, -96, 50, -90);
  sl.moveTo(114, -50); sl.quadraticCurveTo(90, -56, 70, -56);
  sl.moveTo(104, 2); sl.quadraticCurveTo(92, -10, 84, -16);
  ink(ctx, sl, P.hairS, lw * 0.6, 0.9);
  // front fringe clumps falling over the forehead, nudged back by the wind
  const front = old ? [
    [[-26, -100], [0, -104], [-40 + w(11, 3), -78 + w(12, 3)], 5, 2],
  ] : [
    [[-20, -138], [20, -134], [-66 + w(11, 4), -46 + w(12, 4)], 12, 6],
    [[6, -128], [40, -118], [-34 + w(13, 4), -40 + w(14, 4)], 11, 5],
    [[34, -116], [62, -96], [8 + w(15, 4), -44 + w(16, 3)], 10, 4],
    [[58, -100], [80, -70], [52 + w(17, 3), -34 + w(18, 3)], 8, 3],
  ];
  for (const [a, b, tip, bu, be] of front) { const p = clump(a, b, tip, bu, be); celFill(ctx, p, P.hair, P.hairS, -4, -10); ink(ctx, p, P.line, lw); }
  // shadow the fringe casts on the forehead
}
