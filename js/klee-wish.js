/* 可莉祈愿: the wish hall. Primogems come from the quizzes at the end of articles;
   wishes run on the companion server with the official rates and pity. This page
   draws the night sky, the banner fireworks, the meteor and reveals, and the
   wardrobe where Klee's cosmetics are equipped. */
(function () {
  'use strict';
  const RARITY = {3: '#7fb2ff', 4: '#c48bff', 5: '#ffcf5a'};
  const rate5 = n => n >= 90 ? 1 : Math.min(1, 0.006 + Math.max(0, n - 73) * 0.06);
  const percent = value => `${(value * 100).toFixed(1)}%`;
  const fmt = value => Number(value).toLocaleString('en-US');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // A canvas that keeps its backing store matched to its CSS size.
  function fit(canvas) {
    const ratio = Math.min(2, window.devicePixelRatio || 1), {width, height} = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
    const context = canvas.getContext('2d'); context.setTransform(ratio, 0, 0, ratio, 0, 0); return {context, width, height};
  }
  // Twinkling stars and the occasional shooting star behind the hall.
  function starfield(canvas, reduced) {
    let stars = [], frame = 0, shooting = null, running = true;
    const seedStars = (w, h) => { stars = Array.from({length: Math.round(w * h / 2600)}, () => ({x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + .3, p: Math.random() * 6.28, s: .5 + Math.random() * 1.5})); };
    const draw = time => {
      if (!running || !canvas.isConnected) return;
      const {context, width, height} = fit(canvas);
      if (!stars.length || stars.w !== width) { seedStars(width, height); stars.w = width; }
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const a = reduced ? .7 : .45 + .45 * Math.sin(time / 1000 * star.s + star.p);
        context.globalAlpha = a; context.fillStyle = '#fff'; context.beginPath(); context.arc(star.x, star.y, star.r, 0, 6.283); context.fill();
      }
      if (!reduced) {
        if (!shooting && Math.random() < .004) shooting = {x: width * (.4 + Math.random() * .6), y: Math.random() * height * .3, t: 0};
        if (shooting) {
          shooting.t += 1; const x = shooting.x - shooting.t * 9, y = shooting.y + shooting.t * 4.5, g = context.createLinearGradient(x, y, x + 90, y - 45);
          g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          context.globalAlpha = Math.max(0, 1 - shooting.t / 50); context.strokeStyle = g; context.lineWidth = 1.6; context.beginPath(); context.moveTo(x, y); context.lineTo(x + 90, y - 45); context.stroke();
          if (shooting.t > 50) shooting = null;
        }
      }
      context.globalAlpha = 1;
      frame = reduced ? 0 : requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return {stop() { running = false; cancelAnimationFrame(frame); }, start() { if (!running) { running = true; frame = requestAnimationFrame(draw); } }};
  }
  // Little fireworks over the banner art.
  function fireworks(canvas, reduced) {
    let sparks = [], frame = 0, running = true, last = 0;
    const colors = ['#ffd36b', '#ff8a3c', '#ff5e7a', '#fff1b8', '#ffb347'];
    const draw = time => {
      if (!running || !canvas.isConnected) return;
      const {context, width, height} = fit(canvas);
      if (time - last > 900 && sparks.length < 400) {
        last = time; const cx = width * (.2 + Math.random() * .6), cy = height * (.15 + Math.random() * .35), color = colors[Math.floor(Math.random() * colors.length)];
        for (let i = 0; i < 46; i++) { const a = i / 46 * 6.283, v = 1.4 + Math.random() * 1.6; sparks.push({x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color}); }
      }
      context.clearRect(0, 0, width, height); context.globalCompositeOperation = 'lighter';
      sparks = sparks.filter(s => s.life > 0);
      for (const s of sparks) {
        s.x += s.vx; s.y += s.vy; s.vy += .03; s.vx *= .985; s.vy *= .985; s.life -= .012;
        context.globalAlpha = Math.max(0, s.life); context.fillStyle = s.color; context.beginPath(); context.arc(s.x, s.y, 1.6, 0, 6.283); context.fill();
      }
      context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(draw);
    };
    if (!reduced) frame = requestAnimationFrame(draw);
    return {stop() { running = false; cancelAnimationFrame(frame); }};
  }
  // The meteor: a tapered streak with a glowing head and sparks, coloured by the best item.
  function meteor(canvas, color, reduced) {
    return new Promise(resolve => {
      if (reduced) { resolve(); return; }
      const start = performance.now(), duration = 1500, trail = [], path = [];
      const step = time => {
        const {context, width, height} = fit(canvas), t = Math.min(1, (time - start) / duration), ease = 1 - Math.pow(1 - t, 2.2);
        const x = width * (1.08 - ease * .62), y = height * (-.08 + ease * .62);
        path.push({x, y}); if (path.length > 28) path.shift();
        for (let i = 0; i < 14; i++) trail.push({x: x + (Math.random() - .5) * 10, y: y + (Math.random() - .5) * 10, vx: (Math.random() - .2) * 1.2, vy: (Math.random() - .7) * 1.1, life: 1, r: .6 + Math.random() * 2});
        context.clearRect(0, 0, width, height); context.globalCompositeOperation = 'lighter';
        // The streak: wide and faint at the back, narrow and bright at the head.
        for (let i = 1; i < path.length; i++) {
          const k = i / path.length; context.globalAlpha = k * .55; context.strokeStyle = color; context.lineCap = 'round';
          context.lineWidth = 2 + k * 16; context.beginPath(); context.moveTo(path[i - 1].x, path[i - 1].y); context.lineTo(path[i].x, path[i].y); context.stroke();
          context.globalAlpha = k * .9; context.strokeStyle = '#fff'; context.lineWidth = 1 + k * 4; context.stroke();
        }
        for (const p of trail) { p.x += p.vx; p.y += p.vy; p.life -= .022; if (p.life <= 0) continue; context.globalAlpha = p.life; context.fillStyle = p.life > .6 ? '#fff' : color; context.beginPath(); context.arc(p.x, p.y, p.r * p.life + .3, 0, 6.283); context.fill(); }
        if (trail.length > 900) trail.splice(0, trail.length - 900);
        const glow = context.createRadialGradient(x, y, 0, x, y, 70); glow.addColorStop(0, '#fff'); glow.addColorStop(.18, color); glow.addColorStop(1, 'rgba(0,0,0,0)');
        context.globalAlpha = 1; context.fillStyle = glow; context.beginPath(); context.arc(x, y, 70, 0, 6.283); context.fill();
        context.globalCompositeOperation = 'source-over';
        if (t < 1) requestAnimationFrame(step); else { context.clearRect(0, 0, width, height); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  function init(root) {
    if (root.dataset.kwpReady) return; root.dataset.kwpReady = '1';
    // The full-screen wish layer lives under <body> so the site header cannot cover it.
    const overlay = root.querySelector('[data-kwp-overlay]'); document.querySelectorAll('body > .kwp-overlay').forEach(old => old.remove()); document.body.append(overlay);
    const $ = selector => root.querySelector(selector) || overlay.querySelector(selector), $$ = selector => [...root.querySelectorAll(selector)];
    const kit = window.LabGameKit, reduced = () => kit.reduced();
    const call = (path, method, data) => window.LsCompanion ? window.LsCompanion.call(path, method, data) : Promise.reject(new Error('可莉暂时不在线。'));
    const wardrobe = () => window.KleeWardrobe;
    const item = id => wardrobe()?.item(id);
    const {say, announce, voice, stopVoice} = kit.host(root, {face: $('[data-kwp-face]'), bubble: $('.kwp-klee-line'), line: $('[data-kwp-line]'), banner: $('[data-kwp-announce]'),
      voiceAttr: 'kwpVoice', manifest: root.dataset.voiceManifest});
    const sky = starfield($('[data-kwp-sky]'), reduced()), works = fireworks($('[data-kwp-fireworks]'), reduced());
    let state = null, busy = true, slot = 'frame', quizzes = [], run = null;
    const reveal = $('[data-kwp-reveal]'), summary = $('[data-kwp-summary]');

    // ----- Wallet, banner and buttons -----
    function show(next) {
      state = next; wardrobe()?.remember(next);
      $('[data-kwp-primo]').textContent = fmt(next.primogems); $('[data-kwp-glitter]').textContent = fmt(next.starglitter); $('[data-kwp-dust]').textContent = fmt(next.stardust);
      $('[data-kwp-pity]').textContent = `距保底 ${90 - next.pity.since5} 抽 · ${next.pity.g5 ? `大保底：下个五星必是「${featuredName()}」` : '小保底'} · 已祈愿 ${fmt(next.wishes)} 次`;
      $('[data-kwp-rules-state]').textContent = `你的进度：距上次五星 ${next.pity.since5} 抽（下一抽五星概率 ${percent(rate5(next.pity.since5 + 1))}），${next.pity.g5 ? '五星大保底' : '五星小保底'}；距上次四星 ${next.pity.since4} 抽，${next.pity.g4 ? '四星大保底' : '四星小保底'}。`;
      $('[data-kwp-trade]').textContent = `星辉兑换 · ${next.starglitterPerWish} → 1 次`;
      buttons(); renderCloset(); renderHistory(); renderEarn();
    }
    function buttons() {
      const ready = state && !busy;
      $('[data-kwp-one]').disabled = !ready || state.primogems < state.cost;
      $('[data-kwp-ten]').disabled = !ready || state.primogems < state.cost * 10;
      $('[data-kwp-trade]').disabled = !ready || state.starglitter < state.starglitterPerWish;
      root.dataset.kwpBusy = busy ? '1' : '';
    }
    const featuredName = () => item(wardrobe().catalog.banner.featured5)?.name || '限定装扮';
    function drawBanner() {
      const catalog = wardrobe().catalog, five = item(catalog.banner.featured5), art = $('.kwp-banner-art');
      $('.kwp-banner-title').textContent = catalog.banner.name;
      if (catalog.banner.description) $('.kwp-banner-sub').textContent = catalog.banner.description;
      $('.kwp-tag').textContent = '活动祈愿 · ' + (catalog.banner.subtitle || '可莉的装扮');
      $('.kwp-banner').setAttribute('aria-label', '当前卡池：' + catalog.banner.name);
      $('[data-kwp-rules-up5]').textContent = `出 5 星时有 50% 是本期限定「${five.name}」；若不是，下一个 5 星必定是它。`;
      // An outfit banner shows Klee wearing it; any other item sits around her as a frame.
      art.classList.toggle('is-outfit', five.slot === 'outfit');
      if (five.slot === 'outfit') { $('.kwp-banner-portrait').style.backgroundImage = `url("${five.look.atlas}")`; $('[data-kwp-ring]').replaceChildren(); }
      else $('[data-kwp-ring]').replaceChildren(wardrobe().draw(five, {size: 100}));
      const card = (thing, big) => {
        const node = document.createElement('div'); node.className = `kwp-card is-${thing.rarity}` + (big ? ' is-big' : '');
        node.append(wardrobe().draw(thing, {size: big ? 72 : 52, klee: true}));
        const text = document.createElement('div'); text.className = 'kwp-card-text';
        text.append(Object.assign(document.createElement('strong'), {textContent: thing.name}), Object.assign(document.createElement('small'), {textContent: `${'★'.repeat(thing.rarity)} · ${catalog.slots[thing.slot]}`}));
        if (big) text.append(Object.assign(document.createElement('span'), {textContent: thing.desc}));
        node.append(text); node.title = thing.desc; return node;
      };
      $('[data-kwp-up5]').replaceChildren(card(five, true));
      $('[data-kwp-up4]').replaceChildren(...catalog.banner.featured4.map(id => card(item(id), false)));
    }

    // ----- Wishing -----
    const pause = ms => new Promise(resolve => { if (!run) { resolve(); return; } run.wake = resolve; run.timer = setTimeout(resolve, ms); });
    async function wish(count) {
      if (busy || !state) return;
      if (state.primogems < state.cost * count) { say('原石不够啦！去文章末尾答可莉小测验，每答对一题有 160 原石哦！', 'care'); voice('klee-wish-poor'); return; }
      busy = true; buttons();
      let data;
      try { data = await call('/wardrobe/wish', 'POST', {count}); }
      catch (error) { busy = false; buttons(); say(error.message, 'care'); return; }
      const current = run = {results: data.results, next: data.wardrobe, skipped: false, count};
      const best = Math.max(...data.results.map(r => r.rarity));
      overlay.hidden = false; overlay.dataset.best = best; root.dataset.kwpOverlay = 'meteor';
      reveal.hidden = true; summary.hidden = true; $('[data-kwp-skip]').hidden = false; $('[data-kwp-again]').hidden = true; $('[data-kwp-close]').hidden = true;
      document.documentElement.classList.add('kwp-lock');
      voice(best === 5 ? 'klee-wish-gold' : best === 4 ? 'klee-wish-purple' : 'klee-wish-blue', {minor: true});
      await meteor($('[data-kwp-overlay-sky]'), RARITY[best], reduced());
      if (run !== current) return;
      if (!current.skipped) {
        const flash = $('[data-kwp-flash]'); flash.className = `kwp-flash is-${best}`; void flash.offsetWidth; flash.classList.add('is-on');
        await pause(best === 5 ? 700 : 350);
      }
      for (let i = 0; i < current.results.length && !current.skipped && run === current; i++) { showOne(current.results[i], i); await pause(current.results[i].rarity === 3 ? 900 : 1800); }
      if (run === current) finish();
    }
    function showOne(result, index) {
      const thing = item(result.id), catalog = wardrobe().catalog;
      root.dataset.kwpOverlay = 'reveal'; reveal.hidden = false; reveal.className = `kwp-reveal is-${result.rarity}`;
      reveal.replaceChildren();
      const rays = document.createElement('div'); rays.className = 'kwp-rays';
      const art = document.createElement('div'); art.className = 'kwp-reveal-art';
      // A new outfit is shown on Klee herself, not as a round badge.
      if (thing.slot === 'outfit') { art.classList.add('is-outfit'); art.append(Object.assign(document.createElement('span'), {className: 'kwp-reveal-portrait'})); art.lastChild.style.backgroundImage = `url("${thing.look.atlas}")`; }
      else art.append(wardrobe().draw(thing, {size: 220, klee: true}));
      const name = document.createElement('h3'); name.className = 'kwp-reveal-name'; name.textContent = thing.name;
      const meta = document.createElement('p'); meta.className = 'kwp-reveal-meta'; meta.textContent = catalog.slots[thing.slot] + (thing.owner === 'jean' ? ' · 琴团长' : ' · 可莉');
      const stars = document.createElement('div'); stars.className = 'kwp-reveal-stars';
      for (let i = 0; i < result.rarity; i++) { const star = document.createElement('i'); star.textContent = '★'; star.style.animationDelay = `${350 + i * 120}ms`; stars.append(star); }
      const desc = document.createElement('p'); desc.className = 'kwp-reveal-desc'; desc.textContent = thing.desc;
      reveal.append(rays, art, name, meta, stars, desc);
      if (result.isNew) reveal.append(Object.assign(document.createElement('span'), {className: 'kwp-new', textContent: 'NEW'}));
      if (result.starglitter || result.stardust) reveal.append(Object.assign(document.createElement('p'), {className: 'kwp-reveal-extra', textContent: result.starglitter ? `已拥有 · 转化为无主的星辉 ×${result.starglitter}` : `转化为无主的星尘 ×${result.stardust}`}));
      reveal.append(Object.assign(document.createElement('span'), {className: 'kwp-reveal-count', textContent: `${index + 1} / ${run.results.length}`}));
    }
    function finish() {
      if (!run || run.done) return; run.done = true; clearTimeout(run.timer);
      reveal.hidden = true; root.dataset.kwpOverlay = 'summary'; summary.hidden = false; summary.replaceChildren();
      const order = [...run.results].sort((a, b) => b.rarity - a.rarity);
      order.forEach((result, i) => {
        const thing = item(result.id), card = document.createElement('div');
        card.className = `kwp-tall is-${result.rarity}`; card.style.animationDelay = `${i * 70}ms`;
        card.append(wardrobe().draw(thing, {size: 76, klee: true}));
        card.append(Object.assign(document.createElement('strong'), {textContent: thing.name}), Object.assign(document.createElement('small'), {textContent: '★'.repeat(result.rarity)}));
        if (result.isNew) card.append(Object.assign(document.createElement('span'), {className: 'kwp-new', textContent: 'NEW'}));
        summary.append(card);
      });
      $('[data-kwp-skip]').hidden = true; $('[data-kwp-close]').hidden = false;
      show(run.next); busy = false; buttons();
      $('[data-kwp-again]').hidden = state.primogems < state.cost * run.count; $('[data-kwp-again]').textContent = run.count === 10 ? '再来十次' : '再来一次';
      const got = run.results.find(r => r.rarity === 5), fresh = run.results.filter(r => r.isNew && r.rarity >= 4).length;
      if (got?.featured) { announce(featuredName() + '！'); say(`抽到限定${wardrobe().catalog.slots[item(got.id).slot]}「${featuredName()}」啦！第 ${got.pity} 抽出的金！快去衣橱给可莉换上！`, 'laugh'); voice('klee-wish-got', {queue: true}); }
      else if (got) { announce('歪了……'); say(`第 ${got.pity} 抽出金了，是「${item(got.id).name}」……下一个五星一定是「${featuredName()}」！`, 'care'); voice('klee-wish-lost', {queue: true}); }
      else say(fresh ? `有 ${fresh} 件新装扮！去衣橱给可莉试试吧～` : `都是见过的……重复的会变成星辉，攒 ${state.starglitterPerWish} 个能换一次祈愿！`, fresh ? 'happy' : 'wink');
    }
    function closeOverlay() {
      overlay.hidden = true; root.dataset.kwpOverlay = ''; document.documentElement.classList.remove('kwp-lock'); run = null;
    }
    overlay.addEventListener('click', event => {
      if (event.target.closest('button') || !run || run.done) return;
      // Tap to move on to the next item without waiting.
      clearTimeout(run.timer); run.wake?.();
    });
    $('[data-kwp-skip]').addEventListener('click', () => { if (!run) return; run.skipped = true; clearTimeout(run.timer); run.wake?.(); finish(); });
    $('[data-kwp-close]').addEventListener('click', closeOverlay);
    $('[data-kwp-again]').addEventListener('click', () => { const count = run?.count || 10; closeOverlay(); wish(count); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.hidden && run?.done) closeOverlay(); });
    $('[data-kwp-one]').addEventListener('click', () => wish(1));
    $('[data-kwp-ten]').addEventListener('click', () => wish(10));
    $('[data-kwp-trade]').addEventListener('click', async () => {
      busy = true; buttons();
      try { show((await call('/wardrobe/exchange', 'POST', {})).wardrobe); say('星辉换成原石啦！', 'happy'); }
      catch (error) { say(error.message, 'care'); }
      busy = false; buttons();
    });

    // ----- Tabs and sections -----
    $$('[data-kwp-tab]').forEach(tab => tab.addEventListener('click', () => {
      $$('[data-kwp-tab]').forEach(other => other.setAttribute('aria-selected', String(other === tab)));
      $$('[data-kwp-section]').forEach(section => { section.hidden = section.dataset.kwpSection !== tab.dataset.kwpTab; });
    }));
    function renderCloset() {
      const catalog = wardrobe().catalog, slots = $('[data-kwp-slots]');
      slots.replaceChildren();
      for (const [key, name] of Object.entries(catalog.slots)) {
        const all = catalog.items.filter(i => i.slot === key); if (!all.length) continue;
        const have = all.filter(i => state.owned[i.id]).length, chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'kwp-slot' + (key === slot ? ' is-active' : ''); chip.dataset.slot = key;
        chip.innerHTML = `<span></span><small>${have}/${all.length}</small>`; chip.firstChild.textContent = name;
        chip.setAttribute('aria-pressed', String(key === slot)); chip.addEventListener('click', () => { slot = key; renderCloset(); });
        slots.append(chip);
      }
      const grid = $('[data-kwp-grid]'); grid.replaceChildren();
      for (const thing of catalog.items.filter(i => i.slot === slot).sort((a, b) => b.rarity - a.rarity)) {
        const copies = state.owned[thing.id] || 0, on = state.equipped[thing.slot] === thing.id, cell = document.createElement('button');
        cell.type = 'button'; cell.dataset.item = thing.id; cell.title = thing.desc;
        cell.className = `kwp-item is-${thing.rarity}` + (copies ? '' : ' is-locked') + (on ? ' is-on' : '');
        cell.disabled = !copies || thing.slot === 'sticker';
        cell.append(wardrobe().draw(thing, {size: 76, klee: true}));
        cell.append(Object.assign(document.createElement('strong'), {textContent: thing.name}),
          Object.assign(document.createElement('small'), {textContent: copies ? `${'★'.repeat(thing.rarity)}${copies > 1 ? ' ×' + copies : ''}` : '未获得'}));
        if (on) cell.append(Object.assign(document.createElement('span'), {className: 'kwp-on', textContent: '穿戴中'}));
        cell.addEventListener('click', async () => {
          try {
            show((await call('/wardrobe/equip', 'POST', {slot: thing.slot, item: on ? null : thing.id})).wardrobe);
            if (on) say(`先把「${thing.name}」收起来～`, 'neutral'); else { say(`戴上「${thing.name}」啦！${thing.desc}`, 'proud'); voice('klee-wish-equip', {minor: true}); }
          } catch (error) { say(error.message, 'care'); }
        });
        grid.append(cell);
      }
      const title = item(state.equipped.title), bomb = item(state.equipped.bomb);
      $('[data-kwp-stage-title]').replaceChildren(wardrobe().draw(title || {slot: 'title', look: {text: '火花骑士', color: '#b3461e', bg: '#fff3e0'}}, {size: 150}));
      $('[data-kwp-stage-bomb]').replaceChildren(wardrobe().draw(bomb || {slot: 'bomb', look: {stops: ['#ff9a83', '#e2463b', '#8f1f1c'], outline: '#6e1715'}}, {size: 64}));
    }
    function renderHistory() {
      const body = $('[data-kwp-history]'), catalog = wardrobe().catalog; body.replaceChildren();
      for (const entry of state.history) {
        const thing = item(entry.id); if (!thing) continue;
        const row = document.createElement('tr'); row.className = `is-${thing.rarity}`;
        for (const text of [new Date(entry.at).toLocaleString('zh-CN', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}), thing.name, catalog.slots[thing.slot], '★'.repeat(thing.rarity)])
          row.append(Object.assign(document.createElement('td'), {textContent: text}));
        body.append(row);
      }
      if (!body.children.length) { const row = document.createElement('tr'); row.append(Object.assign(document.createElement('td'), {colSpan: 4, textContent: '还没有祈愿记录'})); body.append(row); }
    }
    function renderEarn() {
      const total = quizzes.reduce((sum, q) => sum + q.earned, 0), perfect = quizzes.filter(q => q.best === 3).length;
      $('[data-kwp-earn-stats]').innerHTML = '';
      for (const [label, value] of [['答过的文章', quizzes.length], ['满分', perfect], ['累计获得原石', total]]) {
        const box = document.createElement('div'); box.append(Object.assign(document.createElement('strong'), {textContent: fmt(value)}), Object.assign(document.createElement('span'), {textContent: label}));
        $('[data-kwp-earn-stats]').append(box);
      }
      const list = $('[data-kwp-earn-list]'); list.replaceChildren();
      for (const q of quizzes.filter(q => q.url).sort((a, b) => a.best - b.best).slice(0, 8)) {
        const li = document.createElement('li'), a = document.createElement('a'); a.href = new URL(q.url).pathname + '#article-container'; a.textContent = q.title;
        li.append(a, Object.assign(document.createElement('span'), {textContent: q.best === 3 ? '满分' : `最好 ${q.best}/3 · 还能得 ${fmt((3 - q.best) * state.perCorrect)}`}));
        list.append(li);
      }
    }
    fetch('/companion-articles.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).then(data => {
      const paths = Object.keys(data?.articles || {}), link = $('[data-kwp-random]'); if (!paths.length) return;
      const pick = () => paths[Math.floor(Math.random() * paths.length)];
      link.href = pick(); link.addEventListener('click', () => { link.href = pick(); });
    }).catch(() => {});

    async function load() {
      for (let tries = 0; !wardrobe() && tries < 50; tries++) await sleep(20);
      await wardrobe()?.ready;
      if (!wardrobe()?.catalog) { $('[data-kwp-offline]').hidden = false; $('[data-kwp-offline]').textContent = '装扮目录没有加载出来，刷新一下试试。'; return; }
      drawBanner();
      try {
        const data = await call('/wardrobe', 'GET'); quizzes = data.quizzes || [];
        busy = false; show(data.wardrobe); root.dataset.kwpReady = 'loaded';
        say(state.wishes ? `欢迎回来！现在有 ${fmt(state.primogems)} 原石，够祈愿 ${Math.floor(state.primogems / state.cost)} 次～` : '旅行者！这是可莉的装扮祈愿，新朋友送你 1,600 原石，先来个十连吧！在文章末尾答小测验还能赚原石哦～', 'happy');
        voice('klee-wish-intro');
      } catch (error) {
        $('[data-kwp-offline]').hidden = false; $('[data-kwp-offline]').textContent = `连不上可莉的祈愿服务：${error.message}`;
        say('可莉现在连不上祈愿台……稍后再来吧！', 'care');
      }
    }
    load();
    const away = () => { if (document.hidden) { sky.stop(); stopVoice(); } else sky.start(); };
    document.addEventListener('visibilitychange', away);
    document.addEventListener('pjax:send', () => { sky.stop(); works.stop(); stopVoice(); overlay.remove(); document.documentElement.classList.remove('kwp-lock'); }, {once: true});
  }
  const boot = () => { const root = document.querySelector('[data-kwp]'); if (root) init(root); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
  document.addEventListener('pjax:complete', boot);
})();
