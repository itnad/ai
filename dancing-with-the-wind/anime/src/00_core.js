'use strict';
/* ===================== core ===================== */
const W = 1920, H = 1080, FPS = 24, DUR = 91, NF = DUR * FPS;
const TAU = Math.PI * 2;

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function RNG(seed) {
  const r = mulberry32(seed >>> 0);
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => a + Math.floor((b - a + 1) * r());
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < 0.5 ? -1 : 1);
  return r;
}
function hash1(n) {
  n = Math.imul(n | 0, 374761393) ^ 0x9E3779B9;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function hash2(a, b) { return hash1(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)); }
function hash3(a, b, c) { return hash1(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791)); }

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const inv = (a, b, x) => clamp((x - a) / (b - a));
const sstep = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
const E = {
  inS: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outS: (t) => Math.sin((t * Math.PI) / 2),
  io: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  ioC: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outC: (t) => 1 - Math.pow(1 - t, 3),
  inC: (t) => t * t * t,
  outQ: (t) => 1 - (1 - t) * (1 - t),
  inQ: (t) => t * t,
};
function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash2(i, seed), b = hash2(i + 1, seed);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}
function fbm1(x, seed = 0) {
  return noise1(x, seed) * 0.55 + noise1(x * 2.13, seed + 7) * 0.3 + noise1(x * 4.37, seed + 13) * 0.15;
}
/* wind gust strength 0..1 as a pure function of time (shared by picture and sound) */
function gust(t) { return clamp(0.25 + 0.95 * (fbm1(t * 0.55, 991) - 0.3)); }

/* ---------- colour ---------- */
function hx(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function c8(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }
function css(c, a = 1) { return 'rgba(' + c8(c[0]) + ',' + c8(c[1]) + ',' + c8(c[2]) + ',' + (a < 0 ? 0 : a > 1 ? 1 : +a.toFixed(4)) + ')'; }
function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
function mul(a, b) { return [(a[0] * b[0]) / 255, (a[1] * b[1]) / 255, (a[2] * b[2]) / 255]; }
function scl(a, k) { return [a[0] * k, a[1] * k, a[2] * k]; }
function addc(a, b, k = 1) { return [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k]; }
function jitc(c, r, a) { return [c[0] + (r() - 0.5) * a, c[1] + (r() - 0.5) * a, c[2] + (r() - 0.5) * a]; }
function lum(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
function desat(c, k) { const l = lum(c) * 255; return mix(c, [l, l, l], k); }

/* ---------- canvas ---------- */
function mkC(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); return [c, x]; }

/* Catmull-Rom through points; a point [x,y,1] is a sharp corner */
function crPath(pts, closed = true, t = 1 / 6, path) {
  path = path || new Path2D();
  const n = pts.length;
  const g = (i) => (closed ? pts[((i % n) + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
  const tan = (i) => {
    const p = g(i);
    if (p[2] === 1 || (!closed && (i === 0 || i === n - 1))) return [0, 0];
    const a = g(i - 1), b = g(i + 1);
    return [(b[0] - a[0]) * t, (b[1] - a[1]) * t];
  };
  path.moveTo(pts[0][0], pts[0][1]);
  const m = closed ? n : n - 1;
  for (let i = 0; i < m; i++) {
    const p1 = g(i), p2 = g(i + 1), t1 = tan(i), t2 = tan(i + 1);
    path.bezierCurveTo(p1[0] + t1[0], p1[1] + t1[1], p2[0] - t2[0], p2[1] - t2[1], p2[0], p2[1]);
  }
  if (closed) path.closePath();
  return path;
}
function polyPath(pts, closed = true, path) {
  path = path || new Path2D();
  path.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i][0], pts[i][1]);
  if (closed) path.closePath();
  return path;
}
function ellPath(x, y, rx, ry, rot = 0) { const p = new Path2D(); p.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot, 0, TAU); return p; }
function tpts(pts, dx, dy, s = 1) { return pts.map((p) => [p[0] * s + dx, p[1] * s + dy, p[2]]); }

/* cel fill: base colour, shadow on the side away from the light offset (lx,ly) */
function celFill(ctx, path, base, shadow, lx, ly) {
  ctx.fillStyle = css(base); ctx.fill(path);
  if (!shadow) return;
  ctx.save(); ctx.clip(path);
  ctx.fillStyle = css(shadow); ctx.fill(path);
  ctx.translate(lx, ly); ctx.fillStyle = css(base); ctx.fill(path);
  ctx.restore();
}
function ink(ctx, path, col, w, a = 1) {
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = css(col, a); ctx.lineWidth = w; ctx.stroke(path);
}
function fillP(ctx, path, col, a = 1) { ctx.fillStyle = css(col, a); ctx.fill(path); }
/* fill then clip-paint a shadow shape inside */
function shadeIn(ctx, clipPath, shadePath, col, a = 1) {
  ctx.save(); ctx.clip(clipPath); ctx.fillStyle = css(col, a); ctx.fill(shadePath); ctx.restore();
}
/* two-bone IK; dir = +1/-1 chooses the bend side */
function ik2(hx_, hy, fx, fy, a, b, dir) {
  const dx = fx - hx_, dy = fy - hy;
  let d = Math.hypot(dx, dy);
  d = clamp(d, Math.abs(a - b) + 0.01, a + b - 0.01);
  const ang = Math.atan2(dy, dx);
  const A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
  const k = ang - dir * A;
  return [hx_ + Math.cos(k) * a, hy + Math.sin(k) * a];
}
/* tapered limb outline between two points (capsule) */
function limbPath(x1, y1, x2, y2, w1, w2, path) {
  path = path || new Path2D();
  const a = Math.atan2(y2 - y1, x2 - x1), nx = -Math.sin(a), ny = Math.cos(a);
  path.moveTo(x1 + nx * w1, y1 + ny * w1);
  path.lineTo(x2 + nx * w2, y2 + ny * w2);
  path.arc(x2, y2, w2, a + Math.PI / 2, a - Math.PI / 2, true);
  path.lineTo(x1 - nx * w1, y1 - ny * w1);
  path.arc(x1, y1, w1, a - Math.PI / 2, a + Math.PI / 2, true);
  path.closePath();
  return path;
}
