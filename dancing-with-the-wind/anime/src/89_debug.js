/* debug scenes for development snapshots */
const DEBUG = {
  dance(ctx, t) {
    ctx.fillStyle = '#c99c58'; ctx.fillRect(0, 0, W, H);
    drawWaltz(ctx, { pal: makePal(0.65), wpal: makeWomanPal(), t, sway: 1, crown: { dy: 0, rot: -0.12 } });
  },
  hands(ctx, t) {
    ctx.fillStyle = '#8a6a48'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(500, 650); ctx.scale(1.3, 1.3); drawHandsUp(ctx, { pal: makePal(0.65), s: 1.3, t });
    ctx.save(); ctx.translate(-40, -20); ctx.rotate(-0.2); drawPhoto(ctx, 120, 150, 2, 1); ctx.restore();
    ctx.save(); ctx.translate(110, 30); ctx.scale(1.4, 1.4); drawBallerina(ctx, 1.5, 0.3); ctx.restore();
    ctx.restore();
    ctx.save(); ctx.translate(1300, 800); ctx.scale(1.4, 1.4); fillParts(ctx, handSilParts(t), [17, 17, 17]); ctx.restore();
    if (!GUEST.sprites) buildGuestSprites();
    for (let v = 0; v < 6; v++) blitGuest(ctx, v, v % 3, 1520 + (v % 3) * 130, 400 + Math.floor(v / 3) * 380, 0.75);
  },
  heads(ctx, t) {
    ctx.fillStyle = '#7d8fb5'; ctx.fillRect(0, 0, W, H);
    [0, 0.35, 0.65, 1].forEach((a, i) => {
      ctx.save(); ctx.translate(260 + i * 460, 420); ctx.scale(1.35, 1.35);
      drawHeadQ(ctx, { pal: makePal(a), s: 1.35, t, wind: 0.8, look: [-0.4, -0.5], rim: [200, 215, 255], tear: i === 2 ? 0.6 : 0, brow: i >= 2 ? 1 : 0 });
      ctx.restore();
    });
  },
  heads2(ctx, t) {
    ctx.fillStyle = '#c9b48a'; ctx.fillRect(0, 0, W, H);
    const list = [
      () => drawHeadProfile(ctx, { pal: makePal(0.1), s: 1.4, t, crown: { dy: 0 } }),
      () => drawHeadProfile(ctx, { pal: makePal(1), s: 1.4, t }),
      () => drawHeadFront(ctx, { pal: makePal(1), s: 1.4, t, look: [0, 0.8], blink: 0.55 }),
      () => drawHeadFront(ctx, { pal: makeWomanPal(), kind: 'woman', s: 1.4, t, smile: 1, porcelain: 1, glassy: 1, crack: 1 }),
      () => drawHeadBack(ctx, { pal: makePal(0.6), s: 1.4, t }),
    ];
    list.forEach((fn, i) => { ctx.save(); ctx.translate(200 + i * 380, 500); ctx.scale(1.4, 1.4); fn(); ctx.restore(); });
  },
  bodies(ctx, t) {
    ctx.fillStyle = '#9fb0c9'; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.translate(160, 980); ctx.scale(1.3, 1.3);
    const T = 96, R = 58; const p = t * 1.6;
    // stairs
    ctx.fillStyle = '#c9a24a';
    for (let n = -2; n < 12; n++) { ctx.fillRect(n * T - p * T, -n * R + p * R, T, 900); }
    ctx.translate(-p * T, p * R);
    drawManSide(ctx, { pal: makePal(0.2), s: 1.3, t, pose: gaitSteps(p, T, R), lean: 0.22 });
    ctx.restore();
    ctx.save(); ctx.translate(1000, 980); ctx.scale(1.2, 1.2);
    drawManFrontal(ctx, { pal: makePal(0.05), s: 1.2, t, look: [0, -0.6] });
    ctx.restore();
    ctx.save(); ctx.translate(1350, 980); ctx.scale(1.2, 1.2);
    drawManFrontal(ctx, { pal: makePal(1), s: 1.2, t, back: true, walk: t * 0.9 });
    ctx.restore();
    ctx.save(); ctx.translate(1700, 980); ctx.scale(-1.2, 1.2);
    drawManSide(ctx, { pal: makePal(0.1), s: 1.2, t, pose: gaitSteps(t * 2.2, 120, 0, 0.6), lean: 0.06, sil: [30, 20, 26] });
    ctx.restore();
  },
};
