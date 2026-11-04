/* ===================== backgrounds: kitchen, tent street, music box ===================== */
function paintedRect(x, r, px, py, w, h, base, o = {}) {
  x.save(); x.beginPath(); x.rect(px, py, w, h); x.clip();
  x.fillStyle = lg(x, 0, py, 0, py + h, [[0, o.top || addc(base, [14, 12, 8])], [1, o.bot || scl(base, 0.82)]]); x.fillRect(px, py, w, h);
  gouache(x, r, px, py, w, h, base, { n: o.n ?? Math.min(600, w * h / 600), s0: o.s0 ?? 2, s1: o.s1 ?? 16, j: o.j ?? 16, a0: 0.04, a1: o.a1 ?? 0.14, st: o.st ?? 2.2, ang: o.ang ?? 0 });
  x.restore();
}
function buildKitchen() {
  const [c, x] = mkC(W, H), r = RNG(303);
  const wall = [196, 150, 96];
  // back wall (warm, lamp lit)
  paintedRect(x, r, 0, 0, W, 760, wall, { top: [150, 108, 70], bot: [214, 168, 110], n: 1800, s1: 26 });
  // wooden wainscot
  paintedRect(x, r, 0, 560, W, 220, [150, 96, 58], { n: 900, ang: Math.PI / 2, st: 4 });
  for (let i = 0; i < 26; i++) { x.strokeStyle = css([100, 60, 36], 0.6); x.lineWidth = 2; x.beginPath(); x.moveTo(i * 76 + 10, 560); x.lineTo(i * 76 + 10, 780); x.stroke(); }
  x.fillStyle = css([110, 70, 42]); x.fillRect(0, 552, W, 14);
  // window with night outside
  x.save(); x.beginPath(); x.rect(1220, 130, 420, 330); x.clip();
  vfill(x, 1220, 130, 420, 330, [[0, [22, 34, 72]], [1, [52, 66, 110]]]);
  stars(x, r, 1220, 130, 420, 200, 60, [220, 230, 255]);
  for (let i = 0; i < 6; i++) { x.fillStyle = css([18, 22, 40]); const bx = 1220 + i * 80 + r() * 30; x.fillRect(bx, 330 + r() * 60, 60 + r() * 40, 200); if (r() < 0.6) { x.fillStyle = css([255, 200, 120], 0.8); x.fillRect(bx + 14, 360 + r() * 50, 10, 14); } }
  x.restore();
  x.strokeStyle = css([96, 62, 40]); x.lineWidth = 16; x.strokeRect(1220, 130, 420, 330);
  x.lineWidth = 8; x.beginPath(); x.moveTo(1430, 130); x.lineTo(1430, 460); x.moveTo(1220, 290); x.lineTo(1640, 290); x.stroke();
  // curtain
  const cur = crPath([[1196, 112, 1], [1262, 112, 1], [1256, 260], [1272, 470, 1], [1196, 470, 1]]);
  fillP(x, cur, [176, 120, 92]); x.save(); x.clip(cur); for (let i = 0; i < 4; i++) { x.strokeStyle = css([130, 84, 62], 0.8); x.lineWidth = 3; x.beginPath(); x.moveTo(1206 + i * 16, 112); x.quadraticCurveTo(1212 + i * 16, 300, 1204 + i * 18, 470); x.stroke(); } x.restore(); ink(x, cur, [96, 60, 44], 2.5);
  // shelves with jars and bowls
  for (const [sx, sy, sw] of [[160, 250, 520], [180, 410, 480]]) {
    x.fillStyle = css([120, 76, 46]); x.fillRect(sx, sy, sw, 16); x.fillStyle = css([80, 50, 30], 0.6); x.fillRect(sx, sy + 16, sw, 10);
    let px = sx + 20;
    while (px < sx + sw - 40) {
      const jw = 30 + r() * 40, jh = 40 + r() * 70, col = r.pick([[200, 120, 80], [230, 220, 200], [120, 140, 110], [180, 150, 90], [90, 60, 50]]);
      const jar = crPath([[px, sy], [px + 2, sy - jh * 0.8], [px + jw * 0.2, sy - jh], [px + jw * 0.8, sy - jh], [px + jw - 2, sy - jh * 0.8], [px + jw, sy]]);
      celFill(x, jar, col, scl(col, 0.75), -6, -4); ink(x, jar, [90, 60, 40], 2);
      fillP(x, ellPath(px + jw * 0.3, sy - jh * 0.6, 3, jh * 0.2), [255, 245, 220], 0.5);
      px += jw + 10 + r() * 20;
    }
  }
  // fridge on the left
  const fr = crPath([[0, 120], [120, 110], [130, 800, 1], [0, 800, 1]]);
  celFill(x, fr, [214, 214, 196], [170, 168, 150], -12, 0); ink(x, fr, [90, 70, 56], 3);
  x.fillStyle = css([120, 110, 100]); x.fillRect(100, 300, 10, 100);
  // pendant lamp
  x.strokeStyle = css([60, 40, 30]); x.lineWidth = 3; x.beginPath(); x.moveTo(960, 0); x.lineTo(960, 210); x.stroke();
  const shade = crPath([[900, 270, 1], [930, 214], [990, 214], [1020, 270, 1]]); fillP(x, shade, [220, 190, 120]); ink(x, shade, [100, 70, 40], 3);
  glow(x, 960, 280, 700, [255, 180, 100], 0.18); glow(x, 960, 280, 160, [255, 220, 160], 0.45);
  // floor
  paintedRect(x, r, 0, 780, W, 300, [130, 86, 54], { top: [150, 102, 64], bot: [90, 58, 36], ang: 0, st: 5, n: 900 });
  for (let i = 0; i < 6; i++) { x.strokeStyle = css([80, 50, 30], 0.5); x.lineWidth = 2; x.beginPath(); x.moveTo(0, 800 + i * 50 + i * i * 6); x.lineTo(W, 800 + i * 50 + i * i * 6); x.stroke(); }
  return c;
}
function drawKitchenTable(x, P0) {
  const top = crPath([[560, 660], [1360, 660], [1440, 760], [480, 760]]);
  celFill(x, top, [176, 116, 68], [140, 90, 52], 0, -10); ink(x, top, [80, 50, 30], 3);
  x.fillStyle = css([120, 76, 44]); x.fillRect(480, 760, 960, 30);
  x.fillStyle = css([96, 60, 36]); x.fillRect(520, 790, 26, 200); x.fillRect(1374, 790, 26, 200);
  // bowls and dishes
  const items = [[700, 700, 46, [240, 236, 226]], [860, 690, 40, [230, 226, 210]], [1060, 690, 40, [230, 226, 210]], [1220, 700, 46, [240, 236, 226]], [960, 720, 70, [170, 80, 50]], [800, 730, 30, [120, 160, 90]], [1120, 730, 30, [200, 140, 70]]];
  for (const [bx, by, bw, col] of items) {
    const b = crPath([[bx - bw, by - 10], [bx + bw, by - 10], [bx + bw * 0.7, by + 16], [bx - bw * 0.7, by + 16]]);
    celFill(x, b, col, scl(col, 0.8), -6, -6); ink(x, b, [90, 60, 40], 2.4);
    fillP(x, ellPath(bx, by - 10, bw, 8), scl(col, 0.92)); ink(x, ellPath(bx, by - 10, bw, 8), [90, 60, 40], 2);
    if (col[0] > 220) fillP(x, ellPath(bx, by - 13, bw * 0.75, 6), [250, 250, 245]);
  }
}
/* family seated at the table (front view). gold 0..1 freezes them into a gilded relief */
function drawFamily(x, t, frozenT) {
  const tt = Math.min(t, frozenT);
  const members = [
    { kx: 720, ky: 470, pal: makePal(0.75), kind: 'man', style: 'man', body: [92, 104, 96], look: [0.3, 0.1], s: 1.0, mouth: 0 },
    { kx: 960, ky: 520, pal: makeWomanPal(), kind: 'woman', style: 'pig', body: [220, 140, 140], look: [0.1, -0.2], s: 0.78, mouth: 0.6 },
    { kx: 1200, ky: 476, pal: Object.assign(makeWomanPal(), { hair: [70, 60, 60], hairS: [46, 38, 40], hairH: [130, 110, 110] }), kind: 'woman', style: 'bun', body: [150, 120, 160], look: [-0.2, 0.1], s: 0.96, mouth: 0.4 },
  ];
  for (const m of members) {
    const sx = m.s, bob = Math.sin(tt * 2.1 + m.kx) * 3;
    x.save(); x.translate(m.kx, m.ky + bob); x.scale(sx, sx);
    const torso = crPath([[-110, 300, 1], [-96, 120], [-60, 90], [60, 90], [96, 120], [110, 300, 1]]);
    celFill(x, torso, m.body, scl(m.body, 0.75), -16, -6); ink(x, torso, LINE, 3 / sx);
    x.save(); x.scale(0.62, 0.62);
    drawHeadFront(x, { pal: m.pal, kind: m.kind, style: m.style, s: 0.62 * sx, lw: 2.6, t: tt, wind: 0.05, look: m.look, smile: m.mouth, blush: 0.6, mole: false });
    x.restore();
    x.restore();
  }
}
function buildTentStreet() {
  const [c, x] = mkC(W, H), r = RNG(404);
  vfill(x, 0, 0, W, 700, [[0, [10, 16, 36]], [1, [40, 50, 86]]]);
  stars(x, r, 0, 0, W, 420, 300, [220, 230, 255], 400);
  // buildings behind
  for (let i = 0; i < 12; i++) {
    const bx = i * 170 - 40 + r() * 40, bw = 150 + r() * 80, bh = 260 + r() * 300;
    const col = jitc([34, 40, 66], r, 12);
    paintedRect(x, r, bx, 700 - bh, bw, bh, col, { n: 120, s1: 10, a1: 0.18 });
    for (let k = 0; k < 10; k++) if (r() < 0.35) { const wx = bx + 14 + r() * (bw - 40), wy = 700 - bh + 20 + r() * (bh - 80); x.fillStyle = css(jitc([255, 196, 120], r, 30), 0.85); x.fillRect(wx, wy, 18, 24); glow(x, wx + 9, wy + 12, 30, [255, 180, 100], 0.15); }
  }
  // wet street
  vfill(x, 0, 700, W, 380, [[0, [44, 46, 70]], [1, [14, 14, 22]]]);
  for (let i = 0; i < 700; i++) { const yy = 700 + Math.pow(r(), 1.3) * 380, d = (yy - 700) / 380; x.fillStyle = css(jitc([70, 74, 110], r, 30), 0.06 + r() * 0.06); x.beginPath(); x.ellipse(r() * W, yy, 10 + d * 80, 1 + d * 5, 0, 0, TAU); x.fill(); }
  // the pojangmacha tent body (orange tarp glowing)
  const tent = crPath([[700, 700, 1], [700, 430, 1], [760, 380], [1240, 380], [1300, 430, 1], [1300, 700, 1]]);
  fillP(x, tent, [238, 120, 48]);
  x.save(); x.clip(tent);
  vfill(x, 680, 380, 640, 320, [[0, [255, 170, 80]], [0.6, [246, 128, 50]], [1, [200, 84, 30]]]);
  gouache(x, r, 700, 380, 600, 320, [255, 150, 70], { n: 500, s1: 18, a1: 0.12 });
  for (let i = 0; i < 7; i++) { x.strokeStyle = css([180, 70, 24], 0.6); x.lineWidth = 3; x.beginPath(); x.moveTo(720 + i * 90, 400); x.quadraticCurveTo(730 + i * 90, 560, 716 + i * 90, 700); x.stroke(); }
  x.restore();
  ink(x, tent, [90, 36, 16], 3);
  const roof = crPath([[680, 440], [760, 360], [1240, 360], [1320, 440], [1240, 420], [760, 420]]);
  celFill(x, roof, [210, 90, 36], [160, 60, 24], 0, -8); ink(x, roof, [90, 36, 16], 3);
  // bulbs on a string
  for (let i = 0; i < 9; i++) { const bx = 720 + i * 70, by = 446 + Math.sin(i / 8 * Math.PI) * 18; x.fillStyle = css([255, 236, 190]); x.beginPath(); x.arc(bx, by, 6, 0, TAU); x.fill(); glow(x, bx, by, 40, [255, 190, 110], 0.4); }
  glow(x, 1000, 560, 600, [255, 140, 60], 0.18);
  // reflections on the street
  x.save(); x.globalCompositeOperation = 'lighter';
  x.fillStyle = lg(x, 0, 700, 0, 1080, [[0, [255, 130, 50], 0.35], [1, [255, 130, 50], 0]]); x.fillRect(700, 700, 600, 380);
  x.restore();
  // plastic stools outside
  for (const [sx, sy] of [[640, 730], [1360, 740], [1420, 720]]) { const st = crPath([[sx - 26, sy - 50], [sx + 26, sy - 50], [sx + 30, sy, 1], [sx - 30, sy, 1]]); fillP(x, st, [200, 50, 50]); ink(x, st, [80, 20, 20], 2.5); }
  return c;
}
/* friends as shadows cast on the tent tarp */
function drawTentShadows(x, t, frozenT, gold) {
  const tt = Math.min(t, frozenT);
  x.save(); x.beginPath(); x.rect(700, 430, 600, 270); x.clip();
  const col = gold > 0 ? mix([120, 44, 16], [150, 110, 30], gold) : [120, 44, 16];
  x.fillStyle = css(col, 0.75);
  const figs = [[820, 0.0], [1000, 1.3], [1170, 2.4]];
  for (const [fx, ph] of figs) {
    const laugh = Math.abs(Math.sin(tt * 6 + ph)) * 8, lean = Math.sin(tt * 2 + ph) * 0.08;
    x.save(); x.translate(fx, 700); x.rotate(lean);
    x.beginPath(); x.ellipse(0, -200 - laugh, 34, 40, 0, 0, TAU); x.fill();
    x.beginPath(); x.moveTo(-70, 0); x.quadraticCurveTo(-70, -150, 0, -160 - laugh * 0.5); x.quadraticCurveTo(70, -150, 70, 0); x.fill();
    // raised glass arm
    const up = Math.sin(tt * 3 + ph) > 0.3;
    x.lineWidth = 22; x.lineCap = 'round'; x.strokeStyle = css(col, 0.75);
    x.beginPath(); x.moveTo(40, -130); x.lineTo(up ? 70 : 80, up ? -230 : -90); x.stroke();
    x.fillRect(up ? 60 : 72, up ? -262 : -110, 20, 30);
    x.restore();
  }
  x.restore();
}
function buildMusicBoxBG() {
  const [c, x] = mkC(W, H), r = RNG(505);
  vfill(x, 0, 0, W, H, [[0, [40, 26, 22]], [0.6, [70, 44, 30]], [1, [50, 32, 22]]]);
  // out of focus warm bokeh
  for (let i = 0; i < 45; i++) {
    const bx = r() * W, by = r() * 700, br = 30 + r() * 80, col = r.pick([[255, 190, 110], [255, 160, 90], [255, 220, 170], [220, 140, 80]]), a = 0.04 + r() * 0.07;
    x.save(); x.globalCompositeOperation = 'lighter';
    const g = x.createRadialGradient(bx, by, 0, bx, by, br); g.addColorStop(0, css(col, a * 0.6)); g.addColorStop(0.85, css(col, a)); g.addColorStop(1, css(col, 0));
    x.fillStyle = g; x.beginPath(); x.arc(bx, by, br, 0, TAU); x.fill();
    x.restore();
  }
  for (let i = 0; i < 8; i++) glow(x, r() * W, r() * 600, 200 + r() * 200, [255, 170, 90], 0.08);
  // table surface
  paintedRect(x, r, 0, 760, W, 320, [110, 66, 38], { top: [140, 88, 50], bot: [60, 36, 20], st: 6, n: 700 });
  glow(x, 960, 520, 700, [255, 170, 90], 0.15);
  return c;
}
/* walnut music box with spinning ballerina; gold 0..1 sweeps it into gold */
function drawMusicBox(x, t, spin, gold, lw = 3) {
  const wood = mix([120, 72, 40], [222, 176, 84], gold), woodS = mix([84, 48, 26], [170, 122, 44], gold), line = mix([50, 30, 20], [100, 66, 24], gold);
  const front = crPath([[700, 700, 1], [700, 900, 1], [1220, 900, 1], [1220, 700, 1]]);
  const topF = crPath([[700, 700, 1], [800, 640, 1], [1300, 640, 1], [1220, 700, 1]]);
  const side = crPath([[1220, 700, 1], [1300, 640, 1], [1300, 830, 1], [1220, 900, 1]]);
  celFill(x, front, wood, woodS, 0, 0); ink(x, front, line, lw);
  fillP(x, side, woodS); ink(x, side, line, lw);
  fillP(x, topF, mix(wood, [255, 240, 200], 0.1)); ink(x, topF, line, lw);
  // inlay
  const inl = crPath([[740, 730, 1], [740, 870, 1], [1180, 870, 1], [1180, 730, 1]]); ink(x, inl, mix([200, 160, 90], [255, 230, 150], gold), lw * 0.9);
  fillP(x, ellPath(960, 800, 40, 26), mix([90, 54, 30], [250, 210, 120], gold)); ink(x, ellPath(960, 800, 40, 26), line, lw * 0.8);
  // open lid (behind, standing up)
  const lid = crPath([[800, 640, 1], [820, 340, 1], [1320, 340, 1], [1300, 640, 1]]);
  celFill(x, lid, scl(wood, 0.85), woodS, 0, 0); ink(x, lid, line, lw);
  const mir = crPath([[850, 610, 1], [866, 380, 1], [1270, 380, 1], [1256, 610, 1]]);
  fillP(x, mir, mix([90, 80, 90], [230, 200, 130], gold));
  x.save(); x.clip(mir); x.globalCompositeOperation = 'lighter'; x.fillStyle = lg(x, 850, 380, 1270, 610, [[0, [255, 255, 255], 0.0], [0.45, [255, 240, 220], 0.25], [0.55, [255, 240, 220], 0.0]]); x.fillRect(850, 380, 420, 230); x.restore();
  ink(x, mir, line, lw * 0.8);
  // turntable + ballerina
  fillP(x, ellPath(1050, 660, 70, 16), mix([170, 40, 50], [240, 200, 110], gold)); ink(x, ellPath(1050, 660, 70, 16), line, lw * 0.8);
  x.save(); x.translate(1050, 660); x.scale(2.6, 2.6);
  drawBallerina(x, lw / 2.6, spin, mix([236, 220, 210], [230, 184, 96], gold), mix([190, 160, 160], [170, 120, 50], gold), mix([90, 60, 60], [90, 60, 24], gold));
  x.restore();
  // brass comb + cylinder visible through a gap
  fillP(x, ellPath(820, 670, 40, 10), mix([190, 150, 70], [255, 220, 130], gold));
}
