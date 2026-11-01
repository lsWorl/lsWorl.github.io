/* Klee hikes down to the treasure chest: gradient descent on a foggy mountain.
   The player leads first through the fog; Klee's "secret" is gradient descent. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') {
    window.LabHike = api.model;
    window.LabExperiments = Object.assign(window.LabExperiments || {}, {hike: api.init});
  }
})(function () {
  'use strict';
  // The map shows u ∈ [-3, 3] by v ∈ [-1.875, 1.875] on a 640 × 400 view.
  const WIDTH = 640, HEIGHT = 400, SCALE = WIDTH / 6, U = 3, V = HEIGHT / SCALE / 2;
  const CHEST_RADIUS = 0.2, STRIDE = 0.5, PLAYER_STEPS = 10, MAX_STEPS = 40, METRES = 1200;

  // ---------- Model: pure and deterministic, so it can be tested in Node. ----------
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const distance = (a, b) => Math.hypot(a.u - b.u, a.v - b.v);
  const inBounds = p => Math.abs(p.u) <= U && Math.abs(p.v) <= V;
  const toView = p => ({x: (p.u + U) * SCALE, y: (V - p.v) * SCALE});
  const toMap = q => ({u: q.x / SCALE - U, v: V - q.y / SCALE});

  // The mountain tilts toward the chest (an elongated bowl) with Gaussian wells
  // for the chest valley and the slime pit, plus hills for scenery.
  const BOWL = 0.22, STRETCH = 1.6;
  function height(map, p) {
    let f = BOWL * ((p.u - map.bowl.u) ** 2 + STRETCH * (p.v - map.bowl.v) ** 2);
    for (const t of map.terms) f += t.a * Math.exp(-((p.u - t.u) ** 2 + (p.v - t.v) ** 2) / (2 * t.s * t.s));
    return f;
  }
  function gradient(map, p) {
    let gu = 2 * BOWL * (p.u - map.bowl.u), gv = 2 * BOWL * STRETCH * (p.v - map.bowl.v);
    for (const t of map.terms) {
      const e = t.a * Math.exp(-((p.u - t.u) ** 2 + (p.v - t.v) ** 2) / (2 * t.s * t.s)) / (t.s * t.s);
      gu -= e * (p.u - t.u); gv -= e * (p.v - t.v);
    }
    return {u: gu, v: gv};
  }
  // Settle onto the exact minimum near a well with tiny, safe steps.
  function settle(map, p) {
    let q = {...p};
    for (let i = 0; i < 4000; i++) { const g = gradient(map, q); q = {u: q.u - 0.02 * g.u, v: q.v - 0.02 * g.v}; }
    return q;
  }
  // Distance from p to the segment a → b.
  function offPath(p, a, b) {
    const du = b.u - a.u, dv = b.v - a.v, t = Math.max(0, Math.min(1, ((p.u - a.u) * du + (p.v - a.v) * dv) / (du * du + dv * dv)));
    return Math.hypot(p.u - a.u - du * t, p.v - a.v - dv * t);
  }
  // Camp high on one side, chest in the lowest valley, a slime pit near the way down.
  function makeMap(seed) {
    const rng = random(seed), pick = (low, high) => low + rng() * (high - low);
    for (let attempt = 0; attempt < 80; attempt++) {
      const chest = {u: pick(-1.8, 1.8), v: pick(-1, 1)};
      let start = null;
      for (let i = 0; i < 40 && !start; i++) {
        const angle = rng() * Math.PI * 2, reach = pick(2.8, 4.2), p = {u: chest.u + Math.cos(angle) * reach, v: chest.v + Math.sin(angle) * reach};
        if (Math.abs(p.u) <= 2.6 && Math.abs(p.v) <= 1.5) start = p;
      }
      if (!start) continue;
      const along = pick(.42, .6), side = (rng() < .5 ? -1 : 1) * pick(.15, .35), du = chest.u - start.u, dv = chest.v - start.v, length = Math.hypot(du, dv);
      const pit = {u: start.u + du * along - dv / length * side, v: start.v + dv * along + du / length * side};
      const hills = [];
      for (let i = 0; i < 60 && hills.length < 2; i++) {
        const hill = {u: pick(-2.7, 2.7), v: pick(-1.6, 1.6)};
        if (offPath(hill, start, chest) > 1 && distance(hill, chest) > 1.2 && hills.every(other => distance(other, hill) > 1)) hills.push(hill);
      }
      const map = {seed, bowl: chest, start, terms: [{a: -1.2, ...chest, s: .8}, {a: -.7, ...pit, s: .32}, ...hills.map(hill => ({a: pick(.35, .5), ...hill, s: pick(.4, .55)}))]};
      map.chest = settle(map, chest); map.pit = settle(map, pit);
      // The pit must stay a separate, shallower basin.
      if (distance(map.chest, map.pit) < .8 || height(map, map.pit) <= height(map, map.chest) + .12) continue;
      let low = Infinity, high = -Infinity;
      for (let i = 0; i <= 120; i++) for (let j = 0; j <= 75; j++) {
        const h = height(map, {u: -U + i / 120 * 2 * U, v: -V + j / 75 * 2 * V}); low = Math.min(low, h); high = Math.max(high, h);
      }
      // The grid can miss the exact bottom; the chest defines sea level.
      map.low = Math.min(low, height(map, map.chest)); map.high = high;
      if (altitude(map, start) < 450) continue;   // the camp stays high on the mountain
      return map;
    }
    throw new Error('No playable mountain for this number.');
  }
  const altitude = (map, p) => Math.max(0, Math.round((height(map, p) - map.low) / (map.high - map.low) * METRES));

  // One real gradient-descent run. momentum = 0 is plain descent.
  function descend(map, {rate, momentum = 0, maxSteps = MAX_STEPS}) {
    let p = {...map.start}, velocity = {u: 0, v: 0}, outcome = 'tired', zigzags = 0, previous = null;
    const frames = [{step: 0, p, g: gradient(map, p), move: 0, alt: altitude(map, p)}];
    for (let step = 1; step <= maxSteps; step++) {
      const g = gradient(map, p);
      velocity = {u: momentum * velocity.u - rate * g.u, v: momentum * velocity.v - rate * g.v};
      const next = {u: p.u + velocity.u, v: p.v + velocity.v}, move = Math.hypot(velocity.u, velocity.v);
      if (previous && previous.u * velocity.u + previous.v * velocity.v < 0) zigzags++;
      previous = velocity;
      if (!inBounds(next)) { frames.push({step, from: p, p: next, g, move, alt: null}); outcome = 'flew'; break; }
      frames.push({step, from: p, p: next, g, move, alt: altitude(map, next)});
      p = next;
      if (distance(p, map.chest) <= CHEST_RADIUS) { outcome = 'found'; break; }
      if (move < 0.004 && Math.hypot(g.u, g.v) < 0.05) { outcome = distance(p, map.pit) < 0.45 ? 'pit' : 'stuck'; break; }
    }
    if (outcome === 'tired' && zigzags >= 6) outcome = 'bounce';
    return {frames, outcome, zigzags, end: p};
  }
  // The player walks toward a tapped point, at most one stride per step.
  function stepToward(from, target, stride = STRIDE) {
    const d = distance(from, target);
    if (d <= stride) return {u: target.u, v: target.v};
    return {u: from.u + (target.u - from.u) / d * stride, v: from.v + (target.v - from.v) / d * stride};
  }

  const model = {WIDTH, HEIGHT, SCALE, CHEST_RADIUS, STRIDE, PLAYER_STEPS, MAX_STEPS, random, height, gradient, makeMap, altitude, descend, stepToward, toView, toMap, inBounds, distance};

  // ---------- Game ----------
  const SVG = 'http://www.w3.org/2000/svg', STORE = 'lsworld.klee.hike.v1', VOICE_KEY = 'lsworld.klee.fishing.voice';
  const FACES = {neutral: 0, happy: 1, laugh: 2, curious: 3, thinking: 4, care: 5, proud: 6, wink: 7};
  const OUTCOMES = {found: '找到宝箱', flew: '飞出地图', pit: '掉进史莱姆坑', stuck: '停在平地', tired: '走不动了', bounce: '来回弹跳'};
  function init(panel) {
    const $ = selector => panel.querySelector(selector);
    const svg = (tag, attributes = {}, parent) => {
      const node = document.createElementNS(SVG, tag);
      for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
      parent?.append(node); return node;
    };
    const view = $('[data-hike-map]'), stage = $('.fish-stage'), terrain = $('[data-hike-terrain]'), contours = $('[data-hike-contours]');
    const decor = $('[data-hike-decor]'), trails = $('[data-hike-trails]'), marks = $('[data-hike-marks]'), reveal = $('[data-hike-reveal]');
    const fog = $('[data-hike-fog]'), arrow = $('[data-hike-arrow]'), reach = $('[data-hike-reach]'), aim = $('[data-hike-aim]');
    const klee = $('[data-hike-klee]'), banner = $('[data-hike-banner]'), hudMap = $('[data-hike-hud-map]'), hudState = $('[data-hike-hud-state]');
    const face = $('[data-hike-face]'), bubble = $('.fish-klee-line'), line = $('[data-hike-line]');
    const rateInput = $('#hike-rate'), rateValue = $('[data-hike-rate-value]'), momentumToggle = $('[data-hike-momentum]');
    const insightToggle = $('[data-hike-insight-toggle]'), insight = $('[data-hike-insight]'), insightStep = $('[data-hike-insight-step]');
    const chartPlayer = $('[data-hike-chart="player"]'), chartKlee = $('[data-hike-chart="klee"]'), chartValue = $('[data-hike-chart-value]');
    const doneButton = $('[data-hike-done]'), algorithmButton = $('[data-hike-algorithm]'), stepButton = $('[data-hike-step]'), skipButton = $('[data-hike-skip]');
    const retryButton = $('[data-hike-retry]'), againButton = $('[data-hike-again]'), newButton = $('[data-hike-new]');
    const seedLabel = $('[data-hike-seed]'), scorePlayer = $('[data-hike-score="player"]'), scoreKlee = $('[data-hike-score="klee"]'), verdict = $('[data-hike-verdict]');
    const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ----- Voice: shares the fishing game's recordings manifest and switch -----
    const voiceToggle = $('[data-hike-voice-toggle]'), sound = new Audio();
    let voiceLines = {}, voiceOn = true, speaking = null, queued = null, talkFrame = 0;
    try { voiceOn = localStorage.getItem(VOICE_KEY) !== 'off'; } catch (_) { /* Default on. */ }
    voiceToggle.checked = voiceOn; sound.preload = 'auto';
    fetch(panel.dataset.voiceManifest, {cache: 'no-cache'}).then(response => response.ok ? response.json() : null)
      .then(data => { voiceLines = data?.lines || {}; }).catch(() => {});
    function quiet() { cancelAnimationFrame(talkFrame); face.classList.remove('is-talking'); face.style.removeProperty('--talk'); }
    function stopVoice() { queued = null; speaking = null; quiet(); if (!sound.paused) sound.pause(); }
    function voice(id, {minor = false, queue = false} = {}) {
      const record = voiceLines[id];
      if (!voiceOn || !record || document.hidden) return;
      const busy = speaking && !sound.paused && !sound.ended;
      if (busy && minor) return;
      if (busy && queue) { queued = id; return; }
      queued = null; quiet(); speaking = {id, record}; sound.src = record.audio;
      sound.play().then(() => {
        panel.dataset.hikeVoice = id;
        const step = () => {
          if (!speaking || sound.paused || sound.ended) { quiet(); return; }
          const level = speaking.record.envelope?.[Math.floor(sound.currentTime / (speaking.record.step || .05))] || 0;
          face.style.setProperty('--talk', Math.min(1, level / .18).toFixed(2)); face.classList.add('is-talking');
          talkFrame = requestAnimationFrame(step);
        };
        step();
      }).catch(() => { if (speaking?.id === id) speaking = null; });
    }
    sound.addEventListener('ended', () => { quiet(); speaking = null; if (queued) { const next = queued; queued = null; voice(next); } });
    voiceToggle.addEventListener('change', () => {
      voiceOn = voiceToggle.checked; if (!voiceOn) stopVoice();
      try { localStorage.setItem(VOICE_KEY, voiceOn ? 'on' : 'off'); } catch (_) {}
    });

    let stats = {rounds: 0, wins: 0, flew: 0};
    try { Object.assign(stats, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (_) { /* Optional. */ }
    const save = () => { try { localStorage.setItem(STORE, JSON.stringify(stats)); } catch (_) {} };
    const showStats = () => { for (const key of ['rounds', 'wins', 'flew']) $(`[data-hike-stat="${key}"]`).textContent = stats[key]; };

    let map = null, phase = 'lead', walker = null, playerPath = [], playerResult = null, run = null, frameIndex = 0, timer = null, later = [], kleeAt = null;
    const wait = (callback, ms) => { const id = setTimeout(() => { later = later.filter(x => x !== id); callback(); }, ms); later.push(id); };
    const restart = (node, name) => { node.classList.remove(name); void node.getBoundingClientRect(); node.classList.add(name); };
    const say = (text, mood) => {
      if (line.textContent !== text) { line.textContent = text; restart(bubble, 'is-new'); }
      if (mood) { const index = FACES[mood] ?? 0; const position = `${index % 4 / 3 * 100}% ${Math.floor(index / 4) / 3 * 100}%`;
        face.style.backgroundPosition = position; klee.querySelector('.hike-klee-face').style.backgroundPosition = position; }
    };
    const announce = text => { banner.textContent = text; restart(banner, 'is-shown'); };
    const rate = () => Number(rateInput.value), momentum = () => momentumToggle.checked ? 0.8 : 0;
    const metres = value => value === null ? '—' : `${value} 米`;

    // ----- Terrain picture: hypsometric tint with hill shading, drawn once per map. -----
    const STOPS = [[0, [196, 230, 132]], [.18, [139, 203, 112]], [.4, [86, 160, 92]], [.6, [128, 140, 92]], [.75, [160, 136, 104]], [.88, [196, 184, 170]], [1, [247, 246, 242]]];
    function tint(t) {
      for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
        const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i], k = (t - t0) / (t1 - t0);
        return c0.map((c, j) => c + (c1[j] - c) * k);
      }
      return STOPS.at(-1)[1];
    }
    function paintTerrain() {
      const canvas = document.createElement('canvas'), w = 320, h = 200; canvas.width = w; canvas.height = h;
      const context = canvas.getContext('2d'), image = context.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = toMap({x: (x + .5) * WIDTH / w, y: (y + .5) * HEIGHT / h}), t = (height(map, p) - map.low) / (map.high - map.low), g = gradient(map, p);
        // Light from the upper left.
        const shade = Math.max(.55, Math.min(1.25, 1 + (g.u * -0.7 + g.v * 0.7) * -0.55 / Math.sqrt(1 + g.u * g.u + g.v * g.v)));
        const color = tint(Math.max(0, Math.min(1, t))), index = (y * w + x) * 4;
        image.data[index] = color[0] * shade; image.data[index + 1] = color[1] * shade; image.data[index + 2] = color[2] * shade; image.data[index + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      terrain.setAttribute('href', canvas.toDataURL('image/png'));
    }
    // Contour lines with marching squares on a 4 px grid.
    function drawContours() {
      contours.replaceChildren();
      const step = 4, cols = WIDTH / step, rows = HEIGHT / step, grid = [];
      for (let j = 0; j <= rows; j++) { grid.push([]); for (let i = 0; i <= cols; i++) grid[j].push(height(map, toMap({x: i * step, y: j * step}))); }
      const levels = 14;
      for (let level = 1; level < levels; level++) {
        const value = map.low + (map.high - map.low) * level / levels, parts = [];
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
          const edge = (p, q, x0, y0, x1, y1) => { const k = (value - p) / (q - p); return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]; };
          const x = i * step, y = j * step, points = [];
          if ((a < value) !== (b < value)) points.push(edge(a, b, x, y, x + step, y));
          if ((b < value) !== (c < value)) points.push(edge(b, c, x + step, y, x + step, y + step));
          if ((c < value) !== (d < value)) points.push(edge(c, d, x + step, y + step, x, y + step));
          if ((d < value) !== (a < value)) points.push(edge(d, a, x, y + step, x, y));
          for (let k = 0; k + 1 < points.length; k += 2) parts.push(`M${points[k][0].toFixed(1)} ${points[k][1].toFixed(1)}L${points[k + 1][0].toFixed(1)} ${points[k + 1][1].toFixed(1)}`);
        }
        svg('path', {class: 'hike-contour' + (level % 4 === 0 ? ' is-major' : ''), d: parts.join('')}, contours);
      }
    }
    function drawDecor() {
      decor.replaceChildren();
      const rng = random(map.seed * 7 + 3), places = [];
      for (let i = 0; i < 400 && places.length < 22; i++) {
        const p = {u: -2.8 + rng() * 5.6, v: -1.7 + rng() * 3.4}, t = (height(map, p) - map.low) / (map.high - map.low);
        if (t > .25 && t < .58 && [map.chest, map.pit, map.start].every(spot => distance(spot, p) > .45) && places.every(other => distance(other, p) > .32)) places.push(p);
      }
      for (const p of places) {
        const q = toView(p), tree = svg('g', {class: 'hike-tree', transform: `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`}, decor);
        svg('ellipse', {class: 'hike-tree-shadow', cx: 3, cy: 6, rx: 7, ry: 2.5}, tree);
        svg('rect', {class: 'hike-trunk', x: -1.2, y: 1, width: 2.4, height: 5}, tree);
        svg('path', {class: 'hike-leaves', d: 'M0-13L7 2H-7Z'}, tree);
        svg('path', {class: 'hike-leaves is-light', d: 'M0-13L4-4H-4Z'}, tree);
      }
      // Treasure chest at the lowest valley, a slime in the shallow pit, the camp on the hill.
      const chest = toView(map.chest), chestNode = svg('g', {class: 'hike-chest', 'data-hike-chest': '', transform: `translate(${chest.x.toFixed(1)} ${chest.y.toFixed(1)})`}, decor);
      svg('circle', {class: 'hike-chest-glow', r: 22}, chestNode);
      svg('ellipse', {class: 'hike-tree-shadow', cx: 1, cy: 9, rx: 13, ry: 3}, chestNode);
      svg('rect', {class: 'hike-chest-box', x: -11, y: -2, width: 22, height: 11, rx: 2}, chestNode);
      svg('path', {class: 'hike-chest-lid', d: 'M-11-2V-6Q-11-12 0-12Q11-12 11-6V-2Z'}, chestNode);
      svg('path', {class: 'hike-chest-trim', d: 'M-11-2H11M-6-11V9M6-11V9'}, chestNode);
      svg('rect', {class: 'hike-chest-lock', x: -2.5, y: -4, width: 5, height: 6, rx: 1}, chestNode);
      const pit = toView(map.pit), slime = svg('g', {class: 'hike-slime', transform: `translate(${pit.x.toFixed(1)} ${pit.y.toFixed(1)})`}, decor);
      svg('ellipse', {class: 'hike-pit', rx: 20, ry: 8, cy: 5}, slime);
      svg('path', {class: 'hike-slime-body', d: 'M-10 6Q-11-8 0-9Q11-8 10 6Z'}, slime);
      svg('circle', {class: 'hike-slime-eye', cx: -3.5, cy: -1, r: 1.6}, slime); svg('circle', {class: 'hike-slime-eye', cx: 3.5, cy: -1, r: 1.6}, slime);
      const camp = toView(map.start), tent = svg('g', {class: 'hike-camp', transform: `translate(${camp.x.toFixed(1)} ${camp.y.toFixed(1)})`}, decor);
      svg('path', {class: 'hike-tent', d: 'M-14 8L0-12 14 8Z'}, tent); svg('path', {class: 'hike-tent-door', d: 'M-4 8L0 0 4 8Z'}, tent);
      svg('path', {class: 'hike-flag', d: 'M0-12V-22L8-19 0-16'}, tent);
    }
    function placeKlee(p, {jump = true} = {}) {
      kleeAt = p; const q = toView(p);
      klee.style.transform = `translate(${q.x}px, ${q.y}px)`;
      if (jump && !reduced()) restart(klee, 'is-hopping');
      if (phase === 'lead') { reach.setAttribute('transform', `translate(${q.x} ${q.y})`); }
      drawArrow(); hud();
    }
    function look(p, radius = 74) {
      const q = toView(p);
      svg('circle', {cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: radius}, reveal);
    }
    function drawArrow() {
      arrow.replaceChildren();
      if (!insightToggle.checked || !kleeAt || !inBounds(kleeAt) || ['done', 'finishing'].includes(phase)) return;
      const g = gradient(map, kleeAt), length = Math.hypot(g.u, g.v); if (length < .05) return;
      const q = toView(kleeAt), scale = Math.min(70, 30 + length * 25) / length;
      const end = {x: q.x - g.u * scale, y: q.y + g.v * scale};
      svg('line', {class: 'hike-arrow', x1: q.x, y1: q.y, x2: end.x.toFixed(1), y2: end.y.toFixed(1), 'marker-end': 'url(#hike-arrowhead)'}, arrow);
      svg('text', {class: 'hike-arrow-label', x: end.x.toFixed(1), y: (end.y - 6).toFixed(1)}, arrow).textContent = '最陡下坡';
    }
    function trail(points, owner) {
      const path = points.map((p, i) => { const q = toView(p); return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join('');
      let node = trails.querySelector(`.hike-trail-${owner}`);
      if (!node) node = svg('path', {class: `hike-trail hike-trail-${owner}`}, trails);
      node.setAttribute('d', path);
      marks.querySelectorAll(`.hike-step-${owner}`).forEach(dot => dot.remove());
      points.slice(1).forEach((p, i) => { const q = toView(p); if (!inBounds(p)) return;
        svg('circle', {class: `hike-step hike-step-${owner}`, cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: 3.4, 'data-step': i + 1}, marks); });
    }
    function chart() {
      const series = [[chartPlayer, playerPath.map(p => altitude(map, p))], [chartKlee, run ? run.frames.slice(0, frameIndex).map(f => f.alt).filter(v => v !== null) : []]];
      const span = Math.max(2, ...series.map(([, values]) => values.length)) - 1;
      for (const [node, values] of series) node.setAttribute('points', values.map((value, i) => `${(6 + i * 288 / span).toFixed(1)},${(60 - value / METRES * 54).toFixed(1)}`).join(' '));
      const last = series.map(([, values]) => values.at(-1));
      chartValue.textContent = `旅行者 ${metres(last[0] ?? null)} · 可莉 ${metres(last[1] ?? null)}`;
    }
    function score(node, result) {
      node.querySelector('strong').textContent = result ? (result.found ? `${result.steps} 步找到` : OUTCOMES[result.outcome] || '没找到') : '—';
      node.querySelector('small').textContent = result ? `终点海拔 ${metres(result.alt)}` : '终点海拔 —';
      node.querySelector('.fish-score-bar i').style.width = result ? `${Math.max(0, 100 - (result.alt ?? METRES) / METRES * 100)}%` : '0%';
    }
    const setPhase = value => {
      phase = value; panel.dataset.hikePhase = value;
      doneButton.disabled = value !== 'lead';
      algorithmButton.disabled = !['led', 'algorithm'].includes(value);
      stepButton.disabled = skipButton.disabled = value !== 'algorithm';
      retryButton.disabled = value !== 'done';
      algorithmButton.textContent = value === 'algorithm' ? (timer ? '暂停' : '继续下山') : '看可莉的下山秘诀';
      reach.toggleAttribute('hidden', value !== 'lead');
      hud();
    };
    function hud() {
      if (!map) return;
      hudMap.textContent = `山 #${map.seed} · 海拔 ${metres(kleeAt ? (inBounds(kleeAt) ? altitude(map, kleeAt) : null) : null)}`;
      hudState.textContent = phase === 'lead' ? `旅行者带路 ${playerPath.length - 1}/${PLAYER_STEPS}` : phase === 'done' ? '本局结算'
        : phase === 'algorithm' || phase === 'finishing' ? `可莉 · 第 ${Math.max(0, frameIndex - 1)} 步` : '准备交给可莉';
    }

    // ----- Player leads through the fog -----
    function viewPoint(event) {
      const matrix = view.getScreenCTM(); if (!matrix) return null;
      const p = view.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const q = p.matrixTransform(matrix.inverse());
      return toMap({x: Math.max(0, Math.min(WIDTH, q.x)), y: Math.max(0, Math.min(HEIGHT, q.y))});
    }
    view.addEventListener('click', event => {
      if (phase !== 'lead') return;
      const target = viewPoint(event); if (!target) return;
      const next = stepToward(kleeAt, target);
      if (distance(next, kleeAt) < .02) return;
      playerPath.push(next); look(next); placeKlee(next); trail(playerPath, 'player'); chart();
      const found = distance(next, map.chest) <= CHEST_RADIUS, left = PLAYER_STEPS - (playerPath.length - 1), alt = altitude(map, next);
      aim.setAttribute('hidden', '');
      if (found) { finishLead(true); return; }
      if (!left) { finishLead(false); return; }
      const before = altitude(map, playerPath.at(-2));
      say(alt < before - 30 ? `往下走了 ${before - alt} 米！还剩 ${left} 步，宝箱应该在更低的地方～` : alt > before + 30
        ? `咦，往上爬了 ${alt - before} 米……还剩 ${left} 步。` : `差不多一样高呢，还剩 ${left} 步。`, alt < before ? 'happy' : 'curious');
      hud();
    });
    view.addEventListener('pointermove', event => {
      if (phase !== 'lead' || event.pointerType === 'touch') { aim.setAttribute('hidden', ''); return; }
      const target = viewPoint(event); if (!target) return;
      const a = toView(kleeAt), b = toView(stepToward(kleeAt, target));
      aim.querySelector('line').setAttribute('x1', a.x); aim.querySelector('line').setAttribute('y1', a.y);
      aim.querySelector('line').setAttribute('x2', b.x); aim.querySelector('line').setAttribute('y2', b.y);
      aim.querySelector('circle').setAttribute('cx', b.x); aim.querySelector('circle').setAttribute('cy', b.y);
      aim.removeAttribute('hidden');
    });
    view.addEventListener('pointerleave', () => aim.setAttribute('hidden', ''));
    function finishLead(found) {
      const end = playerPath.at(-1);
      playerResult = {found, steps: playerPath.length - 1, alt: altitude(map, end), outcome: found ? 'found' : 'tired'};
      score(scorePlayer, playerResult); setPhase('led');
      if (found) { announce('找到宝箱！'); say(`找到宝箱啦！旅行者只用了 ${playerResult.steps} 步！看可莉能不能更快～`, 'laugh'); voice('klee-hike-found'); look(map.chest, 40); }
      else { say(`${PLAYER_STEPS} 步走完啦，现在海拔 ${playerResult.alt} 米……宝箱还没找到。看可莉的下山秘诀！`, 'care'); voice('klee-hike-tired'); }
    }
    doneButton.addEventListener('click', () => { if (phase === 'lead' && playerPath.length > 1) finishLead(distance(playerPath.at(-1), map.chest) <= CHEST_RADIUS); else if (phase === 'lead') say('先点地图带可莉走一步嘛！', 'wink'); });

    // ----- Klee: gradient descent, one real step per frame -----
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function showFrame(frame) {
      if (frame.step === 0) {
        placeKlee(frame.p, {jump: false}); say('轮到可莉！不看远处，只看脚下哪边最陡，就往那边迈一步！', 'thinking');
        insightStep.textContent = `出发：位置 (${frame.p.u.toFixed(2)}, ${frame.p.v.toFixed(2)})，海拔 ${frame.alt} 米。规则：新位置 = 旧位置 − η × 坡度（梯度）${momentum() ? '，再加上 0.8 倍的上一步（风之翼的惯性）' : ''}。`;
        return;
      }
      const shown = run.frames.slice(0, frameIndex);
      trail(shown.map(f => f.p), 'klee'); placeKlee(frame.p);
      if (inBounds(frame.p)) look(frame.p, 60);
      const g = Math.hypot(frame.g.u, frame.g.v);
      insightStep.textContent = `第 ${frame.step} 步：坡度 (${frame.g.u.toFixed(2)}, ${frame.g.v.toFixed(2)})，陡度 ${g.toFixed(2)}；` +
        `迈出 ${frame.move.toFixed(2)}（≈ ${Math.round(frame.move * SCALE)} 像素）${frame.alt === null ? '，冲出了地图！' : `，海拔 ${frame.alt} 米。`}`;
      const zig = shown.length > 2 && (() => { const a = shown.at(-1), b = shown.at(-2); return (a.p.u - a.from.u) * (b.p.u - b.from.u) + (a.p.v - a.from.v) * (b.p.v - b.from.v) < 0; })();
      if (zig) { say('哇，步子太大，跳到山谷对面去啦！', 'wink'); voice('klee-hike-bounce', {minor: true}); }
      else say(frame.step === 1 ? '第 1 步！这边最陡，冲呀～' : `第 ${frame.step} 步，海拔 ${frame.alt ?? '？'} 米。`, 'curious');
      chart(); hud();
    }
    function advance() {
      if (!run || frameIndex >= run.frames.length) return;
      showFrame(run.frames[frameIndex++]);
      if (frameIndex >= run.frames.length) finish(); else setPhase('algorithm');
    }
    function play() { stopTimer(); timer = setInterval(advance, reduced() ? 450 : 650); setPhase('algorithm'); }
    function startKlee() {
      run = descend(map, {rate: rate(), momentum: momentum()}); frameIndex = 0;
      trails.querySelector('.hike-trail-klee')?.remove(); marks.querySelectorAll('.hike-step-klee').forEach(dot => dot.remove());
      verdict.hidden = true; scoreKlee.classList.remove('is-winner'); scorePlayer.classList.remove('is-winner'); score(scoreKlee, null);
      announce('可莉的回合！'); voice('klee-hike-start', {queue: true}); advance(); play();
    }
    function finish() {
      stopTimer(); setPhase('finishing'); arrow.replaceChildren();
      const outcome = run.outcome, last = run.frames.at(-1), found = outcome === 'found';
      const result = {found, steps: last.step, alt: outcome === 'flew' ? null : last.alt, outcome};
      score(scoreKlee, result);
      if (outcome === 'flew') {
        if (!reduced()) restart(stage, 'is-shaking');
        klee.classList.add('is-flying'); stats.flew++;
        announce('飞出地图啦！'); say(`哇啊——步子 η = ${rate()} 太大了，越跳越远，飞出地图啦！`, 'care'); voice('klee-hike-flew', {queue: true});
      } else if (found) { announce('找到宝箱！'); say(`找到宝箱啦！可莉走了 ${last.step} 步！好耶！`, 'proud'); voice('klee-hike-win', {queue: true}); look(map.chest, 40); }
      else if (outcome === 'pit') { announce('史莱姆坑！'); say('咦？四周都是上坡……被史莱姆坑黏住了！', 'care'); voice('klee-hike-pit', {queue: true}); }
      else if (outcome === 'bounce') { announce('停不下来！'); say(`步子 η = ${rate()} 有点大，在山谷两边弹来弹去，停不下来！`, 'wink'); voice('klee-hike-bounce', {queue: true}); }
      else if (outcome === 'tired') { announce('走不动啦'); say(`${MAX_STEPS} 步都走完了……步子太小，走得好慢！`, 'care'); voice('klee-hike-slow', {queue: true}); }
      else { announce('停下来了'); say('这里平平的，可莉不知道该往哪走了……', 'thinking'); }
      // Reveal the whole mountain and compare both routes.
      wait(() => {
        panel.classList.add('is-revealed');
        const playerWins = playerResult.found && (!found || playerResult.steps < result.steps) || !playerResult.found && !found && playerResult.alt < (result.alt ?? Infinity);
        const kleeWins = found && (!playerResult.found || result.steps < playerResult.steps) || !playerResult.found && !found && (result.alt ?? Infinity) < playerResult.alt;
        scorePlayer.classList.toggle('is-winner', playerWins); scoreKlee.classList.toggle('is-winner', kleeWins);
        stats.rounds++; if (playerWins) stats.wins++; save(); showStats();
        const notes = {
          found: `可莉每一步只看脚下的坡度，往最陡的下坡方向迈一步，${result.steps} 步走到了宝箱。` + (run.zigzags >= 3 ? `中间在山谷两侧来回跳了 ${run.zigzags} 次——步子再小一点会更稳。` : ''),
          flew: `步子 η = ${rate()} 太大：一步跨过山谷冲上对面更高的坡，下一步坡更陡、迈得更远，越弹越远——学习率太大，梯度下降就会发散。试试把步子调小。`,
          pit: `史莱姆坑四周都是上坡，坡度变成 0，梯度下降以为已经到底了——这就是“局部最小值”。试试打开风之翼（动量），或者换个步子。`,
          stuck: '这里坡度几乎为 0，梯度下降每一步都迈不动了。试试换个步子或打开风之翼。',
          bounce: `步子 η = ${rate()} 偏大：每一步都跨过谷底，落到对面的坡上，又被坡度推回来，${MAX_STEPS} 步里来回折返了 ${run.zigzags} 次——学习率偏大会震荡。试试把步子调小一点。`,
          tired: `步子 η = ${rate()} 太小，${MAX_STEPS} 步还没走到底——学习率太小，收敛就很慢。试试把步子调大一点。`
        };
        verdict.textContent = notes[outcome] + (playerResult.found ? ` 旅行者在雾里 ${playerResult.steps} 步就找到了宝箱！` : ` 旅行者停在海拔 ${playerResult.alt} 米。`);
        verdict.hidden = false; setPhase('done');
        insightStep.textContent = `结果：${OUTCOMES[outcome]}。可莉共走 ${result.steps} 步，步子 η = ${rate()}${momentum() ? '，开着风之翼（动量 0.8）' : ''}。`;
      }, outcome === 'flew' && !reduced() ? 900 : 300);
    }
    algorithmButton.addEventListener('click', () => {
      if (phase === 'led') { startKlee(); return; }
      if (phase === 'algorithm') { if (timer) { stopTimer(); setPhase('algorithm'); } else play(); }
    });
    stepButton.addEventListener('click', () => { stopTimer(); advance(); });
    skipButton.addEventListener('click', () => { stopTimer(); while (run && frameIndex < run.frames.length - 1) frameIndex++; advance(); });
    retryButton.addEventListener('click', () => {
      if (phase !== 'done') return;
      klee.classList.remove('is-flying'); panel.classList.remove('is-revealed'); setPhase('led'); startKlee();
    });

    // ----- Rounds -----
    function again() {
      stopTimer(); stopVoice(); later.forEach(clearTimeout); later = [];
      panel.classList.remove('is-revealed'); klee.classList.remove('is-flying', 'is-hopping'); stage.classList.remove('is-shaking');
      trails.replaceChildren(); marks.replaceChildren(); reveal.replaceChildren(); arrow.replaceChildren();
      run = null; frameIndex = 0; playerPath = [{...map.start}]; playerResult = null;
      verdict.hidden = true; scorePlayer.classList.remove('is-winner'); scoreKlee.classList.remove('is-winner'); score(scorePlayer, null); score(scoreKlee, null);
      setPhase('lead'); look(map.start); placeKlee(map.start, {jump: false}); chart();
      insightStep.textContent = '出发后，这里会显示每一步的坡度、迈出的距离和海拔。';
      announce('旅行者带路！');
      say(`山上起雾了！宝箱藏在最低的山谷里。点地图带可莉走，每步最远 ${Math.round(STRIDE * SCALE)} 像素，一共 ${PLAYER_STEPS} 步！`, 'happy');
      voice('klee-hike-intro');
    }
    function newMap(seed = 1000 + Math.floor(Math.random() * 9000)) {
      map = makeMap(seed); seedLabel.textContent = '#' + seed;
      paintTerrain(); drawContours(); drawDecor(); again();
    }
    againButton.addEventListener('click', again);
    newButton.addEventListener('click', () => newMap());
    rateInput.addEventListener('input', () => { rateValue.textContent = rate().toFixed(2); });
    insightToggle.addEventListener('change', () => { insight.hidden = !insightToggle.checked; drawArrow(); });

    const seedFromHash = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('map'));
    rateValue.textContent = rate().toFixed(2); insight.hidden = !insightToggle.checked; showStats();
    newMap(Number.isSafeInteger(seedFromHash) && seedFromHash > 0 ? seedFromHash : undefined);
    return () => { stopVoice(); if (timer) { stopTimer(); setPhase('algorithm'); } };
  }

  return {model, init};
});
