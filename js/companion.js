/* Keep the body still; animate only the mouth and eyelids from the sprite atlas. */
(() => {
  'use strict';
  if (window.__lsworldCompanion) return;
  window.__lsworldCompanion = true;
  const storageKey = 'lsworld.companion.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { /* Optional browser persistence. */ }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  let token = typeof saved.token === 'string' ? saved.token : '';
  let root, config, apiBase, notice, messageList, quota, textarea, send, form;
  let opened = false, busy = false, service = null, currentLimits = null, audio = null, audioContext = null, analyser = null;
  let animationFrame = null, blinkTimer = null, blinkStep = 0, mouth = 0, sessionPromise = null, playbackTicket = 0;
  let narration = null, samples = null, smoothedEnergy = 0, lastTick = 0, lastMouthChange = 0, renderedFrame = '';
  const audioCache = new Map();
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify({token})); } catch (_) {} };
  const node = (tag, className, text) => {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text != null) result.textContent = text;
    return result;
  };
  const button = (label, className, action) => {
    const result = node('button', className, label); result.type = 'button';
    if (action) result.addEventListener('click', action); return result;
  };
  const report = text => { notice.textContent = text; notice.hidden = !text; };
  const state = text => { root.querySelector('.cp-state').textContent = text; };
  const sprite = () => config.animation || {columns: 3, rows: 2, mouthFrames: [0,1,2], blinkFrames: [0,3,0], mouthCenter: [55.5,60.5], eyeCenter: [55.5,48]};
  const framePosition = index => {
    const atlas = sprite();
    const x = atlas.columns > 1 ? index % atlas.columns / (atlas.columns - 1) * 100 : 0;
    const y = atlas.rows > 1 ? Math.floor(index / atlas.columns) / (atlas.rows - 1) * 100 : 0;
    return `${Number(x.toFixed(4))}% ${Number(y.toFixed(4))}%`;
  };
  const setFrame = () => {
    if (!root) return;
    const key = `${mouth}:${blinkStep}`; if (key === renderedFrame) return; renderedFrame = key;
    root.querySelectorAll('.cp-avatar').forEach(avatar => {
      const lips = avatar.querySelector('.cp-mouth'), eyes = avatar.querySelector('.cp-eyes');
      const mouthPosition = framePosition(sprite().mouthFrames[mouth]), eyePosition = framePosition(sprite().blinkFrames[blinkStep]);
      lips.hidden = mouth === 0; if (lips.style.backgroundPosition !== mouthPosition) lips.style.backgroundPosition = mouthPosition;
      eyes.hidden = blinkStep === 0; if (eyes.style.backgroundPosition !== eyePosition) eyes.style.backgroundPosition = eyePosition;
    });
  };
  const scheduleBlink = () => {
    clearTimeout(blinkTimer);
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    blinkTimer = setTimeout(function blink() {
      blinkStep++; setFrame();
      if (blinkStep < sprite().blinkFrames.length - 1) blinkTimer = setTimeout(blink, 40);
      else { blinkStep = 0; setFrame(); scheduleBlink(); }
    }, 3000 + Math.random() * 3500);
  };
  function updateLimits(limits) {
    if (limits) currentLimits = limits;
    quota.textContent = currentLimits ? `今日可聊 ${Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining)} 次` : '每日限次体验';
    quota.title = '每次回复自动朗读，每人每天最多 10 次；全站还有共享额度。';
    updateSend();
  }
  function updateSend() {
    if (!send) return;
    const exhausted = currentLimits && (!currentLimits.chatAvailable || !currentLimits.voiceAvailable || Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining) <= 0);
    send.disabled = busy || !service?.chat || (!service.demo && (!service.voice || exhausted));
  }
  async function request(path, method = 'GET', data, authenticated = true, raw = false) {
    if (!apiBase) throw new Error('助手正在准备连接，稍后再来找我吧。');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 60000);
    try {
      const response = await fetch(apiBase + path, {method, headers: {...(data ? {'Content-Type': 'application/json'} : {}),
        ...(authenticated && token ? {'Authorization': 'Bearer ' + token} : {})}, body: data ? JSON.stringify(data) : undefined, signal: controller.signal});
      if (!response.ok) {
        if (response.status === 401) { token = ''; persist(); sessionPromise = null; }
        let result; try { result = await response.json(); } catch (_) {}
        throw new Error(result?.error || '连接暂时没成功，稍后再试试吧。');
      }
      return raw ? await response.blob() : await response.json();
    } catch (error) { if (error.name === 'AbortError') throw new Error('这次等待有点久，稍后查看一下回复吧。'); throw error; }
    finally { clearTimeout(timer); }
  }
  async function ensureSession() {
    if (token) return;
    if (!sessionPromise) sessionPromise = request('/session', 'POST', {}, false).then(result => {
      token = result.token; persist(); updateLimits(result.limits);
    }).finally(() => { sessionPromise = null; });
    await sessionPromise;
  }
  function setOpen(value) {
    opened = value; root.querySelector('.cp-panel').hidden = !value;
    root.querySelector('.cp-launcher').hidden = value;
    root.querySelector('.cp-launcher').setAttribute('aria-expanded', String(value));
    if (value) { refresh(); textarea.focus(); }
    else { stopAudio(); root.querySelector('.cp-launcher').focus(); }
  }
  async function refresh() {
    try {
      service = await request('/health', 'GET', null, false);
      state(service.demo ? '本地演示 · 未调用模型' : service.chat ? '在这里，听你说' : '正在准备连接');
      updateSend();
      if (service.demo) report('本地演示：回复用于验证界面，没有调用真实聊天模型。');
      else if (!service.chat) report('聊天服务正在准备连接。');
      else report('');
      if (token) {
        const result = await request('/state'); updateLimits(result.limits);
        if (!busy) { messageList.replaceChildren(); if (!result.messages.length) welcome(); result.messages.forEach(message => addMessage(message)); }
      }
    } catch (error) { updateSend(); report(error.message); }
  }
  function welcome() { addMessage({role: 'assistant', text: config.greeting}); }
  function addMessage(message, pending = false) {
    const item = node('div', 'cp-message'); item.dataset.role = message.role;
    const paragraph = node('p', '', pending ? '正在准备回复和语音…' : message.text); item.append(paragraph);
    if (pending) { item.classList.add('cp-pending'); item.setAttribute('aria-busy', 'true'); }
    const view = {item, paragraph, message, characters: [...String(message.text || '')], revealed: pending ? 0 : [...String(message.text || '')].length};
    if (!pending) addSources(view);
    messageList.append(item); messageList.scrollTop = messageList.scrollHeight;
    return view;
  }
  function addSources(view) {
    const {message, item} = view;
    if (item.querySelector('.cp-sources')) return;
    if (message.sources?.length) {
      const links = node('div', 'cp-sources');
      message.sources.forEach(source => {
        try {
          const url = new URL(source.url); if (!['http:','https:'].includes(url.protocol)) return;
          const link = node('a', '', '↗ ' + source.title); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
        } catch (_) {}
      });
      item.append(links);
    }
  }
  function revealReply(view, count) {
    count = Math.max(view.revealed, Math.min(view.characters.length, count));
    if (count === view.revealed && !view.item.classList.contains('cp-pending')) return;
    view.revealed = count; view.paragraph.textContent = view.characters.slice(0, count).join('');
    view.item.classList.remove('cp-pending'); messageList.scrollTop = messageList.scrollHeight;
  }
  function finishReply(view = narration?.view) {
    if (!view) return;
    revealReply(view, view.characters.length); view.item.setAttribute('aria-busy', 'false'); addSources(view);
  }
  async function submit(event) {
    event.preventDefault(); const text = textarea.value.trim(); if (!text || busy) return;
    if (send.disabled) return;
    busy = true; send.disabled = true; textarea.disabled = true; stopAudio(); const ticket = playbackTicket; state('想一想怎么回答你');
    primeAudio();
    let view = null;
    try {
      await ensureSession(); addMessage({role: 'user', text}); textarea.value = '';
      view = addMessage({role: 'assistant', text: ''}, true);
      const result = await request('/chat', 'POST', {text, requestId: crypto.randomUUID(), autoSpeak: true});
      view.message = result; view.characters = [...result.text]; updateLimits(result.limits);
      report(result.demo ? '本地演示：没有调用真实聊天模型。' : ''); state('在这里，听你说');
      if (!result.demo && ticket === playbackTicket && opened && !document.hidden) {
        try { await playSpeech(result, view, ticket); }
        catch (error) { finishReply(view); report(error.name === 'NotAllowedError' ? '浏览器阻止了自动播放，请允许此网站播放声音后再发送消息。' : error.message); state('文字已回复，语音暂时没成功'); }
      } else finishReply(view);
    } catch (error) { view?.item.remove(); report(error.message); textarea.value = text; state('稍后再试试吧'); }
    finally { busy = false; updateSend(); textarea.disabled = false; textarea.focus(); }
  }
  function stopAudio() {
    playbackTicket++;
    finishReply(); narration = null;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null;
    mouth = 0; smoothedEnergy = 0; lastTick = 0; lastMouthChange = 0;
    if (root) { root.classList.remove('cp-playing'); root.querySelector('.cp-stop').hidden = true; setFrame(); }
  }
  function animatePlayback(time = 0) {
    if (!audio || audio.paused || document.hidden) return;
    animationFrame = requestAnimationFrame(animatePlayback);
    if (time - lastTick < 50) return; lastTick = time;
    if (narration && Number.isFinite(audio.duration) && audio.duration > 0) {
      // Use the media clock, so buffering and slower devices cannot race ahead.
      const progress = Math.min(1, audio.currentTime / audio.duration);
      revealReply(narration.view, Math.max(1, Math.ceil(narration.view.characters.length * progress)));
    }
    if (analyser && samples) {
      analyser.getFloatTimeDomainData(samples);
      let energy = 0; for (const value of samples) energy += value * value;
      smoothedEnergy = smoothedEnergy * .65 + Math.sqrt(energy / samples.length) * .35;
      const target = smoothedEnergy < .018 ? 0 : Math.min(sprite().mouthFrames.length - 1, Math.round(smoothedEnergy / .14 * (sprite().mouthFrames.length - 1)));
      if (target !== mouth && time - lastMouthChange >= 80) {
        mouth += Math.sign(target - mouth) * Math.min(2, Math.abs(target - mouth)); lastMouthChange = time; setFrame();
      }
    }
  }
  function applyAudioSettings() {
    if (!audio) return;
    audio.playbackRate = 1;
    audio.preservesPitch = true;
  }
  function prepareAudio() {
    if (audio) return;
    audio = new Audio(); audio.preload = 'auto';
    audio.addEventListener('pause', () => {
      if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; mouth = 0; setFrame();
    });
    audio.addEventListener('playing', () => {
      if (narration && opened && !document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; lastTick = 0; animatePlayback();
      }
    });
    audio.addEventListener('ended', () => { if (root.classList.contains('cp-playing')) { stopAudio(); state('在这里，听你说'); } });
    audio.addEventListener('error', () => { if (root.classList.contains('cp-playing')) { stopAudio(); report('音频播放失败，文字回复已经保留。'); } });
    const Context = window.AudioContext || window.webkitAudioContext;
    if (Context) {
      try { audioContext = new Context(); analyser = audioContext.createAnalyser(); analyser.fftSize = 1024; samples = new Float32Array(analyser.fftSize);
        const source = audioContext.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioContext.destination);
      } catch (_) { analyser = null; }
    }
  }
  function primeAudio() {
    // Unlock the same audio element/context synchronously during the Send gesture.
    prepareAudio();
    audioContext?.resume().catch(() => {});
    const silence = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';
    audio.src = silence;
    audio.play().then(() => { if (audio.src === silence) audio.pause(); }).catch(() => {});
  }
  async function playSpeech(message, view, ticket) {
    if (!service?.voice) throw new Error('女声服务还没有连接好，文字聊天可以继续使用。');
    state('准备把这句话说给你听'); report('');
    const cacheKey = message.id;
    let cached = audioCache.get(cacheKey);
    if (!cached) {
      const result = await request('/speech', 'POST', {messageId: message.id}); updateLimits(result.limits);
      const blob = await request('/audio/' + result.audioId, 'GET', null, true, true);
      cached = URL.createObjectURL(blob); audioCache.set(cacheKey, cached);
      if (audioCache.size > 10) { const oldest = audioCache.keys().next().value; URL.revokeObjectURL(audioCache.get(oldest)); audioCache.delete(oldest); }
    }
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); return; }
    prepareAudio();
    audio.src = cached; applyAudioSettings();
    if (audioContext?.state === 'suspended') await audioContext.resume();
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); return; }
    await audio.play();
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); audio.pause(); return; }
    narration = {view}; revealReply(view, 1);
    root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
    state('说给你听'); animatePlayback();
  }
  function build() {
    root = node('aside', 'companion'); root.setAttribute('aria-label', config.name + '陪伴助手');
    const avatar = () => {
      const el = node('div', 'cp-avatar'); el.setAttribute('aria-hidden', 'true'); el.style.backgroundImage = 'url(' + JSON.stringify(new URL(config.avatar, location.origin).href) + ')';
      const atlas = sprite(); el.style.backgroundSize = `${atlas.columns * 100}% ${atlas.rows * 100}%`;
      const lips = node('span', 'cp-mouth'), eyes = node('span', 'cp-eyes'); lips.hidden = true; eyes.hidden = true;
      lips.style.clipPath = `ellipse(8% 6% at ${atlas.mouthCenter[0]}% ${atlas.mouthCenter[1]}%)`;
      eyes.style.clipPath = `ellipse(23% 9% at ${atlas.eyeCenter[0]}% ${atlas.eyeCenter[1]}%)`;
      el.append(lips, eyes); return el;
    };
    const launcher = button('', 'cp-launcher', () => setOpen(true)); launcher.setAttribute('aria-label', '与' + config.name + '聊天'); launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'companion-panel'); launcher.append(avatar(), node('span', 'cp-launcher-label', config.name + ' · 说说话'));
    const panel = node('section', 'cp-panel'); panel.id = 'companion-panel'; panel.hidden = true; panel.setAttribute('aria-label', '聊天面板');
    const header = node('header', 'cp-header'); const title = node('div', 'cp-title', config.name); title.append(node('small', '', '你的博客伙伴'));
    const close = button('×', 'cp-icon', () => setOpen(false)); close.setAttribute('aria-label', '关闭聊天'); header.append(title, close);
    const intro = node('div', 'cp-intro'); const copy = node('div', 'cp-intro-copy'); copy.append(node('strong', '', '可莉在这里！'), node('p', '', '旅行者，今天一起冒险吧。'), node('span', 'cp-state', '在这里，听你说'));
    const stop = button('停止播放', 'cp-stop', () => { stopAudio(); state('在这里，听你说'); }); stop.hidden = true; copy.append(stop); intro.append(avatar(), copy);
    const nav = node('div', 'cp-nav'); nav.append(node('span', 'cp-chip', '文字 + 自动语音'));
    quota = node('span', 'cp-quota'); nav.append(quota);
    messageList = node('div', 'cp-messages'); messageList.dataset.cpView = 'chat'; messageList.setAttribute('role', 'log'); messageList.setAttribute('aria-live', 'polite'); messageList.setAttribute('aria-label', '聊天记录');
    const dataButtons = node('div', 'cp-data-buttons');
    dataButtons.append(button('导出我的数据', '', async () => {
      try { await ensureSession(); const data = await request('/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
        const a = node('a'); a.href = url; a.download = 'companion-memory.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { report(error.message); }
    }), button('清空对话', '', async () => {
      if (!window.confirm('清空这个浏览器的对话和相关保存数据？')) return;
      try { await ensureSession(); const result = await request('/reset', 'DELETE'); messageList.replaceChildren(); welcome();
        audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); stopAudio(); updateLimits(result.limits); report('对话已清空，今天的体验次数继续保留。');
      } catch (error) { report(error.message); }
    }));
    notice = node('p', 'cp-notice'); notice.hidden = true; notice.setAttribute('role', 'status');
    form = node('form', 'cp-form'); textarea = node('textarea'); textarea.maxLength = 600; textarea.rows = 2; textarea.placeholder = '今天有什么想说的？'; textarea.setAttribute('aria-label', '聊天消息');
    send = node('button', 'cp-primary', '发送'); send.type = 'submit'; form.append(textarea, send); form.addEventListener('submit', submit);
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    const disclosure = node('p', 'cp-disclosure', '发送后回复会自动朗读；对话会用于模型和语音服务。');
    panel.append(header, intro, nav, messageList, notice, form, disclosure, dataButtons); root.append(launcher, panel); document.body.append(root);
    welcome(); updateLimits(); scheduleBlink();
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) setOpen(false); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAudio(); clearTimeout(blinkTimer); blinkStep = 0; setFrame(); } else scheduleBlink(); });
    document.addEventListener('pjax:send', () => { stopAudio(); });
    document.addEventListener('pjax:complete', () => { if (!root.isConnected) document.body.append(root); scheduleBlink(); });
    window.addEventListener('pagehide', () => { stopAudio(); clearTimeout(blinkTimer); audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); });
    window.addEventListener('pageshow', scheduleBlink);
  }
  async function boot() {
    try {
      const response = await fetch('/companion-config.json', {cache: 'no-cache'}); if (!response.ok) return;
      config = await response.json(); if (!config.enabled) return;
      apiBase = String(config.apiBase || '').replace(/\/$/, '');
      if (['localhost','127.0.0.1'].includes(location.hostname)) apiBase = 'http://127.0.0.1:8787';
      if (apiBase && !/^https?:\/\//.test(apiBase)) apiBase = '';
      build();
    } catch (_) { /* An unavailable assistant cannot break article navigation. */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
})();
