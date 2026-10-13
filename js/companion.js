/* The renderer uses a six-frame reference sheet. It can later be replaced by Live2D. */
(() => {
  'use strict';
  if (window.__lsworldCompanion) return;
  window.__lsworldCompanion = true;
  const storageKey = 'lsworld.companion.v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey) || '{}'); } catch (_) { /* Optional browser persistence. */ }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) saved = {};
  const settings = {consent: saved.consent === true};
  let token = typeof saved.token === 'string' ? saved.token : '';
  let root, config, apiBase, notice, messageList, memoryList, quota, textarea, send, form, consentInput;
  let opened = false, busy = false, service = null, memories = [], currentLimits = null, audio = null, audioContext = null, analyser = null;
  let animationFrame = null, blinkTimer = null, blinking = false, mouth = 0, sessionPromise = null, playbackTicket = 0;
  const audioCache = new Map();
  const persist = () => { try { localStorage.setItem(storageKey, JSON.stringify({...settings, token})); } catch (_) {} };
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
  const setFrame = () => root.querySelectorAll('.cp-avatar').forEach(avatar => {
    avatar.style.backgroundPosition = `${mouth * 50}% ${blinking ? 100 : 0}%`;
  });
  const scheduleBlink = () => {
    clearTimeout(blinkTimer);
    if (document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    blinkTimer = setTimeout(() => { blinking = true; setFrame(); blinkTimer = setTimeout(() => { blinking = false; setFrame(); scheduleBlink(); }, 140); }, 3000 + Math.random() * 3500);
  };
  function updateLimits(limits) {
    if (limits) currentLimits = limits;
    quota.textContent = currentLimits ? `今日 ${currentLimits.chatRemaining} 聊 · ${currentLimits.voiceRemaining} 声` : '每日限次体验';
    quota.title = '每人每天最多 10 次聊天、3 次新语音；全站还有共享额度。';
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
    if (!settings.consent) throw new Error('先勾选下方的聊天说明，再开始聊天吧。');
    if (!sessionPromise) sessionPromise = request('/session', 'POST', {}, false).then(result => {
      token = result.token; persist(); updateLimits(result.limits);
    }).finally(() => { sessionPromise = null; });
    await sessionPromise;
  }
  function showView(view) {
    root.querySelectorAll('[data-cp-view]').forEach(el => { el.hidden = el.dataset.cpView !== view; });
    root.querySelectorAll('[data-cp-tab]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.cpTab === view)));
    form.hidden = view !== 'chat';
    root.querySelector('.cp-consent').hidden = view !== 'chat';
    if (view === 'memory') renderMemories();
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
      send.disabled = !service.chat || busy;
      if (service.demo) report('本地演示：回复用于验证界面，没有调用真实聊天模型。');
      else if (!service.chat) report('聊天服务正在准备连接。');
      else report('');
      if (token) {
        const result = await request('/state'); memories = result.memories; updateLimits(result.limits);
        if (!busy) { messageList.replaceChildren(); if (!result.messages.length) welcome(); result.messages.forEach(addMessage); }
        renderMemories();
      }
    } catch (error) { send.disabled = !service?.chat || busy; report(error.message); }
  }
  function welcome() { addMessage({role: 'assistant', text: config.greeting}); }
  function addMessage(message) {
    const item = node('div', 'cp-message'); item.dataset.role = message.role;
    item.append(node('p', '', message.text));
    if (message.role === 'assistant' && message.id) {
      const actions = node('div', 'cp-message-actions');
      const play = button('▷ 听她说', '', async () => {
        if (busy) return;
        play.disabled = true;
        try { await playSpeech(message); } catch (error) { report(error.message); state('在这里，听你说'); }
        finally { play.disabled = false; }
      });
      actions.append(play);
      if (message.memorySuggestion) actions.append(button('记住这件事', '', async event => {
        const control = event.currentTarget;
        try { await saveMemory(message.memorySuggestion); control.disabled = true; report('已经记住了，你可以在“记忆”里查看和删除。'); } catch (error) { report(error.message); }
      }));
      item.append(actions);
    }
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
    messageList.append(item); messageList.scrollTop = messageList.scrollHeight;
  }
  async function submit(event) {
    event.preventDefault(); const text = textarea.value.trim(); if (!text || busy) return;
    if (!settings.consent) { report('先勾选聊天说明，再把消息发给我吧。'); consentInput.focus(); return; }
    busy = true; send.disabled = true; textarea.disabled = true; stopAudio(); state('想一想怎么回答你');
    try {
      await ensureSession(); addMessage({role: 'user', text}); textarea.value = '';
      const result = await request('/chat', 'POST', {text, requestId: crypto.randomUUID()});
      addMessage(result); updateLimits(result.limits); blinking = result.emotion === 'happy'; setFrame();
      setTimeout(() => { blinking = false; setFrame(); }, 350);
      report(result.demo ? '本地演示：没有调用真实聊天模型。' : ''); state('在这里，听你说');
    } catch (error) { report(error.message); textarea.value = text; state('稍后再试试吧'); }
    finally { busy = false; send.disabled = !service?.chat; textarea.disabled = false; textarea.focus(); }
  }
  function stopAudio() {
    playbackTicket++;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null;
    mouth = 0; if (root) { root.classList.remove('cp-playing'); root.querySelector('.cp-stop').hidden = true; setFrame(); }
  }
  function animateMouth() {
    if (!audio || audio.paused || document.hidden) return;
    if (analyser) {
      const values = new Uint8Array(analyser.fftSize); analyser.getByteTimeDomainData(values);
      let energy = 0; for (const value of values) energy += ((value - 128) / 128) ** 2;
      const rms = Math.sqrt(energy / values.length); mouth = rms > .12 ? 2 : rms > .025 ? 1 : 0;
    } else mouth = 0;
    setFrame(); animationFrame = requestAnimationFrame(animateMouth);
  }
  function applyAudioSettings() {
    if (!audio) return;
    audio.playbackRate = 1.02;
    audio.preservesPitch = true;
  }
  async function playSpeech(message) {
    if (!settings.consent) throw new Error('先勾选聊天说明，再播放语音吧。');
    if (!service?.voice) throw new Error('女声服务还没有连接好，文字聊天可以继续使用。');
    stopAudio(); const ticket = playbackTicket; state('准备把这句话说给你听'); report('');
    const cacheKey = message.id;
    let cached = audioCache.get(cacheKey);
    if (!cached) {
      const result = await request('/speech', 'POST', {messageId: message.id}); updateLimits(result.limits);
      const blob = await request('/audio/' + result.audioId, 'GET', null, true, true);
      cached = URL.createObjectURL(blob); audioCache.set(cacheKey, cached);
      if (audioCache.size > 10) { const oldest = audioCache.keys().next().value; URL.revokeObjectURL(audioCache.get(oldest)); audioCache.delete(oldest); }
    }
    if (ticket !== playbackTicket || !opened || document.hidden) return;
    if (!audio) {
      audio = new Audio(); audio.preload = 'auto';
      audio.addEventListener('ended', () => { stopAudio(); state('在这里，听你说'); });
      audio.addEventListener('error', () => { stopAudio(); report('音频播放失败，文字回复已经保留。'); });
      const Context = window.AudioContext || window.webkitAudioContext;
      if (Context) {
        try { audioContext = new Context(); analyser = audioContext.createAnalyser(); analyser.fftSize = 256;
          const source = audioContext.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioContext.destination);
        } catch (_) { analyser = null; }
      }
    }
    audio.src = cached; applyAudioSettings();
    if (audioContext?.state === 'suspended') await audioContext.resume();
    if (ticket !== playbackTicket || !opened || document.hidden) return;
    await audio.play();
    if (ticket !== playbackTicket || !opened || document.hidden) { stopAudio(); return; }
    root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
    state('说给你听'); animateMouth();
  }
  async function saveMemory(text) {
    await ensureSession(); const memory = await request('/memory', 'POST', {text}); memories.unshift(memory); renderMemories();
  }
  function renderMemories() {
    memoryList.replaceChildren();
    if (!memories.length) memoryList.append(node('li', '', '还没有确认过的记忆。'));
    memories.forEach(memory => {
      const item = node('li'); item.append(node('span', '', memory.text));
      item.append(button('修改', '', async () => {
        const text = window.prompt('修改这条记忆（最多 100 字）', memory.text);
        if (!text?.trim()) return;
        try { const updated = await request('/memory/' + encodeURIComponent(memory.id), 'PATCH', {text: text.trim()}); memory.text = updated.text; renderMemories(); }
        catch (error) { report(error.message); }
      }));
      item.append(button('删除', '', async () => {
        try { await request('/memory/' + encodeURIComponent(memory.id), 'DELETE'); memories = memories.filter(m => m.id !== memory.id); renderMemories(); }
        catch (error) { report(error.message); }
      })); memoryList.append(item);
    });
  }
  function build() {
    root = node('aside', 'companion'); root.setAttribute('aria-label', config.name + '陪伴助手');
    const avatar = () => { const el = node('div', 'cp-avatar'); el.setAttribute('aria-hidden', 'true'); el.style.backgroundImage = 'url(' + JSON.stringify(new URL(config.avatar, location.origin).href) + ')'; return el; };
    const launcher = button('', 'cp-launcher', () => setOpen(true)); launcher.setAttribute('aria-label', '与' + config.name + '聊天'); launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'companion-panel'); launcher.append(avatar(), node('span', 'cp-launcher-label', config.name + ' · 说说话'));
    const panel = node('section', 'cp-panel'); panel.id = 'companion-panel'; panel.hidden = true; panel.setAttribute('aria-label', '聊天面板');
    const header = node('header', 'cp-header'); const title = node('div', 'cp-title', config.name); title.append(node('small', '', '你的博客伙伴'));
    const close = button('×', 'cp-icon', () => setOpen(false)); close.setAttribute('aria-label', '关闭聊天'); header.append(title, close);
    const intro = node('div', 'cp-intro'); const copy = node('div', 'cp-intro-copy'); copy.append(node('strong', '', '留一点时间，聊聊今天。'), node('p', '', '聊近况，也陪你一起学习。'), node('span', 'cp-state', '在这里，听你说'));
    const stop = button('停止播放', 'cp-stop', () => { stopAudio(); state('在这里，听你说'); }); stop.hidden = true; copy.append(stop); intro.append(avatar(), copy);
    const nav = node('nav', 'cp-nav'); nav.setAttribute('aria-label', '助手功能');
    for (const [id, label] of [['chat','聊天'],['memory','记忆']]) {
      const tab = button(label, '', () => showView(id)); tab.dataset.cpTab = id; tab.setAttribute('aria-pressed', String(id === 'chat')); nav.append(tab);
    }
    quota = node('span', 'cp-quota'); nav.append(quota);
    messageList = node('div', 'cp-messages'); messageList.dataset.cpView = 'chat'; messageList.setAttribute('role', 'log'); messageList.setAttribute('aria-live', 'polite'); messageList.setAttribute('aria-label', '聊天记录');
    const memoryView = node('section', 'cp-view'); memoryView.dataset.cpView = 'memory'; memoryView.hidden = true;
    memoryView.append(node('h3', '', '她记住了什么'), node('p', '', '只保存你确认的事情，最多 30 条。同一浏览器下次访问可以继续；清除浏览器数据后可能无法找回。'));
    const memoryForm = node('form', 'cp-memory-form'); const memoryInput = node('input'); memoryInput.placeholder = '例如：叫我小林，我正在学 Python'; memoryInput.maxLength = 100; memoryInput.setAttribute('aria-label', '希望她记住的事情');
    const save = node('button', 'cp-primary', '记住'); save.type = 'submit'; memoryForm.append(memoryInput, save);
    memoryForm.addEventListener('submit', async event => {
      event.preventDefault(); if (!memoryInput.value.trim()) return; save.disabled = true;
      try { await saveMemory(memoryInput.value.trim()); memoryInput.value = ''; report('已经记住了。'); } catch (error) { report(error.message); } finally { save.disabled = false; }
    });
    memoryList = node('ul', 'cp-memory-list'); const dataButtons = node('div', 'cp-data-buttons');
    dataButtons.append(button('导出我的数据', '', async () => {
      try { await ensureSession(); const data = await request('/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
        const a = node('a'); a.href = url; a.download = 'companion-memory.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { report(error.message); }
    }), button('清空对话与记忆', '', async () => {
      if (!window.confirm('清空这个浏览器对应的对话与记忆？这会删除已保存的内容。')) return;
      try { await ensureSession(); const result = await request('/reset', 'DELETE'); memories = []; renderMemories(); messageList.replaceChildren(); welcome();
        audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); stopAudio(); updateLimits(result.limits); report('对话与记忆已清空，今天的体验次数继续保留。');
      } catch (error) { report(error.message); }
    })); memoryView.append(memoryForm, memoryList, dataButtons);
    notice = node('p', 'cp-notice'); notice.hidden = true; notice.setAttribute('role', 'status');
    form = node('form', 'cp-form'); textarea = node('textarea'); textarea.maxLength = 600; textarea.rows = 2; textarea.placeholder = '今天有什么想说的？'; textarea.setAttribute('aria-label', '聊天消息');
    send = node('button', 'cp-primary', '发送'); send.type = 'submit'; form.append(textarea, send); form.addEventListener('submit', submit);
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    const consent = node('label', 'cp-consent'); consentInput = node('input'); consentInput.type = 'checkbox'; consentInput.checked = settings.consent;
    consentInput.addEventListener('change', () => { settings.consent = consentInput.checked; persist(); });
    consent.append(consentInput, node('span', '', '聊天会发送给模型服务；点击播放会发送回复给语音服务。近期对话保存在服务器，长期记忆由你确认。可在“记忆”中删除。'));
    panel.append(header, intro, nav, messageList, memoryView, notice, form, consent); root.append(launcher, panel); document.body.append(root);
    welcome(); updateLimits(); renderMemories(); scheduleBlink();
    root.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) setOpen(false); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAudio(); clearTimeout(blinkTimer); blinking = false; setFrame(); } else scheduleBlink(); });
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
