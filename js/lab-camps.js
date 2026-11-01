/* Klee clears the hilichurl camps with as few bombs as possible: the greedy
   "leftmost uncleared camp, throw as far right as still reaches it" rule.
   The player throws first; Klee first tries her instinct (bomb right on the
   camp), then the clever rule, and finally slides the player's own bombs
   right one by one — the exchange argument from the article. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') {
    window.LabCamps = api.model;
    window.LabExperiments = Object.assign(window.LabExperiments || {}, {camps: api.init});
  }
})(function () {
  'use strict';
  // The road is u ∈ [0, 20]; a bomb at b clears every camp with |x − b| ≤ 2.
  const WIDTH = 640, HEIGHT = 320, ROAD = 20, RADIUS = 2, GRID = 0.5, X0 = 40, S = 28, ROAD_Y = 196, EPS = 1e-9;

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
  const toX = u => X0 + u * S;
  const toU = x => (x - X0) / S;
  const snap = u => Math.max(0, Math.min(ROAD, Math.round(u / GRID) * GRID));
  const covers = (bomb, camp, radius = RADIUS) => Math.abs(camp - bomb) <= radius + EPS;
  const cleared = (camps, bombs, radius = RADIUS) => camps.map(camp => bombs.some(bomb => covers(bomb, camp, radius)));

  // Sweep left to right. Each round looks at the leftmost camp still standing:
  // "naive" throws right on it, "greedy" throws as far right as still reaches it.
  function sweep(camps, strategy = 'greedy', radius = RADIUS, road = ROAD) {
    const done = camps.map(() => false), frames = [];
    for (;;) {
      const camp = done.indexOf(false); if (camp < 0) break;
      const x = camps[camp], bomb = strategy === 'greedy' ? Math.min(x + radius, road) : x, hit = [];
      camps.forEach((other, j) => { if (!done[j] && covers(bomb, other, radius)) { done[j] = true; hit.push(j); } });
      frames.push({camp, x, window: [Math.max(0, x - radius), Math.min(road, x + radius)], bomb, hit});
    }
    return {frames, bombs: frames.map(frame => frame.bomb)};
  }
  // How many camps, counted from the left, the first k bombs (sorted) clear without a gap.
  function frontier(camps, bombs, radius = RADIUS) {
    const sorted = [...bombs].sort((a, b) => a - b), out = [0];
    for (let k = 1; k <= sorted.length; k++) {
      const used = sorted.slice(0, k); let count = 0;
      while (count < camps.length && used.some(bomb => covers(bomb, camps[count], radius))) count++;
      out.push(count);
    }
    return out;
  }
  // The exchange argument run on the player's own answer: for the leftmost camp
  // not yet handled, take one of the player's bombs that reaches it and slide it to
  // x + r. Nothing it used to clear is lost, so the count never grows.
  function exchange(camps, bombs, radius = RADIUS, road = ROAD) {
    if (!cleared(camps, bombs, radius).every(Boolean)) return null;
    const now = bombs.slice(), moved = bombs.map(() => false), done = camps.map(() => false), frames = [];
    for (;;) {
      const camp = done.indexOf(false); if (camp < 0) break;
      const x = camps[camp], to = Math.min(x + radius, road);
      let pick = -1;
      now.forEach((bomb, j) => { if (!moved[j] && covers(bomb, x, radius) && (pick < 0 || bomb < now[pick])) pick = j; });
      const from = now[pick];
      const kept = camps.filter((other, j) => !done[j] && covers(from, other, radius)).length;
      now[pick] = to; moved[pick] = true;
      const hit = [];
      camps.forEach((other, j) => { if (!done[j] && covers(to, other, radius)) { done[j] = true; hit.push(j); } });
      frames.push({camp, x, bomb: pick, from, to, hit, kept});
    }
    return {frames, positions: now, spare: bombs.map((_, j) => j).filter(j => !moved[j])};
  }
  function makeMap(seed) {
    const rng = random(seed);
    let camps = [];
    for (let attempt = 0; attempt < 80; attempt++) {
      const n = 8 + Math.floor(rng() * 4), set = new Set();
      let u = 0.5 + Math.floor(rng() * 3) * GRID;
      while (set.size < n && u <= ROAD - 0.5) {
        set.add(u);
        u += rng() < 0.62 ? 0.5 + Math.floor(rng() * 3) * GRID : 2.5 + Math.floor(rng() * 6) * GRID;
      }
      camps = [...set].sort((a, b) => a - b);
      if (camps.length < 7) continue;
      const best = sweep(camps).frames.length, naive = sweep(camps, 'naive').frames.length;
      // Every lake teaches something: the instinct wastes a bomb, the clever rule is optimal.
      if (best >= 3 && best <= 6 && naive > best) break;
    }
    return {seed, camps, radius: RADIUS, road: ROAD, best: sweep(camps).frames.length, naive: sweep(camps, 'naive').frames.length};
  }
  // Camps whose greedy rounds started are pairwise more than 2r apart: no bomb can
  // reach two of them, so any answer needs at least that many bombs.
  const witnesses = camps => sweep(camps).frames.map(frame => frame.x);

  const model = {WIDTH, HEIGHT, ROAD, RADIUS, GRID, X0, S, ROAD_Y, random, toX, toU, snap, covers, cleared, sweep, frontier, exchange, makeMap, witnesses};

  // ---------- Game ----------
  const STORE = 'lsworld.klee.camps.v1';
  const NAMES = {naive: '可莉的直觉', greedy: '可莉的妙计'};
  function init(panel) {
    const $ = selector => panel.querySelector(selector);
    const kit = window.LabGameKit, {svg, reduced, restart} = kit;
    const view = $('[data-camp-map]'), stage = $('.fish-stage'), decor = $('[data-camp-decor]'), ruler = $('[data-camp-ruler]');
    const windowLayer = $('[data-camp-window]'), ranges = $('[data-camp-ranges]'), campLayer = $('[data-camp-camps]');
    const bombLayer = $('[data-camp-bombs]'), effects = $('[data-camp-fx]'), cursor = $('[data-camp-cursor]'), klee = $('[data-camp-klee]');
    const banner = $('[data-camp-banner]'), hudMap = $('[data-camp-hud-map]'), hudState = $('[data-camp-hud-state]');
    const face = $('[data-camp-face]'), bubble = $('.fish-klee-line'), line = $('[data-camp-line]');
    const insightToggle = $('[data-camp-insight-toggle]'), insight = $('[data-camp-insight]'), insightStep = $('[data-camp-insight-step]');
    const chartPlayer = $('[data-camp-chart="player"]'), chartKlee = $('[data-camp-chart="klee"]'), chartValue = $('[data-camp-chart-value]');
    const throwButton = $('[data-camp-throw]'), algorithmButton = $('[data-camp-algorithm]'), stepButton = $('[data-camp-step]'), skipButton = $('[data-camp-skip]');
    const retryButton = $('[data-camp-retry]'), exchangeButton = $('[data-camp-exchange]'), againButton = $('[data-camp-again]'), newButton = $('[data-camp-new]');
    const seedLabel = $('[data-camp-seed]'), scorePlayer = $('[data-camp-score="player"]'), scoreKlee = $('[data-camp-score="klee"]'), verdict = $('[data-camp-verdict]');
    const kleeLabel = $('[data-camp-klee-label]'), strategyInputs = [...panel.querySelectorAll('[name="camp-strategy"]')];
    const strategy = () => strategyInputs.find(input => input.checked)?.value || 'naive';

    // ----- Klee hosts the game: bubble, expressions, banner and voice -----
    const {say, announce, voice, stopVoice} = kit.host(panel, {face, bubble, line, banner, mirrors: [klee.querySelector('.hike-klee-face')],
      toggle: $('[data-camp-voice-toggle]'), voiceAttr: 'campVoice'});

    const stats = kit.stats(STORE, {rounds: 0, wins: 0, best: 0}).data, save = () => kit.store.set(STORE, JSON.stringify(stats));
    const showStats = () => { for (const key of ['rounds', 'wins', 'best']) $(`[data-camp-stat="${key}"]`).textContent = stats[key]; };

    let map = null, phase = 'place', player = [], playerResult = null, run = null, frameIndex = 0, timer = null, swap = null, swapIndex = 0, standing = [];
    const clock = kit.timers(), wait = clock.wait;
    const fmt = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
    const left = () => standing.filter(Boolean).length;

    // ----- Scenery: far hills, trees and rocks off the road, drawn once per map -----
    function drawRuler() {
      ruler.replaceChildren();
      svg('line', {class: 'camp-ruler-line', x1: toX(0), y1: 262, x2: toX(ROAD), y2: 262}, ruler);
      for (let u = 0; u <= ROAD; u += 1) {
        svg('line', {class: 'camp-tick' + (u % 2 ? '' : ' is-major'), x1: toX(u), y1: 262, x2: toX(u), y2: u % 2 ? 267 : 270}, ruler);
        if (u % 2 === 0) svg('text', {class: 'camp-tick-label', x: toX(u), y: 284}, ruler).textContent = u;
      }
    }
    function drawDecor() {
      decor.replaceChildren();
      const rng = random(map.seed * 7 + 3);
      for (let i = 0; i < 16; i++) {
        const x = 20 + rng() * 600, y = 88 + rng() * 52, s = 0.75 + rng() * 0.5;
        const tree = svg('g', {class: 'hike-tree', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`}, decor);
        svg('ellipse', {class: 'hike-tree-shadow', cx: 3, cy: 6, rx: 7, ry: 2.5}, tree);
        svg('rect', {class: 'hike-trunk', x: -1.2, y: 1, width: 2.4, height: 5}, tree);
        svg('path', {class: 'hike-leaves', d: 'M0-13L7 2H-7Z'}, tree);
        svg('path', {class: 'hike-leaves is-light', d: 'M0-13L4-4H-4Z'}, tree);
      }
      for (let i = 0; i < 10; i++) {
        const x = 20 + rng() * 600, y = 238 + rng() * 10;
        svg('ellipse', {class: 'camp-rock', cx: x.toFixed(1), cy: y.toFixed(1), rx: (3 + rng() * 4).toFixed(1), ry: (2 + rng() * 2).toFixed(1)}, decor);
      }
    }
    function drawCamps() {
      campLayer.replaceChildren();
      const rng = random(map.seed * 13 + 5);
      map.camps.forEach((u, i) => {
        const lift = (rng() - .5) * 10, node = svg('g', {class: 'camp', 'data-camp': i, transform: `translate(${toX(u)} ${(ROAD_Y + lift).toFixed(1)})`}, campLayer);
        svg('ellipse', {class: 'camp-shadow', cy: 9, rx: 13, ry: 3.5}, node);
        const hut = svg('g', {class: 'camp-hut'}, node);
        svg('rect', {class: 'camp-wall', x: -9, y: -4, width: 18, height: 13, rx: 1.5}, hut);
        svg('path', {class: 'camp-roof', d: 'M-13-2L0-17 13-2Z'}, hut);
        svg('path', {class: 'camp-straw', d: 'M-8-6L-4-12M-2-5L1-14M4-6L7-10'}, hut);
        svg('path', {class: 'camp-door', d: 'M-3 9V3Q0 0 3 3V9Z'}, hut);
        const mask = svg('g', {class: 'camp-mask', transform: 'translate(0 -22)'}, hut);
        svg('path', {class: 'camp-pole', d: 'M0 5V12'}, mask);
        svg('ellipse', {class: 'camp-mask-face', rx: 5.5, ry: 6.5}, mask);
        svg('path', {class: 'camp-mask-mark', d: 'M-3-2L-1 0M3-2L1 0M-2 3H2'}, mask);
        const rubble = svg('g', {class: 'camp-rubble'}, node);
        svg('path', {class: 'camp-rubble-pile', d: 'M-12 9Q-8 1-3 5Q0-1 4 4Q9 0 12 9Z'}, rubble);
        svg('path', {class: 'camp-rubble-stick', d: 'M-7 4L-1-3M3 5L9-1'}, rubble);
        svg('circle', {class: 'camp-smoke', cx: -2, cy: -6, r: 5}, rubble); svg('circle', {class: 'camp-smoke', cx: 4, cy: -11, r: 4}, rubble);
        svg('text', {class: 'camp-label', y: 24}, node).textContent = fmt(u);
      });
    }
    function showCamps({instant = false} = {}) {
      campLayer.querySelectorAll('.camp').forEach((node, i) => {
        node.classList.toggle('is-cleared', !standing[i]);
        if (instant) node.classList.remove('is-hit');
      });
    }

    // ----- Bombs and their reach (a capsule [b − r, b + r] across the road) -----
    function makeBomb(owner, index) {
      const group = svg('g', {class: `camp-bomb camp-bomb-${owner}`});
      const piece = svg('g', {class: 'camp-bomb-piece'}, group);
      svg('ellipse', {class: 'camp-bomb-shadow', cy: 13, rx: 10, ry: 3}, piece);
      svg('path', {class: 'fish-fuse', d: 'M5-9Q8-16 14-14'}, piece);
      svg('circle', {class: 'fish-fuse-spark', cx: 14.5, cy: -14.5, r: 2.6}, piece);
      svg('circle', {class: 'camp-bomb-body', r: 11}, piece);
      svg('path', {class: 'fish-bomb-star', d: 'M-3-6.5L-1.8-3.3 1.4-2.1-1.8-.9-3 2.3-4.2-.9-7.4-2.1-4.2-3.3Z'}, piece);
      svg('ellipse', {class: 'fish-bomb-shine', cx: 4, cy: -5, rx: 3, ry: 1.8, transform: 'rotate(30 4 -5)'}, piece);
      svg('circle', {class: 'camp-bomb-badge', cx: 8.5, cy: 8.5, r: 6}, piece);
      svg('text', {class: 'fish-bomb-label', x: 8.5, y: 11.4}, piece).textContent = index + 1;
      return group;
    }
    function rangeNode(owner, u) {
      const node = svg('rect', {class: `camp-range camp-range-${owner}`, y: ROAD_Y - 34, height: 68, rx: 34}, ranges);
      placeRange(node, u); return node;
    }
    function placeRange(node, u) {
      const a = toX(Math.max(0, u - RADIUS)), b = toX(Math.min(ROAD, u + RADIUS));
      node.setAttribute('x', a.toFixed(1)); node.setAttribute('width', (b - a).toFixed(1));
    }
    function drawBombs(list, owner, {drop = false} = {}) {
      bombLayer.replaceChildren(); ranges.replaceChildren();
      list.forEach((u, i) => addBomb(u, owner, i, {drop}));
    }
    function addBomb(u, owner, index, {drop = false} = {}) {
      rangeNode(owner, u).dataset.index = index;
      const group = makeBomb(owner, index); group.dataset.index = index;
      group.style.transform = `translate(${toX(u)}px, ${ROAD_Y - 2}px)`;
      if (drop && !reduced()) group.classList.add('is-dropping');
      bombLayer.append(group); return group;
    }
    function blast(list, done) {
      const quiet = reduced();
      for (const u of list) {
        const a = toX(Math.max(0, u - RADIUS)), b = toX(Math.min(ROAD, u + RADIUS));
        const flash = svg('rect', {class: 'camp-flash', x: a, y: ROAD_Y - 34, width: b - a, height: 68, rx: 34}, effects);
        wait(() => flash.remove(), 900);
        if (quiet) continue;
        for (let i = 0; i < 10; i++) {
          const angle = i / 10 * Math.PI * 2 + u, reach = 26 + (i % 3) * 12;
          const bit = svg('path', {class: 'fish-ember', d: `M${toX(u)} ${ROAD_Y - 6}l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z`}, effects);
          bit.style.setProperty('--dx', `${(Math.cos(angle) * reach).toFixed(1)}px`); bit.style.setProperty('--dy', `${(Math.sin(angle) * reach * .6).toFixed(1)}px`);
          wait(() => bit.remove(), 900);
        }
      }
      bombLayer.querySelectorAll('.camp-bomb').forEach(group => group.classList.add('is-spent'));
      if (!quiet) restart(stage, 'is-shaking');
      wait(done, quiet ? 50 : 450);
    }
    function pop(index, text = '清除！') {
      const node = campLayer.children[index]; if (!node) return;
      node.classList.add('is-hit');
      if (reduced()) return;
      const label = svg('text', {class: 'camp-pop', x: toX(map.camps[index]), y: ROAD_Y - 34}, effects); label.textContent = text;
      wait(() => label.remove(), 900);
    }
    // The leftmost camp still standing and the stretch where a bomb would still reach it.
    function drawWindow(frame, owner) {
      windowLayer.replaceChildren();
      if (!frame) return;
      const x = toX(frame.x), a = toX(frame.window[0]), b = toX(frame.window[1]);
      svg('path', {class: 'camp-pointer', d: `M${x} ${ROAD_Y - 52}l-6-10h12z`}, windowLayer);
      svg('text', {class: 'camp-pointer-label', x, y: ROAD_Y - 66}, windowLayer).textContent = '最左的营地';
      if (!insightToggle.checked && owner !== 'swap') return;
      svg('rect', {class: 'camp-window', x: a, y: 250, width: b - a, height: 24, rx: 6}, windowLayer);
      svg('path', {class: 'camp-window-edge', d: `M${a} 248V276M${b} 248V276`}, windowLayer);
      const pick = owner === 'naive' ? x : b;
      svg('path', {class: 'camp-window-pick', d: `M${pick} 246l-5-8h10z`}, windowLayer);
      svg('text', {class: 'camp-window-label', x: (a + b) / 2, y: 300}, windowLayer).textContent = `能炸到它的位置 ${fmt(frame.window[0])}～${fmt(frame.window[1])}`;
    }
    function moveKlee(u, {hop = true} = {}) {
      klee.style.transform = `translate(${toX(u)}px, ${ROAD_Y - 44}px)`;
      if (hop && !reduced()) restart(klee, 'is-hopping');
    }

    // ----- Board state -----
    function chart() {
      const series = [[chartPlayer, playerResult ? frontier(map.camps, player) : []], [chartKlee, run ? frontier(map.camps, run.bombs.slice(0, frameIndex)) : []]];
      const span = Math.max(2, ...series.map(([, values]) => values.length)) - 1, n = map.camps.length;
      for (const [node, values] of series) node.setAttribute('points', values.map((value, i) => `${(6 + i * 288 / span).toFixed(1)},${(60 - value / n * 54).toFixed(1)}`).join(' '));
      chartValue.textContent = run ? `可莉第 ${frameIndex} 颗后，从左数清掉 ${frontier(map.camps, run.bombs.slice(0, frameIndex)).at(-1)} 个` : '扔完以后显示';
    }
    function score(node, result) {
      node.querySelector('strong').textContent = result ? (result.missed ? `漏了 ${result.missed} 个` : `${result.bombs} 颗炸弹`) : '—';
      node.querySelector('small').textContent = result ? `清掉 ${result.cleared}/${map.camps.length} 个营地` : `清掉 —/${map.camps.length} 个营地`;
      node.querySelector('.fish-score-bar i').style.width = result ? `${result.cleared / map.camps.length * 100}%` : '0%';
    }
    const setPhase = value => {
      phase = value; panel.dataset.campPhase = value;
      throwButton.disabled = value !== 'place';
      algorithmButton.disabled = !['thrown', 'algorithm'].includes(value);
      stepButton.disabled = skipButton.disabled = !['algorithm', 'swap'].includes(value);
      retryButton.disabled = value !== 'done';
      exchangeButton.disabled = value !== 'done' || !playerResult || playerResult.missed > 0;
      strategyInputs.forEach(input => { input.disabled = ['algorithm', 'finishing', 'swap'].includes(value); });
      algorithmButton.textContent = value === 'algorithm' ? (timer ? '暂停' : '继续') : '看可莉怎么炸';
      cursor.toggleAttribute('hidden', value !== 'place');
      hud();
    };
    function hud() {
      if (!map) return;
      hudMap.textContent = `营地 #${map.seed} · 还剩 ${left()} 个`;
      hudState.textContent = phase === 'place' ? `旅行者 · 炸弹 ${player.length}/${map.camps.length}` : phase === 'done' ? '本局结算'
        : phase === 'throwing' ? '嘿——咻！' : phase === 'swap' ? `挪炸弹 · 第 ${swapIndex} 次` : phase === 'algorithm' || phase === 'finishing' ? `${NAMES[run?.strategy || strategy()]} · 第 ${frameIndex} 颗` : '准备交给可莉';
    }

    // ----- Player throws -----
    function viewPoint(event) {
      const matrix = view.getScreenCTM(); if (!matrix) return null;
      const p = view.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const q = p.matrixTransform(matrix.inverse());
      return {u: snap(toU(q.x)), y: q.y};
    }
    view.addEventListener('click', event => {
      if (phase !== 'place') return;
      const at = viewPoint(event); if (!at) return;
      const hit = player.findIndex(u => Math.abs(u - at.u) < 0.6);
      if (hit >= 0) { player.splice(hit, 1); drawBombs(player, 'player'); say(`收回一颗。现在放了 ${player.length} 颗。`, 'curious'); hud(); return; }
      if (player.length >= map.camps.length) { say('炸弹已经够多啦！点一颗炸弹可以收回它。', 'wink'); return; }
      player.push(at.u); addBomb(at.u, 'player', player.length - 1, {drop: true});
      const reach = map.camps.filter(u => covers(at.u, u)).length;
      say(reach ? `放在 ${fmt(at.u)}，这颗能炸到 ${reach} 个营地！` : `放在 ${fmt(at.u)}……这颗什么都炸不到哦。`, reach ? 'happy' : 'care');
      if (player.length === 1) voice('klee-camp-ready', {minor: true});
      hud();
    });
    view.addEventListener('pointermove', event => {
      if (phase !== 'place' || event.pointerType === 'touch') { cursor.setAttribute('hidden', ''); return; }
      const at = viewPoint(event); if (!at) return;
      placeRange(cursor.querySelector('rect'), at.u);
      cursor.querySelector('line').setAttribute('x1', toX(at.u)); cursor.querySelector('line').setAttribute('x2', toX(at.u));
      cursor.removeAttribute('hidden');
    });
    view.addEventListener('pointerleave', () => cursor.setAttribute('hidden', ''));
    throwButton.addEventListener('click', () => {
      if (phase !== 'place') return;
      if (!player.length) { say('先点路面放炸弹嘛！', 'wink'); return; }
      setPhase('throwing'); announce('嘿——咻！'); voice('klee-blast');
      const hits = cleared(map.camps, player);
      blast(player, () => {
        hits.forEach((hit, i) => { if (hit) { standing[i] = false; pop(i); } });
        showCamps();
        const missed = hits.filter(hit => !hit).length;
        playerResult = {bombs: player.length, cleared: map.camps.length - missed, missed};
        score(scorePlayer, playerResult); setPhase('thrown'); chart();
        if (missed) { say(`哎呀，还有 ${missed} 个营地没炸到！看可莉的！`, 'care'); voice('klee-camp-miss', {queue: true}); }
        else { say(`${player.length} 颗炸弹清光了所有营地！看可莉能不能更少～`, 'laugh'); voice('klee-camp-done', {queue: true}); }
      });
    });

    // ----- Klee sweeps from left to right, one bomb per round -----
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    // A round lands its bomb, then blows up; a pending round can be settled at once.
    let pending = null;
    function land(round, instant) {
      if (round.landed) return; round.landed = true;
      addBomb(round.frame.bomb, 'klee', round.index, {drop: !instant});
    }
    function fire(round, instant) {
      if (round.fired) return; round.fired = true; if (pending === round) pending = null;
      round.frame.hit.forEach(i => { standing[i] = false; if (!instant) pop(i); });
      showCamps({instant}); chart(); hud();
      if (round.index === run.frames.length - 1) finish();
    }
    function settle() {
      if (!pending) return;
      const round = pending; pending = null; clock.clear(); effects.replaceChildren();
      land(round, true); fire(round, true);
    }
    function showFrame(frame, {instant = false} = {}) {
      const owner = run.strategy, index = frameIndex - 1, round = {frame, index, landed: false, fired: false};
      drawWindow(frame, owner); moveKlee(frame.bomb, {hop: !instant});
      const list = frame.hit.map(i => fmt(map.camps[i])).join('、');
      insightStep.textContent = `第 ${index + 1} 颗：最左还没炸的营地在 ${fmt(frame.x)}，能炸到它的位置是 ${fmt(frame.window[0])}～${fmt(frame.window[1])}。` +
        (owner === 'greedy' ? `可莉扔在最右边的 ${fmt(frame.bomb)}` : `可莉直接扔在营地上 ${fmt(frame.bomb)}`) + `，清掉 ${list}。`;
      if (instant) { land(round, true); fire(round, true); return; }
      pending = round;
      say(index === 0 ? (owner === 'greedy' ? '最左边的营地……往右挪到刚好够得着的地方，扔！' : '最左边的营地，就扔在它头上！') : `第 ${index + 1} 颗！还剩 ${left()} 个营地～`, owner === 'greedy' ? 'proud' : 'happy');
      wait(() => { land(round, false); wait(() => { if (!round.fired) blast([frame.bomb], () => fire(round, false)); }, 380); }, 260);
    }
    function advance({instant = false} = {}) {
      if (!run || frameIndex >= run.frames.length) return;
      settle();
      showFrame(run.frames[frameIndex++], {instant});
      if (frameIndex < run.frames.length) setPhase('algorithm');
    }
    function play() { stopTimer(); timer = setInterval(advance, reduced() ? 500 : 1500); setPhase('algorithm'); }
    function resetBoard() {
      clock.clear(); pending = null; effects.replaceChildren(); windowLayer.replaceChildren();
      standing = map.camps.map(() => true); showCamps({instant: true});
      campLayer.querySelectorAll('.camp').forEach(node => node.classList.remove('is-hit', 'is-witness'));
    }
    function startKlee() {
      stopTimer(); resetBoard(); drawBombs([], 'klee');
      run = {...sweep(map.camps, strategy()), strategy: strategy()}; frameIndex = 0;
      kleeLabel.textContent = NAMES[run.strategy];
      verdict.hidden = true; scoreKlee.classList.remove('is-winner'); scorePlayer.classList.remove('is-winner'); score(scoreKlee, null);
      announce(run.strategy === 'greedy' ? '可莉的妙计！' : '可莉的回合！');
      voice(run.strategy === 'greedy' ? 'klee-camp-clever' : 'klee-camp-start', {queue: true});
      moveKlee(0, {hop: false}); advance(); play();
    }
    function finish() {
      stopTimer(); setPhase('finishing');
      const count = run.bombs.length, result = {bombs: count, cleared: map.camps.length, missed: 0};
      score(scoreKlee, result);
      wait(() => {
        windowLayer.replaceChildren();
        const playerBombs = playerResult.missed ? Infinity : playerResult.bombs;
        const playerWins = playerBombs < count, kleeWins = count < playerBombs;
        scorePlayer.classList.toggle('is-winner', playerWins); scoreKlee.classList.toggle('is-winner', kleeWins);
        stats.rounds++; if (playerWins) stats.wins++; if (playerBombs === map.best) stats.best++; save(); showStats();
        if (kleeWins) { announce('可莉赢啦！'); say(`可莉只用了 ${count} 颗炸弹！嘿嘿～`, 'proud'); voice('klee-camp-win', {queue: true}); }
        else if (playerWins) { announce('旅行者赢啦！'); say(`旅行者只用了 ${playerBombs} 颗，比可莉还少！`, 'care'); voice('klee-camp-lose', {queue: true}); }
        else { announce('一样多！'); say(`都是 ${count} 颗！我们都是爆破专家！`, 'laugh'); voice('klee-camp-tie', {queue: true}); }
        const witnessCamps = witnesses(map.camps);
        if (run.strategy === 'greedy') campLayer.querySelectorAll('.camp').forEach((node, i) => node.classList.toggle('is-witness', witnessCamps.includes(map.camps[i])));
        const you = playerResult.missed ? `旅行者漏了 ${playerResult.missed} 个营地。` : playerBombs === map.best ? `旅行者的 ${playerBombs} 颗也是最少的！` : `旅行者用了 ${playerBombs} 颗，多了 ${playerBombs - map.best} 颗。`;
        verdict.textContent = run.strategy === 'naive'
          ? `可莉的直觉是“扔在最左的营地头上”，结果用了 ${count} 颗：炸弹左半边的威力全浪费在已经清掉的地方。${you} 点“换个想法再炸”，看看往右挪一挪会怎样。`
          : `可莉的妙计：每次找最左边还没炸的营地，把炸弹扔到“刚好还能炸到它”的最右边（营地 + ${RADIUS}），共 ${count} 颗。这就是最少：亮起来的 ${witnessCamps.length} 个营地两两相距超过 ${RADIUS * 2}，一颗炸弹最多炸到其中一个。${you}` + (playerResult.missed ? '' : ' 点“挪一挪你的炸弹”，看你的方案怎样一步步变成可莉的方案。');
        verdict.hidden = false; setPhase('done');
        insightStep.textContent = `结果：${NAMES[run.strategy]}用了 ${count} 颗炸弹；这条路最少需要 ${map.best} 颗。`;
      }, reduced() ? 50 : 500);
    }
    algorithmButton.addEventListener('click', () => {
      if (phase === 'thrown') { startKlee(); return; }
      if (phase === 'algorithm') { if (timer) { stopTimer(); setPhase('algorithm'); } else play(); }
    });
    stepButton.addEventListener('click', () => {
      stopTimer();
      if (phase === 'swap') { swapStep(); return; }
      advance();
    });
    skipButton.addEventListener('click', () => {
      stopTimer(); clock.clear(); effects.replaceChildren(); pending = null;
      if (phase === 'swap') { while (swap && swapIndex < swap.frames.length) swapStep({instant: true}); if (phase === 'swap') endSwap(); return; }
      // Replay every round instantly from a clean board so nothing is half-drawn.
      resetBoard(); drawBombs([], 'klee'); frameIndex = 0;
      while (run && frameIndex < run.frames.length) advance({instant: true});
    });
    retryButton.addEventListener('click', () => {
      if (phase !== 'done') return;
      const other = strategyInputs.find(input => input.value !== strategy()); if (other) other.checked = true;
      setPhase('thrown'); startKlee();
    });

    // ----- Exchange argument on the player's own bombs -----
    function startSwap() {
      stopTimer(); resetBoard(); drawBombs(player, 'player');
      swap = exchange(map.camps, player); swapIndex = 0;
      bombLayer.querySelectorAll('.camp-bomb').forEach(group => group.classList.add('is-waiting'));
      setPhase('swap'); announce('挪一挪！'); voice('klee-camp-swap', {queue: true});
      say('从左往右看：每次找最左边还没炸的营地，把你炸到它的那颗炸弹往右挪到刚好够得着的地方。', 'thinking');
      insightStep.textContent = '交换论证：换掉你方案里的一颗炸弹，只要它原来能炸到的营地还都炸得到，炸弹数就不会变多。';
      timer = setInterval(() => swapStep(), reduced() ? 500 : 1600);
    }
    function swapStep({instant = false} = {}) {
      if (!swap || phase !== 'swap') return;
      if (swapIndex >= swap.frames.length) { endSwap(); return; }
      const frame = swap.frames[swapIndex++], group = bombLayer.querySelector(`.camp-bomb[data-index="${frame.bomb}"]`);
      const range = ranges.querySelector(`[data-index="${frame.bomb}"]`);
      drawWindow({x: frame.x, window: [Math.max(0, frame.x - RADIUS), Math.min(ROAD, frame.x + RADIUS)]}, 'swap');
      group.classList.remove('is-waiting'); group.classList.add('is-moved');
      group.style.transform = `translate(${toX(frame.to)}px, ${ROAD_Y - 2}px)`; placeRange(range, frame.to); range.classList.add('is-moved');
      frame.hit.forEach(i => { standing[i] = false; if (!instant) pop(i, '还在！'); });
      showCamps({instant});
      const moved = frame.to - frame.from;
      say(moved > 1e-9 ? `你的第 ${frame.bomb + 1} 颗从 ${fmt(frame.from)} 挪到 ${fmt(frame.to)}，它原来炸到的 ${frame.kept} 个营地一个都没漏！`
        : `你的第 ${frame.bomb + 1} 颗已经在 ${fmt(frame.to)}，正好是最右的位置，不用挪～`, 'proud');
      insightStep.textContent = `第 ${swapIndex} 次：最左还没炸的营地 x = ${fmt(frame.x)}。你的炸弹 q = ${fmt(frame.from)} 能炸到它，所以 q ≤ x + ${RADIUS} = ${fmt(frame.to)}；` +
        `它右边能炸到的营地 y ≤ q + ${RADIUS} ≤ ${fmt(frame.to + RADIUS)}，挪到 ${fmt(frame.to)} 后照样炸得到。`;
      hud();
      if (swapIndex >= swap.frames.length) { stopTimer(); if (instant) endSwap(); else wait(endSwap, 900); }
    }
    function endSwap() {
      if (phase !== 'swap') return;
      stopTimer(); windowLayer.replaceChildren();
      swap.spare.forEach(j => bombLayer.querySelector(`.camp-bomb[data-index="${j}"]`)?.classList.add('is-spare'));
      swap.spare.forEach(j => ranges.querySelector(`[data-index="${j}"]`)?.classList.add('is-spare'));
      const used = swap.frames.length;
      say(swap.spare.length ? `挪完啦！只用到 ${used} 颗，剩下 ${swap.spare.length} 颗是多余的——这就是可莉的妙计！` : `挪完啦！${used} 颗一颗不多一颗不少——你的方案已经是最少的！`, 'laugh');
      verdict.textContent = `交换论证：你的方案每次换掉一颗炸弹，仍然清光所有营地，炸弹数不增加；换完就是可莉的妙计（${used} 颗）。所以任何方案都不会比妙计更少——妙计是最优的。`;
      verdict.hidden = false; setPhase('done'); swap = null;
    }
    exchangeButton.addEventListener('click', () => { if (phase === 'done' && playerResult && !playerResult.missed) startSwap(); });

    // ----- Rounds -----
    function again() {
      stopTimer(); stopVoice(); clock.clear();
      stage.classList.remove('is-shaking'); klee.classList.remove('is-hopping');
      run = null; frameIndex = 0; swap = null; player = []; playerResult = null;
      resetBoard(); drawBombs([], 'player');
      strategyInputs.forEach(input => { input.checked = input.value === 'naive'; }); kleeLabel.textContent = NAMES.naive;
      verdict.hidden = true; scorePlayer.classList.remove('is-winner'); scoreKlee.classList.remove('is-winner'); score(scorePlayer, null); score(scoreKlee, null);
      setPhase('place'); moveKlee(0, {hop: false}); chart();
      insightStep.textContent = '可莉出发后，这里会显示每一轮“最左的营地”和能炸到它的位置。';
      announce('旅行者先扔！');
      say(`前面有 ${map.camps.length} 个丘丘人营地！点路面放蹦蹦炸弹，每颗能炸到左右 ${RADIUS} 格以内，用最少的炸弹清光它们！`, 'happy');
      voice('klee-camp-intro');
    }
    function newMap(seed = 1000 + Math.floor(Math.random() * 9000)) {
      map = makeMap(seed); seedLabel.textContent = '#' + seed;
      drawDecor(); drawCamps(); again();
    }
    againButton.addEventListener('click', again);
    newButton.addEventListener('click', () => newMap());
    insightToggle.addEventListener('change', () => { insight.hidden = !insightToggle.checked; if (run && phase === 'algorithm') drawWindow(run.frames[frameIndex - 1], run.strategy); });

    const seedFromHash = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('map'));
    insight.hidden = !insightToggle.checked; showStats(); drawRuler();
    newMap(Number.isSafeInteger(seedFromHash) && seedFromHash > 0 ? seedFromHash : undefined);
    return () => { stopVoice(); if (timer) { stopTimer(); if (phase === 'algorithm') setPhase('algorithm'); } };
  }

  return {model, init};
});
