/* 可莉祈愿: an event wish for Klee's wardrobe. Primogems come from the quizzes at
   the end of articles; wishes run on the companion server (official rates and
   pity), and this page plays the meteor, the reveals and the ten-card summary,
   then lets you dress Klee up. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') window.LabExperiments = Object.assign(window.LabExperiments || {}, {wish: api.init});
})(function () {
  'use strict';
  const STARS = {3: '★★★', 4: '★★★★', 5: '★★★★★'};
  const percent = value => `${(value * 100).toFixed(1)}%`;
  // Shown in the wish details; the server is the authority.
  const rate5 = n => n >= 90 ? 1 : Math.min(1, 0.006 + Math.max(0, n - 73) * 0.06);
  const model = {rate5};

  function init(panel) {
    const $ = selector => panel.querySelector(selector);
    const kit = window.LabGameKit, {svg, reduced, restart} = kit;
    const view = $('[data-wish-view]'), stage = $('.fish-stage'), idle = $('[data-wish-idle]'), anim = $('[data-wish-anim]');
    const single = $('[data-wish-single]'), summary = $('[data-wish-summary]'), meteor = $('[data-wish-meteor]'), featured = $('[data-wish-featured]');
    const banner = $('[data-wish-banner]'), hudMain = $('[data-wish-hud-main]'), hudPity = $('[data-wish-hud-pity]');
    const face = $('[data-wish-face]'), bubble = $('.fish-klee-line'), line = $('[data-wish-line]');
    const oneButton = $('[data-wish-one]'), tenButton = $('[data-wish-ten]'), skipButton = $('[data-wish-skip]'), tradeButton = $('[data-wish-trade]');
    const wallet = $('[data-wish-wallet]'), offline = $('[data-wish-offline]'), grid = $('[data-wish-grid]'), tabs = $('[data-wish-tabs]');
    const preview = $('[data-wish-preview]'), historyList = $('[data-wish-history]'), earn = $('[data-wish-earn]'), randomLink = $('[data-wish-random]');
    const {say, announce, voice, stopVoice} = kit.host(panel, {face, bubble, line, banner, toggle: $('[data-wish-voice-toggle]'), voiceAttr: 'wishVoice'});
    const clock = kit.timers(), wait = clock.wait;
    const wardrobeKit = () => window.KleeWardrobe;
    const call = (path, method, data) => window.LsCompanion ? window.LsCompanion.call(path, method, data) : Promise.reject(new Error('可莉暂时不在线。'));
    let state = null, phase = 'loading', reveal = null, slot = 'frame', quizzes = [];
    const item = id => wardrobeKit()?.item(id);

    const setPhase = value => {
      phase = value; panel.dataset.wishPhase = value;
      const ready = value === 'ready' && state;
      oneButton.disabled = !ready || state.primogems < state.cost; tenButton.disabled = !ready || state.primogems < state.cost * 10;
      tradeButton.disabled = !ready || state.starglitter < state.starglitterPerWish;
      skipButton.hidden = value !== 'pulling';
      hud();
    };
    // What the stage shows, independent of whether buttons are live.
    const showView = name => { for (const [node, key] of [[idle, 'banner'], [anim, 'anim'], [summary, 'summary']]) node.toggleAttribute('hidden', key !== name); panel.dataset.wishView = name; };
    function hud() {
      if (!state) { hudMain.textContent = '可莉祈愿'; hudPity.textContent = ''; return; }
      hudMain.textContent = `原石 ${state.primogems.toLocaleString('en-US')} · 可祈愿 ${Math.floor(state.primogems / state.cost)} 次`;
      hudPity.textContent = `距保底 ${90 - state.pity.since5} · ${state.pity.g5 ? '大保底' : '小保底'}`;
    }
    function show(next) {
      state = next; wardrobeKit()?.remember(next);
      wallet.textContent = `原石 ${next.primogems.toLocaleString('en-US')} · 无主的星辉 ${next.starglitter} · 无主的星尘 ${next.stardust}`;
      tradeButton.textContent = `星辉兑换（${next.starglitterPerWish} 星辉 → ${next.cost} 原石）`;
      oneButton.querySelector('small').textContent = `${next.cost} 原石`; tenButton.querySelector('small').textContent = `${next.cost * 10} 原石`;
      renderWardrobe(); renderHistory(); renderEarn(); hud();
      $('[data-wish-pity-detail]').textContent = `距上次五星 ${next.pity.since5} 抽（下一抽 ${percent(rate5(next.pity.since5 + 1))}），${next.pity.g5 ? '大保底：下个五星必是「烟花大会」' : '小保底：五星有一半是「烟花大会」'}；距上次四星 ${next.pity.since4} 抽，${next.pity.g4 ? '下个四星必是 UP' : '四星有一半是 UP'}。共祈愿 ${next.wishes} 次。`;
    }

    // ----- The banner: the featured 5★ and 4★ items -----
    function drawBanner() {
      const catalog = wardrobeKit().catalog, five = item(catalog.banner.featured5);
      featured.replaceChildren();
      const big = wardrobeKit().draw(five, {size: 150}); big.setAttribute('x', 58); big.setAttribute('y', 96); featured.append(big);
      const klee = svg('foreignObject', {x: 93, y: 131, width: 80, height: 80}, featured);
      const span = document.createElementNS('http://www.w3.org/1999/xhtml', 'span'); span.className = 'wish-banner-klee'; span.style.backgroundImage = face.style.backgroundImage; klee.append(span);
      svg('text', {class: 'wish-banner-kind', x: 236, y: 104}, featured).textContent = '活动祈愿 · ' + catalog.banner.subtitle;
      svg('text', {class: 'wish-banner-name', x: 236, y: 146}, featured).textContent = catalog.banner.name;
      svg('text', {class: 'wish-banner-up', x: 236, y: 172}, featured).textContent = `5 星 UP：头像框「${five.name}」`;
      catalog.banner.featured4.forEach((id, i) => {
        const thing = item(id), x = 244 + i * 64;
        svg('rect', {class: 'wish-banner-four', x, y: 194, width: 54, height: 54, rx: 10}, featured);
        const art = wardrobeKit().draw(thing, {size: 46}); art.setAttribute('x', x + 4); art.setAttribute('y', 198); featured.append(art);
        svg('text', {class: 'wish-banner-four-name', x: x + 27, y: 264}, featured).textContent = thing.name;
      });
      svg('text', {class: 'wish-banner-four-note', x: 236, y: 290}, featured).textContent = '4 星 UP · 装扮重复会变成无主的星辉';
    }

    // ----- Wishing: meteor → one-by-one reveals → ten tall cards -----
    async function wish(count) {
      if (phase !== 'ready') return;
      if (state.primogems < state.cost * count) { say('原石不够啦！去文章末尾答可莉小测验，每答对一题有 160 原石哦！', 'care'); voice('klee-wish-poor'); return; }
      setPhase('sending'); oneButton.disabled = tenButton.disabled = true;
      let data;
      try { data = await call('/wardrobe/wish', 'POST', {count}); }
      catch (error) { say(error.message, 'care'); setPhase('ready'); return; }
      reveal = {results: data.results, index: -1, next: data.wardrobe};
      const best = Math.max(...data.results.map(r => r.rarity)); anim.dataset.best = best; single.replaceChildren();
      setPhase('pulling'); showView('anim');
      if (reduced()) { finish(); return; }
      restart(meteor, 'is-falling'); voice(best === 5 ? 'klee-wish-gold' : best === 4 ? 'klee-wish-purple' : 'klee-wish-blue', {minor: true});
      say(best === 5 ? '金色的流星！是五星！' : best === 4 ? '紫色的光，有四星哦！' : '蓝色的流星……没关系，下次一定！', best === 5 ? 'laugh' : best === 4 ? 'happy' : 'curious');
      wait(next, 1500);
    }
    function next() {
      if (phase !== 'pulling') return;
      clock.clear(); reveal.index++;
      if (reveal.index >= reveal.results.length) { finish(); return; }
      const result = reveal.results[reveal.index], thing = item(result.id); single.replaceChildren();
      const card = svg('g', {class: `wish-single is-${result.rarity}`}, single);
      svg('circle', {class: 'wish-single-glow', cx: 320, cy: 150, r: 120}, card);
      const art = wardrobeKit().draw(thing, {size: 128, className: 'wish-single-art'}); art.setAttribute('x', 256); art.setAttribute('y', 82); card.append(art);
      svg('text', {class: 'wish-single-name', x: 320, y: 250}, card).textContent = thing.name;
      svg('text', {class: 'wish-single-slot', x: 320, y: 272}, card).textContent = wardrobeKit().catalog.slots[thing.slot] + (result.isNew ? ' · NEW' : '');
      const stars = svg('text', {class: 'wish-single-stars', x: 320, y: 302}, card); stars.textContent = STARS[result.rarity];
      if (result.starglitter || result.stardust) svg('text', {class: 'wish-single-extra', x: 320, y: 324}, card).textContent = result.starglitter ? `重复 → 无主的星辉 ×${result.starglitter}` : `无主的星尘 ×${result.stardust}`;
      svg('text', {class: 'wish-single-count', x: 612, y: 330}, card).textContent = `${reveal.index + 1}/${reveal.results.length}`;
      wait(next, result.rarity === 3 ? 600 : 1300);
    }
    view.addEventListener('click', () => {
      if (phase === 'pulling' && reveal?.index >= 0) next();
      else if (phase === 'ready' && panel.dataset.wishView === 'summary') showView('banner');
    });
    skipButton.addEventListener('click', () => { if (phase === 'pulling') finish(); });
    function finish() {
      clock.clear(); summary.replaceChildren();
      const order = [...reveal.results].sort((a, b) => b.rarity - a.rarity);
      const width = 54, gap = 6, start = 320 - (order.length * (width + gap) - gap) / 2;
      order.forEach((result, i) => {
        const thing = item(result.id), card = svg('g', {class: `wish-tall is-${result.rarity}`, transform: `translate(${start + i * (width + gap)} 56)`}, summary);
        card.style.animationDelay = `${i * 50}ms`;
        svg('rect', {class: 'wish-tall-back', width, height: 240, rx: 8}, card);
        const art = wardrobeKit().draw(thing, {size: 46}); art.setAttribute('x', 4); art.setAttribute('y', 64); card.append(art);
        svg('text', {class: 'wish-tall-name', x: width / 2, y: 124}, card).textContent = thing.name;
        svg('text', {class: 'wish-tall-stars', x: width / 2, y: 230}, card).textContent = '★'.repeat(result.rarity);
        if (result.isNew) svg('text', {class: 'wish-tall-new', x: width / 2, y: 18}, card).textContent = 'NEW';
      });
      showView('summary'); show(reveal.next); setPhase('ready');
      const got = reveal.results.find(r => r.rarity === 5), first = reveal.results.filter(r => r.isNew && r.rarity >= 4).length;
      if (got && got.featured) { announce('烟花大会！'); say(`抽到限定头像框「${item(got.id).name}」啦！第 ${got.pity} 抽出的金！快去衣橱给可莉戴上！`, 'laugh'); voice('klee-wish-got', {queue: true}); }
      else if (got) { announce('歪了……'); say(`第 ${got.pity} 抽出金了，是「${item(got.id).name}」……下一个五星一定是烟花大会（大保底）！`, 'care'); voice('klee-wish-lost', {queue: true}); }
      else say(first ? `有 ${first} 件新装扮！去下面的衣橱试试看吧～` : `这次都是见过的……重复的会变成星辉，攒 ${state.starglitterPerWish} 个能换一次祈愿！`, first ? 'happy' : 'wink');
    }
    oneButton.addEventListener('click', () => wish(1));
    tenButton.addEventListener('click', () => wish(10));
    tradeButton.addEventListener('click', async () => {
      try { show((await call('/wardrobe/exchange', 'POST', {})).wardrobe); say('星辉换成原石啦！', 'happy'); setPhase('ready'); }
      catch (error) { say(error.message, 'care'); }
    });

    // ----- The wardrobe -----
    function renderWardrobe() {
      const catalog = wardrobeKit().catalog;
      tabs.replaceChildren();
      for (const [key, name] of Object.entries(catalog.slots)) {
        const total = catalog.items.filter(i => i.slot === key), have = total.filter(i => state.owned[i.id]).length;
        const tab = document.createElement('button'); tab.type = 'button'; tab.className = 'wish-tab' + (key === slot ? ' is-active' : '');
        tab.textContent = `${name} ${have}/${total.length}`; tab.setAttribute('aria-pressed', String(key === slot));
        tab.addEventListener('click', () => { slot = key; renderWardrobe(); }); tabs.append(tab);
      }
      grid.replaceChildren();
      for (const thing of catalog.items.filter(i => i.slot === slot).sort((a, b) => b.rarity - a.rarity)) {
        const copies = state.owned[thing.id] || 0, on = state.equipped[thing.slot] === thing.id;
        const cell = document.createElement('button'); cell.type = 'button';
        cell.className = `wish-item is-${thing.rarity}` + (copies ? '' : ' is-locked') + (on ? ' is-on' : '');
        cell.dataset.item = thing.id; cell.disabled = !copies || thing.slot === 'sticker';
        cell.append(wardrobeKit().draw(thing, {size: 64}));
        const label = document.createElement('span'); label.className = 'wish-item-name'; label.textContent = thing.name; cell.append(label);
        const meta = document.createElement('small'); meta.textContent = copies ? `${'★'.repeat(thing.rarity)}${copies > 1 ? ' ×' + copies : ''}${on ? ' · 穿戴中' : ''}` : '未获得'; cell.append(meta);
        cell.title = thing.desc;
        cell.addEventListener('click', async () => {
          try {
            const result = await call('/wardrobe/equip', 'POST', {slot: thing.slot, item: on ? null : thing.id});
            show(result.wardrobe);
            if (!on) { say(`戴上「${thing.name}」啦！${thing.desc}`, 'proud'); voice('klee-wish-equip', {minor: true}); } else say(`先把「${thing.name}」收起来～`, 'neutral');
          } catch (error) { say(error.message, 'care'); }
        });
        grid.append(cell);
      }
      const title = item(state.equipped.title), bomb = item(state.equipped.bomb);
      $('[data-wish-preview-title]').textContent = title ? title.look.text : '火花骑士';
      const bombSlot = $('[data-wish-preview-bomb]'); bombSlot.replaceChildren();
      bombSlot.append(wardrobeKit().draw(bomb || {slot: 'bomb', look: {stops: ['#ff9a83', '#e2463b', '#8f1f1c'], outline: '#6e1715'}}, {size: 44}));
    }
    function renderHistory() {
      historyList.replaceChildren();
      for (const entry of state.history.slice(0, 20)) {
        const thing = item(entry.id); if (!thing) continue;
        const li = document.createElement('li'); li.className = `is-${thing.rarity}`;
        li.textContent = `${'★'.repeat(thing.rarity)} ${thing.name}`; li.title = new Date(entry.at).toLocaleString('zh-CN'); historyList.append(li);
      }
      if (!historyList.children.length) historyList.append(Object.assign(document.createElement('li'), {className: 'is-empty', textContent: '还没有祈愿记录'}));
    }
    function renderEarn() {
      const total = quizzes.reduce((sum, q) => sum + q.earned, 0), perfect = quizzes.filter(q => q.best === 3).length;
      earn.replaceChildren();
      const lead = document.createElement('p'); lead.className = 'wish-earn-lead';
      lead.textContent = quizzes.length ? `已经答过 ${quizzes.length} 篇文章的小测验（满分 ${perfect} 篇），一共赚了 ${total.toLocaleString('en-US')} 原石。` : '每篇文章末尾都有「可莉小测验」：3 道题，每答对 1 题 160 原石。新朋友还送 1,600 原石！';
      earn.append(lead);
      const list = document.createElement('ul'); list.className = 'wish-earn-list';
      for (const q of quizzes.filter(q => q.best < 3 && q.url).slice(0, 4)) {
        const li = document.createElement('li'), a = document.createElement('a'); a.href = new URL(q.url).pathname + '#article-container';
        a.textContent = q.title; li.append(a, document.createTextNode(` · 最好 ${q.best}/3，还能再得 ${(3 - q.best) * state.perCorrect} 原石`)); list.append(li);
      }
      if (list.children.length) earn.append(list);
    }
    // A random article to go and quiz on.
    fetch('/companion-articles.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).then(data => {
      const paths = Object.keys(data?.articles || {}); if (!paths.length) return;
      const pickPath = () => paths[Math.floor(Math.random() * paths.length)];
      randomLink.href = pickPath(); randomLink.addEventListener('click', () => { randomLink.href = pickPath(); });
    }).catch(() => {});

    async function load() {
      setPhase('loading'); showView('banner'); offline.hidden = true;
      // The wardrobe script may run after this game in the bundle; wait for it briefly.
      for (let tries = 0; !wardrobeKit() && tries < 50; tries++) await new Promise(resolve => setTimeout(resolve, 20));
      await wardrobeKit()?.ready;
      if (!wardrobeKit()?.catalog) { offline.hidden = false; setPhase('offline'); return; }
      drawBanner();
      try {
        const data = await call('/wardrobe', 'GET');
        quizzes = data.quizzes || []; show(data.wardrobe); setPhase('ready');
        say(state.wishes ? `欢迎回来！现在有 ${state.primogems.toLocaleString('en-US')} 原石，够祈愿 ${Math.floor(state.primogems / state.cost)} 次～` : '旅行者！这是可莉的装扮祈愿，新朋友送你 1,600 原石，先来个十连吧！之后在文章末尾答小测验还能赚原石哦～', 'happy');
        voice('klee-wish-intro');
      } catch (error) {
        offline.hidden = false; offline.textContent = `连不上可莉的祈愿服务：${error.message}`; setPhase('offline');
        say('可莉现在连不上祈愿台……稍后再来吧！', 'care');
      }
    }
    load();
    return () => { stopVoice(); if (phase === 'pulling') finish(); };
  }
  return {model, init};
});
