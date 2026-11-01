/* js/klee-wardrobe.js */
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
  function hatArt(look, id) {
    if (look.motif === 'clover') {
      const leaf = r => `<g transform="rotate(${r})"><path fill="url(#${id}c)" stroke="${look.dark}" stroke-width="1.6" d="M0 0C-5-9-20-11-18-24C-16-33-5-31 0-22C5-31 16-33 18-24C20-11 5-9 0 0Z"/><path d="M0-3V-19M0-11L-6-17M0-11L6-17" stroke="${look.dark}" stroke-width="1.2" opacity=".55" fill="none"/><path d="M-12-25Q-10-29-6-27" stroke="#fff" stroke-width="2" opacity=".7" fill="none" stroke-linecap="round"/></g>`;
      return `<defs>${rad(id + 'c', [[0, '#b7f0a8'], [.55, look.color], [1, look.dark]], '50%', '20%', '90%')}</defs><g transform="translate(50 47)"><path d="M2 4Q9 24 4 38" stroke="${look.dark}" stroke-width="4.5" fill="none" stroke-linecap="round"/>${[45, 135, 225, 315].map(leaf).join('')}<circle r="5" fill="#fff6c8" stroke="${look.dark}" stroke-width="1.2"/></g>`;
    }
    if (look.motif === 'flower') {
      const petals = Array.from({length: 6}, (_, i) => `<g transform="rotate(${i * 60})"><path d="M0 0C-12-8-12-30 0-38C12-30 12-8 0 0Z" fill="url(#${id}p)" stroke="${look.dark}" stroke-width="1"/><path d="M0-6V-30" stroke="${look.dark}" stroke-width=".8" opacity=".5"/></g>`).join('');
      return `<defs>${rad(id + 'p', [[0, '#fff'], [.6, look.color], [1, '#d9cff2']], '50%', '75%', '90%')}${rad(id + 'y', [[0, '#fff3b0'], [1, '#f2b53a']], '40%', '40%')}</defs><g transform="translate(50 50) scale(.95)">${petals}<circle r="9" fill="url(#${id}y)" stroke="#c8911d" stroke-width="1"/>${around(7, 5).map(([x, y]) => `<circle cx="${(x - 50).toFixed(1)}" cy="${(y - 50).toFixed(1)}" r="1.4" fill="#b8741a"/>`).join('')}</g>`;
    }
    const points = r => Array.from({length: 10}, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, d = i % 2 ? r * .46 : r; return `${(50 + Math.cos(a) * d).toFixed(1)},${(53 + Math.sin(a) * d).toFixed(1)}`; }).join(' ');
    return `<defs>${lin(id + 's', [[0, '#fff6c2'], [.5, look.color], [1, look.dark]], .3, 1)}</defs><polygon points="${points(44)}" fill="url(#${id}s)" stroke="${look.dark}" stroke-width="2" stroke-linejoin="round"/>`
      + `<polygon points="${points(26)}" fill="#fff" opacity=".35"/>${star4(80, 16, 8, '#fff', 'kw-twinkle')}<circle cx="38" cy="38" r="4.5" fill="#fff" opacity=".85"/>`;
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
    return ({frame: frameArt, hat: hatArt, bubble: bubbleArt, title: titleArt, bomb: bombArt, sticker: stickerArt, outfit: outfitArt}[item.slot] || stickerArt)(look, id);
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
    for (const slot of ['outfit', 'frame', 'hat', 'bubble', 'title', 'bomb']) {
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
      root.style.setProperty('--kw-outfit-face', `url("${outfit.look.face64 || outfit.look.expressions || outfit.look.atlas}")`);
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

;
/* js/lab-math.js */
/* Small, explicit numerical models used by the homepage visualizations. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LabMath = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function softmaxTrace(logits, temperature = 1, topK = logits.length) {
    if (!(temperature > 0) || !Number.isFinite(temperature)) throw new Error('Temperature must be positive.');
    const eligible = logits.map((value, index) => ({value,index})).filter(item=>Number.isFinite(item.value))
      .sort((a,b)=>b.value-a.value || a.index-b.index).slice(0, Math.max(1,topK));
    const result = logits.map(()=>0);
    const max = eligible.length ? eligible[0].value : 0;
    const weights = eligible.map(item=>Math.exp((item.value-max)/temperature));
    const total = weights.reduce((a,b)=>a+b,0);
    eligible.forEach((item,index)=>{result[item.index]=weights[index]/total;});
    return {logits:logits.slice(),temperature,eligible:eligible.map(item=>item.index),max,
      scaled:logits.map(value=>value/temperature),weights:logits.map((_,i)=>{
        const index=eligible.findIndex(item=>item.index===i);return index<0?0:weights[index];
      }),total,probabilities:result};
  }
  function softmax(logits, temperature = 1, topK = logits.length) {
    return softmaxTrace(logits,temperature,topK).probabilities;
  }
  const dot = (a,b) => a.reduce((sum,value,index)=>sum+value*b[index],0);
  function attention(queries, keys, causal = false, temperature = 1) {
    return queries.map((query,row)=>softmax(keys.map((key,column)=>
      causal && column>row ? -Infinity : dot(query,key)/Math.sqrt(query.length)), temperature));
  }
  function random(seed) {
    return () => { seed|=0; seed=seed+0x6D2B79F5|0; let t=Math.imul(seed^seed>>>15,1|seed); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; };
  }
  function network(seed = 27) {
    const rng=random(seed);
    return {w:Array.from({length:4},()=>[rng()*2-1,rng()*2-1]),b:Array.from({length:4},()=>rng()-.5),v:Array.from({length:4},()=>rng()*2-1),c:0};
  }
  function forward(net,x) {
    const preactivation=net.w.map((weights,j)=>dot(weights,x)+net.b[j]);
    const hidden=preactivation.map(value=>Math.tanh(value));
    const z=dot(net.v,hidden)+net.c;
    const output=1/(1+Math.exp(-z));
    return {hidden,output,preactivation,z};
  }
  const datasets = {
    xor: [{x:[-1,-1],y:0},{x:[-1,1],y:1},{x:[1,-1],y:1},{x:[1,1],y:0}],
    linear: [{x:[-1,-1],y:0},{x:[-1,1],y:0},{x:[1,-1],y:1},{x:[1,1],y:1}]
  };
  function gradients(net,data) {
    const g={w:net.w.map(()=>[0,0]),b:net.b.map(()=>0),v:net.v.map(()=>0),c:0};
    let loss=0,correct=0;
    for (const {x,y} of data) {
      const {hidden,output}=forward(net,x);
      const p=Math.max(1e-10,Math.min(1-1e-10,output));
      loss-=y*Math.log(p)+(1-y)*Math.log(1-p);
      correct+=(output>=.5 ? 1:0)===y ? 1:0;
      const delta=output-y;
      g.c+=delta/data.length;
      hidden.forEach((h,j)=>{
        g.v[j]+=delta*h/data.length;
        const d=delta*net.v[j]*(1-h*h)/data.length;
        g.b[j]+=d;
        x.forEach((value,k)=>{g.w[j][k]+=d*value;});
      });
    }
    return {gradient:g,loss:loss/data.length,accuracy:correct/data.length};
  }
  function train(net,data,rate,steps=1) {
    for(let step=0;step<steps;step++) {
      const {gradient:g}=gradients(net,data);
      net.c-=rate*g.c;
      net.w.forEach((weights,j)=>{
        net.b[j]-=rate*g.b[j]; net.v[j]-=rate*g.v[j];
        weights.forEach((_,k)=>{net.w[j][k]-=rate*g.w[j][k];});
      });
    }
    return gradients(net,data);
  }
  return {softmax,dot,attention,random,network,forward,gradients,train,datasets};
});

;
/* js/lab-game-kit.js */
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

;
/* js/lab-fishing.js */
/* Klee's fishing game: K-means clustering on Starfell Lake.
   The player places bombs first; Klee's "secret method" is K-means. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') {
    window.LabFishing = api.model;
    window.LabExperiments = Object.assign(window.LabExperiments || {}, {fishing: api.init});
  }
})(function () {
  'use strict';
  const WIDTH = 640, HEIGHT = 400, MARGIN = 26, RADIUS = 72;

  // ---------- Model: pure and deterministic, so it can be tested in Node. ----------
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const gaussian = rng => { let u = 0; while (!u) u = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng()); };
  const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
  const distance2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

  // A lake holds 3–5 schools of fish plus a few strays.
  function makeLake(seed, count = 54) {
    const rng = random(seed), wanted = 3 + Math.floor(rng() * 3), centers = [];
    for (let attempt = 0; centers.length < wanted && attempt < 500; attempt++) {
      const center = {x: 90 + rng() * (WIDTH - 180), y: 80 + rng() * (HEIGHT - 160)};
      if (centers.every(other => distance2(other, center) > 125 ** 2)) centers.push({...center, spread: 20 + rng() * 22});
    }
    const fish = [], strays = Math.round(count * 0.1);
    for (let i = 0; i < count; i++) {
      let x, y;
      if (i < count - strays) {
        const center = centers[i % centers.length];
        x = center.x + gaussian(rng) * center.spread; y = center.y + gaussian(rng) * center.spread * 0.8;
      } else { x = MARGIN + rng() * (WIDTH - 2 * MARGIN); y = MARGIN + rng() * (HEIGHT - 2 * MARGIN); }
      fish.push({x: Math.round(clamp(x, MARGIN, WIDTH - MARGIN)), y: Math.round(clamp(y, MARGIN, HEIGHT - MARGIN)), flip: rng() < 0.5});
    }
    return {seed, schools: centers.length, fish};
  }

  function nearest(point, centers) {
    let index = 0, best = Infinity;
    centers.forEach((center, k) => { const d = distance2(point, center); if (d < best) { best = d; index = k; } });
    return {index, distance2: best};
  }
  const assign = (fish, centers) => fish.map(point => nearest(point, centers).index);
  // Each bomb moves to the mean of the fish that chose it; an empty bomb stays.
  function update(fish, labels, centers) {
    return centers.map((center, k) => {
      let x = 0, y = 0, n = 0;
      labels.forEach((label, i) => { if (label === k) { x += fish[i].x; y += fish[i].y; n++; } });
      return n ? {x: x / n, y: y / n} : {...center};
    });
  }
  const sse = (fish, centers) => fish.reduce((sum, point) => sum + nearest(point, centers).distance2, 0);
  const labeledSse = (fish, labels, centers) => fish.reduce((sum, point, i) => sum + distance2(point, centers[labels[i]]), 0);
  const caught = (fish, bombs, radius = RADIUS) => fish.map(point => bombs.some(bomb => distance2(point, bomb) <= radius * radius));
  const averageDistance = (fish, centers) => Math.sqrt(sse(fish, centers) / Math.max(1, fish.length));

  // k-means++: the first start is a random fish; later starts favour fish far
  // from every start chosen so far (probability ∝ squared distance).
  function initCenters(fish, k, rng) {
    const first = fish[Math.floor(rng() * fish.length)], centers = [{x: first.x, y: first.y}];
    while (centers.length < k) {
      const weights = fish.map(point => nearest(point, centers).distance2), total = weights.reduce((a, b) => a + b, 0);
      let pick = rng() * total, index = 0;
      while (index < fish.length - 1 && (pick -= weights[index]) > 0) index++;
      centers.push({x: fish[index].x, y: fish[index].y});
    }
    return centers;
  }

  // Every animation frame is one real step of the algorithm.
  function kmeans(fish, k, seed, maxRounds = 30) {
    const rng = random((seed * 31 + k) ^ 0x9e3779b9), frames = [];
    let centers = initCenters(fish, k, rng), labels = null;
    frames.push({type: 'init', centers, sse: sse(fish, centers)});
    for (let round = 1; round <= maxRounds; round++) {
      const next = assign(fish, centers), changed = labels ? next.filter((label, i) => label !== labels[i]).length : fish.length;
      frames.push({type: 'assign', round, labels: next, changed, centers, sse: labeledSse(fish, next, centers)});
      if (labels && changed === 0) break;
      labels = next;
      const moved = update(fish, labels, centers);
      frames.push({type: 'update', round, labels, from: centers, centers: moved, sse: labeledSse(fish, labels, moved)});
      centers = moved;
    }
    frames.push({type: 'done', labels, centers, sse: sse(fish, centers)});
    return frames;
  }

  const model = {WIDTH, HEIGHT, RADIUS, random, makeLake, nearest, assign, update, sse, labeledSse, caught, averageDistance, initCenters, kmeans};

  // ---------- Game ----------
  const STORE = 'lsworld.klee.fishing.v1', COLORS = 5;
  const ELEMENTS = ['火', '水', '风', '雷', '岩'];
  function init(panel) {
    const $ = selector => panel.querySelector(selector);
    const kit = window.LabGameKit, {svg, reduced, restart} = kit;
    const lake = $('[data-fish-lake]'), stage = $('.fish-stage'), school = $('[data-fish-school]'), bombs = $('[data-fish-bombs]');
    const lines = $('[data-fish-lines]'), arrows = $('[data-fish-arrows]'), blasts = $('[data-fish-blasts]'), effects = $('[data-fish-fx]');
    const preview = $('[data-fish-preview]'), banner = $('[data-fish-banner]'), hudLake = $('[data-fish-hud-lake]'), hudState = $('[data-fish-hud-state]');
    const face = $('[data-fish-face]'), bubble = $('.fish-klee-line'), line = $('[data-fish-line]'), kInput = $('#fish-k'), kValue = $('[data-fish-k-value]');
    const insightToggle = $('[data-fish-insight-toggle]'), insight = $('[data-fish-insight]'), insightStep = $('[data-fish-insight-step]');
    const sseLine = $('[data-fish-sse-line]'), sseArea = $('[data-fish-sse-area]'), sseValue = $('[data-fish-sse-value]');
    const throwButton = $('[data-fish-throw]'), randomButton = $('[data-fish-random]'), algorithmButton = $('[data-fish-algorithm]');
    const stepButton = $('[data-fish-step]'), skipButton = $('[data-fish-skip]'), againButton = $('[data-fish-again]'), newButton = $('[data-fish-new]');
    const seedLabel = $('[data-fish-seed]'), scorePlayer = $('[data-fish-score="player"]'), scoreKlee = $('[data-fish-score="klee"]');
    const jean = $('[data-fish-jean]'), jeanButton = $('[data-fish-jean-close]'), verdict = $('[data-fish-verdict]');

    // ----- Klee hosts the game: bubble, expressions, banner and voice (Jean speaks too) -----
    const {say, setFace, announce, voice, stopVoice, recording} = kit.host(panel, {face, bubble, line, banner, toggle: $('[data-fish-voice-toggle]'),
      talker: record => record.speaker === 'jean' ? jean : face, voiceAttr: 'fishVoice'});

    const stats = kit.stats(STORE, {rounds: 0, wins: 0, best: 0, jail: 0}).data, save = () => kit.store.set(STORE, JSON.stringify(stats));
    const showStats = () => {
      $('[data-fish-stat="rounds"]').textContent = stats.rounds; $('[data-fish-stat="wins"]').textContent = stats.wins; $('[data-fish-stat="jail"]').textContent = stats.jail;
    };

    let water = null, fishNodes = [], player = [], frames = [], frameIndex = 0, timer = null, phase = 'place', playerCaught = 0, sseHistory = [];
    const k = () => Number(kInput.value);
    const clock = kit.timers(), wait = clock.wait;
    const setPhase = value => {
      phase = value; panel.dataset.fishPhase = value;
      throwButton.disabled = value !== 'place' || player.length !== k();
      randomButton.disabled = value !== 'place';
      algorithmButton.disabled = !['thrown', 'algorithm'].includes(value);
      stepButton.disabled = skipButton.disabled = value !== 'algorithm';
      algorithmButton.textContent = value === 'algorithm' ? (timer ? '暂停' : '继续播放') : '看可莉的算法';
      hud();
    };
    function hud() {
      if (!water) return;
      hudLake.textContent = `湖面 #${water.seed} · ${water.fish.length} 条鱼`;
      hudState.replaceChildren();
      if (phase === 'place') {
        for (let i = 0; i < k(); i++) { const icon = document.createElement('i'); icon.className = 'fish-hud-bomb' + (i < player.length ? ' is-placed' : ''); hudState.append(icon); }
        const label = document.createElement('span'); label.textContent = `${player.length}/${k()}`; hudState.append(label);
      } else {
        const label = document.createElement('span');
        const frame = frames[frameIndex - 1];
        label.textContent = phase === 'done' ? '本局结算' : phase === 'algorithm' || phase === 'finishing' ? (frame?.round ? `可莉 · 第 ${frame.round} 轮` : '可莉的回合') : '旅行者扔出啦';
        hudState.append(label);
      }
    }
    const describe = () => lake.setAttribute('aria-label', `星落湖，${water.fish.length} 条鱼，` +
      (phase === 'place' ? `已放 ${player.length}/${k()} 颗炸弹` : phase === 'done' ? '本局已结束' : '炸弹已扔出'));

    // ----- Drawing -----
    function drawFish(point, i) {
      const size = 0.82 + ((point.x * 7 + point.y * 13 + i) % 29) / 100;
      const group = svg('g', {class: 'fish', transform: `translate(${point.x} ${point.y})`}, school);
      svg('ellipse', {class: 'fish-shadow', cx: 2, cy: 8, rx: 11 * size, ry: 2.6 * size}, group);
      const swim = svg('g', {class: 'fish-swim'}, group);
      swim.style.setProperty('--delay', `${-((i * 0.37) % 3).toFixed(2)}s`); swim.style.setProperty('--swim', `${(2.6 + (i % 5) * 0.35).toFixed(2)}s`);
      const body = svg('g', {class: 'fish-body'}, swim), shape = svg('g', {transform: `scale(${point.flip ? -size : size} ${size})`}, body);
      svg('path', {class: 'fish-tail', d: 'M-10 0L-16.5-6.5Q-14 0-16.5 6.5Z'}, shape);
      svg('path', {class: 'fish-fin', d: 'M-4-5Q1-11 6-5Z'}, shape);
      svg('path', {class: 'fish-skin', d: 'M12.5 0C9.5-6.5 0-7.8-6-5.2C-9-3.6-11-1.2-11 0C-11 1.2-9 3.6-6 5.2C0 7.8 9.5 6.5 12.5 0Z'}, shape);
      svg('path', {class: 'fish-belly', d: 'M11.6 1C8.4 5.4 0 6.8-6 4.6C-8.4 3.5-10 1.8-10.6.7Z'}, shape);
      svg('path', {class: 'fish-fin fish-pectoral', d: 'M1.5 2.2Q-1.5 6.6-4.2 3.6Z'}, shape);
      svg('path', {class: 'fish-detail', d: 'M5.6-3.8Q3.8 0 5.6 3.8M-.5-2.4q1.6 1.7 0 3.4M-4.2-2.2q1.5 1.6 0 3.2'}, shape);
      svg('circle', {class: 'fish-eye-white', cx: 8, cy: -1.6, r: 2}, shape);
      svg('circle', {class: 'fish-eye', cx: 8.5, cy: -1.5, r: 1.15}, shape);
      svg('circle', {class: 'fish-eye-shine', cx: 8.9, cy: -2.1, r: .45}, shape);
      svg('text', {class: 'fish-pop', y: -12}, group).textContent = '+1';
      return group;
    }
    function drawWater() {
      for (const layer of [school, lines, arrows, blasts, bombs, effects]) layer.replaceChildren();
      bombs.dataset.owner = '';
      fishNodes = water.fish.map(drawFish);
    }
    function colorFish(labels = null, caughtList = null) {
      fishNodes.forEach((node, i) => {
        node.setAttribute('class', 'fish' + (labels ? ' cluster-' + (labels[i] % COLORS) : '') + (caughtList?.[i] ? ' is-caught' : ''));
        if (caughtList?.[i]) node.querySelector('.fish-pop').style.animationDelay = `${(i % 9) * 40}ms`;
      });
    }
    function makeBomb(index, owner, drop) {
      const group = svg('g', {class: `fish-bomb fish-bomb-${owner} cluster-${index % COLORS}` + (drop ? ' is-dropping' : '')});
      svg('circle', {class: 'fish-range', r: RADIUS}, group);
      svg('circle', {class: 'fish-range-spin', r: RADIUS - 3}, group);
      svg('ellipse', {class: 'fish-bomb-shadow', cy: 13, rx: 10, ry: 3}, group);
      const piece = svg('g', {class: 'fish-bomb-piece'}, group);
      svg('path', {class: 'fish-fuse', d: 'M5-9Q8-16 14-14'}, piece);
      svg('circle', {class: 'fish-fuse-spark', cx: 14.5, cy: -14.5, r: 2.6}, piece);
      svg('circle', {class: 'fish-bomb-body', r: 11}, piece);
      svg('path', {class: 'fish-bomb-star', d: 'M-3-6.5L-1.8-3.3 1.4-2.1-1.8-.9-3 2.3-4.2-.9-7.4-2.1-4.2-3.3Z'}, piece);
      svg('ellipse', {class: 'fish-bomb-shine', cx: 4, cy: -5, rx: 3, ry: 1.8, transform: 'rotate(30 4 -5)'}, piece);
      svg('circle', {class: 'fish-bomb-badge', cx: 8.5, cy: 8.5, r: 6}, piece);
      svg('text', {class: 'fish-bomb-label', x: 8.5, y: 11.4}, piece).textContent = index + 1;
      return group;
    }
    // Reuse bomb nodes so Klee's bombs glide between rounds.
    function drawBombs(list, owner, {drop = false} = {}) {
      const rebuild = bombs.dataset.owner !== owner || bombs.children.length > list.length;
      if (rebuild) { bombs.replaceChildren(); bombs.dataset.owner = owner; }
      list.forEach((bomb, i) => {
        let group = bombs.children[i];
        if (!group) { group = makeBomb(i, owner, drop); bombs.append(group); if (drop) splash(bomb); }
        group.classList.remove('is-spent');
        group.style.transform = `translate(${bomb.x}px, ${bomb.y}px)`;
      });
    }
    function drawLines(labels, centers) {
      lines.replaceChildren();
      if (!insightToggle.checked || !labels || !centers.length) return;
      water.fish.forEach((point, i) => {
        const center = centers[labels[i]];
        svg('line', {class: 'fish-line cluster-' + (labels[i] % COLORS), x1: center.x, y1: center.y, x2: point.x, y2: point.y}, lines);
      });
    }
    function drawArrows(from = [], to = []) {
      arrows.replaceChildren();
      if (!insightToggle.checked) return;
      from.forEach((start, i) => {
        if (distance2(start, to[i]) < 1) return;
        svg('circle', {class: 'fish-ghost', cx: start.x, cy: start.y, r: 11}, arrows);
        svg('line', {class: 'fish-arrow', x1: start.x, y1: start.y, x2: to[i].x, y2: to[i].y, 'marker-end': 'url(#fish-arrowhead)'}, arrows);
      });
    }
    function splash(at) {
      if (reduced()) return;
      const ring = svg('circle', {class: 'fish-splash', cx: at.x, cy: at.y, r: 16}, effects);
      wait(() => ring.remove(), 900);
    }
    function blast(list, done) {
      blasts.replaceChildren(); effects.replaceChildren();
      [...bombs.children].forEach(group => group.classList.add('is-spent'));
      const quiet = reduced(), parts = [];
      for (const bomb of list) {
        parts.push(svg('circle', {class: 'fish-flash', cx: bomb.x, cy: bomb.y, r: RADIUS}, blasts));
        parts.push(svg('circle', {class: 'fish-shock', cx: bomb.x, cy: bomb.y, r: RADIUS}, blasts));
        svg('circle', {class: 'fish-scorch', cx: bomb.x, cy: bomb.y, r: RADIUS * 0.92}, blasts);
        if (quiet) continue;
        for (let i = 0; i < 12; i++) {
          const angle = i / 12 * Math.PI * 2 + (bomb.x % 7) / 10, reach = RADIUS * (0.55 + (i % 3) * 0.2), drop = i % 2;
          const bit = svg(drop ? 'circle' : 'path', drop ? {class: 'fish-droplet', cx: bomb.x, cy: bomb.y, r: 2.6}
            : {class: 'fish-ember', d: `M${bomb.x} ${bomb.y - 4}l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z`}, effects);
          bit.style.setProperty('--dx', `${(Math.cos(angle) * reach).toFixed(1)}px`); bit.style.setProperty('--dy', `${(Math.sin(angle) * reach).toFixed(1)}px`);
          bit.style.animationDelay = `${(i % 4) * 25}ms`;
        }
      }
      if (!quiet) restart(stage, 'is-shaking');
      requestAnimationFrame(() => requestAnimationFrame(() => parts.forEach(part => part.classList.add('is-on'))));
      wait(() => { stage.classList.remove('is-shaking'); done(); }, quiet ? 60 : 520);
      wait(() => effects.replaceChildren(), quiet ? 60 : 1400);
    }
    function showSse() {
      const values = sseHistory, max = Math.max(...values, 1), min = Math.min(...values, max);
      const points = values.map((value, i) => [values.length > 1 ? 6 + i / (values.length - 1) * 288 : 6, 60 - (value - min) / Math.max(1, max - min) * 50]);
      sseLine.setAttribute('points', points.map(p => p.join(',')).join(' '));
      sseArea.setAttribute('points', points.length ? `6,64 ${points.map(p => p.join(',')).join(' ')} ${points.at(-1)[0]},64` : '');
      sseValue.textContent = values.length ? Math.round(values[0]).toLocaleString() + ' → ' + Math.round(values.at(-1)).toLocaleString() : '—';
    }
    function score(node, caughtCount, distance) {
      const strong = node.querySelector('strong'), bar = node.querySelector('.fish-score-bar i'), total = water.fish.length;
      node.querySelector('small').textContent = distance === null ? '平均距离 —' : `平均距离 ${Math.round(distance)}`;
      bar.style.width = caughtCount === null ? '0%' : `${caughtCount / total * 100}%`;
      if (caughtCount === null) { strong.textContent = '—'; return; }
      if (reduced()) { strong.textContent = `${caughtCount} / ${total}`; return; }
      const begin = performance.now();
      // A frame timestamp can precede `begin`; clamp so the count never goes negative.
      const tick = now => { const t = Math.max(0, Math.min(1, (now - begin) / 650)); strong.textContent = `${Math.round(caughtCount * (1 - (1 - t) ** 3))} / ${total}`; if (t < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    const point = (value, digits = 0) => `(${value.x.toFixed(digits)}, ${value.y.toFixed(digits)})`;

    // ----- Player's turn -----
    function renderPlace(drop = false) {
      drawBombs(player, 'player', {drop});
      const labels = player.length ? model.assign(water.fish, player) : null;
      colorFish(insightToggle.checked ? labels : null); drawLines(labels, player);
      setPhase('place'); describe();
      if (player.length === k()) { say(`${k()} 颗都放好啦！点“扔炸弹！”试试看～`, 'laugh'); if (drop) voice('klee-ready', {minor: true}); }
      else if (player.length) say(`还可以再放 ${k() - player.length} 颗。点一下已经放的炸弹，可以把它拿起来哦。`, 'curious');
    }
    function lakePoint(event) {
      const matrix = lake.getScreenCTM(); if (!matrix) return null;
      const p = lake.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const q = p.matrixTransform(matrix.inverse());
      return {x: Math.round(clamp(q.x, 0, WIDTH)), y: Math.round(clamp(q.y, 0, HEIGHT))};
    }
    lake.addEventListener('click', event => {
      if (phase !== 'place') return;
      const at = lakePoint(event); if (!at) return;
      const hit = player.findIndex(bomb => distance2(bomb, at) <= 18 * 18);
      if (hit >= 0) { player.splice(hit, 1); bombs.dataset.owner = ''; renderPlace(); }
      else if (player.length < k()) { player.push(at); renderPlace(true); }
      else { say('炸弹已经放满啦！点一下已经放的炸弹，可以把它拿起来哦。', 'wink'); return; }
      preview.setAttribute('hidden', '');
    });
    lake.addEventListener('pointermove', event => {
      if (phase !== 'place' || player.length >= k() || event.pointerType === 'touch') { preview.setAttribute('hidden', ''); return; }
      const at = lakePoint(event); if (!at) return;
      preview.setAttribute('transform', `translate(${at.x} ${at.y})`); preview.removeAttribute('hidden');
    });
    lake.addEventListener('pointerleave', () => preview.setAttribute('hidden', ''));
    randomButton.addEventListener('click', () => {
      const rng = random(Date.now());
      while (player.length < k()) player.push({x: Math.round(MARGIN + rng() * (WIDTH - 2 * MARGIN)), y: Math.round(MARGIN + rng() * (HEIGHT - 2 * MARGIN))});
      renderPlace(true);
    });
    throwButton.addEventListener('click', () => {
      if (phase !== 'place' || player.length !== k()) return;
      setPhase('throwing'); lines.replaceChildren(); preview.setAttribute('hidden', '');
      say('嘿——咻！蹦蹦炸弹出发！', 'laugh'); voice('klee-throw');
      blast(player, () => {
        const result = model.caught(water.fish, player); playerCaught = result.filter(Boolean).length;
        colorFish(insightToggle.checked ? model.assign(water.fish, player) : null, result);
        score(scorePlayer, playerCaught, model.averageDistance(water.fish, player));
        const share = playerCaught / water.fish.length;
        say(share >= 0.7 ? `哇！炸到了 ${playerCaught} 条！旅行者好厉害！可莉要用秘密方法挑战你！` : share >= 0.4
          ? `炸到 ${playerCaught} 条！嘿嘿，看可莉的秘密方法能不能炸得更多～` : `只炸到 ${playerCaught} 条……鱼都跑啦！看可莉的秘密方法！`,
          share >= 0.7 ? 'laugh' : share >= 0.4 ? 'happy' : 'wink');
        voice(share >= 0.7 ? 'klee-big' : share >= 0.4 ? 'klee-mid' : 'klee-small', {queue: true});
        setPhase('thrown'); describe();
      });
    });

    // ----- Klee's turn: K-means, one real step per frame -----
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function showFrame(frame) {
      if (frame.sse !== undefined) { sseHistory.push(frame.sse); showSse(); }
      if (frame.type === 'init') {
        colorFish(); lines.replaceChildren(); arrows.replaceChildren(); blasts.replaceChildren(); drawBombs(frame.centers, 'klee', {drop: true});
        announce('可莉的回合！'); voice('klee-start');
        say('可莉的秘密方法开始！先挑几个起点：离已有炸弹越远的鱼，越可能被选中。', 'thinking');
        insightStep.textContent = `初始化（K-means++）：随机选一条鱼作为第 1 颗炸弹，后面每颗按“离最近炸弹的距离平方”加权抽选。起点：${frame.centers.map(c => point(c)).join('、')}。`;
      } else if (frame.type === 'assign') {
        colorFish(frame.labels); drawLines(frame.labels, frame.centers); arrows.replaceChildren();
        if (frame.changed) announce(`第 ${frame.round} 轮 · 认领`);
        if (frame.round === 1) voice('klee-assign', {queue: true}); else if (!frame.changed) voice('klee-settled', {minor: true});
        say(frame.round === 1 ? '第 1 轮·认领：每条鱼找离自己最近的炸弹，颜色一样的就是同一队！'
          : frame.changed ? `第 ${frame.round} 轮·认领：有 ${frame.changed} 条鱼换了炸弹～` : `第 ${frame.round} 轮·认领：没有鱼换炸弹啦，位置定下来了！`, frame.changed ? 'thinking' : 'proud');
        const sizes = Array.from({length: frame.centers.length}, (_, c) => `${ELEMENTS[c % COLORS]}队 ${frame.labels.filter(label => label === c).length}`);
        insightStep.textContent = `第 ${frame.round} 轮 · 分配：c(i) = argmin‖xᵢ − μₖ‖²。${sizes.join('，')} 条；` +
          `${frame.round === 1 ? '首次分配' : frame.changed + ' 条鱼改变了归属'}。`;
      } else if (frame.type === 'update') {
        drawArrows(frame.from, frame.centers); drawBombs(frame.centers, 'klee'); drawLines(frame.labels, frame.centers);
        const moves = frame.from.map((start, c) => Math.sqrt(distance2(start, frame.centers[c]))), far = moves.indexOf(Math.max(...moves));
        say(`第 ${frame.round} 轮·挪动：每颗炸弹挪到自己那队鱼的正中间！`, 'curious');
        if (frame.round === 1) voice('klee-update', {minor: true});
        insightStep.textContent = `第 ${frame.round} 轮 · 更新：μₖ = 分到第 k 颗炸弹的鱼的平均位置。移动最多的是第 ${far + 1} 颗：` +
          `${point(frame.from[far])} → ${point(frame.centers[far])}，挪了 ${moves[far].toFixed(1)}。`;
      } else if (frame.type === 'done') finish(frame);
      hud();
    }
    function advance() {
      if (frameIndex >= frames.length) { stopTimer(); return; }
      showFrame(frames[frameIndex++]);
      if (frameIndex >= frames.length) stopTimer();
      setPhase(frameIndex >= frames.length ? phase : 'algorithm');
    }
    function play() { stopTimer(); timer = setInterval(advance, reduced() ? 700 : 1100); setPhase('algorithm'); }
    function finish(frame) {
      stopTimer(); setPhase('finishing'); lines.replaceChildren(); arrows.replaceChildren(); drawBombs(frame.centers, 'klee');
      announce('嘿——咻！'); voice('klee-blast');
      say('找到啦，就是这里！嘿——咻！', 'laugh');
      blast(frame.centers, () => {
        const result = model.caught(water.fish, frame.centers), kleeCaught = result.filter(Boolean).length;
        colorFish(frame.labels, result);
        const playerDistance = model.averageDistance(water.fish, player), kleeDistance = model.averageDistance(water.fish, frame.centers);
        score(scoreKlee, kleeCaught, kleeDistance);
        // Where the player threw, for a side-by-side comparison.
        player.forEach(bomb => { const mine = svg('g', {class: 'fish-mine', transform: `translate(${bomb.x} ${bomb.y})`}, arrows);
          svg('circle', {r: 12}, mine); svg('text', {y: 4}, mine).textContent = '你'; });
        scorePlayer.classList.toggle('is-winner', playerCaught > kleeCaught); scoreKlee.classList.toggle('is-winner', kleeCaught > playerCaught);
        stats.rounds++; if (playerCaught > kleeCaught) stats.wins++; stats.best = Math.max(stats.best, playerCaught);
        const closer = kleeDistance < playerDistance;
        announce(playerCaught > kleeCaught ? '旅行者胜！' : playerCaught === kleeCaught ? '平手！' : '可莉胜！');
        say(playerCaught > kleeCaught ? `哎呀，旅行者炸到 ${playerCaught} 条，可莉只有 ${kleeCaught} 条，你赢啦！` : playerCaught === kleeCaught
          ? `平手！都是 ${kleeCaught} 条，嘿嘿～` : `可莉炸到 ${kleeCaught} 条，旅行者 ${playerCaught} 条，可莉赢啦！好耶！`,
          playerCaught > kleeCaught ? 'care' : playerCaught === kleeCaught ? 'happy' : 'proud');
        voice(playerCaught > kleeCaught ? 'klee-lose' : playerCaught === kleeCaught ? 'klee-tie' : 'klee-win', {queue: true});
        verdict.textContent = (playerCaught > kleeCaught && closer
          ? `你炸到的更多，但可莉的炸弹离鱼的平均距离更小（${Math.round(kleeDistance)} 对 ${Math.round(playerDistance)}）。K-means 追求的是“离得近”，不是“炸得多”，所以它不一定赢。`
          : `可莉的炸弹离鱼的平均距离是 ${Math.round(kleeDistance)}，你的是 ${Math.round(playerDistance)}。K-means 每一轮都让这个距离变得更小。`)
          + ` 这片湖其实有 ${water.schools} 群鱼${water.schools === k() ? '，K 正好选对了！' : `，试试把 K 设成 ${water.schools}？`}`;
        verdict.hidden = false;
        insightStep.textContent = `收敛：第 ${frames.at(-2).round} 轮没有鱼改变归属，算法停止。距离平方和（SSE）从 ${Math.round(sseHistory[0])} 降到 ${Math.round(frame.sse)}。`;
        save(); showStats(); setPhase('done'); describe();
        if (stats.rounds % 3 === 0) wait(() => { stats.jail++; save(); showStats(); setFace('care'); jean.hidden = false; jeanButton.focus();
          const lineId = stats.jail % 2 ? 'jean-caught' : 'jean-lecture';
          const subtitle = $('[data-fish-jean-line]');
          if (subtitle && recording(lineId)?.text) subtitle.textContent = recording(lineId).text;
          voice(lineId, {queue: true}); }, reduced() ? 100 : 1400);
      });
    }
    algorithmButton.addEventListener('click', () => {
      if (phase === 'thrown') {
        frames = model.kmeans(water.fish, k(), water.seed); frameIndex = 0; sseHistory = []; verdict.hidden = true;
        colorFish(); advance(); play(); return;
      }
      if (phase === 'algorithm') { if (timer) { stopTimer(); setPhase('algorithm'); } else play(); }
    });
    stepButton.addEventListener('click', () => { stopTimer(); advance(); });
    skipButton.addEventListener('click', () => { stopTimer(); while (frameIndex < frames.length - 1) { const frame = frames[frameIndex++]; if (frame.sse !== undefined) sseHistory.push(frame.sse); } advance(); });

    // ----- Rounds -----
    function again() {
      stopTimer(); stopVoice(); clock.clear();
      player = []; frames = []; frameIndex = 0; sseHistory = []; playerCaught = 0;
      stage.classList.remove('is-shaking'); drawWater(); score(scorePlayer, null, null); score(scoreKlee, null, null);
      scorePlayer.classList.remove('is-winner'); scoreKlee.classList.remove('is-winner'); verdict.hidden = true; jean.hidden = true;
      insightStep.textContent = '放下炸弹后，这里会显示每条鱼离哪颗炸弹最近。'; showSse();
      setPhase('place'); describe();
      say(`湖里有 ${water.fish.length} 条鱼！点湖面放下 ${k()} 颗蹦蹦炸弹，虚线圈就是爆炸范围。旅行者先来！`, 'happy');
      voice('klee-intro');
    }
    function newLake(seed = 1000 + Math.floor(Math.random() * 9000)) { water = model.makeLake(seed); seedLabel.textContent = '#' + seed; again(); }
    againButton.addEventListener('click', again);
    newButton.addEventListener('click', () => newLake());
    kInput.addEventListener('input', () => {
      kValue.textContent = k();
      if (phase === 'place') { player = player.slice(0, k()); bombs.dataset.owner = ''; renderPlace(); if (!player.length) again(); } else again();
    });
    insightToggle.addEventListener('change', () => {
      insight.hidden = !insightToggle.checked;
      if (phase === 'place') renderPlace();
      else if (phase === 'algorithm' || phase === 'done') {
        const last = frames[Math.max(0, frameIndex - 1)];
        drawLines(phase === 'done' ? null : last?.labels, last?.centers || []);
        if (last?.type === 'update') drawArrows(last.from, last.centers); else if (phase !== 'done') arrows.replaceChildren();
      }
    });
    jeanButton.addEventListener('click', () => { jean.hidden = true; say('对不起嘛……可莉知道错了，下次……下次换个湖炸！', 'care'); voice('klee-sorry'); });

    const seedFromHash = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('lake'));
    kValue.textContent = k(); insight.hidden = !insightToggle.checked; showStats();
    newLake(Number.isSafeInteger(seedFromHash) && seedFromHash > 0 ? seedFromHash : undefined);
    // Switching tabs, hiding the page or leaving pauses the animation.
    return () => { stopVoice(); if (timer) { stopTimer(); setPhase('algorithm'); } };
  }

  return {model, init};
});

;
/* js/lab-hike.js */
/* Klee hikes down to the treasure chest: gradient descent on a foggy mountain.
   The player leads first through the fog; Klee's "secret" is gradient descent. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') {
    window.LabHike = api.model;
    window.LabExperiments = Object.assign(window.LabExperiments || {}, {hike: api.init});
  }
})(function () {
  'use strict';
  // The map shows u ∈ [-3, 3] by v ∈ [-1.875, 1.875] on a 640 × 400 view.
  const WIDTH = 640, HEIGHT = 400, SCALE = WIDTH / 6, U = 3, V = HEIGHT / SCALE / 2;
  const CHEST_RADIUS = 0.2, STRIDE = 0.5, PLAYER_STEPS = 10, MAX_STEPS = 40, METRES = 1200;

  // ---------- Model: pure and deterministic, so it can be tested in Node. ----------
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const distance = (a, b) => Math.hypot(a.u - b.u, a.v - b.v);
  const inBounds = p => Math.abs(p.u) <= U && Math.abs(p.v) <= V;
  const toView = p => ({x: (p.u + U) * SCALE, y: (V - p.v) * SCALE});
  const toMap = q => ({u: q.x / SCALE - U, v: V - q.y / SCALE});

  // The mountain tilts toward the chest (an elongated bowl) with Gaussian wells
  // for the chest valley and the slime pit, plus hills for scenery.
  const BOWL = 0.22, STRETCH = 1.6;
  function height(map, p) {
    let f = BOWL * ((p.u - map.bowl.u) ** 2 + STRETCH * (p.v - map.bowl.v) ** 2);
    for (const t of map.terms) f += t.a * Math.exp(-((p.u - t.u) ** 2 + (p.v - t.v) ** 2) / (2 * t.s * t.s));
    return f;
  }
  function gradient(map, p) {
    let gu = 2 * BOWL * (p.u - map.bowl.u), gv = 2 * BOWL * STRETCH * (p.v - map.bowl.v);
    for (const t of map.terms) {
      const e = t.a * Math.exp(-((p.u - t.u) ** 2 + (p.v - t.v) ** 2) / (2 * t.s * t.s)) / (t.s * t.s);
      gu -= e * (p.u - t.u); gv -= e * (p.v - t.v);
    }
    return {u: gu, v: gv};
  }
  // Settle onto the exact minimum near a well with tiny, safe steps.
  function settle(map, p) {
    let q = {...p};
    for (let i = 0; i < 4000; i++) { const g = gradient(map, q); q = {u: q.u - 0.02 * g.u, v: q.v - 0.02 * g.v}; }
    return q;
  }
  // Distance from p to the segment a → b.
  function offPath(p, a, b) {
    const du = b.u - a.u, dv = b.v - a.v, t = Math.max(0, Math.min(1, ((p.u - a.u) * du + (p.v - a.v) * dv) / (du * du + dv * dv)));
    return Math.hypot(p.u - a.u - du * t, p.v - a.v - dv * t);
  }
  // Camp high on one side, chest in the lowest valley, a slime pit near the way down.
  function makeMap(seed) {
    const rng = random(seed), pick = (low, high) => low + rng() * (high - low);
    for (let attempt = 0; attempt < 80; attempt++) {
      const chest = {u: pick(-1.8, 1.8), v: pick(-1, 1)};
      let start = null;
      for (let i = 0; i < 40 && !start; i++) {
        const angle = rng() * Math.PI * 2, reach = pick(2.8, 4.2), p = {u: chest.u + Math.cos(angle) * reach, v: chest.v + Math.sin(angle) * reach};
        if (Math.abs(p.u) <= 2.6 && Math.abs(p.v) <= 1.5) start = p;
      }
      if (!start) continue;
      const along = pick(.42, .6), side = (rng() < .5 ? -1 : 1) * pick(.15, .35), du = chest.u - start.u, dv = chest.v - start.v, length = Math.hypot(du, dv);
      const pit = {u: start.u + du * along - dv / length * side, v: start.v + dv * along + du / length * side};
      const hills = [];
      for (let i = 0; i < 60 && hills.length < 2; i++) {
        const hill = {u: pick(-2.7, 2.7), v: pick(-1.6, 1.6)};
        if (offPath(hill, start, chest) > 1 && distance(hill, chest) > 1.2 && hills.every(other => distance(other, hill) > 1)) hills.push(hill);
      }
      const map = {seed, bowl: chest, start, terms: [{a: -1.2, ...chest, s: .8}, {a: -.7, ...pit, s: .32}, ...hills.map(hill => ({a: pick(.35, .5), ...hill, s: pick(.4, .55)}))]};
      map.chest = settle(map, chest); map.pit = settle(map, pit);
      // The pit must stay a separate, shallower basin.
      if (distance(map.chest, map.pit) < .8 || height(map, map.pit) <= height(map, map.chest) + .12) continue;
      let low = Infinity, high = -Infinity;
      for (let i = 0; i <= 120; i++) for (let j = 0; j <= 75; j++) {
        const h = height(map, {u: -U + i / 120 * 2 * U, v: -V + j / 75 * 2 * V}); low = Math.min(low, h); high = Math.max(high, h);
      }
      // The grid can miss the exact bottom; the chest defines sea level.
      map.low = Math.min(low, height(map, map.chest)); map.high = high;
      if (altitude(map, start) < 450) continue;   // the camp stays high on the mountain
      return map;
    }
    throw new Error('No playable mountain for this number.');
  }
  const altitude = (map, p) => Math.max(0, Math.round((height(map, p) - map.low) / (map.high - map.low) * METRES));

  // One real gradient-descent run. momentum = 0 is plain descent.
  function descend(map, {rate, momentum = 0, maxSteps = MAX_STEPS}) {
    let p = {...map.start}, velocity = {u: 0, v: 0}, outcome = 'tired', zigzags = 0, previous = null;
    const frames = [{step: 0, p, g: gradient(map, p), move: 0, alt: altitude(map, p)}];
    for (let step = 1; step <= maxSteps; step++) {
      const g = gradient(map, p);
      velocity = {u: momentum * velocity.u - rate * g.u, v: momentum * velocity.v - rate * g.v};
      const next = {u: p.u + velocity.u, v: p.v + velocity.v}, move = Math.hypot(velocity.u, velocity.v);
      if (previous && previous.u * velocity.u + previous.v * velocity.v < 0) zigzags++;
      previous = velocity;
      if (!inBounds(next)) { frames.push({step, from: p, p: next, g, move, alt: null}); outcome = 'flew'; break; }
      frames.push({step, from: p, p: next, g, move, alt: altitude(map, next)});
      p = next;
      if (distance(p, map.chest) <= CHEST_RADIUS) { outcome = 'found'; break; }
      if (move < 0.004 && Math.hypot(g.u, g.v) < 0.05) { outcome = distance(p, map.pit) < 0.45 ? 'pit' : 'stuck'; break; }
    }
    if (outcome === 'tired' && zigzags >= 6) outcome = 'bounce';
    return {frames, outcome, zigzags, end: p};
  }
  // The player walks toward a tapped point, at most one stride per step.
  function stepToward(from, target, stride = STRIDE) {
    const d = distance(from, target);
    if (d <= stride) return {u: target.u, v: target.v};
    return {u: from.u + (target.u - from.u) / d * stride, v: from.v + (target.v - from.v) / d * stride};
  }

  const model = {WIDTH, HEIGHT, SCALE, CHEST_RADIUS, STRIDE, PLAYER_STEPS, MAX_STEPS, random, height, gradient, makeMap, altitude, descend, stepToward, toView, toMap, inBounds, distance};

  // ---------- Game ----------
  const STORE = 'lsworld.klee.hike.v1';
  const OUTCOMES = {found: '找到宝箱', flew: '飞出地图', pit: '掉进史莱姆坑', stuck: '停在平地', tired: '走不动了', bounce: '来回弹跳'};
  function init(panel) {
    const $ = selector => panel.querySelector(selector);
    const kit = window.LabGameKit, {svg, reduced, restart} = kit;
    const view = $('[data-hike-map]'), stage = $('.fish-stage'), terrain = $('[data-hike-terrain]'), contours = $('[data-hike-contours]');
    const decor = $('[data-hike-decor]'), trails = $('[data-hike-trails]'), marks = $('[data-hike-marks]'), reveal = $('[data-hike-reveal]');
    const fog = $('[data-hike-fog]'), arrow = $('[data-hike-arrow]'), reach = $('[data-hike-reach]'), aim = $('[data-hike-aim]');
    const klee = $('[data-hike-klee]'), banner = $('[data-hike-banner]'), hudMap = $('[data-hike-hud-map]'), hudState = $('[data-hike-hud-state]');
    const face = $('[data-hike-face]'), bubble = $('.fish-klee-line'), line = $('[data-hike-line]');
    const rateInput = $('#hike-rate'), rateValue = $('[data-hike-rate-value]'), momentumToggle = $('[data-hike-momentum]');
    const insightToggle = $('[data-hike-insight-toggle]'), insight = $('[data-hike-insight]'), insightStep = $('[data-hike-insight-step]');
    const chartPlayer = $('[data-hike-chart="player"]'), chartKlee = $('[data-hike-chart="klee"]'), chartValue = $('[data-hike-chart-value]');
    const doneButton = $('[data-hike-done]'), algorithmButton = $('[data-hike-algorithm]'), stepButton = $('[data-hike-step]'), skipButton = $('[data-hike-skip]');
    const retryButton = $('[data-hike-retry]'), againButton = $('[data-hike-again]'), newButton = $('[data-hike-new]');
    const seedLabel = $('[data-hike-seed]'), scorePlayer = $('[data-hike-score="player"]'), scoreKlee = $('[data-hike-score="klee"]'), verdict = $('[data-hike-verdict]');

    // ----- Klee hosts the game: bubble, expressions, banner and voice -----
    const {say, announce, voice, stopVoice} = kit.host(panel, {face, bubble, line, banner, mirrors: [klee.querySelector('.hike-klee-face')],
      toggle: $('[data-hike-voice-toggle]'), voiceAttr: 'hikeVoice'});

    const stats = kit.stats(STORE, {rounds: 0, wins: 0, flew: 0}).data, save = () => kit.store.set(STORE, JSON.stringify(stats));
    const showStats = () => { for (const key of ['rounds', 'wins', 'flew']) $(`[data-hike-stat="${key}"]`).textContent = stats[key]; };

    let map = null, phase = 'lead', walker = null, playerPath = [], playerResult = null, run = null, frameIndex = 0, timer = null, kleeAt = null;
    const clock = kit.timers(), wait = clock.wait;
    const rate = () => Number(rateInput.value), momentum = () => momentumToggle.checked ? 0.8 : 0;
    const metres = value => value === null ? '—' : `${value} 米`;

    // ----- Terrain picture: hypsometric tint with hill shading, drawn once per map. -----
    const STOPS = [[0, [196, 230, 132]], [.18, [139, 203, 112]], [.4, [86, 160, 92]], [.6, [128, 140, 92]], [.75, [160, 136, 104]], [.88, [196, 184, 170]], [1, [247, 246, 242]]];
    function tint(t) {
      for (let i = 1; i < STOPS.length; i++) if (t <= STOPS[i][0]) {
        const [t0, c0] = STOPS[i - 1], [t1, c1] = STOPS[i], k = (t - t0) / (t1 - t0);
        return c0.map((c, j) => c + (c1[j] - c) * k);
      }
      return STOPS.at(-1)[1];
    }
    function paintTerrain() {
      const canvas = document.createElement('canvas'), w = 320, h = 200; canvas.width = w; canvas.height = h;
      const context = canvas.getContext('2d'), image = context.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = toMap({x: (x + .5) * WIDTH / w, y: (y + .5) * HEIGHT / h}), t = (height(map, p) - map.low) / (map.high - map.low), g = gradient(map, p);
        // Light from the upper left.
        const shade = Math.max(.55, Math.min(1.25, 1 + (g.u * -0.7 + g.v * 0.7) * -0.55 / Math.sqrt(1 + g.u * g.u + g.v * g.v)));
        const color = tint(Math.max(0, Math.min(1, t))), index = (y * w + x) * 4;
        image.data[index] = color[0] * shade; image.data[index + 1] = color[1] * shade; image.data[index + 2] = color[2] * shade; image.data[index + 3] = 255;
      }
      context.putImageData(image, 0, 0);
      terrain.setAttribute('href', canvas.toDataURL('image/png'));
    }
    // Contour lines with marching squares on a 4 px grid.
    function drawContours() {
      contours.replaceChildren();
      const step = 4, cols = WIDTH / step, rows = HEIGHT / step, grid = [];
      for (let j = 0; j <= rows; j++) { grid.push([]); for (let i = 0; i <= cols; i++) grid[j].push(height(map, toMap({x: i * step, y: j * step}))); }
      const levels = 14;
      for (let level = 1; level < levels; level++) {
        const value = map.low + (map.high - map.low) * level / levels, parts = [];
        for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
          const a = grid[j][i], b = grid[j][i + 1], c = grid[j + 1][i + 1], d = grid[j + 1][i];
          const edge = (p, q, x0, y0, x1, y1) => { const k = (value - p) / (q - p); return [x0 + (x1 - x0) * k, y0 + (y1 - y0) * k]; };
          const x = i * step, y = j * step, points = [];
          if ((a < value) !== (b < value)) points.push(edge(a, b, x, y, x + step, y));
          if ((b < value) !== (c < value)) points.push(edge(b, c, x + step, y, x + step, y + step));
          if ((c < value) !== (d < value)) points.push(edge(c, d, x + step, y + step, x, y + step));
          if ((d < value) !== (a < value)) points.push(edge(d, a, x, y + step, x, y));
          for (let k = 0; k + 1 < points.length; k += 2) parts.push(`M${points[k][0].toFixed(1)} ${points[k][1].toFixed(1)}L${points[k + 1][0].toFixed(1)} ${points[k + 1][1].toFixed(1)}`);
        }
        svg('path', {class: 'hike-contour' + (level % 4 === 0 ? ' is-major' : ''), d: parts.join('')}, contours);
      }
    }
    function drawDecor() {
      decor.replaceChildren();
      const rng = random(map.seed * 7 + 3), places = [];
      for (let i = 0; i < 400 && places.length < 22; i++) {
        const p = {u: -2.8 + rng() * 5.6, v: -1.7 + rng() * 3.4}, t = (height(map, p) - map.low) / (map.high - map.low);
        if (t > .25 && t < .58 && [map.chest, map.pit, map.start].every(spot => distance(spot, p) > .45) && places.every(other => distance(other, p) > .32)) places.push(p);
      }
      for (const p of places) {
        const q = toView(p), tree = svg('g', {class: 'hike-tree', transform: `translate(${q.x.toFixed(1)} ${q.y.toFixed(1)})`}, decor);
        svg('ellipse', {class: 'hike-tree-shadow', cx: 3, cy: 6, rx: 7, ry: 2.5}, tree);
        svg('rect', {class: 'hike-trunk', x: -1.2, y: 1, width: 2.4, height: 5}, tree);
        svg('path', {class: 'hike-leaves', d: 'M0-13L7 2H-7Z'}, tree);
        svg('path', {class: 'hike-leaves is-light', d: 'M0-13L4-4H-4Z'}, tree);
      }
      // Treasure chest at the lowest valley, a slime in the shallow pit, the camp on the hill.
      const chest = toView(map.chest), chestNode = svg('g', {class: 'hike-chest', 'data-hike-chest': '', transform: `translate(${chest.x.toFixed(1)} ${chest.y.toFixed(1)})`}, decor);
      svg('circle', {class: 'hike-chest-glow', r: 22}, chestNode);
      svg('ellipse', {class: 'hike-tree-shadow', cx: 1, cy: 9, rx: 13, ry: 3}, chestNode);
      svg('rect', {class: 'hike-chest-box', x: -11, y: -2, width: 22, height: 11, rx: 2}, chestNode);
      svg('path', {class: 'hike-chest-lid', d: 'M-11-2V-6Q-11-12 0-12Q11-12 11-6V-2Z'}, chestNode);
      svg('path', {class: 'hike-chest-trim', d: 'M-11-2H11M-6-11V9M6-11V9'}, chestNode);
      svg('rect', {class: 'hike-chest-lock', x: -2.5, y: -4, width: 5, height: 6, rx: 1}, chestNode);
      const pit = toView(map.pit), slime = svg('g', {class: 'hike-slime', transform: `translate(${pit.x.toFixed(1)} ${pit.y.toFixed(1)})`}, decor);
      svg('ellipse', {class: 'hike-pit', rx: 20, ry: 8, cy: 5}, slime);
      svg('path', {class: 'hike-slime-body', d: 'M-10 6Q-11-8 0-9Q11-8 10 6Z'}, slime);
      svg('circle', {class: 'hike-slime-eye', cx: -3.5, cy: -1, r: 1.6}, slime); svg('circle', {class: 'hike-slime-eye', cx: 3.5, cy: -1, r: 1.6}, slime);
      const camp = toView(map.start), tent = svg('g', {class: 'hike-camp', transform: `translate(${camp.x.toFixed(1)} ${camp.y.toFixed(1)})`}, decor);
      svg('path', {class: 'hike-tent', d: 'M-14 8L0-12 14 8Z'}, tent); svg('path', {class: 'hike-tent-door', d: 'M-4 8L0 0 4 8Z'}, tent);
      svg('path', {class: 'hike-flag', d: 'M0-12V-22L8-19 0-16'}, tent);
    }
    function placeKlee(p, {jump = true} = {}) {
      kleeAt = p; const q = toView(p);
      klee.style.transform = `translate(${q.x}px, ${q.y}px)`;
      if (jump && !reduced()) restart(klee, 'is-hopping');
      if (phase === 'lead') { reach.setAttribute('transform', `translate(${q.x} ${q.y})`); }
      drawArrow(); hud();
    }
    function look(p, radius = 74) {
      const q = toView(p);
      svg('circle', {cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: radius}, reveal);
    }
    function drawArrow() {
      arrow.replaceChildren();
      if (!insightToggle.checked || !kleeAt || !inBounds(kleeAt) || ['done', 'finishing'].includes(phase)) return;
      const g = gradient(map, kleeAt), length = Math.hypot(g.u, g.v); if (length < .05) return;
      const q = toView(kleeAt), scale = Math.min(70, 30 + length * 25) / length;
      const end = {x: q.x - g.u * scale, y: q.y + g.v * scale};
      svg('line', {class: 'hike-arrow', x1: q.x, y1: q.y, x2: end.x.toFixed(1), y2: end.y.toFixed(1), 'marker-end': 'url(#hike-arrowhead)'}, arrow);
      svg('text', {class: 'hike-arrow-label', x: end.x.toFixed(1), y: (end.y - 6).toFixed(1)}, arrow).textContent = '最陡下坡';
    }
    function trail(points, owner) {
      const path = points.map((p, i) => { const q = toView(p); return `${i ? 'L' : 'M'}${q.x.toFixed(1)} ${q.y.toFixed(1)}`; }).join('');
      let node = trails.querySelector(`.hike-trail-${owner}`);
      if (!node) node = svg('path', {class: `hike-trail hike-trail-${owner}`}, trails);
      node.setAttribute('d', path);
      marks.querySelectorAll(`.hike-step-${owner}`).forEach(dot => dot.remove());
      points.slice(1).forEach((p, i) => { const q = toView(p); if (!inBounds(p)) return;
        svg('circle', {class: `hike-step hike-step-${owner}`, cx: q.x.toFixed(1), cy: q.y.toFixed(1), r: 3.4, 'data-step': i + 1}, marks); });
    }
    function chart() {
      const series = [[chartPlayer, playerPath.map(p => altitude(map, p))], [chartKlee, run ? run.frames.slice(0, frameIndex).map(f => f.alt).filter(v => v !== null) : []]];
      const span = Math.max(2, ...series.map(([, values]) => values.length)) - 1;
      for (const [node, values] of series) node.setAttribute('points', values.map((value, i) => `${(6 + i * 288 / span).toFixed(1)},${(60 - value / METRES * 54).toFixed(1)}`).join(' '));
      const last = series.map(([, values]) => values.at(-1));
      chartValue.textContent = `旅行者 ${metres(last[0] ?? null)} · 可莉 ${metres(last[1] ?? null)}`;
    }
    function score(node, result) {
      node.querySelector('strong').textContent = result ? (result.found ? `${result.steps} 步找到` : OUTCOMES[result.outcome] || '没找到') : '—';
      node.querySelector('small').textContent = result ? `终点海拔 ${metres(result.alt)}` : '终点海拔 —';
      node.querySelector('.fish-score-bar i').style.width = result ? `${Math.max(0, 100 - (result.alt ?? METRES) / METRES * 100)}%` : '0%';
    }
    const setPhase = value => {
      phase = value; panel.dataset.hikePhase = value;
      doneButton.disabled = value !== 'lead';
      algorithmButton.disabled = !['led', 'algorithm'].includes(value);
      stepButton.disabled = skipButton.disabled = value !== 'algorithm';
      retryButton.disabled = value !== 'done';
      algorithmButton.textContent = value === 'algorithm' ? (timer ? '暂停' : '继续下山') : '看可莉的下山秘诀';
      reach.toggleAttribute('hidden', value !== 'lead');
      hud();
    };
    function hud() {
      if (!map) return;
      hudMap.textContent = `山 #${map.seed} · 海拔 ${metres(kleeAt ? (inBounds(kleeAt) ? altitude(map, kleeAt) : null) : null)}`;
      hudState.textContent = phase === 'lead' ? `旅行者带路 ${playerPath.length - 1}/${PLAYER_STEPS}` : phase === 'done' ? '本局结算'
        : phase === 'algorithm' || phase === 'finishing' ? `可莉 · 第 ${Math.max(0, frameIndex - 1)} 步` : '准备交给可莉';
    }

    // ----- Player leads through the fog -----
    function viewPoint(event) {
      const matrix = view.getScreenCTM(); if (!matrix) return null;
      const p = view.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const q = p.matrixTransform(matrix.inverse());
      return toMap({x: Math.max(0, Math.min(WIDTH, q.x)), y: Math.max(0, Math.min(HEIGHT, q.y))});
    }
    view.addEventListener('click', event => {
      if (phase !== 'lead') return;
      const target = viewPoint(event); if (!target) return;
      const next = stepToward(kleeAt, target);
      if (distance(next, kleeAt) < .02) return;
      playerPath.push(next); look(next); placeKlee(next); trail(playerPath, 'player'); chart();
      const found = distance(next, map.chest) <= CHEST_RADIUS, left = PLAYER_STEPS - (playerPath.length - 1), alt = altitude(map, next);
      aim.setAttribute('hidden', '');
      if (found) { finishLead(true); return; }
      if (!left) { finishLead(false); return; }
      const before = altitude(map, playerPath.at(-2));
      say(alt < before - 30 ? `往下走了 ${before - alt} 米！还剩 ${left} 步，宝箱应该在更低的地方～` : alt > before + 30
        ? `咦，往上爬了 ${alt - before} 米……还剩 ${left} 步。` : `差不多一样高呢，还剩 ${left} 步。`, alt < before ? 'happy' : 'curious');
      hud();
    });
    view.addEventListener('pointermove', event => {
      if (phase !== 'lead' || event.pointerType === 'touch') { aim.setAttribute('hidden', ''); return; }
      const target = viewPoint(event); if (!target) return;
      const a = toView(kleeAt), b = toView(stepToward(kleeAt, target));
      aim.querySelector('line').setAttribute('x1', a.x); aim.querySelector('line').setAttribute('y1', a.y);
      aim.querySelector('line').setAttribute('x2', b.x); aim.querySelector('line').setAttribute('y2', b.y);
      aim.querySelector('circle').setAttribute('cx', b.x); aim.querySelector('circle').setAttribute('cy', b.y);
      aim.removeAttribute('hidden');
    });
    view.addEventListener('pointerleave', () => aim.setAttribute('hidden', ''));
    function finishLead(found) {
      const end = playerPath.at(-1);
      playerResult = {found, steps: playerPath.length - 1, alt: altitude(map, end), outcome: found ? 'found' : 'tired'};
      score(scorePlayer, playerResult); setPhase('led');
      if (found) { announce('找到宝箱！'); say(`找到宝箱啦！旅行者只用了 ${playerResult.steps} 步！看可莉能不能更快～`, 'laugh'); voice('klee-hike-found'); look(map.chest, 40); }
      else { say(`${PLAYER_STEPS} 步走完啦，现在海拔 ${playerResult.alt} 米……宝箱还没找到。看可莉的下山秘诀！`, 'care'); voice('klee-hike-tired'); }
    }
    doneButton.addEventListener('click', () => { if (phase === 'lead' && playerPath.length > 1) finishLead(distance(playerPath.at(-1), map.chest) <= CHEST_RADIUS); else if (phase === 'lead') say('先点地图带可莉走一步嘛！', 'wink'); });

    // ----- Klee: gradient descent, one real step per frame -----
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    function showFrame(frame) {
      if (frame.step === 0) {
        placeKlee(frame.p, {jump: false}); say('轮到可莉！不看远处，只看脚下哪边最陡，就往那边迈一步！', 'thinking');
        insightStep.textContent = `出发：位置 (${frame.p.u.toFixed(2)}, ${frame.p.v.toFixed(2)})，海拔 ${frame.alt} 米。规则：新位置 = 旧位置 − η × 坡度（梯度）${momentum() ? '，再加上 0.8 倍的上一步（风之翼的惯性）' : ''}。`;
        return;
      }
      const shown = run.frames.slice(0, frameIndex);
      trail(shown.map(f => f.p), 'klee'); placeKlee(frame.p);
      if (inBounds(frame.p)) look(frame.p, 60);
      const g = Math.hypot(frame.g.u, frame.g.v);
      insightStep.textContent = `第 ${frame.step} 步：坡度 (${frame.g.u.toFixed(2)}, ${frame.g.v.toFixed(2)})，陡度 ${g.toFixed(2)}；` +
        `迈出 ${frame.move.toFixed(2)}（≈ ${Math.round(frame.move * SCALE)} 像素）${frame.alt === null ? '，冲出了地图！' : `，海拔 ${frame.alt} 米。`}`;
      const zig = shown.length > 2 && (() => { const a = shown.at(-1), b = shown.at(-2); return (a.p.u - a.from.u) * (b.p.u - b.from.u) + (a.p.v - a.from.v) * (b.p.v - b.from.v) < 0; })();
      if (zig) { say('哇，步子太大，跳到山谷对面去啦！', 'wink'); voice('klee-hike-bounce', {minor: true}); }
      else say(frame.step === 1 ? '第 1 步！这边最陡，冲呀～' : `第 ${frame.step} 步，海拔 ${frame.alt ?? '？'} 米。`, 'curious');
      chart(); hud();
    }
    function advance() {
      if (!run || frameIndex >= run.frames.length) return;
      showFrame(run.frames[frameIndex++]);
      if (frameIndex >= run.frames.length) finish(); else setPhase('algorithm');
    }
    function play() { stopTimer(); timer = setInterval(advance, reduced() ? 450 : 650); setPhase('algorithm'); }
    function startKlee() {
      run = descend(map, {rate: rate(), momentum: momentum()}); frameIndex = 0;
      trails.querySelector('.hike-trail-klee')?.remove(); marks.querySelectorAll('.hike-step-klee').forEach(dot => dot.remove());
      verdict.hidden = true; scoreKlee.classList.remove('is-winner'); scorePlayer.classList.remove('is-winner'); score(scoreKlee, null);
      announce('可莉的回合！'); voice('klee-hike-start', {queue: true}); advance(); play();
    }
    function finish() {
      stopTimer(); setPhase('finishing'); arrow.replaceChildren();
      const outcome = run.outcome, last = run.frames.at(-1), found = outcome === 'found';
      const result = {found, steps: last.step, alt: outcome === 'flew' ? null : last.alt, outcome};
      score(scoreKlee, result);
      if (outcome === 'flew') {
        if (!reduced()) restart(stage, 'is-shaking');
        klee.classList.add('is-flying'); stats.flew++;
        announce('飞出地图啦！'); say(`哇啊——步子 η = ${rate()} 太大了，越跳越远，飞出地图啦！`, 'care'); voice('klee-hike-flew', {queue: true});
      } else if (found) { announce('找到宝箱！'); say(`找到宝箱啦！可莉走了 ${last.step} 步！好耶！`, 'proud'); voice('klee-hike-win', {queue: true}); look(map.chest, 40); }
      else if (outcome === 'pit') { announce('史莱姆坑！'); say('咦？四周都是上坡……被史莱姆坑黏住了！', 'care'); voice('klee-hike-pit', {queue: true}); }
      else if (outcome === 'bounce') { announce('停不下来！'); say(`步子 η = ${rate()} 有点大，在山谷两边弹来弹去，停不下来！`, 'wink'); voice('klee-hike-bounce', {queue: true}); }
      else if (outcome === 'tired') { announce('走不动啦'); say(`${MAX_STEPS} 步都走完了……步子太小，走得好慢！`, 'care'); voice('klee-hike-slow', {queue: true}); }
      else { announce('停下来了'); say('这里平平的，可莉不知道该往哪走了……', 'thinking'); }
      // Reveal the whole mountain and compare both routes.
      wait(() => {
        panel.classList.add('is-revealed');
        const playerWins = playerResult.found && (!found || playerResult.steps < result.steps) || !playerResult.found && !found && playerResult.alt < (result.alt ?? Infinity);
        const kleeWins = found && (!playerResult.found || result.steps < playerResult.steps) || !playerResult.found && !found && (result.alt ?? Infinity) < playerResult.alt;
        scorePlayer.classList.toggle('is-winner', playerWins); scoreKlee.classList.toggle('is-winner', kleeWins);
        stats.rounds++; if (playerWins) stats.wins++; save(); showStats();
        const notes = {
          found: `可莉每一步只看脚下的坡度，往最陡的下坡方向迈一步，${result.steps} 步走到了宝箱。` + (run.zigzags >= 3 ? `中间在山谷两侧来回跳了 ${run.zigzags} 次——步子再小一点会更稳。` : ''),
          flew: `步子 η = ${rate()} 太大：一步跨过山谷冲上对面更高的坡，下一步坡更陡、迈得更远，越弹越远——学习率太大，梯度下降就会发散。试试把步子调小。`,
          pit: `史莱姆坑四周都是上坡，坡度变成 0，梯度下降以为已经到底了——这就是“局部最小值”。试试打开风之翼（动量），或者换个步子。`,
          stuck: '这里坡度几乎为 0，梯度下降每一步都迈不动了。试试换个步子或打开风之翼。',
          bounce: `步子 η = ${rate()} 偏大：每一步都跨过谷底，落到对面的坡上，又被坡度推回来，${MAX_STEPS} 步里来回折返了 ${run.zigzags} 次——学习率偏大会震荡。试试把步子调小一点。`,
          tired: `步子 η = ${rate()} 太小，${MAX_STEPS} 步还没走到底——学习率太小，收敛就很慢。试试把步子调大一点。`
        };
        verdict.textContent = notes[outcome] + (playerResult.found ? ` 旅行者在雾里 ${playerResult.steps} 步就找到了宝箱！` : ` 旅行者停在海拔 ${playerResult.alt} 米。`);
        verdict.hidden = false; setPhase('done');
        insightStep.textContent = `结果：${OUTCOMES[outcome]}。可莉共走 ${result.steps} 步，步子 η = ${rate()}${momentum() ? '，开着风之翼（动量 0.8）' : ''}。`;
      }, outcome === 'flew' && !reduced() ? 900 : 300);
    }
    algorithmButton.addEventListener('click', () => {
      if (phase === 'led') { startKlee(); return; }
      if (phase === 'algorithm') { if (timer) { stopTimer(); setPhase('algorithm'); } else play(); }
    });
    stepButton.addEventListener('click', () => { stopTimer(); advance(); });
    skipButton.addEventListener('click', () => { stopTimer(); while (run && frameIndex < run.frames.length - 1) frameIndex++; advance(); });
    retryButton.addEventListener('click', () => {
      if (phase !== 'done') return;
      klee.classList.remove('is-flying'); panel.classList.remove('is-revealed'); setPhase('led'); startKlee();
    });

    // ----- Rounds -----
    function again() {
      stopTimer(); stopVoice(); clock.clear();
      panel.classList.remove('is-revealed'); klee.classList.remove('is-flying', 'is-hopping'); stage.classList.remove('is-shaking');
      trails.replaceChildren(); marks.replaceChildren(); reveal.replaceChildren(); arrow.replaceChildren();
      run = null; frameIndex = 0; playerPath = [{...map.start}]; playerResult = null;
      verdict.hidden = true; scorePlayer.classList.remove('is-winner'); scoreKlee.classList.remove('is-winner'); score(scorePlayer, null); score(scoreKlee, null);
      setPhase('lead'); look(map.start); placeKlee(map.start, {jump: false}); chart();
      insightStep.textContent = '出发后，这里会显示每一步的坡度、迈出的距离和海拔。';
      announce('旅行者带路！');
      say(`山上起雾了！宝箱藏在最低的山谷里。点地图带可莉走，每步最远 ${Math.round(STRIDE * SCALE)} 像素，一共 ${PLAYER_STEPS} 步！`, 'happy');
      voice('klee-hike-intro');
    }
    function newMap(seed = 1000 + Math.floor(Math.random() * 9000)) {
      map = makeMap(seed); seedLabel.textContent = '#' + seed;
      paintTerrain(); drawContours(); drawDecor(); again();
    }
    againButton.addEventListener('click', again);
    newButton.addEventListener('click', () => newMap());
    rateInput.addEventListener('input', () => { rateValue.textContent = rate().toFixed(2); });
    insightToggle.addEventListener('change', () => { insight.hidden = !insightToggle.checked; drawArrow(); });

    const seedFromHash = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('map'));
    rateValue.textContent = rate().toFixed(2); insight.hidden = !insightToggle.checked; showStats();
    newMap(Number.isSafeInteger(seedFromHash) && seedFromHash > 0 ? seedFromHash : undefined);
    return () => { stopVoice(); if (timer) { stopTimer(); setPhase('algorithm'); } };
  }

  return {model, init};
});

;
/* js/lab-camps.js */
/* Klee clears the hilichurl camps with as few bombs as possible: the greedy
   "leftmost uncleared camp, throw as far right as still reaches it" rule.
   The player throws first; Klee first tries her instinct (bomb right on the
   camp), then the clever rule, and finally slides the player's own bombs
   right one by one — the exchange argument from the article. */
(function (factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api.model;
  if (typeof window !== 'undefined') {
    window.LabCamps = api.model;
    window.LabExperiments = Object.assign(window.LabExperiments || {}, {camps: api.init});
  }
})(function () {
  'use strict';
  // The road is u ∈ [0, 20]; a bomb at b clears every camp with |x − b| ≤ 2.
  const WIDTH = 640, HEIGHT = 320, ROAD = 20, RADIUS = 2, GRID = 0.5, X0 = 40, S = 28, ROAD_Y = 196, EPS = 1e-9;

  // ---------- Model: pure and deterministic, so it can be tested in Node. ----------
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const toX = u => X0 + u * S;
  const toU = x => (x - X0) / S;
  const snap = u => Math.max(0, Math.min(ROAD, Math.round(u / GRID) * GRID));
  const covers = (bomb, camp, radius = RADIUS) => Math.abs(camp - bomb) <= radius + EPS;
  const cleared = (camps, bombs, radius = RADIUS) => camps.map(camp => bombs.some(bomb => covers(bomb, camp, radius)));

  // Sweep left to right. Each round looks at the leftmost camp still standing:
  // "naive" throws right on it, "greedy" throws as far right as still reaches it.
  function sweep(camps, strategy = 'greedy', radius = RADIUS, road = ROAD) {
    const done = camps.map(() => false), frames = [];
    for (;;) {
      const camp = done.indexOf(false); if (camp < 0) break;
      const x = camps[camp], bomb = strategy === 'greedy' ? Math.min(x + radius, road) : x, hit = [];
      camps.forEach((other, j) => { if (!done[j] && covers(bomb, other, radius)) { done[j] = true; hit.push(j); } });
      frames.push({camp, x, window: [Math.max(0, x - radius), Math.min(road, x + radius)], bomb, hit});
    }
    return {frames, bombs: frames.map(frame => frame.bomb)};
  }
  // How many camps, counted from the left, the first k bombs (sorted) clear without a gap.
  function frontier(camps, bombs, radius = RADIUS) {
    const sorted = [...bombs].sort((a, b) => a - b), out = [0];
    for (let k = 1; k <= sorted.length; k++) {
      const used = sorted.slice(0, k); let count = 0;
      while (count < camps.length && used.some(bomb => covers(bomb, camps[count], radius))) count++;
      out.push(count);
    }
    return out;
  }
  // The exchange argument run on the player's own answer: for the leftmost camp
  // not yet handled, take one of the player's bombs that reaches it and slide it to
  // x + r. Nothing it used to clear is lost, so the count never grows.
  function exchange(camps, bombs, radius = RADIUS, road = ROAD) {
    if (!cleared(camps, bombs, radius).every(Boolean)) return null;
    const now = bombs.slice(), moved = bombs.map(() => false), done = camps.map(() => false), frames = [];
    for (;;) {
      const camp = done.indexOf(false); if (camp < 0) break;
      const x = camps[camp], to = Math.min(x + radius, road);
      let pick = -1;
      now.forEach((bomb, j) => { if (!moved[j] && covers(bomb, x, radius) && (pick < 0 || bomb < now[pick])) pick = j; });
      const from = now[pick];
      const kept = camps.filter((other, j) => !done[j] && covers(from, other, radius)).length;
      now[pick] = to; moved[pick] = true;
      const hit = [];
      camps.forEach((other, j) => { if (!done[j] && covers(to, other, radius)) { done[j] = true; hit.push(j); } });
      frames.push({camp, x, bomb: pick, from, to, hit, kept});
    }
    return {frames, positions: now, spare: bombs.map((_, j) => j).filter(j => !moved[j])};
  }
  function makeMap(seed) {
    const rng = random(seed);
    let camps = [];
    for (let attempt = 0; attempt < 80; attempt++) {
      const n = 8 + Math.floor(rng() * 4), set = new Set();
      let u = 0.5 + Math.floor(rng() * 3) * GRID;
      while (set.size < n && u <= ROAD - 0.5) {
        set.add(u);
        u += rng() < 0.62 ? 0.5 + Math.floor(rng() * 3) * GRID : 2.5 + Math.floor(rng() * 6) * GRID;
      }
      camps = [...set].sort((a, b) => a - b);
      if (camps.length < 7) continue;
      const best = sweep(camps).frames.length, naive = sweep(camps, 'naive').frames.length;
      // Every lake teaches something: the instinct wastes a bomb, the clever rule is optimal.
      if (best >= 3 && best <= 6 && naive > best) break;
    }
    return {seed, camps, radius: RADIUS, road: ROAD, best: sweep(camps).frames.length, naive: sweep(camps, 'naive').frames.length};
  }
  // Camps whose greedy rounds started are pairwise more than 2r apart: no bomb can
  // reach two of them, so any answer needs at least that many bombs.
  const witnesses = camps => sweep(camps).frames.map(frame => frame.x);

  const model = {WIDTH, HEIGHT, ROAD, RADIUS, GRID, X0, S, ROAD_Y, random, toX, toU, snap, covers, cleared, sweep, frontier, exchange, makeMap, witnesses};

  // ---------- Game ----------
  const STORE = 'lsworld.klee.camps.v1';
  const NAMES = {naive: '可莉的直觉', greedy: '可莉的妙计'};
  function init(panel) {
    const $ = selector => panel.querySelector(selector);
    const kit = window.LabGameKit, {svg, reduced, restart} = kit;
    const view = $('[data-camp-map]'), stage = $('.fish-stage'), decor = $('[data-camp-decor]'), ruler = $('[data-camp-ruler]');
    const windowLayer = $('[data-camp-window]'), ranges = $('[data-camp-ranges]'), campLayer = $('[data-camp-camps]');
    const bombLayer = $('[data-camp-bombs]'), effects = $('[data-camp-fx]'), cursor = $('[data-camp-cursor]'), klee = $('[data-camp-klee]');
    const banner = $('[data-camp-banner]'), hudMap = $('[data-camp-hud-map]'), hudState = $('[data-camp-hud-state]');
    const face = $('[data-camp-face]'), bubble = $('.fish-klee-line'), line = $('[data-camp-line]');
    const insightToggle = $('[data-camp-insight-toggle]'), insight = $('[data-camp-insight]'), insightStep = $('[data-camp-insight-step]');
    const chartPlayer = $('[data-camp-chart="player"]'), chartKlee = $('[data-camp-chart="klee"]'), chartValue = $('[data-camp-chart-value]');
    const throwButton = $('[data-camp-throw]'), algorithmButton = $('[data-camp-algorithm]'), stepButton = $('[data-camp-step]'), skipButton = $('[data-camp-skip]');
    const retryButton = $('[data-camp-retry]'), exchangeButton = $('[data-camp-exchange]'), againButton = $('[data-camp-again]'), newButton = $('[data-camp-new]');
    const seedLabel = $('[data-camp-seed]'), scorePlayer = $('[data-camp-score="player"]'), scoreKlee = $('[data-camp-score="klee"]'), verdict = $('[data-camp-verdict]');
    const kleeLabel = $('[data-camp-klee-label]'), strategyInputs = [...panel.querySelectorAll('[name="camp-strategy"]')];
    const strategy = () => strategyInputs.find(input => input.checked)?.value || 'naive';

    // ----- Klee hosts the game: bubble, expressions, banner and voice -----
    const {say, announce, voice, stopVoice} = kit.host(panel, {face, bubble, line, banner, mirrors: [klee.querySelector('.hike-klee-face')],
      toggle: $('[data-camp-voice-toggle]'), voiceAttr: 'campVoice'});

    const stats = kit.stats(STORE, {rounds: 0, wins: 0, best: 0}).data, save = () => kit.store.set(STORE, JSON.stringify(stats));
    const showStats = () => { for (const key of ['rounds', 'wins', 'best']) $(`[data-camp-stat="${key}"]`).textContent = stats[key]; };

    let map = null, phase = 'place', player = [], playerResult = null, run = null, frameIndex = 0, timer = null, swap = null, swapIndex = 0, standing = [];
    const clock = kit.timers(), wait = clock.wait;
    const fmt = value => Number.isInteger(value) ? String(value) : value.toFixed(1);
    const left = () => standing.filter(Boolean).length;

    // ----- Scenery: far hills, trees and rocks off the road, drawn once per map -----
    function drawRuler() {
      ruler.replaceChildren();
      svg('line', {class: 'camp-ruler-line', x1: toX(0), y1: 262, x2: toX(ROAD), y2: 262}, ruler);
      for (let u = 0; u <= ROAD; u += 1) {
        svg('line', {class: 'camp-tick' + (u % 2 ? '' : ' is-major'), x1: toX(u), y1: 262, x2: toX(u), y2: u % 2 ? 267 : 270}, ruler);
        if (u % 2 === 0) svg('text', {class: 'camp-tick-label', x: toX(u), y: 284}, ruler).textContent = u;
      }
    }
    function drawDecor() {
      decor.replaceChildren();
      const rng = random(map.seed * 7 + 3);
      for (let i = 0; i < 16; i++) {
        const x = 20 + rng() * 600, y = 88 + rng() * 52, s = 0.75 + rng() * 0.5;
        const tree = svg('g', {class: 'hike-tree', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(2)})`}, decor);
        svg('ellipse', {class: 'hike-tree-shadow', cx: 3, cy: 6, rx: 7, ry: 2.5}, tree);
        svg('rect', {class: 'hike-trunk', x: -1.2, y: 1, width: 2.4, height: 5}, tree);
        svg('path', {class: 'hike-leaves', d: 'M0-13L7 2H-7Z'}, tree);
        svg('path', {class: 'hike-leaves is-light', d: 'M0-13L4-4H-4Z'}, tree);
      }
      for (let i = 0; i < 10; i++) {
        const x = 20 + rng() * 600, y = 238 + rng() * 10;
        svg('ellipse', {class: 'camp-rock', cx: x.toFixed(1), cy: y.toFixed(1), rx: (3 + rng() * 4).toFixed(1), ry: (2 + rng() * 2).toFixed(1)}, decor);
      }
    }
    function drawCamps() {
      campLayer.replaceChildren();
      const rng = random(map.seed * 13 + 5);
      map.camps.forEach((u, i) => {
        const lift = (rng() - .5) * 10, node = svg('g', {class: 'camp', 'data-camp': i, transform: `translate(${toX(u)} ${(ROAD_Y + lift).toFixed(1)})`}, campLayer);
        svg('ellipse', {class: 'camp-shadow', cy: 9, rx: 13, ry: 3.5}, node);
        const hut = svg('g', {class: 'camp-hut'}, node);
        svg('rect', {class: 'camp-wall', x: -9, y: -4, width: 18, height: 13, rx: 1.5}, hut);
        svg('path', {class: 'camp-roof', d: 'M-13-2L0-17 13-2Z'}, hut);
        svg('path', {class: 'camp-straw', d: 'M-8-6L-4-12M-2-5L1-14M4-6L7-10'}, hut);
        svg('path', {class: 'camp-door', d: 'M-3 9V3Q0 0 3 3V9Z'}, hut);
        const mask = svg('g', {class: 'camp-mask', transform: 'translate(0 -22)'}, hut);
        svg('path', {class: 'camp-pole', d: 'M0 5V12'}, mask);
        svg('ellipse', {class: 'camp-mask-face', rx: 5.5, ry: 6.5}, mask);
        svg('path', {class: 'camp-mask-mark', d: 'M-3-2L-1 0M3-2L1 0M-2 3H2'}, mask);
        const rubble = svg('g', {class: 'camp-rubble'}, node);
        svg('path', {class: 'camp-rubble-pile', d: 'M-12 9Q-8 1-3 5Q0-1 4 4Q9 0 12 9Z'}, rubble);
        svg('path', {class: 'camp-rubble-stick', d: 'M-7 4L-1-3M3 5L9-1'}, rubble);
        svg('circle', {class: 'camp-smoke', cx: -2, cy: -6, r: 5}, rubble); svg('circle', {class: 'camp-smoke', cx: 4, cy: -11, r: 4}, rubble);
        svg('text', {class: 'camp-label', y: 24}, node).textContent = fmt(u);
      });
    }
    function showCamps({instant = false} = {}) {
      campLayer.querySelectorAll('.camp').forEach((node, i) => {
        node.classList.toggle('is-cleared', !standing[i]);
        if (instant) node.classList.remove('is-hit');
      });
    }

    // ----- Bombs and their reach (a capsule [b − r, b + r] across the road) -----
    function makeBomb(owner, index) {
      const group = svg('g', {class: `camp-bomb camp-bomb-${owner}`});
      const piece = svg('g', {class: 'camp-bomb-piece'}, group);
      svg('ellipse', {class: 'camp-bomb-shadow', cy: 13, rx: 10, ry: 3}, piece);
      svg('path', {class: 'fish-fuse', d: 'M5-9Q8-16 14-14'}, piece);
      svg('circle', {class: 'fish-fuse-spark', cx: 14.5, cy: -14.5, r: 2.6}, piece);
      svg('circle', {class: 'camp-bomb-body', r: 11}, piece);
      svg('path', {class: 'fish-bomb-star', d: 'M-3-6.5L-1.8-3.3 1.4-2.1-1.8-.9-3 2.3-4.2-.9-7.4-2.1-4.2-3.3Z'}, piece);
      svg('ellipse', {class: 'fish-bomb-shine', cx: 4, cy: -5, rx: 3, ry: 1.8, transform: 'rotate(30 4 -5)'}, piece);
      svg('circle', {class: 'camp-bomb-badge', cx: 8.5, cy: 8.5, r: 6}, piece);
      svg('text', {class: 'fish-bomb-label', x: 8.5, y: 11.4}, piece).textContent = index + 1;
      return group;
    }
    function rangeNode(owner, u) {
      const node = svg('rect', {class: `camp-range camp-range-${owner}`, y: ROAD_Y - 34, height: 68, rx: 34}, ranges);
      placeRange(node, u); return node;
    }
    function placeRange(node, u) {
      const a = toX(Math.max(0, u - RADIUS)), b = toX(Math.min(ROAD, u + RADIUS));
      node.setAttribute('x', a.toFixed(1)); node.setAttribute('width', (b - a).toFixed(1));
    }
    function drawBombs(list, owner, {drop = false} = {}) {
      bombLayer.replaceChildren(); ranges.replaceChildren();
      list.forEach((u, i) => addBomb(u, owner, i, {drop}));
    }
    function addBomb(u, owner, index, {drop = false} = {}) {
      rangeNode(owner, u).dataset.index = index;
      const group = makeBomb(owner, index); group.dataset.index = index;
      group.style.transform = `translate(${toX(u)}px, ${ROAD_Y - 2}px)`;
      if (drop && !reduced()) group.classList.add('is-dropping');
      bombLayer.append(group); return group;
    }
    function blast(list, done) {
      const quiet = reduced();
      for (const u of list) {
        const a = toX(Math.max(0, u - RADIUS)), b = toX(Math.min(ROAD, u + RADIUS));
        const flash = svg('rect', {class: 'camp-flash', x: a, y: ROAD_Y - 34, width: b - a, height: 68, rx: 34}, effects);
        wait(() => flash.remove(), 900);
        if (quiet) continue;
        for (let i = 0; i < 10; i++) {
          const angle = i / 10 * Math.PI * 2 + u, reach = 26 + (i % 3) * 12;
          const bit = svg('path', {class: 'fish-ember', d: `M${toX(u)} ${ROAD_Y - 6}l1.2 2.8 2.8 1.2-2.8 1.2-1.2 2.8-1.2-2.8-2.8-1.2 2.8-1.2z`}, effects);
          bit.style.setProperty('--dx', `${(Math.cos(angle) * reach).toFixed(1)}px`); bit.style.setProperty('--dy', `${(Math.sin(angle) * reach * .6).toFixed(1)}px`);
          wait(() => bit.remove(), 900);
        }
      }
      bombLayer.querySelectorAll('.camp-bomb').forEach(group => group.classList.add('is-spent'));
      if (!quiet) restart(stage, 'is-shaking');
      wait(done, quiet ? 50 : 450);
    }
    function pop(index, text = '清除！') {
      const node = campLayer.children[index]; if (!node) return;
      node.classList.add('is-hit');
      if (reduced()) return;
      const label = svg('text', {class: 'camp-pop', x: toX(map.camps[index]), y: ROAD_Y - 34}, effects); label.textContent = text;
      wait(() => label.remove(), 900);
    }
    // The leftmost camp still standing and the stretch where a bomb would still reach it.
    function drawWindow(frame, owner) {
      windowLayer.replaceChildren();
      if (!frame) return;
      const x = toX(frame.x), a = toX(frame.window[0]), b = toX(frame.window[1]);
      svg('path', {class: 'camp-pointer', d: `M${x} ${ROAD_Y - 52}l-6-10h12z`}, windowLayer);
      svg('text', {class: 'camp-pointer-label', x, y: ROAD_Y - 66}, windowLayer).textContent = '最左的营地';
      if (!insightToggle.checked && owner !== 'swap') return;
      svg('rect', {class: 'camp-window', x: a, y: 250, width: b - a, height: 24, rx: 6}, windowLayer);
      svg('path', {class: 'camp-window-edge', d: `M${a} 248V276M${b} 248V276`}, windowLayer);
      const pick = owner === 'naive' ? x : b;
      svg('path', {class: 'camp-window-pick', d: `M${pick} 246l-5-8h10z`}, windowLayer);
      svg('text', {class: 'camp-window-label', x: (a + b) / 2, y: 300}, windowLayer).textContent = `能炸到它的位置 ${fmt(frame.window[0])}～${fmt(frame.window[1])}`;
    }
    function moveKlee(u, {hop = true} = {}) {
      klee.style.transform = `translate(${toX(u)}px, ${ROAD_Y - 44}px)`;
      if (hop && !reduced()) restart(klee, 'is-hopping');
    }

    // ----- Board state -----
    function chart() {
      const series = [[chartPlayer, playerResult ? frontier(map.camps, player) : []], [chartKlee, run ? frontier(map.camps, run.bombs.slice(0, frameIndex)) : []]];
      const span = Math.max(2, ...series.map(([, values]) => values.length)) - 1, n = map.camps.length;
      for (const [node, values] of series) node.setAttribute('points', values.map((value, i) => `${(6 + i * 288 / span).toFixed(1)},${(60 - value / n * 54).toFixed(1)}`).join(' '));
      chartValue.textContent = run ? `可莉第 ${frameIndex} 颗后，从左数清掉 ${frontier(map.camps, run.bombs.slice(0, frameIndex)).at(-1)} 个` : '扔完以后显示';
    }
    function score(node, result) {
      node.querySelector('strong').textContent = result ? (result.missed ? `漏了 ${result.missed} 个` : `${result.bombs} 颗炸弹`) : '—';
      node.querySelector('small').textContent = result ? `清掉 ${result.cleared}/${map.camps.length} 个营地` : `清掉 —/${map.camps.length} 个营地`;
      node.querySelector('.fish-score-bar i').style.width = result ? `${result.cleared / map.camps.length * 100}%` : '0%';
    }
    const setPhase = value => {
      phase = value; panel.dataset.campPhase = value;
      throwButton.disabled = value !== 'place';
      algorithmButton.disabled = !['thrown', 'algorithm'].includes(value);
      stepButton.disabled = skipButton.disabled = !['algorithm', 'swap'].includes(value);
      retryButton.disabled = value !== 'done';
      exchangeButton.disabled = value !== 'done' || !playerResult || playerResult.missed > 0;
      strategyInputs.forEach(input => { input.disabled = ['algorithm', 'finishing', 'swap'].includes(value); });
      algorithmButton.textContent = value === 'algorithm' ? (timer ? '暂停' : '继续') : '看可莉怎么炸';
      cursor.toggleAttribute('hidden', value !== 'place');
      hud();
    };
    function hud() {
      if (!map) return;
      hudMap.textContent = `营地 #${map.seed} · 还剩 ${left()} 个`;
      hudState.textContent = phase === 'place' ? `旅行者 · 炸弹 ${player.length}/${map.camps.length}` : phase === 'done' ? '本局结算'
        : phase === 'throwing' ? '嘿——咻！' : phase === 'swap' ? `挪炸弹 · 第 ${swapIndex} 次` : phase === 'algorithm' || phase === 'finishing' ? `${NAMES[run?.strategy || strategy()]} · 第 ${frameIndex} 颗` : '准备交给可莉';
    }

    // ----- Player throws -----
    function viewPoint(event) {
      const matrix = view.getScreenCTM(); if (!matrix) return null;
      const p = view.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      const q = p.matrixTransform(matrix.inverse());
      return {u: snap(toU(q.x)), y: q.y};
    }
    view.addEventListener('click', event => {
      if (phase !== 'place') return;
      const at = viewPoint(event); if (!at) return;
      const hit = player.findIndex(u => Math.abs(u - at.u) < 0.6);
      if (hit >= 0) { player.splice(hit, 1); drawBombs(player, 'player'); say(`收回一颗。现在放了 ${player.length} 颗。`, 'curious'); hud(); return; }
      if (player.length >= map.camps.length) { say('炸弹已经够多啦！点一颗炸弹可以收回它。', 'wink'); return; }
      player.push(at.u); addBomb(at.u, 'player', player.length - 1, {drop: true});
      const reach = map.camps.filter(u => covers(at.u, u)).length;
      say(reach ? `放在 ${fmt(at.u)}，这颗能炸到 ${reach} 个营地！` : `放在 ${fmt(at.u)}……这颗什么都炸不到哦。`, reach ? 'happy' : 'care');
      if (player.length === 1) voice('klee-camp-ready', {minor: true});
      hud();
    });
    view.addEventListener('pointermove', event => {
      if (phase !== 'place' || event.pointerType === 'touch') { cursor.setAttribute('hidden', ''); return; }
      const at = viewPoint(event); if (!at) return;
      placeRange(cursor.querySelector('rect'), at.u);
      cursor.querySelector('line').setAttribute('x1', toX(at.u)); cursor.querySelector('line').setAttribute('x2', toX(at.u));
      cursor.removeAttribute('hidden');
    });
    view.addEventListener('pointerleave', () => cursor.setAttribute('hidden', ''));
    throwButton.addEventListener('click', () => {
      if (phase !== 'place') return;
      if (!player.length) { say('先点路面放炸弹嘛！', 'wink'); return; }
      setPhase('throwing'); announce('嘿——咻！'); voice('klee-blast');
      const hits = cleared(map.camps, player);
      blast(player, () => {
        hits.forEach((hit, i) => { if (hit) { standing[i] = false; pop(i); } });
        showCamps();
        const missed = hits.filter(hit => !hit).length;
        playerResult = {bombs: player.length, cleared: map.camps.length - missed, missed};
        score(scorePlayer, playerResult); setPhase('thrown'); chart();
        if (missed) { say(`哎呀，还有 ${missed} 个营地没炸到！看可莉的！`, 'care'); voice('klee-camp-miss', {queue: true}); }
        else { say(`${player.length} 颗炸弹清光了所有营地！看可莉能不能更少～`, 'laugh'); voice('klee-camp-done', {queue: true}); }
      });
    });

    // ----- Klee sweeps from left to right, one bomb per round -----
    function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }
    // A round lands its bomb, then blows up; a pending round can be settled at once.
    let pending = null;
    function land(round, instant) {
      if (round.landed) return; round.landed = true;
      addBomb(round.frame.bomb, 'klee', round.index, {drop: !instant});
    }
    function fire(round, instant) {
      if (round.fired) return; round.fired = true; if (pending === round) pending = null;
      round.frame.hit.forEach(i => { standing[i] = false; if (!instant) pop(i); });
      showCamps({instant}); chart(); hud();
      if (round.index === run.frames.length - 1) finish();
    }
    function settle() {
      if (!pending) return;
      const round = pending; pending = null; clock.clear(); effects.replaceChildren();
      land(round, true); fire(round, true);
    }
    function showFrame(frame, {instant = false} = {}) {
      const owner = run.strategy, index = frameIndex - 1, round = {frame, index, landed: false, fired: false};
      drawWindow(frame, owner); moveKlee(frame.bomb, {hop: !instant});
      const list = frame.hit.map(i => fmt(map.camps[i])).join('、');
      insightStep.textContent = `第 ${index + 1} 颗：最左还没炸的营地在 ${fmt(frame.x)}，能炸到它的位置是 ${fmt(frame.window[0])}～${fmt(frame.window[1])}。` +
        (owner === 'greedy' ? `可莉扔在最右边的 ${fmt(frame.bomb)}` : `可莉直接扔在营地上 ${fmt(frame.bomb)}`) + `，清掉 ${list}。`;
      if (instant) { land(round, true); fire(round, true); return; }
      pending = round;
      say(index === 0 ? (owner === 'greedy' ? '最左边的营地……往右挪到刚好够得着的地方，扔！' : '最左边的营地，就扔在它头上！') : `第 ${index + 1} 颗！还剩 ${left()} 个营地～`, owner === 'greedy' ? 'proud' : 'happy');
      wait(() => { land(round, false); wait(() => { if (!round.fired) blast([frame.bomb], () => fire(round, false)); }, 380); }, 260);
    }
    function advance({instant = false} = {}) {
      if (!run || frameIndex >= run.frames.length) return;
      settle();
      showFrame(run.frames[frameIndex++], {instant});
      if (frameIndex < run.frames.length) setPhase('algorithm');
    }
    function play() { stopTimer(); timer = setInterval(advance, reduced() ? 500 : 1500); setPhase('algorithm'); }
    function resetBoard() {
      clock.clear(); pending = null; effects.replaceChildren(); windowLayer.replaceChildren();
      standing = map.camps.map(() => true); showCamps({instant: true});
      campLayer.querySelectorAll('.camp').forEach(node => node.classList.remove('is-hit', 'is-witness'));
    }
    function startKlee() {
      stopTimer(); resetBoard(); drawBombs([], 'klee');
      run = {...sweep(map.camps, strategy()), strategy: strategy()}; frameIndex = 0;
      kleeLabel.textContent = NAMES[run.strategy];
      verdict.hidden = true; scoreKlee.classList.remove('is-winner'); scorePlayer.classList.remove('is-winner'); score(scoreKlee, null);
      announce(run.strategy === 'greedy' ? '可莉的妙计！' : '可莉的回合！');
      voice(run.strategy === 'greedy' ? 'klee-camp-clever' : 'klee-camp-start', {queue: true});
      moveKlee(0, {hop: false}); advance(); play();
    }
    function finish() {
      stopTimer(); setPhase('finishing');
      const count = run.bombs.length, result = {bombs: count, cleared: map.camps.length, missed: 0};
      score(scoreKlee, result);
      wait(() => {
        windowLayer.replaceChildren();
        const playerBombs = playerResult.missed ? Infinity : playerResult.bombs;
        const playerWins = playerBombs < count, kleeWins = count < playerBombs;
        scorePlayer.classList.toggle('is-winner', playerWins); scoreKlee.classList.toggle('is-winner', kleeWins);
        stats.rounds++; if (playerWins) stats.wins++; if (playerBombs === map.best) stats.best++; save(); showStats();
        if (kleeWins) { announce('可莉赢啦！'); say(`可莉只用了 ${count} 颗炸弹！嘿嘿～`, 'proud'); voice('klee-camp-win', {queue: true}); }
        else if (playerWins) { announce('旅行者赢啦！'); say(`旅行者只用了 ${playerBombs} 颗，比可莉还少！`, 'care'); voice('klee-camp-lose', {queue: true}); }
        else { announce('一样多！'); say(`都是 ${count} 颗！我们都是爆破专家！`, 'laugh'); voice('klee-camp-tie', {queue: true}); }
        const witnessCamps = witnesses(map.camps);
        if (run.strategy === 'greedy') campLayer.querySelectorAll('.camp').forEach((node, i) => node.classList.toggle('is-witness', witnessCamps.includes(map.camps[i])));
        const you = playerResult.missed ? `旅行者漏了 ${playerResult.missed} 个营地。` : playerBombs === map.best ? `旅行者的 ${playerBombs} 颗也是最少的！` : `旅行者用了 ${playerBombs} 颗，多了 ${playerBombs - map.best} 颗。`;
        verdict.textContent = run.strategy === 'naive'
          ? `可莉的直觉是“扔在最左的营地头上”，结果用了 ${count} 颗：炸弹左半边的威力全浪费在已经清掉的地方。${you} 点“换个想法再炸”，看看往右挪一挪会怎样。`
          : `可莉的妙计：每次找最左边还没炸的营地，把炸弹扔到“刚好还能炸到它”的最右边（营地 + ${RADIUS}），共 ${count} 颗。这就是最少：亮起来的 ${witnessCamps.length} 个营地两两相距超过 ${RADIUS * 2}，一颗炸弹最多炸到其中一个。${you}` + (playerResult.missed ? '' : ' 点“挪一挪你的炸弹”，看你的方案怎样一步步变成可莉的方案。');
        verdict.hidden = false; setPhase('done');
        insightStep.textContent = `结果：${NAMES[run.strategy]}用了 ${count} 颗炸弹；这条路最少需要 ${map.best} 颗。`;
      }, reduced() ? 50 : 500);
    }
    algorithmButton.addEventListener('click', () => {
      if (phase === 'thrown') { startKlee(); return; }
      if (phase === 'algorithm') { if (timer) { stopTimer(); setPhase('algorithm'); } else play(); }
    });
    stepButton.addEventListener('click', () => {
      stopTimer();
      if (phase === 'swap') { swapStep(); return; }
      advance();
    });
    skipButton.addEventListener('click', () => {
      stopTimer(); clock.clear(); effects.replaceChildren(); pending = null;
      if (phase === 'swap') { while (swap && swapIndex < swap.frames.length) swapStep({instant: true}); if (phase === 'swap') endSwap(); return; }
      // Replay every round instantly from a clean board so nothing is half-drawn.
      resetBoard(); drawBombs([], 'klee'); frameIndex = 0;
      while (run && frameIndex < run.frames.length) advance({instant: true});
    });
    retryButton.addEventListener('click', () => {
      if (phase !== 'done') return;
      const other = strategyInputs.find(input => input.value !== strategy()); if (other) other.checked = true;
      setPhase('thrown'); startKlee();
    });

    // ----- Exchange argument on the player's own bombs -----
    function startSwap() {
      stopTimer(); resetBoard(); drawBombs(player, 'player');
      swap = exchange(map.camps, player); swapIndex = 0;
      bombLayer.querySelectorAll('.camp-bomb').forEach(group => group.classList.add('is-waiting'));
      setPhase('swap'); announce('挪一挪！'); voice('klee-camp-swap', {queue: true});
      say('从左往右看：每次找最左边还没炸的营地，把你炸到它的那颗炸弹往右挪到刚好够得着的地方。', 'thinking');
      insightStep.textContent = '交换论证：换掉你方案里的一颗炸弹，只要它原来能炸到的营地还都炸得到，炸弹数就不会变多。';
      timer = setInterval(() => swapStep(), reduced() ? 500 : 1600);
    }
    function swapStep({instant = false} = {}) {
      if (!swap || phase !== 'swap') return;
      if (swapIndex >= swap.frames.length) { endSwap(); return; }
      const frame = swap.frames[swapIndex++], group = bombLayer.querySelector(`.camp-bomb[data-index="${frame.bomb}"]`);
      const range = ranges.querySelector(`[data-index="${frame.bomb}"]`);
      drawWindow({x: frame.x, window: [Math.max(0, frame.x - RADIUS), Math.min(ROAD, frame.x + RADIUS)]}, 'swap');
      group.classList.remove('is-waiting'); group.classList.add('is-moved');
      group.style.transform = `translate(${toX(frame.to)}px, ${ROAD_Y - 2}px)`; placeRange(range, frame.to); range.classList.add('is-moved');
      frame.hit.forEach(i => { standing[i] = false; if (!instant) pop(i, '还在！'); });
      showCamps({instant});
      const moved = frame.to - frame.from;
      say(moved > 1e-9 ? `你的第 ${frame.bomb + 1} 颗从 ${fmt(frame.from)} 挪到 ${fmt(frame.to)}，它原来炸到的 ${frame.kept} 个营地一个都没漏！`
        : `你的第 ${frame.bomb + 1} 颗已经在 ${fmt(frame.to)}，正好是最右的位置，不用挪～`, 'proud');
      insightStep.textContent = `第 ${swapIndex} 次：最左还没炸的营地 x = ${fmt(frame.x)}。你的炸弹 q = ${fmt(frame.from)} 能炸到它，所以 q ≤ x + ${RADIUS} = ${fmt(frame.to)}；` +
        `它右边能炸到的营地 y ≤ q + ${RADIUS} ≤ ${fmt(frame.to + RADIUS)}，挪到 ${fmt(frame.to)} 后照样炸得到。`;
      hud();
      if (swapIndex >= swap.frames.length) { stopTimer(); if (instant) endSwap(); else wait(endSwap, 900); }
    }
    function endSwap() {
      if (phase !== 'swap') return;
      stopTimer(); windowLayer.replaceChildren();
      swap.spare.forEach(j => bombLayer.querySelector(`.camp-bomb[data-index="${j}"]`)?.classList.add('is-spare'));
      swap.spare.forEach(j => ranges.querySelector(`[data-index="${j}"]`)?.classList.add('is-spare'));
      const used = swap.frames.length;
      say(swap.spare.length ? `挪完啦！只用到 ${used} 颗，剩下 ${swap.spare.length} 颗是多余的——这就是可莉的妙计！` : `挪完啦！${used} 颗一颗不多一颗不少——你的方案已经是最少的！`, 'laugh');
      verdict.textContent = `交换论证：你的方案每次换掉一颗炸弹，仍然清光所有营地，炸弹数不增加；换完就是可莉的妙计（${used} 颗）。所以任何方案都不会比妙计更少——妙计是最优的。`;
      verdict.hidden = false; setPhase('done'); swap = null;
    }
    exchangeButton.addEventListener('click', () => { if (phase === 'done' && playerResult && !playerResult.missed) startSwap(); });

    // ----- Rounds -----
    function again() {
      stopTimer(); stopVoice(); clock.clear();
      stage.classList.remove('is-shaking'); klee.classList.remove('is-hopping');
      run = null; frameIndex = 0; swap = null; player = []; playerResult = null;
      resetBoard(); drawBombs([], 'player');
      strategyInputs.forEach(input => { input.checked = input.value === 'naive'; }); kleeLabel.textContent = NAMES.naive;
      verdict.hidden = true; scorePlayer.classList.remove('is-winner'); scoreKlee.classList.remove('is-winner'); score(scorePlayer, null); score(scoreKlee, null);
      setPhase('place'); moveKlee(0, {hop: false}); chart();
      insightStep.textContent = '可莉出发后，这里会显示每一轮“最左的营地”和能炸到它的位置。';
      announce('旅行者先扔！');
      say(`前面有 ${map.camps.length} 个丘丘人营地！点路面放蹦蹦炸弹，每颗能炸到左右 ${RADIUS} 格以内，用最少的炸弹清光它们！`, 'happy');
      voice('klee-camp-intro');
    }
    function newMap(seed = 1000 + Math.floor(Math.random() * 9000)) {
      map = makeMap(seed); seedLabel.textContent = '#' + seed;
      drawDecor(); drawCamps(); again();
    }
    againButton.addEventListener('click', again);
    newButton.addEventListener('click', () => newMap());
    insightToggle.addEventListener('change', () => { insight.hidden = !insightToggle.checked; if (run && phase === 'algorithm') drawWindow(run.frames[frameIndex - 1], run.strategy); });

    const seedFromHash = Number(new URLSearchParams(location.hash.split('?')[1] || '').get('map'));
    insight.hidden = !insightToggle.checked; showStats(); drawRuler();
    newMap(Number.isSafeInteger(seedFromHash) && seedFromHash > 0 ? seedFromHash : undefined);
    return () => { stopVoice(); if (timer) { stopTimer(); if (phase === 'algorithm') setPhase('algorithm'); } };
  }

  return {model, init};
});

;
/* js/lab-games.js */
/* Independent navigation and lifecycle for Klee's four games. */
(() => {
  'use strict';
  const element=(tag,cls,text)=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;return el;};
  const sessions = new WeakMap();
  window.initLabGames=()=>{
    const tablist=document.querySelector('.ai-tabs');
    if(!tablist)return ()=>{};
    if(sessions.has(tablist)) {
      const session=sessions.get(tablist); session.resume(); return session.pause;
    }
    const tabs=[...tablist.querySelectorAll('[data-experiment-tab]')];
    const panels=[...document.querySelectorAll('[data-experiment-panel]')];
    const initialized=new Map(),failed=new Set();
    // Games in their own files register in window.LabExperiments.
    const initializers=window.LabExperiments||{};
    const stop=()=>{
      initialized.forEach(pause=>pause());
      document.dispatchEvent(new CustomEvent('lab:panel-change'));
    };
    function activate(id,focus=false) {
      if(!tabs.some(tab=>tab.dataset.experimentTab===id))id=tabs[0].dataset.experimentTab;
      stop();
      tabs.forEach(tab=>{
        const active=tab.dataset.experimentTab===id;
        tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
        if(active&&focus)tab.focus();
      });
      panels.forEach(panel=>{panel.hidden=panel.dataset.experimentPanel!==id;});
      // Tab navigation is independent of each game. Initialize each
      // panel only when opened, so one component cannot disable the other tabs.
      if(initializers[id]&&!initialized.has(id)&&!failed.has(id)) {
        const panel=panels.find(panel=>panel.dataset.experimentPanel===id);
        try {
          initialized.set(id,initializers[id](panel));
        } catch(error) {
          failed.add(id);
          const notice=element('p','ai-empty','游戏组件未能加载，请刷新页面后重试。');
          notice.setAttribute('role','alert');panel.querySelector('.lab-experiment-heading').append(notice);
          console.error('Lab game initialization failed:',id,error);
        }
      }
      if(location.hash!=='#'+id)history.replaceState(null,'','#'+id);
    }
    tabs.forEach((tab,index)=>{
      tab.addEventListener('click',()=>activate(tab.dataset.experimentTab));
      tab.addEventListener('keydown',event=>{
        const offset=event.key==='ArrowRight'?1:event.key==='ArrowLeft'?-1:0;
        const target=event.key==='Home'?0:event.key==='End'?tabs.length-1:
          offset?(index+offset+tabs.length)%tabs.length:-1;
        if(target>=0){event.preventDefault();activate(tabs[target].dataset.experimentTab,true);}
      });
    });
    const visibility=()=>{if(document.hidden)stop();};
    // `#hike?map=1001`: the tab is the part before `?`; games read their own parameters.
    const tabFromHash=()=>location.hash.slice(1).split('?')[0];
    const hash=()=>activate(tabFromHash());
    let listening=false;
    const resume=()=>{
      if(!listening){document.addEventListener('visibilitychange',visibility);window.addEventListener('hashchange',hash);listening=true;}
      activate(tabFromHash());
    };
    const pause=()=>{
      stop();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('hashchange',hash);listening=false;
    };
    sessions.set(tablist,{resume,pause});resume();return pause;
  };

  // Also boot independently of the blog's navigation script. This supports a
  // freshly deployed games page even if an older navigation script is cached.
  let pauseActive=()=>{};
  const boot=()=>{pauseActive();pauseActive=window.initLabGames();};
  document.addEventListener('pjax:send',()=>pauseActive());
  document.addEventListener('pjax:complete',boot);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();

;
/* js/home-ai.js */
/* Local numerical diagrams for sampling, neural networks and attention. */
(() => {
  'use strict';
  const M=window.LabMath;
  const svg=(tag,attrs,value)=>{const node=document.createElementNS('http://www.w3.org/2000/svg',tag);Object.entries(attrs).forEach(([name,v])=>node.setAttribute(name,v));if(value!==undefined)node.textContent=value;return node;};
  const text=(root,selector,value)=>{root.querySelector(selector).textContent=value;};
  const reduced=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
  function sampling(root){
    const words=['好','冷','热','糟'],inputs=[...root.querySelectorAll('[data-home-logit]')];
    const temperature=root.querySelector('[data-home-sampling-temperature]'),topK=root.querySelector('[data-home-sampling-topk]'),play=root.querySelector('[data-home-sampling-play]');
    const diagram=root.querySelector('.home-diagram'),nodes=root.querySelector('[data-home-sampling-nodes]'),edges=root.querySelector('[data-home-sampling-edges]');
    const labels=[],paths=[];let probabilities=[],counts=words.map(()=>0),timer=null,enabled=!reduced(),active=false;
    words.forEach((word,index)=>{
      const y=52+index*72;
      nodes.append(svg('rect',{x:25,y:y-22,width:150,height:45,rx:10,class:'home-neuron'}),svg('text',{x:46,y:y+7},word));
      nodes.append(svg('text',{x:148,y:y+7,'text-anchor':'end','data-score':index}));
      edges.append(svg('path',{d:`M175 ${y} C235 ${y},235 160,280 160`,class:'home-flow-line'}));
      const line=svg('path',{d:`M350 160 C400 160,400 ${y},454 ${y}`,class:'home-flow-line'});edges.append(line);paths.push(line);
      nodes.append(svg('rect',{x:454,y:y-22,width:162,height:45,rx:10,class:'home-neuron'}));
      const label=svg('text',{x:535,y:y+7,'text-anchor':'middle'});nodes.append(label);labels.push(label);
    });
    nodes.append(svg('circle',{cx:315,cy:160,r:40,class:'home-neuron'}),svg('text',{x:315,y:166,'text-anchor':'middle'},'T'),svg('text',{x:315,y:224,'text-anchor':'middle',class:'home-svg-label'},'softmax'));
    function render(){
      probabilities=M.softmax(inputs.map(input=>Math.max(-10,Math.min(10,Number(input.value)||0))),Number(temperature.value),Number(topK.value));
      text(root,'[data-home-temperature-value]',Number(temperature.value).toFixed(1));text(root,'[data-home-topk-value]',topK.value);
      const total=counts.reduce((sum,count)=>sum+count,0);
      probabilities.forEach((p,index)=>{
        nodes.querySelector(`[data-score="${index}"]`).textContent=(Number(inputs[index].value)||0).toFixed(1);
        labels[index].textContent=(p*100).toFixed(1)+'%';paths[index].style.opacity=String(.15+p*.85);paths[index].style.strokeWidth=String(1+p*5);
        root.querySelector(`[data-home-sampling-prob="${index}"]`).style.width=p*100+'%';
        root.querySelector(`[data-home-sampling-frequency="${index}"]`).style.width=(total?counts[index]/total*100:0)+'%';
        text(root,`[data-home-sampling-label="${index}"]`,`${(p*100).toFixed(1)}% · ${counts[index]} 次`);
      });text(root,'[data-home-sampling-count]',total+' 次采样');
    }
    function sample(){
      const draw=Math.random();let sum=0,picked=probabilities.length-1;
      for(let i=0;i<probabilities.length;i++){sum+=probabilities[i];if(draw<sum){picked=i;break;}}
      counts[picked]++;const output=root.querySelector('[data-home-sampled]');output.textContent=words[picked];output.classList.remove('is-changing');
      requestAnimationFrame(()=>output.classList.add('is-changing'));
      root.querySelectorAll('[data-home-sampling-row]').forEach((node,index)=>node.classList.toggle('is-picked',index===picked));render();
    }
    const pause=()=>{clearInterval(timer);timer=null;diagram.classList.remove('is-running');};
    function resume(){pause();play.disabled=reduced();play.textContent=enabled?'暂停播放':'自动播放';play.setAttribute('aria-pressed',String(enabled));if(active&&enabled&&!document.hidden&&!reduced()){timer=setInterval(sample,1800);diagram.classList.add('is-running');}}
    play.addEventListener('click',()=>{enabled=!enabled;resume();});root.querySelector('[data-home-sampling-step]').addEventListener('click',sample);
    const reset=()=>{counts=words.map(()=>0);text(root,'[data-home-sampled]','…');render();};
    root.querySelector('[data-home-sampling-reset]').addEventListener('click',reset);[...inputs,temperature,topK].forEach(input=>input.addEventListener('input',reset));
    render();sample();return {pause,resume:()=>{active=true;resume();},deactivate:()=>{active=false;pause();}};
  }
  function network(root){
    const rate=root.querySelector('[data-home-network-rate]'),play=root.querySelector('[data-home-network-play]'),diagram=root.querySelector('.home-diagram');
    const edges=root.querySelector('[data-home-network-edges]'),nodes=root.querySelector('[data-home-network-nodes]'),inputY=[115,230],hiddenY=[45,125,205,285];
    const labels=[],circles=[],lines=[];let net=M.network(),selected=0,steps=0,frame=null,last=0;
    for(let j=0;j<4;j++)for(let k=0;k<2;k++){
      const line=svg('path',{d:`M95 ${inputY[k]} C190 ${inputY[k]},190 ${hiddenY[j]},285 ${hiddenY[j]}`,fill:'none',class:'home-network-line'});edges.append(line);lines.push({line,weight:()=>net.w[j][k]});
    }
    for(let j=0;j<4;j++){
      const line=svg('path',{d:`M340 ${hiddenY[j]} C430 ${hiddenY[j]},430 170,535 170`,fill:'none',class:'home-network-line'});edges.append(line);lines.push({line,weight:()=>net.v[j]});
    }
    for(const [x,y] of [[65,inputY[0]],[65,inputY[1]],...hiddenY.map(y=>[312,y]),[565,170]]){
      const circle=svg('circle',{cx:x,cy:y,r:29,class:'home-neuron'}),label=svg('text',{x,y:y+6,'text-anchor':'middle'});nodes.append(circle,label);circles.push(circle);labels.push(label);
    }
    nodes.append(svg('text',{x:65,y:315,'text-anchor':'middle',class:'home-svg-label'},'输入'),svg('text',{x:312,y:325,'text-anchor':'middle',class:'home-svg-label'},'tanh 隐藏层'),svg('text',{x:565,y:245,'text-anchor':'middle',class:'home-svg-label'},'p(1)'));
    const pause=()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;play.textContent='开始训练';diagram.classList.remove('is-training');};
    function render(){
      const sample=M.datasets.xor[selected],result=M.forward(net,sample.x),metric=M.gradients(net,M.datasets.xor);
      [...sample.x,...result.hidden,result.output].forEach((value,index)=>{labels[index].textContent=value.toFixed(index<2?0:2);circles[index].style.fill=`color-mix(in srgb, ${value>=0?'#a59fcf':'#9cbcd8'} ${15+Math.abs(value)*30}%, var(--lab-surface))`;});
      lines.forEach(({line,weight})=>{const value=weight();line.style.stroke=value>=0?'#9382bd':'#7fabc9';line.style.strokeWidth=String(1+Math.min(5,Math.abs(value))*1.2);line.style.opacity=String(.35+Math.min(1,Math.abs(value))*.45);});
      text(root,'[data-home-network-rate-value]',Number(rate.value).toFixed(2));text(root,'[data-home-network-steps]',steps);text(root,'[data-home-network-loss]',metric.loss.toFixed(4));text(root,'[data-home-network-accuracy]',Math.round(metric.accuracy*100)+'%');
      text(root,'[data-home-network-prediction]',`输入 (${sample.x.join(', ')})，目标为 ${sample.y}，预测 p(1) = ${result.output.toFixed(3)}`);return metric;
    }
    function step(amount=100){M.train(net,M.datasets.xor,Number(rate.value),Math.min(amount,2000-steps));steps=Math.min(2000,steps+amount);const metric=render();return steps>=2000||(metric.loss<.018&&metric.accuracy===1);}
    root.querySelectorAll('[data-home-network-input]').forEach(button=>button.addEventListener('click',()=>{selected=Number(button.dataset.homeNetworkInput);root.querySelectorAll('[data-home-network-input]').forEach(node=>node.setAttribute('aria-pressed',String(node===button)));render();}));
    rate.addEventListener('input',render);root.querySelector('[data-home-network-step]').addEventListener('click',()=>{pause();step();});
    root.querySelector('[data-home-network-reset]').addEventListener('click',()=>{pause();net=M.network();steps=0;render();});
    play.addEventListener('click',()=>{
      if(frame!==null){pause();return;}if(steps>=2000){net=M.network();steps=0;}if(reduced()){while(!step()){}return;}
      play.textContent='暂停训练';diagram.classList.add('is-training');last=0;
      const tick=time=>{if(time-last>=100){last=time;if(step(20)){pause();return;}}frame=requestAnimationFrame(tick);};frame=requestAnimationFrame(tick);
    });render();return {pause,resume:()=>{},deactivate:pause};
  }
  function attention(root){
    const words=['我','在','学习','AI'],keys=[[1,0,0,0],[0,.8,.2,0],[0,.3,1,.4],[0,.1,.8,1]],queries=keys.map(row=>row.slice());
    const matrix=root.querySelector('[data-home-attention-matrix]'),mask=root.querySelector('[data-home-attention-mask]'),inputs=[...root.querySelectorAll('[data-home-query-dim]')];let selected=2;const cells=[];
    const label=value=>{const node=document.createElement('span');node.className='home-matrix-label';node.textContent=value;matrix.append(node);};label('Q / K');words.forEach(label);
    words.forEach((word,row)=>{label(word);words.forEach((_,column)=>{const cell=document.createElement('button');cell.type='button';cell.className='home-matrix-cell';matrix.append(cell);cells.push({cell,row,column});cell.addEventListener('click',()=>select(row));});});
    function render(){
      const weights=M.attention(queries,keys,mask.checked);
      cells.forEach(({cell,row,column})=>{const blocked=mask.checked&&column>row,value=weights[row][column];cell.textContent=blocked?'—':(value*100).toFixed(0)+'%';cell.style.backgroundColor=blocked?'var(--lab-soft)':`rgba(119,107,174,${.08+value*.65})`;cell.classList.toggle('is-selected',row===selected);cell.setAttribute('aria-label',`${words[row]}关注${words[column]}：${blocked?'已屏蔽':(value*100).toFixed(1)+'%'}`);});
      inputs.forEach((input,index)=>text(root,`[data-home-query-value="${index}"]`,queries[selected][index].toFixed(1)));
      root.querySelectorAll('[data-home-query]').forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.homeQuery)===selected)));
      text(root,'[data-home-attention-status]',`当前查询词：${words[selected]} · 可关注 ${mask.checked?selected+1:4} 个词`);
    }
    function select(index){selected=index;inputs.forEach((input,i)=>{input.value=queries[index][i];});render();}
    root.querySelectorAll('[data-home-query]').forEach(button=>button.addEventListener('click',()=>select(Number(button.dataset.homeQuery))));
    inputs.forEach((input,index)=>input.addEventListener('input',()=>{queries[selected][index]=Number(input.value);render();}));mask.addEventListener('change',render);select(selected);
    return {pause:()=>{},resume:()=>{},deactivate:()=>{}};
  }
  const sessions=new WeakMap();
  window.initHomeAI=()=>{
    const root=document.querySelector('[data-home-ai]');if(!root)return ()=>{};
    if(sessions.has(root)){const session=sessions.get(root);session.resume();return session.pause;}
    const models=new Map(),initializers={sampling,network,attention};let type='sampling',visible=true,listening=false;
    const pauseAll=()=>models.forEach(model=>model.deactivate());
    function refresh(){
      pauseAll();
      root.querySelectorAll('[data-home-type]').forEach(button=>{const active=button.dataset.homeType===type;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;});
      root.querySelectorAll('[data-home-visual]').forEach(panel=>{panel.hidden=panel.dataset.homeVisual!==type;});
      if(!models.has(type))models.set(type,initializers[type](root.querySelector(`[data-home-visual="${type}"]`)));
      if(visible&&!document.hidden)models.get(type).resume();
    }
    function bindTabs(selector,set){const buttons=[...root.querySelectorAll(selector)];buttons.forEach((button,index)=>{button.addEventListener('click',()=>set(button));button.addEventListener('keydown',event=>{const target=event.key==='ArrowRight'?(index+1)%buttons.length:event.key==='ArrowLeft'?(index-1+buttons.length)%buttons.length:event.key==='Home'?0:event.key==='End'?buttons.length-1:-1;if(target>=0){event.preventDefault();set(buttons[target]);buttons[target].focus();}});});}
    bindTabs('[data-home-type]',button=>{type=button.dataset.homeType;refresh();});
    const visibility=()=>{if(document.hidden)pauseAll();else refresh();};
    const observer='IntersectionObserver' in window?new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;pauseAll();if(visible&&!document.hidden&&models.has(type))models.get(type).resume();},{threshold:.05}):null;
    const resume=()=>{if(!listening){document.addEventListener('visibilitychange',visibility);observer?.observe(root);listening=true;}refresh();};
    const pause=()=>{pauseAll();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);listening=false;};
    sessions.set(root,{resume,pause});resume();return pause;
  };
})();

;
/* js/home-motion.js */
/* Lightweight homepage motion; computation widgets have separate lifecycles. */
(() => {
  'use strict';
  window.initHomeMotion=()=>{
    const home=document.querySelector('.lab-home');if(!home?.querySelector('.lab-hero'))return ()=>{};
    const media=matchMedia('(prefers-reduced-motion: reduce)'),cleanups=[];
    const listen=(target,type,handler,options)=>{target.addEventListener(type,handler,options);cleanups.push(()=>target.removeEventListener(type,handler,options));};
    const ambient=document.createElement('div');ambient.className='home-ambient';ambient.setAttribute('aria-hidden','true');
    for(let index=0;index<9;index++){
      const petal=document.createElement('span');petal.className='home-petal';
      petal.style.setProperty('--petal-left',(index*12.7+3)%100+'%');petal.style.setProperty('--petal-duration',23+index%5*3+'s');
      petal.style.setProperty('--petal-delay',-index*4.3+'s');ambient.append(petal);
    }
    const progress=document.createElement('div');progress.className='home-scroll-progress';progress.setAttribute('aria-hidden','true');
    document.body.prepend(ambient,progress);let frame=null;
    const update=()=>{frame=null;const total=document.documentElement.scrollHeight-innerHeight;progress.style.transform=`scaleX(${total>0?Math.min(1,scrollY/total):0})`;};
    listen(window,'scroll',()=>{if(frame===null)frame=requestAnimationFrame(update);},{passive:true});listen(window,'resize',update);update();
    const cards=home.querySelectorAll('.home-track-card,.lab-post-card');
    cards.forEach(card=>{
      listen(card,'pointermove',event=>{if(event.pointerType!=='mouse'||media.matches)return;const rect=card.getBoundingClientRect();card.style.setProperty('--pointer-x',event.clientX-rect.left+'px');card.style.setProperty('--pointer-y',event.clientY-rect.top+'px');card.classList.add('is-pointer-active');});
      listen(card,'pointerleave',()=>card.classList.remove('is-pointer-active'));
    });
    listen(document,'visibilitychange',()=>document.body.classList.toggle('home-motion-paused',document.hidden));
    return ()=>{cleanups.forEach(cleanup=>cleanup());cancelAnimationFrame(frame);ambient.remove();progress.remove();cards.forEach(card=>card.classList.remove('is-pointer-active'));document.body.classList.remove('home-motion-paused');};
  };
})();

;
/* js/starlab.js */
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

;
/* js/companion.js */
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
  const articleKey = 'lsworld.klee.articles.v1';
  let articleVisit = null, articleTimer = null, articleBubble = null, articleBubbleTimer = null;
  let articleManifestPromise = null, articleHistory = {}, welcomedThisPage = false;
  let selectionBox, readingList, readingSelection = '', readingSelectionPath = '',readingSelectionAnchor='',readingSelectionTotal=0;
  let studyBox, currentStudy = null;
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
    root?.querySelectorAll('[data-study-prompt]').forEach(button => { button.disabled = send.disabled || service?.study === false; });
    root?.querySelectorAll('[data-study-prompt="resume"]').forEach(button=>{button.hidden=currentStudy?.status!=='paused';});
    root?.querySelectorAll('[data-study-prompt="pause"]').forEach(button=>{button.hidden=currentStudy?.status!=='active';});
    if (exhausted && !busy && !narration) state('可莉要休息一会儿啦。');
  }
  async function request(path, method = 'GET', data, authenticated = true, raw = false) {
    if (!apiBase) throw new Error('助手正在准备连接，稍后再来找我吧。');
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), path.startsWith('/respond') ? 330000 : 60000);
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
  let markReady; const companionReady = new Promise(resolve => { markReady = resolve; });
  window.LsCompanion = {
    ready: companionReady,
    async call(path, method = 'GET', data) {
      if (!await companionReady || !apiBase) throw new Error('可莉暂时不在线，稍后再来吧。');
      await ensureSession(); return request(path, method, data);
    }
  };
  async function ensureSession() {
    if (token) return;
    if (!sessionPromise) sessionPromise = request('/session', 'POST', {}, false).then(result => {
      token = result.token; persist(); updateLimits(result.limits);
    }).finally(() => { sessionPromise = null; });
    await sessionPromise;
  }
  function setOpen(value) {
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
    let anchor = readingSelection && readingSelectionPath===location.pathname?readingSelectionAnchor:'';
    if (!anchor) {
      for (const heading of document.querySelectorAll('#article-container h1[id],#article-container h2[id],#article-container h3[id],#article-container h4[id]')) {
        if (heading.getBoundingClientRect().top <= 160) anchor = heading.id;
      }
    }
    if(!anchor){try{anchor=decodeURIComponent(location.hash.slice(1));}catch{}}
    return {path: location.pathname, anchor,
      contentHash:document.querySelector('#post #article-container')?.dataset.companionHash||document.querySelector('meta[name="companion-content-hash"]')?.content||'',
      selectionTruncated:readingSelectionTotal>(config.reading.maxSelection||2000),selection: readingSelectionPath === location.pathname ? readingSelection : ''};
  }
  function updateSelection() {
    if (!selectionBox) return;
    const text = readingSelectionPath === location.pathname ? readingSelection : '';
    selectionBox.hidden = !text || !readingList.hidden;
    selectionBox.querySelector('span').textContent = text ? '一起看这段：' + [...text].slice(0, 40).join('') + ([...text].length > 40 ? '…' : '')+(readingSelectionTotal>(config.reading.maxSelection||2000)?'（先读取前2000字）':'') : '';
  }
  function captureSelection() {
    const article = document.querySelector('#post #article-container'), selection = window.getSelection();
    if (!article || !selection?.rangeCount || selection.isCollapsed
      || !article.contains(selection.anchorNode) || !article.contains(selection.focusNode)) return;
    const characters=[...selection.toString().trim()];readingSelectionTotal=characters.length;
    readingSelection=characters.slice(0,config.reading.maxSelection||2000).join('');readingSelectionAnchor='';
    const start=selection.getRangeAt(0).startContainer;
    for(const heading of article.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]'))if(heading===start || heading.contains(start) || heading.compareDocumentPosition(start)&Node.DOCUMENT_POSITION_FOLLOWING)readingSelectionAnchor=heading.id;
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
    const failure = pcmPlayback?.failure;
    const view = pcmPlayback?.view || narration?.view;
    stopAudio(); state('嘟嘟可也在听。'); applyReadingActions(view);
    if(failure){report(failure);offerVoiceRetry(view);state('声音中途断开了，文字已经保留。');}
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
    updateSend();
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
    renderReadingDetail(view);
    const currentHash=document.querySelector('#post #article-container')?.dataset.companionHash;
    if(currentHash && message.sources?.some(source=>{try{return new URL(source.url).pathname===location.pathname && source.contentHash && source.contentHash!==currentHash;}catch{return false;}}) && !item.querySelector('.cp-source-stale'))item.append(node('small','cp-source-stale','这条解释对应文章的旧版本。'));
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
  function renderReadingDetail(view){
    const {message,item}=view;
    if(message.reading && !item.querySelector('.cp-reading-range')){
      const range=message.reading;item.append(node('small','cp-reading-range','阅读范围：'+range.label+(range.partial?'（部分内容）':'')));
      if(range.nextCursor!==null && range.nextCursor!==undefined)item.append(button('继续读本节','cp-read-next',()=>studyPrompt('继续读本节的下一段')));
    }
    if(!message.detail || item.querySelector('.cp-answer-detail'))return;
    const details=node('details','cp-answer-detail');details.open=true;
    details.append(node('summary','','详细说明'));const body=node('div','cp-answer-body');
    const inline=(parent,text)=>{for(const part of text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)){if(part.startsWith('`')&&part.endsWith('`'))parent.append(node('code','',part.slice(1,-1)));else if(part.startsWith('**')&&part.endsWith('**'))parent.append(node('strong','',part.slice(2,-2)));else parent.append(document.createTextNode(part));}};
    let paragraph=[],codeLines=null;
    const flush=()=>{if(!paragraph.length)return;const p=node('p');inline(p,paragraph.join('\n'));body.append(p);paragraph=[];};
    const finishCode=()=>{const block=node('div','cp-code-block'),pre=node('pre'),code=node('code','',codeLines.join('\n'));
      const copy=button('复制代码','cp-copy-code',async()=>{try{await navigator.clipboard.writeText(code.textContent);copy.textContent='已复制';}catch{copy.textContent='请选中代码复制';}});pre.append(code);block.append(copy,pre);body.append(block);codeLines=null;};
    for(const line of String(message.detail).split('\n')){
      if(/^\s*```/.test(line)){if(codeLines===null){flush();codeLines=[];}else finishCode();continue;}
      if(codeLines!==null){codeLines.push(line);continue;}
      if(!line.trim()){flush();continue;}
      if(/^#{1,4}\s/.test(line)){flush();const heading=node('h4');inline(heading,line.replace(/^#+\s*/,''));body.append(heading);}
      else paragraph.push(line);
    }
    if(codeLines!==null)finishCode();flush();details.append(body);
    const controls=node('div','cp-detail-controls');controls.append(node('small','','语音讲解要点，完整内容见上方。'),button('展开阅读','cp-expand-reading',event=>{
      const expanded=root.classList.toggle('cp-reading-expanded');event.currentTarget.textContent=expanded?'收起阅读':'展开阅读';
    }));details.append(controls);item.append(details);
    const math=window.MathJax;if(math?.typesetPromise)Promise.resolve(math.startup?.promise).then(()=>math.typesetPromise([body])).catch(()=>{});
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
  function offerVoiceRetry(view) {
    if (!view.message.id || view.item.querySelector('.cp-retry-voice')) return;
    const actions = node('div', 'cp-message-actions');
    const retry = button('重试语音', 'cp-retry-voice', async () => {
      if (busy) return;
      busy = true; updateSend(); retry.disabled = true; stopAudio(); primeAudio();
      const ticket = playbackTicket; state('正在重新准备这段声音…'); report('');
      try {
        const spoken = await request('/speech', 'POST', {messageId:view.message.id}); updateLimits(spoken.limits);
        if (ticket !== playbackTicket || !opened || document.hidden) return;
        const audioBlob = await request('/audio/' + encodeURIComponent(spoken.audioId), 'GET', null, true, true);
        await playSpeech({...view.message, audioBlob}, view, ticket);
        if (ticket === playbackTicket) actions.remove();
      } catch (error) { report(error.message); state('文字已保留，声音暂时没连上。'); }
      finally { busy = false; retry.disabled = false; updateSend(); }
    });
    actions.append(retry); view.item.append(actions);
  }
  async function submit(event) {
    event.preventDefault(); const text = textarea.value.trim(); if (!text || busy) return;
    if (send.disabled) return;
    captureSelection(); const reading = readingContext();report('');
    cancelWelcome(); busy = true; send.disabled = true; textarea.disabled = true; stopAudio(); const ticket = playbackTicket; state('唔，让可莉想想…');
    clearTimeout(reactionTimer); setPresence('thinking'); setExpression('thinking');
    primeAudio();
    let view = null;
    try {
      await ensureSession(); addMessage({role: 'user', text}); textarea.value = '';
      view = addMessage({role: 'assistant', text: ''}, true);
      view.mood = expressionFor(text, 'happy');
      const result = await request('/respond-stream', 'POST', {text, requestId: crypto.randomUUID(), autoSpeak: true, voiceProtocol:2,readingProtocol:2, ...(reading ? {reading} : {})}, true, data => receiveStream(data, view, ticket));
      view.message = result; view.characters = [...result.text]; updateLimits(result.limits);
      readingSelection = ''; updateSelection();
      if (result.demo) report('本地演示：没有调用真实聊天模型。');
      if (!pcmPlayback || ticket !== playbackTicket) {
        finishReply(view); state('嘟嘟可也在听。');
        if (ticket === playbackTicket && opened) { setPresence('idle'); setExpression(expressionFor(result.text, view.mood)); settleCharacter(); }
      }
    } catch (error) {
      let deferred=false;
      if (view?.characters.length) {
        view.canAct = false;
        // A broken transport must not discard audio already buffered for this
        // reply. Explicit Stop / close / a new turn still cancel immediately.
        if (pcmPlayback?.view === view) {
          flushPCM(pcmPlayback);pcmPlayback.finished=true;
          if(pcmPlayback.sources.size){pcmPlayback.failure=error.message;deferred=true;state('正在播放已收到的声音…');}
        }
        finishReply(view);
      }
      else { view?.item.remove(); textarea.value = text; }
      if(!deferred){report(error.message);state('再说一次好不好？');setPresence('idle');setExpression('care');settleCharacter();}
    }
    finally { busy = false; updateSend(); textarea.disabled = false; textarea.focus(); }
  }
  function stopAudio() {
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
    } else if (narration?.article && Number.isFinite(audio.duration) && audio.duration > 0) {
      const characters = [...narration.article.text];
      articleBubble.querySelector('p').textContent = characters.slice(0, Math.max(1, Math.ceil(characters.length * audio.currentTime / audio.duration))).join('');
    }
    if (reducedMotion()) { mouth = 0; smoothedEnergy = 0; setFrame(); return; }
    let rms = 0;
    if (analyser && samples && audioContext?.state === 'running') {
      analyser.getFloatTimeDomainData(samples);
      let energy = 0; for (const value of samples) energy += value * value;
      rms = Math.sqrt(energy / samples.length);
    } else {
      const cached = narration?.welcome ? config.welcome : narration?.article;
      if (cached) rms = cached.envelope?.[Math.floor(audio.currentTime / (cached.step || .05))] || 0;
    }
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
      if (pcmPlayback) return;
      if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; mouth = 0; smoothedEnergy = 0; lastTick = 0; lastMouthChange = 0; setFrame();
    });
    audio.addEventListener('playing', () => {
      if (narration && (opened || narration.welcome || narration.article) && !document.hidden) {
        if (animationFrame) cancelAnimationFrame(animationFrame); animationFrame = null; lastTick = 0; animatePlayback();
      }
    });
    audio.addEventListener('ended', () => { if (!pcmPlayback && root.classList.contains('cp-playing')) completePlayback(); });
    audio.addEventListener('error', () => { if (!pcmPlayback && root.classList.contains('cp-playing')) { const ambient = narration?.welcome || narration?.article; stopAudio(); if (!ambient) report('咦，声音没出来，旅行者先看看这句话吧。'); } });
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
    if(data.type==='reading-status'){state(data.status==='summarizing'?'正在读全文，第 '+data.current+' / '+data.total+' 组…':'正在读'+(data.label||'相关原文')+'…');return;}
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
    if (data.type === 'voice-status' && !root.classList.contains('cp-playing')) {
      view.voiceStatus = data.status;
      state(data.status === 'resuming' ? '声音正在从上一句接着准备…' : data.status === 'reconnecting' ? '声音连接有点慢，正在重连…' : '可莉正在准备声音…');
    }
    if (data.type === 'text-end' && !root.classList.contains('cp-playing')) state(view.voiceStatus === 'reconnecting' ? '声音连接有点慢，正在重连…' : '文字好了，声音正在准备…');
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
    if(data.type === 'audio-trim' && playing) trimPCM(playing,data.offsetMs);
    if (data.type === 'done' || data.type === 'error') {
      view.canAct = data.type === 'done' && !data.replayed && !data.textOnly;
      if (playing) { flushPCM(playing); playing.finished = true; }
      if (data.textOnly || !playing?.spans.length) { stopAudio(); finishReply(view); }
      if (data.type === 'error') {
        if(playing && pcmPlayback===playing && playing.sources.size){
          // The provider can fail long before the queued audio reaches the
          // speaker. Let it drain before showing the final failure/retry UI.
          playing.failure=data.error;state('正在播放已收到的声音…');
        }else{report(data.error);offerVoiceRetry(view);}
      }
      else { report(''); if (data.textOnly) offerVoiceRetry(view); }
    }
  }
  function trimPCM(playing,offsetMs) {
    if(!Number.isFinite(offsetMs) || offsetMs<0 || offsetMs/1000>playing.offset+playing.pendingSamples/24000+.001)throw new Error('语音续读位置无效。');
    const cutoff=offsetMs/1000,clock=audioContext.currentTime;
    playing.pending=[];playing.pendingSamples=0;
    let nextTime=clock+.06;
    for(const span of playing.spans){
      if(span.offset>=cutoff){try{span.source.stop();}catch{}playing.sources.delete(span.source);}
      else if(span.offset+span.duration>cutoff){
        span.duration=cutoff-span.offset;nextTime=Math.max(nextTime,span.time+span.duration);
        try{span.source.stop(Math.max(clock,span.time+span.duration));}catch{}
      }else nextTime=Math.max(nextTime,span.time+span.duration);
    }
    playing.spans=playing.spans.filter(span=>span.offset<cutoff);playing.offset=cutoff;playing.nextTime=nextTime;
    for(const [index,sentence] of playing.sentences)if(sentence.endTime===null || sentence.endTime>offsetMs)playing.sentences.delete(index);
    playing.activeSentence=null;
  }
  function flushPCM(playing) {
    if (!playing.pendingSamples) return;
    const buffer = audioContext.createBuffer(1, playing.pendingSamples, 24000), target = buffer.getChannelData(0); let offset = 0;
    for (const part of playing.pending) { target.set(part, offset); offset += part.length; }
    playing.pending = []; playing.pendingSamples = 0;
    const source = audioContext.createBufferSource(); source.buffer = buffer; source.connect(analyser);
    const start = Math.max(playing.nextTime, audioContext.currentTime + (playing.nextTime ? .015 : .06));
    playing.spans.push({time: start, offset: playing.offset, duration: buffer.duration,source});
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
    if (config.reading?.enabled) {
      const start = button('一起学这篇', '', () => {
        if (!readingContext()) { report('先打开想学的文章，再一起读吧！'); return; }
        studyPrompt('带我用十五分钟一步步学懂这篇文章');
      });
      start.dataset.studyPrompt = 'start';
      const resume = button('接着上次学', '', () => studyPrompt('继续上次学习')); resume.dataset.studyPrompt = 'resume';resume.hidden=true;
      const pause = button('先休息一下', '', () => studyPrompt('暂停学习')); pause.dataset.studyPrompt = 'pause';pause.hidden=true;
      dataButtons.append(start, resume, pause);
    }
    if(config.reading?.enabled)dataButtons.append(button('概括本节','',()=>studyPrompt('概括当前这一节')),button('概括全文','',()=>studyPrompt('概括整篇文章的主要内容')));
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
    selectionBox.append(node('span'),button('解释','',()=>studyPrompt('解释选中这段内容')),button('概括','',()=>studyPrompt('概括选中这段内容')), clearSelection);
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
    panel.append(header, intro, studyBox, messageList, readingList, selectionBox, notice, form); root.append(welcomeBubble, articleBubble, launcher, panel); document.body.append(root);
    document.addEventListener('selectionchange', captureSelection);
    welcome(); updateLimits(); setExpression('neutral'); scheduleBlink();
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { if (opened) setOpen(false); else cancelArticle(); } });
    const pauseCharacter = () => {
      clearTimeout(reactionTimer); clearTimeout(gestureTimer); clearTimeout(blinkTimer);
      root.dataset.gesture = ''; setPresence(document.hidden ? 'hidden' : 'idle'); setExpression('neutral'); blinkStep = 0; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
    };
    document.addEventListener('visibilitychange', () => { if (document.hidden) { cancelArticle(); stopAudio(); pauseCharacter(); } else { setPresence('idle'); scheduleBlink(); tryWelcome(); } });
    document.addEventListener('pjax:send', () => { cancelArticle(); stopAudio(); pauseCharacter(); readingSelection = ''; updateSelection(); });
    document.addEventListener('pjax:complete', () => { if (!root.isConnected) document.body.append(root); welcomedThisPage = false; scheduleBlink(); startArticle(); });
    window.addEventListener('pagehide', () => { cancelArticle(); stopAudio(); pauseCharacter(); audioCache.forEach(url => URL.revokeObjectURL(url)); audioCache.clear(); });
    window.addEventListener('pageshow', event => { setPresence(root.classList.contains('cp-playing') ? 'speaking' : busy ? 'thinking' : 'idle'); scheduleBlink(); if (event.persisted) startArticle(); });
    document.addEventListener('play', event => { if (event.target instanceof HTMLMediaElement && !event.target.muted && event.target.volume > 0) { cancelArticle(); } }, true);
    window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
      clearTimeout(blinkTimer); blinkStep = 0; clearTimeout(gestureTimer); mouth = 0; lastMouthChange = 0; root.dataset.gesture = ''; setFrame();
      root.querySelectorAll('.cp-expression-layer').forEach(layer => layer.getAnimations().forEach(animation => animation.cancel()));
      root.querySelectorAll('.cp-face-back').forEach(layer => { layer.style.opacity = '0'; });
      if (!reducedMotion()) scheduleBlink();
    });
    const connect = node('link'); connect.rel = 'preconnect'; connect.href = apiBase; document.head.append(connect);
    ensureHealth().catch(() => {}); startWelcome(); startArticle();
  }
  async function boot() {
    try {
      const response = await fetch('/companion-config.json', {cache: 'no-cache'}); if (!response.ok) { markReady(false); return; }
      config = await response.json(); if (!config.enabled) { markReady(false); return; }
      apiBase = String(config.apiBase || '').replace(/\/$/, '');
      if (['localhost','127.0.0.1'].includes(location.hostname)) apiBase = 'http://127.0.0.1:8787';
      if (apiBase && !/^https?:\/\//.test(apiBase)) apiBase = '';
      build(); markReady(Boolean(apiBase));
    } catch (_) { markReady(false); /* An unavailable assistant cannot break article navigation. */ }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
})();

;
/* js/article-quiz.js */
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

;
/* js/klee-wish.js */
/* 可莉祈愿: the wish hall. Primogems come from the quizzes at the end of articles;
   wishes run on the companion server with the official rates and pity. This page
   draws the night sky, the banner fireworks, the meteor and reveals, and the
   wardrobe where Klee's cosmetics are equipped. */
(function () {
  'use strict';
  const RARITY = {3: '#7fb2ff', 4: '#c48bff', 5: '#ffcf5a'};
  const rate5 = n => n >= 90 ? 1 : Math.min(1, 0.006 + Math.max(0, n - 73) * 0.06);
  const percent = value => `${(value * 100).toFixed(1)}%`;
  const fmt = value => Number(value).toLocaleString('en-US');
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  // A canvas that keeps its backing store matched to its CSS size.
  function fit(canvas) {
    const ratio = Math.min(2, window.devicePixelRatio || 1), {width, height} = canvas.getBoundingClientRect();
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) { canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); }
    const context = canvas.getContext('2d'); context.setTransform(ratio, 0, 0, ratio, 0, 0); return {context, width, height};
  }
  // Twinkling stars and the occasional shooting star behind the hall.
  function starfield(canvas, reduced) {
    let stars = [], frame = 0, shooting = null, running = true;
    const seedStars = (w, h) => { stars = Array.from({length: Math.round(w * h / 2600)}, () => ({x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.3 + .3, p: Math.random() * 6.28, s: .5 + Math.random() * 1.5})); };
    const draw = time => {
      if (!running || !canvas.isConnected) return;
      const {context, width, height} = fit(canvas);
      if (!stars.length || stars.w !== width) { seedStars(width, height); stars.w = width; }
      context.clearRect(0, 0, width, height);
      for (const star of stars) {
        const a = reduced ? .7 : .45 + .45 * Math.sin(time / 1000 * star.s + star.p);
        context.globalAlpha = a; context.fillStyle = '#fff'; context.beginPath(); context.arc(star.x, star.y, star.r, 0, 6.283); context.fill();
      }
      if (!reduced) {
        if (!shooting && Math.random() < .004) shooting = {x: width * (.4 + Math.random() * .6), y: Math.random() * height * .3, t: 0};
        if (shooting) {
          shooting.t += 1; const x = shooting.x - shooting.t * 9, y = shooting.y + shooting.t * 4.5, g = context.createLinearGradient(x, y, x + 90, y - 45);
          g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
          context.globalAlpha = Math.max(0, 1 - shooting.t / 50); context.strokeStyle = g; context.lineWidth = 1.6; context.beginPath(); context.moveTo(x, y); context.lineTo(x + 90, y - 45); context.stroke();
          if (shooting.t > 50) shooting = null;
        }
      }
      context.globalAlpha = 1;
      frame = reduced ? 0 : requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return {stop() { running = false; cancelAnimationFrame(frame); }, start() { if (!running) { running = true; frame = requestAnimationFrame(draw); } }};
  }
  // Little fireworks over the banner art.
  function fireworks(canvas, reduced) {
    let sparks = [], frame = 0, running = true, last = 0;
    const colors = ['#ffd36b', '#ff8a3c', '#ff5e7a', '#fff1b8', '#ffb347'];
    const draw = time => {
      if (!running || !canvas.isConnected) return;
      const {context, width, height} = fit(canvas);
      if (time - last > 900 && sparks.length < 400) {
        last = time; const cx = width * (.2 + Math.random() * .6), cy = height * (.15 + Math.random() * .35), color = colors[Math.floor(Math.random() * colors.length)];
        for (let i = 0; i < 46; i++) { const a = i / 46 * 6.283, v = 1.4 + Math.random() * 1.6; sparks.push({x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color}); }
      }
      context.clearRect(0, 0, width, height); context.globalCompositeOperation = 'lighter';
      sparks = sparks.filter(s => s.life > 0);
      for (const s of sparks) {
        s.x += s.vx; s.y += s.vy; s.vy += .03; s.vx *= .985; s.vy *= .985; s.life -= .012;
        context.globalAlpha = Math.max(0, s.life); context.fillStyle = s.color; context.beginPath(); context.arc(s.x, s.y, 1.6, 0, 6.283); context.fill();
      }
      context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
      frame = requestAnimationFrame(draw);
    };
    if (!reduced) frame = requestAnimationFrame(draw);
    return {stop() { running = false; cancelAnimationFrame(frame); }};
  }
  // The meteor: a tapered streak with a glowing head and sparks, coloured by the best item.
  function meteor(canvas, color, reduced) {
    return new Promise(resolve => {
      if (reduced) { resolve(); return; }
      const start = performance.now(), duration = 1500, trail = [], path = [];
      const step = time => {
        const {context, width, height} = fit(canvas), t = Math.min(1, (time - start) / duration), ease = 1 - Math.pow(1 - t, 2.2);
        const x = width * (1.08 - ease * .62), y = height * (-.08 + ease * .62);
        path.push({x, y}); if (path.length > 28) path.shift();
        for (let i = 0; i < 14; i++) trail.push({x: x + (Math.random() - .5) * 10, y: y + (Math.random() - .5) * 10, vx: (Math.random() - .2) * 1.2, vy: (Math.random() - .7) * 1.1, life: 1, r: .6 + Math.random() * 2});
        context.clearRect(0, 0, width, height); context.globalCompositeOperation = 'lighter';
        // The streak: wide and faint at the back, narrow and bright at the head.
        for (let i = 1; i < path.length; i++) {
          const k = i / path.length; context.globalAlpha = k * .55; context.strokeStyle = color; context.lineCap = 'round';
          context.lineWidth = 2 + k * 16; context.beginPath(); context.moveTo(path[i - 1].x, path[i - 1].y); context.lineTo(path[i].x, path[i].y); context.stroke();
          context.globalAlpha = k * .9; context.strokeStyle = '#fff'; context.lineWidth = 1 + k * 4; context.stroke();
        }
        for (const p of trail) { p.x += p.vx; p.y += p.vy; p.life -= .022; if (p.life <= 0) continue; context.globalAlpha = p.life; context.fillStyle = p.life > .6 ? '#fff' : color; context.beginPath(); context.arc(p.x, p.y, p.r * p.life + .3, 0, 6.283); context.fill(); }
        if (trail.length > 900) trail.splice(0, trail.length - 900);
        const glow = context.createRadialGradient(x, y, 0, x, y, 70); glow.addColorStop(0, '#fff'); glow.addColorStop(.18, color); glow.addColorStop(1, 'rgba(0,0,0,0)');
        context.globalAlpha = 1; context.fillStyle = glow; context.beginPath(); context.arc(x, y, 70, 0, 6.283); context.fill();
        context.globalCompositeOperation = 'source-over';
        if (t < 1) requestAnimationFrame(step); else { context.clearRect(0, 0, width, height); resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  function init(root) {
    if (root.dataset.kwpReady) return; root.dataset.kwpReady = '1';
    // The full-screen wish layer lives under <body> so the site header cannot cover it.
    const overlay = root.querySelector('[data-kwp-overlay]'); document.querySelectorAll('body > .kwp-overlay').forEach(old => old.remove()); document.body.append(overlay);
    const $ = selector => root.querySelector(selector) || overlay.querySelector(selector), $$ = selector => [...root.querySelectorAll(selector)];
    const kit = window.LabGameKit, reduced = () => kit.reduced();
    const call = (path, method, data) => window.LsCompanion ? window.LsCompanion.call(path, method, data) : Promise.reject(new Error('可莉暂时不在线。'));
    const wardrobe = () => window.KleeWardrobe;
    const item = id => wardrobe()?.item(id);
    const {say, announce, voice, stopVoice} = kit.host(root, {face: $('[data-kwp-face]'), bubble: $('.kwp-klee-line'), line: $('[data-kwp-line]'), banner: $('[data-kwp-announce]'),
      voiceAttr: 'kwpVoice', manifest: root.dataset.voiceManifest});
    const sky = starfield($('[data-kwp-sky]'), reduced()), works = fireworks($('[data-kwp-fireworks]'), reduced());
    let state = null, busy = true, slot = 'frame', quizzes = [], run = null;
    const reveal = $('[data-kwp-reveal]'), summary = $('[data-kwp-summary]');

    // ----- Wallet, banner and buttons -----
    function show(next) {
      state = next; wardrobe()?.remember(next);
      $('[data-kwp-primo]').textContent = fmt(next.primogems); $('[data-kwp-glitter]').textContent = fmt(next.starglitter); $('[data-kwp-dust]').textContent = fmt(next.stardust);
      $('[data-kwp-pity]').textContent = `距保底 ${90 - next.pity.since5} 抽 · ${next.pity.g5 ? '大保底：下个五星必是「烟花大会」' : '小保底'} · 已祈愿 ${fmt(next.wishes)} 次`;
      $('[data-kwp-rules-state]').textContent = `你的进度：距上次五星 ${next.pity.since5} 抽（下一抽五星概率 ${percent(rate5(next.pity.since5 + 1))}），${next.pity.g5 ? '五星大保底' : '五星小保底'}；距上次四星 ${next.pity.since4} 抽，${next.pity.g4 ? '四星大保底' : '四星小保底'}。`;
      $('[data-kwp-trade]').textContent = `星辉兑换 · ${next.starglitterPerWish} → 1 次`;
      buttons(); renderCloset(); renderHistory(); renderEarn();
    }
    function buttons() {
      const ready = state && !busy;
      $('[data-kwp-one]').disabled = !ready || state.primogems < state.cost;
      $('[data-kwp-ten]').disabled = !ready || state.primogems < state.cost * 10;
      $('[data-kwp-trade]').disabled = !ready || state.starglitter < state.starglitterPerWish;
      root.dataset.kwpBusy = busy ? '1' : '';
    }
    function drawBanner() {
      const catalog = wardrobe().catalog, five = item(catalog.banner.featured5);
      $('[data-kwp-ring]').replaceChildren(wardrobe().draw(five, {size: 100}));
      const card = (thing, big) => {
        const node = document.createElement('div'); node.className = `kwp-card is-${thing.rarity}` + (big ? ' is-big' : '');
        node.append(wardrobe().draw(thing, {size: big ? 72 : 52, klee: true}));
        const text = document.createElement('div'); text.className = 'kwp-card-text';
        text.append(Object.assign(document.createElement('strong'), {textContent: thing.name}), Object.assign(document.createElement('small'), {textContent: `${'★'.repeat(thing.rarity)} · ${catalog.slots[thing.slot]}`}));
        if (big) text.append(Object.assign(document.createElement('span'), {textContent: thing.desc}));
        node.append(text); node.title = thing.desc; return node;
      };
      $('[data-kwp-up5]').replaceChildren(card(five, true));
      $('[data-kwp-up4]').replaceChildren(...catalog.banner.featured4.map(id => card(item(id), false)));
    }

    // ----- Wishing -----
    const pause = ms => new Promise(resolve => { if (!run) { resolve(); return; } run.wake = resolve; run.timer = setTimeout(resolve, ms); });
    async function wish(count) {
      if (busy || !state) return;
      if (state.primogems < state.cost * count) { say('原石不够啦！去文章末尾答可莉小测验，每答对一题有 160 原石哦！', 'care'); voice('klee-wish-poor'); return; }
      busy = true; buttons();
      let data;
      try { data = await call('/wardrobe/wish', 'POST', {count}); }
      catch (error) { busy = false; buttons(); say(error.message, 'care'); return; }
      const current = run = {results: data.results, next: data.wardrobe, skipped: false, count};
      const best = Math.max(...data.results.map(r => r.rarity));
      overlay.hidden = false; overlay.dataset.best = best; root.dataset.kwpOverlay = 'meteor';
      reveal.hidden = true; summary.hidden = true; $('[data-kwp-skip]').hidden = false; $('[data-kwp-again]').hidden = true; $('[data-kwp-close]').hidden = true;
      document.documentElement.classList.add('kwp-lock');
      voice(best === 5 ? 'klee-wish-gold' : best === 4 ? 'klee-wish-purple' : 'klee-wish-blue', {minor: true});
      await meteor($('[data-kwp-overlay-sky]'), RARITY[best], reduced());
      if (run !== current) return;
      if (!current.skipped) {
        const flash = $('[data-kwp-flash]'); flash.className = `kwp-flash is-${best}`; void flash.offsetWidth; flash.classList.add('is-on');
        await pause(best === 5 ? 700 : 350);
      }
      for (let i = 0; i < current.results.length && !current.skipped && run === current; i++) { showOne(current.results[i], i); await pause(current.results[i].rarity === 3 ? 900 : 1800); }
      if (run === current) finish();
    }
    function showOne(result, index) {
      const thing = item(result.id), catalog = wardrobe().catalog;
      root.dataset.kwpOverlay = 'reveal'; reveal.hidden = false; reveal.className = `kwp-reveal is-${result.rarity}`;
      reveal.replaceChildren();
      const rays = document.createElement('div'); rays.className = 'kwp-rays';
      const art = document.createElement('div'); art.className = 'kwp-reveal-art'; art.append(wardrobe().draw(thing, {size: 220, klee: true}));
      const name = document.createElement('h3'); name.className = 'kwp-reveal-name'; name.textContent = thing.name;
      const meta = document.createElement('p'); meta.className = 'kwp-reveal-meta'; meta.textContent = catalog.slots[thing.slot] + (thing.owner === 'jean' ? ' · 琴团长' : ' · 可莉');
      const stars = document.createElement('div'); stars.className = 'kwp-reveal-stars';
      for (let i = 0; i < result.rarity; i++) { const star = document.createElement('i'); star.textContent = '★'; star.style.animationDelay = `${350 + i * 120}ms`; stars.append(star); }
      const desc = document.createElement('p'); desc.className = 'kwp-reveal-desc'; desc.textContent = thing.desc;
      reveal.append(rays, art, name, meta, stars, desc);
      if (result.isNew) reveal.append(Object.assign(document.createElement('span'), {className: 'kwp-new', textContent: 'NEW'}));
      if (result.starglitter || result.stardust) reveal.append(Object.assign(document.createElement('p'), {className: 'kwp-reveal-extra', textContent: result.starglitter ? `已拥有 · 转化为无主的星辉 ×${result.starglitter}` : `转化为无主的星尘 ×${result.stardust}`}));
      reveal.append(Object.assign(document.createElement('span'), {className: 'kwp-reveal-count', textContent: `${index + 1} / ${run.results.length}`}));
    }
    function finish() {
      if (!run || run.done) return; run.done = true; clearTimeout(run.timer);
      reveal.hidden = true; root.dataset.kwpOverlay = 'summary'; summary.hidden = false; summary.replaceChildren();
      const order = [...run.results].sort((a, b) => b.rarity - a.rarity);
      order.forEach((result, i) => {
        const thing = item(result.id), card = document.createElement('div');
        card.className = `kwp-tall is-${result.rarity}`; card.style.animationDelay = `${i * 70}ms`;
        card.append(wardrobe().draw(thing, {size: 76, klee: true}));
        card.append(Object.assign(document.createElement('strong'), {textContent: thing.name}), Object.assign(document.createElement('small'), {textContent: '★'.repeat(result.rarity)}));
        if (result.isNew) card.append(Object.assign(document.createElement('span'), {className: 'kwp-new', textContent: 'NEW'}));
        summary.append(card);
      });
      $('[data-kwp-skip]').hidden = true; $('[data-kwp-close]').hidden = false;
      show(run.next); busy = false; buttons();
      $('[data-kwp-again]').hidden = state.primogems < state.cost * run.count; $('[data-kwp-again]').textContent = run.count === 10 ? '再来十次' : '再来一次';
      const got = run.results.find(r => r.rarity === 5), fresh = run.results.filter(r => r.isNew && r.rarity >= 4).length;
      if (got?.featured) { announce('烟花大会！'); say(`抽到限定头像框「烟花大会」啦！第 ${got.pity} 抽出的金！快去衣橱给可莉戴上！`, 'laugh'); voice('klee-wish-got', {queue: true}); }
      else if (got) { announce('歪了……'); say(`第 ${got.pity} 抽出金了，是「${item(got.id).name}」……下一个五星一定是烟花大会！`, 'care'); voice('klee-wish-lost', {queue: true}); }
      else say(fresh ? `有 ${fresh} 件新装扮！去衣橱给可莉试试吧～` : `都是见过的……重复的会变成星辉，攒 ${state.starglitterPerWish} 个能换一次祈愿！`, fresh ? 'happy' : 'wink');
    }
    function closeOverlay() {
      overlay.hidden = true; root.dataset.kwpOverlay = ''; document.documentElement.classList.remove('kwp-lock'); run = null;
    }
    overlay.addEventListener('click', event => {
      if (event.target.closest('button') || !run || run.done) return;
      // Tap to move on to the next item without waiting.
      clearTimeout(run.timer); run.wake?.();
    });
    $('[data-kwp-skip]').addEventListener('click', () => { if (!run) return; run.skipped = true; clearTimeout(run.timer); run.wake?.(); finish(); });
    $('[data-kwp-close]').addEventListener('click', closeOverlay);
    $('[data-kwp-again]').addEventListener('click', () => { const count = run?.count || 10; closeOverlay(); wish(count); });
    document.addEventListener('keydown', event => { if (event.key === 'Escape' && !overlay.hidden && run?.done) closeOverlay(); });
    $('[data-kwp-one]').addEventListener('click', () => wish(1));
    $('[data-kwp-ten]').addEventListener('click', () => wish(10));
    $('[data-kwp-trade]').addEventListener('click', async () => {
      busy = true; buttons();
      try { show((await call('/wardrobe/exchange', 'POST', {})).wardrobe); say('星辉换成原石啦！', 'happy'); }
      catch (error) { say(error.message, 'care'); }
      busy = false; buttons();
    });

    // ----- Tabs and sections -----
    $$('[data-kwp-tab]').forEach(tab => tab.addEventListener('click', () => {
      $$('[data-kwp-tab]').forEach(other => other.setAttribute('aria-selected', String(other === tab)));
      $$('[data-kwp-section]').forEach(section => { section.hidden = section.dataset.kwpSection !== tab.dataset.kwpTab; });
    }));
    function renderCloset() {
      const catalog = wardrobe().catalog, slots = $('[data-kwp-slots]');
      slots.replaceChildren();
      for (const [key, name] of Object.entries(catalog.slots)) {
        const all = catalog.items.filter(i => i.slot === key); if (!all.length) continue;
        const have = all.filter(i => state.owned[i.id]).length, chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'kwp-slot' + (key === slot ? ' is-active' : ''); chip.dataset.slot = key;
        chip.innerHTML = `<span></span><small>${have}/${all.length}</small>`; chip.firstChild.textContent = name;
        chip.setAttribute('aria-pressed', String(key === slot)); chip.addEventListener('click', () => { slot = key; renderCloset(); });
        slots.append(chip);
      }
      const grid = $('[data-kwp-grid]'); grid.replaceChildren();
      for (const thing of catalog.items.filter(i => i.slot === slot).sort((a, b) => b.rarity - a.rarity)) {
        const copies = state.owned[thing.id] || 0, on = state.equipped[thing.slot] === thing.id, cell = document.createElement('button');
        cell.type = 'button'; cell.dataset.item = thing.id; cell.title = thing.desc;
        cell.className = `kwp-item is-${thing.rarity}` + (copies ? '' : ' is-locked') + (on ? ' is-on' : '');
        cell.disabled = !copies || thing.slot === 'sticker';
        cell.append(wardrobe().draw(thing, {size: 76, klee: true}));
        cell.append(Object.assign(document.createElement('strong'), {textContent: thing.name}),
          Object.assign(document.createElement('small'), {textContent: copies ? `${'★'.repeat(thing.rarity)}${copies > 1 ? ' ×' + copies : ''}` : '未获得'}));
        if (on) cell.append(Object.assign(document.createElement('span'), {className: 'kwp-on', textContent: '穿戴中'}));
        cell.addEventListener('click', async () => {
          try {
            show((await call('/wardrobe/equip', 'POST', {slot: thing.slot, item: on ? null : thing.id})).wardrobe);
            if (on) say(`先把「${thing.name}」收起来～`, 'neutral'); else { say(`戴上「${thing.name}」啦！${thing.desc}`, 'proud'); voice('klee-wish-equip', {minor: true}); }
          } catch (error) { say(error.message, 'care'); }
        });
        grid.append(cell);
      }
      const title = item(state.equipped.title), bomb = item(state.equipped.bomb);
      $('[data-kwp-stage-title]').replaceChildren(wardrobe().draw(title || {slot: 'title', look: {text: '火花骑士', color: '#b3461e', bg: '#fff3e0'}}, {size: 150}));
      $('[data-kwp-stage-bomb]').replaceChildren(wardrobe().draw(bomb || {slot: 'bomb', look: {stops: ['#ff9a83', '#e2463b', '#8f1f1c'], outline: '#6e1715'}}, {size: 64}));
    }
    function renderHistory() {
      const body = $('[data-kwp-history]'), catalog = wardrobe().catalog; body.replaceChildren();
      for (const entry of state.history) {
        const thing = item(entry.id); if (!thing) continue;
        const row = document.createElement('tr'); row.className = `is-${thing.rarity}`;
        for (const text of [new Date(entry.at).toLocaleString('zh-CN', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'}), thing.name, catalog.slots[thing.slot], '★'.repeat(thing.rarity)])
          row.append(Object.assign(document.createElement('td'), {textContent: text}));
        body.append(row);
      }
      if (!body.children.length) { const row = document.createElement('tr'); row.append(Object.assign(document.createElement('td'), {colSpan: 4, textContent: '还没有祈愿记录'})); body.append(row); }
    }
    function renderEarn() {
      const total = quizzes.reduce((sum, q) => sum + q.earned, 0), perfect = quizzes.filter(q => q.best === 3).length;
      $('[data-kwp-earn-stats]').innerHTML = '';
      for (const [label, value] of [['答过的文章', quizzes.length], ['满分', perfect], ['累计获得原石', total]]) {
        const box = document.createElement('div'); box.append(Object.assign(document.createElement('strong'), {textContent: fmt(value)}), Object.assign(document.createElement('span'), {textContent: label}));
        $('[data-kwp-earn-stats]').append(box);
      }
      const list = $('[data-kwp-earn-list]'); list.replaceChildren();
      for (const q of quizzes.filter(q => q.url).sort((a, b) => a.best - b.best).slice(0, 8)) {
        const li = document.createElement('li'), a = document.createElement('a'); a.href = new URL(q.url).pathname + '#article-container'; a.textContent = q.title;
        li.append(a, Object.assign(document.createElement('span'), {textContent: q.best === 3 ? '满分' : `最好 ${q.best}/3 · 还能得 ${fmt((3 - q.best) * state.perCorrect)}`}));
        list.append(li);
      }
    }
    fetch('/companion-articles.json', {cache: 'no-cache'}).then(r => r.ok ? r.json() : null).then(data => {
      const paths = Object.keys(data?.articles || {}), link = $('[data-kwp-random]'); if (!paths.length) return;
      const pick = () => paths[Math.floor(Math.random() * paths.length)];
      link.href = pick(); link.addEventListener('click', () => { link.href = pick(); });
    }).catch(() => {});

    async function load() {
      for (let tries = 0; !wardrobe() && tries < 50; tries++) await sleep(20);
      await wardrobe()?.ready;
      if (!wardrobe()?.catalog) { $('[data-kwp-offline]').hidden = false; $('[data-kwp-offline]').textContent = '装扮目录没有加载出来，刷新一下试试。'; return; }
      drawBanner();
      try {
        const data = await call('/wardrobe', 'GET'); quizzes = data.quizzes || [];
        busy = false; show(data.wardrobe); root.dataset.kwpReady = 'loaded';
        say(state.wishes ? `欢迎回来！现在有 ${fmt(state.primogems)} 原石，够祈愿 ${Math.floor(state.primogems / state.cost)} 次～` : '旅行者！这是可莉的装扮祈愿，新朋友送你 1,600 原石，先来个十连吧！在文章末尾答小测验还能赚原石哦～', 'happy');
        voice('klee-wish-intro');
      } catch (error) {
        $('[data-kwp-offline]').hidden = false; $('[data-kwp-offline]').textContent = `连不上可莉的祈愿服务：${error.message}`;
        say('可莉现在连不上祈愿台……稍后再来吧！', 'care');
      }
    }
    load();
    const away = () => { if (document.hidden) { sky.stop(); stopVoice(); } else sky.start(); };
    document.addEventListener('visibilitychange', away);
    document.addEventListener('pjax:send', () => { sky.stop(); works.stop(); stopVoice(); overlay.remove(); document.documentElement.classList.remove('kwp-lock'); }, {once: true});
  }
  const boot = () => { const root = document.querySelector('[data-kwp]'); if (root) init(root); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once: true}); else boot();
  document.addEventListener('pjax:complete', boot);
})();
