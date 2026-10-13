/* Stable portrait layers; expressions and small gestures follow conversation state. */
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
  let healthPromise = null, healthCheckedAt = 0, welcomePending = false, welcomeStarting = false, welcomeBubble = null, welcomeTimer = null;
  const welcomeKey = 'lsworld.klee.welcomed.v1';
  const audioCache = new Map();
  let pcmPlayback = null;
  let expression = 'neutral', reactionTimer = null, gestureTimer = null;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  const framePosition = (index, atlas = sprite()) => {
    const x = atlas.columns > 1 ? index % atlas.columns / (atlas.columns - 1) * 100 : 0;
    const y = atlas.rows > 1 ? Math.floor(index / atlas.columns) / (atlas.rows - 1) * 100 : 0;
    return `${Number(x.toFixed(4))}% ${Number(y.toFixed(4))}%`;
  };
  function expressionFor(text, fallback = 'happy') {
    if (/难过|伤心|孤单|孤独|压力|不开心|烦恼|担心|害怕|没关系|别担心|陪着|抱抱|慢慢来|好累|有点累|累了|疲惫|难受|失败|做不到/.test(text)) return 'care';
    if (/成功|做到了|完成了|厉害|真棒/.test(text)) return 'proud';
    if (/哈哈|嘿嘿|嘻嘻/.test(text)) return 'laugh';
    if (/好耶|开心|太棒|出发|一起玩|谢谢/.test(text)) return 'happy';
    if (/为什么|如何|原理|公式|代码|算法|想想/.test(text)) return 'thinking';
    if (/好奇|真的吗|什么呀|去哪|咦/.test(text)) return 'curious';
    return fallback;
  }
  function setExpression(value) {
    if (!root) return;
    if (!Object.hasOwn(config.expressions?.frames || {}, value)) value = 'neutral';
    if (expression === value && root.dataset.expression === value) return;
    const previous = expression; expression = value; root.dataset.expression = value;
    root.querySelectorAll('.cp-avatar').forEach(avatar => {
      const back = avatar.querySelector('.cp-face-back'), front = avatar.querySelector('.cp-face-front');
      if (!front || !config.expressions) return;
      front.getAnimations().forEach(animation => animation.cancel());
      back.style.setProperty('--cp-expression-position', framePosition(config.expressions.frames[previous] ?? 0, config.expressions));
      front.style.setProperty('--cp-expression-position', framePosition(config.expressions.frames[value] ?? 0, config.expressions));
      back.style.opacity = reducedMotion() ? '0' : '1';
      if (!reducedMotion()) {
        const fade = front.animate([{opacity:0},{opacity:1}], {duration:220,easing:'ease-out'});
        fade.onfinish = () => { back.style.opacity = '0'; };
      }
    });
    if (['laugh','wink'].includes(value)) { clearTimeout(blinkTimer); blinkStep = 0; setFrame(); }
    else if (['laugh','wink'].includes(previous)) scheduleBlink();
  }
  function setPresence(value) { if (root) root.dataset.presence = value; }
  function gesture(value) {
    if (!root || document.hidden || reducedMotion() || root.dataset.gesture === value) return;
    clearTimeout(gestureTimer); root.dataset.gesture = value;
    gestureTimer = setTimeout(() => { root.dataset.gesture = ''; }, value === 'hello' ? 1000 : 760);
  }
  function settleCharacter(delay = 2400) {
    clearTimeout(reactionTimer);
    reactionTimer = setTimeout(() => {
      if (busy || narration || document.hidden) return;
      setPresence('idle'); setExpression('neutral');
    }, delay);
  }
  function greetCharacter() {
    clearTimeout(reactionTimer); setExpression('wink'); gesture('hello');
    reactionTimer = setTimeout(() => {
      if (document.hidden) return;
      setExpression(narration?.view ? expressionFor(narration.view.paragraph.textContent, narration.view.mood) : busy ? 'thinking' : 'happy');
      if (!busy && !narration) settleCharacter(1600);
    }, 1400);
  }
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
    if (document.hidden || reducedMotion() || ['laugh','wink'].includes(expression)) return;
    blinkTimer = setTimeout(function blink() {
      blinkStep++; setFrame();
      if (blinkStep < sprite().blinkFrames.length - 1) blinkTimer = setTimeout(blink, 40);
      else { blinkStep = 0; setFrame(); scheduleBlink(); }
    }, 3000 + Math.random() * 3500);
  };
  function updateLimits(limits) {
    if (limits) currentLimits = limits;
    quota.textContent = currentLimits ? `今天还能聊 ${Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining)} 次` : '';
    updateSend();
  }
  function updateSend() {
    if (!send) return;
    const exhausted = currentLimits && (!currentLimits.chatAvailable || !currentLimits.voiceAvailable || Math.min(currentLimits.chatRemaining, currentLimits.voiceRemaining) <= 0);
    send.disabled = busy || !service?.chat || (!service.demo && (!service.voice || exhausted));
    if (exhausted && !busy && !narration) state('可莉要休息一会儿啦。');
  }
  async function request(path, method = 'GET', data, authenticated = true, raw = false) {
    if (!apiBase) throw new Error('助手正在准备连接，稍后再来找我吧。');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), path.startsWith('/respond') ? 110000 : 60000);
    try {
      const response = await fetch(apiBase + path, {method, headers: {...(data ? {'Content-Type': 'application/json'} : {}),
        ...(authenticated && token ? {'Authorization': 'Bearer ' + token} : {})}, body: data ? JSON.stringify(data) : undefined, signal: controller.signal});
      if (!response.ok) {
        if (response.status === 401) { token = ''; persist(); sessionPromise = null; }
        let result; try { result = await response.json(); } catch (_) {}
        throw new Error(result?.error || '连接暂时没成功，稍后再试试吧。');
      }
      if (typeof raw === 'function' && response.headers.get('Content-Type')?.includes('text/event-stream')) {
        const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', result = null, complete = false;
        try {
          while (true) {
            const {done, value} = await reader.read(); buffer += decoder.decode(value, {stream: !done});
            let boundary;
            while ((boundary = buffer.indexOf('\n\n')) >= 0) {
              const event = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2);
              const line = event.split('\n').find(value => value.startsWith('data: ')); if (!line) continue;
              const data = JSON.parse(line.slice(6)); raw(data);
              if (data.type === 'done' || data.type === 'error') { complete = true; result = data.result; if (data.type === 'error' && !result) throw new Error(data.error); }
            }
            if (done) break;
          }
          if (!complete) throw new Error('可莉的声音断了一下，先看看这句话吧。');
          return result;
        } finally { await reader.cancel().catch(() => {}); }
      }
      if (raw === 'reply') {
        const metadata = response.headers.get('X-Companion-Reply');
        if (!metadata) return await response.json();
        const result = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(metadata), value => value.charCodeAt(0))));
        return {...result, audioBlob: await response.blob()};
      }
      return raw && typeof raw !== 'function' ? await response.blob() : await response.json();
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
    if (value && welcomeBubble) welcomeBubble.hidden = true;
    root.querySelector('.cp-launcher').hidden = value;
    root.querySelector('.cp-launcher').setAttribute('aria-expanded', String(value));
    if (value) { refresh(); textarea.focus(); setPresence('listening'); setExpression('happy'); gesture('hello'); settleCharacter(); }
    else { stopAudio(); clearTimeout(reactionTimer); setPresence('idle'); setExpression('neutral'); root.querySelector('.cp-launcher').focus(); }
  }
  async function refresh() {
    try {
      const [health, result] = await Promise.all([ensureHealth(), token ? request('/state') : null]); service = health;
      if (!narration) state(service.demo ? '本地演示' : service.chat ? '嘟嘟可也在听。' : '可莉一会儿就来。');
      updateSend();
      if (service.demo) report('本地演示：回复用于验证界面，没有调用真实聊天模型。');
      else if (!service.chat) report('可莉一会儿就来，先看看博客吧。');
      else report('');
      if (result) {
        updateLimits(result.limits);
        if (!busy) { messageList.replaceChildren(); if (!result.messages.length) welcome(); result.messages.forEach(message => addMessage(message)); }
      }
    } catch (error) { updateSend(); report(error.message); }
  }
  function ensureHealth() {
    if (service && Date.now() - healthCheckedAt < 30000) return Promise.resolve(service);
    if (!healthPromise) healthPromise = request('/health', 'GET', null, false).then(result => { service = result; healthCheckedAt = Date.now(); updateSend(); return result; }).finally(() => { healthPromise = null; });
    return healthPromise;
  }
  function welcome() { addMessage({role: 'assistant', text: config.greeting}); }
  function addMessage(message, pending = false) {
    const item = node('div', 'cp-message'); item.dataset.role = message.role;
    const paragraph = node('p', '', pending ? '唔…让可莉想一想。' : message.text); item.append(paragraph);
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
    cancelWelcome(); busy = true; send.disabled = true; textarea.disabled = true; stopAudio(); const ticket = playbackTicket; state('唔，让可莉想想…');
    clearTimeout(reactionTimer); setPresence('thinking'); setExpression('thinking');
    primeAudio();
    let view = null;
    try {
      await ensureSession(); addMessage({role: 'user', text}); textarea.value = '';
      view = addMessage({role: 'assistant', text: ''}, true);
      view.mood = expressionFor(text, 'happy');
      const result = await request('/respond-stream', 'POST', {text, requestId: crypto.randomUUID(), autoSpeak: true}, true, data => receiveStream(data, view, ticket));
      view.message = result; view.characters = [...result.text]; updateLimits(result.limits);
      if (result.demo) report('本地演示：没有调用真实聊天模型。');
      if (!pcmPlayback || ticket !== playbackTicket) {
        finishReply(view); state('嘟嘟可也在听。');
        if (ticket === playbackTicket && opened) { setPresence('idle'); setExpression(expressionFor(result.text, view.mood)); settleCharacter(); }
      }
    } catch (error) {
      if (view?.characters.length) { stopAudio(); finishReply(view); }
      else { view?.item.remove(); textarea.value = text; }
      report(error.message); state('再说一次好不好？');
      setPresence('idle'); setExpression('care'); settleCharacter();
    }
    finally { busy = false; updateSend(); textarea.disabled = false; textarea.focus(); }
  }
  function stopAudio() {
    playbackTicket++;
    if (pcmPlayback) { for (const source of pcmPlayback.sources) { try { source.stop(); } catch (_) {} } pcmPlayback = null; }
    if (narration?.welcome && welcomeBubble) { clearTimeout(welcomeTimer); welcomeTimer = setTimeout(() => { welcomeBubble.hidden = true; }, 1200); }
    finishReply(); narration = null;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null;
    mouth = 0; smoothedEnergy = 0; lastTick = 0; lastMouthChange = 0;
    if (root) { root.classList.remove('cp-playing'); root.querySelector('.cp-stop').hidden = true; setFrame(); }
    if (root) {
      setPresence(busy ? 'thinking' : 'idle');
      if (busy) setExpression('thinking'); else { if (expression === 'laugh' || expression === 'wink') setExpression('happy'); settleCharacter(); }
    }
  }
  function animatePlayback(time = 0) {
    if (document.hidden || (!pcmPlayback && (!audio || audio.paused))) return;
    animationFrame = requestAnimationFrame(animatePlayback);
    if (time - lastTick < 50) return; lastTick = time;
    if (pcmPlayback) {
      const playing = pcmPlayback, clock = audioContext.currentTime; let played = 0;
      for (const span of playing.spans) { if (clock < span.time) break; played = span.offset + Math.min(span.duration, clock - span.time); }
      let count = 0;
      for (const sentence of playing.sentences.values()) {
        if (sentence.words.length && played * 1000 >= sentence.words[0].begin_time && playing.activeSentence !== sentence && played * 1000 <= (sentence.endTime ?? Infinity)) {
          playing.activeSentence = sentence; setExpression(expressionFor(sentence.text, playing.view.mood));
        }
        for (const word of sentence.words) if (played * 1000 >= word.begin_time) count = Math.max(count, sentence.offset + word.characterEnd);
        if (sentence.endTime != null && played * 1000 >= sentence.endTime) count = Math.max(count, sentence.offset + [...sentence.text].length);
      }
      if (count) revealReply(playing.view, count);
      if (playing.finished && !playing.sources.size && !playing.pending.length) { stopAudio(); state('嘟嘟可也在听。'); return; }
    } else if (narration?.view && Number.isFinite(audio.duration) && audio.duration > 0) {
      // Use the media clock, so buffering and slower devices cannot race ahead.
      const progress = Math.min(1, audio.currentTime / audio.duration);
      revealReply(narration.view, Math.max(1, Math.ceil(narration.view.characters.length * progress)));
    }
    let rms = 0;
    if (analyser && samples && audioContext?.state === 'running') {
      analyser.getFloatTimeDomainData(samples);
      let energy = 0; for (const value of samples) energy += value * value;
      rms = Math.sqrt(energy / samples.length);
    } else if (narration?.welcome) rms = config.welcome?.envelope[Math.floor(audio.currentTime / (config.welcome.step || .05))] || 0;
    smoothedEnergy = smoothedEnergy * .65 + rms * .35;
    const target = smoothedEnergy < .018 ? 0 : Math.min(sprite().mouthFrames.length - 1, Math.round(smoothedEnergy / .14 * (sprite().mouthFrames.length - 1)));
    if (target !== mouth && time - lastMouthChange >= 80) {
      mouth += Math.sign(target - mouth) * Math.min(2, Math.abs(target - mouth)); lastMouthChange = time; setFrame();
    }
  }
  function applyAudioSettings() {
    if (!audio) return;
    audio.playbackRate = 1;
    audio.preservesPitch = true;
  }
  function prepareAudio(withAnalyser = false) {
    if (!audio) {
    audio = new Audio(); audio.preload = 'auto';
    audio.addEventListener('pause', () => {
      if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; mouth = 0; setFrame();
    });
    audio.addEventListener('playing', () => {
      if (narration && opened && !document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; lastTick = 0; animatePlayback();
      }
    });
    audio.addEventListener('ended', () => { if (root.classList.contains('cp-playing')) { stopAudio(); state('嘟嘟可也在听。'); } });
    audio.addEventListener('error', () => { if (root.classList.contains('cp-playing')) { const greeting = narration?.welcome; stopAudio(); if (!greeting) report('咦，声音没出来，旅行者先看看这句话吧。'); } });
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (withAnalyser && Context && !audioContext) {
      try { audioContext = new Context(); analyser = audioContext.createAnalyser(); analyser.fftSize = 1024; samples = new Float32Array(analyser.fftSize);
        const source = audioContext.createMediaElementSource(audio); source.connect(analyser); analyser.connect(audioContext.destination);
      } catch (_) { analyser = null; }
    }
  }
  function primeAudio() {
    // Unlock the same audio element/context synchronously during the Send gesture.
    prepareAudio(true);
    audioContext?.resume().catch(() => {});
    const silence = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQQAAACAgICA';
    audio.src = silence;
    audio.play().then(() => { if (audio.src === silence) audio.pause(); }).catch(() => {});
  }
  function receiveStream(data, view, ticket) {
    if (data.type === 'phrase') {
      view.message.text = (view.message.text || '') + data.text; view.characters = [...view.message.text];
    }
    if (data.result) { view.message = data.result; view.characters = [...data.result.text]; updateLimits(data.result.limits); }
    if (ticket !== playbackTicket || !opened || document.hidden) { if (data.result) finishReply(view); return; }
    if (data.type === 'start' || (!pcmPlayback && ['audio','alignment'].includes(data.type))) {
      if (!audioContext || !analyser) throw new Error('咦，声音没出来，旅行者先看看这句话吧。');
      pcmPlayback = {view, sources: new Set(), spans: [], sentences: new Map(), pending: [], pendingSamples: 0, offset: 0, nextTime: 0, finished: false};
      narration = {view};
    }
    const playing = pcmPlayback;
    if (data.type === 'alignment' && playing) {
      const output = data.output, index = output.sentence?.index; if (!Number.isInteger(index)) return;
      let sentence = playing.sentences.get(index);
      if (!sentence) {
        const offset = [...playing.sentences.values()].reduce((sum, item) => sum + [...item.text].length, 0);
        sentence = {text: output.original_text || '', offset, words: [], endTime: null}; playing.sentences.set(index, sentence);
      }
      if (output.original_text) sentence.text = output.original_text;
      if (output.sentence.words?.length) {
        let cursor = 0;
        sentence.words = output.sentence.words.map(word => {
          const at = sentence.text.indexOf(word.text, cursor);
          const end = at >= 0 ? at + word.text.length : cursor;
          cursor = end; return {...word, characterEnd: [...sentence.text.slice(0, end)].length};
        });
      }
      if (output.type === 'sentence-end') sentence.endTime = Math.max(...sentence.words.map(word => word.end_time), playing.offset * 1000);
    }
    if (data.type === 'audio' && playing) {
      const bytes = Uint8Array.from(atob(data.data), value => value.charCodeAt(0));
      if (bytes.length % 2) throw new Error('可莉的声音断了一下。');
      const samples = new Float32Array(bytes.length / 2), values = new DataView(bytes.buffer);
      for (let index = 0; index < samples.length; index++) samples[index] = values.getInt16(index * 2, true) / 32768;
      playing.pending.push(samples); playing.pendingSamples += samples.length;
      if (playing.pendingSamples >= 2880) flushPCM(playing);
    }
    if (data.type === 'done' || data.type === 'error') {
      if (playing) { flushPCM(playing); playing.finished = true; }
      if (data.textOnly || !playing?.spans.length) { stopAudio(); finishReply(view); }
      if (data.type === 'error') report(data.error); else report('');
    }
  }
  function flushPCM(playing) {
    if (!playing.pendingSamples) return;
    const buffer = audioContext.createBuffer(1, playing.pendingSamples, 24000), target = buffer.getChannelData(0); let offset = 0;
    for (const part of playing.pending) { target.set(part, offset); offset += part.length; }
    playing.pending = []; playing.pendingSamples = 0;
    const source = audioContext.createBufferSource(); source.buffer = buffer; source.connect(analyser);
    const start = Math.max(playing.nextTime, audioContext.currentTime + (playing.nextTime ? .015 : .06));
    playing.spans.push({time: start, offset: playing.offset, duration: buffer.duration});
    playing.offset += buffer.duration; playing.nextTime = start + buffer.duration; playing.sources.add(source);
    source.onended = () => { playing.sources.delete(source); source.disconnect(); };
    source.start(start);
    if (!root.classList.contains('cp-playing')) {
      root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
      clearTimeout(reactionTimer); setPresence('speaking'); setExpression(expressionFor(playing.view.message.text || '', playing.view.mood));
      gesture(expression === 'happy' || expression === 'laugh' || expression === 'proud' ? 'bounce' : 'nod');
      state('可莉有话想说！'); lastTick = 0; animatePlayback();
    }
  }
  async function playSpeech(message, view, ticket) {
    if (!service?.voice) throw new Error('女声服务还没有连接好，文字聊天可以继续使用。');
    if (message.speechError) throw new Error(message.speechError);
    state('嘿嘿，马上就好。'); report('');
    const cacheKey = message.id;
    let cached = audioCache.get(cacheKey);
    if (!cached) {
      const blob = message.audioBlob;
      if (!blob) throw new Error('可莉的声音还没传过来，先看看这句话吧。');
      cached = URL.createObjectURL(blob); audioCache.set(cacheKey, cached);
      if (audioCache.size > 10) { const oldest = audioCache.keys().next().value; URL.revokeObjectURL(audioCache.get(oldest)); audioCache.delete(oldest); }
    }
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); return; }
    prepareAudio(true);
    audio.src = cached; applyAudioSettings();
    if (audioContext?.state === 'suspended') await audioContext.resume();
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); return; }
    await audio.play();
    if (ticket !== playbackTicket || !opened || document.hidden) { finishReply(view); audio.pause(); return; }
    narration = {view}; revealReply(view, 1);
    root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
    state('可莉有话想说！'); animatePlayback();
  }
  function cancelWelcome() {
    welcomePending = false; clearTimeout(welcomeTimer); if (welcomeBubble) welcomeBubble.hidden = true;
    document.removeEventListener('pointerdown', welcomeGesture); document.removeEventListener('pointerup', welcomeGesture); document.removeEventListener('keydown', welcomeGesture);
  }
  function welcomeGesture(event) {
    if (event.type === 'keydown' && (event.ctrlKey || event.altKey || event.metaKey)) return;
    if (event.target.closest?.('.cp-welcome-close,.cp-icon,.cp-stop,.cp-form button')) return;
    tryWelcome(true);
  }
  function tryWelcome(withUserGesture = false) {
    if (!welcomePending || welcomeStarting || busy || narration || document.hidden) return;
    welcomeStarting = true; const ticket = playbackTicket;
    prepareAudio(withUserGesture); if (withUserGesture) audioContext?.resume().catch(() => {});
    const url = new URL(config.welcome.audio, location.origin).href;
    if (audio.src !== url) audio.src = url;
    audio.play().then(() => {
      if (ticket !== playbackTicket || busy || document.hidden) { audio.pause(); return; }
      cancelWelcome(); try { localStorage.setItem(welcomeKey, 'true'); } catch (_) {}
      narration = {welcome: true}; root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
      clearTimeout(reactionTimer); setPresence('speaking'); setExpression('happy'); gesture('hello');
      welcomeBubble.hidden = opened; state('可莉来啦！'); animatePlayback();
    }).catch(error => { if (error.name !== 'NotAllowedError' && error.name !== 'AbortError') cancelWelcome(); }).finally(() => { welcomeStarting = false; });
  }
  function startWelcome() {
    if (!config.welcome?.audio) return;
    try { if (localStorage.getItem(welcomeKey) === 'true') return; } catch (_) {}
    welcomePending = true; welcomeBubble.hidden = false;
    prepareAudio(); audio.src = new URL(config.welcome.audio, location.origin).href; audio.load();
    document.addEventListener('pointerdown', welcomeGesture); document.addEventListener('pointerup', welcomeGesture); document.addEventListener('keydown', welcomeGesture);
    tryWelcome();
  }
  function build() {
    root = node('aside', 'companion'); root.setAttribute('aria-label', config.name + '陪伴助手'); root.dataset.presence = 'idle';
    const avatar = (interactive = false) => {
      const wrap = interactive ? button('', 'cp-avatar-wrap cp-character', greetCharacter) : node('div', 'cp-avatar-wrap');
      if (interactive) wrap.setAttribute('aria-label', '和可莉打个招呼');
      const el = node('div', 'cp-avatar'); el.setAttribute('aria-hidden', 'true'); el.style.backgroundImage = 'url(' + JSON.stringify(new URL(config.avatar, location.origin).href) + ')';
      const atlas = sprite(); el.style.backgroundSize = `${atlas.columns * 100}% ${atlas.rows * 100}%`;
      if (config.expressions) {
        const faces = config.expressions, eye = faces.eyeCenter || atlas.eyeCenter, lip = faces.mouthCenter || atlas.mouthCenter;
        for (const className of ['cp-face-back','cp-face-front']) {
          const layer = node('span', 'cp-expression-layer ' + className);
          layer.style.setProperty('--cp-expression-image', 'url(' + JSON.stringify(new URL(faces.atlas, location.origin).href) + ')');
          layer.style.setProperty('--cp-expression-size', `${faces.columns * 100}% ${faces.rows * 100}%`);
          layer.style.setProperty('--cp-expression-position', framePosition(0, faces));
          const eyes = node('span', 'cp-expression-eyes'), lips = node('span', 'cp-expression-mouth');
          eyes.style.maskImage = `radial-gradient(ellipse 27% 12% at ${eye[0]}% ${eye[1]}%, #000 80%, transparent 100%)`;
          lips.style.maskImage = `radial-gradient(ellipse 8% 6% at ${lip[0]}% ${lip[1]}%, #000 82%, transparent 100%)`;
          layer.append(eyes, lips); el.append(layer);
        }
      }
      const lips = node('span', 'cp-mouth'), eyes = node('span', 'cp-eyes'); lips.hidden = true; eyes.hidden = true;
      lips.style.clipPath = `ellipse(8% 6% at ${atlas.mouthCenter[0]}% ${atlas.mouthCenter[1]}%)`;
      eyes.style.clipPath = `ellipse(23% 9% at ${atlas.eyeCenter[0]}% ${atlas.eyeCenter[1]}%)`;
      el.append(lips, eyes); const breath = node('span', 'cp-breath'); breath.append(el); wrap.append(breath); return wrap;
    };
    const launcher = button('', 'cp-launcher', () => setOpen(true)); launcher.setAttribute('aria-label', '与' + config.name + '聊天'); launcher.setAttribute('aria-expanded', 'false');
    launcher.setAttribute('aria-controls', 'companion-panel'); launcher.append(avatar(), node('span', 'cp-launcher-label', '来找可莉玩！'));
    const panel = node('section', 'cp-panel'); panel.id = 'companion-panel'; panel.hidden = true; panel.setAttribute('aria-label', '聊天面板');
    const header = node('header', 'cp-header'); const title = node('div', 'cp-title', config.name); title.append(node('small', '', '火花骑士'));
    const close = button('×', 'cp-icon', () => setOpen(false)); close.setAttribute('aria-label', '关闭聊天'); header.append(title, close);
    const intro = node('div', 'cp-intro'); const copy = node('div', 'cp-intro-copy'); copy.append(node('strong', '', '一起去玩吧！'), node('span', 'cp-state', '嘟嘟可也在听。'));
    const stop = button('先停一下', 'cp-stop', () => { stopAudio(); state('可莉在听呢！'); }); stop.setAttribute('aria-label', '停止播放'); stop.hidden = true; copy.append(stop); intro.append(avatar(true), copy);
    quota = node('span', 'cp-quota');
    messageList = node('div', 'cp-messages'); messageList.dataset.cpView = 'chat'; messageList.setAttribute('role', 'log'); messageList.setAttribute('aria-live', 'polite'); messageList.setAttribute('aria-label', '聊天记录');
    const dataButtons = node('div', 'cp-data-buttons');
    dataButtons.append(button('导出我的数据', '', async () => {
      try { await ensureSession(); const data = await request('/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
        const a = node('a'); a.href = url; a.download = 'companion-memory.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { report(error.message); }
    }), button('清空对话', '', async () => {
      if (!window.confirm('清空这段聊天，重新开始吗？')) return;
      try { await ensureSession(); const result = await request('/reset', 'DELETE'); messageList.replaceChildren(); welcome();
        audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); stopAudio(); updateLimits(result.limits); report('好耶，我们重新开始吧！');
      } catch (error) { report(error.message); }
    }));
    notice = node('p', 'cp-notice'); notice.hidden = true; notice.setAttribute('role', 'status');
    form = node('form', 'cp-form'); textarea = node('textarea'); textarea.maxLength = 600; textarea.rows = 2; textarea.placeholder = '想和可莉说什么？'; textarea.setAttribute('aria-label', '聊天消息');
    send = node('button', 'cp-primary', '告诉可莉'); send.type = 'submit'; form.append(textarea, send); form.addEventListener('submit', submit);
    textarea.addEventListener('keydown', event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
    textarea.addEventListener('input', () => {
      if (busy || narration) return;
      clearTimeout(reactionTimer); setPresence('listening'); setExpression(textarea.value.trim() ? 'curious' : 'neutral'); settleCharacter();
    });
    const options = node('details', 'cp-options'), summary = node('summary', '', '⋯'), menu = node('div', 'cp-options-menu');
    summary.setAttribute('aria-label', '聊天选项'); menu.append(dataButtons, quota); options.append(summary, menu); header.insertBefore(options, close);
    welcomeBubble = node('div', 'cp-welcome'); welcomeBubble.hidden = true; welcomeBubble.append(node('p', '', config.greeting), button('×', 'cp-welcome-close', () => {
      cancelWelcome(); stopAudio(); try { localStorage.setItem(welcomeKey, 'true'); } catch (_) {}
    }));
    welcomeBubble.querySelector('button').setAttribute('aria-label', '停止欢迎语');
    panel.append(header, intro, messageList, notice, form); root.append(welcomeBubble, launcher, panel); document.body.append(root);
    welcome(); updateLimits(); setExpression('neutral'); scheduleBlink();
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && opened) setOpen(false); });
    const pauseCharacter = () => {
      clearTimeout(reactionTimer); clearTimeout(gestureTimer); clearTimeout(blinkTimer);
      root.dataset.gesture = ''; setPresence(document.hidden ? 'hidden' : 'idle'); setExpression('neutral'); blinkStep = 0; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { stopAudio(); pauseCharacter(); } else { setPresence('idle'); scheduleBlink(); tryWelcome(); } });
    document.addEventListener('pjax:send', () => { stopAudio(); pauseCharacter(); });
    document.addEventListener('pjax:complete', () => { if (!root.isConnected) document.body.append(root); scheduleBlink(); });
    window.addEventListener('pagehide', () => { stopAudio(); pauseCharacter(); audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); });
    window.addEventListener('pageshow', () => { setPresence(root.classList.contains('cp-playing') ? 'speaking' : busy ? 'thinking' : 'idle'); scheduleBlink(); });
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      clearTimeout(blinkTimer); clearTimeout(gestureTimer); blinkStep = 0; root.dataset.gesture = ''; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
      if (!reducedMotion()) scheduleBlink();
    });
    const connect = node('link'); connect.rel = 'preconnect'; connect.href = apiBase; document.head.append(connect);
    ensureHealth().catch(() => {}); startWelcome();
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
