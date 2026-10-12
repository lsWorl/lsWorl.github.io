/* Homepage movement and a real softmax sampling preview. */
(() => {
  'use strict';
  window.initHomeMotion = () => {
    const home = document.querySelector('.lab-home');
    if (!home || !home.querySelector('[data-home-preview]')) return () => {};
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const cleanups = [];
    let disposed = false;
    const listen = (target, type, handler, options) => {
      target.addEventListener(type, handler, options);
      cleanups.push(() => target.removeEventListener(type, handler, options));
    };
    const ambient = document.createElement('div');
    ambient.className = 'home-ambient'; ambient.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 9; index++) {
      const petal = document.createElement('span'); petal.className = 'home-petal';
      petal.style.setProperty('--petal-left', (index * 12.7 + 3) % 100 + '%');
      petal.style.setProperty('--petal-duration', 23 + index % 5 * 3 + 's');
      petal.style.setProperty('--petal-delay', -index * 4.3 + 's');
      ambient.append(petal);
    }
    const progress = document.createElement('div');
    progress.className = 'home-scroll-progress'; progress.setAttribute('aria-hidden', 'true');
    document.body.prepend(ambient, progress);
    cleanups.push(() => {ambient.remove(); progress.remove();});

    const art = home.querySelector('.lab-hero-art');
    let motionFrame = null, currentX = 0, currentY = 0, targetX = 0, targetY = 0, pointerY = 0;
    function move() {
      motionFrame = null;
      if (disposed || media.matches || document.hidden) return;
      currentX += (targetX - currentX) * .12;
      currentY += (targetY - currentY) * .12;
      art.style.setProperty('--art-x', currentX.toFixed(2) + 'px');
      art.style.setProperty('--art-y', currentY.toFixed(2) + 'px');
      if (Math.abs(currentX - targetX) + Math.abs(currentY - targetY) > .06) motionFrame = requestAnimationFrame(move);
    }
    const queueMotion = () => {if (motionFrame === null && !media.matches) motionFrame = requestAnimationFrame(move);};
    listen(art, 'pointermove', event => {
      if (event.pointerType !== 'mouse' || media.matches) return;
      const rect = art.getBoundingClientRect();
      targetX = (event.clientX - rect.left - rect.width / 2) / rect.width * 14;
      pointerY = (event.clientY - rect.top - rect.height / 2) / rect.height * 10;
      targetY = pointerY + Math.min(10, scrollY * .025); queueMotion();
    });
    listen(art, 'pointerleave', () => {targetX = 0; pointerY = 0; targetY = Math.min(10, scrollY * .025); queueMotion();});
    let scrollFrame = null;
    const updateScroll = () => {
      scrollFrame = null;
      const total = document.documentElement.scrollHeight - innerHeight;
      progress.style.transform = `scaleX(${total > 0 ? Math.min(1, scrollY / total) : 0})`;
      if (art.getBoundingClientRect().bottom > 0) {targetY = pointerY + Math.min(10, scrollY * .025); queueMotion();}
    };
    listen(window, 'scroll', () => {if (scrollFrame === null) scrollFrame = requestAnimationFrame(updateScroll);}, {passive: true});
    updateScroll();
    for (const card of home.querySelectorAll('.lab-track-card, .lab-post-card')) {
      listen(card, 'pointermove', event => {
        if (event.pointerType !== 'mouse' || media.matches) return;
        const rect = card.getBoundingClientRect();
        card.style.setProperty('--pointer-x', event.clientX - rect.left + 'px');
        card.style.setProperty('--pointer-y', event.clientY - rect.top + 'px');
        card.classList.add('is-pointer-active');
      });
      listen(card, 'pointerleave', () => card.classList.remove('is-pointer-active'));
    }

    const preview = home.querySelector('[data-home-preview]');
    const words = ['好', '冷', '热'], logits = [2.2, 1.3, 1.1];
    const temperature = preview.querySelector('[data-home-temperature]');
    const toggle = preview.querySelector('[data-home-preview-toggle]');
    const output = preview.querySelector('[data-home-word]');
    let probabilities = [], timer = null, enabled = !media.matches, visible = true;
    function distribution() {
      probabilities = window.LabMath.softmax(logits, Number(temperature.value));
      preview.querySelector('output').textContent = Number(temperature.value).toFixed(1);
      probabilities.forEach((probability, index) => {
        preview.querySelector(`[data-home-probability="${index}"]`).textContent = (probability * 100).toFixed(0) + '%';
        preview.querySelector(`[data-home-bar="${index}"]`).style.width = probability * 100 + '%';
      });
    }
    function sample() {
      const draw = Math.random(); let sum = 0, picked = probabilities.length - 1;
      for (let index = 0; index < probabilities.length; index++) {sum += probabilities[index]; if (draw < sum) {picked = index; break;}}
      output.textContent = words[picked]; output.classList.remove('is-changing');
      // Removing/readding after a frame restarts the small word transition.
      requestAnimationFrame(() => {if (!disposed) output.classList.add('is-changing');});
      preview.querySelectorAll('[data-home-candidate]').forEach((node, index) => node.classList.toggle('is-picked', index === picked));
    }
    function playback() {
      if (timer !== null) clearInterval(timer); timer = null;
      toggle.textContent = enabled ? '暂停' : '自动播放';
      toggle.hidden = media.matches;
      toggle.setAttribute('aria-label', enabled ? '暂停首页自动采样' : '开始首页自动采样');
      toggle.setAttribute('aria-pressed', String(enabled));
      if (enabled && visible && !document.hidden && !media.matches) timer = setInterval(sample, 2400);
    }
    listen(toggle, 'click', () => {enabled = !enabled; playback();});
    listen(preview.querySelector('[data-home-preview-step]'), 'click', sample);
    listen(temperature, 'input', () => {distribution(); sample();});
    listen(document, 'visibilitychange', () => {document.body.classList.toggle('home-motion-paused', document.hidden); playback();});
    listen(media, 'change', () => {
      if (media.matches) {enabled = false; targetX = targetY = currentX = currentY = 0; art.style.setProperty('--art-x', '0px'); art.style.setProperty('--art-y', '0px');}
      playback();
    });
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {visible = entries[0].isIntersecting; playback();}, {threshold: .05});
      observer.observe(preview); cleanups.push(() => observer.disconnect());
    }
    distribution(); sample(); playback();
    return () => {
      disposed = true;
      cleanups.forEach(cleanup => cleanup());
      clearInterval(timer); cancelAnimationFrame(motionFrame); cancelAnimationFrame(scrollFrame);
      document.body.classList.remove('home-motion-paused');
    };
  };
})();
