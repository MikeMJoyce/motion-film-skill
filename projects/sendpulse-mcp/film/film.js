// SendPulse MCP — motion intro. No voice, no sound: four supplied slides animated, then the clean background.
// Layers are cut from the slides by tools/extract.py (window.CUT, source pixels 2000x1125); every scene lays them out in a
// "world" of 2000x1125 scaled to the 1920x1080 stage, so a layer at rest sits exactly where it was on the slide.
// bpm 60 in timeline.json: one beat = one second, so every time below is in seconds.
// Pure function of time: no timers, no Math.random, nothing mutated in run().
(() => {
  const { put, reg, el, scene, sp, seg, clamp, lerp, ease } = C;
  const CUT = window.CUT;
  const SW = 2000, SH = 1125, K = 1920 / SW;          // source → stage
  const CX = 1000, CY = 562;                          // centre of the orbits (the MCP pill)

  // ---------------------------------------------------------------- motion language (one place)
  const M = {
    rise:  { response: 0.62, damping: 0.86 },   // type through its mask
    card:  { response: 0.7,  damping: 0.74 },   // cards and plates: a soft float with a little overshoot
    pill:  { response: 0.55, damping: 0.68 },   // pills drop in with a small bounce
    pop:   { response: 0.5,  damping: 0.62 },   // the MCP pill
    glide: { response: 1.25, damping: 0.92 },   // icons gliding in along their orbits
    out:   { response: 0.45, damping: 1.0 },    // leaving: no bounce
    slow:  { response: 1.6,  damping: 1.0, soft: 0.3 },   // background swells
  };
  const pin = (t, t0, p) => sp(t, t0, p);
  const easeIn = (x) => x * x * x;

  // a world inside a scene root: 2000x1125 source pixels, scaled about its centre (slow camera push via s)
  function world(root) {
    const w = el('div', { class: 'abs', style: `width:${SW}px;height:${SH}px;transform-origin:${SW / 2}px ${SH / 2}px` }, root);
    return reg(w, { x: (1920 - SW) / 2, y: (1080 - SH) / 2, s: K });
  }
  const camera = (w, t, t0, t1, amt = 0.025) => put(w, { s: K * (1 + amt * ease.inOut(seg(t, t0, t1))) });

  // a cut layer at its source position; origin: 'c' centre (default) or a CSS origin string
  function layer(parent, id, o = {}) {
    const c = CUT[id];
    if (!c) throw new Error('no layer ' + id);
    const e = el('img', { src: c.src, class: 'abs', draggable: 'false',
      style: `left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px;transform-origin:${o.origin || '50% 50%'}` }, parent);
    e.box = c;
    return reg(e, o.base || { o: 0 });
  }
  // type rising through a mask: the word moves inside a clip box that stays put
  function masked(parent, id) {
    const c = CUT[id], pad = 14;
    const box = el('div', { class: 'abs', style: `left:${c.x - pad}px;top:${c.y - pad}px;width:${c.w + 2 * pad}px;height:${c.h + 2 * pad}px;overflow:hidden` }, parent);
    const e = el('img', { src: c.src, class: 'abs', style: `left:${pad}px;top:${pad}px;width:${c.w}px;height:${c.h}px;transform-origin:50% 100%` }, box);
    e.box = c;
    reg(box);
    return reg(e, { o: 0 });
  }
  // entrance p (0→1) and exit q (0→1) applied to a lifted card: y offset, scale, opacity
  function lift(e, p, q, { dy = 80, s0 = 0.94, qy = -50, qs = 0.97, extraY = 0, x = 0, r = 0 } = {}) {
    const o = clamp(p * 1.6, 0, 1) * (1 - clamp(q * 1.25, 0, 1));
    put(e, { o, x, y: dy * (1 - p) + qy * q + extraY, s: lerp(s0, 1, p) * lerp(1, qs, q), r });
  }

  // ---------------------------------------------------------------- background (whole film)
  // flat brand colour; the orbit glow (slide 2); the top glow with its dot grid (slides 3-4 and the clean end plate);
  // orbit rings that are born on slide 2 and stay behind as the faint curved lines of slides 3-4.
  const PHI = (-16 * Math.PI) / 180, KE = 0.30;       // orbit tilt and minor/major ratio, measured on the MCP slide
  const RINGS = [692, 1290, 1375];
  scene({
    name: 'bg', from: 0, to: 'done',
    build(root, S) {
      S.w = world(root);
      S.orbitGlow = layer(S.w, 'orbit_glow');
      const cv = el('canvas', { width: SW, height: SH, class: 'abs', style: `width:${SW}px;height:${SH}px` }, S.w);
      S.g = cv.getContext('2d');
      S.dots = [];
      for (let y = 26; y < 760; y += 27.2) for (let x = 23; x < SW; x += 27.2) S.dots.push([x, y]);
    },
    run(t, b, S) {
      const g = S.g;
      g.clearRect(0, 0, SW, SH);
      // --- slide 2: the orbit glow swells in with the pill, leaves with it
      const gin = pin(t, 5.75, M.slow), gout = pin(t, 12.0, M.out);
      put(S.orbitGlow, { o: gin * (1 - gout), s: lerp(0.55, 1, gin) * lerp(1, 1.35, gout) });
      // --- slides 3-4 and the end: the top glow comes down from above and stays
      const tin = pin(t, 12.25, M.slow);
      const breathe = 1 + 0.025 * Math.sin((2 * Math.PI * (t - 25)) / 6) * clamp((t - 25) / 2, 0, 1);
      if (tin > 0.001) {   // radial gradient fitted to the slides: peak #0d7c9b at the top centre, 0.65/0.36/0.14 at 200/400/600 px
        g.save();
        g.translate(CX, 0); g.scale(1, 0.3 * lerp(0.35, 1, tin) * breathe);
        const gr = g.createRadialGradient(0, 0, 0, 0, 0, 1000);
        [[0, 1], [0.2, 0.65], [0.4, 0.36], [0.6, 0.14], [0.8, 0.04], [1, 0]].forEach(([k, a]) => gr.addColorStop(k, `rgba(13, 124, 155, ${a * tin})`));
        g.fillStyle = gr; g.fillRect(-1000, 0, 2000, 1000 / 0.3);
        g.restore();
      }
      // --- rings: drawn on as arcs (slide 2), then they open up and settle as faint lines
      const draw = ease.out(seg(t, 5.6, 7.0));
      const open = pin(t, 12.0, M.slow);
      if (draw > 0) {
        const life = lerp(1, 0.55, open);
        const rot = PHI + 0.05 * open + 0.004 * Math.max(0, t - 12.6);   // a very slow drift after slide 2
        RINGS.forEach((r0, i) => {
          const r = r0 * lerp(1, 1.18 + 0.06 * i, open);
          const a0 = -Math.PI * 0.5 - i * 0.6, len = 2 * Math.PI * clamp(draw * 1.25 - i * 0.12, 0, 1);
          if (len <= 0) return;
          g.beginPath();
          g.ellipse(CX, CY + 40 * open, r, r * KE, rot, a0, a0 + len);
          // the inner ring belongs to slide 2 only: the end plate keeps just the two faint outer lines
          g.strokeStyle = `rgba(140, 196, 214, ${(i === 0 ? 0.30 * (1 - open) : 0.22 * life)})`;
          g.lineWidth = 1.6;
          g.stroke();
        });
      }
      // --- pings from the MCP pill: an ellipse that grows along the orbit plane and fades
      for (const tp of [7.2, 9.2, 11.2]) {
        const u = seg(t, tp, tp + 2.2);
        if (u <= 0 || u >= 1) continue;
        const r = lerp(330, 1100, ease.out(u));
        g.beginPath();
        g.ellipse(CX, CY, r, r * KE * 1.15, PHI, 0, 2 * Math.PI);
        g.strokeStyle = `rgba(90, 210, 235, ${0.35 * (1 - u) * (1 - gout)})`;
        g.lineWidth = 2.2;
        g.stroke();
      }
      // --- dot grid under the top glow: a wave from the top centre switches the dots on
      if (tin > 0.001) {
        g.fillStyle = '#9fe3f2';
        const t0 = 12.35;
        for (const [x, y] of S.dots) {
          const d = Math.hypot((x - CX) / 1.6, y);
          const on = clamp((t - t0 - d / 900) / 0.5, 0, 1);
          if (on <= 0) continue;
          const env = clamp(1 - Math.hypot((x - CX) / 1150, y / 620), 0, 1);
          const a = on * (0.05 + 0.2 * env * env) * clamp(1 - (y - 300) / 420, 0, 1);
          if (a < 0.004) continue;
          g.globalAlpha = a;
          g.fillRect(x - 1, y - 1, 2.2, 2.2);
        }
        g.globalAlpha = 1;
      }
    },
  });

  // ---------------------------------------------------------------- slide 1: logo, headline, categories, ratings  (0 → 6.4)
  const H_LINES = [['h1_0', 'h1_1', 'h1_2', 'h1_3'], ['h2_0', 'h2_1', 'h2_2'], ['h3_0', 'h3_1']];
  const OUT1 = 5.25;
  scene({
    name: 's1', from: 's1', to: 6.4,
    build(root, S) {
      S.w = world(root);
      S.logo = masked(S.w, 'logo_word');
      S.pulse = layer(S.w, 'logo_pulse', { origin: '0% 50%' });
      S.words = H_LINES.map((ln) => ln.map((id) => masked(S.w, id)));
      S.cats = [0, 1, 2, 3].map((i) => layer(S.w, 'cat' + i));
      S.rate = layer(S.w, 'ratings', { origin: '50% 0%' });
    },
    run(t, b, S) {
      camera(S.w, t, 0, OUT1 + 1, 0.03);
      const q = (k) => pin(t, OUT1 + k * 0.045, M.out);           // staggered exit, top first
      // logo: the word rises through its mask, the pulse draws left → right and its dot lands
      const pl = pin(t, 0.15, M.rise), ql = q(0);
      put(S.logo, { o: pl > 0.001 ? 1 - ql : 0, y: 120 * (1 - pl) - 70 * ql });
      const draw = ease.inOut(seg(t, 0.55, 1.25));
      const dot = pin(t, 1.12, M.pop);
      put(S.pulse, { o: draw > 0 ? 1 - ql : 0, y: -70 * ql, clip: `inset(-10% ${(1 - draw) * 100}% -10% -2%)`, s: 1 + 0.06 * Math.sin(Math.PI * clamp(dot, 0, 1)) });
      // headline: word by word, line by line; the last (cyan) line lands a beat later
      S.words.forEach((ln, li) => ln.forEach((e, wi) => {
        const t0 = 0.75 + li * 0.32 + (li === 2 ? 0.12 : 0) + wi * 0.07;
        const p = pin(t, t0, M.rise), qq = q(1 + li);
        put(e, { o: p > 0.001 ? 1 - clamp(qq * 1.3, 0, 1) : 0, y: e.box.h * 1.35 * (1 - p) - 60 * qq });
      }));
      // categories rise one after another; a light sheen passes as each lands
      S.cats.forEach((e, i) => {
        const p = pin(t, 2.05 + i * 0.12, M.card);
        lift(e, p, q(4 + i * 0.5), { dy: 110, s0: 0.9, qy: 40 });
      });
      // ratings rise from below the frame edge
      const pr = pin(t, 2.7, M.card);
      lift(S.rate, pr, q(6), { dy: 170, s0: 1, qy: 80 });
    },
  });

  // ---------------------------------------------------------------- slide 2: SendPulse MCP with orbiting apps  (5.8 → 13.0)
  // each icon keeps its own orbit (same tilt as the rings), radius and start angle from its place on the slide;
  // inner orbits run faster (Kepler-like), so the constellation keeps changing while the slide holds.
  const ICONS = ['claude', 'cursor', 'arc', 'openai', 'copilot', 'bot'];
  const ORB = ICONS.map((id) => {
    const c = CUT['ic_' + id], x = c.x + c.w / 2 - CX, y = c.y + c.h / 2 - CY;
    const u = x * Math.cos(PHI) + y * Math.sin(PHI), v = (-x * Math.sin(PHI) + y * Math.cos(PHI)) / KE;
    return { id, r: Math.hypot(u, v), th: Math.atan2(v, u) };
  });
  const orbitXY = (r, th) => {
    const u = r * Math.cos(th), v = r * KE * Math.sin(th);
    return [CX + u * Math.cos(PHI) - v * Math.sin(PHI), CY + u * Math.sin(PHI) + v * Math.cos(PHI)];
  };
  const T2 = 6.05, REF2 = 9.6, OUT2 = 11.95;   // REF2: the moment the icons stand where they stood on the slide
  scene({
    name: 's2', from: 's2', to: 13.3,
    build(root, S) {
      S.w = world(root);
      S.icons = ORB.map((o) => layer(S.w, 'ic_' + o.id));
      S.pill = layer(S.w, 'mcp_pill');
    },
    run(t, b, S) {
      camera(S.w, t, T2, OUT2 + 1, 0.035);
      // the hub pops in, breathes with each ping, and leaves by shrinking into the centre
      const pp = pin(t, T2, M.pop), pq = pin(t, OUT2 + 0.25, M.out);
      const ping = [7.2, 9.2, 11.2].reduce((a, tp) => a + Math.exp(-Math.max(0, t - tp) * 6) * (t > tp ? 1 : 0), 0);
      put(S.pill, { o: clamp(pp * 2, 0, 1) * (1 - pq), s: lerp(0.6, 1, pp) * lerp(1, 0.75, pq) * (1 + 0.015 * ping) });
      // planets: glide in along the orbit, drift while the slide holds, then speed off along the same orbit
      ORB.forEach((o, i) => {
        const e = S.icons[i];
        const w = (0.075 * Math.pow(800 / o.r, 1.5));                 // rad/s
        const p = pin(t, T2 + 0.25 + i * 0.11, M.glide);
        const q = easeIn(seg(t, OUT2 + i * 0.05, OUT2 + 1.0 + i * 0.05));
        const th = o.th + w * (t - REF2) - 1.25 * (1 - p) + 1.6 * q;
        const [x, y] = orbitXY(o.r * lerp(1.25, 1, p) * lerp(1, 1.2, q), th);
        const depth = 1 + 0.07 * Math.sin(th);                          // the near side of the orbit is a touch bigger
        put(e, { x: x - (e.box.x + e.box.w / 2), y: y - (e.box.y + e.box.h / 2), s: depth * lerp(0.55, 1, p),
          o: clamp(p * 1.8, 0, 1) * (1 - q) * (1 - q), r: 6 * (1 - p) });
      });
    },
  });

  // ---------------------------------------------------------------- slides 3 and 4: pills on top, plates float up from below
  function productSlide(name, from, to, pills, groups, tIn, tOut) {
    scene({
      name, from, to,
      build(root, S) {
        S.w = world(root);
        S.groups = groups.map((id) => layer(S.w, id, { origin: '50% 0%' }));   // plates under the pills
        S.pills = pills.map((id) => layer(S.w, id));
      },
      run(t, b, S) {
        camera(S.w, t, tIn, tOut + 1, 0.02);
        S.pills.forEach((e, i) => {
          const p = pin(t, tIn + i * 0.13, M.pill), q = pin(t, tOut + i * 0.06, M.out);
          lift(e, p, q, { dy: -90, s0: 0.86, qy: -70, qs: 0.92 });
        });
        // plates: middle one first, then left and right; after landing each floats on its own slow swell
        const order = [1, 0, 2];
        S.groups.forEach((e, i) => {
          const k = order.indexOf(i);
          const p = pin(t, tIn + 0.5 + k * 0.17, M.card), q = pin(t, tOut + 0.1 + k * 0.06, M.out);
          const bob = 6 * Math.sin((2 * Math.PI * (t - tIn)) / 3.6 + i * 2.1) * clamp(p, 0, 1);
          lift(e, p, q, { dy: 300, s0: 0.92, qy: 260, qs: 0.96, extraY: bob, r: (i - 1) * 1.2 * (1 - p) });
        });
      },
    });
  }
  productSlide('s3', 's3', 19.2, ['pill_email', 'pill_chatbot', 'pill_automation'], ['g3_left', 'g3_mid', 'g3_right'], 12.9, 18.3);
  productSlide('s4', 's4', 25.2, ['pill_popups', 'pill_landing', 'pill_crm'], ['g4_left', 'g4_mid', 'g4_right'], 18.85, 24.1);
  // from 'clean' to the end only the background scene is live: the plate for the screencasts

  C.start();
})();
