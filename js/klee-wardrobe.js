/* Klee's wardrobe: draws every cosmetic item and wears the equipped ones across the
   site — a frame and a hair accessory on Klee's avatars, a chat-bubble style, a
   title under her name and a bomb skin in the lab games. The equipped set is cached
   in this browser so pages never wait for the server. */
(function () {
  'use strict';
  if (window.KleeWardrobe) return;
  const KEY = 'lsworld.klee.wardrobe.v1', SVG = 'http://www.w3.org/2000/svg';
  let catalog = null, items = new Map(), equipped = {}, uid = 0;
  try { equipped = JSON.parse(localStorage.getItem(KEY) || '{}').equipped || {}; } catch (_) { equipped = {}; }
  const catalogReady = fetch((document.documentElement.dataset.root || '/') + 'klee-wardrobe.json', {cache: 'no-cache'})
    .then(response => response.ok ? response.json() : null)
    .then(data => { if (data) { catalog = data; items = new Map(data.items.map(item => [item.id, item])); apply(); } return data; })
    .catch(() => null);
  const esc = text => String(text).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
  const around = (count, radius, offset = 0) => Array.from({length: count}, (_, i) => {
    const angle = offset + i / count * Math.PI * 2; return [50 + Math.cos(angle) * radius, 50 + Math.sin(angle) * radius, angle];
  });
  const star4 = (x, y, r, fill, cls = '') => { x = +x; y = +y; r = +r; return `<path class="${cls}" fill="${fill}" d="M${x} ${y - r}Q${x + r * .18} ${y - r * .18} ${x + r} ${y}Q${x + r * .18} ${y + r * .18} ${x} ${y + r}Q${x - r * .18} ${y + r * .18} ${x - r} ${y}Q${x - r * .18} ${y - r * .18} ${x} ${y - r}Z"/>`; };
  const star5 = (x, y, r, fill, stroke) => {
    const points = Array.from({length: 10}, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * .45 : r; return `${(x + Math.cos(a) * d).toFixed(1)},${(y + Math.sin(a) * d).toFixed(1)}`; });
    return `<polygon points="${points.join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="1.2" stroke-linejoin="round"/>`;
  };
  const flower = (x, y, r, petal, center, stroke) => around(5, r * .55, -Math.PI / 2).map(([px, py, a]) => {
    const cx = (x + px - 50).toFixed(1), cy = (y + py - 50).toFixed(1);
    return `<ellipse cx="${cx}" cy="${cy}" rx="${(r * .42).toFixed(1)}" ry="${(r * .28).toFixed(1)}" transform="rotate(${(a * 180 / Math.PI).toFixed(0)} ${cx} ${cy})" fill="${petal}" stroke="${stroke}" stroke-width=".8"/>`;
  }).join('') + `<circle cx="${x}" cy="${y}" r="${(r * .28).toFixed(1)}" fill="${center}"/>`;
  const seed = (x, y, r, color) => `<g stroke="${color}" stroke-width="1" stroke-linecap="round">${around(8, r, 0).map(([px, py]) =>
    `<line x1="${x}" y1="${y}" x2="${(x + px - 50).toFixed(1)}" y2="${(y + py - 50).toFixed(1)}"/>`).join('')}</g><circle cx="${x}" cy="${y}" r="${(r * .25).toFixed(1)}" fill="${color}"/>`;
  const leaf = (x, y, s, rotate, fill, vein) => `<g transform="translate(${x} ${y}) rotate(${rotate}) scale(${s})"><path fill="${fill}" d="M0-10L2.5-4 7-6 5.5-1 10 1 4 3 5 8 0 5-5 8-4 3-10 1-5.5-1-7-6-2.5-4Z"/><path stroke="${vein}" stroke-width=".8" fill="none" d="M0-8V9"/></g>`;

  // ----- Art for every item, drawn in a 100 × 100 box -----
  function art(item) {
    const look = item.look, id = 'kw' + (++uid);
    if (item.slot === 'frame') {
      const [c0, c1, c2] = look.ring;
      let deco = '';
      if (look.motif === 'sparkle') deco = around(5, 45, -Math.PI / 2).map(([x, y], i) => {
          const color = i % 2 ? c2 : c1, rays = around(8, 9, i).map(([px, py]) => `<line x1="${(x + (px - 50) * .35).toFixed(1)}" y1="${(y + (py - 50) * .35).toFixed(1)}" x2="${(x + px - 50).toFixed(1)}" y2="${(y + py - 50).toFixed(1)}"/>`).join('');
          return `<g class="kw-burst" stroke="${color}" stroke-width="2.2" stroke-linecap="round" style="animation-delay:${-i * .37}s">${rays}</g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.4" fill="${c0}"/>`;
        }).join('') + around(5, 46, -Math.PI / 2 + Math.PI / 5).map(([x, y], i) => star4(x, y, i % 2 ? 4 : 5.5, c0, 'kw-twinkle')).join('');
      if (look.motif === 'dandelion') deco = around(5, 45, -Math.PI / 2).map(([x, y]) => seed(+x.toFixed(1), +y.toFixed(1), 6, c2)).join('') + seed(88, 14, 4, c1) + seed(12, 84, 3.5, c1);
      if (look.motif === 'maple') deco = [[16, 22, 1, -30], [84, 24, .8, 25], [80, 82, 1.1, 160], [20, 80, .7, -140], [50, 6, .7, 0]].map(([x, y, s, r]) => leaf(x, y, s, r, r > 0 ? c2 : c1, c0)).join('');
      if (look.motif === 'ribbon') deco = `<g fill="${c2}" stroke="${c0}" stroke-width="1"><path d="M50 88L36 80Q30 92 38 96Z"/><path d="M50 88L64 80Q70 92 62 96Z"/><path d="M47 90L40 100H45L50 93 55 100H60L53 90Z"/><circle cx="50" cy="88" r="4"/></g>`
        + around(12, 44, 0).map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.4" fill="${c0}"/>`).join('');
      return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c0}"/><stop offset=".5" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>`
        + `<circle cx="50" cy="50" r="44" fill="none" stroke="url(#${id})" stroke-width="6"/><circle cx="50" cy="50" r="39.5" fill="none" stroke="${c0}" stroke-width="1.2" opacity=".85"/>${deco}`;
    }
    if (item.slot === 'hat') {
      if (look.motif === 'clover') return `<g transform="translate(50 50)"><path d="M0 4Q6 22 2 34" stroke="${look.dark}" stroke-width="4" fill="none" stroke-linecap="round"/>`
        + [0, 90, 180, 270].map(r => `<path transform="rotate(${r + 45})" fill="${look.color}" stroke="${look.dark}" stroke-width="1.5" d="M0 0C-4-8-18-10-16-22C-14-30-4-28 0-20C4-28 14-30 16-22C18-10 4-8 0 0Z"/>`).join('')
        + `<circle r="4" fill="${look.dark}"/></g>`;
      if (look.motif === 'flower') return flower(50, 50, 40, look.color, '#ffd24a', look.dark) + `<circle cx="50" cy="50" r="5" fill="#fff6c8"/>`;
      return star5(50, 52, 42, look.color, look.dark) + `<circle cx="40" cy="38" r="5" fill="#fff" opacity=".8"/>`;
    }
    if (item.slot === 'bubble') {
      const motif = look.motif === 'stars' ? [[20, 22, 3], [76, 18, 2], [86, 44, 2.5], [30, 52, 1.6], [62, 56, 2]].map(([x, y, r]) => star4(x, y, r * 1.6, look.border, 'kw-twinkle')).join('')
        : look.motif === 'sweetflower' ? flower(84, 16, 13, '#fbd3dc', '#ffe08a', '#e88aa0')
        : look.motif === 'letter' ? `<circle cx="82" cy="54" r="7" fill="#b3261e"/><path d="M78 54h8M82 50v8" stroke="#ffd7c8" stroke-width="1.4"/>` : '';
      const fill = look.bg2 ? `url(#${id})` : look.bg;
      return (look.bg2 ? `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${look.bg}"/><stop offset="1" stop-color="${look.bg2}"/></linearGradient></defs>` : '')
        + `<path d="M10 12Q10 4 18 4H86Q94 4 94 12V58Q94 66 86 66H40L26 80 28 66H18Q10 66 10 58Z" fill="${fill}" stroke="${look.border}" stroke-width="3"/>`
        + [22, 34, 46].map((y, i) => `<rect x="22" y="${y}" width="${[52, 40, 46][i]}" height="5" rx="2.5" fill="${look.fg}" opacity="${look.motif === 'letter' ? .55 : .8}"/>`).join('') + motif;
    }
    if (item.slot === 'title') {
      const parts = look.text.includes(' · ') ? look.text.split(' · ') : [look.text], longest = Math.max(...parts.map(p => [...p].length));
      const size = Math.min(14, 80 / longest), top = 50 - (parts.length - 1) * size * .6;
      return `<rect x="4" y="${parts.length > 1 ? 26 : 34}" width="92" height="${parts.length > 1 ? 48 : 32}" rx="16" fill="${look.bg}" stroke="${look.color}" stroke-width="2.5"/>`
        + parts.map((part, i) => `<text x="50" y="${(top + i * size * 1.25 + size * .36).toFixed(1)}" text-anchor="middle" font-size="${size.toFixed(1)}" font-weight="800" fill="${look.color}">${esc(part)}</text>`).join('');
    }
    if (item.slot === 'bomb') {
      const [a, b, c] = look.stops;
      const stripes = look.stripes ? `<g clip-path="url(#${id}c)" stroke="${look.stripes}" stroke-width="4" fill="none"><path d="M36 30Q30 60 38 86M50 26Q46 60 50 90M64 30Q70 60 62 86"/></g>` : '';
      return `<defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient><clipPath id="${id}c"><circle cx="50" cy="58" r="32"/></clipPath></defs>`
        + `<path d="M64 32Q72 12 86 16" fill="none" stroke="#6b4426" stroke-width="4" stroke-linecap="round"/>${star4(88, 14, 7, '#ffd24a', 'kw-twinkle')}`
        + `<circle cx="50" cy="58" r="32" fill="url(#${id})" stroke="${look.outline}" stroke-width="2.5"/>${stripes}<ellipse cx="38" cy="44" rx="8" ry="5" fill="#fff" opacity=".6" transform="rotate(-30 38 44)"/>`;
    }
    // Stickers: simple doodles.
    const color = look.color;
    if (look.motif === 'sun') return `<g stroke="${color}" stroke-width="5" stroke-linecap="round">${around(10, 38, 0).map(([x, y]) => `<line x1="${(50 + (x - 50) * .68).toFixed(1)}" y1="${(50 + (y - 50) * .68).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`).join('')}</g><circle cx="50" cy="50" r="20" fill="${color}"/><path d="M42 54Q50 62 58 54" stroke="#7a3a14" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="43" cy="46" r="2.5" fill="#7a3a14"/><circle cx="57" cy="46" r="2.5" fill="#7a3a14"/>`;
    if (look.motif === 'apple') return `<path d="M50 30C36 20 16 30 20 54C24 76 40 88 50 82C60 88 76 76 80 54C84 30 64 20 50 30Z" fill="${color}" stroke="#8f1f1c" stroke-width="2.5"/><path d="M50 30Q50 18 56 12" stroke="#6b4426" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M54 22Q66 10 76 18Q66 28 54 22Z" fill="#4caf50"/><ellipse cx="36" cy="44" rx="6" ry="9" fill="#fff" opacity=".45"/>`;
    if (look.motif === 'fish') return `<path d="M20 50Q42 22 70 46L86 32V68L70 54Q42 78 20 50Z" fill="${color}" stroke="#235f8f" stroke-width="2.5" stroke-linejoin="round"/><circle cx="34" cy="46" r="4" fill="#fff"/><circle cx="34" cy="46" r="2" fill="#102a3f"/><path d="M50 40Q54 50 50 60" stroke="#235f8f" stroke-width="2" fill="none"/>`;
    if (look.motif === 'dandelion') return `<path d="M50 54Q52 74 46 92" stroke="#3e7a3a" stroke-width="3" fill="none"/>${seed(50, 40, 26, color)}${seed(78, 20, 6, color)}`;
    if (look.motif === 'jail') return `<rect x="20" y="18" width="60" height="64" rx="6" fill="#d9d4cc" stroke="#5a5560" stroke-width="3"/><g stroke="${color}" stroke-width="5">${[32, 44, 56, 68].map(x => `<line x1="${x}" y1="22" x2="${x}" y2="78"/>`).join('')}</g><path d="M38 66Q50 58 62 66" stroke="#5a5560" stroke-width="3" fill="none"/><path d="M42 50l4 3M58 50l-4 3" stroke="#5a5560" stroke-width="3"/>`;
    return `<path d="M60 26Q66 12 78 14" fill="none" stroke="#6b4426" stroke-width="4" stroke-linecap="round"/>${star4(80, 12, 6, '#ffd24a')}<circle cx="48" cy="56" r="28" fill="${color}" stroke="#8f1f1c" stroke-width="2.5"/>${star5(40, 50, 8, '#fff1bf', '#fff1bf')}`;
  }
  function draw(item, {size = 64, className = ''} = {}) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('class', `kw-art kw-${item.slot} ${className}`.trim()); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = art(item); return svg;
  }

  // ----- Wearing the equipped set -----
  const AVATARS = '.cp-avatar-wrap, .fish-klee-face, [data-klee-avatar]';
  function decorate(target) {
    let host = target.parentElement?.classList.contains('kw-host') ? target.parentElement : null;
    if (!host) {
      host = document.createElement('span'); host.className = 'kw-host';
      if (target.matches('.cp-avatar-wrap')) host.classList.add('kw-host-portrait');
      target.replaceWith(host); host.append(target);
    }
    host.querySelectorAll(':scope > .kw-frame, :scope > .kw-hat-wrap').forEach(node => node.remove());
    const frame = items.get(equipped.frame), hat = items.get(equipped.hat);
    if (frame) host.prepend(draw(frame, {size: 100, className: 'kw-frame'}));
    if (hat) { const wrap = document.createElement('span'); wrap.className = 'kw-hat-wrap'; wrap.append(draw(hat, {size: 40})); host.append(wrap); }
    host.dataset.kwFrame = frame?.id || ''; host.dataset.kwHat = hat?.id || '';
  }
  function bubbleMotif(look) {
    const body = look.motif === 'stars' ? [[30, 34, 16, look.border], [70, 26, 10, '#fff'], [62, 70, 12, look.border]].map(([x, y, r, c]) => star4(x, y, r, c)).join('')
      : look.motif === 'sweetflower' ? flower(50, 50, 46, '#fbd3dc', '#ffe08a', '#e88aa0')
      : look.motif === 'letter' ? `<circle cx="50" cy="50" r="34" fill="#b3261e" stroke="#7a1712" stroke-width="4"/><path d="M34 50h32M50 34v32" stroke="#ffd7c8" stroke-width="6" stroke-linecap="round"/>` : '';
    return body ? `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${SVG}" viewBox="0 0 100 100">${body}</svg>`)}")` : 'none';
  }
  function apply() {
    const root = document.documentElement;
    for (const slot of ['frame', 'hat', 'bubble', 'title', 'bomb']) {
      const item = items.get(equipped[slot]);
      if (item) root.dataset['klee' + slot[0].toUpperCase() + slot.slice(1)] = item.id; else delete root.dataset['klee' + slot[0].toUpperCase() + slot.slice(1)];
    }
    const bubble = items.get(equipped.bubble);
    if (bubble) {
      root.style.setProperty('--kw-bubble-bg', bubble.look.bg2 ? `linear-gradient(135deg, ${bubble.look.bg}, ${bubble.look.bg2})` : bubble.look.bg);
      root.style.setProperty('--kw-bubble-fg', bubble.look.fg); root.style.setProperty('--kw-bubble-border', bubble.look.border); root.style.setProperty('--kw-bubble-solid', bubble.look.bg);
      root.style.setProperty('--kw-bubble-motif', bubbleMotif(bubble.look));
    } else for (const name of ['--kw-bubble-bg', '--kw-bubble-fg', '--kw-bubble-border', '--kw-bubble-motif', '--kw-bubble-solid']) root.style.removeProperty(name);
    // Bomb skins replace the bomb gradient in the lab games through one shared paint server.
    let defs = document.getElementById('kw-defs');
    const bomb = items.get(equipped.bomb);
    if (bomb) {
      if (!defs) { defs = document.createElementNS(SVG, 'svg'); defs.id = 'kw-defs'; defs.setAttribute('aria-hidden', 'true'); defs.setAttribute('width', '0'); defs.setAttribute('height', '0'); defs.style.position = 'absolute'; document.body.append(defs); }
      const [a, b, c] = bomb.look.stops;
      defs.innerHTML = `<defs><radialGradient id="kw-bomb-fill" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset=".5" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></radialGradient>`
        + `<pattern id="kw-bomb-skin" patternContentUnits="objectBoundingBox" width="1" height="1"><rect width="1" height="1" fill="url(#kw-bomb-fill)"/>`
        + (bomb.look.stripes ? `<path d="M.3 .05Q.22 .5 .32 .95M.5 0Q.46 .5 .5 1M.7 .05Q.78 .5 .68 .95" stroke="${bomb.look.stripes}" stroke-width=".07" fill="none"/>` : '') + `</pattern></defs>`;
      root.style.setProperty('--kw-bomb-outline', bomb.look.outline);
    } else { defs?.remove(); root.style.removeProperty('--kw-bomb-outline'); }
    const title = items.get(equipped.title);
    document.querySelectorAll('.cp-title small').forEach(node => { if (!node.dataset.kwDefault) node.dataset.kwDefault = node.textContent; node.textContent = title ? title.look.text : node.dataset.kwDefault; });
    if (document.body) document.querySelectorAll(AVATARS).forEach(decorate);
  }
  // The companion and game panels appear after this script runs.
  const watch = new MutationObserver(mutations => {
    if (!catalog) return;
    for (const m of mutations) for (const node of m.addedNodes) {
      if (!(node instanceof Element) || node.closest('.kw-host') && !node.matches(AVATARS)) continue;
      if (node.matches?.(AVATARS) && !node.parentElement?.classList.contains('kw-host')) decorate(node);
      node.querySelectorAll?.(AVATARS).forEach(target => { if (!target.parentElement?.classList.contains('kw-host')) decorate(target); });
      if (node.querySelector?.('.cp-title small') || node.matches?.('.cp-title small')) apply();
    }
  });
  const start = () => { watch.observe(document.body, {childList: true, subtree: true}); apply(); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, {once: true});

  window.KleeWardrobe = {
    ready: catalogReady,
    get catalog() { return catalog; },
    item: id => items.get(id) || null,
    get equipped() { return {...equipped}; },
    draw,
    // Called with the server's wardrobe after every change.
    remember(wardrobe) {
      equipped = {...(wardrobe?.equipped || {})};
      try { localStorage.setItem(KEY, JSON.stringify({equipped})); } catch (_) { /* Optional. */ }
      apply();
    }
  };
})();
