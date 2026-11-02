/* Klee's wardrobe: draws every cosmetic item and wears the equipped ones across the
   site — an outfit for Klee, a frame on her round avatars, a chat-bubble style, a
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
  // Each drawing gets its own gradient ids so many copies can share a page.
  const lin = (id, stops, x2 = 0, y2 = 1) => `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
  const rad = (id, stops, cx = '35%', cy = '30%', r = '75%') => `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
  const gem = (x, y, r, color, id) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><path d="M0 ${-r}L${r * .8} 0 0 ${r} ${-r * .8} 0Z" fill="url(#${id})" stroke="#fff" stroke-width="1" stroke-opacity=".8"/><path d="M0 ${-r}L${r * .8} 0 0 ${-r * .15}Z" fill="#fff" opacity=".45"/></g>`;
  const fan = (x, y, s, rot, color) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" stroke="${color}" stroke-linecap="round" fill="none"><path d="M0 10V0" stroke-width="1.2"/>${[-60, -30, 0, 30, 60].map(a => `<path d="M0 0L${(Math.sin(a * Math.PI / 180) * 6).toFixed(1)} ${(-Math.cos(a * Math.PI / 180) * 6).toFixed(1)}" stroke-width=".9"/>`).join('')}<circle cy="10" r="1.2" fill="${color}"/></g>`;
  const mapleLeaf = (x, y, s, rot, id, vein) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path fill="url(#${id})" stroke="${vein}" stroke-width=".6" d="M0-11L2.6-4.5 7.5-7 6-1.5 11 .5 4.5 3 5.5 9 0 6-5.5 9-4.5 3-11 .5-6-1.5-7.5-7-2.6-4.5Z"/><path stroke="${vein}" stroke-width=".7" fill="none" d="M0-8V11M0-1L5-4M0-1L-5-4M0 3L4 5M0 3L-4 5"/></g>`;
  function frameArt(look, id) {
    const [c0, c1, c2] = look.ring;
    const defs = lin(id + 'm', [[0, c0], [.3, c1], [.55, c2], [.8, c1], [1, c0]], 1, 1) + rad(id + 'g', [[0, '#fff'], [.35, c0], [1, c2]], '40%', '35%', '70%')
      + lin(id + 'l', [[0, c0], [1, c2]], 1, 1);
    const base = `<circle cx="50" cy="50" r="44" fill="none" stroke="rgba(0,0,0,.18)" stroke-width="8" transform="translate(0 1.2)"/>`
      + `<circle cx="50" cy="50" r="44" fill="none" stroke="url(#${id}m)" stroke-width="7"/>`
      + `<circle cx="50" cy="50" r="47.3" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".9"/>`
      + `<circle cx="50" cy="50" r="40.2" fill="none" stroke="${c2}" stroke-width="1.4"/>`
      + `<circle cx="50" cy="50" r="44" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="1.1" stroke-dasharray=".2 4.4" stroke-linecap="round"/>`;
    let deco = '';
    if (look.motif === 'sparkle') {
      deco = around(5, 44, -Math.PI / 2 + Math.PI / 5).map(([x, y], i) => {
        const color = [c0, c1, '#fff1b8', c2, c1][i], rays = around(12, 10, i * .3).map(([px, py], k) => {
          const ex = x + px - 50, ey = y + py - 50, sx = x + (px - 50) * .4, sy = y + (py - 50) * .4;
          return `<line x1="${sx.toFixed(1)}" y1="${sy.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}"/>${k % 2 ? '' : `<circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="1.1" fill="${color}" stroke="none"/>`}`;
        }).join('');
        return `<g class="kw-burst" stroke="${color}" stroke-width="1.6" stroke-linecap="round" style="animation-delay:${(-i * .44).toFixed(2)}s">${rays}</g>`;
      }).join('') + around(5, 44, -Math.PI / 2).map(([x, y], i) => i === 0 ? gem(x, y, 6.5, c1, id + 'g') : star4(x, y, 4.2, '#fff8d8', 'kw-twinkle')).join('');
    } else if (look.motif === 'dandelion') {
      deco = around(6, 44, -Math.PI / 2).map(([x, y], i) => i === 0 ? gem(x, y, 6, c1, id + 'g') : `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="5.2" fill="#fff" opacity=".9"/>${around(10, 5.2).map(([px, py]) => `<line x1="0" y1="0" x2="${(px - 50).toFixed(1)}" y2="${(py - 50).toFixed(1)}" stroke="${c2}" stroke-width=".7"/>`).join('')}<circle r="1.6" fill="${c2}"/></g>`).join('')
        + fan(86, 14, .9, 25, c2) + fan(12, 82, .75, -30, c1) + fan(92, 64, .6, 50, c1);
    } else if (look.motif === 'maple') {
      deco = [[16, 22, 1.05, -30], [84, 24, .85, 25], [82, 80, 1.15, 160], [18, 79, .75, -140], [50, 5, .8, 0]].map(([x, y, s, r], i) => mapleLeaf(x, y, s, r, id + 'l', i % 2 ? c2 : '#8f2a14')).join('')
        + gem(50, 94, 5, c1, id + 'g');
    } else if (look.motif === 'ribbon') {
      deco = `<g stroke="${c2}" stroke-width=".9" stroke-linejoin="round"><path d="M50 88L33 78Q26 92 36 97Z" fill="url(#${id}l)"/><path d="M50 88L67 78Q74 92 64 97Z" fill="url(#${id}l)"/>`
        + `<path d="M46 90L38 101H44L50 94 56 101H62L54 90Z" fill="${c2}"/><rect x="45" y="83.5" width="10" height="9" rx="3" fill="url(#${id}g)"/></g>`
        + `<path d="M36 82Q33 88 36 94M64 82Q67 88 64 94" stroke="#fff" stroke-opacity=".5" fill="none"/>` + gem(50, 6, 6, c1, id + 'g')
        + around(2, 44, Math.PI).map(([x, y]) => gem(x, y, 4.2, c1, id + 'g')).join('');
    }
    return `<defs>${defs}</defs>${base}${deco}`;
  }
  function bubbleArt(look, id) {
    const fill = look.bg2 ? `url(#${id}b)` : look.bg;
    let motif = '';
    if (look.motif === 'stars') motif = `<path d="M74 12A9 9 0 1 0 84 26A7 7 0 1 1 74 12Z" fill="#fff3c4"/>` + [[22, 20, 4], [34, 56, 2.6], [62, 54, 3], [88, 48, 2.2]].map(([x, y, r]) => star4(x, y, r * 1.5, look.border, 'kw-twinkle')).join('');
    if (look.motif === 'sweetflower') motif = flower(83, 15, 15, '#fbd3dc', '#ffe08a', '#e88aa0') + `<circle cx="83" cy="15" r="3" fill="#fff6c8"/>` + flower(16, 60, 7, '#fde6ec', '#ffe08a', '#e88aa0');
    if (look.motif === 'letter') motif = `<path d="M80 6H90V16Z" fill="${look.border}" opacity=".35"/><circle cx="82" cy="55" r="8" fill="#b3261e" stroke="#7a1712" stroke-width="1.2"/><path d="M78 55h8M82 51v8" stroke="#ffd7c8" stroke-width="1.6" stroke-linecap="round"/><path d="M78 61L75 68M86 61L89 68" stroke="#b3261e" stroke-width="2.4"/>`;
    return `<defs>${look.bg2 ? lin(id + 'b', [[0, look.bg], [1, look.bg2]], 1, 1) : ''}${lin(id + 'h', [[0, '#fff', .55], [1, '#fff', 0]])}</defs>`
      + `<path d="M10 12Q10 4 18 4H86Q94 4 94 12V58Q94 66 86 66H40L25 80 28 66H18Q10 66 10 58Z" fill="rgba(0,0,0,.15)" transform="translate(1.5 2)"/>`
      + `<path d="M10 12Q10 4 18 4H86Q94 4 94 12V58Q94 66 86 66H40L25 80 28 66H18Q10 66 10 58Z" fill="${fill}" stroke="${look.border}" stroke-width="3" stroke-linejoin="round"/>`
      + `<path d="M15 12Q15 8 19 8H85Q89 8 89 12V20H15Z" fill="url(#${id}h)"/>`
      + [24, 36, 48].map((y, i) => `<rect x="22" y="${y}" width="${[50, 38, 44][i]}" height="5" rx="2.5" fill="${look.fg}" opacity="${look.motif === 'letter' ? .5 : .75}"/>`).join('') + motif;
  }
  function titleArt(look, id) {
    const parts = look.text.includes(' · ') ? look.text.split(' · ') : [look.text], longest = Math.max(...parts.map(p => [...p].length));
    const size = Math.min(13.5, 72 / longest), h = parts.length > 1 ? 40 : 28, top = 50 - h / 2;
    return `<defs>${lin(id + 'r', [[0, '#fff'], [.15, look.bg], [1, look.bg]])}${lin(id + 'e', [[0, look.color], [1, '#000']], 0, 1)}</defs>`
      + `<path d="M2 ${top + 6}H14V${top + h + 6}H2L7 ${top + h / 2 + 6}Z" fill="${look.color}" opacity=".75"/><path d="M98 ${top + 6}H86V${top + h + 6}H98L93 ${top + h / 2 + 6}Z" fill="${look.color}" opacity=".75"/>`
      + `<path d="M10 ${top + h}L14 ${top + h + 6}V${top + h}ZM90 ${top + h}L86 ${top + h + 6}V${top + h}Z" fill="${look.color}"/>`
      + `<rect x="10" y="${top}" width="80" height="${h}" rx="4" fill="url(#${id}r)" stroke="${look.color}" stroke-width="2"/>`
      + `<path d="M14 ${top + 3}H86" stroke="#fff" stroke-opacity=".8" stroke-width="1"/>`
      + parts.map((part, i) => `<text x="50" y="${(50 - (parts.length - 1) * size * .62 + i * size * 1.24 + size * .36).toFixed(1)}" text-anchor="middle" font-size="${size.toFixed(1)}" font-weight="900" fill="${look.color}" letter-spacing=".5">${esc(part)}</text>`).join('');
  }
  function bombArt(look, id) {
    const [a, b, c] = look.stops;
    let skin = '';
    if (look.stripes) skin = `<g clip-path="url(#${id}k)" stroke="${look.stripes}" stroke-width="4.5" fill="none" opacity=".9"><path d="M30 32Q22 62 32 90M44 26Q38 60 44 94M58 26Q64 60 58 94M72 32Q80 62 70 90"/></g>`;
    else if (look.stops[0] === '#ffffff') skin = `<g clip-path="url(#${id}k)" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".9">${[[40, 66], [64, 50], [58, 78]].map(([x, y]) => `<path d="M${x - 6} ${y}h12M${x} ${y - 6}v12M${x - 4} ${y - 4}l8 8M${x + 4} ${y - 4}l-8 8"/>`).join('')}</g>`;
    else skin = `<g opacity=".55">${star5(54, 64, 11, '#fff7d0', '#c8911d')}</g>`;
    return `<defs>${rad(id + 'b', [[0, a], [.5, b], [1, c]])}${rad(id + 's', [[0, '#fff'], [.4, '#ffe08a'], [1, '#ff8a3c', 0]], '50%', '50%', '50%')}${lin(id + 'f', [[0, '#9a9aa8'], [.5, '#e8e8f0'], [1, '#6a6a78']], 1, 0)}<clipPath id="${id}k"><circle cx="50" cy="60" r="31"/></clipPath></defs>`
      + `<ellipse cx="52" cy="93" rx="24" ry="4" fill="rgba(0,0,0,.18)"/>`
      + `<path d="M58 30Q64 12 80 14" fill="none" stroke="#5a3a20" stroke-width="3.5" stroke-linecap="round"/><path d="M58 30Q64 12 80 14" fill="none" stroke="#c89060" stroke-width="1.2" stroke-dasharray="2 2.5"/>`
      + `<circle cx="82" cy="13" r="10" fill="url(#${id}s)" class="kw-twinkle"/>${star4(82, 13, 5, '#fff')}`
      + `<circle cx="50" cy="60" r="31" fill="url(#${id}b)" stroke="${look.outline}" stroke-width="2.4"/>${skin}`
      + `<rect x="47" y="25" width="14" height="9" rx="2" fill="url(#${id}f)" stroke="${look.outline}" stroke-width="1.4" transform="rotate(25 54 29)"/>`
      + `<path d="M28 74Q34 88 50 90" stroke="rgba(0,0,0,.18)" stroke-width="4" fill="none" stroke-linecap="round"/>`
      + `<ellipse cx="38" cy="46" rx="9" ry="5.5" fill="#fff" opacity=".7" transform="rotate(-35 38 46)"/><circle cx="31" cy="56" r="2" fill="#fff" opacity=".6"/>`;
  }
  // Stickers: doodles with a die-cut white edge and a soft shadow.
  function stickerArt(look, id) {
    const color = look.color;
    const doodle = {
      sun: `<g stroke="${color}" stroke-width="5" stroke-linecap="round">${around(10, 36, 0).map(([x, y]) => `<line x1="${(50 + (x - 50) * .7).toFixed(1)}" y1="${(50 + (y - 50) * .7).toFixed(1)}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`).join('')}</g><circle cx="50" cy="50" r="20" fill="url(#${id}d)"/><path d="M42 54Q50 62 58 54" stroke="#7a3a14" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="43" cy="46" r="2.5" fill="#7a3a14"/><circle cx="57" cy="46" r="2.5" fill="#7a3a14"/><circle cx="38" cy="54" r="3" fill="#ff8a6a" opacity=".6"/><circle cx="62" cy="54" r="3" fill="#ff8a6a" opacity=".6"/>`,
      apple: `<path d="M50 30C36 20 16 30 20 54C24 76 40 88 50 82C60 88 76 76 80 54C84 30 64 20 50 30Z" fill="url(#${id}d)" stroke="#8f1f1c" stroke-width="2.5"/><path d="M50 30Q50 18 56 12" stroke="#6b4426" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M54 22Q66 10 76 18Q66 28 54 22Z" fill="#4caf50" stroke="#2e7d32" stroke-width="1.2"/><ellipse cx="34" cy="46" rx="5" ry="9" fill="#fff" opacity=".55" transform="rotate(20 34 46)"/>`,
      fish: `<path d="M18 50Q40 22 68 46L86 32V68L68 54Q40 78 18 50Z" fill="url(#${id}d)" stroke="#235f8f" stroke-width="2.5" stroke-linejoin="round"/><circle cx="32" cy="46" r="4.5" fill="#fff"/><circle cx="33" cy="46" r="2.2" fill="#102a3f"/><path d="M48 38Q53 50 48 62M58 42Q62 50 58 58" stroke="#235f8f" stroke-width="2" fill="none"/><path d="M30 58Q36 62 42 60" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/>`,
      dandelion: `<path d="M50 54Q52 74 46 92" stroke="#3e7a3a" stroke-width="3" fill="none"/><circle cx="50" cy="40" r="22" fill="#fff" opacity=".6"/>${seed(50, 40, 24, color)}${fan(80, 18, 1, 30, color)}${fan(18, 22, .8, -30, color)}`,
      jail: `<rect x="20" y="16" width="60" height="68" rx="6" fill="#e8e4dc" stroke="#5a5560" stroke-width="3"/><circle cx="50" cy="48" r="16" fill="#fbd9c4"/><path d="M42 44l5 3M58 44l-5 3" stroke="#5a5560" stroke-width="2.6" stroke-linecap="round"/><path d="M42 58Q50 52 58 58" stroke="#5a5560" stroke-width="2.6" fill="none"/><path d="M58 52q2 6 0 8" stroke="#6fb2e8" stroke-width="2.5" fill="none"/><g stroke="${color}" stroke-width="5">${[32, 44, 56, 68].map(x => `<line x1="${x}" y1="20" x2="${x}" y2="80"/>`).join('')}</g>`,
      bomb: `<path d="M60 26Q66 12 78 14" fill="none" stroke="#6b4426" stroke-width="4" stroke-linecap="round"/>${star4(80, 12, 7, '#ffd24a')}<circle cx="48" cy="56" r="28" fill="url(#${id}d)" stroke="#8f1f1c" stroke-width="2.5"/>${star5(42, 52, 9, '#fff1bf', '#fff1bf')}<ellipse cx="36" cy="42" rx="7" ry="4" fill="#fff" opacity=".6" transform="rotate(-35 36 42)"/>`
    }[look.motif] || '';
    const tint = {sun: ['#fff3b0', color], apple: ['#ff9a8a', color], fish: ['#bfe3ff', color], bomb: ['#ff9a83', color]}[look.motif] || ['#fff', color];
    return `<defs>${rad(id + 'd', [[0, tint[0]], [1, tint[1]]])}<filter id="${id}x" x="-20%" y="-20%" width="140%" height="140%"><feMorphology in="SourceAlpha" operator="dilate" radius="3.5" result="grow"/><feFlood flood-color="#fff"/><feComposite in2="grow" operator="in" result="edge"/><feGaussianBlur in="grow" stdDeviation="2" result="blur"/><feOffset in="blur" dx="1" dy="2" result="shadow"/><feComponentTransfer in="shadow" result="soft"><feFuncA type="linear" slope=".35"/></feComponentTransfer><feMerge><feMergeNode in="soft"/><feMergeNode in="edge"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>`
      + `<g filter="url(#${id}x)" transform="translate(50 50) scale(.86) translate(-50 -50)">${doodle}</g>`;
  }
  // Outfits are illustrations you add yourself: the thumbnail is the first portrait frame.
  function outfitArt(look, id) {
    return `<defs><clipPath id="${id}o"><circle cx="50" cy="50" r="46"/></clipPath>${rad(id + 'o2', [[0, '#fff8ec'], [1, '#ffd9b0']], '50%', '40%', '70%')}</defs><circle cx="50" cy="50" r="46" fill="url(#${id}o2)"/>`
      + `<image href="${esc(look.atlas)}" x="0" y="0" width="400" height="400" preserveAspectRatio="none" clip-path="url(#${id}o)"/><circle cx="50" cy="50" r="46" fill="none" stroke="#fff" stroke-width="3"/>`;
  }
  function art(item) {
    const id = 'kw' + (++uid), look = item.look;
    return ({frame: frameArt, bubble: bubbleArt, title: titleArt, bomb: bombArt, sticker: stickerArt, outfit: outfitArt}[item.slot] || stickerArt)(look, id);
  }
  // Klee's face inside a frame, so a frame reads as worn rather than as an empty ring.
  const KLEE_FACES = '/images/companion/klee-expressions-128.webp';
  function kleeInside(index = 2) {
    const id = 'kw' + (++uid), col = index % 4, row = Math.floor(index / 4);
    return `<defs><clipPath id="${id}"><circle cx="50" cy="50" r="38.5"/></clipPath></defs><circle cx="50" cy="50" r="38.5" fill="#f8e6d6"/>`
      + `<image href="${KLEE_FACES}" x="${11 - col * 78}" y="${11 - row * 78}" width="312" height="312" clip-path="url(#${id})" preserveAspectRatio="none"/>`;
  }
  function draw(item, {size = 64, className = '', klee = false} = {}) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('width', size); svg.setAttribute('height', size);
    svg.setAttribute('class', `kw-art kw-${item.slot} ${className}`.trim()); svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = (klee && item.slot === 'frame' ? kleeInside() : '') + art(item); return svg;
  }

  // ----- Wearing the equipped set -----
  const AVATARS = '.cp-avatar-wrap, .fish-klee-face, [data-klee-avatar]';
  function decorate(target) {
    let host = target.parentElement?.classList.contains('kw-host') ? target.parentElement : null;
    if (!host) {
      host = document.createElement('span'); host.className = 'kw-host';
      if (target.matches('.cp-avatar-wrap') || target.dataset.kleeAvatar === 'portrait') host.classList.add('kw-host-portrait');
      target.replaceWith(host); host.append(target);
    }
    host.querySelectorAll(':scope > .kw-frame').forEach(node => node.remove());
    const frame = items.get(equipped.frame);
    // Frames belong on round avatars only; half-length portraits (the chat companion) stay as they are.
    if (frame && !host.classList.contains('kw-host-portrait')) host.prepend(draw(frame, {size: 100, className: 'kw-frame'}));
    host.dataset.kwFrame = frame?.id || '';
  }
  function bubbleMotif(look) {
    const body = look.motif === 'stars' ? [[30, 34, 16, look.border], [70, 26, 10, '#fff'], [62, 70, 12, look.border]].map(([x, y, r, c]) => star4(x, y, r, c)).join('')
      : look.motif === 'sweetflower' ? flower(50, 50, 46, '#fbd3dc', '#ffe08a', '#e88aa0')
      : look.motif === 'letter' ? `<circle cx="50" cy="50" r="34" fill="#b3261e" stroke="#7a1712" stroke-width="4"/><path d="M34 50h32M50 34v32" stroke="#ffd7c8" stroke-width="6" stroke-linecap="round"/>` : '';
    return body ? `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="${SVG}" viewBox="0 0 100 100">${body}</svg>`)}")` : 'none';
  }
  function apply() {
    const root = document.documentElement;
    for (const slot of ['outfit', 'frame', 'bubble', 'title', 'bomb']) {
      const item = items.get(equipped[slot]);
      if (item) root.dataset['klee' + slot[0].toUpperCase() + slot.slice(1)] = item.id; else delete root.dataset['klee' + slot[0].toUpperCase() + slot.slice(1)];
    }
    const bubble = items.get(equipped.bubble);
    if (bubble) {
      root.style.setProperty('--kw-bubble-bg', bubble.look.bg2 ? `linear-gradient(135deg, ${bubble.look.bg}, ${bubble.look.bg2})` : bubble.look.bg);
      root.style.setProperty('--kw-bubble-fg', bubble.look.fg); root.style.setProperty('--kw-bubble-border', bubble.look.border); root.style.setProperty('--kw-bubble-solid', bubble.look.bg);
      root.style.setProperty('--kw-bubble-motif', bubbleMotif(bubble.look));
    } else for (const name of ['--kw-bubble-bg', '--kw-bubble-fg', '--kw-bubble-border', '--kw-bubble-motif', '--kw-bubble-solid']) root.style.removeProperty(name);
    // An outfit swaps Klee's portrait sheets everywhere she appears.
    const outfit = items.get(equipped.outfit);
    if (outfit?.look?.atlas) {
      root.style.setProperty('--kw-outfit-atlas', `url("${outfit.look.atlas}")`);
      root.style.setProperty('--kw-outfit-faces', `url("${outfit.look.expressions || outfit.look.atlas}")`);
      const small = outfit.look.face64 || outfit.look.expressions || outfit.look.atlas;
      root.style.setProperty('--kw-outfit-face', outfit.look.face128 ? `image-set(url("${small}") 1x, url("${outfit.look.face128}") 2x)` : `url("${small}")`);
    } else for (const name of ['--kw-outfit-atlas', '--kw-outfit-faces', '--kw-outfit-face']) root.style.removeProperty(name);
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
