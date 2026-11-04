/* ===================== the woman (profile) and the waltz two-shot ===================== */
/* female profile facing RIGHT (mirror it to face left) */
function drawWomanProfile(ctx, o) {
  const P = o.pal, s = o.s || 1, lw = (o.lw || 3) / s, t = o.t || 0, wind = o.wind ?? 0.8;
  const w = (i, a) => (Math.sin(t * 4.9 + i * 1.7) * 0.7 + Math.sin(t * 2.1 + i * 0.8) * 0.3) * a * wind;
  // long hair streaming behind (to the left in this frame)
  const tail = crPath([
    [10, -150], [-60, -150], [-120, -110], [-150, -40], [-190 + w(1, 12), 60], [-260 + w(2, 18), 170 + w(3, 10), 1],
    [-200 + w(4, 12), 150], [-230 + w(5, 18), 260 + w(6, 12), 1], [-150 + w(7, 10), 190], [-160 + w(8, 14), 300 + w(9, 10), 1], [-100, 200], [-60, 120], [-50, 40], [-20, -20],
  ]);
  celFill(ctx, tail, P.hair, P.hairS, 6, -14); ink(ctx, tail, P.line, lw);
  ctx.save(); ctx.clip(tail); ctx.strokeStyle = css(P.hairH, 0.7); ctx.lineWidth = lw * 1.1;
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-20 - i * 14, -130 + i * 10); ctx.bezierCurveTo(-120, -100 + i * 20, -160 + w(i, 8), 40 + i * 20, -220 + w(i + 3, 12), 160 + i * 20); ctx.stroke(); }
  ctx.restore();
  // neck
  const neck = crPath([[-30, 60], [-36, 170], [40, 170], [32, 96]]);
  fillP(ctx, neck, P.skin); shadeIn(ctx, neck, crPath([[-60, 50], [40, 92], [40, 126], [-60, 136]]), P.skinS); ink(ctx, neck, P.line, lw);
  const face = crPath([
    [44, -104], [60, -62], [62, -26], [58, -8], [62, 6], [74, 30, 1], [62, 40], [66, 52], [61, 58], [64, 66], [56, 80], [40, 98],
    [8, 96], [-20, 70], [-60, 40], [-80, -20], [-60, -110], [0, -140],
  ]);
  fillP(ctx, face, P.skin);
  ctx.save(); ctx.clip(face);
  fillP(ctx, crPath([[-120, -10], [-14, 30], [10, 110], [-120, 140]]), P.skinS);
  softE(ctx, 32, 34, 20, 10, P.blush, 0.3 * (o.blush ?? 1));
  if (o.porcelain) { ctx.globalCompositeOperation = 'lighter'; softE(ctx, 34, 20, 18, 8, [255, 255, 255], 0.4 * o.porcelain); softE(ctx, 46, -50, 12, 20, [255, 255, 255], 0.3 * o.porcelain); ctx.globalCompositeOperation = 'source-over'; }
  ctx.restore();
  ink(ctx, face, P.line, lw);
  // eye with lashes
  const op = 1 - clamp(o.blink || 0);
  if (op > 0.15) {
    const ey = crPath([[30, 2], [44, -12 * op], [56, -4 * op, 1], [52, 8 * op], [36, 9]]);
    fillP(ctx, ey, P.eyeW);
    ctx.save(); ctx.clip(ey); fillP(ctx, ellPath(47, 1, 7, 13), P.iris); fillP(ctx, ellPath(45, -4, 2.4, 3), [255, 255, 255]); ctx.restore();
  }
  const lid = new Path2D(); lid.moveTo(28, 0); lid.quadraticCurveTo(44, -14 * op - 2, 58, -4 * op); lid.lineTo(64, -10 * op); ink(ctx, lid, P.line, lw * 2);
  const brow = new Path2D(); brow.moveTo(30, -26); brow.quadraticCurveTo(46, -32, 60, -26); ink(ctx, brow, P.hairS, lw * 1.3);
  const lips = crPath([[64, 54], [56, 58], [60, 64]]); fillP(ctx, lips, P.lips, 0.9);
  const sm = new Path2D(); sm.moveTo(60, 58); sm.lineTo(52, 57 - (o.smile || 0) * 3); ink(ctx, sm, P.line, lw * 0.8);
  // front hair over the head
  const top = crPath([[46, -96], [30, -140], [-20, -160], [-80, -136], [-120, -90], [-100, -60], [-50, -60], [-30, -40], [-10, -70], [20, -86]]);
  celFill(ctx, top, P.hair, P.hairS, 4, -12); ink(ctx, top, P.line, lw);
  ctx.save(); ctx.clip(top); ctx.strokeStyle = css(P.hairH, 0.85); ctx.lineWidth = lw * 1.3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(30 - i * 10, -128 + i * 12); ctx.quadraticCurveTo(-30, -150 + i * 14, -96, -100 + i * 14); ctx.stroke(); }
  ctx.restore();
  // ear peeks through
  // hair ornament
  fillP(ctx, ellPath(-40, -120, 10, 10), [255, 226, 150]); ink(ctx, ellPath(-40, -120, 10, 10), P.line, lw * 0.7);
}

/* waltz two-shot in screen space. o: t, pal (man), wpal (woman), sway, crown {dy,rot} | null,
   womanAlpha via o.drawWoman=false to skip her (she is drawn separately when dissolving) */
function drawWaltz(ctx, o) {
  const P = o.pal, Q = o.wpal, t = o.t || 0, lw = 2.8, sway = o.sway || 0;
  const bx = Math.sin(t * 1.9) * 14 * sway, by = Math.abs(Math.sin(t * 1.9)) * -10 * sway;
  ctx.save(); ctx.translate(bx, by);
  // ---- man body (profile facing right) ----
  ctx.save(); ctx.translate(790, 432); ctx.rotate(o.manTilt ?? 0.05); ctx.scale(0.74, 0.74);
  drawHeadProfile(ctx, { pal: P, s: 0.74, lw, t, wind: o.wind ?? 0.5, blink: o.manBlink || 0, mouth: o.manMouth || 0, crown: o.crown });
  ctx.restore();
  const mc = crPath([[600, 1120, 1], [590, 860], [600, 650], [640, 584], [740, 548], [800, 540], [858, 556], [900, 600], [918, 700], [930, 860], [944, 1120, 1]]);
  celFill(ctx, mc, P.coat, P.coatS, -34, -14); ink(ctx, mc, P.line, lw);
  const col = crPath([[760, 520, 1], [812, 534], [842, 580, 1], [800, 566], [770, 556]]); celFill(ctx, col, P.shirt, P.shirtS, -4, -4); ink(ctx, col, P.line, lw);
  const lap = crPath([[842, 560], [884, 640], [884, 740], [926, 880]], false); ink(ctx, lap, P.line, lw);
  const cl = crPath([[740, 548], [700, 600], [720, 640]], false); ink(ctx, cl, P.coatS, lw);
  // ---- woman ----
  if (o.drawWoman !== false) drawWomanDance(ctx, o);
  // ---- his near arm around her waist ----
  if (o.manArm !== false) {
    const arm = limbPath(760, 640, 860, 820, 30, 26); limbPath(860, 820, 1110, 800, 26, 22, arm);
    ink(ctx, arm, P.line, lw * 2.2); celFill(ctx, arm, P.coat, P.coatS, -4, -10);
    const fold = new Path2D(); fold.moveTo(830, 760); fold.lineTo(860, 820); fold.lineTo(900, 806); ink(ctx, fold, P.coatS, lw);
    const cuff = limbPath(1080, 800, 1098, 799, 23, 22); fillP(ctx, cuff, P.shirt); ink(ctx, cuff, P.line, lw * 0.8);
    const hand = crPath([[1098, 778], [1140, 770], [1160, 790], [1136, 822], [1098, 822]]);
    celFill(ctx, hand, P.skin, P.skinS, -3, -4); ink(ctx, hand, P.line, lw);
  }
  ctx.restore();
}
function drawWomanDance(ctx, o) {
  const Q = o.wpal, t = o.t || 0, lw = 2.8, wind = o.wind ?? 0.6;
  const w = (i, a) => Math.sin(t * 3.7 + i * 1.3) * a * wind;
  // gown bodice + skirt top, flowing sash behind (to the right)
  const sash = crPath([[1180, 760], [1300 + w(1, 30), 720], [1500 + w(2, 50), 760 + w(3, 30)], [1720 + w(4, 70), 700 + w(5, 50), 1], [1560 + w(6, 50), 820], [1340 + w(7, 30), 860], [1200, 860]]);
  celFill(ctx, sash, Q.gown, Q.gownS, -10, -10); ink(ctx, sash, Q.line, lw);
  const gown = crPath([[1010, 1120, 1], [1000, 860], [1010, 720], [1030, 640], [1080, 600], [1160, 590], [1200, 640], [1196, 760], [1240, 900], [1300 + w(8, 20), 1120, 1]]);
  celFill(ctx, gown, Q.gown, Q.gownS, -18, -10); ink(ctx, gown, Q.line, lw);
  ctx.save(); ctx.clip(gown);
  ctx.strokeStyle = css(Q.gownD, 0.8); ctx.lineWidth = lw;
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(1060 + i * 40, 760); ctx.quadraticCurveTo(1060 + i * 50, 940, 1040 + i * 70 + w(9 + i, 10), 1120); ctx.stroke(); }
  ctx.globalCompositeOperation = 'lighter'; softE(ctx, 1060, 700, 40, 120, Q.gownH, 0.3); ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  // bare shoulders / chest above the bodice
  const sk = crPath([[1036, 650], [1050, 596], [1090, 572], [1150, 574], [1196, 610], [1200, 650], [1150, 624], [1090, 630]]);
  celFill(ctx, sk, Q.skin, Q.skinS, -6, -4); ink(ctx, sk, Q.line, lw);
  // head (mirrored profile facing left)
  ctx.save(); ctx.translate(1094, 468); ctx.scale(-0.66, 0.66); ctx.rotate(o.womanTilt ?? 0.08);
  drawWomanProfile(ctx, { pal: Q, s: 0.66, lw, t, wind, blink: o.womanBlink || 0, smile: o.womanSmile ?? 0.6, porcelain: o.porcelain || 0 });
  ctx.restore();
  // her near arm resting on his shoulder
  const arm = limbPath(1070, 620, 970, 650, 19, 15); limbPath(970, 650, 880, 590, 15, 12, arm);
  ink(ctx, arm, Q.line, lw * 2.2); celFill(ctx, arm, Q.skin, Q.skinS, -3, -6);
  const gl = crPath([[890, 574], [862, 566], [850, 586], [874, 602]]); celFill(ctx, gl, Q.skin, Q.skinS, -2, -3); ink(ctx, gl, Q.line, lw);
}
