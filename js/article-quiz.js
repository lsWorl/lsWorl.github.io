/* 可莉小测验: a three-question quiz at the end of every article. Klee writes the
   questions from the article on the server and keeps the answers there; each
   correct answer above your best on that article earns 160 primogems for
   Klee's wardrobe wish. */
(function () {
  'use strict';
  const avatar = '/images/companion/klee-expressions-64.webp', avatar2x = '/images/companion/klee-expressions-128.webp';
  const FACES = {neutral: 0, happy: 1, laugh: 2, curious: 3, thinking: 4, care: 5, proud: 6, wink: 7};
  const el = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const face = mood => { const i = FACES[mood] ?? 0; return `${i % 4 / 3 * 100}% ${Math.floor(i / 4) / 3 * 100}%`; };
  const api = (path, method, data) => window.LsCompanion ? window.LsCompanion.call(path, method, data) : Promise.reject(new Error('可莉暂时不在线，稍后再来吧。'));

  function mount() {
    const container = document.querySelector('#article-container');
    if (!container || !document.getElementById('post') || document.querySelector('.kq')) return;
    const box = el('section', 'kq'); box.setAttribute('aria-label', '可莉小测验');
    const head = el('div', 'kq-head'), portrait = el('span', 'kq-face'); portrait.dataset.kleeAvatar = '';
    portrait.style.backgroundImage = `url(${avatar})`; portrait.style.backgroundImage = `image-set(url(${avatar}) 1x, url(${avatar2x}) 2x)`; portrait.style.backgroundPosition = face('happy');
    const intro = el('div', 'kq-intro'); intro.append(el('h2', 'kq-title', '可莉小测验'),
      el('p', 'kq-lead', '读完这篇，来答 3 道题吧！每答对 1 题得 160 原石（每篇只按你的最好成绩算），攒够了去可莉祈愿抽装扮～'));
    head.append(portrait, intro);
    const body = el('div', 'kq-body'), status = el('p', 'kq-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
    box.append(head, body, status); container.after(box);
    let quiz = null;
    const setMood = mood => { portrait.style.backgroundPosition = face(mood); };
    function idle() {
      body.replaceChildren(); const row = el('div', 'kq-actions');
      const start = el('button', 'kq-button kq-primary', '开始答题'); start.type = 'button'; start.addEventListener('click', load);
      const wish = el('a', 'kq-button', '去可莉祈愿'); wish.href = '/wish/';
      row.append(start, wish); body.append(row);
    }
    async function load() {
      body.replaceChildren(el('p', 'kq-loading', '可莉正在翻文章出题……')); status.textContent = ''; setMood('thinking');
      try { quiz = await api('/quiz', 'POST', {reading: {path: location.pathname}}); render(); }
      catch (error) { setMood('care'); status.textContent = error.message; idle(); }
    }
    function render() {
      setMood('curious'); body.replaceChildren();
      if (quiz.best) body.append(el('p', 'kq-best', quiz.best === 3 ? '这篇你已经满分啦！再答一次可以复习，不过不会再得原石了。' : `这篇你最好答对过 ${quiz.best} 题，这次答得更好才会多得原石。`));
      const form = el('form', 'kq-form');
      quiz.questions.forEach((q, i) => {
        const set = el('fieldset', 'kq-question'); set.append(el('legend', '', `${i + 1}. ${q.question}`));
        q.options.forEach((option, j) => {
          const label = el('label', 'kq-option'), input = el('input'); input.type = 'radio'; input.name = `kq-${i}`; input.value = j; input.required = true;
          label.append(input, el('span', '', option)); set.append(label);
        });
        form.append(set);
      });
      const submit = el('button', 'kq-button kq-primary', '交卷'); submit.type = 'submit'; form.append(submit);
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const answers = quiz.questions.map((_, i) => Number(form.querySelector(`input[name="kq-${i}"]:checked`)?.value));
        if (answers.some(Number.isNaN)) { status.textContent = '还有题没答哦！'; return; }
        submit.disabled = true; status.textContent = '可莉在批改……';
        try { result(await api('/quiz/answer', 'POST', {quizId: quiz.quizId, answers}), form); }
        catch (error) { submit.disabled = false; status.textContent = error.message; }
      });
      body.append(form); status.textContent = '';
    }
    function result(data, form) {
      window.KleeWardrobe?.remember(data.wardrobe);
      form.querySelectorAll('fieldset').forEach((set, i) => {
        const r = data.results[i];
        set.classList.add(r.chosen === r.answer ? 'is-right' : 'is-wrong');
        set.querySelectorAll('.kq-option').forEach((label, j) => { label.classList.toggle('is-answer', j === r.answer); label.querySelector('input').disabled = true; });
        if (r.explain) set.append(el('p', 'kq-explain', (r.chosen === r.answer ? '答对啦！' : '正确答案是“' + quiz.questions[i].options[r.answer] + '”。') + r.explain));
      });
      form.querySelector('button[type=submit]').remove();
      setMood(data.correct === 3 ? 'laugh' : data.correct ? 'happy' : 'care');
      const summary = el('div', 'kq-result');
      summary.append(el('strong', 'kq-score', `答对 ${data.correct} / ${data.total}`),
        el('span', 'kq-reward' + (data.reward ? ' is-earned' : ''), data.reward ? `+${data.reward} 原石` : '这次没有新增原石'),
        el('span', 'kq-wallet', `现在有 ${data.wardrobe.primogems} 原石`));
      const row = el('div', 'kq-actions');
      const again = el('button', 'kq-button', '再出一份'); again.type = 'button'; again.addEventListener('click', load);
      const wish = el('a', 'kq-button kq-primary', `去祈愿（${Math.floor(data.wardrobe.primogems / data.wardrobe.cost)} 次）`); wish.href = '/wish/';
      row.append(again, wish); body.append(summary, row);
      status.textContent = data.correct === 3 ? '全对！可莉给你放烟花！' : data.correct ? '不错哦，看看解析再试一次吧！' : '没关系，回到文章里再看看～';
    }
    idle();
  }
  const boot = () => mount();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
  document.addEventListener('pjax:complete', boot);
})();
