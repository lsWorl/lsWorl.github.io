/* Klee's fishing game: K-means clustering on Starfell Lake.
   The player places bombs first; Klee's "secret method" is K-means. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') {
    window.LabFishing = api.model;
    window.LabExperiments = Object.assign(window.LabExperiments || {}, {fishing: api.init});
  }
})(function () {
  'use strict';
  const WIDTH = 640, HEIGHT = 400, MARGIN = 26, RADIUS = 72;

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
  const gaussian = rng => { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  // A lake holds 3–5 schools of fish plus a few strays.
  function makeLake(seed, count = 54) {
    const rng = random(seed), wanted = 3 + Math.floor(rng() * 3), centers = [];
    for (let attempt = 0; centers.length < wanted && attempt < 500; attempt++) {
      const center = {x: 90 + rng() * (WIDTH - 180), y: 80 + rng() * (HEIGHT - 160)};
      if (centers.every(other => distance2(other, center) > 125 ** 2)) centers.push({...center, spread: 20 + rng() * 22});
    }
    const fish = [], strays = Math.round(count * 0.1);
    for (let i = 0; i < count; i++) {
      let x, y;
      if (i < count - strays) {
        const center = centers[i % centers.length];
        x = center.x + gaussian(rng) * center.spread; y = center.y + gaussian(rng) * center.spread * 0.8;
      } else { x = MARGIN + rng() * (WIDTH - 2 * MARGIN); y = MARGIN + rng() * (HEIGHT - 2 * MARGIN); }
      fish.push({x: Math.round(clamp(x, MARGIN, WIDTH - MARGIN)), y: Math.round(clamp(y, MARGIN, HEIGHT - MARGIN)), flip: rng() < 0.5});
    }
    return {seed, schools: centers.length, fish};
  }

  function nearest(point, centers) {
    let index = 0, best = Infinity;
    centers.forEach((center, k) => { const d = distance2(point, center); if (d < best) { best = d; index = k; } });
    return {index, distance2: best};
  }
  const assign = (fish, centers) => fish.map(point => nearest(point, centers).index);
  // Each bomb moves to the mean of the fish that chose it; an empty bomb stays.
  function update(fish, labels, centers) {
    return centers.map((center, k) => {
      let x = 0, y = 0, n = 0;
      labels.forEach((label, i) => { if (label === k) { x += fish[i].x; y += fish[i].y; n++; } });
      return n ? {x: x / n, y: y / n} : {...center};
    });
  }
  const sse = (fish, centers) => fish.reduce((sum, point) => sum + nearest(point, centers).distance2, 0);
  const labeledSse = (fish, labels, centers) => fish.reduce((sum, point, i) => sum + distance2(point, centers[labels[i]]), 0);
  const caught = (fish, bombs, radius = RADIUS) => fish.map(point => bombs.some(bomb => distance2(point, bomb) <= radius * radius));
  const averageDistance = (fish, centers) => Math.sqrt(sse(fish, centers) / Math.max(1, fish.length));

  // k-means++: the first start is a random fish; later starts favour fish far
  // from every start chosen so far (probability ∝ squared distance).
  function initCenters(fish, k, rng) {
    const first = fish[Math.floor(rng() * fish.length)], centers = [{x: first.x, y: first.y}];
    while (centers.length < k) {
      const weights = fish.map(point => nearest(point, centers).distance2), total = weights.reduce((a, b) => a + b, 0);
      let pick = rng() * total, index = 0;
      while (index < fish.length - 1 && (pick -= weights[index]) > 0) index++;
      centers.push({x: fish[index].x, y: fish[index].y});
    }
    return centers;
  }

  // Every animation frame is one real step of the algorithm.
  function kmeans(fish, k, seed, maxRounds = 30) {
    const rng = random((seed * 31 + k) ^ 0x9e3779b9), frames = [];
    let centers = initCenters(fish, k, rng), labels = null;
    frames.push({type: 'init', centers, sse: sse(fish, centers)});
    for (let round = 1; round <= maxRounds; round++) {
      const next = assign(fish, centers), changed = labels ? next.filter((label, i) => label !== labels[i]).length : fish.length;
      frames.push({type: 'assign', round, labels: next, changed, centers, sse: labeledSse(fish, next, centers)});
      if (labels && changed === 0) break;
      labels = next;
      const moved = update(fish, labels, centers);
      frames.push({type: 'update', round, labels, from: centers, centers: moved, sse: labeledSse(fish, labels, moved)});
      centers = moved;
    }
    frames.push({type: 'done', labels, centers, sse: sse(fish, centers)});
    return frames;
  }

  const model = {WIDTH, HEIGHT, RADIUS, random, makeLake, nearest, assign, update, sse, labeledSse, caught, averageDistance, initCenters, kmeans};

  // ---------- Game ----------
  const STORE = 'lsworld.klee.fishing.v1', COLORS = 5;
  const ELEMENTS = ['火', '水', '风', '雷', '岩'];
  function init(panel) {
    const $ = selector => panel.querySelector(selector);
    const kit = window.LabGameKit, {svg, reduced, restart} = kit;
    const lake = $('[data-fish-lake]'), stage = $('.fish-stage'), school = $('[data-fish-school]'), bombs = $('[data-fish-bombs]');
    const lines = $('[data-fish-lines]'), arrows = $('[data-fish-arrows]'), blasts = $('[data-fish-blasts]'), effects = $('[data-fish-fx]');
    const preview = $('[data-fish-preview]'), banner = $('[data-fish-banner]'), hudLake = $('[data-fish-hud-lake]'), hudState = $('[data-fish-hud-state]');
    const face = $('[data-fish-face]'), bubble = $('.fish-klee-line'), line = $('[data-fish-line]'), kInput = $('#fish-k'), kValue = $('[data-fish-k-value]');
    const insightToggle = $('[data-fish-insight-toggle]'), insight = $('[data-fish-insight]'), insightStep = $('[data-fish-insight-step]');
    const sseLine = $('[data-fish-sse-line]'), sseArea = $('[data-fish-sse-area]'), sseValue = $('[data-fish-sse-value]');
    const throwButton = $('[data-fish-throw]'), randomButton = $('[data-fish-random]'), algorithmButton = $('[data-fish-algorithm]');
    const stepButton = $('[data-fish-step]'), skipButton = $('[data-fish-skip]'), againButton = $('[data-fish-again]'), newButton = $('[data-fish-new]');
    const seedLabel = $('[data-fish-seed]'), scorePlayer = $('[data-fish-score="player"]'), scoreKlee = $('[data-fish-score="klee"]');
    const jean = $('[data-fish-jean]'), jeanButton = $('[data-fish-jean-close]'), verdict = $('[data-fish-verdict]');

    // ----- Klee hosts the game: bubble, expressions, banner and voice (Jean speaks too) -----
    const {say, setFace, announce, voice, stopVoice, recording} = kit.host(panel, {face, bubble, line, banner, toggle: $('[data-fish-voice-toggle]'),
      talker: record => record.speaker === 'jean' ? jean : face, voiceAttr: 'fishVoice'});

    const stats = kit.stats(STORE, {rounds: 0, wins: 0, best: 0, jail: 0}).data, save = () => kit.store.set(STORE, JSON.stringify(stats));
    const showStats = () => {
      $('[data-fish-stat="rounds"]').textContent = stats.rounds; $('[data-fish-stat="wins"]').textContent = stats.wins; $('[data-fish-stat="jail"]').textContent = stats.jail;
    };

    let water = null, fishNodes = [], player = [], frames = [], frameIndex = 0, timer = null, phase = 'place', playerCaught = 0, sseHistory = [];
    const k = () => Number(kInput.value);
    const clock = kit.timers(), wait = clock.wait;
    const setPhase = value => {
      phase = value; panel.dataset.fishPhase = value;
      throwButton.disabled = value !== 'place' || player.length !== k();
      randomButton.disabled = value !== 'place';
      algorithmButton.disabled = !['thrown', 'algorithm'].includes(value);
      stepButton.disabled = skipButton.disabled = value !== 'algorithm';
      algorithmButton.textContent = value === 'algorithm' ? (timer ? '暂停' : '继续播放') : '看可莉的算法';
      hud();
    };
    function hud() {
      if (!water) return;
      hudLake.textContent = `湖面 #${water.seed} · ${water.fish.length} 条鱼`;
      hudState.replaceChildren();
      if (phase === 'place') {
        for (let i = 0; i < k(); i++) { const icon = document.createElement('i'); icon.className = 'fish-hud-bomb' + (i < player.length ? ' is-placed' : ''); hudState.append(icon); }
        const label = document.createElement('span'); label.textContent = `${player.length}/${k()}`; hudState.append(label);
      } else {
        const label = document.createElement('span');
        const frame = frames[frameIndex - 1];
        label.textContent = phase === 'done' ? '本局结算' : phase === 'algorithm' || phase === 'finishing' ? (frame?.round ? `可莉 · 第 ${frame.round} 轮` : '可莉的回合') : '旅行者扔出啦';
        hudState.append(label);
      }
    }
    const describe = () => lake.setAttribute('aria-label', `星落湖，${water.fish.length} 条鱼，` +
      (phase === 'place' ? `已放 ${player.length}/${k()} 颗炸弹` : phase === 'done' ? '本局已结束' : '炸弹已扔出'));

    // ----- Drawing -----
    function drawFish(point, i) {
      const size = 0.82 + ((point.x * 7 + point.y * 13 + i) % 29) / 100;
      const group = svg('g', {class: 'fish', transform: `translate(${point.x} ${point.y})`}, school);
      svg('ellipse', {class: 'fish-shadow', cx: 2, cy: 8, rx: 11 * size, ry: 2.6 * size}, group);
      const swim = svg('g', {class: 'fish-swim'}, group);
      swim.style.setProperty('--delay', `${-((i * 0.37) % 3).toFixed(2)}s`); swim.style.setProperty('--swim', `${(2.6 + (i % 5) * 0.35).toFixed(2)}s`);
      const body = svg('g', {class: 'fish-body'}, swim), shape = svg('g', {transform: `scale(${point.flip ? -size : size} ${size})`}, body);
      svg('path', {class: 'fish-tail', d: 'M-10 0L-16.5-6.5Q-14 0-16.5 6.5Z'}, shape);
      svg('path', {class: 'fish-fin', d: 'M-4-5Q1-11 6-5Z'}, shape);
      svg('path', {class: 'fish-skin', d: 'M12.5 0C9.5-6.5 0-7.8-6-5.2C-9-3.6-11-1.2-11 0C-11 1.2-9 3.6-6 5.2C0 7.8 9.5 6.5 12.5 0Z'}, shape);
      svg('path', {class: 'fish-belly', d: 'M11.6 1C8.4 5.4 0 6.8-6 4.6C-8.4 3.5-10 1.8-10.6.7Z'}, shape);
      svg('path', {class: 'fish-fin fish-pectoral', d: 'M1.5 2.2Q-1.5 6.6-4.2 3.6Z'}, shape);
      svg('path', {class: 'fish-detail', d: 'M5.6-3.8Q3.8 0 5.6 3.8M-.5-2.4q1.6 1.7 0 3.4M-4.2-2.2q1.5 1.6 0 3.2'}, shape);
      svg('circle', {class: 'fish-eye-white', cx: 8, cy: -1.6, r: 2}, shape);
      svg('circle', {class: 'fish-eye', cx: 8.5, cy: -1.5, r: 1.15}, shape);
      svg('circle', {class: 'fish-eye-shine', cx: 8.9, cy: -2.1, r: .45}, shape);
      svg('text', {class: 'fish-pop', y: -12}, group).textContent = '+1';
      return group;
    }
    function drawWater() {
      for (const layer of [school, lines, arrows, blasts, bombs, effects]) layer.replaceChildren();
      bombs.dataset.owner = '';
      fishNodes = water.fish.map(drawFish);
    }
    function colorFish(labels = null, caughtList = null) {
      fishNodes.forEach((node, i) => {
        node.setAttribute('class', 'fish' + (labels ? ' cluster-' + (labels[i] % COLORS) : '') + (caughtList?.[i] ? ' is-caught' : ''));
        if (caughtList?.[i]) node.querySelector('.fish-pop').style.animationDelay = `${(i % 9) * 40}ms`;
      });
    }
    function makeBomb(index, owner, drop) {
      const group = svg('g', {class: `fish-bomb fish-bomb-${owner} cluster-${index % COLORS}` + (drop ? ' is-dropping' : '')});
      svg('circle', {class: 'fish-range', r: RADIUS}, group);
      svg('circle', {class: 'fish-range-spin', r: RADIUS - 3}, group);
      svg('ellipse', {class: 'fish-bomb-shadow', cy: 13, rx: 10, ry: 3}, group);
      const piece = svg('g', {class: 'fish-bomb-piece'}, group);
      svg('path', {class: 'fish-fuse', d: 'M5-9Q8-16 14-14'}, piece);
      svg('circle', {class: 'fish-fuse-spark', cx: 14.5, cy: -14.5, r: 2.6}, piece);
      svg('circle', {class: 'fish-bomb-body', r: 11}, piece);
      svg('path', {class: 'fish-bomb-star', d: 'M-3-6.5L-1.8-3.3 1.4-2.1-1.8-.9-3 2.3-4.2-.9-7.4-2.1-4.2-3.3Z'}, piece);
      svg('ellipse', {class: 'fish-bomb-shine', cx: 4, cy: -5, rx: 3, ry: 1.8, transform: 'rotate(30 4 -5)'}, piece);
      svg('circle', {class: 'fish-bomb-badge', cx: 8.5, cy: 8.5, r: 6}, piece);
      svg('text', {class: 'fish-bomb-label', x: 8.5, y: 11.4}, piece).textContent = index + 1;
      return group;
    }
    // Reuse bomb nodes so Klee's bombs glide between rounds.
    function drawBombs(list, owner, {drop = false} = {}) {
      const rebuild = bombs.dataset.owner !== owner || bombs.children.length > list.length;
      if (rebuild) { bombs.replaceChildren(); bombs.dataset.owner = owner; }
      list.forEach((bomb, i) => {
        let group = bombs.children[i];
        if (!group) { group = makeBomb(i, owner, drop); bombs.append(group); if (drop) splash(bomb); }
        group.classList.remove('is-spent');
        group.style.transform = `translate(${bomb.x}px, ${bomb.y}px)`;
      });
    }
    function drawLines(labels, centers) {
      lines.replaceChildren();
      if (!insightToggle.checked || !labels || !centers.length) return;
      water.fish.forEach((point, i) => {
        const center = centers[labels[i]];
        svg('line', {class: 'fish-line cluster-' + (labels[i] % COLORS), x1: center.x, y1: center.y, x2: point.x, y2: point.y}, lines);
      });
    }
    function drawArrows(from = [], to = []) {
      arrows.replaceChildren();
      if (!insightToggle.checked) return;
      from.forEach((start, i) => {
        if (distance2(start, to[i]) < 1) return;
        svg('circle', {class: 'fish-ghost', cx: start.x, cy: start.y, r: 11}, arrows);
        svg('line', {class: 'fish-arrow', x1: start.x, y1: start.y, x2: to[i].x, y2: to[i].y, 'marker-end': 'url(#fish-arrowhead)'}, arrows);
      });
    }
    function splash(at) {
      if (reduced()) return;
      const ring = svg('circle', {class: 'fish-splash', cx: at.x, cy: at.y, r: 16}, effects);
      wait(() => ring.remove(), 900);
    }
    function blast(list, done) {
      blasts.replaceChildren(); effects.replaceChildren();
      [...bombs.children].forEach(group => group.classList.add('is-spent'));
      const quiet = reduced(), parts = [];
      for (const bomb of list) {
        parts.push(svg('circle', {class: 'fish-flash', cx: bomb.x, cy: bomb.y, r: RADIUS}, blasts));
        parts.push(svg('circle', {class: 'fish-shock', cx: bomb.x, cy: bomb.y, r: RADIUS}, blasts));
        svg('circle', {class: 'fish-scorch', cx: bomb.x, cy: bomb.y, r: RADIUS * 0.92}, blasts);
        if (quiet) continue;
        for (let i = 0; i < 12; i++) {
          const angle = i / 12 * Math.PI * 2 + (bomb.x % 7) / 10, reach = RADIUS * (0.55 + (i % 3) * 0.2), drop = i % 2;
          const bit = svg(drop ? 'circle' : 'path', drop ? {class: 'fish-droplet', cx: bomb.x, cy: bomb.y, r: 2.6}
            : {class: 'fish-ember', d: `M${bomb.x} ${bomb.y - 4}l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z`}, effects);
          bit.style.setProperty('--dx', `${(Math.cos(angle) * reach).toFixed(1)}px`); bit.style.setProperty('--dy', `${(Math.sin(angle) * reach).toFixed(1)}px`);
          bit.style.animationDelay = `${(i % 4) * 25}ms`;
        }
      }
      if (!quiet) restart(stage, 'is-shaking');
      requestAnimationFrame(() => requestAnimationFrame(() => parts.forEach(part => part.classList.add('is-on'))));
      wait(() => { stage.classList.remove('is-shaking'); done(); }, quiet ? 60 : 520);
      wait(() => effects.replaceChildren(), quiet ? 60 : 1400);
    }
    function showSse() {
      const values = sseHistory, max = Math.max(...values, 1), min = Math.min(...values, max);
      const points = values.map((value, i) => [values.length > 1 ? 6 + i / (values.length - 1) * 288 : 6, 60 - (value - min) / Math.max(1, max - min) * 50]);
      sseLine.setAttribute('points', points.map(p => p.join(',')).join(' '));
      sseArea.setAttribute('points', points.length ? `6,64 ${points.map(p => p.join(',')).join(' ')} ${points.at(-1)[0]},64` : '');
      sseValue.textContent = values.length ? Math.round(values[0]).toLocaleString() + ' → ' + Math.round(values.at(-1)).toLocaleString() : '—';
    }
    function score(node, caughtCount, distance) {
      const strong = node.querySelector('strong'), bar = node.querySelector('.fish-score-bar i'), total = water.fish.length;
      node.querySelector('small').textContent = distance === null ? '平均距离 —' : `平均距离 ${Math.round(distance)}`;
      bar.style.width = caughtCount === null ? '0%' : `${caughtCount / total * 100}%`;
      if (caughtCount === null) { strong.textContent = '—'; return; }
      if (reduced()) { strong.textContent = `${caughtCount} / ${total}`; return; }
      const begin = performance.now();
      // A frame timestamp can precede `begin`; clamp so the count never goes negative.
      const tick = now => { const t = Math.max(0, Math.min(1, (now - begin) / 650)); strong.textContent = `${Math.round(caughtCount * (1 - (1 - t) ** 3))} / ${total}`; if (t < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    const point = (value, digits = 0) => `(${value.x.toFixed(digits)}, ${value.y.toFixed(digits)})`;

    // ----- Player's turn -----
    function renderPlace(drop = false) {
      drawBombs(player, 'player', {drop});
      const labels = player.length ? model.assign(water.fish, player) : null;
      colorFish(insightToggle.checked ? labels : null); drawLines(labels, player);
      setPhase('place'); describe();
      if (player.length === k()) { say(`${k()} 颗都放好啦！点“扔炸弹！”试试看～`, 'laugh'); if (drop) voice('klee-ready', {minor: true}); }
      else if (player.length) say(`还可以再放 ${k() - player.length} 颗。点一下已经放的炸弹，可以把它拿起来哦。`, 'curious');
    }
    function lakePoint(event) {
      const matrix = lake.getScreenCTM(); if (!matrix) return null;
      const p = lake.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const q = p.matrixTransform(matrix.inverse());
      return {x: Math.round(clamp(q.x, 0, WIDTH)), y: Math.round(clamp(q.y, 0, HEIGHT))};
    }
    lake.addEventListener('click', event => {
      if (phase !== 'place') return;
      const at = lakePoint(event); if (!at) return;
      const hit = player.findIndex(bomb => distance2(bomb, at) <= 18 * 18);
      if (hit >= 0) { player.splice(hit, 1); bombs.dataset.owner = ''; renderPlace(); }
      else if (player.length < k()) { player.push(at); renderPlace(true); }
      else { say('炸弹已经放满啦！点一下已经放的炸弹，可以把它拿起来哦。', 'wink'); return; }
      preview.setAttribute('hidden', '');
    });
    lake.addEventListener('pointermove', event => {
      if (phase !== 'place' || player.length >= k() || event.pointerType === 'touch') { preview.setAttribute('hidden', ''); return; }
      const at = lakePoint(event); if (!at) return;
      preview.setAttribute('transform', `translate(${at.x} ${at.y})`); preview.removeAttribute('hidden');
    });
    lake.addEventListener('pointerleave', () => preview.setAttribute('hidden', ''));
    randomButton.addEventListener('click', () => {
      const rng = random(Date.now());
      while (player.length < k()) player.push({x: Math.round(MARGIN + rng() * (WIDTH - 2 * MARGIN)), y: Math.round(MARGIN + rng() * (HEIGHT - 2 * MARGIN))});
      renderPlace(true);
    });
    throwButton.addEventListener('click', () => {
      if (phase !== 'place' || player.length !== k()) return;
      setPhase('throwing'); lines.replaceChildren(); preview.setAttribute('hidden', '');
      say('嘿——咻！蹦蹦炸弹出发！', 'laugh'); voice('klee-throw');
      blast(player, () => {
        const result = model.caught(water.fish, player); playerCaught = result.filter(Boolean).length;
        colorFish(insightToggle.checked ? model.assign(water.fish, player) : null, result);
        score(scorePlayer, playerCaught, model.averageDistance(water.fish, player));
        const share = playerCaught / water.fish.length;
        say(share >= 0.7 ? `哇！炸到了 ${playerCaught} 条！旅行者好厉害！可莉要用秘密方法挑战你！` : share >= 0.4
          ? `炸到 ${playerCaught} 条！嘿嘿，看可莉的秘密方法能不能炸得更多～` : `只炸到 ${playerCaught} 条……鱼都跑啦！看可莉的秘密方法！`,
          share >= 0.7 ? 'laugh' : share >= 0.4 ? 'happy' : 'wink');
        voice(share >= 0.7 ? 'klee-big' : share >= 0.4 ? 'klee-mid' : 'klee-small', {queue: true});
        setPhase('thrown'); describe();
      });
    });

    // ----- Klee's turn: K-means, one real step per frame -----
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function showFrame(frame) {
      if (frame.sse !== undefined) { sseHistory.push(frame.sse); showSse(); }
      if (frame.type === 'init') {
        colorFish(); lines.replaceChildren(); arrows.replaceChildren(); blasts.replaceChildren(); drawBombs(frame.centers, 'klee', {drop: true});
        announce('可莉的回合！'); voice('klee-start');
        say('可莉的秘密方法开始！先挑几个起点：离已有炸弹越远的鱼，越可能被选中。', 'thinking');
        insightStep.textContent = `初始化（K-means++）：随机选一条鱼作为第 1 颗炸弹，后面每颗按“离最近炸弹的距离平方”加权抽选。起点：${frame.centers.map(c => point(c)).join('、')}。`;
      } else if (frame.type === 'assign') {
        colorFish(frame.labels); drawLines(frame.labels, frame.centers); arrows.replaceChildren();
        if (frame.changed) announce(`第 ${frame.round} 轮 · 认领`);
        if (frame.round === 1) voice('klee-assign', {queue: true}); else if (!frame.changed) voice('klee-settled', {minor: true});
        say(frame.round === 1 ? '第 1 轮·认领：每条鱼找离自己最近的炸弹，颜色一样的就是同一队！'
          : frame.changed ? `第 ${frame.round} 轮·认领：有 ${frame.changed} 条鱼换了炸弹～` : `第 ${frame.round} 轮·认领：没有鱼换炸弹啦，位置定下来了！`, frame.changed ? 'thinking' : 'proud');
        const sizes = Array.from({length: frame.centers.length}, (_, c) => `${ELEMENTS[c % COLORS]}队 ${frame.labels.filter(label => label === c).length}`);
        insightStep.textContent = `第 ${frame.round} 轮 · 分配：c(i) = argmin‖xᵢ − μₖ‖²。${sizes.join('，')} 条；` +
          `${frame.round === 1 ? '首次分配' : frame.changed + ' 条鱼改变了归属'}。`;
      } else if (frame.type === 'update') {
        drawArrows(frame.from, frame.centers); drawBombs(frame.centers, 'klee'); drawLines(frame.labels, frame.centers);
        const moves = frame.from.map((start, c) => Math.sqrt(distance2(start, frame.centers[c]))), far = moves.indexOf(Math.max(...moves));
        say(`第 ${frame.round} 轮·挪动：每颗炸弹挪到自己那队鱼的正中间！`, 'curious');
        if (frame.round === 1) voice('klee-update', {minor: true});
        insightStep.textContent = `第 ${frame.round} 轮 · 更新：μₖ = 分到第 k 颗炸弹的鱼的平均位置。移动最多的是第 ${far + 1} 颗：` +
          `${point(frame.from[far])} → ${point(frame.centers[far])}，挪了 ${moves[far].toFixed(1)}。`;
      } else if (frame.type === 'done') finish(frame);
      hud();
    }
    function advance() {
      if (frameIndex >= frames.length) { stopTimer(); return; }
      showFrame(frames[frameIndex++]);
      if (frameIndex >= frames.length) stopTimer();
      setPhase(frameIndex >= frames.length ? phase : 'algorithm');
    }
    function play() { stopTimer(); timer = setInterval(advance, reduced() ? 700 : 1100); setPhase('algorithm'); }
    function finish(frame) {
      stopTimer(); setPhase('finishing'); lines.replaceChildren(); arrows.replaceChildren(); drawBombs(frame.centers, 'klee');
      announce('嘿——咻！'); voice('klee-blast');
      say('找到啦，就是这里！嘿——咻！', 'laugh');
      blast(frame.centers, () => {
        const result = model.caught(water.fish, frame.centers), kleeCaught = result.filter(Boolean).length;
        colorFish(frame.labels, result);
        const playerDistance = model.averageDistance(water.fish, player), kleeDistance = model.averageDistance(water.fish, frame.centers);
        score(scoreKlee, kleeCaught, kleeDistance);
        // Where the player threw, for a side-by-side comparison.
        player.forEach(bomb => { const mine = svg('g', {class: 'fish-mine', transform: `translate(${bomb.x} ${bomb.y})`}, arrows);
          svg('circle', {r: 12}, mine); svg('text', {y: 4}, mine).textContent = '你'; });
        scorePlayer.classList.toggle('is-winner', playerCaught > kleeCaught); scoreKlee.classList.toggle('is-winner', kleeCaught > playerCaught);
        stats.rounds++; if (playerCaught > kleeCaught) stats.wins++; stats.best = Math.max(stats.best, playerCaught);
        const closer = kleeDistance < playerDistance;
        announce(playerCaught > kleeCaught ? '旅行者胜！' : playerCaught === kleeCaught ? '平手！' : '可莉胜！');
        say(playerCaught > kleeCaught ? `哎呀，旅行者炸到 ${playerCaught} 条，可莉只有 ${kleeCaught} 条，你赢啦！` : playerCaught === kleeCaught
          ? `平手！都是 ${kleeCaught} 条，嘿嘿～` : `可莉炸到 ${kleeCaught} 条，旅行者 ${playerCaught} 条，可莉赢啦！好耶！`,
          playerCaught > kleeCaught ? 'care' : playerCaught === kleeCaught ? 'happy' : 'proud');
        voice(playerCaught > kleeCaught ? 'klee-lose' : playerCaught === kleeCaught ? 'klee-tie' : 'klee-win', {queue: true});
        verdict.textContent = (playerCaught > kleeCaught && closer
          ? `你炸到的更多，但可莉的炸弹离鱼的平均距离更小（${Math.round(kleeDistance)} 对 ${Math.round(playerDistance)}）。K-means 追求的是“离得近”，不是“炸得多”，所以它不一定赢。`
          : `可莉的炸弹离鱼的平均距离是 ${Math.round(kleeDistance)}，你的是 ${Math.round(playerDistance)}。K-means 每一轮都让这个距离变得更小。`)
          + ` 这片湖其实有 ${water.schools} 群鱼${water.schools === k() ? '，K 正好选对了！' : `，试试把 K 设成 ${water.schools}？`}`;
        verdict.hidden = false;
        insightStep.textContent = `收敛：第 ${frames.at(-2).round} 轮没有鱼改变归属，算法停止。距离平方和（SSE）从 ${Math.round(sseHistory[0])} 降到 ${Math.round(frame.sse)}。`;
        save(); showStats(); setPhase('done'); describe();
        if (stats.rounds % 3 === 0) wait(() => { stats.jail++; save(); showStats(); setFace('care'); jean.hidden = false; jeanButton.focus();
          const lineId = stats.jail % 2 ? 'jean-caught' : 'jean-lecture';
          const subtitle = $('[data-fish-jean-line]');
          if (subtitle && recording(lineId)?.text) subtitle.textContent = recording(lineId).text;
          voice(lineId, {queue: true}); }, reduced() ? 100 : 1400);
      });
    }
    algorithmButton.addEventListener('click', () => {
      if (phase === 'thrown') {
        frames = model.kmeans(water.fish, k(), water.seed); frameIndex = 0; sseHistory = []; verdict.hidden = true;
        colorFish(); advance(); play(); return;
      }
      if (phase === 'algorithm') { if (timer) { stopTimer(); setPhase('algorithm'); } else play(); }
    });
    stepButton.addEventListener('click', () => { stopTimer(); advance(); });
    skipButton.addEventListener('click', () => { stopTimer(); while (frameIndex < frames.length - 1) { const frame = frames[frameIndex++]; if (frame.sse !== undefined) sseHistory.push(frame.sse); } advance(); });

    // ----- Rounds -----
    function again() {
      stopTimer(); stopVoice(); clock.clear();
      player = []; frames = []; frameIndex = 0; sseHistory = []; playerCaught = 0;
      stage.classList.remove('is-shaking'); drawWater(); score(scorePlayer, null, null); score(scoreKlee, null, null);
      scorePlayer.classList.remove('is-winner'); scoreKlee.classList.remove('is-winner'); verdict.hidden = true; jean.hidden = true;
      insightStep.textContent = '放下炸弹后，这里会显示每条鱼离哪颗炸弹最近。'; showSse();
      setPhase('place'); describe();
      say(`湖里有 ${water.fish.length} 条鱼！点湖面放下 ${k()} 颗蹦蹦炸弹，虚线圈就是爆炸范围。旅行者先来！`, 'happy');
      voice('klee-intro');
    }
    function newLake(seed = 1000 + Math.floor(Math.random() * 9000)) { water = model.makeLake(seed); seedLabel.textContent = '#' + seed; again(); }
    againButton.addEventListener('click', again);
    newButton.addEventListener('click', () => newLake());
    kInput.addEventListener('input', () => {
      kValue.textContent = k();
      if (phase === 'place') { player = player.slice(0, k()); bombs.dataset.owner = ''; renderPlace(); if (!player.length) again(); } else again();
    });
    insightToggle.addEventListener('change', () => {
      insight.hidden = !insightToggle.checked;
      if (phase === 'place') renderPlace();
      else if (phase === 'algorithm' || phase === 'done') {
        const last = frames[Math.max(0, frameIndex - 1)];
        drawLines(phase === 'done' ? null : last?.labels, last?.centers || []);
        if (last?.type === 'update') drawArrows(last.from, last.centers); else if (phase !== 'done') arrows.replaceChildren();
      }
    });
    jeanButton.addEventListener('click', () => { jean.hidden = true; say('对不起嘛……可莉知道错了，下次……下次换个湖炸！', 'care'); voice('klee-sorry'); });

    const seedFromHash = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('lake'));
    kValue.textContent = k(); insight.hidden = !insightToggle.checked; showStats();
    newLake(Number.isSafeInteger(seedFromHash) && seedFromHash > 0 ? seedFromHash : undefined);
    // Switching tabs, hiding the page or leaving pauses the animation.
    return () => { stopVoice(); if (timer) { stopTimer(); setPhase('algorithm'); } };
  }

  return {model, init};
});
