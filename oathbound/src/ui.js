// ---------- UI ----------
const $ = id => document.getElementById(id), SAVE = 'oathbound-slots', VER = 6;
const loadable = T => T && (T.v === 5 || T.v === 6);
function h(tag, attrs, ...kids) { const e = document.createElement(tag);
  for (const k in attrs || {}) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k.slice(0, 2) === 'on') e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat(3)) { if (c == null || c === false || c === '') continue; e.append(c.nodeType ? c : document.createTextNode(c)); } return e; }
let S = null, sel = null, bagOpen = false, timer = null, inspect = null, seats = null, diff = 0, mode = 0;
const NAMES = { warrior: 'Balian', rogue: 'Strider', mage: 'Mithrandir', priest: 'Earane' };
// three save slots in the browser, autosaved between stops; each can be exported to a file and imported again
const store = { all() { try { const a = JSON.parse(localStorage.getItem(SAVE)); return Array.isArray(a) ? a.concat([null, null, null]).slice(0, 3) : [null, null, null]; } catch (e) { return [null, null, null]; } },
  put(i, v) { const a = this.all(); a[i] = v ? { at: Date.now(), S: v } : null; try { localStorage.setItem(SAVE, JSON.stringify(a)); return true; } catch (e) { return false; } } };
let slot = 0, saveFail = false;
// events the player has already met, in any game in this browser; new ones are offered first
function seenEvents(add) { let a = []; try { a = JSON.parse(localStorage.getItem('oathbound-seen')) || []; } catch (e) {} if (add) { const n = a.length; for (const id of add) if (!a.includes(id)) a.push(id); if (a.length !== n) { if (a.length >= EVENTS.length - 8) a = a.slice(-Math.floor(EVENTS.length / 3)); try { localStorage.setItem('oathbound-seen', JSON.stringify(a)); } catch (e) {} } } return a; }
const slotLabel = x => { const T = x.S, p = T.party.map(h => h.name).join(', '); return `${T.camp ? (T.camp.saga ? `Renowned heroes, contract rank ${T.camp.rank}` : `Campaign, chapter ${T.camp.ch}`) : 'Single adventure'}${T.diff ? ' (Veteran)' : ''}: ${p}, level ${T.party[0].level}`; };
function exportSave(i) { const x = store.all()[i]; if (!x) return; const txt = JSON.stringify(x.S), name = `oathbound-${x.S.party.map(h => h.name).join('-').toLowerCase()}.json`;
  // inside Claude the page asks the viewer for permission to save; on a normal web page a plain download link works
  const plain = () => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; document.body.append(a); a.click(); a.remove(); } catch (e) {} };
  if (window.claude && window.claude.use) window.claude.use('downloads').then(d => d ? d.save({ filename: name, data: txt }).catch(() => {}) : plain()).catch(plain); else plain();
  const ta = h('textarea', { readonly: true, style: 'width:100%;height:120px;font:11px monospace;background:#111;color:#ccc' }); ta.value = txt;
  modal(h('h2', null, 'Export save'), h('p', null, `You should be offered a file called ${name} to save. If that does not appear, copy this text into a file instead; Import accepts either.`), ta, h('p', null, h('button', { class: 'primary', onclick: closeModal }, 'Close'))); }
function importSave(i) { const ta = h('textarea', { placeholder: 'Or paste save text here', style: 'width:100%;height:120px;font:11px monospace;background:#111;color:#ccc' }), msg = h('p', { class: 'dim' }),
    load = txt => { try { const T = JSON.parse(txt); if (!loadable(T) || !T.party || !T.q) throw 0; store.put(i, migrate(T)); closeModal(); render(); } catch (e) { msg.textContent = 'That is not a save from this version of the game.'; } },
    file = h('input', { type: 'file', accept: '.json,application/json,text/plain', onchange: e => { const f = e.target.files[0]; if (f) f.text().then(load); } });
  modal(h('h2', null, `Import into slot ${i + 1}`), h('p', null, 'Choose a save file, or paste its text. This replaces whatever is in the slot.'), file, ta, msg, h('p', { class: 'row' }, h('button', { class: 'primary', onclick: () => load(ta.value) }, 'Import pasted text'), h('button', { onclick: closeModal }, 'Cancel'))); }
const humansIdx = () => S.party.map((x, i) => x.ctrl === 'human' ? i : -1).filter(i => i >= 0);
const leader = () => { const hs = humansIdx(); return S.party[hs[S.leader % hs.length]]; };
const who = x => x.ctrl === 'human' ? x.player : 'AI';
const speed = () => $('fast').checked ? 120 : 650;
const subName = x => x.sub ? CLASSES[x.cls].subs[x.sub].n : CLASSES[x.cls].n;
function modal(...kids) { const m = $('mbody'); m.replaceChildren(...kids.flat(3).filter(k => k != null && k !== false)); $('modal').className = 'show'; }
function closeModal() { $('modal').className = ''; }
const hpBar = (hp, max) => h('div', { class: 'bar' + (hp / max < 0.35 ? ' low' : '') }, h('i', { style: `width:${Math.max(0, Math.min(100, 100 * hp / max))}%` }));

function render() {
  clearTimeout(timer); timer = null;
  const main = $('main'); main.replaceChildren();
  if (!S) { $('hud').replaceChildren(); $('party').replaceChildren(); return renderSetup(main); }
  const lv = S.party[0].level, where = S.screen === 'town' ? 'In town' : S.screen === 'chapter' ? '' : 'Act ' + (S.pos < 0 ? 1 : S.map[S.pos].act);
  $('hud').replaceChildren(h('span', { class: 'stat' }, S.q.title, S.diff ? h('b', { style: 'color:var(--red)' }, '  Veteran') : null), h('span', { class: 'stat' }, where), h('span', { class: 'stat' }, 'Level ', h('b', null, String(lv)), lv < maxLevel(S) ? ` (${S.xp}/${xpAt(S, lv)} xp)` : ''), h('span', { class: 'stat' }, 'Gold ', h('b', null, String(S.gold))), saveFail ? h('span', { class: 'stat', style: 'color:var(--red)' }, 'Saving failed: export your save') : '');
  renderParty();
  ({ map: renderMap, combat: renderCombat, event: renderEvent, loot: renderLoot, shop: renderShop, rest: renderRest, levelup: renderLevel, end: renderEnd, town: renderTown, chapter: renderChapter })[S.screen](main);
  if (S.q && S.q.used) seenEvents(S.q.used);
  if (S.screen === 'end') store.put(slot, null); else if (S.screen !== 'combat') saveFail = !store.put(slot, S);
}

// ---------- setup ----------
function renderSetup(main) {
  if (!seats) seats = ['warrior', 'rogue', 'mage', 'priest'].map((cls, i) => ({ ctrl: i ? 'ai' : 'human', cls, name: NAMES[cls] }));
  const saves = store.all(); if (saves[slot]) { const e = saves.findIndex(x => !x); if (e >= 0) slot = e; }
  const rows = seats.map((s, i) => h('div', { class: 'seat' },
    h('select', { onchange: e => { s.ctrl = e.target.value; render(); } }, ['human', 'ai', 'none'].map(v => h('option', { value: v, selected: s.ctrl === v }, { human: 'Human', ai: 'AI ally', none: 'Empty' }[v]))),
    h('input', { type: 'text', value: s.name, maxlength: 14, disabled: s.ctrl === 'none', oninput: e => { s.name = e.target.value; } }),
    h('select', { disabled: s.ctrl === 'none', onchange: e => { if (!s.name.trim() || Object.values(NAMES).includes(s.name.trim())) s.name = NAMES[e.target.value]; s.cls = e.target.value; render(); } }, Object.keys(CLASSES).map(c => h('option', { value: c, selected: s.cls === c }, CLASSES[c].n)))));
  const used = seats.filter(s => s.ctrl !== 'none'), ok = used.some(s => s.ctrl === 'human');
  main.append(h('div', { class: 'card' }, h('h2', null, 'Gather your party'),
    h('p', null, 'A co-op fantasy adventure for one to four heroes. Each run is a freshly generated three-act quest: a villain, a motive, a twist, and a branching road to the lair. Human players share this screen and take turns; AI allies fill the other seats.'),
    h('h3', null, 'Saved games'), saves.map((x, i) => h('div', { class: 'item', style: 'padding:6px 10px' }, h('div', { class: 'row' }, h('b', null, `Slot ${i + 1}`), x && loadable(x.S) ? h('span', null, slotLabel(x), h('span', { class: 'dim small' }, ` · ${x.S.q.title} · saved ${new Date(x.at).toLocaleString()}`)) : x ? h('span', { class: 'dim' }, 'A save from an older version, which cannot be loaded.') : h('span', { class: 'dim' }, 'Empty')),
      h('div', { class: 'row', style: 'margin-top:4px' }, x && loadable(x.S) ? h('button', { class: 'primary small', onclick: () => { slot = i; S = migrate(x.S); S.seen = seenEvents(); render(); } }, 'Continue') : null, x && loadable(x.S) ? h('button', { class: 'small', onclick: () => exportSave(i) }, 'Export') : null,
        h('button', { class: 'small', onclick: () => importSave(i) }, 'Import'), x ? h('button', { class: 'small', onclick: () => modal(h('h2', null, `Delete slot ${i + 1}?`), h('p', null, 'This cannot be undone. Export it first if you might want it back.'), h('p', { class: 'row' }, h('button', { class: 'primary', onclick: () => { store.put(i, null); closeModal(); render(); } }, 'Delete'), h('button', { onclick: closeModal }, 'Keep it'))) }, 'Delete') : null,
        h('label', { class: 'small' }, h('input', { type: 'radio', name: 'slot', checked: slot === i, onchange: () => { slot = i; render(); } }), ' start the new game here')))),
    h('h3', null, 'New game'),
    h('h3', null, 'Seats'), rows,
    h('p', null, 'Mode: ', h('select', { onchange: e => { mode = +e.target.value; } }, h('option', { value: 0, selected: !mode }, 'Single adventure: three acts, levels 1 to 5, about 40 minutes'), h('option', { value: 1, selected: !!mode }, 'Campaign: a five-chapter saga to level 10, then endless contracts'))),
    h('p', null, 'Difficulty: ', h('select', { onchange: e => { diff = +e.target.value; } }, h('option', { value: 0, selected: !diff }, 'Standard'), h('option', { value: 1, selected: !!diff }, 'Veteran: tougher enemies that focus their attacks, less healing between fights'))),
    h('div', { class: 'grid3' }, [...new Set(used.map(s => s.cls))].map(c => h('div', { class: 'item small' }, h('b', null, CLASSES[c].n), ' ', CLASSES[c].blurb, h('div', { class: 'dim' }, 'At level 3: ', Object.values(CLASSES[c].subs).map(x => x.n).join(' or '), '.')))),
    h('p', { class: 'dim small' }, 'A full party of four with a Priest is the gentlest start. Smaller parties face fewer and weaker enemies; a lone hero gets one second wind per fight.'),
    h('p', null, h('button', { class: 'primary', disabled: !ok, onclick: begin }, 'Begin the adventure'), ok ? '' : ' At least one seat must be human.')));
}
function begin() { const cur = store.all()[slot]; if (cur && !begin.ok) return modal(h('h2', null, `Overwrite slot ${slot + 1}?`), h('p', null, `It holds: ${slotLabel(cur)}.`), h('p', { class: 'row' }, h('button', { class: 'primary', onclick: () => { begin.ok = true; closeModal(); begin(); } }, 'Overwrite'), h('button', { onclick: closeModal }, 'Cancel'))); begin.ok = false; let p = 0; const list = seats.filter(s => s.ctrl !== 'none').map(s => ({ cls: s.cls, ctrl: s.ctrl, name: (s.name || '').trim() || NAMES[s.cls], player: s.ctrl === 'human' ? 'Player ' + (++p) : '' }));
  S = (mode ? newCampaign : newRun)((Date.now() ^ (Math.random() * 1e9)) | 0, list, diff); S.seen = seenEvents(); sel = null; render(); }

// ---------- party sidebar and hero sheet ----------
function renderParty() {
  const inFight = S.screen === 'combat' && S.C;
  $('party').replaceChildren(h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Party'),
    S.party.map((x, i) => { const u = inFight ? unit(S.C, 'h' + i) : null, hp = u ? u.hp : x.hp, max = u ? u.max : maxHp(x);
      return h('div', { class: 'hero', onclick: () => sheet(i) }, h('div', { class: 'nm' }, h('span', null, h('b', null, x.name), ' ', h('span', { class: 'dim small' }, subName(x))), h('span', { class: 'small dim' }, who(x))),
        hpBar(hp, max), h('div', { class: 'small dim' }, `${hp}/${max} hp · ${x.row === 'F' ? 'front' : 'back'} row`, x.wounds ? ` · ${x.wounds} wound${x.wounds > 1 ? 's' : ''}` : '')); }),
    S.comp ? (() => { const u = inFight ? S.C.units.find(v => v.comp) : null, hp = u ? u.hp : S.comp.hp; return h('div', { class: 'hero' }, h('div', { class: 'nm' }, h('span', null, h('b', null, S.comp.name), ' ', h('span', { class: 'dim small' }, 'companion')), h('span', { class: 'small dim' }, 'AI')), hpBar(hp, S.comp.max), h('div', { class: 'small dim' }, `${hp}/${S.comp.max} hp · ${COMPANIONS[S.comp.key].d}; ${S.camp ? 'stays for this chapter' : 'stays until the end of this act'}`)); })() : null,
    h('h3', null, 'Supplies'), S.bag.length ? S.bag.map(b => h('div', { class: 'small', title: CONS[b.id].d }, `${CONS[b.id].n} x${b.qty}`)) : h('div', { class: 'small dim' }, 'Nothing.'),
    h('p', null, h('button', { onclick: openPack }, `Gear and pack (${S.stash.length})`)),
    h('p', { class: 'small dim' }, 'Click a hero for stats, gear and skills.')));
}
function statText(x, u, st) { const c = CLASSES[x.cls], w = WT[x.gear.w.type];
  if (st === 'might') return `+${K.mightHp * u.st.might} health for everyone${c.grow[0] === 'might' || ['warrior', 'priest'].includes(x.cls) && x.sub === 'flamekeeper' ? '; melee attack and damage' : w.fin ? '' : '; melee attack and damage'}.`;
  if (st === 'agility') return `defence (enemies need 9 + this to hit you) and turn order${w.fin || w.ranged ? '; also your attack and damage with this weapon' : ''}.`;
  if (st === 'mind') return `crits on ${20 - Math.floor(u.st.mind / K.mindCrit) - (u.fx.crit || 0)}+ (one step per ${K.mindCrit} Mind)${x.cls === 'mage' ? '; spell attack and damage' : ''}.`;
  return `resists ${Math.round(u.st.spirit * K.spiritResist * 100)}% of harmful states from enemies, and healing received is +${Math.round(u.st.spirit * K.spiritHeal * 100)}%${x.cls === 'priest' ? '; holy attacks and heal strength' : ''}.`; }
function sheet(i) {
  const x = S.party[i], g = x.gear, free = S.screen !== 'combat', u = heroUnit(x, i);
  const toggle = id => { const eq = x.eq.includes(id) ? x.eq.filter(k => k !== id) : [...x.eq, id]; if (eq.length <= 4) { setEq(S, i, eq); sheet(i); render(); } };
  modal(h('h2', null, `${x.name}, level ${x.level} ${subName(x)}`),
    h('h3', null, 'Stats'), STATS.map(st => h('div', { class: 'small' }, h('b', null, `${STAT_NAME[st]} ${u.st[st]}`), CLASSES[x.cls].grow[0] === st ? h('span', { class: 'dim' }, ' (main stat)') : '', ': ', statText(x, u, st))),
    h('p', { class: 'small' }, `${u.arm} armour (subtracted from physical hits), ${u.ward} ward (subtracted from spells), ${u.defb ? `+${u.defb} defence, ` : ''}${u.max} health.`),
    h('h3', null, 'Gear'), [g.w, g.off, g.a, g.t1, g.t2].filter(Boolean).map(it => h('div', { class: 'small' }, h('b', { class: 'rn' + it.r }, it.n), ': ', itemDesc(it))),
    activeSets(x).map(t => h('div', { class: 'small rn4' }, t)),
    x.sub && Object.keys(SUBFX[x.sub]).length ? h('p', { class: 'small' }, h('b', null, `${subName(x)} strengths: `), fxText(SUBFX[x.sub]) + '.') : null,
    talentsOf(x).length ? [h('h3', null, 'Talents'), talentsOf(x).map(t => h('div', { class: 'small' }, h('b', null, t[0]), ': ', fxText(t[1]), '.'))] : null,
    free ? h('p', null, h('button', { onclick: () => { x.row = x.row === 'F' ? 'B' : 'F'; sheet(i); render(); } }, `Start fights in the ${x.row === 'F' ? 'back' : 'front'} row instead`)) : null,
    x.ctrl === 'ai' ? h('p', null, h('label', null, h('input', { type: 'checkbox', checked: !!x.manual, onchange: e => { x.manual = e.target.checked; render(); } }), ' Control this ally myself in combat')) : null,
    h('h3', null, `Skills (${x.eq.length}/4 equipped)`), free ? null : h('p', { class: 'small dim' }, 'Skills can be changed between fights.'),
    known(x).map(id => h('div', { class: 'sk small' }, h('label', null, h('input', { type: 'checkbox', checked: x.eq.includes(id), disabled: !free || (!x.eq.includes(id) && x.eq.length >= 4), onchange: () => toggle(id) }), h('span', null, h('b', null, SK[id].n), ' ', skillDesc(SK[id]))))),
    h('p', null, h('button', { class: 'primary', onclick: closeModal }, 'Close')));
}

// ---------- map ----------
const NODE = { fight: ['#8a3324', 'Fight'], elite: ['#6b1d43', 'Elite fight'], boss: ['#45267a', 'The lair'], event: ['#2f5d7c', 'Encounter'], shop: ['#8a6a12', 'Merchant'], rest: ['#3d6b3a', 'Camp'] };
const NS = 'http://www.w3.org/2000/svg', INK = '#3b2a1a';
function sv(tag, a, ...kids) { const e = document.createElementNS(NS, tag); for (const k in a || {}) if (a[k] != null && a[k] !== false) { if (k === 'onclick') e.onclick = a[k]; else e.setAttribute(k, a[k]); }
  for (const c of kids.flat(3)) { if (c == null || c === false) continue; if (typeof c === 'string') e.textContent = c; else e.append(c); } return e; }
const ink = (d, extra) => sv('path', { d, fill: 'none', stroke: INK, 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', ...extra });
function nodeIcon(type) {
  if (type === 'fight') return [ink('M-8,8 L7,-8 M8,8 L-7,-8 M-9,3 L-3,9 M3,9 L9,3')];
  if (type === 'elite') return [ink('M-7,-2 a7,7 0 1 1 14,0 q0,4 -3,5 v4 h-8 v-4 q-3,-1 -3,-5 z M-2,7 v3 M2,7 v3', { fill: '#f6ecd0' }), sv('circle', { cx: -3, cy: -2, r: 1.8, fill: INK }), sv('circle', { cx: 3, cy: -2, r: 1.8, fill: INK })];
  if (type === 'boss') return [ink('M-11,10 V-3 h3 v3 h3 V-10 h2.5 v3 h5 v-3 h2.5 V0 h3 v-3 h3 V10 z', { fill: '#d9c8a0' }), ink('M-2.5,10 v-5 a2.5,2.5 0 0 1 5,0 v5', { fill: INK })];
  if (type === 'event') return [sv('text', { x: 0, y: 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 'bold', 'font-family': 'Georgia, serif', fill: INK }, '?')];
  if (type === 'shop') return [ink('M-6,-3 Q-11,9 0,9 Q11,9 6,-3 Z', { fill: '#e6c874' }), ink('M-5,-4 L5,-4 M-3,-4 L-5,-9 L5,-9 L3,-4')];
  return [ink('M-10,8 L0,-9 L10,8 Z', { fill: '#cfe0b8' }), ink('M-3,8 L0,1 L3,8 M0,-9 L0,-12')];
}
function terrain(seed) {
  let a = seed | 0; const r = () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, a | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const out = [], clear = (x, y, d) => S.map.every(n => (n.px - x) ** 2 + (n.py - y) ** 2 > d * d), soft = { opacity: 0.6, 'stroke-width': 1.3 };
  // a river from the northern edge to the western one, between the first two legs of the road
  const two = S.acts === 2, riverY = two ? 322 : 222, mtnY = two ? 630 : 432;
  let d = `M${560 + r() * 120},22`, x = 600, y = 22; while (y < riverY) { y += 26; x += (r() - 0.5) * 40; d += ` Q${x + 18},${y - 13} ${x},${y}`; } while (x > 30) { x -= 46; y += (r() - 0.45) * 14; d += ` Q${x + 23},${y + (r() - 0.5) * 24} ${x},${y}`; }
  out.push(sv('path', { d, fill: 'none', stroke: '#7fa3b5', 'stroke-width': 7, 'stroke-linecap': 'round', opacity: 0.75 }), sv('path', { d, fill: 'none', stroke: '#e8f0ea', 'stroke-width': 1.2, 'stroke-dasharray': '10 14', opacity: 0.8 }));
  // a mountain range between the second and third legs
  for (let mx = two ? 60 : 270; mx < (two ? 830 : 890); mx += 30 + r() * 22) { const my = mtnY + (r() - 0.5) * (two ? 10 : 22), sz = 15 + r() * 12; if (!clear(mx, my - sz / 2, 38)) continue;
    out.push(ink(`M${mx - sz},${my} L${mx},${my - sz * 1.25} L${mx + sz},${my}`, { fill: '#d3c096', opacity: 0.9, 'stroke-width': 1.5 }), ink(`M${mx},${my - sz * 1.25} L${mx + sz * 0.2},${my - sz * 0.5} L${mx - sz * 0.15},${my - sz * 0.25}`, soft)); }
  // woods in clumps, thinning toward the lair; then hills and grass
  for (let c = 0; c < 20; c++) { const cx = 50 + r() * 860, cy = 60 + r() * 560, dead = cy > 470 && r() < 0.6;
    for (let k = 0; k < 5 + r() * 5; k++) { const tx = cx + (r() - 0.5) * 80, ty = cy + (r() - 0.5) * 46; if (!clear(tx, ty, 30) || (!two && ty > 400 && ty < 445 && tx > 230) || (two && ty > 590)) continue;
      out.push(dead ? ink(`M${tx},${ty} v-11 M${tx},${ty - 6} l-4,-5 M${tx},${ty - 8} l4,-4`, soft) : ink(`M${tx},${ty} v-4 M${tx - 5},${ty - 4} q5,-14 10,0 z`, { fill: '#a9b683', opacity: 0.75, 'stroke-width': 1.2 })); } }
  for (let k = 0; k < 16; k++) { const hx = 40 + r() * 880, hy = 50 + r() * 580; if (clear(hx, hy, 34)) out.push(ink(`M${hx - 12},${hy} q12,-13 24,0`, soft)); }
  for (let k = 0; k < 40; k++) { const gx = 30 + r() * 900, gy = 40 + r() * 600; if (clear(gx, gy, 26)) out.push(ink(`M${gx - 3},${gy} l1,-4 M${gx},${gy} v-5 M${gx + 3},${gy} l-1,-4`, { opacity: 0.4, 'stroke-width': 1 })); }
  return out;
}
function renderMap(main) {
  const opts = options(S), q = S.q, svg = sv('svg', { viewBox: '0 0 960 660', style: 'display:block;width:100%;min-width:700px' });
  svg.append(sv('defs', null, sv('filter', { id: 'paper', x: 0, y: 0, width: '100%', height: '100%' }, sv('feTurbulence', { type: 'fractalNoise', baseFrequency: 0.035, numOctaves: 4, seed: Math.abs(S.seed0 % 97) }), sv('feColorMatrix', { values: '0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.16  0 0 0 0.55 0' }), sv('feComposite', { operator: 'over', in2: 'SourceGraphic' }), sv('feBlend', { in: 'SourceGraphic', mode: 'multiply' })),
    sv('radialGradient', { id: 'vig', cx: '50%', cy: '50%', r: '75%' }, sv('stop', { offset: '60%', 'stop-color': '#5b3d1a', 'stop-opacity': 0 }), sv('stop', { offset: '100%', 'stop-color': '#5b3d1a', 'stop-opacity': 0.45 }))),
    sv('rect', { width: 960, height: 660, fill: '#e3d0a2', filter: 'url(#paper)' }), sv('rect', { width: 960, height: 660, fill: 'url(#vig)' }),
    sv('rect', { x: 9, y: 9, width: 942, height: 642, fill: 'none', stroke: INK, 'stroke-width': 3 }), sv('rect', { x: 15, y: 15, width: 930, height: 630, fill: 'none', stroke: INK, 'stroke-width': 1 }));
  svg.append(...terrain(S.seed0));
  const lab = (x, y, t, size, extra) => sv('text', { x, y, fill: INK, 'font-family': 'Georgia, serif', 'font-size': size, 'text-anchor': 'middle', ...extra }, t);
  svg.append(lab(480, 46, q.region.replace(/^the /, 'The ').toUpperCase(), 22, { 'letter-spacing': 6, 'font-weight': 'bold', opacity: 0.85 }));
  ['I', 'II', 'III'].slice(0, S.acts || 3).forEach((t, k) => svg.append(lab(k === 1 ? 915 : 45, S.acts === 2 ? 85 + k * 280 : 70 + k * 200, 'Act ' + t, 13, { 'font-style': 'italic', opacity: 0.7 })));
  // compass
  svg.append(sv('g', { transform: 'translate(908,606) scale(0.8)', opacity: 0.8 }, sv('circle', { r: 24, fill: 'none', stroke: INK, 'stroke-width': 1 }), ink('M0,-30 L5,0 L0,30 L-5,0 Z', { fill: '#cdb788' }), ink('M-30,0 L0,-5 L30,0 L0,5 Z', { fill: '#e9dab4', 'stroke-width': 1 }), lab(0, -34, 'N', 13, { 'font-weight': 'bold' })));
  // roads
  const walked = (n, m) => n.done && (m.done || m.id === S.pos);
  for (const n of S.map) for (const t of n.next) { const m = S.map[t], mx = (n.px + m.px) / 2, my = (n.py + m.py) / 2, dx = m.px - n.px, dy = m.py - n.py, len = Math.hypot(dx, dy) || 1, bend = ((n.id * 7 + t * 13) % 9 - 4) * 3.2;
    const d = `M${n.px},${n.py} Q${mx - dy / len * bend},${my + dx / len * bend} ${m.px},${m.py}`, live = n.id === S.pos && opts.includes(t);
    svg.append(sv('path', { d, fill: 'none', stroke: walked(n, m) ? '#8a2f1d' : live ? '#b07a12' : '#6b5335', 'stroke-width': walked(n, m) ? 3.2 : live ? 2.8 : 1.8, 'stroke-dasharray': walked(n, m) ? null : '7 6', 'stroke-linecap': 'round', opacity: walked(n, m) || live ? 1 : 0.75 })); }
  // start and end landmarks
  const st = S.map[0], bo = S.map[S.map.length - 1];
  svg.append(ink(`M${st.px - 44},${st.py + 6} v-9 l6,-6 l6,6 v9 z M${st.px - 30},${st.py + 12} v-8 l5,-5 l5,5 v8 z`, { fill: '#d9b98a', 'stroke-width': 1.3 }), lab(st.px + 2, st.py + 38, q.town, 14, { 'font-style': 'italic' }), lab(bo.px - 10, bo.py - 34, q.lair, 15, { 'font-style': 'italic', 'font-weight': 'bold' }));
  for (const n of S.map) { const d = NODE[n.type], go = opts.includes(n.id), here = n.id === S.pos, r = n.type === 'boss' ? 23 : 17;
    const g = sv('g', { class: 'node' + (go ? ' go' : ''), transform: `translate(${n.px},${n.py})`, opacity: n.done && !here ? 0.55 : 1, onclick: go ? () => { travel(S, n.id); sel = null; render(); } : null }, sv('title', null, n.fname ? `${d[1]}: ${n.fname}` : d[1]),
      go ? sv('circle', { class: 'ring', r: r + 6, fill: 'none', stroke: '#c8860d', 'stroke-width': 3.5 }) : null,
      sv('circle', { r, fill: n.done && !here ? '#cdbb90' : '#f3e6c4', stroke: d[0], 'stroke-width': 3.2 }), nodeIcon(n.type),
      go && n.fname ? lab(0, r + 19, n.fname.length > 30 ? n.fname.slice(0, 28) + '…' : n.fname, 11, { 'font-style': 'italic', style: 'paint-order:stroke', stroke: '#f3e6c4', 'stroke-width': 3 }) : null,
      here ? [ink(`M0,${-r} v-22`, { 'stroke-width': 2 }), ink(`M0,${-r - 22} l15,5 l-15,6 z`, { fill: '#b3261e', stroke: '#6d130d', 'stroke-width': 1.2 })] : null);
    svg.append(g); }
  const box = h('div', { class: 'mapbox' }); box.append(svg);
  const legend = Object.keys(NODE).map(t => { const s = sv('svg', { viewBox: '-20 -20 40 40', width: 26, height: 26, style: 'vertical-align:middle' }, sv('circle', { r: 17, fill: '#f3e6c4', stroke: NODE[t][0], 'stroke-width': 3.2 }), nodeIcon(t)); const sp = h('span', null); sp.append(s, ' ' + NODE[t][1]); return sp; });
  main.append(h('div', { class: 'card' }, h('h2', null, q.title),
    h('p', null, `${q.name}, ${q.vtitle}, ${q.motive}. Your road runs from ${q.town} through ${q.region} to ${q.lair}.`),
    S.q.mods && S.q.mods.length ? h('p', { class: 'small' }, h('b', { style: 'color:var(--red)' }, 'Contract conditions: '), S.q.mods.map(m => `${MODS[m][0]}: ${MODS[m][1]}`).join(' ')) : null,
    h('div', { class: 'item', style: 'padding:6px 10px' }, h('b', null, 'Goal: '), actGoal(S), bossOdds(S) > 0 ? h('span', { class: 'rn1' }, ` ${q.name} will start the final fight ${bossOdds(S)}% weaker.`) : bossOdds(S) < 0 ? h('span', { style: 'color:var(--red)' }, ` ${q.name} has been warned and starts ${-bossOdds(S)}% stronger.`) : ''),
    box, h('p', { class: 'row small' }, legend),
    q.log && q.log.length ? h('details', null, h('summary', { style: 'cursor:pointer' }, `Quest log (${q.log.length})`), q.log.map(e => h('div', { class: 'small', style: e.good ? '' : 'color:#e39a7d' }, e.t))) : null,
    h('p', null, humansIdx().length > 1 ? h('b', null, `${leader().player} (${leader().name}) chooses the road. `) : '', 'Pick one of the ringed stops. The red flag marks where you are.', S.nextMod ? h('span', { class: 'dim' }, ' ' + { ambush: 'You will have the jump on the next enemy.', surprised: 'The next enemy will have the jump on you.', exposed: 'The next enemy starts Exposed.' }[S.nextMod]) : '')));
}

// ---------- combat ----------
const mine = u => { if (u.side !== 'H' || u.npc || u.comp) return false; const x = S.party[u.hi]; return x.ctrl === 'human' || x.manual; };
function unitCard(C, u, targets, onPick, pv) {
  const st = Object.keys(u.states), fx = (C.fx || []).filter(f => f.id === u.id), tgt = targets && targets.includes(u.id);
  return h('div', { class: `unit ${u.side}${u.id === C.cur && !C.over ? ' cur' : ''}${tgt ? ' tgt' : ''}${up(u) ? '' : ' down'}${u.boss ? ' boss' : ''}`, onclick: () => { if (tgt) onPick(u.id); else { inspect = u.id; render(); } } },
    h('div', { class: 'un' }, u.name), hpBar(u.hp, u.max), h('div', { class: 'small dim' }, up(u) ? `${u.hp}/${u.max}` : u.side === 'H' ? 'down' : 'dead', u.ar ? ` · ${AR_NAME[u.ar].split(' ')[0]}` : '', u.npc ? ' · protect' : u.comp ? ' · companion' : u.flee ? ' · fleeing' : ''),
    u.bu ? Object.keys(BU_NAME).filter(k => u.bu[k] > 0).map(k => h('div', { class: 'meter ' + k, title: BU_INFO[k] }, h('i', { style: `width:${Math.min(100, 100 * u.bu[k] / u.cap)}%` }), h('span', null, `${BU_NAME[k]} ${Math.round(100 * u.bu[k] / u.cap)}%`))) : null,
    h('div', null, st.map(s => h('span', { class: `chip ${s}${DEBUFFS.includes(s) ? '' : ' good'}`, title: STATE_INFO[s] }, s + (u.states[s].t > 1 ? ' ' + u.states[s].t : '')))),
    pv ? h('div', { class: 'pv' }, h('b', null, `${Math.round(pv.p * 100)}% hit`), ` · ${pv.lo === pv.hi ? pv.lo : pv.lo + ' to ' + pv.hi} dmg`, pv.g ? h('span', { class: 'dim' }, ` · ${Math.round(pv.g * 100)}% glancing`) : null, pv.tags.length ? h('div', { class: 'dim' }, pv.tags.join(', ')) : null) : null,
    fx.map(f => h('span', { class: 'pop ' + (f.miss ? 'm' : f.h !== undefined ? 'h' : 'd') }, f.tag === 'Stagger' ? 'Stagger!' : f.miss ? 'miss' : f.h !== undefined ? '+' + f.h : '-' + f.d + (f.crit ? '!' : f.glance ? ' glancing' : '') + (f.tag ? ' ' + f.tag : ''))));
}
function describeUnit(C, u) {
  if (u.npc) return `${u.name}: keep them alive.`; if (u.comp) return `${u.name}, companion. Fights on their own.`;
  if (u.side === 'H') { const x = S.party[u.hi]; return `${u.name}, ${subName(x)}. ${STATS.map(s => STAT_NAME[s] + ' ' + u.st[s]).join(', ')}; ${u.arm} armour, ${u.ward} ward.`; }
  const ar = ARMT[u.ar], els = Object.entries(u.aff).filter(([, v]) => v !== 1).map(([k, v]) => `${EL_NAME[k]} x${v}`), imm = Object.keys(BU_NAME).filter(k => !u.bres[k]).map(k => BU_NAME[k]);
  return `${u.name} (${FAM[u.fam].n}). ${AR_NAME[u.ar]}: Slash x${ar.slash}, Pierce x${ar.pierce}, Strike x${ar.strike}.${els.length ? ' ' + els.join(', ') + '.' : ''}${imm.length ? ' Immune to ' + imm.join(' and ') + '.' : ''} ${u.arm} armour, ${u.ward} ward, Agility ${u.st.agility}. Meters fill at ${u.cap}. Uses: ${u.skills.map(k => SK[k].n).join(', ')}.`;
}
function renderCombat(main) {
  const C = S.C, cur = unit(C, C.cur), myTurn = !C.over && cur && mine(cur);
  let targets = null, selSk = null;
  if (myTurn && sel) { selSk = sel.k === 'item' ? { ...CONS[sel.id], ty: 'ranged' } : sel.k === 'revive' ? { tg: 'downed' } : SK[sel.id]; targets = targetsFor(C, cur, selSk); }
  // preview the selected attack on every enemy it could hit
  const atk = selSk && (selSk.m || selSk.flat !== undefined) && targets && targets.length, pvFor = u => { if (!atk || u.side === cur.side || !up(u)) return null; const ok = targets.includes(u.id) || targets.includes(u.row) || (targets[0] === '-' && selSk.tg === 'all'); return ok ? preview(C, cur, selSk.id === 'attack' || SK[selSk.id] ? selSk : selSk, u) : null; };
  const fire = t => { const a = sel.k === 'revive' ? { k: 'revive', t } : { k: sel.k, id: sel.id, t }; sel = null; bagOpen = false; if (act(S, C, a)) render(); else render(); };
  const line = (side, r) => { const us = C.units.filter(u => u.side === side && u.row === r && (side === 'H' || up(u))), rowT = targets && side === 'E' && targets.includes(r);
    return h('div', { class: 'rowline' }, h('div', { class: 'rowlab' + (rowT ? ' tgt' : ''), onclick: rowT ? () => fire(r) : null }, rowT ? 'Hit this row' : (r === 'F' ? 'Front' : 'Back')), us.map(u => unitCard(C, u, targets, fire, pvFor(u)))); };
  const card = h('div', { class: 'card' }, h('h2', null, C.boss ? `${S.q.name}, ${S.q.vtitle}` : C.name || (C.elite ? 'A dangerous foe' : 'Battle'), h('span', { class: 'dim small' }, `  round ${C.round}`)),
    C.obj ? h('p', { class: 'small', style: 'color:#ffd36b' }, 'Objective: ' + OBJ_TEXT[C.obj.k](C.obj)) : null,
    h('div', { class: 'side' }, line('E', 'B'), line('E', 'F')), h('div', { class: 'log', id: 'log' }, C.log.slice(-40).map(t => h('div', null, t))), h('div', { class: 'side' }, line('H', 'F'), line('H', 'B')));
  const bar = h('div', { class: 'acts' });
  if (C.over) bar.append(h('p', null, h('b', null, C.over === 'win' ? 'Victory. ' : 'The party has fallen. '), h('button', { class: 'primary', onclick: () => { endCombat(S); sel = null; render(); } }, 'Continue')));
  else if (myTurn) {
    const x = S.party[cur.hi], pickA = a => { sel = a; bagOpen = false; render(); };
    const btn = id => { const sk = SK[id], cd = cur.cds[id], gone = cur.used[id], none = !targetsFor(C, cur, sk).length;
      return h('button', { class: sel && sel.k === 'skill' && sel.id === id ? 'on' : '', disabled: !!cd || !!gone || none, title: skillDesc(sk), onclick: () => pickA({ k: 'skill', id }) }, sk.n, cd ? h('span', { class: 'cd' }, ` (${cd})`) : gone ? h('span', { class: 'cd' }, ' (used)') : ''); };
    const downed = C.units.some(u => u.side === 'H' && u.down && !u.npc && !u.comp);
    bar.append(h('p', null, h('b', null, `${cur.name}'s turn`), x.ctrl === 'human' && humansIdx().length > 1 ? ` (${x.player})` : '', cur.streak ? h('span', { class: 'dim' }, ` · +${cur.streak * 3} to hit after missing`) : ''),
      h('div', { class: 'row' }, btn('attack'), cur.skills.map(btn)),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => { sel = null; act(S, C, { k: 'defend' }); render(); } }, 'Defend'), h('button', { onclick: () => { sel = null; act(S, C, { k: 'move' }); render(); } }, `Move to ${cur.row === 'F' ? 'back' : 'front'} row`),
        downed ? h('button', { class: sel && sel.k === 'revive' ? 'on' : '', onclick: () => pickA({ k: 'revive' }) }, 'Help an ally up') : null,
        h('button', { disabled: !S.bag.length, class: bagOpen ? 'on' : '', onclick: () => { bagOpen = !bagOpen; sel = null; render(); } }, 'Supplies')),
      h('div', { class: 'row', style: 'margin-top:8px' }, !bagOpen ? null : S.bag.map(b => h('button', { class: sel && sel.k === 'item' && sel.id === b.id ? 'on' : '', disabled: !targetsFor(C, cur, { ...CONS[b.id], ty: 'ranged' }).length, title: CONS[b.id].d, onclick: () => { sel = { k: 'item', id: b.id }; bagOpen = true; render(); } }, `${CONS[b.id].n} x${b.qty}`))));
    if (sel) { const d = sel.k === 'skill' ? skillDesc(SK[sel.id]) : sel.k === 'item' ? CONS[sel.id].d : 'Spend your turn to get a downed ally back on their feet at 20% health.';
      bar.append(h('p', { class: 'small' }, h('b', null, sel.k === 'skill' ? SK[sel.id].n : sel.k === 'item' ? CONS[sel.id].n : 'Help up'), ': ', d, ' ',
        targets && targets[0] === '-' ? h('button', { class: 'primary', onclick: () => fire('-') }, 'Use') : targets && targets.length ? h('span', { class: 'dim' }, 'Choose a glowing target.') : h('span', { class: 'dim' }, 'No valid target.'))); }
    else bar.append(h('p', { class: 'small dim' }, 'Pick an action, then a glowing target; each target shows your hit chance, damage, multipliers and meter buildup. Click any combatant to see its armour, weaknesses and meters.'));
  } else bar.append(h('p', { class: 'dim' }, cur ? `${cur.name} is acting…` : ''));
  if (inspect) { const u = unit(C, inspect); if (u) bar.append(h('p', { class: 'small', style: 'border-top:1px solid var(--line);padding-top:6px' }, describeUnit(C, u), ' ', Object.keys(u.states).map(s => `${s}: ${STATE_INFO[s]}`).join(' '))); }
  card.append(bar); main.append(card);
  const lg = $('log'); if (lg) lg.scrollTop = 1e6;
  if (!C.over && !myTurn && cur) timer = setTimeout(() => { timer = null; if (!S || S.screen !== 'combat' || S.C !== C || C.over) return; const u = unit(C, C.cur); act(S, C, u.side === 'H' ? aiHero(S, C, u) : aiEnemy(S, C, u)); render(); }, speed());
}

// ---------- events ----------
function giveButtons(it, onPick, extra) {
  if (it.k === 'cons') return h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => onPick(0) }, 'Take'), extra);
  const list = S.party.map((x, i) => { if (!canUse(x, it)) return null; const old = x.gear[slotOf(x, it)]; return h('button', { onclick: () => onPick(i), title: old ? itemDesc(old) : '' }, `${x.name}`, h('span', { class: 'dim small' }, old ? ` (swaps out ${old.n})` : ' (empty slot)')); }).filter(Boolean);
  return h('div', { class: 'row' }, list.length ? list : h('span', { class: 'dim small' }, 'Nobody in the party can use this.'), h('button', { onclick: () => onPick(-1) }, 'Into the pack'), extra);
}
function setInfo(it) { if (!it.set) return null; const s = SETS[it.set], all = S.party.flatMap(x => Object.values(x.gear)).concat(S.stash).filter(g => g && g.set === it.set).length;
  return h('div', { class: 'small rn4' }, `${s.n}: ${s.pieces.map(p => p.n).join(', ')}. The party holds ${all} of ${s.pieces.length}; one hero must wear them together. `, setLines(it.set).join('; ') + '.'); }
function activeSets(x) { const out = []; for (const k of Object.keys(SETS)) { const n = setCount(x, k); if (n) out.push(`${SETS[k].n} (${n}/${SETS[k].pieces.length}): ` + (Object.entries(SETS[k].bonus).filter(([need]) => n >= +need).map(([, fx]) => fxText(fx)).join(', ') || 'no bonus yet')); } return out; }
const itemCard = (it, foot) => h('div', { class: `item r${it.r || 0}` + (it.sold ? ' sold' : '') }, h('b', { class: 'rn' + (it.r || 0) }, it.n + (it.k === 'cons' && it.qty > 1 ? ` x${it.qty}` : '')), it.k === 'cons' ? null : h('span', { class: 'small dim' }, ` ${RAR[it.r]}`), h('div', { class: 'small' }, itemDesc(it)), setInfo(it), foot);
// the shared pack: what everyone wears, and everything spare, grouped by kind
function openPack() {
  const free = packable(S), again = () => { openPack(); render(); }, groups = [['weapon', 'Weapons'], ['shield', 'Off-hand'], ['armor', 'Armour'], ['trinket', 'Trinkets']];
  const out = [h('h2', null, 'Gear and pack'), h('p', { class: 'small dim' }, free ? 'Nothing is lost when gear is swapped: it comes back here, ready for someone else.' + (S.screen === 'shop' || S.screen === 'town' ? ' The merchant buys spare gear at half its value.' : ' Spare gear can be sold at a merchant.') : 'Gear cannot be changed during a fight.')];
  S.party.forEach((x, i) => out.push(h('h3', null, `${x.name}, ${subName(x)}`), ['w', 'off', 'a', 't1', 't2'].map(sl => { const it = x.gear[sl]; return it ? h('div', { class: `item r${it.r}`, style: 'margin:3px 0;padding:4px 8px' }, h('b', { class: 'rn' + it.r }, it.n), h('span', { class: 'small' }, ' ' + itemDesc(it) + ' '), free && sl !== 'w' ? h('button', { class: 'small', onclick: () => { unequip(S, i, sl); again(); } }, 'Take off') : null) : null; }), activeSets(x).map(t => h('div', { class: 'small rn4' }, t))));
  out.push(h('h2', { style: 'margin-top:14px' }, `In the pack (${S.stash.length})`));
  if (!S.stash.length) out.push(h('p', { class: 'dim' }, 'Empty.'));
  for (const [k, title] of groups) { const list = S.stash.map((it, si) => [it, si]).filter(e => e[0].k === k).sort((a, b) => b[0].r - a[0].r || b[0].tier - a[0].tier); if (!list.length) continue;
    out.push(h('h3', null, title), list.map(([it, si]) => itemCard(it, free ? h('div', { class: 'row' }, S.party.map((x, i) => canUse(x, it) ? h('button', { onclick: () => { fromStash(S, si, i); again(); } }, x.name, h('span', { class: 'dim small' }, x.gear[slotOf(x, it)] ? ` (swaps out ${x.gear[slotOf(x, it)].n})` : ' (empty slot)')) : null), S.screen === 'shop' || S.screen === 'town' ? h('button', { onclick: () => { sellStash(S, si); again(); } }, `Sell (${sellValue(S, it)} gold)`) : null) : null))); }
  out.push(h('p', null, h('button', { class: 'primary', onclick: closeModal }, 'Close')));
  modal(out);
}
function renderEvent(main) {
  const e = EV[S.ev.id], r = S.ev.result, card = h('div', { class: 'card' }, h('h2', null, fill(S, e.t)), h('p', null, eventText(S, e)));
  if (!r) { if (humansIdx().length > 1) card.append(h('p', { class: 'dim' }, `${leader().player} (${leader().name}) decides.`));
    e.c.forEach((c, i) => { const cost = c.cost ? Math.round(c.cost * (0.7 + 0.3 * pw(S))) : 0; let sub = '';
      if (c.s) { const info = checkInfo(S, c); sub = `${STAT_NAME[c.s]} check: ${S.party[info.hi].name} rolls d20 + ${info.stat} and needs ${info.need}+ on the die (${Math.round(info.odds * 100)}%)`; }
      else if (cost) sub = `Costs ${cost} gold` + (S.gold < cost ? ' (you cannot afford it)' : ''); else if (c.random) sub = 'Anything could happen';
      card.append(h('button', { class: 'choice', disabled: cost > S.gold, onclick: () => { chooseEvent(S, i); render(); } }, fill(S, c.l), sub ? h('small', null, sub) : null)); });
  } else {
    if (r.roll) card.append(h('p', null, h('span', { class: 'dice' }, String(r.roll.r)), `${S.party[r.roll.hi].name} rolls ${r.roll.r} + ${r.roll.stat} ${STAT_NAME[r.roll.s]} = ${r.roll.r + r.roll.stat} against ${r.roll.dc}: `, h('b', null, { ok: 'success', mid: 'partial success', bad: 'failure' }[r.roll.out]), '.'));
    card.append(h('p', null, r.text)); if (r.got.length) card.append(h('p', { class: 'dim' }, r.got.join(' · ') + '.'));
    if (r.items.length) card.append(h('h3', null, 'You found'), itemCard(r.items[0], giveButtons(r.items[0], i => { eventGive(S, i); render(); })));
    else card.append(h('p', null, h('button', { class: 'primary', onclick: () => { continueEvent(S); sel = null; render(); } }, r.fight ? 'To arms' : 'Continue')));
  }
  main.append(card);
}

// ---------- loot, shop, rest ----------
function renderLoot(main) {
  main.append(h('div', { class: 'card' }, h('h2', null, 'Spoils'), (S.loot.notes || []).map(t => h('p', { style: 'color:#ffd36b' }, t)), h('p', null, `The party gains ${S.loot.gold} gold and ${S.loot.xp} experience. Take one of these. Gear you swap out goes into the shared pack.`),
    h('div', { class: 'grid3' }, S.loot.items.map((it, k) => itemCard(it, giveButtons(it, i => { takeLoot(S, k, i); render(); })))),
    h('p', null, h('button', { onclick: () => { takeLoot(S, -1); render(); } }, 'Leave them and take 10 gold instead'))));
}
function shopGrid() { return h('div', { class: 'grid3' }, S.shop.items.map((it, k) => itemCard(it, it.sold ? h('div', { class: 'small dim' }, 'Sold') : h('div', null, h('div', { class: 'small' }, `${it.price} gold`), S.gold >= it.price ? giveButtons(it, i => { buy(S, k, i); render(); }) : h('div', { class: 'small dim' }, 'Too expensive'))))); }
function smithPanel() { const top = S.camp ? ['plain', 'Fine', 'Masterwork', 'Runed', 'Legendary'][maxTier(S) - 1] : 'Masterwork';
  return [h('p', { class: 'small dim' }, `Works on gear a hero is wearing. Improve raises quality a step (up to ${top}${S.camp && maxTier(S) < 5 ? ' for now; the smith learns more each chapter' : ''}). Enchant adds a magical property, up to three, and raises rarity. Reforge rerolls the properties an item has. Set pieces can only be improved.`),
    S.party.map((x, i) => h('div', { class: 'item', style: 'padding:6px 10px' }, h('b', null, x.name), ['w', 'off', 'a'].map(sl => { const it = x.gear[sl]; if (!it) return null; const ops = Object.keys(SMITH).map(op => [op, smithCost(it, op, S)]).filter(o => o[1]);
      return h('div', { class: 'row small', style: 'margin-top:4px' }, h('span', { class: 'rn' + it.r, title: itemDesc(it), style: 'min-width:190px' }, it.n), ops.length ? ops.map(([op, c]) => h('button', { class: 'small', disabled: S.gold < c, onclick: () => { smith(S, i, sl, op); render(); } }, `${SMITH[op]} (${c})`)) : h('span', { class: 'dim' }, 'nothing more to do')); })))]; }
const healButton = () => h('button', { disabled: !S.party.some(x => x.wounds || x.hp < maxHp(x)) || S.gold < S.shop.healCost, onclick: () => { buyHeal(S); render(); } }, `Healer: full health and one wound each (${S.shop.healCost} gold)`);
function renderShop(main) {
  main.append(h('div', { class: 'card' }, h('h2', null, 'A travelling merchant'), h('p', null, S.q.flags.helped ? 'Word of your good deeds has reached her: prices are a fifth lower.' : '"Coin first, then questions."', ` You have ${S.gold} gold. `, h('button', { onclick: openPack }, `Sell spare gear from the pack (${S.stash.length})`)),
    shopGrid(), h('h3', null, 'The smith'), smithPanel(),
    h('p', { class: 'row' }, healButton(), h('button', { class: 'primary', onclick: () => { finishNode(S); render(); } }, 'Leave'))));
}
// ---------- campaign: town and chapter summary ----------
function renderTown(main) {
  const c = S.camp, q = S.q, sec = (title, open, ...kids) => { const d = h('details', { open, style: 'margin:10px 0;border-top:1px solid var(--line);padding-top:8px' }, h('summary', { style: 'cursor:pointer;color:var(--gold);font-size:17px' }, title)); d.append(...kids.flat(3).filter(k => k != null && k !== false)); return d; };
  const brief = (Q, k) => h('div', { class: 'item r' + (Q.mods.length ? Math.min(3, 1 + Q.mods.length) : c.ch === 5 ? 3 : 2) }, h('b', null, Q.title), h('div', null, `${Q.name}, ${Q.vtitle}, ${Q.motive}. The road runs through ${Q.region} to ${Q.lair}.`), h('div', { class: 'small dim' }, `Two acts. Enemies: ${FAM[Q.fam].n}. ${FAM[Q.fam].weak}`),
      Q.mods.map(m => h('div', { class: 'small', style: 'color:#e39a7d' }, `${MODS[m][0]}: ${MODS[m][1]}`)), c.board ? h('div', { class: 'small' }, `Reward: ${Math.round((60 + 25 * Q.rank) * (1 + 0.35 * Q.mods.length) * (1 + perk(S, 'gold')))} gold${Q.rank >= 3 ? `, ${Math.round((0.3 + 0.2 * Q.mods.length) * 100)}% chance of a relic from the boss` : ''}.`) : null,
      h('p', null, h('button', { class: 'primary', onclick: () => { startChapter(S, k); render(); } }, c.board ? 'Take this contract' : 'Set out')));
  const home = c.estate ? 'Oathkeep' : 'Lastlight', built = c.estate ? Object.keys(c.estate.rooms).length : 0;
  main.append(h('div', { class: 'card' }, h('h2', null, home), h('p', null, c.estate ? `Your own keep, ${built ? `with ${built} of ${Object.keys(ROOMS).length} rooms restored` : 'still mostly rubble'}. It has every service the town had, and the notice board follows you here.` : 'Home, such as it is: an inn, a forge, a healer, and a notice board.', ' Everyone is rested and at full health.', ` You have ${S.gold} gold.`),
    c.board ? [h('h3', null, `The notice board (renown rank ${c.rank}, best completed ${c.best || 'none'})`), h('p', { class: 'small dim' }, 'Completing a contract at or above your rank raises it. Conditions make a contract harder and pay more.'), h('div', { class: 'grid3' }, c.board.map(brief))] : brief(q, 0),
    c.estate ? sec('Build at Oathkeep', !built, Object.entries(ROOMS).map(([id, r]) => h('div', { class: 'item', style: 'padding:6px 10px' }, h('b', null, r[0]), ' ', h('span', { class: 'small' }, r[2]), ' ', c.estate.rooms[id] ? h('span', { class: 'small rn1' }, 'Built') : h('button', { class: 'small', disabled: S.gold < r[1], onclick: () => { buildRoom(S, id); render(); } }, `Build (${r[1]} gold)`)))) : null,
    sec(`Trophies (${Object.keys(c.trophies).length} of ${Object.keys(TROPHY).length})`, false, h('p', { class: 'small dim' }, room(S, 'hall') ? 'On display in the trophy hall; every bonus is in effect.' : c.estate ? 'Build a trophy hall at Oathkeep to display these and gain their bonuses.' : 'Kept in a sack for now. A place to display them, and gain their bonuses, comes later.'),
      Object.entries(TROPHY).map(([id, t]) => h('div', { class: 'small', style: 'margin:4px 0;opacity:' + (c.trophies[id] ? 1 : 0.5) }, h('b', { class: c.trophies[id] ? 'rn5' : '' }, c.trophies[id] ? t.n : 'Not yet won'), ` · ${t.d} · ${bonusText(t)}`))),
    sec('Codex', false, h('p', { class: 'small dim' }, room(S, 'library') ? 'Each completed page grants its reward.' : 'Completed pages grant rewards once a library stands at the estate.'),
      CODEX.map(pg => { const have = codexHave(S, pg.id), tot = pg.total(); return h('div', { class: 'small', style: 'margin:6px 0' }, h('b', { class: have >= tot ? 'rn5' : '' }, `${pg.n}: ${have} of ${tot}`), ` · reward: ${bonusText(pg)}`, h('div', { class: 'bar' }, h('i', { style: `width:${100 * have / tot}%;background:var(--gold)` })),
        pg.id === 'set' ? h('div', { class: 'dim' }, Object.entries(SETS).map(([k, st]) => `${st.n}: ${st.pieces.map((p, pi) => c.codex.set[k + pi] ? p.n : '?').join(', ')}`).join(' · ')) : pg.id === 'uq' ? h('div', { class: 'dim' }, Object.entries(UNIQUES).map(([k, u]) => c.codex.uq[k] ? u.n : '?').join(', ')) : null); })),
    sec(`Deeds (${Object.keys(c.ach).length} of ${ACH.length})`, false, h('p', { class: 'small dim' }, 'Each deed pays 25 gold the moment it is done.'), ACH.map(([id, n, d, goal, fn]) => { const v = Math.min(goal, fn(S)); return h('div', { class: 'small', style: 'margin:5px 0;opacity:' + (c.ach[id] ? 1 : 0.75) }, h('b', { class: c.ach[id] ? 'rn5' : '' }, n), ` · ${d}`, goal > 1 && !c.ach[id] ? ` (${v}/${goal})` : c.ach[id] ? ' · done' : '', !c.ach[id] && goal > 1 ? h('div', { class: 'bar' }, h('i', { style: `width:${100 * v / goal}%;background:var(--gold)` })) : null); })),
    sec('Chronicle', c.done.length < 1 && !c.estate, c.lore.map(t => h('p', null, t)), c.done.length ? h('p', { class: 'dim small' }, 'Defeated: ', c.done.slice(-12).map(d => `${d.name} (${d.title})${d.rank ? ` on a rank ${d.rank} contract` : `, at level ${d.level}`}`).join('; '), '.') : null, h('p', { class: 'dim small' }, `Times driven back: ${c.wipes}.`, c.saga ? ' The saga is complete; contracts grow harder without end.' : c.ch >= 4 ? ` The enemy is known: ${ARCH[c.arch].name}, ${ARCH[c.arch].title}.` : ' Someone is behind all this. You do not yet know who.')),
    sec('Merchant', !c.estate, shopGrid(), h('p', { class: 'row' }, healButton(), h('button', { onclick: openPack }, `Vault and pack (${S.stash.length}): sort, hand out and sell gear`))),
    sec('Smith', false, smithPanel()),
    sec('Training hall', false, h('p', { class: 'small dim' }, `Swap a talent for ${trainCost(S, 'talent')} gold, or retrain a hero into their class's other path for ${trainCost(S, 'sub')} gold (talents carry across by position).`),
      S.party.map((x, i) => h('div', { class: 'item', style: 'padding:6px 10px' }, h('b', null, `${x.name}, ${subName(x)}`), x.sub ? h('button', { class: 'small', style: 'margin-left:8px', disabled: S.gold < trainCost(S, 'sub'), onclick: () => { changeSub(S, i, true); render(); } }, `Retrain as ${Object.values(CLASSES[x.cls].subs).find(v => v.n !== subName(x)).n} (${trainCost(S, 'sub')})`) : h('span', { class: 'small dim' }, ' chooses a path at level 3'),
        x.sub ? (x.tal || []).map((ch, k) => ch === undefined || ch === null ? null : h('div', { class: 'row small', style: 'margin-top:4px' }, h('span', { class: 'dim', style: 'min-width:60px' }, `Level ${k + 6}`), TALENTS[x.sub][k].map((t, o) => h('button', { class: 'small' + (ch === o ? ' on' : ''), disabled: ch === o || S.gold < trainCost(S, 'talent'), title: fxText(t[1]), onclick: () => { retrain(S, i, k, o); render(); } }, `${t[0]}: ${fxText(t[1])}`)))) : null,
        x.sub && !(x.tal || []).length ? h('div', { class: 'small dim' }, 'Talents begin at level 6.') : null)))));
}
function renderChapter(main) {
  const L = S.camp.last;
  main.append(h('div', { class: 'card' }, h('h2', null, L.win ? (L.ch === 5 ? 'The saga is won' : L.ch > 5 ? 'Contract fulfilled' : `Chapter ${L.ch} complete`) : 'Driven back'), h('p', { class: 'dim' }, L.title), L.lines.map(t => h('p', null, t)),
    h('p', null, h('button', { class: 'primary', onclick: () => { closeChapter(S); render(); } }, S.camp.estate ? 'Return to Oathkeep' : 'Return to Lastlight'))));
}
function renderRest(main) {
  const opt = (k, t, d) => h('button', { class: 'choice', onclick: () => { doRest(S, k); render(); } }, t, h('small', null, d));
  main.append(h('div', { class: 'card' }, h('h2', null, 'Camp'), h('p', null, 'A sheltered hollow, dry wood, and nobody on your trail for once.'),
    opt(0, 'Rest', 'Everyone recovers 60% health and one wound.'), opt(1, 'Forage', 'Recover 25% health and gather a healing potion and one other supply.'), opt(2, 'Train', 'Recover 25% health and gain 8 experience.')));
}

// ---------- level up, end ----------
function renderLevel(main) {
  const L = S.lvl; L.need.forEach((n, i) => { if (n && S.party[i].ctrl === 'ai') pickSub(S, i, aiSub(S, i)); }); L.needT.forEach((n, i) => { if (n && S.party[i].ctrl === 'ai') pickTalent(S, i, Math.random() < 0.5 ? 0 : 1); });
  const card = h('div', { class: 'card' }, h('h2', null, `Level ${L.level}`), h('p', null, 'The whole party grows stronger: more health, higher stats, and new skills.'));
  S.party.forEach((x, i) => { const c = CLASSES[x.cls];
    if (L.need[i]) card.append(h('h3', null, `${x.name} (${x.player}): choose a path`), h('div', { class: 'grid3' }, Object.entries(c.subs).map(([k, sub]) => h('div', { class: 'item' }, h('b', null, sub.n), h('div', { class: 'small' }, sub.blurb), Object.keys(SUBFX[k]).length ? h('div', { class: 'small rn1' }, 'Built in: ' + fxText(SUBFX[k]) + '.') : null, sub.sk.map((id, n) => h('div', { class: 'small dim' }, `Level ${n + 3}: ${SK[id].n}. ${skillDesc(SK[id])}`)), (() => { const nw = pathWeapon(x, k); if (!nw) return h('p', { class: 'small dim' }, `Signature weapon: ${WT[SUBWP[k]].n}. ${x.gear.w.type === SUBWP[k] ? 'You already carry one.' : 'Your current weapon is special and stays as it is.'}`);
        const box = h('input', { type: 'checkbox', checked: true }); return [h('label', { class: 'small', style: 'display:block;margin-top:6px' }, box, ` Remake my ${x.gear.w.n} as a `, h('b', { class: 'rn' + nw.r }, nw.n), ` (${itemDesc(nw)}) The old weapon goes to the pack.`), h('p', null, h('button', { class: 'primary', onclick: () => { pickSub(S, i, k, box.checked); render(); } }, `Become a ${sub.n}`))]; })(),
        pathWeapon(x, k) ? null : h('p', null, h('button', { class: 'primary', onclick: () => { pickSub(S, i, k); render(); } }, `Become a ${sub.n}`))))));
    else if (L.needT[i]) card.append(h('h3', null, `${x.name} (${x.player}): choose a talent`), h('div', { class: 'grid3' }, TALENTS[x.sub][L.level - 6].map((t, o) => h('div', { class: 'item' }, h('b', null, t[0]), h('div', { class: 'small' }, fxText(t[1]) + '.'), h('p', null, h('button', { class: 'primary', onclick: () => { pickTalent(S, i, o); render(); } }, 'Take ' + t[0]))))));
    else card.append(h('div', { class: 'item small' }, h('b', null, x.name), L.level >= 6 && x.sub && x.tal[L.level - 6] !== undefined ? ` takes ${TALENTS[x.sub][L.level - 6][x.tal[L.level - 6]][0]}. ` : '', L.level === 3 ? ` is now ${/^[AEIOU]/.test(subName(x)) ? 'an' : 'a'} ${subName(x)}. ` : ' ', L.gained[i].length ? L.gained[i].map(id => h('div', null, 'New skill: ', h('b', null, SK[id].n), '. ', skillDesc(SK[id]), x.eq.includes(id) ? '' : ' (Not equipped: open the hero sheet to swap it in.)')) : L.level >= 6 ? '' : 'Stronger, but no new skill this level.')); });
  card.append(h('p', null, h('button', { class: 'primary', disabled: L.need.some(Boolean) || L.needT.some(Boolean), onclick: () => { closeLevel(S); render(); } }, 'Continue')));
  main.append(card);
}
function renderEnd(main) {
  const st = S.stats;
  main.append(h('div', { class: 'card' }, h('h2', null, S.result === 'victory' ? 'The oath is kept' : 'The oath is broken'), h('p', null, ending(S)),
    h('p', { class: 'dim' }, `${st.fights} fights · ${st.kills} enemies destroyed · ${st.combos} combos landed · ${st.downs} times a hero went down · ${st.passed} of ${st.checks} checks passed · reached level ${S.party[0].level}.`),
    h('p', null, h('button', { class: 'primary', onclick: () => { S = null; render(); } }, 'New adventure'))));
}
function rules() {
  modal(h('h2', null, 'How it works'),
    h('p', null, h('b', null, 'The map. '), 'Each adventure has three acts: pick up the trail, break the villain\'s strength, storm the lair. Choose a route across the map: fights, encounters, merchants and camps.'),
    h('p', null, h('b', null, 'Rows. '), 'Melee attacks can only reach the enemy front row while anyone stands in it, and can only be made from your own front row (spears reach from the back). Ranged attacks and spells reach anyone.'),
    h('p', null, h('b', null, 'Attacks. '), 'Roll a d20 plus your attack stat against 9 + the target\'s Agility (+ shield). A 20 is a critical hit. A roll that misses by 4 or less is a glancing blow for half damage, with no states applied. Each full miss gives that hero +3 to hit on their next attack, up to +9, until they land one. Armour is subtracted from physical damage, ward from spell damage. Selecting an attack shows your hit chance and damage on every target.'),
    h('p', null, h('b', null, 'Stats. '), 'Every stat helps every hero. Might: +2 health per point, and melee attack and damage. Agility: defence and turn order, plus attack with bows, daggers and rapiers. Mind: one step wider critical range per 4 points, and spell attack and damage. Spirit: 3% per point to resist harmful states from enemies and +3% healing received, plus holy attacks and heal strength. Items "of Power" always raise the wearer\'s main stat. Click a hero for the exact numbers.'),
    h('p', null, h('b', null, 'Damage types. '), 'Weapons and physical skills deal Slash (swords, axes), Pierce (daggers, spears, bows) or Strike (maces, hammers, staves). Each enemy wears Cloth, Hide, Mail, Plate, Bone or Spirit, which takes more or less from each: Strike cracks bone and plate, Pierce finds the gaps in mail, Slash cuts cloth and hide. Spells are Fire, Frost, Lightning, Holy or Arcane, and each family of enemies has its own weaknesses. Click an enemy to see them.'),
    h('p', null, h('b', null, 'Meters. '), Object.values(BU_INFO).join(' '), ' Slashing weapons build Bleed, striking weapons build Stagger, and some skills and poisons build Poison. Meters drain a little each turn, and elites and bosses take longer to fill.'),
    h('p', null, h('b', null, 'Elements. '), 'Fire (Flamekeeper) sets enemies Burning: damage every turn. Frost (Cryomancer) Numbs them: their attacks are at -3 to hit and deal 25% less, and more frost freezes them solid for a turn. Lightning (Stormcaller) builds Stagger, which stuns. Holy heals your most wounded ally for part of the damage, and undead and cultists fear it. Arcane never misses and ignores half of ward.'),
    h('p', null, h('b', null, 'Reactions. '), Object.entries(REACT_INFO).map(([k, v]) => `${k}: ${v}`).join(' ')),
    h('p', null, h('b', null, 'The road. '), 'Every fight is part of the story: each has a name, and many have an objective (stop the messenger, protect the villagers, hold the breach, win quickly). Completing objectives gives leads on the villain\'s lieutenant, or weakens the villain for the final fight. The map shows the goal of the current act and keeps a quest log. Some encounters bring a companion, a fifth fighter who stays for a while.'),
    DEBUFFS.concat(['Guard', 'Taunt', 'Blessed', 'Hidden']).map(s => h('div', { class: 'small' }, h('span', { class: 'chip ' + s + (DEBUFFS.includes(s) ? '' : ' good') }, s), ' ', STATE_INFO[s])),
    h('p', null, h('b', null, 'Going down. '), 'A hero at zero health is down and takes a wound (12% less maximum health) until healed at a camp or merchant. Allies can help them up mid-fight. If everyone is down, the adventure ends.'),
    h('p', null, h('b', null, 'Gear. '), 'A border colour shows rarity: ', RAR.map((n, k) => h('b', { class: 'rn' + k }, n + ' ')), '. Weapons, armour and off-hand items gain a step for each magical property. Set pieces grant bonuses when one hero wears two or three from the same set. Swapped-out gear goes to the shared pack, where any hero who can use it may take it. Merchants also keep a smith who can improve, enchant and reforge what you wear.'),
    h('p', null, h('b', null, 'Campaign. '), 'Five two-act chapters lead to a hidden enemy, with a town between them for trade, smithing, training and the chronicle. Heroes reach level 10, choosing one of two talents at each level from 6. Being wiped out costs half your gold and a wound each (the town healer clears them all), and the chapter can be tried again. After the saga the party is given an estate, Oathkeep, with every town service and rooms to build, and takes contracts from a notice board: higher ranks and harsher conditions pay more, and from rank 3 bosses can drop relics, unique items found nowhere else. Trophies, a codex of everything found and a list of deeds track what the party has done; trophies and completed codex pages grant small permanent bonuses once the trophy hall and library are built.'),
    h('p', null, h('b', null, 'Checks. '), 'Outside combat the best-suited hero rolls a d20 plus the named stat. The odds are shown before you choose.'),
    h('p', null, h('button', { class: 'primary', onclick: closeModal }, 'Close')));
}
$('helpb').onclick = rules;
$('newb').onclick = () => { if (!S) return; modal(h('h2', null, 'Return to the main menu?'), h('p', null, S.screen === 'combat' ? 'The game was saved before this fight; leaving now means fighting it again from the start.' : `Your game is saved in slot ${slot + 1}.`), h('p', { class: 'row' }, h('button', { class: 'primary', onclick: () => { S = null; closeModal(); render(); } }, 'Main menu'), h('button', { onclick: closeModal }, 'Keep playing'))); };
$('fast').onchange = () => {};
render();
