/* ===================== backgrounds: Seoul alley (intact / ruined) ===================== */
const BG = {};
const ALLEY = { HZ: 1340, F: 1000, CY: 1.6, CH: 1900 };
function aP(X, Y, Z) { return [960 + (ALLEY.F * X) / Z, ALLEY.HZ - (ALLEY.F * (Y - ALLEY.CY)) / Z]; }

function nightSky(x, r, w, h, o) {
  vfill(x, 0, 0, w, h, [[0, o.top], [0.5, o.mid], [1, o.low]]);
  if (o.stars) stars(x, r, 0, 0, w, h * 0.75, o.stars, [235, 238, 255], h * 0.7);
  if (o.moon) moon(x, o.moon[0], o.moon[1], o.moon[2], o.moonCol, o.halo);
  for (const c of o.clouds || []) cloud(x, r, c[0], c[1], c[2], c[3], o.cloud);
}

function buildAlley(ruined) {
  const CH = ALLEY.CH, HZ = ALLEY.HZ;
  const [c, x] = mkC(W, CH);
  const r = RNG(ruined ? 2024 : 1987);
  /* ---------- sky ---------- */
  const night = ruined
    ? { top: hx('#070a12'), mid: hx('#141b2c'), low: hx('#26304a'), stars: 120, moon: [1185, 300, 34], moonCol: [190, 196, 205], halo: [90, 105, 140],
        cloud: { dark: hx('#0b0f1a'), mid: hx('#151b2a'), lit: hx('#28324a'), hi: hx('#3a4662'), light: [0.35, -1] },
        clouds: [[1240, 330, 520, 110], [700, 520, 900, 170], [1350, 640, 700, 150]] }
    : { top: hx('#081029'), mid: hx('#18295a'), low: hx('#3d4f86'), stars: 650, moon: [1185, 250, 44], moonCol: [255, 248, 225], halo: [175, 195, 255],
        cloud: { dark: hx('#22305e'), mid: hx('#3a4d86'), lit: hx('#8696c8'), hi: hx('#c9d3f0'), rim: hx('#5d6ea6'), light: [0.45, -1], haze: hx('#6a7cb4') },
        clouds: [[760, 470, 820, 220], [1380, 600, 760, 200], [560, 780, 640, 150], [1150, 880, 900, 170]] };
  nightSky(x, r, W, HZ + 40, night);
  // far city haze at the end of the alley
  if (!ruined) { softE(x, 960, HZ - 20, 520, 260, [255, 170, 110], 0.22); softE(x, 960, HZ - 10, 160, 90, [255, 200, 150], 0.35); }

  /* ---------- ground ---------- */
  const g0 = aP(-3.3, 0, 1.0), g1 = aP(-3.3, 0, 120), g2 = aP(3.3, 0, 120), g3 = aP(3.3, 0, 1.0);
  const ground = polyPath([g0, g1, g2, g3]);
  x.save(); x.clip(ground);
  vfill(x, 0, HZ, W, CH - HZ, ruined
    ? [[0, hx('#141822')], [0.4, hx('#0e1119')], [1, hx('#07080c')]]
    : [[0, hx('#3a3f5e')], [0.25, hx('#262a40')], [1, hx('#11131d')]]);
  for (let i = 0; i < 1400; i++) {
    const yy = HZ + 6 + Math.pow(r(), 1.4) * (CH - HZ); const d = (yy - HZ) / (CH - HZ);
    const xx = 960 + (r() - 0.5) * (200 + d * 2400);
    x.fillStyle = css(ruined ? jitc([40, 44, 55], r, 20) : jitc([70, 78, 112], r, 30), 0.05 + r() * 0.08);
    x.beginPath(); x.ellipse(xx, yy, 6 + d * 60 * r(), 1 + d * 6 * r(), 0, 0, TAU); x.fill();
  }
  // wet sheen: sky reflected down the middle of the road
  if (!ruined) softE(x, 960, HZ + 140, 260, 320, [120, 140, 205], 0.18);
  x.restore();
  // puddles
  const puddles = ruined ? [] : [[-0.8, 5.2, 1.4], [1.3, 12, 1.8], [-1.6, 22, 2.2], [0.6, 3.1, 0.7]];
  for (const [px, pz, pr] of puddles) {
    const a = aP(px, 0, pz), rx = (ALLEY.F * pr) / pz, ry = rx * (1.6 / pz) * 0.9;
    softE(x, a[0], a[1], rx, Math.max(2, ry), [16, 20, 36], 0.5);
    x.save(); x.globalCompositeOperation = 'lighter'; softE(x, a[0], a[1] - ry * 0.2, rx * 0.8, Math.max(2, ry * 0.6), [70, 90, 150], 0.25); x.restore();
  }

  /* ---------- buildings ---------- */
  const bases = ['#9a9a92', '#b4a184', '#8c574a', '#5f8a84', '#869a7a', '#bdbbb2', '#9a6a4a', '#7b7f8c', '#a89a7a'].map(hx);
  const segs = [];
  for (const side of [-1, 1]) {
    let z = 0.9;
    while (z < 110) {
      const len = r.range(3.2, 9) * (z < 25 ? 1 : 1.5);
      segs.push({ side, X: side * (3.15 + r.range(0, 0.35)), z0: z, z1: z + len, h: r.range(6.5, 17), base: r.pick(bases), seed: r.int(1, 1e9) });
      z += len;
    }
  }
  segs.sort((a, b) => b.z0 - a.z0);
  const nightT = ruined ? [66, 74, 100] : [92, 104, 156];
  const haze = ruined ? [34, 40, 58] : [70, 84, 130];
  const lampZ = 8.5, lamp = [2.15, 5.15, lampZ];
  const reflections = [];
  for (const s of segs) drawBuilding(x, s, ruined, nightT, haze, reflections);

  /* ---------- poles & wires ---------- */
  drawWires(x, r, ruined);

  /* ---------- lamp ---------- */
  const lb = aP(2.8, 0, lampZ), lt = aP(2.8, 5.3, lampZ), la = aP(lamp[0], lamp[1], lampZ);
  x.strokeStyle = css([20, 22, 30]); x.lineCap = 'round';
  x.lineWidth = 14; x.beginPath(); x.moveTo(lb[0], lb[1]); x.lineTo(lt[0], lt[1]); x.stroke();
  x.lineWidth = 7; x.beginPath(); x.moveTo(lt[0], lt[1]); x.quadraticCurveTo(lt[0] - 20, lt[1] - 30, la[0], la[1] - 6); x.stroke();
  x.fillStyle = css([24, 26, 34]); x.beginPath(); x.ellipse(la[0], la[1], 34, 12, 0, 0, TAU); x.fill();
  if (!ruined) {
    x.fillStyle = css([255, 236, 190]); x.beginPath(); x.ellipse(la[0], la[1] + 6, 22, 7, 0, 0, TAU); x.fill();
    glow(x, la[0], la[1] + 8, 520, [255, 150, 70], 0.16);
    glow(x, la[0], la[1] + 8, 160, [255, 190, 110], 0.4);
    glow(x, la[0], la[1] + 8, 50, [255, 240, 200], 0.7);
    // light pool on the ground
    const gp = aP(2.0, 0, lampZ);
    x.save(); x.globalCompositeOperation = 'lighter'; softE(x, gp[0] - 30, gp[1], 470, 90, [255, 160, 80], 0.35); x.restore();
    // cone
    x.save(); x.globalCompositeOperation = 'lighter';
    x.fillStyle = lg(x, 0, la[1], 0, gp[1], [[0, [255, 190, 120], 0.13], [1, [255, 170, 90], 0.0]]);
    x.beginPath(); x.moveTo(la[0] - 18, la[1] + 8); x.lineTo(la[0] + 18, la[1] + 8); x.lineTo(gp[0] + 330, gp[1] + 40); x.lineTo(gp[0] - 380, gp[1] + 40); x.fill();
    x.restore();
    reflections.push([la[0], ALLEY.HZ + (ALLEY.F * (lamp[1] + ALLEY.CY)) / lampZ, 34, [255, 170, 90], 0.5, gp[1]]);
  } else {
    // broken lamp head hanging
    x.fillStyle = css([12, 13, 18]); x.beginPath(); x.ellipse(la[0] + 4, la[1] + 10, 30, 10, 0.5, 0, TAU); x.fill();
  }
  // reflections of lights on the wet road
  if (!ruined) {
    x.save(); x.clip(ground); x.globalCompositeOperation = 'lighter';
    for (const [rx_, ry_, rw, col, a, ytop] of reflections) {
      const top = Math.max(ytop ?? HZ, HZ);
      x.fillStyle = lg(x, 0, top, 0, Math.min(CH, ry_ + 140), [[0, col, a * 0.1], [0.6, col, a * 0.35], [1, col, 0]]);
      x.fillRect(rx_ - rw / 2, top, rw, Math.min(CH, ry_ + 140) - top);
      for (let k = 0; k < 6; k++) { const yy = lerp(top, Math.min(CH, ry_ + 100), r()); x.fillStyle = css(col, a * 0.25); x.fillRect(rx_ - rw * (0.3 + r()), yy, rw * (0.6 + 2 * r()), 2 + r() * 3); }
    }
    x.restore();
  }
  /* ---------- rubble (ruined) ---------- */
  if (ruined) drawRubble(x, r);
  /* ---------- atmosphere ---------- */
  x.save(); x.globalCompositeOperation = 'lighter';
  softE(x, 960, HZ, 900, 260, ruined ? [30, 36, 52] : [60, 70, 120], 0.25);
  x.restore();
  return c;
}

function drawBuilding(x, s, ruined, nightT, haze, reflections) {
  const r = RNG(s.seed);
  const { X, z0, z1, h, side } = s;
  const zm = (z0 + z1) / 2;
  const hz = clamp((zm - 4) / 80) * 0.75;
  const base = mix(mul(s.base, nightT), haze, hz);
  // roofline (jagged when ruined)
  const roof = [];
  if (!ruined) { roof.push([z0, h], [z1, h]); }
  else {
    // broken slabs: a flat remnant, a slanted break, a lower remnant
    const a = h * r.range(0.55, 0.85), b = h * r.range(0.3, 0.55), zc = lerp(z0, z1, r.range(0.3, 0.7));
    roof.push([z0, a], [lerp(z0, zc, 0.8), a], [lerp(zc, z1, 0.15), b + (a - b) * 0.3], [lerp(zc, z1, 0.3), b], [z1, b]);
  }
  const front = [aP(X, 0, z0), aP(X, roof[0][1], z0), aP(X + side * 9, roof[0][1], z0), aP(X + side * 9, 0, z0)];
  const facade = [aP(X, 0, z0), ...roof.map((q) => aP(X, q[1], q[0])), aP(X, 0, z1)];
  // front face (darker, faces camera)
  const fp = polyPath(front);
  fillP(x, fp, scl(base, 0.62));
  x.save(); x.clip(fp); gouache(x, r, Math.min(front[0][0], front[2][0]), front[1][1], Math.abs(front[2][0] - front[0][0]) + 2, front[0][1] - front[1][1], scl(base, 0.62), { n: 40, s0: 2, s1: 400 / z0, a1: 0.1 }); x.restore();
  const pth = polyPath(facade);
  const yTop = Math.min(...facade.map((p) => p[1])), yBot = Math.max(...facade.map((p) => p[1]));
  const xMin = Math.min(...facade.map((p) => p[0])), xMax = Math.max(...facade.map((p) => p[0]));
  x.save(); x.clip(pth);
  x.fillStyle = lg(x, 0, yTop, 0, yBot, [[0, addc(base, [26, 30, 46])], [0.5, base], [1, scl(base, 0.7)]]);
  x.fillRect(xMin - 2, yTop - 2, xMax - xMin + 4, yBot - yTop + 4);
  const sz = 900 / zm;
  gouache(x, r, xMin, yTop, xMax - xMin, yBot - yTop, base, { n: Math.min(500, 30 + ((xMax - xMin) * (yBot - yTop)) / 1400), s0: 1, s1: sz, j: 18, st: 1.6, ang: Math.PI / 2, a0: 0.05, a1: 0.16 });
  // stains streaking down
  streaks(x, r, xMin, yTop, xMax - xMin, yBot - yTop, scl(base, 0.75), { n: 10 + (xMax - xMin) / 20, l0: 40 / zm * 10, l1: 200 / zm * 10, w: 50 / zm, ang: Math.PI / 2, a: 0.12 });
  // floors / windows
  const lit = [];
  const hMin = Math.min(...roof.map((q) => q[1]));
  for (let fy = 3.6; fy + 1.8 < h; fy += 3.0) {
    let z = z0 + r.range(0.4, 0.9);
    while (z + 1.0 < z1 - 0.3) {
      const ww = r.range(0.9, 1.5), wy = fy + 0.9, wh = r.range(1.1, 1.5);
      const za = z, zb = Math.min(z + ww, z1 - 0.3);
      if (ruined && wy + wh > hMin) { z += ww + r.range(0.6, 1.4); continue; }
      const q = polyPath([aP(X, wy, za), aP(X, wy + wh, za), aP(X, wy + wh, zb), aP(X, wy, zb)]);
      const isLit = !ruined && r() < 0.32;
      if (isLit) {
        const wc = jitc([255, 196, 120], r, 40);
        const a = aP(X, wy, za), b = aP(X, wy + wh, zb);
        x.fillStyle = lg(x, 0, b[1], 0, a[1], [[0, mix(wc, [255, 240, 210], 0.3)], [1, scl(wc, 0.8)]]); x.fill(q);
        if (r() < 0.6) { x.save(); x.clip(q); const cur = aP(X, wy + wh, lerp(za, zb, r.range(0.3, 0.6))); x.fillStyle = css(scl(wc, 0.62), 0.9); x.fillRect(side < 0 ? Math.min(a[0], b[0]) : cur[0], b[1] - 5, Math.abs(cur[0] - a[0]), a[1] - b[1] + 10); x.restore(); }
        lit.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]), wc]);
      } else {
        const a = aP(X, wy, za), b = aP(X, wy + wh, zb);
        x.fillStyle = lg(x, 0, b[1], 0, a[1], ruined ? [[0, [8, 9, 12]], [1, [14, 15, 20]]] : [[0, mix([40, 52, 90], haze, hz)], [1, mix([18, 22, 40], haze, hz)]]); x.fill(q);
        if (ruined && r() < 0.5) { x.save(); x.clip(q); x.strokeStyle = css([60, 64, 76], 0.5); x.lineWidth = 1; x.beginPath(); x.moveTo(a[0], a[1]); x.lineTo(lerp(a[0], b[0], 0.6), lerp(a[1], b[1], 0.3)); x.lineTo(b[0], b[1]); x.stroke(); x.restore(); }
      }
      ink(x, q, scl(base, 0.55), Math.max(0.6, 26 / zm), 0.9);
      // sill
      const s1 = aP(X, wy - 0.08, za), s2 = aP(X, wy - 0.08, zb);
      x.strokeStyle = css(addc(base, [30, 30, 40])); x.lineWidth = Math.max(0.6, 40 / zm); x.beginPath(); x.moveTo(s1[0], s1[1]); x.lineTo(s2[0], s2[1]); x.stroke();
      // AC unit / bars
      if (!ruined && r() < 0.25) {
        const ac = polyPath([aP(X, wy - 0.95, za + 0.1), aP(X, wy - 0.25, za + 0.1), aP(X, wy - 0.25, za + 0.9), aP(X, wy - 0.95, za + 0.9)]);
        fillP(x, ac, mix([120, 126, 140], base, 0.5)); ink(x, ac, scl(base, 0.5), Math.max(0.5, 18 / zm));
      }
      z += ww + r.range(0.6, 1.6);
    }
  }
  // ground floor: shutters / shop fronts
  {
    const za = z0 + 0.3, zb = z1 - 0.3;
    if (zb > za + 0.8) {
      const sh = polyPath([aP(X, 0, za), aP(X, 2.9, za), aP(X, 2.9, zb), aP(X, 0, zb)]);
      const shopLit = !ruined && r() < 0.22;
      const a = aP(X, 0, za), b = aP(X, 2.9, zb);
      if (shopLit) {
        const wc = jitc([236, 168, 100], r, 24);
        x.fillStyle = lg(x, 0, b[1], 0, a[1], [[0, scl(wc, 0.8)], [0.6, scl(wc, 0.6)], [1, scl(wc, 0.38)]]); x.fill(sh);
        x.save(); x.clip(sh);
        for (let zz = za + 0.6; zz < zb; zz += 1.1) { const m1 = aP(X, 0, zz), m2 = aP(X, 2.9, zz); x.strokeStyle = css(scl(wc, 0.3)); x.lineWidth = Math.max(1, 40 / zm); x.beginPath(); x.moveTo(m1[0], m1[1]); x.lineTo(m2[0], m2[1]); x.stroke(); }
        for (const yy of [0.9, 1.7]) { const s1_ = aP(X, yy, za), s2_ = aP(X, yy, zb); x.strokeStyle = css(scl(wc, 0.45), 0.8); x.lineWidth = Math.max(1, 30 / zm); x.beginPath(); x.moveTo(s1_[0], s1_[1]); x.lineTo(s2_[0], s2_[1]); x.stroke(); }
        gouache(x, r, Math.min(a[0], b[0]), b[1], Math.abs(b[0] - a[0]), a[1] - b[1], scl(wc, 0.5), { n: 60, s0: 2, s1: 300 / zm, a1: 0.25 });
        x.restore();
        lit.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.abs(b[0] - a[0]), wc]);
        reflections.push([(a[0] + b[0]) / 2, ALLEY.HZ + (ALLEY.F * (1.5 + ALLEY.CY)) / zm, Math.abs(b[0] - a[0]) * 0.6, wc, 0.35, a[1]]);
      } else {
        const sc = ruined ? [26, 28, 34] : mix([92, 98, 112], haze, hz);
        x.fillStyle = lg(x, 0, b[1], 0, a[1], [[0, sc], [1, scl(sc, 0.6)]]); x.fill(sh);
        x.save(); x.clip(sh); x.strokeStyle = css(scl(sc, 0.65)); x.lineWidth = Math.max(0.5, 10 / zm);
        for (let zz = za; zz < zb; zz += 0.12) { const p1 = aP(X, 0, zz), p2 = aP(X, 2.9, zz); x.beginPath(); x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]); x.stroke(); }
        x.restore();
      }
      ink(x, sh, scl(base, 0.45), Math.max(0.6, 30 / zm));
      // awning
      if (!ruined && r() < 0.5) {
        const ac = r.pick([[150, 60, 50], [60, 100, 120], [170, 140, 70], [80, 110, 80]]);
        const aw = polyPath([aP(X, 3.1, za), aP(X - side * 0.9, 2.7, za), aP(X - side * 0.9, 2.7, zb), aP(X, 3.1, zb)]);
        fillP(x, aw, mix(mul(ac, nightT), haze, hz)); ink(x, aw, scl(base, 0.4), Math.max(0.5, 18 / zm));
      }
    }
  }
  // pipes
  for (let k = 0; k < 2; k++) {
    if (r() < 0.5) continue;
    const zz = lerp(z0, z1, r()); const p1 = aP(X - side * 0.05, 0, zz), p2 = aP(X - side * 0.05, Math.min(h, hMin) - 0.3, zz);
    x.strokeStyle = css(scl(base, 0.6)); x.lineWidth = Math.max(0.8, 90 / zz); x.beginPath(); x.moveTo(p1[0], p1[1]); x.lineTo(p2[0], p2[1]); x.stroke();
    x.strokeStyle = css(addc(base, [20, 22, 30]), 0.6); x.lineWidth = Math.max(0.4, 30 / zz); x.beginPath(); x.moveTo(p1[0] + side * 20 / zz, p1[1]); x.lineTo(p2[0] + side * 20 / zz, p2[1]); x.stroke();
  }
  x.restore();
  // roof edge line
  const rp = new Path2D(); rp.moveTo(facade[1][0], facade[1][1]); for (let i = 2; i < facade.length - 1; i++) rp.lineTo(facade[i][0], facade[i][1]);
  ink(x, rp, scl(base, 0.45), Math.max(0.8, 40 / zm));
  // window glows
  if (!ruined) for (const [wx, wy, ww, wc] of lit) glow(x, wx, wy, ww * 1.6 + 10, wc, 0.12);
  // vertical sign boards protruding into the alley
  if (!ruined && r() < 0.55 && z0 < 60) {
    const zs = lerp(z0, z1, 0.3 + r() * 0.4), ys = r.range(3.2, 6.5), hgt = r.range(1.6, 2.6);
    const col = r.pick([[235, 80, 70], [80, 210, 200], [250, 230, 160], [120, 170, 255], [255, 150, 70]]);
    const sg = polyPath([aP(X, ys, zs), aP(X, ys + hgt, zs), aP(X - side * 0.62, ys + hgt, zs), aP(X - side * 0.62, ys, zs)]);
    const a = aP(X, ys, zs), b = aP(X - side * 0.62, ys + hgt, zs);
    x.fillStyle = css(mix(col, [255, 255, 255], 0.25)); x.fill(sg);
    x.save(); x.clip(sg); x.fillStyle = css(scl(col, 0.75), 0.9);
    const ins = polyPath([aP(X - side * 0.1, ys + 0.12, zs), aP(X - side * 0.1, ys + hgt - 0.12, zs), aP(X - side * 0.52, ys + hgt - 0.12, zs), aP(X - side * 0.52, ys + 0.12, zs)]);
    x.fill(ins); x.restore();
    ink(x, sg, [20, 22, 30], Math.max(0.8, 30 / zs));
    glow(x, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 900 / zs, col, 0.25);
    reflections.push([(a[0] + b[0]) / 2, ALLEY.HZ + (ALLEY.F * (ys + hgt / 2 + ALLEY.CY)) / zs, Math.max(4, Math.abs(b[0] - a[0]) * 0.8), col, 0.45, ALLEY.HZ + (ALLEY.F * ALLEY.CY) / zs]);
  }
}

function catenary(a, b, sag, n = 28) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const X = lerp(a[0], b[0], u), Y = lerp(a[1], b[1], u) - sag * 4 * u * (1 - u), Z = lerp(a[2], b[2], u);
    pts.push(aP(X, Y, Z));
  }
  return pts;
}
function strokeWire(x, pts, w, col) {
  x.strokeStyle = css(col); x.lineWidth = w; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath(); x.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]); x.stroke();
}
function drawWires(x, r, ruined) {
  const poles = [[-2.85, 5.6], [2.85, 13], [-2.85, 21], [2.85, 31], [-2.85, 44], [2.85, 60], [-2.85, 80]];
  const col = ruined ? [8, 9, 12] : [12, 14, 26];
  // pole bodies (far to near)
  for (let i = poles.length - 1; i >= 0; i--) {
    const [X, Z] = poles[i];
    const b = aP(X, 0, Z), t = aP(X, 10, Z), w = (ALLEY.F * 0.28) / Z;
    x.fillStyle = css(col); x.beginPath(); x.moveTo(b[0] - w / 2, b[1]); x.lineTo(t[0] - w * 0.35, t[1]); x.lineTo(t[0] + w * 0.35, t[1]); x.lineTo(b[0] + w / 2, b[1]); x.fill();
    const ca = aP(X - 0.9, 9.4, Z), cb = aP(X + 0.9, 9.4, Z);
    x.lineWidth = Math.max(1, w * 0.4); x.strokeStyle = css(col); x.beginPath(); x.moveTo(ca[0], ca[1]); x.lineTo(cb[0], cb[1]); x.stroke();
    if (i % 2 === 0) { const tr = aP(X - Math.sign(X) * 0.3, 7.8, Z); x.fillStyle = css(col); x.beginPath(); x.ellipse(tr[0], tr[1], w * 1.2, w * 1.9, 0, 0, TAU); x.fill(); }
    // moonlit rim on the pole
    if (!ruined) { x.strokeStyle = css([110, 125, 175], 0.35); x.lineWidth = Math.max(0.5, w * 0.15); x.beginPath(); x.moveTo(b[0] + w * 0.4, b[1]); x.lineTo(t[0] + w * 0.3, t[1]); x.stroke(); }
  }
  // wires
  const wires = [];
  for (let i = 0; i < poles.length - 1; i++) {
    const [X1, Z1] = poles[i], [X2, Z2] = poles[i + 1];
    for (let k = 0; k < 4; k++) {
      const y1 = 9.4 - k * 0.35, y2 = 9.4 - k * 0.35 + r.range(-0.2, 0.2);
      wires.push([[X1 + r.range(-0.8, 0.8), y1, Z1], [X2 + r.range(-0.8, 0.8), y2, Z2], r.range(0.5, 1.3)]);
    }
    // wires into buildings
    for (let k = 0; k < 2; k++) {
      const s2 = r.sign();
      wires.push([[X1, 8.8 - k * 0.5, Z1], [s2 * 3.1, r.range(5, 11), Z1 + r.range(2, 9)], r.range(0.2, 0.8)]);
    }
  }
  // very near crossing wires (they frame the sky)
  wires.push([[-6, 11, 2.5], [6, 12.5, 3.5], 0.9], [[-6, 13.5, 3.2], [6, 12, 2.6], 1.1], [[-5, 9.5, 2.0], [5, 10.5, 4.2], 0.7]);
  for (const [a, b, sag] of wires) {
    const zm = (a[2] + b[2]) / 2;
    let pts = catenary(a, b, sag);
    if (ruined && r() < 0.4) { // snapped wire hanging down
      const cut = Math.floor(pts.length * r.range(0.3, 0.6));
      pts = pts.slice(0, cut);
      const last = pts[pts.length - 1];
      for (let k = 1; k < 10; k++) pts.push([last[0] + Math.sin(k * 0.5) * 6, last[1] + k * (ALLEY.F * 0.5) / zm]);
    }
    strokeWire(x, pts, Math.max(0.9, (ALLEY.F * 0.022) / zm), col);
  }
}

function drawRubble(x, r) {
  for (let i = 0; i < 26; i++) {
    const side = r.sign(), Z = r.range(2.5, 60), Xc = side * r.range(1.8, 3.1), sz = r.range(0.6, 1.8);
    const c = aP(Xc, 0, Z), w = (ALLEY.F * sz) / Z, hh = w * r.range(0.35, 0.7);
    const pts = [];
    const n = 9;
    for (let k = 0; k <= n; k++) { const u = k / n; pts.push([c[0] - w + 2 * w * u + (r() - 0.5) * w * 0.2, c[1] - Math.sin(u * Math.PI) * hh * (0.6 + r() * 0.5)]); }
    pts.push([c[0] + w, c[1] + 4], [c[0] - w, c[1] + 4]);
    const p = polyPath(pts);
    const gj = (r() - 0.5) * 14; const col = [30 + gj, 33 + gj, 42 + gj];
    fillP(x, p, col);
    x.save(); x.clip(p); gouache(x, r, c[0] - w, c[1] - hh, w * 2, hh + 4, addc(col, [14, 16, 24]), { n: 30, s0: 1, s1: w * 0.15, st: 1.2, a1: 0.35 }); x.restore();
    // broken slab / bricks sticking out
    for (let k = 0; k < 3; k++) { const bx = c[0] + (r() - 0.5) * w, by = c[1] - hh * r() * 0.8; x.save(); x.translate(bx, by); x.rotate((r() - 0.5) * 1.6); x.fillStyle = css(addc(col, [10, 10, 14])); x.fillRect(-w * 0.15, -w * 0.04, w * 0.3, w * 0.08); x.restore(); }
  }
}

function buildSkyClose(moonAt, moonR, seed) {
  const [c, x] = mkC(W, H), r = RNG(seed);
  nightSky(x, r, W, H, { top: hx('#070e26'), mid: hx('#17285a'), low: hx('#3a4c84'), stars: 500, moon: [moonAt[0], moonAt[1], moonR], moonCol: [255, 248, 225], halo: [175, 195, 255],
    cloud: { dark: hx('#22305e'), mid: hx('#3a4d86'), lit: hx('#8696c8'), hi: hx('#c9d3f0'), rim: hx('#5d6ea6'), light: [0.4, -1], haze: hx('#6a7cb4') },
    clouds: [[400, 900, 1100, 300], [1500, 980, 1000, 260], [200, 420, 600, 160]] });
  // out-of-focus wires across the sky
  for (const [y0, y1, sag, wd] of [[160, 420, 120, 9], [60, 300, 160, 6], [700, 520, 90, 12]]) {
    x.strokeStyle = css([8, 10, 22], 0.35); x.lineWidth = wd * 2.2; x.beginPath(); x.moveTo(-50, y0); x.quadraticCurveTo(960, (y0 + y1) / 2 + sag, W + 50, y1); x.stroke();
    x.strokeStyle = css([8, 10, 22], 0.8); x.lineWidth = wd; x.stroke();
  }
  return c;
}
