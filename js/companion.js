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
  let animationFrame = null, blinkTimer = null, blinkFrame = null, blinkStep = 0, mouth = 0, sessionPromise = null, playbackTicket = 0;
  let narration = null, samples = null, smoothedEnergy = 0, lastTick = 0, lastMotionTick = 0, mouthTarget = 0, lastMouthSample = 0, renderedFrame = '';
  let lookFrame = null, lookTimer = null, lookPoint = null;
  const portraitLayers = [];
  let healthPromise = null, healthCheckedAt = 0, welcomePending = false, welcomeStarting = false, welcomeBubble = null, welcomeTimer = null;
  const welcomeKey = 'lsworld.klee.welcomed.v1';
  const audioCache = new Map();
  let pcmPlayback = null;
  let expression = 'neutral', reactionTimer = null, gestureTimer = null;
  const articleKey = 'lsworld.klee.articles.v1';
  let articleVisit = null, articleTimer = null, articleBubble = null, articleBubbleTimer = null;
  let articleManifestPromise = null, articleHistory = {}, welcomedThisPage = false;
  let selectionBox, readingList, readingSelection = '', readingSelectionPath = '';
  let studyBox, currentStudy = null;
  let labVoiceRun = null, labManifestPromise = null, labBubble = null;
  const completedActions = new Set();
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
    if (['laugh','wink'].includes(value)) stopBlink();
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
  // Blend complete poses, never interpolate atlas coordinates (which would slide
  // neighbouring cells through the face). The body stays on the original frame.
  function blendPose(base, next, frames, position, transient = false) {
    const lower = Math.floor(position), upper = Math.min(lower + 1, frames.length - 1), mix = position - lower;
    const resting = position < .001 || transient && position >= frames.length - 1;
    base.hidden = resting || transient && lower === 0;
    next.hidden = resting || mix < .001 || transient && upper === frames.length - 1;
    const basePosition = framePosition(frames[lower]), nextPosition = framePosition(frames[upper]);
    if (base.style.backgroundPosition !== basePosition) base.style.backgroundPosition = basePosition;
    if (next.style.backgroundPosition !== nextPosition) next.style.backgroundPosition = nextPosition;
    base.style.opacity = transient && upper === frames.length - 1 ? (1 - mix).toFixed(3) : '1';
    next.style.opacity = mix.toFixed(3);
  }
  const setFrame = () => {
    if (!root) return;
    const key = `${mouth.toFixed(3)}:${blinkStep.toFixed(3)}`; if (key === renderedFrame) return; renderedFrame = key;
    root.style.setProperty('--cp-speech-lift', `${(-Math.min(1, mouth / 4) * .65).toFixed(2)}px`);
    portraitLayers.forEach(({lips, lipsNext, eyes, eyesNext}) => {
      blendPose(lips, lipsNext, sprite().mouthFrames, mouth);
      blendPose(eyes, eyesNext, sprite().blinkFrames, blinkStep, true);
    });
  };
  function resetLook() {
    cancelAnimationFrame(lookFrame); clearTimeout(lookTimer); lookFrame = null; lookPoint = null;
    for (const name of ['x','y','pitch','yaw','roll','eye-x','eye-y']) root?.style.removeProperty('--cp-look-' + name);
  }
  function lookAtPointer(event) {
    if (event.pointerType !== 'mouse' || document.hidden || reducedMotion()) return;
    lookPoint = {x:event.clientX,y:event.clientY};
    if (lookFrame !== null) return;
    lookFrame = requestAnimationFrame(() => {
      lookFrame = null;
      if (!lookPoint || document.hidden || reducedMotion()) return;
      const bounds = root.querySelector(opened ? '.cp-intro .cp-avatar-wrap' : '.cp-launcher .cp-avatar-wrap').getBoundingClientRect();
      const clamp = value => Math.max(-1, Math.min(1, value));
      const x = clamp((lookPoint.x - bounds.x - bounds.width / 2) / Math.max(240, innerWidth * .6));
      const y = clamp((lookPoint.y - bounds.y - bounds.height / 2) / Math.max(240, innerHeight * .6));
      for (const [name,value,unit] of [['x',x*1.1,'px'],['y',y*.65,'px'],['pitch',-y*5,'deg'],['yaw',x*10,'deg'],['roll',x*2,'deg'],['eye-x',x*.4,'px'],['eye-y',y*.2,'px']]) {
        root.style.setProperty('--cp-look-' + name, value.toFixed(3) + unit);
      }
      clearTimeout(lookTimer); lookTimer = setTimeout(resetLook, 1800);
    });
  }
  function stopBlink() {
    clearTimeout(blinkTimer); cancelAnimationFrame(blinkFrame); blinkFrame = null; blinkStep = 0; setFrame();
  }
  const scheduleBlink = () => {
    stopBlink();
    if (document.hidden || reducedMotion() || ['laugh','wink'].includes(expression)) return;
    blinkTimer = setTimeout(() => {
      const start = performance.now(), middle = Math.floor((sprite().blinkFrames.length - 1) / 2);
      const ease = value => value * value * (3 - 2 * value);
      const blink = time => {
        if (document.hidden || reducedMotion() || ['laugh','wink'].includes(expression)) { stopBlink(); return; }
        const elapsed = time - start;
        if (elapsed >= 320) { scheduleBlink(); return; }
        // Fast closure, a brief closed pause, then a gentler opening.
        blinkStep = elapsed < 95 ? middle * ease(elapsed / 95) : elapsed < 130 ? middle
          : middle + (sprite().blinkFrames.length - 1 - middle) * ease((elapsed - 130) / 190);
        setFrame(); blinkFrame = requestAnimationFrame(blink);
      };
      blinkFrame = requestAnimationFrame(blink);
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
    root?.querySelectorAll('[data-study-prompt]').forEach(button => { button.disabled = send.disabled || service?.study === false; });
    if (exhausted && !busy && !narration) state('可莉要休息一会儿啦。');
  }
  async function request(path, method = 'GET', data, authenticated = true, raw = false) {
    if (!apiBase) throw new Error('助手正在准备连接，稍后再来找我吧。');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), path.startsWith('/respond') ? 195000 : 60000);
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
    resetLook();
    if (value && labVoiceRun) stopAudio();
    if (value) cancelArticle();
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
        if (Object.hasOwn(result, 'study') && !busy) renderStudy(result.study);
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
  function readingContext() {
    if (!config.reading?.enabled || service?.reading === false || !document.querySelector('#post #article-container')) return null;
    let anchor = '';
    try { anchor = decodeURIComponent(location.hash.slice(1)); } catch (_) {}
    if (!anchor) {
      for (const heading of document.querySelectorAll('#article-container h1[id],#article-container h2[id],#article-container h3[id],#article-container h4[id]')) {
        if (heading.getBoundingClientRect().top <= 160) anchor = heading.id;
      }
    }
    return {path: location.pathname, anchor,
      selection: readingSelectionPath === location.pathname ? readingSelection : ''};
  }
  function updateSelection() {
    if (!selectionBox) return;
    const text = readingSelectionPath === location.pathname ? readingSelection : '';
    selectionBox.hidden = !text || !readingList.hidden;
    selectionBox.querySelector('span').textContent = text ? '一起看这段：' + [...text].slice(0, 40).join('') + ([...text].length > 40 ? '…' : '') : '';
  }
  function captureSelection() {
    const article = document.querySelector('#post #article-container'), selection = window.getSelection();
    if (!article || !selection?.rangeCount || selection.isCollapsed
      || !article.contains(selection.anchorNode) || !article.contains(selection.focusNode)) return;
    readingSelection = [...selection.toString().trim()].slice(0, 800).join('');
    readingSelectionPath = location.pathname; updateSelection();
  }
  function articleHref(value) {
    try {
      const url = new URL(value);
      if (url.origin !== (config.reading?.siteOrigin || location.origin) || !['https:','http:'].includes(url.protocol)) return null;
      // Keep navigation on the current deployment, including Pages previews.
      return url.pathname + url.search + url.hash;
    } catch (_) { return null; }
  }
  function applyReadingActions(view) {
    if (!view?.canAct || !opened || document.hidden || messageList.hidden || !view.item.isConnected || completedActions.has(view.message.id)) return;
    const action = view.message.actions?.find(action => action.type === 'open_article');
    const href = action && articleHref(action.url);
    if (!href) return;
    const key = 'lsworld.klee.action.' + view.message.id;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, 'done'); } catch (_) {}
    completedActions.add(view.message.id); view.canAct = false;
    location.assign(href);
  }
  function completePlayback() {
    if (labVoiceRun && narration?.lab) {
      if (!audio?.ended) return;
      const completed = labVoiceRun; labVoiceRun = null;
      stopAudio(); state('这一部分讲完啦，试试习题吧！'); completed.callbacks.onEnded?.(); return;
    }
    const view = pcmPlayback?.view || narration?.view;
    stopAudio(); state('嘟嘟可也在听。'); applyReadingActions(view);
  }
  function showChat() {
    readingList.hidden = true; messageList.hidden = false; form.hidden = false; updateSelection(); renderStudy(currentStudy); textarea.focus();
  }
  async function showReadLater() {
    stopAudio(); readingList.replaceChildren(); readingList.hidden = false; messageList.hidden = true; form.hidden = true; updateSelection();
    if (studyBox) studyBox.hidden = true;
    root.querySelector('.cp-options').open = false;
    const header = node('div', 'cp-reading-header');
    header.append(node('strong', '', '稍后阅读'), button('返回聊天', '', showChat)); readingList.append(header);
    const loading = node('p', '', '可莉找找小本子…'); readingList.append(loading);
    try {
      await ensureSession(); const result = await request('/bookmarks'); loading.remove();
      if (!result.articles.length) readingList.append(node('p', '', '还没有记下文章呢。看到喜欢的，可以让可莉收藏起来！'));
      for (const article of result.articles) {
        const href = articleHref(article.url); if (!href) continue;
        const row = node('div', 'cp-reading-item'), link = node('a', '', article.title); link.href = href;
        const remove = button('移除', '', async () => {
          remove.disabled = true;
          try { await request('/bookmarks/' + encodeURIComponent(article.id), 'DELETE'); row.remove(); }
          catch (error) { report(error.message); remove.disabled = false; }
        });
        remove.setAttribute('aria-label', '移除收藏：' + article.title); row.append(link, remove); readingList.append(row);
      }
    } catch (error) { loading.textContent = error.message; }
  }
  function studyPrompt(text) {
    if (busy || send.disabled) return;
    root.querySelector('.cp-options').open = false; showChat(); textarea.value = text; form.requestSubmit();
  }
  function renderStudy(value) {
    if (!studyBox) return;
    currentStudy = value && Array.isArray(value.steps) && value.steps.length > 0 && value.steps.length <= 5
      && value.steps[value.currentStep] && articleHref(value.article?.url) ? value : null;
    const expanded = studyBox.querySelector('details')?.open || false;
    studyBox.replaceChildren(); studyBox.hidden = !currentStudy || !readingList.hidden;
    if (!currentStudy) return;
    const study = currentStudy, details = node('details'), summary = node('summary', '', study.status === 'completed' ? '好耶，这篇学完啦！'
      : (study.status === 'paused' ? '下次接着学' : '一起学') + ' · 第 ' + (study.currentStep + 1) + '/' + study.steps.length + ' 步');
    details.open = expanded;
    const article = node('a', 'cp-study-article', study.article.title); article.href = articleHref(study.article.url);
    const list = node('ol', 'cp-study-steps');
    study.steps.forEach((step, index) => {
      const item = node('li', '', step.title);
      if (index === study.currentStep) item.setAttribute('aria-current', 'step');
      list.append(item);
    });
    details.append(summary, article, node('span', 'cp-study-time', '约 ' + study.minutes + ' 分钟'), list);
    const current = node('p', 'cp-study-current', study.steps[study.currentStep].title), controls = node('div', 'cp-study-controls');
    const action = (label, prompt) => { const control = button(label, '', () => studyPrompt(prompt)); control.dataset.studyPrompt = prompt; return control; };
    if (study.status === 'paused') controls.append(action('接着学', '继续上次学习'));
    else if (study.status === 'completed') controls.append(action('再学一遍', '从头学上次那篇文章'));
    else controls.append(action('换个说法', '没听懂，换个说法'), action('懂了，下一步', '懂了，下一步'));
    studyBox.append(details, current, controls); updateSend();
  }
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
          const label = source.title + (source.heading && source.heading !== '正文' ? ' · ' + source.heading : '');
          const link = node('a', '', '↗ ' + label); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; links.append(link);
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
    captureSelection(); const reading = readingContext();
    cancelWelcome(); busy = true; send.disabled = true; textarea.disabled = true; stopAudio(); const ticket = playbackTicket; state('唔，让可莉想想…');
    clearTimeout(reactionTimer); setPresence('thinking'); setExpression('thinking');
    primeAudio();
    let view = null;
    try {
      await ensureSession(); addMessage({role: 'user', text}); textarea.value = '';
      view = addMessage({role: 'assistant', text: ''}, true);
      view.mood = expressionFor(text, 'happy');
      const result = await request('/respond-stream', 'POST', {text, requestId: crypto.randomUUID(), autoSpeak: true, ...(reading ? {reading} : {})}, true, data => receiveStream(data, view, ticket));
      view.message = result; view.characters = [...result.text]; updateLimits(result.limits);
      readingSelection = ''; updateSelection();
      if (result.demo) report('本地演示：没有调用真实聊天模型。');
      if (!pcmPlayback || ticket !== playbackTicket) {
        finishReply(view); state('嘟嘟可也在听。');
        if (ticket === playbackTicket && opened) { setPresence('idle'); setExpression(expressionFor(result.text, view.mood)); settleCharacter(); }
      }
    } catch (error) {
      if (view?.characters.length) {
        view.canAct = false;
        // A broken transport must not discard audio already buffered for this
        // reply. Explicit Stop / close / a new turn still cancel immediately.
        if (pcmPlayback?.view === view) { flushPCM(pcmPlayback); pcmPlayback.finished = true; }
        finishReply(view);
      }
      else { view?.item.remove(); textarea.value = text; }
      report(error.message); state('再说一次好不好？');
      setPresence('idle'); setExpression('care'); settleCharacter();
    }
    finally { busy = false; updateSend(); textarea.disabled = false; textarea.focus(); }
  }
  function stopAudio() {
    const interruptedLab = labVoiceRun; labVoiceRun = null;
    if (labBubble) labBubble.hidden = true;
    playbackTicket++;
    if (pcmPlayback) { for (const source of pcmPlayback.sources) { try { source.stop(); } catch (_) {} } pcmPlayback = null; }
    if (narration?.welcome && welcomeBubble) { clearTimeout(welcomeTimer); welcomeTimer = setTimeout(() => { welcomeBubble.hidden = true; }, 1200); }
    if (narration?.article && articleBubble) {
      articleBubble.querySelector('p').textContent = narration.article.text;
      clearTimeout(articleBubbleTimer); articleBubbleTimer = setTimeout(() => { articleBubble.hidden = true; }, 3500);
    }
    finishReply(); narration = null;
    if (audio) { audio.pause(); audio.currentTime = 0; }
    if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null;
    mouth = 0; mouthTarget = 0; smoothedEnergy = 0; lastTick = 0; lastMotionTick = 0; lastMouthSample = 0;
    if (root) { root.classList.remove('cp-playing'); root.querySelector('.cp-stop').hidden = true; setFrame(); }
    if (root) {
      setPresence(busy ? 'thinking' : 'idle');
      if (busy) setExpression('thinking'); else { if (expression === 'laugh' || expression === 'wink') setExpression('happy'); settleCharacter(); }
    }
    interruptedLab?.callbacks.onCancel?.();
  }
  function failLabVoice(error) {
    const failed = labVoiceRun; labVoiceRun = null; stopAudio(); failed?.callbacks.onError?.(error);
  }
  async function playLabVoice(id, callbacks) {
    if (busy) { callbacks.onError?.(new Error('可莉正在回答聊天，请等回答结束后再开始讲解。')); return; }
    if (opened) setOpen(false);
    cancelWelcome(); cancelArticle(); stopAudio(); primeAudio();
    const run = {id, callbacks, owner: callbacks.owner}; labVoiceRun = run;
    try {
      if (!/^\w+-\d+$/.test(id)) throw new Error('无法找到这一节的讲解。');
      if (!labManifestPromise) labManifestPromise = fetch('/lab-narration.json', {cache: 'no-cache'})
        .then(response => { if (!response.ok) throw new Error('讲解音频暂时无法加载，请重试。'); return response.json(); })
        .catch(error => { labManifestPromise = null; throw error; });
      const manifest = await labManifestPromise;
      if (labVoiceRun !== run) return;
      const line = manifest.lines[id], [type, position] = id.split('-');
      if (!line || line.text !== window.LabCurriculum?.[type]?.[Number(position)]?.text || !/^\/audio\/lab\/[a-z0-9-]+\.wav$/.test(line.audio)) throw new Error('这一节的可莉语音尚未准备好，请重试或阅读后答题。');
      if (document.hidden || !/^\/lab\//.test(location.pathname)) { stopAudio(); return; }
      audio.src = new URL(line.audio, location.origin).href; applyAudioSettings();
      narration = {lab: line}; root.classList.add('cp-playing'); root.querySelector('.cp-stop').hidden = false;
      labBubble.querySelector('p').textContent = [...line.text][0]; labBubble.setAttribute('aria-label', line.text); labBubble.hidden = false;
      clearTimeout(reactionTimer); setPresence('speaking'); setExpression('happy'); gesture('nod');
      await audio.play();
      if (labVoiceRun !== run) return;
      callbacks.onStart?.(line); if (!animationFrame) animatePlayback();
    } catch (error) { if (labVoiceRun === run) failLabVoice(error); }
  }
  function animatePlayback(time = 0) {
    if (document.hidden || (!pcmPlayback && (!audio || audio.paused))) return;
    animationFrame = requestAnimationFrame(animatePlayback);
    const delta = lastMotionTick ? Math.min(64, Math.max(0, time - lastMotionTick)) : 1000 / 60;
    lastMotionTick = time;
    // Text and playback bookkeeping need only 20 Hz; facial movement follows
    // every display frame, with elapsed-time smoothing on 30/60/120 Hz screens.
    if (!lastTick || time - lastTick >= 50) {
      lastTick = time;
      if (pcmPlayback) {
        const playing = pcmPlayback, clock = audioContext.currentTime; let played = 0;
        for (const span of playing.spans) { if (clock < span.time) break; played = span.offset + Math.min(span.duration, clock - span.time); }
        for (const sentence of playing.sentences.values()) {
          if (sentence.words.length && played * 1000 >= sentence.words[0].begin_time && playing.activeSentence !== sentence && played * 1000 <= (sentence.endTime ?? Infinity)) {
            playing.activeSentence = sentence; setExpression(expressionFor(sentence.text, playing.view.mood));
          }
        }
        // Web Audio's source-ended event uses the rendering clock. Leave the
        // output device's queued tail time to drain before navigation/cleanup.
        const outputDelay = (audioContext.baseLatency || 0) + (audioContext.outputLatency || 0) + .04;
        if (playing.finished && !playing.sources.size && !playing.pending.length && clock >= playing.nextTime + outputDelay) { completePlayback(); return; }
      } else if (narration?.view && Number.isFinite(audio.duration) && audio.duration > 0) {
        // Use the media clock, so buffering and slower devices cannot race ahead.
        const progress = Math.min(1, audio.currentTime / audio.duration);
        revealReply(narration.view, Math.max(1, Math.ceil(narration.view.characters.length * progress)));
      } else if (narration?.lab && Number.isFinite(audio.duration) && audio.duration > 0) {
        const characters = [...narration.lab.text];
        const subtitle = characters.slice(0, Math.max(1, Math.ceil(characters.length * audio.currentTime / audio.duration))).join('');
        labBubble.querySelector('p').textContent = subtitle; labVoiceRun?.callbacks.onProgress?.(subtitle);
      } else if (narration?.article && Number.isFinite(audio.duration) && audio.duration > 0) {
        const characters = [...narration.article.text];
        articleBubble.querySelector('p').textContent = characters.slice(0, Math.max(1, Math.ceil(characters.length * audio.currentTime / audio.duration))).join('');
      }
    }
    if (reducedMotion()) { mouth = 0; mouthTarget = 0; smoothedEnergy = 0; lastMouthSample = 0; setFrame(); return; }
    let rms = 0;
    if (analyser && samples && audioContext?.state === 'running') {
      analyser.getFloatTimeDomainData(samples);
      let energy = 0; for (const value of samples) energy += value * value;
      rms = Math.sqrt(energy / samples.length);
    } else {
      const cached = narration?.welcome ? config.welcome : narration?.article || narration?.lab;
      if (cached?.envelope) {
        const offset = audio.currentTime / (cached.step || .05), index = Math.floor(offset), mix = offset - index;
        rms = (cached.envelope[index] || 0) * (1 - mix) + (cached.envelope[index + 1] || 0) * mix;
      }
    }
    // Display refresh is not articulation speed. Hold the speech target for
    // 110 ms, damp phoneme peaks and reserve the largest poses for expressions.
    smoothedEnergy += (rms - smoothedEnergy) * (1 - Math.exp(-delta / (rms > smoothedEnergy ? 70 : 110)));
    if (!lastMouthSample || time - lastMouthSample >= 110) {
      mouthTarget = Math.min(1, Math.max(0, (smoothedEnergy - .018) / .14)) * (sprite().mouthFrames.length - 1) * .62;
      lastMouthSample = time;
    }
    const change = (mouthTarget - mouth) * (1 - Math.exp(-delta / (mouthTarget > mouth ? 85 : 120)));
    mouth += Math.max(-delta * .018, Math.min(delta * .018, change));
    if (mouth < .008) mouth = 0;
    setFrame();
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
      if (pcmPlayback) return;
      if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; mouth = 0; mouthTarget = 0; smoothedEnergy = 0; lastMotionTick = 0; lastMouthSample = 0; setFrame();
    });
    audio.addEventListener('playing', () => {
      if (narration && (opened || narration.welcome || narration.article || narration.lab) && !document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; lastTick = 0; animatePlayback();
      }
    });
    audio.addEventListener('ended', () => { if (!pcmPlayback && root.classList.contains('cp-playing')) completePlayback(); });
    audio.addEventListener('error', () => { if (labVoiceRun && narration?.lab) { failLabVoice(new Error('这段音频没有加载成功，请重试或阅读后答题。')); return; } if (!pcmPlayback && root.classList.contains('cp-playing')) { const ambient = narration?.welcome || narration?.article; stopAudio(); if (!ambient) report('咦，声音没出来，旅行者先看看这句话吧。'); } });
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
    if (data.type === 'study') renderStudy(data.study);
    if (data.result && Object.hasOwn(data.result, 'study')) renderStudy(data.result.study);
    if (data.type === 'text') {
      view.hasTextStream = true; view.message.text = data.text; view.characters = [...data.text];
      revealReply(view, view.characters.length);
    }
    if (data.type === 'phrase' && !view.hasTextStream) {
      view.message.text = (view.message.text || '') + data.text; view.characters = [...view.message.text];
      revealReply(view, view.characters.length);
    }
    if (data.result) { view.message = data.result; view.characters = [...data.result.text]; updateLimits(data.result.limits); }
    if (data.type === 'text-end' || data.result) finishReply(view);
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
      view.canAct = data.type === 'done' && !data.replayed && !data.textOnly;
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
    welcomedThisPage = true; welcomePending = true; welcomeBubble.hidden = false;
    prepareAudio(); audio.src = new URL(config.welcome.audio, location.origin).href; audio.load();
    document.addEventListener('pointerdown', welcomeGesture); document.addEventListener('pointerup', welcomeGesture); document.addEventListener('keydown', welcomeGesture);
    tryWelcome();
  }
  function articlePath() {
    return location.pathname.replace(/\/index\.html$/, '/').replace(/\/?$/, '/');
  }
  function readArticleHistory() {
    try {
      const stored = JSON.parse(localStorage.getItem(articleKey) || '{}');
      if (stored && typeof stored === 'object' && !Array.isArray(stored)) articleHistory = stored;
    } catch (_) { /* Keep the in-memory cooldown if storage is unavailable. */ }
    const day = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    if (articleHistory.day !== day) articleHistory = {day, count: 0, paths: [], topics: [], lastAt: Number(articleHistory.lastAt) || 0};
    if (!Array.isArray(articleHistory.paths)) articleHistory.paths = [];
    if (!Array.isArray(articleHistory.topics)) articleHistory.topics = [];
    return articleHistory;
  }
  function canApproachArticle(visit) {
    if (articleVisit !== visit || visit.cancelled || visit.starting || document.hidden || opened || busy || narration || welcomePending || welcomeStarting) return false;
    if (document.querySelector('input:focus,textarea:focus,[contenteditable=true]:focus') || window.getSelection()?.toString()) return false;
    return ![...document.querySelectorAll('audio,video')].some(media => !media.paused && !media.ended && !media.muted && media.volume > 0);
  }
  function articleAvailable(visit) {
    const history = readArticleHistory(), policy = config.article;
    return (Number(history.count) || 0) < policy.dailyLimit
      && Date.now() - (Number(history.lastAt) || 0) >= policy.cooldownMs
      && !history.paths?.includes(visit.path) && !history.topics?.includes(visit.topic);
  }
  function cancelArticle() {
    clearTimeout(articleTimer); articleTimer = null;
    removeArticleUnlock();
    if (articleVisit) articleVisit.cancelled = true;
    if (narration?.article || articleVisit?.starting) stopAudio();
    clearTimeout(articleBubbleTimer); if (articleBubble) articleBubble.hidden = true;
  }
  function removeArticleUnlock() {
    for (const event of ['pointerup', 'touchend', 'keydown']) document.removeEventListener(event, unlockArticleAudio);
  }
  function unlockArticleAudio(event) {
    if (!event.isTrusted || !articleVisit || !canApproachArticle(articleVisit)) return;
    if (event.type === 'keydown' && (event.ctrlKey || event.altKey || event.metaKey)) return;
    removeArticleUnlock(); primeAudio();
  }
  async function approachArticle(visit, line) {
    const start = async () => {
      if (!canApproachArticle(visit) || !articleAvailable(visit) || articlePath() !== visit.path) return;
      // Reserve once before playback, including text-only autoplay fallback.
      const history = readArticleHistory();
      Object.assign(history, {count: (Number(history.count) || 0) + 1, lastAt: Date.now(),
        paths: [...(Array.isArray(history.paths) ? history.paths : []), visit.path],
        topics: [...(Array.isArray(history.topics) ? history.topics : []), visit.topic]});
      try { localStorage.setItem(articleKey, JSON.stringify(history)); } catch (_) {}
      visit.starting = true; const ticket = playbackTicket;
      articleBubble.setAttribute('aria-label', line.text);
      prepareAudio(); audio.src = new URL(line.audio, location.origin).href; applyAudioSettings();
      audioContext?.resume().catch(() => {});
      try {
        await audio.play();
        if (articleVisit !== visit || visit.cancelled || ticket !== playbackTicket || document.hidden || opened || busy) { audio.pause(); return; }
        narration = {article: line}; root.classList.add('cp-playing');
        articleBubble.querySelector('p').textContent = [...line.text][0]; articleBubble.hidden = false;
        clearTimeout(reactionTimer); setPresence('speaking'); setExpression(line.mood || 'happy'); gesture('nod'); animatePlayback();
      } catch (error) {
        if (articleVisit !== visit || visit.cancelled || ticket !== playbackTicket || document.hidden || opened || busy) return;
        // Browsers may block unsolicited audio. Show the one short line without a later surprise replay.
        if (error.name === 'NotAllowedError') {
          articleBubble.querySelector('p').textContent = line.text; articleBubble.hidden = false;
          setExpression(line.mood || 'happy'); gesture('nod'); settleCharacter();
          articleBubbleTimer = setTimeout(() => { articleBubble.hidden = true; }, 9000);
        }
      } finally { visit.starting = false; }
    };
    // Two open tabs share a cooldown; serialize the check and reservation when supported.
    try { if (navigator.locks) await navigator.locks.request(articleKey, start); else await start(); } catch (_) {}
  }
  async function startArticle() {
    cancelArticle();
    const policy = config.article;
    if (!policy?.enabled || welcomedThisPage || document.hidden || opened || !document.querySelector('#post #article-container')) return;
    const visit = {path: articlePath(), entered: performance.now(), cancelled: false}; articleVisit = visit;
    if (!articleManifestPromise) articleManifestPromise = fetch(policy.manifest, {cache: 'no-cache'})
      .then(response => { if (!response.ok) throw new Error('Unavailable article lines'); return response.json(); })
      .catch(() => { articleManifestPromise = null; return null; });
    const manifest = await articleManifestPromise;
    if (!manifest || articleVisit !== visit || visit.cancelled) return;
    visit.topic = manifest.articles[visit.path]; const line = manifest.lines[visit.topic];
    if (!line?.audio || !articleAvailable(visit) || Math.random() >= policy.probability) return;
    for (const event of ['pointerup', 'touchend', 'keydown']) document.addEventListener(event, unlockArticleAudio, {passive: true});
    articleTimer = setTimeout(() => { articleTimer = null; removeArticleUnlock(); approachArticle(visit, line); }, Math.max(0, policy.delayMs - (performance.now() - visit.entered)));
  }
  function build() {
    root = node('aside', 'companion'); root.setAttribute('aria-label', config.name + '陪伴助手'); root.dataset.presence = 'idle';
    const avatar = (interactive = false) => {
      const wrap = interactive ? button('', 'cp-avatar-wrap cp-character', greetCharacter) : node('div', 'cp-avatar-wrap');
      if (interactive) wrap.setAttribute('aria-label', '和可莉打个招呼');
      const el = node('div', 'cp-avatar'); el.setAttribute('aria-hidden', 'true'); el.style.setProperty('--cp-atlas-image', 'url(' + JSON.stringify(new URL(config.avatar, location.origin).href) + ')');
      const atlas = sprite(); el.style.backgroundSize = `${atlas.columns * 100}% ${atlas.rows * 100}%`;
      // Lightweight layered portrait, not a Cubism model: the head and its
      // facial overlays move together above the stationary shoulders.
      const body = node('span', 'cp-body'), pivot = node('span', 'cp-head-sway'), head = node('span', 'cp-head');
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
          layer.append(eyes, lips); head.append(layer);
        }
      }
      const lips = node('span', 'cp-mouth'), lipsNext = node('span', 'cp-mouth-next'), eyes = node('span', 'cp-eyes'), eyesNext = node('span', 'cp-eyes-next');
      for (const layer of [lips, lipsNext, eyes, eyesNext]) {
        layer.hidden = true; layer.setAttribute('aria-hidden', 'true');
        const isMouth = layer === lips || layer === lipsNext, center = isMouth ? atlas.mouthCenter : atlas.eyeCenter;
        layer.style.maskImage = `radial-gradient(ellipse ${isMouth ? '8% 6%' : '23% 9%'} at ${center[0]}% ${center[1]}%, #000 78%, transparent 100%)`;
      }
      portraitLayers.push({lips, lipsNext, eyes, eyesNext});
      head.append(lips, lipsNext, eyes, eyesNext); pivot.append(head); el.append(body, pivot);
      const breath = node('span', 'cp-breath'); breath.append(el); wrap.append(breath); return wrap;
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
    if (config.reading?.enabled) {
      const start = button('一起学这篇', '', () => {
        if (!readingContext()) { report('先打开想学的文章，再一起读吧！'); return; }
        studyPrompt('带我用十五分钟一步步学懂这篇文章');
      });
      start.dataset.studyPrompt = 'start';
      const resume = button('接着上次学', '', () => studyPrompt('继续上次学习')); resume.dataset.studyPrompt = 'resume';
      const pause = button('先休息一下', '', () => studyPrompt('暂停学习')); pause.dataset.studyPrompt = 'pause';
      dataButtons.append(start, resume, pause);
    }
    if (config.reading?.enabled) dataButtons.append(button('稍后阅读', '', showReadLater), button('收藏这篇文章', '', async () => {
      const reading = readingContext();
      if (!reading) { report('先打开一篇文章，再一起收藏吧。'); return; }
      try { await ensureSession(); await request('/bookmarks', 'POST', {reading: {path: reading.path}}); report('好耶，可莉记到稍后阅读里啦！'); }
      catch (error) { report(error.message); }
      root.querySelector('.cp-options').open = false;
    }));
    dataButtons.append(button('导出我的数据', '', async () => {
      try { await ensureSession(); const data = await request('/export'); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'}));
        const a = node('a'); a.href = url; a.download = 'companion-memory.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      } catch (error) { report(error.message); }
    }), button('清空对话', '', async () => {
      if (!window.confirm('清空聊天、记忆、学习进度和稍后阅读，重新开始吗？')) return;
      try { await ensureSession(); const result = await request('/reset', 'DELETE'); messageList.replaceChildren(); welcome();
        audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); stopAudio(); readingSelection = ''; readingList.replaceChildren(); renderStudy(null); showChat(); updateLimits(result.limits); report('好耶，我们重新开始吧！');
      } catch (error) { report(error.message); }
    }));
    notice = node('p', 'cp-notice'); notice.hidden = true; notice.setAttribute('role', 'status');
    form = node('form', 'cp-form'); textarea = node('textarea'); textarea.maxLength = 1200; textarea.rows = 2; textarea.placeholder = '想和可莉说什么？'; textarea.setAttribute('aria-label', '聊天消息');
    readingList = node('section', 'cp-reading-list'); readingList.hidden = true; readingList.setAttribute('aria-label', '稍后阅读');
    studyBox = node('section', 'cp-study'); studyBox.hidden = true; studyBox.setAttribute('aria-label', '一起学习');
    selectionBox = node('div', 'cp-selection'); selectionBox.hidden = true;
    const clearSelection = button('×', '', () => { readingSelection = ''; updateSelection(); }); clearSelection.setAttribute('aria-label', '取消选中内容');
    selectionBox.append(node('span'), clearSelection);
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
    articleBubble = node('div', 'cp-article'); articleBubble.hidden = true; articleBubble.setAttribute('role', 'status'); articleBubble.setAttribute('aria-live', 'polite');
    const dismissArticle = button('×', 'cp-article-close', cancelArticle); dismissArticle.setAttribute('aria-label', '停止搭话');
    const articleText = node('p'); articleText.setAttribute('aria-hidden', 'true'); articleBubble.append(articleText, dismissArticle);
    labBubble = node('div', 'cp-lab'); labBubble.hidden = true; labBubble.setAttribute('role', 'status');
    const labText = node('p'); labText.setAttribute('aria-hidden', 'true');
    const dismissLab = button('×', 'cp-article-close', stopAudio); dismissLab.setAttribute('aria-label', '暂停算法讲解'); labBubble.append(labText, dismissLab);
    panel.append(header, intro, studyBox, messageList, readingList, selectionBox, notice, form); root.append(welcomeBubble, articleBubble, labBubble, launcher, panel); document.body.append(root);
    window.KleeLabVoice = {play: playLabVoice, stop: owner => { if (labVoiceRun?.owner === owner) stopAudio(); }};
    document.addEventListener('selectionchange', captureSelection);
    welcome(); updateLimits(); setExpression('neutral'); scheduleBlink();
    document.addEventListener('pointermove', lookAtPointer, {passive:true});
    document.documentElement.addEventListener('pointerleave', resetLook);
    window.addEventListener('blur', resetLook);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (opened) setOpen(false); else cancelArticle(); } });
    const pauseCharacter = () => {
      clearTimeout(reactionTimer); clearTimeout(gestureTimer); stopBlink(); resetLook();
      root.dataset.gesture = ''; setPresence(document.hidden ? 'hidden' : 'idle'); setExpression('neutral'); blinkStep = 0; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelArticle(); stopAudio(); pauseCharacter(); } else { setPresence('idle'); scheduleBlink(); tryWelcome(); } });
    document.addEventListener('pjax:send', () => { cancelArticle(); stopAudio(); pauseCharacter(); readingSelection = ''; updateSelection(); });
    document.addEventListener('pjax:complete', () => { if (!root.isConnected) document.body.append(root); welcomedThisPage = false; scheduleBlink(); startArticle(); });
    window.addEventListener('pagehide', () => { cancelArticle(); stopAudio(); pauseCharacter(); audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); });
    window.addEventListener('pageshow', event => { setPresence(root.classList.contains('cp-playing') ? 'speaking' : busy ? 'thinking' : 'idle'); scheduleBlink(); if (event.persisted) startArticle(); });
    document.addEventListener('play', event => { if (event.target instanceof HTMLMediaElement && !event.target.muted && event.target.volume > 0) { cancelArticle(); if (event.target !== audio && labVoiceRun) stopAudio(); } }, true);
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      stopBlink(); resetLook(); clearTimeout(gestureTimer); mouth = 0; mouthTarget = 0; lastMouthSample = 0; root.dataset.gesture = ''; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
      if (!reducedMotion()) scheduleBlink();
    });
    const connect = node('link'); connect.rel = 'preconnect'; connect.href = apiBase; document.head.append(connect);
    ensureHealth().catch(() => {}); startWelcome(); startArticle();
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
