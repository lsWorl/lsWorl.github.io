/* Browser-only enhancements. No account, backend or build-time dependency. */
(() => {
  'use strict';
  const progressKey = 'lsworld.reading.v1';
  let progress = {};
  let disposeExperiment = () => {};
  try {
    const stored = JSON.parse(localStorage.getItem(progressKey) || '{}');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) progress = stored;
  } catch (_) { /* Reading progress still works in memory if storage is unavailable. */ }

  const persist = () => {
    try { localStorage.setItem(progressKey, JSON.stringify(progress)); } catch (_) { /* Optional persistence. */ }
  };

  function updateProgress() {
    document.querySelectorAll('[data-home-track]').forEach(card => {
      const nodes = JSON.parse(card.dataset.homeNodes || '[]');
      const count = nodes.filter(slug => progress[slug] === true).length;
      card.querySelector('[data-home-track-count]').textContent = `${count} / ${nodes.length}`;
      card.querySelector('[data-home-track-bar]').style.width = (nodes.length ? count / nodes.length * 100 : 0) + '%';
    });
    document.querySelectorAll('[data-read-node]').forEach(input => {
      input.checked = progress[input.dataset.readNode] === true;
      input.closest('.lab-node').classList.toggle('is-read', input.checked);
    });
    document.querySelectorAll('[data-route-progress]').forEach(output => {
      const inputs = output.closest('.lab-route').querySelectorAll('[data-read-node]');
      output.textContent = `${Array.from(inputs).filter(input => input.checked).length} / ${inputs.length} 已读`;
    });
  }

  function updateThemeLabel() {
    const button = document.querySelector('.lab-theme-toggle');
    if (!button) return;
    const dark = document.documentElement.dataset.theme === 'dark';
    button.textContent = dark ? '☀' : '☾';
    button.setAttribute('aria-label', dark ? '切换到浅色主题' : '切换到深色主题');
    button.title = dark ? '切换到浅色主题' : '切换到深色主题';
  }

  function setupNavigation() {
    if (!document.querySelector('.lab-skip-link')) {
      const skip = document.createElement('a');
      skip.className = 'lab-skip-link';
      skip.href = '#content-inner';
      skip.textContent = '跳到主要内容';
      document.body.prepend(skip);
    }
    for (const [selector, label] of [['#search-button > .search', '搜索文章'], ['#toggle-menu > .site-page', '展开导航菜单']]) {
      const control = document.querySelector(selector);
      if (!control || control.dataset.labAccessible) continue;
      control.dataset.labAccessible = 'true';
      // Native buttons support keyboard activation without imitating it on a span.
      // Keep Butterfly's existing listener target for the search implementation.
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'site-page lab-nav-control';
      button.setAttribute('aria-label', label);
      button.innerHTML = control.innerHTML;
      if (selector.startsWith('#search-button')) button.addEventListener('click', () => control.click());
      control.hidden = true;
      control.style.display = 'none';
      control.after(button);
    }
    const menus = document.querySelector('#nav #menus');
    if (menus && !menus.querySelector('.lab-theme-toggle')) {
      const toggle = document.createElement('button');
      toggle.className = 'lab-theme-toggle';
      toggle.type = 'button';
      toggle.addEventListener('click', () => {
        const nativeToggle = document.getElementById('darkmode');
        if (nativeToggle) nativeToggle.click();
        else {
          const mode = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
          document.documentElement.dataset.theme = mode;
          if (window.btf && window.btf.saveToLocal) window.btf.saveToLocal.set('theme', mode, 2);
        }
        updateThemeLabel();
      });
      menus.append(toggle);
    }
    document.querySelectorAll('#nav .menus_items a').forEach(link => {
      const target = new URL(link.href).pathname;
      const current = window.location.pathname;
      const active = target === '/' ? current === '/' : current.startsWith(target);
      link.classList.toggle('lab-nav-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    updateThemeLabel();
  }

  function setupExperiment(root) {
    if (window.setupGradientExperiment) return window.setupGradientExperiment(root);
    const rate = root.querySelector('#lab-learning-rate');
    const start = root.querySelector('#lab-start-weight');
    const runButton = root.querySelector('[data-lab-run]');
    let weight = Number(start.value);
    let history = [weight];
    let timer = null;
    const NS = 'http://www.w3.org/2000/svg';
    const create = (tag, attrs, text) => {
      const element = document.createElementNS(NS, tag);
      for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
      if (text !== undefined) element.textContent = text;
      return element;
    };
    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      timer = null;
      runButton.textContent = '自动演示';
    };
    const number = value => Math.abs(value) >= 10000 ? value.toExponential(2) : value.toFixed(4);
    function draw() {
      const domain = Math.max(4.5, ...history.map(item => Math.abs(item))) * 1.04;
      const x = value => 60 + (value + domain) / (2 * domain) * 540;
      const y = value => 320 - value / (domain * domain) * 280;
      const grid = root.querySelector('[data-plot-grid]');
      grid.replaceChildren();
      for (let i = -2; i <= 2; i++) {
        const value = domain * i / 2;
        grid.append(create('line', {x1: x(value), x2: x(value), y1: 40, y2: 320, class: i === 0 ? 'lab-plot-axis' : 'lab-plot-grid'}));
        grid.append(create('text', {x: x(value), y: 342, 'text-anchor': 'middle', class: 'lab-tick'}, Math.abs(value) < .001 ? '0' : value.toFixed(1)));
      }
      for (let i = 0; i <= 4; i++) {
        const value = domain * domain * i / 4;
        grid.append(create('line', {x1: 60, x2: 600, y1: y(value), y2: y(value), class: i === 0 ? 'lab-plot-axis' : 'lab-plot-grid'}));
        grid.append(create('text', {x: 49, y: y(value) + 4, 'text-anchor': 'end', class: 'lab-tick'}, value >= 10000 ? value.toExponential(0) : value.toFixed(0)));
      }
      let path = '';
      for (let i = 0; i <= 120; i++) {
        const w = -domain + i / 120 * 2 * domain;
        path += `${i ? 'L' : 'M'}${x(w).toFixed(2)},${y(w * w).toFixed(2)} `;
      }
      root.querySelector('[data-plot-curve]').setAttribute('d', path);
      const steps = root.querySelector('[data-plot-steps]');
      steps.replaceChildren();
      steps.append(create('polyline', {points: history.map(w => `${x(w)},${y(w * w)}`).join(' '), class: 'lab-plot-path', fill: 'none'}));
      history.forEach((w, index) => steps.append(create('circle', {cx: x(w), cy: y(w * w), r: index === history.length - 1 ? 7 : 3.5, class: index === history.length - 1 ? 'lab-plot-point-current' : 'lab-plot-point'})));
    }
    function render() {
      const eta = Number(rate.value);
      root.querySelector('#lab-rate-value').textContent = eta.toFixed(2);
      root.querySelector('#lab-weight-value').textContent = Number(start.value).toFixed(1);
      root.querySelector('[data-lab-iteration]').textContent = history.length - 1;
      root.querySelector('[data-lab-weight]').textContent = number(weight);
      root.querySelector('[data-lab-loss]').textContent = number(weight * weight);
      let status = '等待实验';
      let explanation = '点击前进一步，观察参数沿着曲线向哪里移动。';
      if (Math.abs(weight) < .0001) {
        status = '已接近最小值'; explanation = '参数接近 0，损失也接近 0。可以换一个学习率再试一次。';
      } else if (history.length > 1) {
        if (eta < .5) { status = '平稳收敛'; explanation = '每次更新都向 0 靠近；学习率越小，需要的步数越多。'; }
        else if (eta < 1) { status = '震荡收敛'; explanation = '参数交替越过 0，但摆动幅度逐步缩小。'; }
        else if (eta === 1) { status = '等幅震荡'; explanation = '更新系数为 −1：参数在正负两侧来回切换，损失没有下降。'; }
        else { status = '正在发散'; explanation = '更新系数的绝对值超过 1：每步都离 0 更远。图表自动缩放显示轨迹。'; }
      }
      if (history.length > 40 && Math.abs(weight) >= .0001) explanation += ' 本次演示已达到 40 步，重置后可以继续探索。';
      root.querySelector('[data-lab-status]').textContent = status;
      root.querySelector('[data-lab-explanation]').textContent = explanation;
      draw();
    }
    const finished = () => history.length > 40 || Math.abs(weight) < .0001 || Math.abs(weight) > 1000;
    const step = () => {
      if (finished()) { stop(); return; }
      weight *= 1 - 2 * Number(rate.value);
      history.push(weight);
      render();
      if (finished()) stop();
    };
    const reset = () => { stop(); weight = Number(start.value); history = [weight]; render(); };
    rate.addEventListener('input', reset);
    start.addEventListener('input', reset);
    root.querySelector('[data-lab-step]').addEventListener('click', () => { stop(); step(); });
    root.querySelector('[data-lab-reset]').addEventListener('click', reset);
    runButton.addEventListener('click', () => {
      if (timer !== null) { stop(); return; }
      if (finished()) reset();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        while (!finished()) step();
        return;
      }
      runButton.textContent = '暂停演示';
      timer = window.setInterval(step, 550);
      step();
    });
    render();
    return stop;
  }

  function init() {
    disposeExperiment();
    setupNavigation();
    updateProgress();
    document.querySelectorAll('[data-reset-route]').forEach(button => {
      if (button.dataset.labBound) return;
      button.dataset.labBound = 'true';
      button.addEventListener('click', () => {
        button.closest('.lab-route').querySelectorAll('[data-read-node]').forEach(input => {
          delete progress[input.dataset.readNode];
        });
        persist();
        updateProgress();
      });
    });
    const experiment = document.querySelector('[data-gradient-lab]');
    const stopGradient = experiment ? setupExperiment(experiment) : () => {};
    const stopAI = window.initAILabs ? window.initAILabs() : () => {};
    const stopHome = window.initHomeMotion ? window.initHomeMotion() : () => {};
    const stopHomeAI = window.initHomeAI ? window.initHomeAI() : () => {};
    disposeExperiment = () => { stopGradient(); stopAI(); stopHome(); stopHomeAI(); };
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
      }, {threshold: 0.06});
      document.querySelectorAll('.lab-track-card, .home-track-card, .lab-post-card, .lab-project-card, .lab-section-heading').forEach((node,index) => {
        node.classList.add('ai-reveal'); node.style.setProperty('--reveal-delay', (index % 3) * 40 + 'ms'); observer.observe(node);
      });
      const previous = disposeExperiment;
      disposeExperiment = () => { previous(); observer.disconnect(); };
    }
  }
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-read-node]')) return;
    progress[event.target.dataset.readNode] = event.target.checked;
    persist(); updateProgress();
  });
  window.addEventListener('storage', event => {
    if (event.key !== progressKey) return;
    try {
      const stored = JSON.parse(event.newValue || '{}');
      progress = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    } catch (_) { progress = {}; }
    updateProgress();
  });
  new MutationObserver(updateThemeLabel).observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});
  document.addEventListener('pjax:send', () => disposeExperiment());
  document.addEventListener('pjax:complete', init);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once: true});
  else init();
})();
