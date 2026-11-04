/* ===================== full bodies =====================
   units: ground y=0 at the soles, figure ~600 tall. HS = head scale vs head units. */
const HS = 0.37;
const LEN = { thigh: 160, shin: 152, uarm: 108, farm: 98, torso: 178 };

/* step gait: feet alternate on "steps" of tread T and riser R (R=0 => flat walk, stride 2T) */
function gaitSteps(p, T, R, lift = 1) {
  const step = (n) => [n * T + T * 0.45, -n * R - 18];
  const foot = (o) => {
    const u = (p - o) / 2, k = Math.floor(u), fr = u - k;
    const A = step(o + 2 * k), B = step(o + 2 * k + 2);
    if (fr < 0.5) return { pos: A, toe: 0, air: 0 };
    const sv = E.io((fr - 0.5) / 0.5);
    return { pos: [lerp(A[0], B[0], sv), lerp(A[1], B[1], sv) - Math.sin(Math.PI * sv) * (R * 1.1 + 34) * lift], toe: Math.sin(Math.PI * sv) * 0.35, air: Math.sin(Math.PI * sv) };
  };
  const n = foot(0), f = foot(1);
  const hipX = p * T + T * 0.45 + 8;
  const yAvg = (n.pos[1] + f.pos[1]) / 2;
  const hipY = Math.min(yAvg - 268, Math.max(n.pos[1], f.pos[1]) - 300) - Math.abs(Math.sin(p * Math.PI)) * 6;
  return { hip: [hipX, hipY], footN: n.pos, footF: f.pos, toeN: n.toe, toeF: f.toe, phase: p };
}

function shoePath(ax, ay, toe, flip = 1) {
  const pts = [[-16, 0], [-16, 16, 1], [6, 20], [48, 20, 1], [52, 10], [40, -2], [10, -10]];
  const c = Math.cos(toe), s_ = Math.sin(toe);
  return crPath(pts.map((p) => [ax + (p[0] * c - p[1] * s_) * flip, ay + p[0] * s_ + p[1] * c, p[2]]));
}

/* side view, facing right. o.pose from gaitSteps (or custom) */
function drawManSide(ctx, o) {
  const P0 = o.pal, s = o.s || 1, lw = (o.lw || 2.6) / s, t = o.t || 0, wind = o.wind ?? 0.7;
  const P = o.sil ? silPal(P0, o.sil) : P0;
  const po = o.pose, hip = po.hip;
  const lean = o.lean ?? 0.18;
  const chest = [hip[0] + Math.sin(lean) * LEN.torso, hip[1] - Math.cos(lean) * LEN.torso];
  const d = [Math.sin(lean), -Math.cos(lean)], f = [-d[1], d[0]];
  const at = (b, a, ff) => [b[0] + d[0] * a + f[0] * ff, b[1] + d[1] * a + f[1] * ff];
  const sh = at(chest, -14, -2);
  const sw = Math.sin(po.phase * Math.PI) * 46;
  const handN = o.handN || [sh[0] + sw + 14, sh[1] + 176];
  const handF = o.handF || [sh[0] - sw + 6, sh[1] + 176];
  const L = o.light || [-6, -4];
  const kneeN = ik2(hip[0], hip[1], po.footN[0], po.footN[1], LEN.thigh, LEN.shin, 1);
  const kneeF = ik2(hip[0], hip[1], po.footF[0], po.footF[1], LEN.thigh, LEN.shin, 1);
  const elN = ik2(sh[0], sh[1], handN[0], handN[1], LEN.uarm, LEN.farm, -1);
  const elF = ik2(sh[0], sh[1], handF[0], handF[1], LEN.uarm, LEN.farm, -1);
  const limb = (a, b, c, w1, w2, w3, col, colS, shoe, toe) => {
    const pth = limbPath(a[0], a[1], b[0], b[1], w1, w2); limbPath(b[0], b[1], c[0], c[1], w2, w3, pth);
    ink(ctx, pth, P.line, lw * 2.2);
    if (shoe) { const sp = shoePath(c[0], c[1], toe); fillP(ctx, sp, P.shoe); ink(ctx, sp, P.line, lw); }
    celFill(ctx, pth, col, colS, L[0], L[1]);
  };
  // far arm, far leg
  limb(sh, elF, handF, 16, 14, 12, P.coatS, scl(P.coatS, 0.8));
  fillP(ctx, ellPath(handF[0], handF[1] + 8, 11, 14), P.skinS); ink(ctx, ellPath(handF[0], handF[1] + 8, 11, 14), P.line, lw);
  limb(hip, kneeF, po.footF, 27, 20, 16, P.pantsS, scl(P.pantsS, 0.8), true, po.toeF);
  limb(hip, kneeN, po.footN, 27, 20, 16, P.pants, P.pantsS, true, po.toeN);
  // coat
  const flap = (24 + 50 * wind * (0.6 + 0.4 * Math.sin(t * 7.1))) * (o.coatWind ?? 1);
  const wave = Math.sin(t * 9.3) * 10 * wind;
  const hemY = hip[1] + 150;
  const frontX = Math.min(Math.max(kneeN[0], kneeF[0]) + 14, hip[0] + 70);
  const coat = crPath([
    at(chest, 6, 14), at(chest, -46, 28), at(hip, 40, 26), [frontX, hemY - 10], [frontX - 6, hemY + 4, 1],
    [hip[0] - 20 - flap * 0.4, hemY + 2 - wind * 10 + wave * 0.5], [hip[0] - 44 - flap, hemY - 12 - wind * 26 + wave, 1],
    [hip[0] - 36 - flap * 0.4, hip[1] + 70 + wave * 0.3], at(hip, 24, -30), at(chest, -70, -28), at(chest, -4, -22),
  ]);
  celFill(ctx, coat, P.coat, P.coatS, L[0] * 2, L[1] * 2); ink(ctx, coat, P.line, lw);
  if (!o.sil) {
    const fold = new Path2D(); fold.moveTo(...at(hip, 10, -10)); fold.quadraticCurveTo(hip[0] - 20, hip[1] + 80, hip[0] - 30 - flap * 0.6, hemY - 8);
    fold.moveTo(...at(hip, 30, 12)); fold.lineTo(frontX - 14, hemY - 6);
    ink(ctx, fold, P.coatS, lw * 0.9);
    // lapel edge
    const lp = new Path2D(); lp.moveTo(...at(chest, 8, 14)); lp.quadraticCurveTo(...at(chest, -30, 34), ...at(chest, -70, 24)); ink(ctx, lp, P.line, lw * 0.8);
    const col = crPath([at(chest, 14, 10), at(chest, 2, 22), at(chest, -24, 18)]); fillP(ctx, col, P.shirt); ink(ctx, col, P.line, lw * 0.7);
  }
  // head
  ctx.save();
  const hc = at(chest, 54, 10);
  ctx.translate(hc[0], hc[1]); ctx.rotate(o.headTilt ?? lean * 0.6); ctx.scale(HS, HS);
  drawHeadProfile(ctx, { pal: P, s: s * HS, lw: o.lw || 2.6, t, wind, blink: o.blink, mouth: o.mouth, crown: o.crown, lookY: o.lookY });
  ctx.restore();
  // near arm
  limb(sh, elN, handN, 17, 15, 13, P.coat, P.coatS);
  fillP(ctx, ellPath(handN[0], handN[1] + 9, 12, 15), P.skin); ink(ctx, ellPath(handN[0], handN[1] + 9, 12, 15), P.line, lw);
  return { chest, hip, hc };
}
function silPal(P, c) {
  const o = {}; for (const k in P) o[k] = c; o.age = P.age; o.line = c; o.lineSoft = c; return o;
}

/* front / back view (o.back) standing or walking (o.walk = cycle phase) */
function drawManFrontal(ctx, o) {
  const P0 = o.pal, s = o.s || 1, lw = (o.lw || 2.6) / s, t = o.t || 0, wind = o.wind ?? 0.7;
  const P = o.sil ? silPal(P0, o.sil) : P0;
  const back = !!o.back, wd = o.windDir ?? 1;
  const ph = o.walk ?? null;
  const sn = ph == null ? 0 : Math.sin(ph * TAU);
  const bob = ph == null ? 0 : -Math.abs(sn) * 8;
  const stoop = o.stoop || 0;
  ctx.save(); ctx.translate(0, bob);
  const L = o.light || [-6, -4];
  // legs
  for (const sx of [-1, 1]) {
    const lift = ph == null ? 0 : Math.max(0, sx * sn) * 34;
    const hipP = [sx * 30, -335], ank = [sx * 25, -22 - lift + (back ? 0 : 0)];
    const knee = [sx * 28, lerp(-178, -190, lift / 34) - lift * 0.4];
    const pth = limbPath(hipP[0], hipP[1], knee[0], knee[1], 26, 21); limbPath(knee[0], knee[1], ank[0], ank[1], 21, 17, pth);
    ink(ctx, pth, P.line, lw * 2.2);
    const shoe = back ? crPath([[ank[0] - 18, ank[1] + 4], [ank[0] - 16, ank[1] + 22], [ank[0] + 16, ank[1] + 22], [ank[0] + 18, ank[1] + 4]]) :
      crPath([[ank[0] - 20, ank[1] + 2], [ank[0] - 24, ank[1] + 20], [ank[0], ank[1] + 26], [ank[0] + 24, ank[1] + 20], [ank[0] + 20, ank[1] + 2]]);
    fillP(ctx, shoe, P.shoe); ink(ctx, shoe, P.line, lw);
    celFill(ctx, pth, sx < 0 ? P.pants : P.pantsS, P.pantsS, L[0], L[1]);
  }
  // coat
  const fl = wind * (0.6 + 0.4 * Math.sin(t * 7.7));
  const wv = Math.sin(t * 9.1) * 8 * wind;
  const hemL = [-84 + wd * 26 * fl - (wd < 0 ? 36 * fl : 0), -166 - (wd < 0 ? 26 * fl : 6 * fl) + wv];
  const hemR = [84 + wd * 26 * fl + (wd > 0 ? 36 * fl : 0), -166 - (wd > 0 ? 26 * fl : 6 * fl) - wv];
  const coat = crPath([
    [-26, -524], [-70, -510], [-78, -450], [-62, -360], [-72, -270], hemL.concat(1), [-40, -162 + wv * 0.5], [0, -156], [40, -162 - wv * 0.5], hemR.concat(1), [72, -270], [62, -360], [78, -450], [70, -510], [26, -524],
  ]);
  celFill(ctx, coat, P.coat, P.coatS, L[0] * 3, L[1] * 2); ink(ctx, coat, P.line, lw);
  if (!o.sil) {
    if (!back) {
      ctx.save(); ctx.clip(coat);
      const lining = crPath([[-20, -360], [-34, -150], [34, -150], [20, -360]]); fillP(ctx, lining, P.lining || P.coatS); ink(ctx, lining, P.line, lw * 0.8);
      const inner = crPath([[-18, -518], [-20, -350, 1], [20, -350, 1], [18, -518]]);
      fillP(ctx, inner, P.shirt); shadeIn(ctx, inner, crPath([[2, -520], [30, -520], [30, -340], [2, -340]]), P.shirtS);
      ink(ctx, inner, P.line, lw * 0.8);
      ctx.restore();
      const lap = new Path2D(); lap.moveTo(-22, -518); lap.lineTo(-40, -446); lap.lineTo(-22, -362); lap.moveTo(22, -518); lap.lineTo(40, -446); lap.lineTo(22, -362);
      ink(ctx, lap, P.line, lw * 0.9);
      const vn = crPath([[-14, -528], [0, -490], [14, -528]]); fillP(ctx, vn, P.skin); ink(ctx, vn, P.line, lw * 0.6);
    } else {
      const seam = new Path2D(); seam.moveTo(0, -500); seam.lineTo(0, -330); seam.lineTo(wv * 0.2, -152); seam.moveTo(-70, -350); seam.quadraticCurveTo(0, -340, 70, -350);
      ink(ctx, seam, P.coatS, lw * 0.9);
    }
    const fold = new Path2D(); fold.moveTo(-60, -320); fold.lineTo(hemL[0] + 20, hemL[1] + 4); fold.moveTo(60, -320); fold.lineTo(hemR[0] - 20, hemR[1] + 4);
    ink(ctx, fold, P.coatS, lw * 0.8);
  }
  // arms
  for (const sx of [-1, 1]) {
    const swing = ph == null ? 0 : sx * sn * 14;
    const shP = [sx * 66, -498], el = [sx * 80, -390 + swing * 0.3], wr = [sx * 74 + (o.handIn || 0) * -sx, -300 + swing];
    const pth = limbPath(shP[0], shP[1], el[0], el[1], 17, 15); limbPath(el[0], el[1], wr[0], wr[1], 15, 13, pth);
    ink(ctx, pth, P.line, lw * 2.2);
    celFill(ctx, pth, sx < 0 ? P.coat : P.coatS, P.coatS, L[0], L[1]);
    const hd = ellPath(wr[0], wr[1] + 18, 11, 16);
    fillP(ctx, hd, back ? P.skinS : P.skin); ink(ctx, hd, P.line, lw);
  }
  // head
  ctx.save(); ctx.translate(0, -560 + stoop * 20); ctx.rotate(o.headTilt || 0); ctx.scale(HS, HS);
  if (back) drawHeadBack(ctx, { pal: P, s: s * HS, lw: o.lw || 2.6, t, wind });
  else drawHeadFront(ctx, { pal: P, s: s * HS, lw: o.lw || 2.6, t, wind, look: o.look || [0, -0.3], blink: o.blink });
  ctx.restore();
  ctx.restore();
}
