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
    const stopAI = window.initLabGames ? window.initLabGames() : () => {};
    const stopHome = window.initHomeMotion ? window.initHomeMotion() : () => {};
    const stopHomeAI = window.initHomeAI ? window.initHomeAI() : () => {};
    disposeExperiment = () => { stopAI(); stopHome(); stopHomeAI(); };
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
