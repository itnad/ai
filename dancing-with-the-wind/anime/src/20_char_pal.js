/* ===================== character palettes ===================== */
const LINE = [52, 34, 32];
const PAL_BASE = {
  line: LINE, lineSoft: [120, 72, 62],
  skin: [246, 218, 196], skinS: [222, 168, 148], skinD: [196, 136, 120], blush: [240, 150, 140],
  eyeW: [252, 250, 246], iris: [44, 34, 34], irisL: [96, 70, 62], mouth: [168, 92, 84],
  coat: [74, 78, 90], coatS: [50, 52, 64], coatH: [104, 110, 126], lining: [58, 46, 50],
  shirt: [240, 242, 242], shirtS: [182, 190, 204],
  pants: [42, 42, 50], pantsS: [27, 27, 33], shoe: [38, 30, 28], shoeH: [80, 66, 60],
};
/* hair by age 0 (20s) .. 1 (70s) */
function hairCols(age) {
  const k = [
    [0.0, [36, 32, 42], [20, 18, 26], [78, 76, 96]],
    [0.3, [46, 44, 52], [26, 25, 32], [96, 96, 110]],
    [0.5, [104, 102, 110], [70, 70, 80], [160, 160, 170]],
    [0.7, [170, 170, 176], [124, 124, 136], [215, 215, 222]],
    [1.0, [226, 226, 228], [176, 176, 188], [248, 248, 250]],
  ];
  for (let i = 0; i < k.length - 1; i++) {
    if (age <= k[i + 1][0]) {
      const u = inv(k[i][0], k[i + 1][0], age);
      return [mix(k[i][1], k[i + 1][1], u), mix(k[i][2], k[i + 1][2], u), mix(k[i][3], k[i + 1][3], u)];
    }
  }
  return [k[4][1], k[4][2], k[4][3]];
}
/* palette for a lighting situation: tint multiplies, add lifts, lineK darkens lines less than fills */
function makePal(age, tint = [255, 255, 255], add = [0, 0, 0], extra = {}) {
  const p = {};
  const base = Object.assign({}, PAL_BASE, extra);
  const [h, hs, hh] = hairCols(age);
  base.hair = h; base.hairS = hs; base.hairH = hh;
  // the coat fades and browns with age
  base.coat = mix(base.coat, [96, 90, 86], age * 0.6); base.coatS = mix(base.coatS, [66, 60, 58], age * 0.6);
  base.coatH = mix(base.coatH, [124, 118, 112], age * 0.6);
  for (const k in base) {
    if (k.startsWith('line')) p[k] = mix(base[k], mul(base[k], tint), 0.5);
    else p[k] = addc(mul(base[k], tint), add);
  }
  p.age = age;
  return p;
}
const WOMAN_EXTRA = {
  skin: [250, 230, 216], skinS: [228, 182, 168], hair: [26, 24, 34], hairS: [14, 13, 20], hairH: [86, 86, 110],
  gown: [236, 206, 150], gownS: [196, 154, 102], gownH: [255, 240, 200], gownD: [160, 118, 74], lips: [206, 104, 104],
  iris: [52, 36, 34], irisL: [130, 90, 70],
};
function makeWomanPal(tint = [255, 255, 255], add = [0, 0, 0]) {
  const p = {};
  const base = Object.assign({}, PAL_BASE, WOMAN_EXTRA);
  for (const k in base) {
    if (k.startsWith('line')) p[k] = mix(base[k], mul(base[k], tint), 0.5);
    else p[k] = addc(mul(base[k], tint), add);
  }
  return p;
}
