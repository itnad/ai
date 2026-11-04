/* ===================== profile / front / back heads (same units as drawHeadQ) ===================== */
/* male profile facing RIGHT */
function drawHeadProfile(ctx, o) {
  const P = o.pal, s = o.s || 1, lw = (o.lw || 3) / s, age = P.age ?? 0, t = o.t || 0, wind = o.wind ?? 0.6;
  const w = (i, a) => (Math.sin(t * 6.3 + i * 1.9) * 0.7 + Math.sin(t * 2.2 + i) * 0.3) * a * wind;
  const old = age > 0.8;
  // neck
  const neck = crPath([[-40, 60], [-46, 150], [40, 150], [36, 96]]);
  fillP(ctx, neck, P.skin); shadeIn(ctx, neck, crPath([[-60, 50], [40, 90], [40, 130], [-60, 140]]), P.skinS); ink(ctx, neck, P.line, lw);
  // skull + face
  const face = crPath([
    [40, -112], [60, -70], [66, -26], [60, -8], [66, 6], [84, 34, 1], [68, 44], [70, 56], [64, 63], [68, 72], [58, 82], [62, 96], [44, 108],
    [14, 102], [-16, 72], [-60, 40], [-92, -20], [-80, -100], [-20, -140],
  ]);
  fillP(ctx, face, P.skin);
  ctx.save(); ctx.clip(face);
  fillP(ctx, crPath([[-120, -10], [-10, 30], [20, 110], [-120, 140]]), P.skinS);
  if (o.blush) softE(ctx, 34, 34, 22, 10, P.blush, 0.3 * o.blush);
  ctx.restore();
  ink(ctx, face, P.line, lw);
  // ear
  const ear = crPath([[-18, -6], [-4, -12], [4, 6], [0, 30], [-12, 40], [-22, 30]]);
  celFill(ctx, ear, P.skin, P.skinS, 3, -3); ink(ctx, ear, P.line, lw);
  // eye (profile)
  const op = 1 - clamp(o.blink || 0);
  if (op > 0.15) {
    const ey = crPath([[34, 2], [46, -8 * op], [56, -3 * op, 1], [52, 6 * op], [40, 7]]);
    fillP(ctx, ey, P.eyeW);
    ctx.save(); ctx.clip(ey); fillP(ctx, ellPath(48 + (o.lookY || 0), 0 + (o.lookY || 0) * 4, 5.5, 10), P.iris); fillP(ctx, ellPath(46, -4, 1.8, 2.4), [255, 255, 255]); ctx.restore();
  }
  const lid = new Path2D(); lid.moveTo(32, 0); lid.quadraticCurveTo(46, -10 * op - 2, 57, -3 * op); ink(ctx, lid, P.line, lw * 1.7);
  const brow = new Path2D(); brow.moveTo(30, -22); brow.quadraticCurveTo(46, -28, 62, -22); ink(ctx, brow, P.hairS, lw * 2.2);
  const mth = new Path2D(); mth.moveTo(64, 64); mth.lineTo(54, 65 + (o.mouth || 0) * -3); ink(ctx, mth, P.line, lw * 0.8);
  if (age > 0.3) { const wr = new Path2D(); wr.moveTo(60, 12); wr.quadraticCurveTo(54, 30, 58, 50); wr.moveTo(26, -2); wr.lineTo(18, 2); ink(ctx, wr, P.lineSoft, lw * 0.6, clamp((age - 0.3) * 2)); }
  // mole: on the far (left) cheek, hidden in right-facing profile; it shows when mirrored
  if (o.mole) fillP(ctx, ellPath(30, 18, 2.6, 2.6), scl(P.line, 1.3));
  // hair: swept back (to the left) by a headwind
  const mass = crPath(!old ? [
    [44, -96], [30, -132], [-10, -156], [-60, -146],
    [-126 + w(1, 8), -150 + w(2, 8), 1], [-92, -118],
    [-144 + w(3, 9), -94 + w(4, 9), 1], [-100, -70],
    [-140 + w(5, 8), -36 + w(6, 8), 1], [-96, -20],
    [-118 + w(7, 6), 18 + w(8, 6), 1], [-70, 18], [-52, -10], [-30, -22], [-20, -16], [-12, -40], [10, -76],
  ] : [
    [20, -124], [-10, -146], [-56, -140],
    [-110 + w(1, 6), -132 + w(2, 6), 1], [-88, -108],
    [-124 + w(3, 6), -70 + w(4, 6), 1], [-96, -50],
    [-118 + w(5, 5), -8 + w(6, 5), 1], [-74, 10], [-56, -12], [-30, -22], [-20, -16], [-20, -60], [-4, -100],
  ]);
  celFill(ctx, mass, P.hair, P.hairS, 6, -14);
  ctx.save(); ctx.clip(mass); ctx.strokeStyle = css(P.hairH, 0.85); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) { ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(20 - i * 8, -126 + i * 12); ctx.quadraticCurveTo(-40, -150 + i * 14, -100, -112 + i * 16); ctx.stroke(); }
  ctx.restore();
  ink(ctx, mass, P.line, lw);
  const sl = new Path2D(); sl.moveTo(-92, -118); sl.quadraticCurveTo(-50, -116, -10, -120); sl.moveTo(-100, -70); sl.quadraticCurveTo(-60, -76, -30, -80); sl.moveTo(-96, -20); sl.quadraticCurveTo(-70, -34, -50, -40);
  ink(ctx, sl, P.hairS, lw * 0.6);
  if (o.crown) drawCrownSide(ctx, lw, o.crown);
}
function drawCrownSide(ctx, lw, c) {
  ctx.save(); ctx.translate(-14, -150 + (c.dy || 0)); ctx.rotate(c.rot || -0.1);
  const p = crPath([[-70, 8, 1], [-64, -22, 1], [-46, -6, 1], [-24, -34, 1], [-4, -8, 1], [18, -36, 1], [36, -8, 1], [56, -26, 1], [62, 10, 1]]);
  celFill(ctx, p, [250, 214, 120], [196, 146, 60], -4, -4); ink(ctx, p, [90, 60, 30], lw);
  ctx.strokeStyle = css([255, 248, 210], 0.9); ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.moveTo(-60, 2); ctx.lineTo(54, 2); ctx.stroke();
  ctx.restore();
}

/* front-facing head (man or woman) */
function drawHeadFront(ctx, o) {
  const P = o.pal, s = o.s || 1, lw = (o.lw || 3) / s, age = P.age ?? 0, t = o.t || 0, wind = o.wind ?? 0.5;
  const woman = o.kind === 'woman';
  const w = (i, a) => (Math.sin(t * 5.7 + i * 1.9) * 0.7 + Math.sin(t * 2.1 + i) * 0.3) * a * wind;
  const gaunt = woman ? 0 : clamp((age - 0.5) * 2);
  const style = o.style || (woman ? 'long' : 'man');
  if (style === 'bun') { const bun = ellPath(0, -150, 46, 34); celFill(ctx, bun, P.hair, P.hairS, -4, -8); ink(ctx, bun, P.line, lw); }
  if (style === 'pig') for (const sx of [-1, 1]) {
    const pg = crPath([[sx * 70, -60], [sx * 120 + w(7, 6) * sx, 0], [sx * 112 + w(8, 6) * sx, 70, 1], [sx * 92, 10], [sx * 64, -30]]);
    celFill(ctx, pg, P.hair, P.hairS, 0, -8); ink(ctx, pg, P.line, lw);
    fillP(ctx, ellPath(sx * 76, -52, 12, 9), [220, 90, 90]); ink(ctx, ellPath(sx * 76, -52, 12, 9), P.line, lw * 0.8);
  }
  // back hair (woman)
  if (style === 'long') {
    const bh = crPath([[-80, -110], [-98, -20], [-104, 120], [-110 + w(1, 8), 250, 1], [-60, 210], [0, 180], [60, 210], [110 + w(2, 8), 250, 1], [104, 120], [98, -20], [80, -110], [0, -156]]);
    celFill(ctx, bh, P.hair, P.hairS, 0, -20); ink(ctx, bh, P.line, lw);
  }
  if (o.bust) {
    const sh = crPath([[-40, 170], [-150, 220], [-230, 300], [-260, 420, 1], [260, 420, 1], [230, 300], [150, 220], [40, 170]]);
    celFill(ctx, sh, P.skin, P.skinS, -20, -10); ink(ctx, sh, P.line, lw);
    const gown = crPath([[-260, 420, 1], [-236, 330], [-120, 340], [0, 372], [120, 340], [236, 330], [260, 420, 1]]);
    celFill(ctx, gown, P.gown || [230, 200, 140], P.gownS || [190, 150, 100], -10, -10); ink(ctx, gown, P.line, lw);
  }
  // neck
  const neck = crPath(woman ? [[-28, 80], [-32, 190], [32, 190], [28, 80]] : [[-36, 80], [-40, 190], [40, 190], [36, 80]]);
  fillP(ctx, neck, P.skin); shadeIn(ctx, neck, crPath([[-60, 60], [60, 60], [60, 140], [0, 128], [-60, 140]]), P.skinS); ink(ctx, neck, P.line, lw);
  // ears
  if (!woman) for (const sx of [-1, 1]) {
    const ear = crPath([[70 * sx, -8], [86 * sx, -14], [92 * sx, 6], [86 * sx, 30], [72 * sx, 38]]);
    celFill(ctx, ear, P.skin, P.skinS, -4 * sx, 0); ink(ctx, ear, P.line, lw);
  }
  const g = gaunt * 6;
  const half = woman
    ? [[0, -118], [44, -108], [64, -70], [66, -24], [64, 14], [56, 48], [42, 78], [22, 98], [0, 106]]
    : [[0, -118], [46, -108], [70, -70], [74, -24], [74 - g * 0.3, 10], [70 - g, 40], [58 - g * 0.5, 70], [38, 94], [16, 106], [0, 108]];
  const pts = [...half, ...half.slice(1, -1).reverse().map((p) => [-p[0], p[1]])];
  const face = crPath(pts);
  fillP(ctx, face, P.skin);
  ctx.save(); ctx.clip(face);
  // shading: under hairline and one side
  fillP(ctx, crPath([[-100, -140], [100, -140], [100, -60], [40, -46], [0, -50], [-40, -46], [-100, -60]]), P.skinS);
  if (o.sideShade) fillP(ctx, crPath([[50, -80], [80, -40], [80, 120], [20, 120], [44, 60], [56, 10]]), P.skinS, o.sideShade);
  if (gaunt) { fillP(ctx, crPath([[44, 24], [62, 30], [54, 70], [40, 56]]), P.skinS, gaunt * 0.8); fillP(ctx, crPath([[-44, 24], [-62, 30], [-54, 70], [-40, 56]]), P.skinS, gaunt * 0.8); }
  if (o.blush) { softE(ctx, -40, 44, 22, 10, P.blush, 0.32 * o.blush); softE(ctx, 40, 44, 22, 10, P.blush, 0.32 * o.blush); }
  // porcelain sheen
  if (o.porcelain) {
    const pc = o.porcelain;
    ctx.globalCompositeOperation = 'lighter';
    softE(ctx, -38, 28, 14, 7, [255, 255, 255], 0.45 * pc); softE(ctx, 38, 28, 14, 7, [255, 255, 255], 0.45 * pc);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
  ink(ctx, face, P.line, lw);
  // eyes
  const look = o.look || [0, 0];
  const open = 1 - clamp(o.blink || 0);
  for (const sx of [-1, 1]) eyeFront(ctx, P, lw, { x: 32 * sx, y: 4, sx, open, look, woman, glassy: o.glassy || 0, age });
  // brows
  for (const sx of [-1, 1]) {
    const b = o.brow || 0;
    const br = crPath([[12 * sx, -24 - b * 3], [34 * sx, -32 - b * 1], [56 * sx, -26 + b * 4], [54 * sx, -22 + b * 4], [34 * sx, -27 - b], [13 * sx, -19 - b * 3]]);
    fillP(ctx, br, woman ? scl(P.hair, 1.6) : P.hairS); ink(ctx, br, P.line, lw * 0.4);
  }
  // nose
  const n = new Path2D(); n.moveTo(4, 20); n.quadraticCurveTo(8, 36, 2, 44); n.quadraticCurveTo(-2, 46, -6, 44);
  ink(ctx, n, P.lineSoft, lw * 0.75);
  shadeIn(ctx, face, crPath([[4, 18], [12, 36], [6, 46], [2, 40]]), P.skinS, 0.7);
  // mouth
  const sm = o.smile || 0;
  if (woman) {
    const lips = crPath([[-18, 66 - sm * 6, 1], [0, 64], [18, 66 - sm * 6, 1], [0, 74 + sm * 2]]);
    fillP(ctx, lips, P.lips || P.mouth, 0.85);
    const ml = new Path2D(); ml.moveTo(-18, 66 - sm * 6); ml.quadraticCurveTo(0, 70 + sm * 3, 18, 66 - sm * 6); ink(ctx, ml, P.line, lw * 0.8);
  } else {
    const ml = new Path2D(); ml.moveTo(-16, 70 - sm * 4); ml.quadraticCurveTo(0, 72 + sm * 3, 16, 70 - sm * 4); ink(ctx, ml, P.line, lw * 0.8);
    const ll = new Path2D(); ll.moveTo(-6, 80); ll.lineTo(6, 80); ink(ctx, ll, P.lineSoft, lw * 0.5);
  }
  // age lines
  if (!woman && age > 0.3) {
    const a = clamp((age - 0.3) * 2);
    const wl = new Path2D();
    wl.moveTo(-40, -50); wl.quadraticCurveTo(0, -56, 40, -50); wl.moveTo(-34, -40); wl.quadraticCurveTo(0, -45, 34, -40);
    wl.moveTo(-18, 46); wl.quadraticCurveTo(-28, 60, -26, 78); wl.moveTo(18, 46); wl.quadraticCurveTo(28, 60, 26, 78);
    wl.moveTo(-46, 22); wl.quadraticCurveTo(-32, 28, -18, 22); wl.moveTo(46, 22); wl.quadraticCurveTo(32, 28, 18, 22);
    wl.moveTo(-56, 0); wl.lineTo(-64, -4); wl.moveTo(56, 0); wl.lineTo(64, -4); wl.moveTo(-56, 8); wl.lineTo(-64, 10); wl.moveTo(56, 8); wl.lineTo(64, 10);
    ink(ctx, wl, P.lineSoft, lw * 0.5, a);
    if (gaunt) { const gl = new Path2D(); gl.moveTo(-60, 30); gl.quadraticCurveTo(-50, 60, -36, 84); gl.moveTo(60, 30); gl.quadraticCurveTo(50, 60, 36, 84); gl.moveTo(-10, 96); gl.lineTo(10, 96); ink(ctx, gl, P.lineSoft, lw * 0.5, gaunt * 0.8); }
  }
  if (!woman && o.mole !== false) fillP(ctx, ellPath(-48, 24, 2.4, 2.4), scl(P.line, 1.3));
  // hair
  if (style === 'bun' || style === 'pig') {
    const fr = crPath(style === 'bun'
      ? [[0, -150], [-60, -138], [-82, -90], [-80, -30], [-66, -50], [-50, -90], [-10, -100], [30, -110], [66, -60], [80, -30], [82, -90], [60, -138]]
      : [[0, -150], [-64, -136], [-84, -80], [-76, -20], [-62, -56], [-40, -60, 1], [-26, -76], [-10, -58, 1], [6, -78], [24, -58, 1], [40, -76], [58, -56, 1], [76, -20], [84, -80], [64, -136]]);
    celFill(ctx, fr, P.hair, P.hairS, -6, -12);
    ctx.save(); ctx.clip(fr); ctx.strokeStyle = css(P.hairH, 0.7); ctx.lineWidth = lw; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-40 + i * 20, -136); ctx.quadraticCurveTo(-20 + i * 20, -120, -10 + i * 24, -100); ctx.stroke(); } ctx.restore();
    ink(ctx, fr, P.line, lw);
  } else if (woman) {
    const fr = crPath([[0, -150], [-56, -136], [-78, -90], [-80, -10], [-84 + w(3, 4), 100], [-92 + w(4, 6), 190, 1], [-70, 120], [-66, 20], [-58, -50], [-34, -100], [0, -114], [34, -100], [58, -50], [66, 20], [70, 120], [92 + w(5, 6), 190, 1], [84 + w(6, 4), 100], [80, -10], [78, -90], [56, -136]]);
    celFill(ctx, fr, P.hair, P.hairS, -6, -14);
    ctx.save(); ctx.clip(fr); ctx.strokeStyle = css(P.hairH, 0.8); ctx.lineWidth = lw * 1.2; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-8 - i * 10, -140 + i * 4); ctx.quadraticCurveTo(-70 - i * 4, -110, -74 - i * 4, -30); ctx.stroke(); ctx.beginPath(); ctx.moveTo(8 + i * 10, -140 + i * 4); ctx.quadraticCurveTo(70 + i * 4, -110, 74 + i * 4, -30); ctx.stroke(); }
    ctx.restore();
    ink(ctx, fr, P.line, lw);
    const part = new Path2D(); part.moveTo(0, -150); part.lineTo(0, -114); ink(ctx, part, P.hairS, lw);
  } else {
    const old = age > 0.8;
    const hm = crPath(old ? [
      [-64, -60], [-78, -100], [-50, -140], [0, -152], [50, -140], [78 + w(1, 4), -104 + w(2, 4)], [64, -60], [74, -20], [70, -46], [50, -96], [20, -110], [0, -96], [-20, -110], [-50, -96], [-70, -46], [-74, -20],
    ] : [
      [-70, -40], [-84, -100], [-50, -146], [0, -158], [50, -146], [84, -100], [70, -40], [60, -70], [30, -84], [42, -60, 1], [10, -88], [-4, -62, 1], [-24, -90], [-40, -64, 1], [-58, -80],
    ]);
    celFill(ctx, hm, P.hair, P.hairS, -6, -12);
    ctx.save(); ctx.clip(hm); ctx.strokeStyle = css(P.hairH, 0.85); ctx.lineWidth = lw * 1.1; ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 30, -100); ctx.quadraticCurveTo(-40 + i * 30, -140, -20 + i * 26, -152); ctx.stroke(); }
    ctx.restore();
    ink(ctx, hm, P.line, lw);
    if (old) { // loose wisps in the wind
      for (let i = 0; i < 2; i++) { const ws = crPath([[-20 + i * 40, -148], [-4 + i * 40 + w(10 + i, 5), -160 + w(20 + i, 3)], [16 + i * 40 + w(30 + i, 6), -158 + w(40 + i, 4)]], false); ink(ctx, ws, P.hairS, lw * 0.8, 0.8); }
    }
  }
  // crack on porcelain skin
  if (o.crack > 0) {
    const r = RNG(31); let x0 = 30, y0 = 40; const cp = new Path2D(); cp.moveTo(x0, y0);
    const n2 = Math.floor(10 * o.crack);
    for (let i = 0; i < n2; i++) { x0 += 4 + r() * 6; y0 += (r() - 0.6) * 14; cp.lineTo(x0, y0); }
    ink(ctx, cp, [60, 40, 30], lw * 0.8);
  }
}
function eyeFront(ctx, P, lw, e) {
  const { x, y, sx, open, look, woman } = e;
  const wdt = woman ? 50 : 40, hh = (woman ? 17 : 12) * open;
  const inn = x - sx * wdt * 0.45, out = x + sx * wdt * 0.55;
  const up = [[inn, y + 3, 1], [x, y - hh - 2], [out, y - 1, 1]];
  const lo = [[out - sx * 4, y + 3], [x, y + 4 + hh * 0.55], [inn + sx * 2, y + 4]];
  if (open > 0.08) {
    const ey = crPath([...up, ...lo]);
    fillP(ctx, ey, P.eyeW);
    ctx.save(); ctx.clip(ey);
    const icx = x + look[0] * 8 - sx * 1, icy = y + 2 + look[1] * 7;
    const irx = woman ? 12 : 9, iry = woman ? 16 : 12;
    fillP(ctx, ellPath(icx, icy, irx, iry), P.iris);
    softE(ctx, icx, icy + 6, irx * 0.8, iry * 0.5, P.irisL, 0.6);
    fillP(ctx, ellPath(icx, icy, irx * (e.glassy ? 0.25 : 0.45), iry * (e.glassy ? 0.25 : 0.45)), scl(P.iris, 0.45));
    const hs = e.glassy ? 1.8 : 1;
    fillP(ctx, ellPath(icx - irx * 0.3, icy - iry * 0.4, 3.4 * hs, 4 * hs), [255, 255, 255]);
    fillP(ctx, ellPath(icx + irx * 0.35, icy + iry * 0.35, 1.6 * hs, 1.6 * hs), [255, 255, 255], 0.85);
    if (e.glassy) { ctx.globalCompositeOperation = 'lighter'; softE(ctx, icx, icy - 4, irx, iry * 0.6, [200, 220, 255], 0.35 * e.glassy); ctx.globalCompositeOperation = 'source-over'; }
    fillP(ctx, crPath([[inn - 6, y - 30], [out + 6, y - 30], [out + 6, y - hh + 4], [x, y - hh + 6], [inn - 6, y - hh + 4]]), P.skinS, 0.35);
    ctx.restore();
  }
  ink(ctx, crPath(up, false), P.line, lw * (woman ? 2.2 : 1.8));
  if (woman && open > 0.1) { // lashes
    const lash = new Path2D(); lash.moveTo(out, y - 1); lash.lineTo(out + sx * 8, y - 7); lash.moveTo(out - sx * 6, y - hh * 0.7); lash.lineTo(out + sx * 2, y - hh - 4);
    ink(ctx, lash, P.line, lw * 1.2);
  }
  if (open > 0.08) ink(ctx, crPath([[out - sx * 6, y + 5], [x, y + 5 + hh * 0.5]], false), P.lineSoft, lw * 0.7);
  const cr = new Path2D(); cr.moveTo(inn + sx * 4, y - hh - 7); cr.quadraticCurveTo(x, y - hh - 11, out - sx * 2, y - hh - 4); ink(ctx, cr, P.lineSoft, lw * 0.55, 0.8);
}

/* back of head (seen from behind) */
function drawHeadBack(ctx, o) {
  const P = o.pal, s = o.s || 1, lw = (o.lw || 3) / s, age = P.age ?? 0, t = o.t || 0, wind = o.wind ?? 0.6;
  const w = (i, a) => (Math.sin(t * 6 + i * 1.9) * 0.7 + Math.sin(t * 2.2 + i) * 0.3) * a * wind;
  const neck = crPath([[-36, 60], [-40, 170], [40, 170], [36, 60]]);
  fillP(ctx, neck, P.skinS); ink(ctx, neck, P.line, lw);
  for (const sx of [-1, 1]) { const ear = crPath([[70 * sx, -8], [88 * sx, -10], [90 * sx, 16], [74 * sx, 34]]); fillP(ctx, ear, P.skinS); ink(ctx, ear, P.line, lw); }
  const old = age > 0.8;
  const hm = crPath(old ? [
    [-74, 20], [-84, -60], [-60, -130], [0, -150], [60, -130], [84, -60], [74, 20], [40 + w(1, 6), 50 + w(2, 4), 1], [10, 30], [-20 + w(3, 6), 52, 1], [-44, 30],
  ] : [
    [-78, 30], [-88, -60], [-62, -136], [0, -158], [62, -136], [88, -60], [78, 30], [56 + w(1, 8), 64 + w(2, 6), 1], [30, 40], [8 + w(3, 8), 70 + w(4, 6), 1], [-14, 42], [-40 + w(5, 8), 66 + w(6, 6), 1], [-58, 40],
  ]);
  celFill(ctx, hm, P.hair, P.hairS, -10, -14);
  ctx.save(); ctx.clip(hm); ctx.strokeStyle = css(P.hairH, 0.7); ctx.lineWidth = lw * 1.2;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-50 + i * 20, -120); ctx.quadraticCurveTo(-30 + i * 20, -60, -20 + i * 26, 20); ctx.stroke(); }
  ctx.restore();
  ink(ctx, hm, P.line, lw);
  const sl = new Path2D(); sl.moveTo(-30, -100); sl.quadraticCurveTo(-40, -30, -44, 30); sl.moveTo(20, -110); sl.quadraticCurveTo(26, -30, 30, 40); ink(ctx, sl, P.hairS, lw * 0.6);
}
