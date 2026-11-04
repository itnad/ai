/* ===================== painting primitives ===================== */
function soft(ctx, x, y, r, c, a, inner = 0) {
  if (r <= 0.5 || a <= 0) return;
  const g = ctx.createRadialGradient(x, y, r * inner, x, y, r);
  g.addColorStop(0, css(c, a)); g.addColorStop(1, css(c, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function softE(ctx, x, y, rx, ry, c, a, inner = 0) {
  if (rx <= 0.5 || ry <= 0.5) return;
  ctx.save(); ctx.translate(x, y); ctx.scale(1, ry / rx); soft(ctx, 0, 0, rx, c, a, inner); ctx.restore();
}
function glow(ctx, x, y, r, c, a, inner = 0) {
  const o = ctx.globalCompositeOperation; ctx.globalCompositeOperation = 'lighter';
  soft(ctx, x, y, r, c, a, inner); ctx.globalCompositeOperation = o;
}
function lg(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const s of stops) g.addColorStop(s[0], css(s[1], s[2] == null ? 1 : s[2]));
  return g;
}
function vfill(ctx, x, y, w, h, stops) { ctx.fillStyle = lg(ctx, 0, y, 0, y + h, stops); ctx.fillRect(x, y, w, h); }

/* gouache / brush texture inside the current clip */
function gouache(ctx, r, x, y, w, h, base, o = {}) {
  const n = o.n ?? 300, s0 = o.s0 ?? 3, s1 = o.s1 ?? 18, j = o.j ?? 14;
  const a0 = o.a0 ?? 0.05, a1 = o.a1 ?? 0.14, st = o.st ?? 2.6, ang = o.ang ?? 0, aj = o.aj ?? 0.35;
  const colFn = o.colFn;
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h;
    const rad = lerp(s0, s1, r() * r());
    const c = colFn ? colFn(px, py, r) : base;
    ctx.fillStyle = css(jitc(c, r, j), lerp(a0, a1, r()));
    ctx.beginPath(); ctx.ellipse(px, py, rad * st, rad, ang + (r() - 0.5) * aj, 0, TAU); ctx.fill();
  }
}
/* dry brush streaks */
function streaks(ctx, r, x, y, w, h, base, o = {}) {
  const n = o.n ?? 80, len0 = o.l0 ?? 20, len1 = o.l1 ?? 90, wd = o.w ?? 1.5, ang = o.ang ?? 0, a = o.a ?? 0.1, j = o.j ?? 20;
  ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + r() * h, L = lerp(len0, len1, r()), an = ang + (r() - 0.5) * 0.15;
    ctx.strokeStyle = css(jitc(base, r, j), a * (0.4 + r() * 0.8));
    ctx.lineWidth = wd * (0.5 + r());
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(an) * L, py + Math.sin(an) * L); ctx.stroke();
  }
}

/* Ghibli style cumulus: several overlapping lobes, flat bottoms, crisp lit edges */
function cloud(ctx, r, cx, cy, w, h, o) {
  const Lr = o.light || [0.25, -1], ln = Math.hypot(Lr[0], Lr[1]), L = [Lr[0] / ln, Lr[1] / ln];
  const lobes = o.lobes ?? Math.max(3, Math.round(w / 170));
  const list = [];
  for (let i = 0; i < lobes; i++) {
    const u = (i + 0.5) / lobes - 0.5 + (r() - 0.5) * 0.1;
    const prof = Math.pow(Math.max(0, 1 - 4 * u * u), 0.6);
    list.push({ x: cx + u * w, base: cy + h * 0.5 - r() * h * 0.06, w: (w / lobes) * (1.25 + r() * 0.5), h: h * (0.4 + 0.6 * prof) * (0.8 + r() * 0.3), depth: r() });
  }
  for (let i = 0; i < Math.max(1, lobes >> 1); i++) {
    const u = (r() - 0.5) * 0.5;
    list.push({ x: cx + u * w, base: cy + h * 0.5 - h * (0.25 + r() * 0.2), w: (w / lobes) * (1.3 + r() * 0.6), h: h * (0.55 + r() * 0.35), depth: -1 + r() * 0.5 });
  }
  list.sort((a, b) => a.depth - b.depth);
  if (o.haze) for (const lb of list) softE(ctx, lb.x, lb.base - lb.h * 0.4, lb.w * 0.8, lb.h * 0.8, o.haze, 0.07);
  for (const lb of list) drawLobe(ctx, r, lb, o, L);
}
function drawLobe(ctx, r, lb, o, L) {
  const puffs = [];
  const n = 6 + Math.floor(lb.w / 45);
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1), ang = Math.PI * (1 - u);
    const rad = lb.h * (0.16 + 0.2 * Math.sin(ang)) * (0.7 + r() * 0.6);
    puffs.push([lb.x + Math.cos(ang) * lb.w * 0.5, lb.base - Math.sin(ang) * lb.h * 0.72 + rad * 0.45, rad]);
  }
  for (let i = 0; i < n; i++) puffs.push([lb.x + (r() - 0.5) * lb.w * 0.7, lb.base - r() * lb.h * 0.45, lb.h * (0.24 + r() * 0.2)]);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9;
  for (const p of puffs) { x0 = Math.min(x0, p[0] - p[2]); x1 = Math.max(x1, p[0] + p[2]); y0 = Math.min(y0, p[1] - p[2]); }
  const pad = 4, bw = Math.ceil(x1 - x0 + pad * 2), bh = Math.ceil(lb.base - y0 + pad * 2);
  if (bw < 4 || bh < 4) return;
  const ox = x0 - pad, oy = y0 - pad;
  const sil = new Path2D();
  for (const p of puffs) { sil.moveTo(p[0] - ox + p[2], p[1] - oy); sil.arc(p[0] - ox, p[1] - oy, p[2], 0, TAU); }
  const [c, x] = mkC(bw, bh);
  x.beginPath(); x.rect(0, 0, bw, lb.base - oy); x.clip();
  x.fillStyle = css(o.mid); x.fill(sil);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = lg(x, 0, lb.base - oy - lb.h * 0.55, 0, lb.base - oy, [[0, o.dark, 0], [1, o.dark, 1]]); x.fillRect(0, 0, bw, bh);
  const avg = lb.h * 0.3;
  const band = (col, d, a) => {
    const [bc, bx] = mkC(bw, bh);
    bx.fillStyle = css(col); bx.fill(sil);
    bx.globalCompositeOperation = 'destination-out'; bx.translate(-L[0] * d, -L[1] * d); bx.fill(sil);
    x.globalAlpha = a; x.drawImage(bc, 0, 0); x.globalAlpha = 1;
  };
  band(mix(o.mid, o.lit, 0.5), avg * 0.75, 0.8);
  band(o.lit, avg * 0.42, 0.95);
  if (o.hi) band(o.hi, avg * 0.13, 0.9);
  for (let i = 0; i < 6; i++) { const p = puffs[Math.floor(r() * n)]; soft(x, p[0] - ox + L[0] * p[2] * 0.4, p[1] - oy + L[1] * p[2] * 0.4, p[2] * 0.9, o.lit, 0.18); }
  gouache(x, r, 0, 0, bw, bh, o.mid, { n: Math.round(bw * bh / 1400), s0: 2, s1: Math.max(3, lb.h * 0.06), j: 20, a0: 0.03, a1: 0.09 });
  if (o.rim) band(o.rim, 2.5, 0.6);
  ctx.drawImage(c, ox, oy);
}

function stars(ctx, r, x, y, w, h, n, col, fadeY) {
  for (let i = 0; i < n; i++) {
    const px = x + r() * w, py = y + Math.pow(r(), 1.6) * h;
    const fade = fadeY ? 1 - inv(y, y + fadeY, py) * 0.9 : 1;
    const s = r(); const rad = s < 0.92 ? 0.6 + r() * 0.9 : 1.4 + r() * 1.4;
    ctx.fillStyle = css(jitc(col, r, 40), (0.35 + r() * 0.65) * fade);
    ctx.beginPath(); ctx.arc(px, py, rad, 0, TAU); ctx.fill();
    if (s > 0.97) soft(ctx, px, py, rad * 6, col, 0.25 * fade);
  }
}

function moon(ctx, x, y, rad, col = [252, 246, 222], halo = [190, 205, 255]) {
  soft(ctx, x, y, rad * 9, halo, 0.10);
  soft(ctx, x, y, rad * 3.5, halo, 0.22);
  soft(ctx, x, y, rad * 1.7, col, 0.5);
  ctx.fillStyle = css(col); ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
  const r = RNG(77);
  ctx.save(); ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.clip();
  for (let i = 0; i < 9; i++) softE(ctx, x + (r() - 0.5) * rad * 1.3, y + (r() - 0.5) * rad * 1.3, rad * (0.2 + r() * 0.35), rad * (0.15 + r() * 0.3), [205, 200, 185], 0.35);
  ctx.restore();
}

/* film grain tiles + vignette, created once */
const POST = {};
function initPost() {
  POST.grain = [];
  for (let k = 0; k < 6; k++) {
    const [c, x] = mkC(256, 256); const img = x.createImageData(256, 256); const r = RNG(5000 + k);
    for (let i = 0; i < 256 * 256; i++) {
      const v = 128 + ((r() + r() + r() - 1.5) * 70);
      img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = c8(v); img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    POST.grain.push(c);
  }
  const [v, vx] = mkC(W, H);
  vx.fillStyle = '#fff'; vx.fillRect(0, 0, W, H);
  const g = vx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 1.05);
  g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(70,55,60,0.75)');
  vx.fillStyle = g; vx.fillRect(0, 0, W, H);
  POST.vig = v;
}
function postFX(ctx, f, o = {}) {
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = o.vig ?? 0.55; ctx.drawImage(POST.vig, 0, 0);
  ctx.globalAlpha = o.grain ?? 0.09; ctx.globalCompositeOperation = 'overlay';
  const tile = POST.grain[f % POST.grain.length];
  const pat = ctx.createPattern(tile, 'repeat');
  const ox = Math.floor(hash1(f * 3 + 1) * 256), oy = Math.floor(hash1(f * 7 + 5) * 256);
  ctx.translate(-ox, -oy); ctx.fillStyle = pat; ctx.fillRect(0, 0, W + 256, H + 256);
  ctx.restore();
}
