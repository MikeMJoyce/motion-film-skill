// «Одна помилка» — silent clean clip, 16:9, chroma-green background.
// 0–3 s: three lines type in, one second each · 3–5 s: hold · 5 s: red caps fall onto them · 5.38 s: impact,
// the lines shatter like glass (radial crack pattern, shards tumble out with drag + gravity) · red text settles, holds.
// Everything is drawn on one canvas as a pure function of t (seeded randomness only, built once).
(() => {
  const { W, H, scene, canvas, bt, clamp, lerp, mulberry32 } = C;
  const SIZE = 116, WEIGHT = 500, LEAD = 146;
  const RED_SIZE = 120, RED_WEIGHT = 600;
  C.fonts = [`${WEIGHT} ${SIZE}px Display`, `${RED_WEIGHT} ${RED_SIZE}px Display`];

  const LINES = ['Великі бренди', 'Чималі бюджети', 'Мільйони клієнтів'];
  const RED = 'ОДНА ПОМИЛКА';
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const CX = W / 2, CY = H / 2;
  const TYPE_LEN = 0.9;          // each line types over 0.9 s of its 1 s slot
  const POP = 0.07;              // a character pops in over ~4 frames

  scene({
    name: 'main', from: 0, to: 'done',
    build(root, S) {
      S.ctx = canvas(root);
      S.ready = false;
    },
    run(t, b, S) {
      if (!S.ready) init(S);
      draw(t, S);
    },
  });

  // layout + shard pattern are built on the first frame (fonts are loaded by then), deterministically
  function init(S) {
      const g = S.ctx;
      S.BG = css('--bg'); S.INK = css('--ink'); S.ACC = css('--accent');
      g.font = `${WEIGHT} ${SIZE}px Display`;
      S.lines = LINES.map((s, i) => {
        const chars = [...s], wFull = g.measureText(s).width, x0 = CX - wFull / 2;
        const xs = chars.map((_, k) => x0 + g.measureText(chars.slice(0, k).join('')).width);
        return { chars, xs, x0, wFull, y: CY + (i - 1) * LEAD + SIZE * 0.36, t0: bt(['l1', 'l2', 'l3'][i]) };
      });
      // offscreen: the fully typed block, cut into shards at the impact
      const off = document.createElement('canvas'); off.width = W; off.height = H;
      const o = off.getContext('2d');
      o.font = g.font; o.fillStyle = S.INK; o.textBaseline = 'alphabetic';
      for (const L of S.lines) L.chars.forEach((c, k) => o.fillText(c, L.xs[k], L.y));
      S.off = off;
      const img = o.getImageData(0, 0, W, H).data;
      const alphaAt = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? 0 : img[(((y | 0) * W) + (x | 0)) * 4 + 3]);

      // radial crack pattern from the impact point: spokes × rings with shared jittered vertices (cells tile exactly)
      const r = mulberry32(31);
      const IX = CX, IY = CY - 6;
      const M = 30, ang = [];
      for (let j = 0; j < M; j++) ang.push((j + (r() - 0.5) * 0.7) / M * Math.PI * 2);
      const rad = [0]; for (let v = 22; v < 1200; v *= 1.42) rad.push(v);
      const V = rad.map((R, i) => ang.map((a) => {
        if (i === 0) return [IX, IY];
        const rr = R * (1 + (r() - 0.5) * 0.28), aa = a + (r() - 0.5) * 0.08;
        return [IX + Math.cos(aa) * rr, IY + Math.sin(aa) * rr * 0.82];
      }));
      const polys = [];
      for (let i = 0; i < rad.length - 1; i++) for (let j = 0; j < M; j++) {
        const j2 = (j + 1) % M, A = V[i][j], B = V[i][j2], Cc = V[i + 1][j2], D = V[i + 1][j];
        if (i === 0) { polys.push([A, Cc, D]); continue; }
        if (r() < 0.55) { if (r() < 0.5) { polys.push([A, B, Cc]); polys.push([A, Cc, D]); } else { polys.push([A, B, D]); polys.push([B, Cc, D]); } }
        else polys.push([A, B, Cc, D]);
      }
      const inPoly = (p, x, y) => {
        let c = false;
        for (let a = 0, b = p.length - 1; a < p.length; b = a++) {
          const [xa, ya] = p[a], [xb, yb] = p[b];
          if ((ya > y) !== (yb > y) && x < (xb - xa) * (y - ya) / (yb - ya) + xa) c = !c;
        }
        return c;
      };
      S.shards = [];
      for (const p of polys) {
        const xs = p.map((q) => q[0]), ys = p.map((q) => q[1]);
        const bx = Math.floor(Math.min(...xs)) - 1, by = Math.floor(Math.min(...ys)) - 1;
        const bw = Math.ceil(Math.max(...xs)) - bx + 2, bh = Math.ceil(Math.max(...ys)) - by + 2;
        let ink = false;
        for (let y = by; y < by + bh && !ink; y += 2) for (let x = bx; x < bx + bw; x += 2) if (alphaAt(x, y) > 20 && inPoly(p, x, y)) { ink = true; break; }
        if (!ink) continue;
        const cx = xs.reduce((a, b) => a + b) / p.length, cy = ys.reduce((a, b) => a + b) / p.length;
        const dx = cx - IX, dy = cy - IY, dist = Math.hypot(dx, dy) || 1;
        const near = clamp(1 - dist / 900, 0.15, 1);
        const speed = (700 + r() * 900) * (0.55 + near);
        S.shards.push({
          p, bx, by, bw, bh, cx, cy,
          delay: dist / 4200,
          vx: dx / dist * speed + (r() - 0.5) * 260,
          vy: dy / dist * speed * 0.8 - 120 + r() * 380,
          w: (r() - 0.5) * 9,                    // spin, rad/s
          f0: r() * 0.4, fw: (r() - 0.5) * 16,   // 3D flip (scaleX = cos)
          z: -0.2 + r() * 1.4,                   // drift toward camera
          fade0: 0.45 + r() * 0.35, fadeL: 0.35 + r() * 0.4,
        });
      }
      // fine glass debris from the impact zone
      S.dust = [];
      for (let k = 0; k < 70; k++) {
        const a = r() * Math.PI * 2, s = 900 + r() * 1700, sz = 3 + r() * 9;
        S.dust.push({ x: IX + (r() - 0.5) * 360, y: IY + (r() - 0.5) * 70, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.75 - 150,
                      sz, a0: r() * 6.28, w: (r() - 0.5) * 30, life: 0.35 + r() * 0.5, tri: [r(), r(), r(), r()] });
      }
      g.font = `${RED_WEIGHT} ${RED_SIZE}px Display`;
      g.letterSpacing = '2px';
      S.redW = g.measureText(RED).width;
      g.letterSpacing = '0px';
      S.ready = true;
  }

  function draw(t, S) {
      const g = S.ctx;
      const tHit = bt('hit'), tFall = bt('fall');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = 1;
      g.fillStyle = S.BG; g.fillRect(0, 0, W, H);

      // camera shake on impact (decays in ~0.4 s)
      const th = t - tHit;
      if (th > 0) {
        const k = Math.exp(-th * 9);
        g.translate(16 * k * Math.sin(th * 58), 11 * k * Math.sin(th * 47 + 1.3));
      }

      // ---- typed lines (until the impact)
      if (t < tHit) {
        g.font = `${WEIGHT} ${SIZE}px Display`; g.fillStyle = S.INK; g.textBaseline = 'alphabetic';
        let caret = null;
        S.lines.forEach((L, i) => {
          const n = L.chars.length;
          if (t < L.t0) return;
          let shown = 0;
          L.chars.forEach((c, k) => {
            const tc = L.t0 + (k / n) * TYPE_LEN;
            const u = clamp((t - tc) / POP);
            if (u <= 0) return;
            shown = k + 1;
            const e = 1 - Math.pow(1 - u, 3);
            g.globalAlpha = e;
            g.fillText(c, L.xs[k], L.y + 10 * (1 - e));
          });
          g.globalAlpha = 1;
          const next = S.lines[i + 1];
          if (!next || t < next.t0) caret = { x: shown ? L.xs[shown - 1] + g.measureText(L.chars[shown - 1]).width : L.x0, y: L.y, typing: t < L.t0 + TYPE_LEN + 0.05 };
        });
        // caret: solid while typing, soft blink during the hold, gone when the red text starts to fall
        if (caret && t < tFall) {
          const blink = caret.typing ? 1 : 0.5 + 0.5 * Math.cos((t - bt('hold')) * Math.PI * 2 * 1.1);
          g.globalAlpha = clamp(blink * 1.6 - 0.3);
          g.fillRect(caret.x + 8, caret.y - SIZE * 0.74, 6, SIZE * 0.9);
          g.globalAlpha = 1;
        }
      } else {
        // ---- shards
        for (const s of S.shards) {
          const tau = Math.max(0, th - s.delay);
          const K = 2.4, dr = (1 - Math.exp(-K * tau)) / K;
          const px = s.vx * dr, py = s.vy * dr + 0.5 * 1500 * tau * tau;
          const a = clamp(1 - (tau - s.fade0) / s.fadeL);
          if (a <= 0) continue;
          const sc = 1 + s.z * tau, fl = Math.cos(s.f0 + s.fw * tau * (tau > 0 ? 1 : 0));
          g.save();
          g.globalAlpha = a;
          g.translate(s.cx + px, s.cy + py);
          g.rotate(s.w * tau);
          g.scale(sc * (tau > 0 ? fl : 1), sc);
          g.translate(-s.cx, -s.cy);
          g.beginPath(); s.p.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
          g.clip();
          g.drawImage(S.off, s.bx, s.by, s.bw, s.bh, s.bx, s.by, s.bw, s.bh);
          g.restore();
        }
        g.fillStyle = S.INK;
        for (const d of S.dust) {
          const tau = th; if (tau > d.life) continue;
          const dr = (1 - Math.exp(-3 * tau)) / 3;
          g.save();
          g.globalAlpha = clamp(1 - tau / d.life);
          g.translate(d.x + d.vx * dr, d.y + d.vy * dr + 700 * tau * tau);
          g.rotate(d.a0 + d.w * tau);
          g.beginPath(); g.moveTo(-d.sz * d.tri[0], -d.sz * 0.5); g.lineTo(d.sz * d.tri[1], -d.sz * d.tri[2] * 0.4); g.lineTo(d.sz * 0.2, d.sz * (0.4 + d.tri[3] * 0.6)); g.closePath();
          g.fill();
          g.restore();
        }
        g.globalAlpha = 1;
      }

      // ---- red caps: fall (gravity ease-in + slight scale-down from camera) → impact squash → settle
      if (t >= tFall) {
        let y, sx = 1, sy = 1, sc;
        if (t < tHit) {
          const u = (t - tFall) / (tHit - tFall);
          y = lerp(-260, CY, u * u);
          sc = lerp(1.35, 1, u);
          sy = 1 + 0.06 * u;  sx = 1 - 0.03 * u;    // stretch along the fall
        } else {
          const e = Math.exp(-th * 7.5);
          y = CY - 34 * Math.sin(th * 15) * e;      // small bounce
          sc = 1;
          sy = 1 - 0.2 * Math.cos(th * 21) * Math.exp(-th * 10);
          sx = 1 + 0.12 * Math.cos(th * 21) * Math.exp(-th * 10);
        }
        g.save();
        g.translate(CX, y + RED_SIZE * 0.36);      // anchor on the baseline: squash grows from the ground
        g.scale(sc * sx, sc * sy);
        g.font = `${RED_WEIGHT} ${RED_SIZE}px Display`;
        g.letterSpacing = '2px';
        g.fillStyle = S.ACC; g.textBaseline = 'alphabetic'; g.textAlign = 'center';
        g.fillText(RED, 0, 0);
        g.restore();
        g.letterSpacing = '0px'; g.textAlign = 'left';
      }
  }

  C.start();
})();
