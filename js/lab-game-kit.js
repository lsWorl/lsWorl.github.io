/* Shared pieces of Klee's lab games (炸鱼, 下山, 清营地): drawing helpers, timers,
   saved stats, and Klee's host — speech bubble, expressions, banner and voice.
   Each game keeps only its own rules and pictures. */
(function (root) {
  'use strict';
  const SVG = 'http://www.w3.org/2000/svg';
  // One switch for every game's voice, kept under the fishing game's original key.
  const VOICE_KEY = 'lsworld.klee.fishing.voice';
  // Frames in the companion's expression sheet (4 × 4).
  const FACES = {neutral: 0, happy: 1, laugh: 2, curious: 3, thinking: 4, care: 5, proud: 6, wink: 7};

  // Browser storage can be missing or throw (private windows, blocked cookies).
  const store = {
    get(key) { try { return localStorage.getItem(key); } catch (_) { return null; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch (_) { /* Optional. */ } }
  };
  function svg(tag, attributes = {}, parent) {
    const node = document.createElementNS(SVG, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    parent?.append(node); return node;
  }
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Restart a CSS animation that is driven by a class.
  function restart(node, name) { node.classList.remove(name); void node.getBoundingClientRect(); node.classList.add(name); }
  const facePosition = mood => { const index = FACES[mood] ?? 0; return `${index % 4 / 3 * 100}% ${Math.floor(index / 4) / 3 * 100}%`; };

  // Timeouts that a new round or a skip can cancel together.
  function timers() {
    let pending = [];
    return {
      wait(callback, ms) { const id = setTimeout(() => { pending = pending.filter(x => x !== id); callback(); }, ms); pending.push(id); return id; },
      clear() { pending.forEach(clearTimeout); pending = []; },
      get size() { return pending.length; }
    };
  }
  // Saved counters, e.g. stats('lsworld.klee.hike.v1', {rounds: 0}); data is mutated in place.
  function stats(key, defaults, show) {
    const data = {...defaults};
    try { Object.assign(data, JSON.parse(store.get(key) || '{}')); } catch (_) { /* Start fresh. */ }
    return {data, save() { store.set(key, JSON.stringify(data)); show?.(data); }, show() { show?.(data); }};
  }

  // Every game shares one recordings manifest; fetch it once per page.
  const manifests = new Map();
  function manifest(url) {
    if (!url) return Promise.resolve({});
    if (!manifests.has(url)) {
      manifests.set(url, fetch(url, {cache: 'no-cache'}).then(response => response.ok ? response.json() : null)
        .then(data => data?.lines || {}).catch(() => ({})));
    }
    return manifests.get(url);
  }

  // Klee hosting a game. options:
  //   face, bubble, line, banner – the avatar, speech bubble, its text and the banner
  //   mirrors   – other avatars that copy the expression (e.g. Klee on the map)
  //   toggle    – the voice checkbox; manifest – recordings manifest URL
  //   talker    – (record) => node that moves its mouth (default: face)
  //   voiceAttr – dataset key set to the line now playing (for tests and styling)
  function host(panel, {face, bubble, line, banner, mirrors = [], toggle, manifest: url = panel.dataset.voiceManifest, talker, voiceAttr} = {}) {
    const sound = new Audio(), talkers = new Set([face]);
    let lines = {}, voiceOn = store.get(VOICE_KEY) !== 'off', speaking = null, queued = null, frame = 0;
    sound.preload = 'auto';
    manifest(url).then(data => { lines = data; });
    if (toggle) {
      toggle.checked = voiceOn;
      toggle.addEventListener('change', () => { voiceOn = toggle.checked; if (!voiceOn) stopVoice(); store.set(VOICE_KEY, voiceOn ? 'on' : 'off'); });
    }
    function quiet() {
      cancelAnimationFrame(frame);
      for (const node of talkers) { node.classList.remove('is-talking'); node.style.removeProperty('--talk'); }
    }
    function stopVoice() { queued = null; speaking = null; quiet(); if (!sound.paused) sound.pause(); }
    // minor: skip while someone is talking. queue: wait for the current line to end.
    function voice(id, {minor = false, queue = false} = {}) {
      const record = lines[id];
      if (!voiceOn || !record || document.hidden) return;
      const busy = speaking && !sound.paused && !sound.ended;
      if (busy && minor) return;
      if (busy && queue) { queued = id; return; }
      queued = null; quiet(); speaking = {id, record}; sound.src = record.audio;
      sound.play().then(() => {
        if (voiceAttr) panel.dataset[voiceAttr] = id;
        const target = talker?.(record) || face; talkers.add(target);
        const step = () => {
          if (!speaking || sound.paused || sound.ended) { quiet(); return; }
          const level = speaking.record.envelope?.[Math.floor(sound.currentTime / (speaking.record.step || .05))] || 0;
          target.style.setProperty('--talk', Math.min(1, level / .18).toFixed(2)); target.classList.add('is-talking');
          frame = requestAnimationFrame(step);
        };
        step();
      }).catch(() => { if (speaking?.id === id) speaking = null; });
    }
    sound.addEventListener('ended', () => { quiet(); speaking = null; if (queued) { const next = queued; queued = null; voice(next); } });

    function setFace(mood) {
      const position = facePosition(mood);
      face.style.backgroundPosition = position; face.dataset.mood = mood;
      for (const node of mirrors) node.style.backgroundPosition = position;
    }
    function say(text, mood) {
      if (line.textContent !== text) { line.textContent = text; restart(bubble, 'is-new'); }
      if (mood) setFace(mood);
    }
    function announce(text) { banner.textContent = text; restart(banner, 'is-shown'); }
    // The recording for a line, once the manifest has loaded (e.g. for subtitles).
    const recording = id => lines[id] || null;
    return {say, setFace, announce, voice, stopVoice, recording};
  }

  root.LabGameKit = {SVG, FACES, VOICE_KEY, store, svg, reduced, restart, timers, stats, manifest, host};
})(typeof window !== 'undefined' ? window : globalThis);
