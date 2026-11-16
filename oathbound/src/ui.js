// ---------- UI ----------
const $ = id => document.getElementById(id), SAVE = 'oathbound-v1';
function h(tag, attrs, ...kids) { const e = document.createElement(tag);
  for (const k in attrs || {}) { const v = attrs[k]; if (k === 'class') e.className = v; else if (k.slice(0, 2) === 'on') e[k] = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); }
  for (const c of kids.flat(3)) { if (c == null || c === false || c === '') continue; e.append(c.nodeType ? c : document.createTextNode(c)); } return e; }
let S = null, sel = null, bagOpen = false, timer = null, inspect = null, seats = null;
const store = { get() { try { return JSON.parse(localStorage.getItem(SAVE)); } catch (e) { return null; } }, set(v) { try { v ? localStorage.setItem(SAVE, JSON.stringify(v)) : localStorage.removeItem(SAVE); } catch (e) {} } };
const humansIdx = () => S.party.map((x, i) => x.ctrl === 'human' ? i : -1).filter(i => i >= 0);
const leader = () => { const hs = humansIdx(); return S.party[hs[S.leader % hs.length]]; };
const who = x => x.ctrl === 'human' ? x.player : 'AI';
const speed = () => $('fast').checked ? 120 : 650;
const subName = x => x.sub ? CLASSES[x.cls].subs[x.sub].n : CLASSES[x.cls].n;
function modal(...kids) { const m = $('mbody'); m.replaceChildren(...kids.flat()); $('modal').className = 'show'; }
function closeModal() { $('modal').className = ''; }
const hpBar = (hp, max) => h('div', { class: 'bar' + (hp / max < 0.35 ? ' low' : '') }, h('i', { style: `width:${Math.max(0, Math.min(100, 100 * hp / max))}%` }));

function render() {
  clearTimeout(timer); timer = null;
  const main = $('main'); main.replaceChildren();
  if (!S) { $('hud').replaceChildren(); $('party').replaceChildren(); return renderSetup(main); }
  const lv = S.party[0].level;
  $('hud').replaceChildren(h('span', { class: 'stat' }, S.q.title), h('span', { class: 'stat' }, 'Act ', h('b', null, String(S.pos < 0 ? 1 : S.map[S.pos].act))), h('span', { class: 'stat' }, 'Level ', h('b', null, String(lv)), lv < 5 ? ` (${S.xp}/${XP_AT[lv]} xp)` : ''), h('span', { class: 'stat' }, 'Gold ', h('b', null, String(S.gold))));
  renderParty();
  ({ map: renderMap, combat: renderCombat, event: renderEvent, loot: renderLoot, shop: renderShop, rest: renderRest, levelup: renderLevel, end: renderEnd })[S.screen](main);
  if (S.screen === 'end') store.set(null); else if (S.screen !== 'combat') store.set(S);
}

// ---------- setup ----------
function renderSetup(main) {
  if (!seats) seats = [{ ctrl: 'human', cls: 'warrior', name: 'Brann' }, { ctrl: 'ai', cls: 'rogue', name: 'Sable' }, { ctrl: 'ai', cls: 'mage', name: 'Ilyra' }, { ctrl: 'ai', cls: 'priest', name: 'Osmund' }];
  const saved = store.get();
  const rows = seats.map((s, i) => h('div', { class: 'seat' },
    h('select', { onchange: e => { s.ctrl = e.target.value; render(); } }, ['human', 'ai', 'none'].map(v => h('option', { value: v, selected: s.ctrl === v }, { human: 'Human', ai: 'AI ally', none: 'Empty' }[v]))),
    h('input', { type: 'text', value: s.name, maxlength: 14, disabled: s.ctrl === 'none', oninput: e => { s.name = e.target.value; } }),
    h('select', { disabled: s.ctrl === 'none', onchange: e => { s.cls = e.target.value; render(); } }, Object.keys(CLASSES).map(c => h('option', { value: c, selected: s.cls === c }, CLASSES[c].n)))));
  const used = seats.filter(s => s.ctrl !== 'none'), ok = used.some(s => s.ctrl === 'human');
  main.append(h('div', { class: 'card' }, h('h2', null, 'Gather your party'),
    h('p', null, 'A co-op fantasy adventure for one to four heroes. Each run is a freshly generated three-act quest: a villain, a motive, a twist, and a branching road to the lair. Human players share this screen and take turns; AI allies fill the other seats.'),
    saved && saved.v === 1 ? h('p', null, h('button', { class: 'primary', onclick: () => { S = saved; render(); } }, `Continue: ${saved.q.title}`)) : null,
    h('h3', null, 'Seats'), rows,
    h('div', { class: 'grid3' }, [...new Set(used.map(s => s.cls))].map(c => h('div', { class: 'item small' }, h('b', null, CLASSES[c].n), ' ', CLASSES[c].blurb, h('div', { class: 'dim' }, 'At level 3: ', Object.values(CLASSES[c].subs).map(x => x.n).join(' or '), '.')))),
    h('p', { class: 'dim small' }, 'A full party of four with a Priest is the gentlest start. Smaller parties face fewer and weaker enemies; a lone hero gets one second wind per fight.'),
    h('p', null, h('button', { class: 'primary', disabled: !ok, onclick: begin }, 'Begin the adventure'), ok ? '' : ' At least one seat must be human.')));
}
function begin() { let p = 0; const list = seats.filter(s => s.ctrl !== 'none').map(s => ({ cls: s.cls, ctrl: s.ctrl, name: (s.name || '').trim() || CLASSES[s.cls].n, player: s.ctrl === 'human' ? 'Player ' + (++p) : '' }));
  S = newRun((Date.now() ^ (Math.random() * 1e9)) | 0, list); sel = null; render(); }

// ---------- party sidebar and hero sheet ----------
function renderParty() {
  const inFight = S.screen === 'combat' && S.C;
  $('party').replaceChildren(h('div', { class: 'card' }, h('h3', { style: 'margin-top:0' }, 'Party'),
    S.party.map((x, i) => { const u = inFight ? unit(S.C, 'h' + i) : null, hp = u ? u.hp : x.hp, max = u ? u.max : maxHp(x);
      return h('div', { class: 'hero', onclick: () => sheet(i) }, h('div', { class: 'nm' }, h('span', null, h('b', null, x.name), ' ', h('span', { class: 'dim small' }, subName(x))), h('span', { class: 'small dim' }, who(x))),
        hpBar(hp, max), h('div', { class: 'small dim' }, `${hp}/${max} hp · ${x.row === 'F' ? 'front' : 'back'} row`, x.wounds ? ` · ${x.wounds} wound${x.wounds > 1 ? 's' : ''}` : '')); }),
    h('h3', null, 'Supplies'), S.bag.length ? S.bag.map(b => h('div', { class: 'small', title: CONS[b.id].d }, `${CONS[b.id].n} x${b.qty}`)) : h('div', { class: 'small dim' }, 'Nothing.'),
    h('p', { class: 'small dim' }, 'Click a hero for stats, gear and skills.')));
}
function sheet(i) {
  const x = S.party[i], g = x.gear, free = S.screen !== 'combat', u = heroUnit(x, i);
  const toggle = id => { const eq = x.eq.includes(id) ? x.eq.filter(k => k !== id) : [...x.eq, id]; if (eq.length <= 4) { setEq(S, i, eq); sheet(i); render(); } };
  modal(h('h2', null, `${x.name}, level ${x.level} ${subName(x)}`),
    h('p', { class: 'small' }, STATS.map(s => `${STAT_NAME[s]} ${u.st[s]}`).join(' · '), ` · ${u.arm} armour · ${u.ward} ward`),
    h('h3', null, 'Gear'), [g.w, g.off, g.a, g.t1, g.t2].filter(Boolean).map(it => h('div', { class: 'small' }, h('b', null, it.n), ': ', itemDesc(it))),
    free ? h('p', null, h('button', { onclick: () => { x.row = x.row === 'F' ? 'B' : 'F'; sheet(i); render(); } }, `Start fights in the ${x.row === 'F' ? 'back' : 'front'} row instead`)) : null,
    x.ctrl === 'ai' ? h('p', null, h('label', null, h('input', { type: 'checkbox', checked: !!x.manual, onchange: e => { x.manual = e.target.checked; render(); } }), ' Control this ally myself in combat')) : null,
    h('h3', null, `Skills (${x.eq.length}/4 equipped)`), free ? null : h('p', { class: 'small dim' }, 'Skills can be changed between fights.'),
    known(x).map(id => h('div', { class: 'sk small' }, h('label', null, h('input', { type: 'checkbox', checked: x.eq.includes(id), disabled: !free || (!x.eq.includes(id) && x.eq.length >= 4), onchange: () => toggle(id) }), h('span', null, h('b', null, SK[id].n), ' ', skillDesc(SK[id]))))),
    h('p', null, h('button', { class: 'primary', onclick: closeModal }, 'Close')));
}

// ---------- map ----------
const NODE = { fight: ['⚔', '#7a3b2e', 'Fight'], elite: ['☠', '#8a2d52', 'Elite fight'], boss: ['♛', '#6b3fa0', 'The lair'], event: ['?', '#3d5f7a', 'Encounter'], shop: ['$', '#7a6520', 'Merchant'], rest: ['☾', '#3c6b45', 'Camp'] };
function renderMap(main) {
  const opts = options(S), W = S.layers * 86 + 40, H = 250, NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('width', W); svg.setAttribute('height', H);
  const mk = (tag, a, txt) => { const e = document.createElementNS(NS, tag); for (const k in a) e.setAttribute(k, a[k]); if (txt) e.textContent = txt; return e; };
  const px = n => 40 + n.x * 86, py = n => 30 + n.y * (H - 60);
  let act = 0; for (const n of S.map) if (n.act !== act) { act = n.act; svg.append(mk('text', { x: px(n) - 14, y: 16, fill: '#a39a88', 'font-size': 12 }, 'ACT ' + ['I', 'II', 'III'][act - 1])); }
  for (const n of S.map) for (const t of n.next) { const m = S.map[t]; svg.append(mk('line', { x1: px(n), y1: py(n), x2: px(m), y2: py(m), stroke: n.done && (m.done || t === S.pos || (n.id === S.pos && opts.includes(t))) ? '#d9a441' : '#453d32', 'stroke-width': 2 })); }
  for (const n of S.map) { const d = NODE[n.type], go = opts.includes(n.id), g = mk('g', { class: 'node' + (go ? ' go' : ''), opacity: n.done && n.id !== S.pos ? 0.45 : 1 });
    g.append(mk('title', {}, d[2]), mk('circle', { cx: px(n), cy: py(n), r: n.type === 'boss' ? 21 : 17, fill: d[1], stroke: n.id === S.pos ? '#fff' : '#111', 'stroke-width': n.id === S.pos ? 3 : 1 }), mk('text', { x: px(n), y: py(n) + 6, 'text-anchor': 'middle', fill: '#fff', 'font-size': 17 }, d[0]));
    if (go) g.onclick = () => { travel(S, n.id); sel = null; render(); }; svg.append(g); }
  const box = h('div', { class: 'mapbox' }); box.append(svg);
  main.append(h('div', { class: 'card' }, h('h2', null, S.q.title),
    h('p', null, `${S.q.name}, ${VILLAINS[S.q.vi].title}, ${S.q.motive}. Your road runs through ${S.q.region} to ${S.q.lair}.`),
    box, h('p', { class: 'row small' }, Object.values(NODE).map(d => h('span', null, h('span', { style: `display:inline-block;width:18px;text-align:center;border-radius:9px;background:${d[1]}` }, d[0]), ' ' + d[2]))),
    h('p', null, humansIdx().length > 1 ? h('b', null, `${leader().player} (${leader().name}) chooses the road. `) : '', 'Pick one of the glowing stops.', S.nextMod ? h('span', { class: 'dim' }, ' ' + { ambush: 'You will have the jump on the next enemy.', surprised: 'The next enemy will have the jump on you.', exposed: 'The next enemy starts Exposed.' }[S.nextMod]) : '')));
  const cur = S.pos < 0 ? 0 : px(S.map[S.pos]); box.scrollLeft = Math.max(0, cur - 200);
}

// ---------- combat ----------
const mine = u => { const x = S.party[u.hi]; return u.side === 'H' && (x.ctrl === 'human' || x.manual); };
function unitCard(C, u, targets, onPick) {
  const st = Object.keys(u.states).filter(s => s !== 'Steady' || true), fx = (C.fx || []).filter(f => f.id === u.id), tgt = targets && targets.includes(u.id);
  return h('div', { class: `unit ${u.side}${u.id === C.cur && !C.over ? ' cur' : ''}${tgt ? ' tgt' : ''}${up(u) ? '' : ' down'}${u.boss ? ' boss' : ''}`, onclick: () => { if (tgt) onPick(u.id); else { inspect = u.id; render(); } } },
    h('div', { class: 'un' }, u.name), hpBar(u.hp, u.max), h('div', { class: 'small dim' }, up(u) ? `${u.hp}/${u.max}` : u.side === 'H' ? 'down' : 'dead'),
    h('div', null, st.map(s => h('span', { class: `chip ${s}${DEBUFFS.includes(s) ? '' : ' good'}`, title: STATE_INFO[s] }, s + (u.states[s].t > 1 ? ' ' + u.states[s].t : '')))),
    fx.map(f => h('span', { class: 'pop ' + (f.miss ? 'm' : f.h !== undefined ? 'h' : 'd') }, f.miss ? 'miss' : f.h !== undefined ? '+' + f.h : '-' + f.d + (f.crit ? '!' : ''))));
}
function describeUnit(C, u) {
  if (u.side === 'H') { const x = S.party[u.hi]; return `${u.name}, ${subName(x)}. ${STATS.map(s => STAT_NAME[s] + ' ' + u.st[s]).join(', ')}; ${u.arm} armour, ${u.ward} ward.`; }
  return `${u.name} (${FAM[u.fam].n}). Attack ${u.st.might}, Agility ${u.st.agility}, ${u.arm} armour, ${u.ward} ward${u.ether ? ', takes half damage from physical attacks' : ''}. ${FAM[u.fam].weak} Uses: ${u.skills.map(k => SK[k].n).join(', ')}.`;
}
function renderCombat(main) {
  const C = S.C, cur = unit(C, C.cur), myTurn = !C.over && cur && mine(cur);
  let targets = null, selSk = null;
  if (myTurn && sel) { selSk = sel.k === 'item' ? { ...CONS[sel.id], ty: 'ranged' } : sel.k === 'revive' ? { tg: 'downed' } : SK[sel.id]; targets = targetsFor(C, cur, selSk); }
  const fire = t => { const a = sel.k === 'revive' ? { k: 'revive', t } : { k: sel.k, id: sel.id, t }; sel = null; bagOpen = false; if (act(S, C, a)) render(); else render(); };
  const line = (side, r) => { const us = C.units.filter(u => u.side === side && u.row === r && (side === 'H' || up(u))), rowT = targets && side === 'E' && targets.includes(r);
    return h('div', { class: 'rowline' }, h('div', { class: 'rowlab' + (rowT ? ' tgt' : ''), onclick: rowT ? () => fire(r) : null }, rowT ? 'Hit this row' : (r === 'F' ? 'Front' : 'Back')), us.map(u => unitCard(C, u, targets, fire))); };
  const card = h('div', { class: 'card' }, h('h2', null, C.boss ? `${S.q.name}, ${VILLAINS[S.q.vi].title}` : C.elite ? 'A dangerous foe' : 'Battle', h('span', { class: 'dim small' }, `  round ${C.round}`)),
    h('div', { class: 'side' }, line('E', 'B'), line('E', 'F')), h('div', { class: 'log', id: 'log' }, C.log.slice(-40).map(t => h('div', null, t))), h('div', { class: 'side' }, line('H', 'F'), line('H', 'B')));
  const bar = h('div', { class: 'acts' });
  if (C.over) bar.append(h('p', null, h('b', null, C.over === 'win' ? 'Victory. ' : 'The party has fallen. '), h('button', { class: 'primary', onclick: () => { endCombat(S); sel = null; render(); } }, 'Continue')));
  else if (myTurn) {
    const x = S.party[cur.hi], pickA = a => { sel = a; bagOpen = false; render(); };
    const btn = id => { const sk = SK[id], cd = cur.cds[id], gone = cur.used[id], none = !targetsFor(C, cur, sk).length; return h('button', { class: sel && sel.k === 'skill' && sel.id === id ? 'on' : '', disabled: !!cd || !!gone || none, title: skillDesc(sk), onclick: () => pickA({ k: 'skill', id }) }, sk.n, cd ? h('span', { class: 'cd' }, ` (${cd})`) : gone ? h('span', { class: 'cd' }, ' (used)') : ''); };
    const downed = C.units.some(u => u.side === 'H' && u.down);
    bar.append(h('p', null, h('b', null, `${cur.name}'s turn`), x.ctrl === 'human' && humansIdx().length > 1 ? ` (${x.player})` : '', has(cur, 'Prone') ? h('span', { class: 'dim' }, ' · Prone: half damage this turn') : ''),
      h('div', { class: 'row' }, btn('attack'), cur.skills.map(btn)),
      h('div', { class: 'row', style: 'margin-top:8px' }, h('button', { onclick: () => { sel = null; act(S, C, { k: 'defend' }); render(); } }, 'Defend'), h('button', { onclick: () => { sel = null; act(S, C, { k: 'move' }); render(); } }, `Move to ${cur.row === 'F' ? 'back' : 'front'} row`),
        downed ? h('button', { class: sel && sel.k === 'revive' ? 'on' : '', onclick: () => pickA({ k: 'revive' }) }, 'Help an ally up') : null,
        h('button', { disabled: !S.bag.length, class: bagOpen ? 'on' : '', onclick: () => { bagOpen = !bagOpen; sel = null; render(); } }, 'Supplies')),
      bagOpen ? h('div', { class: 'row', style: 'margin-top:8px' }, S.bag.map(b => h('button', { class: sel && sel.k === 'item' && sel.id === b.id ? 'on' : '', disabled: !targetsFor(C, cur, { ...CONS[b.id], ty: 'ranged' }).length, title: CONS[b.id].d, onclick: () => { sel = { k: 'item', id: b.id }; bagOpen = true; render(); } }, `${CONS[b.id].n} x${b.qty}`))) : null);
    if (sel) { const d = sel.k === 'skill' ? skillDesc(SK[sel.id]) : sel.k === 'item' ? CONS[sel.id].d : 'Spend your turn to get a downed ally back on their feet at 20% health.';
      bar.append(h('p', { class: 'small' }, h('b', null, sel.k === 'skill' ? SK[sel.id].n : sel.k === 'item' ? CONS[sel.id].n : 'Help up'), ': ', d, ' ',
        targets && targets[0] === '-' ? h('button', { class: 'primary', onclick: () => fire('-') }, 'Use') : targets && targets.length ? h('span', { class: 'dim' }, 'Choose a glowing target.') : h('span', { class: 'dim' }, 'No valid target.'))); }
    else bar.append(h('p', { class: 'small dim' }, 'Pick an action, then a glowing target. Hover or select a skill to read it. Click any combatant to inspect it.'));
  } else bar.append(h('p', { class: 'dim' }, cur ? `${cur.name} is acting…` : ''));
  if (inspect) { const u = unit(C, inspect); if (u) bar.append(h('p', { class: 'small', style: 'border-top:1px solid var(--line);padding-top:6px' }, describeUnit(C, u), ' ', Object.keys(u.states).map(s => `${s}: ${STATE_INFO[s]}`).join(' '))); }
  card.append(bar); main.append(card);
  const lg = $('log'); if (lg) lg.scrollTop = 1e6;
  if (!C.over && !myTurn && cur) timer = setTimeout(() => { timer = null; if (!S || S.screen !== 'combat' || S.C !== C || C.over) return; const u = unit(C, C.cur); act(S, C, u.side === 'H' ? aiHero(S, C, u) : aiEnemy(S, C, u)); render(); }, speed());
}

// ---------- events ----------
function giveButtons(it, onPick, extra) {
  if (it.k === 'cons') return h('div', { class: 'row' }, h('button', { class: 'primary', onclick: () => onPick(0) }, 'Take'), extra);
  const list = S.party.map((x, i) => { if (!canUse(x, it)) return null; const old = x.gear[slotOf(x, it)]; return h('button', { onclick: () => onPick(i), title: old ? itemDesc(old) : '' }, `${x.name}`, h('span', { class: 'dim small' }, old ? ` (replaces ${old.n})` : ' (empty slot)')); }).filter(Boolean);
  return h('div', { class: 'row' }, list.length ? list : h('span', { class: 'dim small' }, 'Nobody in the party can use this.'), extra);
}
const itemCard = (it, foot) => h('div', { class: 'item' + (it.sold ? ' sold' : '') }, h('b', null, it.n + (it.k === 'cons' && it.qty > 1 ? ` x${it.qty}` : '')), h('div', { class: 'small' }, itemDesc(it)), foot);
function renderEvent(main) {
  const e = EV[S.ev.id], r = S.ev.result, card = h('div', { class: 'card' }, h('h2', null, fill(S, e.t)), h('p', null, eventText(S, e)));
  if (!r) { if (humansIdx().length > 1) card.append(h('p', { class: 'dim' }, `${leader().player} (${leader().name}) decides.`));
    e.c.forEach((c, i) => { const cost = c.cost ? Math.round(c.cost * (0.7 + 0.3 * S.map[S.pos].act)) : 0; let sub = '';
      if (c.s) { const info = checkInfo(S, c); sub = `${STAT_NAME[c.s]} check: ${S.party[info.hi].name} rolls d20 + ${info.stat} and needs ${info.need}+ on the die (${Math.round(info.odds * 100)}%)`; }
      else if (cost) sub = `Costs ${cost} gold` + (S.gold < cost ? ' (you cannot afford it)' : ''); else if (c.random) sub = 'Anything could happen';
      card.append(h('button', { class: 'choice', disabled: cost > S.gold, onclick: () => { chooseEvent(S, i); render(); } }, fill(S, c.l), sub ? h('small', null, sub) : null)); });
  } else {
    if (r.roll) card.append(h('p', null, h('span', { class: 'dice' }, String(r.roll.r)), `${S.party[r.roll.hi].name} rolls ${r.roll.r} + ${r.roll.stat} ${STAT_NAME[r.roll.s]} = ${r.roll.r + r.roll.stat} against ${r.roll.dc}: `, h('b', null, { ok: 'success', mid: 'partial success', bad: 'failure' }[r.roll.out]), '.'));
    card.append(h('p', null, r.text)); if (r.got.length) card.append(h('p', { class: 'dim' }, r.got.join(' · ') + '.'));
    if (r.items.length) card.append(h('h3', null, 'You found'), itemCard(r.items[0], giveButtons(r.items[0], i => { eventGive(S, i); render(); }, h('button', { onclick: () => { eventGive(S, -1); render(); } }, `Sell it (${r.items[0].price >> 1} gold)`))));
    else card.append(h('p', null, h('button', { class: 'primary', onclick: () => { continueEvent(S); sel = null; render(); } }, r.fight ? 'To arms' : 'Continue')));
  }
  main.append(card);
}

// ---------- loot, shop, rest ----------
function renderLoot(main) {
  main.append(h('div', { class: 'card' }, h('h2', null, 'Spoils'), h('p', null, `The party gains ${S.loot.gold} gold and ${S.loot.xp} experience. Take one of these:`),
    h('div', { class: 'grid3' }, S.loot.items.map((it, k) => itemCard(it, giveButtons(it, i => { takeLoot(S, k, i); render(); })))),
    h('p', null, h('button', { onclick: () => { takeLoot(S, -1); render(); } }, 'Leave them and take 10 gold instead'))));
}
function renderShop(main) {
  const hurt = S.party.some(x => x.wounds || x.hp < maxHp(x));
  main.append(h('div', { class: 'card' }, h('h2', null, 'A travelling merchant'), h('p', null, S.q.flags.helped ? 'Word of your good deeds has reached her: prices are a fifth lower.' : '"Coin first, then questions."', ` You have ${S.gold} gold. Replaced gear is sold back for half its value.`),
    h('div', { class: 'grid3' }, S.shop.items.map((it, k) => itemCard(it, it.sold ? h('div', { class: 'small dim' }, 'Sold') : h('div', null, h('div', { class: 'small' }, `${it.price} gold`), S.gold >= it.price ? giveButtons(it, i => { buy(S, k, i); render(); }) : h('div', { class: 'small dim' }, 'Too expensive'))))),
    h('p', { class: 'row' }, h('button', { disabled: !hurt || S.gold < S.shop.healCost, onclick: () => { buyHeal(S); render(); } }, `Healer: full health and one wound each (${S.shop.healCost} gold)`), h('button', { class: 'primary', onclick: () => { finishNode(S); render(); } }, 'Leave'))));
}
function renderRest(main) {
  const opt = (k, t, d) => h('button', { class: 'choice', onclick: () => { doRest(S, k); render(); } }, t, h('small', null, d));
  main.append(h('div', { class: 'card' }, h('h2', null, 'Camp'), h('p', null, 'A sheltered hollow, dry wood, and nobody on your trail for once.'),
    opt(0, 'Rest', 'Everyone recovers 60% health and one wound.'), opt(1, 'Forage', 'Recover 25% health and gather a healing potion and one other supply.'), opt(2, 'Train', 'Recover 25% health and gain 8 experience.')));
}

// ---------- level up, end ----------
function renderLevel(main) {
  const L = S.lvl; L.need.forEach((n, i) => { if (n && S.party[i].ctrl === 'ai') pickSub(S, i, aiSub(S, i)); });
  const card = h('div', { class: 'card' }, h('h2', null, `Level ${L.level}`), h('p', null, 'The whole party grows stronger: more health, higher stats, and new skills.'));
  S.party.forEach((x, i) => { const c = CLASSES[x.cls];
    if (L.need[i]) card.append(h('h3', null, `${x.name} (${x.player}): choose a path`), h('div', { class: 'grid3' }, Object.entries(c.subs).map(([k, sub]) => h('div', { class: 'item' }, h('b', null, sub.n), h('div', { class: 'small' }, sub.blurb), sub.sk.map((id, n) => h('div', { class: 'small dim' }, `Level ${n + 3}: ${SK[id].n}. ${skillDesc(SK[id])}`)), h('p', null, h('button', { class: 'primary', onclick: () => { pickSub(S, i, k); render(); } }, `Become a ${sub.n}`))))));
    else card.append(h('div', { class: 'item small' }, h('b', null, x.name), L.level === 3 ? ` is now a ${subName(x)}. ` : ' ', L.gained[i].length ? L.gained[i].map(id => h('div', null, 'New skill: ', h('b', null, SK[id].n), '. ', skillDesc(SK[id]), x.eq.includes(id) ? '' : ' (Not equipped: open the hero sheet to swap it in.)')) : 'Stronger, but no new skill this level.')); });
  card.append(h('p', null, h('button', { class: 'primary', disabled: L.need.some(Boolean), onclick: () => { closeLevel(S); render(); } }, 'Continue')));
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
    h('p', null, h('b', null, 'The road. '), 'Each adventure has three acts. Choose a route across the map: fights, encounters, merchants and camps. Act three ends at the villain\'s lair.'),
    h('p', null, h('b', null, 'Rows. '), 'Melee attacks can only reach the enemy front row while anyone stands in it, and can only be made from your own front row (spears reach from the back). Ranged attacks and spells reach anyone.'),
    h('p', null, h('b', null, 'Attacks. '), 'Roll a d20 plus your attack stat against 9 + the target\'s Agility (+ shield). A 20 is a critical hit. Armour is subtracted from physical damage, ward from spell damage.'),
    h('p', null, h('b', null, 'Combos. '), 'Many skills apply a state, and other skills deal far more against a target in that state. Build the party so one hero sets up what another cashes in.'),
    DEBUFFS.concat(['Guard', 'Taunt', 'Blessed', 'Hidden']).map(s => h('div', { class: 'small' }, h('span', { class: 'chip ' + s + (DEBUFFS.includes(s) ? '' : ' good') }, s), ' ', STATE_INFO[s])),
    h('p', null, h('b', null, 'Going down. '), 'A hero at zero health is down and takes a wound (12% less maximum health) until healed at a camp or merchant. Allies can help them up mid-fight. If everyone is down, the adventure ends.'),
    h('p', null, h('b', null, 'Checks. '), 'Outside combat the best-suited hero rolls a d20 plus the named stat. The odds are shown before you choose.'),
    h('p', null, h('button', { class: 'primary', onclick: closeModal }, 'Close')));
}
$('helpb').onclick = rules;
$('newb').onclick = () => { if (!S) return; modal(h('h2', null, 'Abandon this adventure?'), h('p', null, 'Your current run will be lost.'), h('p', { class: 'row' }, h('button', { class: 'primary', onclick: () => { store.set(null); S = null; closeModal(); render(); } }, 'Abandon it'), h('button', { onclick: closeModal }, 'Keep playing'))); };
$('fast').onchange = () => {};
render();
