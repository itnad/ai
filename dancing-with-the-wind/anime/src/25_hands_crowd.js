/* ===================== hands ===================== */
/* back of a right hand reaching up, as a silhouette. curl 0 open .. 1 fist. local: wrist at (0,0), fingers up */
/* silhouette hand as separate shapes (filled one by one so overlaps never cancel) */
function handSilParts(curl) {
  const c = clamp(curl), parts = [];
  parts.push(limbPath(0, 240, 0, 10, 34, 40));
  const palm = new Path2D(); palm.moveTo(-58, -10); palm.bezierCurveTo(-64, -60, -56, -100, -46, -118); palm.lineTo(48, -122); palm.bezierCurveTo(58, -90, 62, -40, 46, 10); palm.bezierCurveTo(20, 40, -30, 40, -58, -10); palm.closePath();
  parts.push(palm);
  const fingers = [[-34, -112, 0.95, -0.16], [-11, -120, 1.08, -0.05], [12, -120, 1.0, 0.05], [34, -112, 0.82, 0.15]];
  for (const [x0, y0, len, sp] of fingers) {
    const L = 118 * len * (1 - c * 0.96), ang = -Math.PI / 2 + sp * (1 - c);
    parts.push(ellPath(x0, y0, 14, 14));
    if (L > 2) parts.push(limbPath(x0, y0, x0 + Math.cos(ang) * L, y0 + Math.sin(ang) * L, 12.5, 10));
  }
  const ta = lerp(-2.5, -1.9, c), tl = lerp(88, 40, c);
  parts.push(limbPath(-52, -30, -52 + Math.cos(ta) * tl, -30 + Math.sin(ta) * tl, 17, 13));
  return parts;
}
function fillParts(ctx, parts, col) { ctx.fillStyle = css(col); for (const p of parts) ctx.fill(p); }

/* palms-up cupped hands seen from above. local centre (0,0) */
function drawHandsUp(ctx, o) {
  const P = o.pal, s = o.s || 1, lw = (o.lw || 3) / s, t = o.t || 0;
  const tremble = (o.tremble || 0) * Math.sin(t * 31) * 2;
  const curl = o.curl ?? 0.25;
  for (const sx of [-1, 1]) {
    ctx.save(); ctx.translate(sx * 112 + tremble, 0); ctx.scale(sx, 1);
    const sl = crPath([[-20, 150], [-40, 420, 1], [190, 420, 1], [170, 150]]);
    celFill(ctx, sl, P.coat, P.coatS, -12, -10); ink(ctx, sl, P.line, lw);
    const cuff = crPath([[-24, 120], [172, 116], [176, 152], [-22, 158]]); celFill(ctx, cuff, P.shirt, P.shirtS, -4, -4); ink(ctx, cuff, P.line, lw);
    const fl = [[-10, -64, -1.8, 70], [24, -76, -1.65, 88], [58, -78, -1.52, 96], [90, -66, -1.38, 86]];
    const fing = [];
    for (const [x0, y0, a, L] of fl) {
      const l1 = L * 0.55 * (1 - curl * 0.35), l2 = L * 0.45 * (1 - curl * 0.6);
      const m = [x0 + Math.cos(a) * l1, y0 + Math.sin(a) * l1];
      const a2 = a + (a < -1.57 ? 0.25 : -0.25) * curl;
      const e = [m[0] + Math.cos(a2) * l2, m[1] + Math.sin(a2) * l2];
      const pth = limbPath(x0, y0, m[0], m[1], 16, 14); limbPath(m[0], m[1], e[0], e[1], 14, 11.5, pth);
      fing.push({ pth, m });
    }
    for (const f of fing) { ink(ctx, f.pth, P.line, lw * 2.1); celFill(ctx, f.pth, P.skin, P.skinS, -4, 3); }
    for (const f of fing) { const jl = new Path2D(); jl.moveTo(f.m[0] - 9, f.m[1] + 2); jl.lineTo(f.m[0] + 8, f.m[1] - 1); ink(ctx, jl, P.lineSoft, lw * 0.6, 0.7); }
    const th = limbPath(118, 46, 150, -6, 22, 18); limbPath(150, -6, 166, -52, 18, 13, th);
    ink(ctx, th, P.line, lw * 2.1); celFill(ctx, th, P.skin, P.skinS, -4, 4);
    const palm = crPath([[-30, -40], [-10, -82], [56, -88], [106, -70], [126, 0], [118, 70], [84, 126], [10, 132], [-30, 90], [-40, 20]]);
    ink(ctx, palm, P.line, lw * 2.1); fillP(ctx, palm, P.skin);
    ctx.save(); ctx.clip(palm);
    soft(ctx, 46, 30, 90, P.skinS, 0.55);
    fillP(ctx, crPath([[96, -60], [130, -20], [130, 100], [90, 130], [104, 40]]), P.skinS, 0.8);
    ctx.restore();
    const cr = new Path2D(); cr.moveTo(-26, -20); cr.quadraticCurveTo(40, -50, 100, -36); cr.moveTo(104, 10); cr.quadraticCurveTo(60, 50, 40, 118); cr.moveTo(-20, 30); cr.quadraticCurveTo(30, 18, 70, 30);
    ink(ctx, cr, P.lineSoft, lw * 0.6, 0.6);
    ctx.restore();
  }
}

/* the tiny brass ballerina from the music box. local: base at (0,0), height ~100 */
function drawBallerina(ctx, lw, spin = 0, col = [212, 168, 92], colS = [150, 104, 50], line = [70, 44, 24]) {
  const sx = Math.cos(spin) || 0.001;
  ctx.save(); ctx.scale(Math.abs(sx) < 0.15 ? 0.15 * Math.sign(sx || 1) : sx, 1);
  const legs = new Path2D(); limbPath(-3, -30, -2, 0, 3.4, 2.4, legs); limbPath(3, -30, 14, -14, 3.4, 2.4, legs);
  const tutu = crPath([[-26, -34], [0, -40], [26, -34], [14, -28], [0, -30], [-14, -28]]);
  const body = crPath([[-5, -34], [-6, -56], [0, -62], [6, -56], [5, -34]]);
  const arms = new Path2D(); limbPath(-4, -56, -14, -78, 2.5, 2, arms); limbPath(-14, -78, 0, -92, 2, 1.8, arms); limbPath(4, -56, 14, -78, 2.5, 2, arms); limbPath(14, -78, 0, -92, 2, 1.8, arms);
  for (const p of [legs, arms]) { ink(ctx, p, line, lw * 1.8); fillP(ctx, p, col); }
  celFill(ctx, body, col, colS, -2, -2); ink(ctx, body, line, lw);
  celFill(ctx, tutu, col, colS, -3, -2); ink(ctx, tutu, line, lw);
  const hd = ellPath(0, -70, 6, 7); celFill(ctx, hd, col, colS, -2, -2); ink(ctx, hd, line, lw);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; soft(ctx, -3, -60, 10, [255, 240, 200], 0.35); ctx.restore();
}

/* creased photograph of the family at the kitchen table (painted miniature) */
function drawPhoto(ctx, w, h, lw, crease = 1, seed = 5) {
  const fr = polyPath([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]);
  fillP(ctx, fr, [246, 240, 226]); ink(ctx, fr, [120, 100, 80], lw);
  const iw = w * 0.86, ih = h * 0.72, iy = -h / 2 + w * 0.07;
  ctx.save(); ctx.beginPath(); ctx.rect(-iw / 2, iy, iw, ih); ctx.clip();
  vfill(ctx, -iw / 2, iy, iw, ih, [[0, [196, 150, 96]], [1, [120, 80, 50]]]);
  const fig = [[-0.3, [70, 60, 60]], [0, [190, 110, 100]], [0.3, [90, 80, 110]]];
  for (const [fx, c] of fig) {
    const x = fx * iw, y = iy + ih * 0.55;
    fillP(ctx, ellPath(x, y - ih * 0.18, iw * 0.06, iw * 0.07), [240, 205, 170]);
    fillP(ctx, ellPath(x, y - ih * 0.24, iw * 0.065, iw * 0.04), [40, 34, 38]);
    fillP(ctx, crPath([[x - iw * 0.1, y + ih * 0.3], [x - iw * 0.08, y - ih * 0.06], [x + iw * 0.08, y - ih * 0.06], [x + iw * 0.1, y + ih * 0.3]]), c);
  }
  fillP(ctx, polyPath([[-iw / 2, iy + ih * 0.78], [iw / 2, iy + ih * 0.78], [iw / 2, iy + ih], [-iw / 2, iy + ih]]), [150, 100, 60]);
  ctx.restore();
  if (crease) {
    ctx.strokeStyle = css([255, 255, 255], 0.5 * crease); ctx.lineWidth = lw * 0.9;
    ctx.beginPath(); ctx.moveTo(-w / 2, -h * 0.1); ctx.lineTo(w / 2, h * 0.05); ctx.moveTo(w * 0.1, -h / 2); ctx.lineTo(-w * 0.05, h / 2); ctx.stroke();
  }
}

/* ===================== masked guests (sprites) ===================== */
const GUEST = { sprites: null };
function drawGuest(ctx, v, pose, lw) {
  const r = RNG(900 + v);
  const woman = v % 2 === 1;
  const skin = jitc([236, 206, 184], r, 16), line = [40, 28, 26];
  const dark = woman ? jitc([26, 22, 30], r, 10) : [28, 28, 34], darkS = scl(dark, 0.7);
  const hair = r.pick([[24, 22, 28], [50, 36, 30], [36, 30, 34]]);
  // body
  const body = woman ? crPath([[-46, -330], [-56, -200], [-70, 0, 1], [70, 0, 1], [56, -200], [46, -330]]) : crPath([[-62, -330], [-60, -200], [-56, 0, 1], [56, 0, 1], [60, -200], [62, -330]]);
  celFill(ctx, body, dark, darkS, -10, -6); ink(ctx, body, line, lw);
  if (!woman) {
    const sh = crPath([[-16, -336, 1], [16, -336, 1], [6, -250, 1], [-6, -250, 1]]); fillP(ctx, sh, [236, 236, 240]); ink(ctx, sh, line, lw * 0.8);
    const bt = crPath([[-14, -330], [0, -324], [14, -330], [14, -318], [0, -322], [-14, -318]]); fillP(ctx, bt, [20, 20, 24]);
    const lap = new Path2D(); lap.moveTo(-18, -336); lap.lineTo(-30, -260); lap.lineTo(-4, -200); lap.moveTo(18, -336); lap.lineTo(30, -260); lap.lineTo(4, -200); ink(ctx, lap, scl(dark, 2.2), lw * 0.8);
  } else {
    const sk = crPath([[-46, -330], [-30, -352], [30, -352], [46, -330], [30, -316], [-30, -316]]); celFill(ctx, sk, skin, scl(skin, 0.85), -3, -3); ink(ctx, sk, line, lw * 0.8);
    fillP(ctx, ellPath(0, -322, 18, 4), [230, 200, 120], 0.9);
  }
  // arms: pose 0 down, 1 hands apart, 2 hands together (clap)
  const hands = pose === 0 ? [[-56, -200], [56, -200]] : pose === 1 ? [[-46, -290], [46, -290]] : [[-6, -296], [6, -296]];
  for (const [sx, hpt] of [[-1, hands[0]], [1, hands[1]]]) {
    const shp = [sx * (woman ? 44 : 58), -326];
    const el = pose === 0 ? [sx * 64, -260] : [sx * 60, -230];
    const arm = limbPath(shp[0], shp[1], el[0], el[1], 12, 11); limbPath(el[0], el[1], hpt[0], hpt[1], 11, 9, arm);
    ink(ctx, arm, line, lw * 2); fillP(ctx, arm, woman ? skin : dark);
    const hd = ellPath(hpt[0], hpt[1] - 4, 8, 11); fillP(ctx, hd, woman ? [240, 236, 230] : skin); ink(ctx, hd, line, lw * 0.8);
  }
  // neck + head with a smooth golden mask
  const nk = crPath([[-12, -350], [-12, -330], [12, -330], [12, -350]]); fillP(ctx, nk, skin);
  const hd = ellPath(0, -392, 30, 38);
  const hb = woman ? crPath([[-36, -420], [-42, -360], [-30, -320], [30, -320], [42, -360], [36, -420], [0, -440]]) : crPath([[-34, -404], [-30, -428], [0, -438], [30, -428], [34, -404]]);
  if (woman) { fillP(ctx, hb, hair); ink(ctx, hb, line, lw); }
  fillP(ctx, hd, skin); ink(ctx, hd, line, lw);
  const mask = crPath([[-28, -404], [0, -414], [28, -404], [26, -372], [0, -360], [-26, -372]]);
  fillP(ctx, mask, [214, 172, 84]);
  ctx.save(); ctx.clip(mask); fillP(ctx, ellPath(-8, -400, 14, 8), [255, 236, 170]); fillP(ctx, ellPath(10, -368, 22, 10), [160, 116, 46]); ctx.restore();
  ink(ctx, mask, [90, 60, 24], lw);
  fillP(ctx, ellPath(-11, -390, 5, 2.4), [30, 22, 18]); fillP(ctx, ellPath(11, -390, 5, 2.4), [30, 22, 18]);
  if (!woman) { const hr = crPath([[-32, -404], [-30, -430], [0, -440], [30, -430], [32, -404], [24, -418], [0, -424], [-24, -418]]); fillP(ctx, hr, hair); ink(ctx, hr, line, lw); }
}
function buildGuestSprites() {
  const sc = 0.9, out = [];
  for (let v = 0; v < 6; v++) {
    const row = [];
    for (let pose = 0; pose < 3; pose++) {
      const [c, x] = mkC(Math.round(200 * sc), Math.round(460 * sc));
      x.translate(100 * sc, 455 * sc); x.scale(sc, sc);
      drawGuest(x, v, pose, 2.4 / sc);
      row.push(c);
    }
    out.push(row);
  }
  GUEST.sprites = out; GUEST.sc = sc;
}
/* draw a guest sprite with feet at (x,y), height scale k (1 => ~455px) */
function blitGuest(ctx, v, pose, x, y, k, alpha = 1, flip = false) {
  const img = GUEST.sprites[v % GUEST.sprites.length][pose];
  const w = img.width / GUEST.sc * k, h = img.height / GUEST.sc * k;
  ctx.globalAlpha = alpha;
  if (flip) { ctx.save(); ctx.translate(x, y); ctx.scale(1, -1); ctx.drawImage(img, -w / 2, -5 * k, w, h); ctx.restore(); }
  else ctx.drawImage(img, x - w / 2, y - h + 5 * k, w, h);
  ctx.globalAlpha = 1;
}
