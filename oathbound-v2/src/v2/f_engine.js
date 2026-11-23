// ---------- combat ----------
// No rounds: every unit has a place on a timeline (u.next, in ticks) and the lowest acts next. Acting pushes you back by
// the action's weight (Quick 70, Normal 100, Heavy 140) x 10 / Speed, where Speed = 8 + Agility.
const has = (u, s) => !!u.states[s];
const up = u => u.hp > 0 && !u.down;
const living = (C, side) => C.units.filter(u => u.side === side && up(u));
const frontOf = (C, side) => living(C, side).filter(u => u.row === 'F');
const other = side => side === 'H' ? 'E' : 'H';
const unit = (C, id) => C.units.find(u => u.id === id);
const say = (C, t) => { C.log.push(t); if (C.log.length > 200) C.log.shift(); };
const helpless = t => has(t, 'Stunned') || has(t, 'Frozen');
const WEIGHT = { q: 70, n: 100, h: 140 };
const RES = { warrior: ['Rage', 0], rogue: ['Combo', 0], mage: ['Focus', 2], priest: ['Faith', 1] };
const speedOf = u => Math.max(3, (8 + u.st.agility + (u.fx.init || 0) / 2) * (has(u, 'Hasted') ? 1.3 : 1) * (has(u, 'Slowed') ? 0.7 : 1) * (has(u, 'Enraged') ? 1.3 : 1));
const delayOf = (u, wt) => Math.round(WEIGHT[wt || 'n'] * 10 / speedOf(u));
const stackPow = t => (k) => (t.spow && t.spow[k]) || 1;
// fill in what every combatant needs on the timeline
function prep(S, C, u) {
  u.stacks = u.stacks || {}; u.spow = u.spow || {}; u.added = {}; u.turns = 0;
  const agiEva = Math.max(0, 4 * (u.st.agility - 4));
  u.eva = u.npc ? 0 : u.side === 'H' ? Math.min(25, Math.min(20, agiEva) + 3 * (u.defb || 0)) : Math.min(20, agiEva);
  const r = RES[u.cls]; u.resMax = 5; u.res = r ? Math.min(5, r[1] + (u.st.mind >= 3 ? 1 : 0) + (u.st.mind >= 6 ? 1 : 0) + (u.fx.cdr || 0)) : 0;
  return u;
}
const resName = u => RES[u.cls] ? RES[u.cls][0] : 'Points';
const gainRes = (u, n) => { if (u.resMax && n > 0) u.res = Math.min(u.resMax, (u.res || 0) + n); };
// put stacks on a target; Frost at 4 freezes it
function addStack(S, C, t, k, n, src) {
  if (!up(t) || !n) return 0; if ((t.bres && t.bres[k] === 0) || (t.fx.immune || []).includes(k)) return 0;
  let got = 0; for (let i = 0; i < n; i++) { if (t.side === 'H' && src && src.side !== 'H' && C.rng() < t.st.spirit * 0.05) continue; got++; }
  if (!got) { if (t.side === 'H') say(C, `${t.name} shrugs off the ${STACK_NAME[k]}.`); return 0; }
  t.stacks[k] = Math.min(5, (t.stacks[k] || 0) + got); t.added[k] = true; t.spow[k] = Math.max(t.spow[k] || 0, 1 + Math.floor((src ? src.lvl : 1) / 2));
  if (k === 'frost' && t.stacks.frost >= 4 && !has(t, 'Frozen')) freeze(C, t, 'Frozen');
  return got;
}
function freeze(C, t, s) {
  if (has(t, 'Steady') || helpless(t)) return false; t.states[s] = { t: 1 }; t.next += s === 'Frozen' ? 40 : 25;
  say(C, s === 'Frozen' ? `${t.name} is frozen solid.` : `${t.name} is Stunned.`); C.fx.push({ id: t.id, tag: s }); return true;
}
function addState(C, t, s, turns, src) {
  if (s === 'Stunned' || s === 'Frozen') return freeze(C, t, s);
  t.states[s] = { t: turns, fresh: C.cur === t.id }; return true;
}
function kindOf(att, sk) { if (sk.el) return { el: sk.el }; if (sk.ty === 'spell') return { el: 'arcane' }; if (sk.flat !== undefined) return {}; return { phys: sk.dt || (att.w && att.w.phys) || 'slash' }; }
function skillType(u, sk) { return sk.wpn ? (u.w.ranged ? 'ranged' : 'melee') : sk.ty; }
const atkStat = (u, sk) => sk.el === 'holy' ? u.st.spirit : sk.ty === 'spell' ? u.st.mind : u.side === 'H' && u.w.fin ? Math.max(u.st.agility, sk.ty === 'ranged' ? 0 : u.st.might) : sk.ty === 'ranged' ? (u.w.xbow ? Math.max(u.st.might, u.st.agility) : u.st.agility) : u.st.might;
const dieOf = (att, sk) => skillType(att, sk) === 'spell' ? att.w.sp : att.w.die;
function reactionOf(att, sk, t) {
  if (t.side !== 'E' || sk.flat !== undefined && !sk.el) return null; const kd = kindOf(att, sk);
  if (has(t, 'Frozen') && (kd.el === 'lightning' || kd.phys === 'strike')) return 'Shatter';
  if (kd.el === 'fire' && t.stacks.frost) return 'Melt';
  if (kd.el === 'lightning' && t.stacks.burn) return 'Overload';
  return null;
}
const payOk = (sk, att, t) => !!(sk.pay && sk.pay.s.some(s => s === 'low' ? t.hp / t.max < 0.3 : s === 'hidden' ? has(att, 'Hidden') : s === 'helpless' ? helpless(t) : has(t, s)));
const wardOf = t => t.ward + (has(t, 'FrostArmour') ? 3 : 0) + (has(t, 'Sanctuary') ? 5 : 0);
// damage for a given roll; pure, so the AI and the preview can use it. pts = resource points a finisher would spend.
function calc(att, sk, t, roll, crit, pts) {
  const ty = skillType(att, sk), kd = kindOf(att, sk), rx = reactionOf(att, sk, t), tags = [], flat = sk.flat !== undefined;
  let base = flat ? sk.flat + 2 * att.lvl : roll + (att.w.bonus || 0) + (att.fx.dmg || 0) + (att.fx.hit || 0) + atkStat(att, { ...sk, ty });
  let m = flat ? 1 : sk.m; const mul = (v, tag) => { m *= v; if (tag) tags.push(`${tag} x${(+v.toFixed(2))}`); };
  if (sk.fin) mul(1 + sk.fin * pts, `${pts} point${pts === 1 ? '' : 's'}`);
  if (sk.rfin && t.stacks.poison) mul(1 + 0.25 * t.stacks.poison, `${t.stacks.poison} Poison`);
  if ((sk.fin || sk.cash) && att.fx.pay) mul(1 + att.fx.pay, 'gear');
  if (payOk(sk, att, t)) mul(sk.pay.m, sk.pay.s.includes('low') ? 'wounded' : has(att, 'Hidden') ? 'from Hidden' : 'helpless');
  if (sk.cash && t.stacks[sk.cash.k]) mul(1 + sk.cash.per * t.stacks[sk.cash.k], `${t.stacks[sk.cash.k]} ${STACK_NAME[sk.cash.k]}`);
  if (sk.cash && sk.cash.frozen && has(t, 'Frozen')) mul(sk.cash.frozen, 'Frozen');
  if (kd.phys && t.ar && ARMT[t.ar][kd.phys] !== 1) mul(ARMT[t.ar][kd.phys], `${DT_NAME[kd.phys]} vs ${AR_NAME[t.ar].split(' ')[0].toLowerCase()}`);
  if (kd.el && t.aff && t.aff[kd.el] && t.aff[kd.el] !== 1) mul(t.aff[kd.el], EL_NAME[kd.el]);
  if (rx === 'Melt') mul(1 + 0.4 * t.stacks.frost, 'Melt'); if (rx === 'Shatter') mul(2, 'Shatter');
  if (t.stacks.sunder) mul(1 + 0.1 * t.stacks.sunder, `${t.stacks.sunder} Sunder`);
  if (has(att, 'Blessed') && !flat) mul(1.4, 'Blessed');
  if (att.stacks && att.stacks.frost) mul(1 - 0.06 * att.stacks.frost, 'your Frost');
  if (has(att, 'Enraged')) mul(1.2, 'enraged');
  if (has(t, 'Reckless')) mul(1.2, 'reckless');
  if (att.fx.lowhp && att.hp / att.max < 0.5) mul(1 + att.fx.lowhp); if (att.fx.exec && t.hp / t.max < 0.3) mul(1 + att.fx.exec); if (att.fx.aoe && sk.tg !== 'one') mul(1 + att.fx.aoe);
  for (const [vs, v] of att.fx.vs || []) if (t.stacks[vs] || has(t, vs)) mul(1 + v, 'gear vs ' + (STACK_NAME[vs] || vs));
  if (crit && !flat) mul(1.5 + (att.fx.crit || 0) * 0.2, 'critical');
  const armour = flat ? 0 : Math.max(0, (kd.phys ? t.arm : kd.el === 'arcane' ? Math.floor(wardOf(t) / 2) : wardOf(t)) - (att.fx.pen || 0)), red = Math.min(0.5, 0.06 * armour);
  if (red) tags.push(`-${Math.round(red * 100)}% ${kd.phys ? 'armour' : 'ward'}`);
  let d = Math.max(1, Math.round(base * m * (1 - red)));
  if (has(t, 'Guard')) { d = Math.max(1, Math.round(d * 0.7)); tags.push('Guard -30%'); }
  if ((has(t, 'Hidden') || t.npc) && (sk.tg === 'row' || sk.tg === 'all')) { d = Math.max(1, Math.round(d / 2)); tags.push('half'); }
  if (t.iron && (t.stacks.sunder || 0) < 3) { d = Math.max(1, Math.round(d / 2)); tags.push('shield up: half'); }
  if (t.fx.dr) d = Math.max(1, Math.round(d * (1 - t.fx.dr)));
  if (t.stacks.shock && !flat) { const s = t.stacks.shock * stackPow(t)('shock'); d += s; tags.push(`+${s} Shock`); }
  if (has(t, 'Shielded') && t.boss) { d = 0; tags.push('shielded'); }
  return { d, rx, tags, crit: crit && !flat };
}
function preview(C, att, sk, t) {
  const pts = sk.cost === 'all' ? att.res || 0 : 0, crit = !!(has(att, 'Hidden') || helpless(t)), lo = calc(att, sk, t, 1, crit, pts), hi = calc(att, sk, t, sk.flat !== undefined ? 1 : dieOf(att, sk), crit, pts);
  const tags = lo.tags.slice(); if (lo.rx) tags.unshift(lo.rx + '!');
  for (const [k, v] of Object.entries(sk.st || {})) tags.push((t.bres && t.bres[k] === 0) ? `immune to ${STACK_NAME[k]}` : `+${v + (att.fx.dur || 0)} ${STACK_NAME[k]}`);
  const p = evadable(att, sk, t) ? 1 - t.eva / 100 : 1;
  return { p, g: 0, lo: lo.d, hi: hi.d, tags, combo: !!(lo.rx || sk.cash || payOk(sk, att, t)) };
}
const evadable = (att, sk, t) => t.eva > 0 && !helpless(t) && sk.flat === undefined && (skillType(att, sk) === 'melee' || skillType(att, sk) === 'ranged') && sk.tg === 'one';
// who a skill may be pointed at: unit ids, row letters, or a single placeholder for skills without a choice
function targetsFor(C, att, sk) {
  const ty = skillType(att, sk), foes = living(C, other(att.side)), mates = living(C, att.side);
  if (sk.tg === 'self' || sk.tg === 'allies') return ['-'];
  if (sk.tg === 'ally') return mates.filter(u => !sk.cover || u !== att).map(u => u.id);
  if (sk.tg === 'downed') return C.units.filter(u => u.side === att.side && u.down && !u.npc).map(u => u.id);
  if (!foes.length) return [];
  const melee = ty === 'melee';
  if (melee && att.row === 'B' && !att.w.reach && frontOf(C, att.side).length) return [];
  const reach = u => !melee || !has(u, 'Flying') || (u.stacks.frost || 0) >= 3 || (u.stacks.shock || 0) >= 3;
  const ff = frontOf(C, other(att.side)).filter(reach), pool = (melee && ff.length ? ff : foes).filter(reach);
  if (!pool.length) return [];
  if (sk.tg === 'all') return ['-'];
  if (sk.tg === 'row') return melee ? [pool[0].row] : ['F', 'B'].filter(r => foes.some(u => u.row === r));
  let c = pool.filter(u => !has(u, 'Hidden')); if (!c.length) c = foes.filter(u => reach(u) && !has(u, 'Hidden') && (!melee || att.w.reach || att.row === 'F')); if (!c.length) c = pool;
  if (att.side === 'E' && att.turns < 1) { const nn = c.filter(u => !u.npc); if (nn.length) c = nn; }
  const tn = c.filter(u => has(u, 'Taunt')); return (tn.length ? tn : c).map(u => u.id);
}
function resolveTargets(C, att, sk, t) {
  const foes = living(C, other(att.side)), mates = living(C, att.side), melee = skillType(att, sk) === 'melee';
  if (sk.tg === 'self') return [att]; if (sk.tg === 'allies') return mates;
  if (sk.tg === 'all') { const ok = foes.filter(u => !melee || !has(u, 'Flying') || (u.stacks.frost || 0) >= 3 || (u.stacks.shock || 0) >= 3); return melee && !att.w.reach && ok.some(u => u.row === 'F') ? ok.filter(u => u.row === 'F') : ok; }
  if (sk.tg === 'row') return foes.filter(u => u.row === t); const u = unit(C, t); return u ? [u] : [];
}
function hurt(S, C, t, d, src) {
  if (d <= 0) return; const before = t.hp / t.max; t.hp -= d;
  if (t.side === 'H' && t.cls === 'warrior' && up(t)) gainRes(t, 1);
  if (t.side === 'H' && !t.npc && before >= 0.5 && t.hp / t.max < 0.5) for (const p of living(C, 'H')) if (p.cls === 'priest') gainRes(p, 1);
  if (t.hp <= 0) { t.hp = 0; t.states = {}; t.stacks = {};
    if (t.side === 'H' && !t.npc && C.n === 1 && !C.grit) { C.grit = true; t.hp = Math.round(t.max * 0.3); say(C, `${t.name} staggers, grits their teeth and fights on. (A lone hero gets one second wind per fight.)`); }
    else if (t.side === 'H' && t.fx.phoenix && !t.used.phoenix) { t.used.phoenix = true; t.hp = Math.round(t.max * 0.25); say(C, `${t.name}'s Phoenix Feather burns away, and ${t.name} fights on.`); }
    else if (t.side === 'H') { t.down = true; if (t.npc || t.comp) say(C, `${t.name} falls!`); else { const h = S.party[t.hi]; if (h.wounds < 3) h.wounds++; say(C, `${t.name} is down!`); S.stats.downs++; } }
    else if (EN[t.key] && EN[t.key].next) { const nu = prep(S, C, enemyUnit(S, EN[t.key].next, C.lv + 0.5, 0, C.n)); Object.assign(t, nu, { id: t.id, row: t.row, name: S.q.name + ', Unbound', next: t.next }); say(C, `${S.q.name} falls, and rises again, changed. The true fight begins.`); }
    else { say(C, `${t.name} is destroyed.`); S.stats.kills++;
      for (const b of living(C, 'E')) if (b.boss && has(b, 'Shielded') && !living(C, 'E').some(u => u !== b && ['acolyte', 'zealot'].includes(u.key))) { delete b.states.Shielded; say(C, `With her followers fallen, ${b.name}'s shield breaks.`); } } }
  else if (t.boss) bossPhase(S, C, t);
}
// every heal also cleanses Bleed, Burn, Poison and one bad state
function heal(C, t, v) {
  if (C.frail && t.side === 'H') v /= 2; if (t.side === 'H') v *= 1 + t.st.spirit * K.spiritHeal; if (t.stacks && t.stacks.poison) v *= Math.max(0, 1 - 0.2 * t.stacks.poison);
  const a = Math.min(t.max - t.hp, Math.max(0, Math.round(v))); t.hp += a; return a;
}
function cleanse(C, t) { let n = 0; for (const k of ['bleed', 'burn', 'poison']) if (t.stacks[k]) { n += t.stacks[k]; delete t.stacks[k]; } const bad = DEBUFFS.find(s => has(t, s)); if (bad) { delete t.states[bad]; n++; } return n; }
function react(S, C, att, t, rx) {
  S.stats.combos++;
  if (rx === 'Melt') { delete t.stacks.frost; say(C, 'Melt: fire and frost tear at each other.'); }
  if (rx === 'Shatter') { delete t.states.Frozen; delete t.stacks.frost; say(C, `Shatter: the ice on ${t.name} breaks apart.`); }
  if (rx === 'Overload') { const s = t.stacks.burn, splash = s * (2 + stackPow(t)('burn')); delete t.stacks.burn; say(C, `Overload: the flames on ${t.name} explode through its row for ${splash}.`);
    for (const o of living(C, t.side).filter(u => u !== t && u.row === t.row)) { C.fx.push({ id: o.id, d: splash }); hurt(S, C, o, splash, att); } }
}
function strike(S, C, att, sk, t0, o) {
  let t = t0; const cov = t.states.Covered && unit(C, t.states.Covered.by); if (cov && up(cov) && cov !== att) { say(C, `${cov.name} steps in front of ${t.name}.`); t = cov; }
  if (evadable(att, sk, t) && C.rng() * 100 < t.eva) { say(C, `${att.name} uses ${sk.n} on ${t.name}: dodged.`); C.fx.push({ id: t.id, miss: 1 }); return 0; }
  const ty = skillType(att, sk), crit = !!(o.crit || helpless(t)), roll = die(S, dieOf(att, sk));
  let { d, rx } = calc(att, sk, t, roll, crit, o.pts || 0); if (o.scale) d = Math.max(1, Math.round(d * o.scale));
  say(C, `${att.name} uses ${sk.n} on ${t.name}${crit && sk.flat === undefined ? ' (critical)' : ''}: ${d} damage.`);
  C.fx.push({ id: t.id, d, crit, tag: rx || '' });
  if (sk.cash && t.stacks[sk.cash.k]) { S.stats.combos++; delete t.stacks[sk.cash.k]; } if (sk.cash && sk.cash.frozen && has(t, 'Frozen')) delete t.states.Frozen;
  if (payOk(sk, att, t)) S.stats.combos++;
  hurt(S, C, t, d, att); if (rx) react(S, C, att, t, rx);
  if (!up(t) && up(att) && att.fx.killHeal) heal(C, att, att.max * att.fx.killHeal);
  if (up(t)) {
    for (const [k, v] of Object.entries(sk.st || {})) addStack(S, C, t, k, v + (att.side === 'H' ? att.fx.dur || 0 : 0), att);
    if (sk.flat === undefined && kindOf(att, sk).phys && (!sk.dt || sk.dt === att.w.phys)) for (const [k, ch] of Object.entries(att.w.stk || {})) if (C.rng() < ch) addStack(S, C, t, k, 1, att);
    if (sk.flat === undefined) { for (const [k, v] of Object.entries(att.fx.bu || {})) if (C.rng() < Math.min(1, v / 40)) addStack(S, C, t, k, 1, att);
      for (const [k, ch, only] of att.fx.procs || []) if ((!only || ty === only) && C.rng() < ch) addStack(S, C, t, k, 1, att); }
    for (const [s, turns, ch] of sk.ap || []) if (up(t) && C.rng() < (ch === undefined ? 1 : ch) && addState(C, t, s, turns, att) && s !== 'Stunned') say(C, `${t.name} is ${s}.`);
    const push = (sk.push || 0) + (sk.pushPer || 0) * (o.pts || 0); if (push && up(t)) { t.next += push; say(C, `${t.name} is knocked ${push} ticks back.`); }
    if (att.boss && att.burnHits) addStack(S, C, t, 'burn', 1, att); if (att.boss && att.sunderHits) addStack(S, C, t, 'sunder', 1, att); }
  if (ty === 'melee' && up(att)) { if (t.fx.thorns) { say(C, `${att.name} takes ${t.fx.thorns} from thorns.`); hurt(S, C, att, t.fx.thorns); } if (has(t, 'FrostArmour')) addStack(S, C, att, 'frost', 1, t); }
  return d;
}
function useSkill(S, C, att, sk, tspec) {
  const pts = sk.cost === 'all' ? att.res || 0 : 0; if (typeof sk.cost === 'number') att.res -= sk.cost; if (sk.cost === 'all') att.res = 0;
  let ts = resolveTargets(C, att, sk, tspec); const hidden = has(att, 'Hidden'); let total = 0;
  if (sk.special === 'chain' && ts[0]) ts = ts.concat(shuffle(S, living(C, other(att.side)).filter(u => u !== ts[0])).slice(0, 2));
  if (sk.special === 'missiles') { const fs = living(C, other(att.side)); ts = fs.length ? [0, 1, 2].map(() => pick(S, fs)) : []; }
  if (sk.m || sk.flat !== undefined) { if (hidden && sk.m) delete att.states.Hidden;
    for (const t of ts) if (up(t)) {
      const stacksBefore = t.stacks.burn || 0, bleed = t.stacks.bleed || 0, shock = t.stacks.shock || 0;
      total += strike(S, C, att, sk, t, { crit: hidden, pts });
      if (sk.special === 'evis' && up(t) && bleed && t.stacks.bleed) { const s = t.stacks.bleed, burst = stackPow(t)('bleed') * s * (s + 1); delete t.stacks.bleed; say(C, `${t.name}'s wounds tear open for ${burst}.`); C.fx.push({ id: t.id, d: burst, tag: 'Bleed' }); hurt(S, C, t, burst, att); total += burst; }
      if (sk.special === 'garrote' && up(t) && pts) { addStack(S, C, t, 'bleed', pts, att); addStack(S, C, t, 'poison', pts, att); }
      if (sk.special === 'thunder' && shock) { delete t.stacks.shock; const per = 3 + att.lvl, hit = shock * per; say(C, `Thunderclap: ${shock} Shock detonates for ${hit}.`);
        for (const o of living(C, t.side).filter(u => u.row === t.row)) { C.fx.push({ id: o.id, d: hit, tag: 'Thunder' }); hurt(S, C, o, hit, att); total += hit; }
        if (shock >= 4 && up(t)) freeze(C, t, 'Stunned'); }
      if (sk.special === 'holyfire' && stacksBefore) { const v = stacksBefore * (3 + Math.floor(att.lvl / 2)); for (const m of living(C, att.side)) { const a = heal(C, m, v); if (a) C.fx.push({ id: m.id, h: a }); } say(C, `The holy fire mends the party for ${v} each.`); }
    }
    if (sk.id === 'attack' && att.w.splash && ts[0]) { const o = frontOf(C, other(att.side)).find(u => u !== ts[0] && u.row === ts[0].row); if (o) total += strike(S, C, att, sk, o, { scale: 0.5 }); }
    if (total && (sk.el === 'holy' || sk.holyHeal)) { const w = living(C, att.side).sort((a, b) => a.hp / a.max - b.hp / b.max)[0]; if (w && w.hp < w.max) { const a = heal(C, w, total * 0.2); if (a) say(C, `Holy light mends ${w.name} for ${a}.`); } }
    if (total && up(att)) { if (sk.leech) heal(C, att, total * sk.leech); if (att.fx.leech) heal(C, att, total * att.fx.leech); }
    if (total && att.cls === 'warrior') gainRes(att, 1);
    delete att.states.Blessed;
  } else if (sk.ap && !sk.heal) for (const t of ts) for (const [s, turns, ch] of sk.ap) if (C.rng() < (ch === undefined ? 1 : ch) && addState(C, t, s, turns, att)) say(C, `${t.name} is ${s}.`);
  if (sk.heal || sk.flatHeal || sk.healP) for (const t of ts) { if (!up(t)) continue; const v = sk.healP ? t.max * sk.healP : sk.flatHeal ? sk.flatHeal + 4 * att.lvl : (die(S, att.w.sp) + att.st.spirit * 1.5) * sk.heal * (1 + (att.fx.healm || 0));
    const c = t.side === 'H' ? cleanse(C, t) : 0, a = heal(C, t, v); say(C, `${att.name} uses ${sk.n}: ${t.name} regains ${a}${c ? ' and is cleansed' : ''}.`); C.fx.push({ id: t.id, h: a }); }
  if (sk.cover) for (const t of ts) { t.states.Covered = { t: 99, by: att.id }; say(C, `${att.name} guards ${t.name}.`); }
  if (sk.buff) { for (const t of ts) for (const [s, turns] of sk.buff) addState(C, t, s, turns, att); if (!sk.heal) say(C, `${att.name} uses ${sk.n}.`); }
  if (sk.selfAp && up(att)) addState(C, att, sk.selfAp[0], sk.selfAp[1], att);
  if (sk.selfSt && up(att)) for (const [k, v] of Object.entries(sk.selfSt)) addStack(S, C, att, k, v, att);
  if (sk.reviveP) for (const t of ts) if (t.down) { t.down = false; t.hp = Math.max(1, Math.round(t.max * sk.reviveP)); t.next = C.time + delayOf(t, 'n'); say(C, `${att.name} revives ${t.name}.`); }
  if (sk.summon) { let made = 0; for (let k = 0; k < sk.k; k++) { if (living(C, 'E').length >= 6) break; const u = prep(S, C, enemyUnit(S, sk.summon, C.lv, C.nextId++, C.n)); if (living(C, 'E').filter(x => x.row === u.row).length >= 3) u.row = u.row === 'F' ? 'B' : 'F'; u.next = C.time + delayOf(u, 'n'); C.units.push(u); made++; }
    say(C, made ? `${att.name} uses ${sk.n}: ${made} ${EN[sk.summon].n}${made > 1 ? 's' : ''} join the fight.` : `${att.name} calls for help, but none comes.`); }
  if (sk.gain && up(att)) gainRes(att, sk.gain);
}
function usable(C, u, id) { const sk = SK[id]; if (u.cds[id] || u.used[id] || sk.ty === 'passive') return false; if (sk.cost === 'all') return (u.res || 0) >= 1; if (typeof sk.cost === 'number') return (u.res || 0) >= sk.cost; return true; }
function tick(u) { for (const s of Object.keys(u.states)) { const st = u.states[s]; if (st.fresh) st.fresh = false; else if (--st.t <= 0) delete u.states[s]; } for (const k of Object.keys(u.cds)) if (--u.cds[k] <= 0) delete u.cds[k]; }
// end of a unit's turn: damage over time, unfed stacks fade, states count down, and it moves down the timeline
function finishTurn(S, C, u, wt) {
  for (const k of ['bleed', 'burn', 'poison']) if (u.stacks[k] && up(u)) { const d = Math.max(1, Math.round(u.stacks[k] * stackPow(u)(k) * (k === 'burn' && u.aff && u.aff.fire ? u.aff.fire : 1))); say(C, `${u.name} ${k === 'burn' ? 'burns' : k === 'bleed' ? 'bleeds' : 'suffers poison'} for ${d}.`); C.fx.push({ id: u.id, d, tag: STACK_NAME[k] }); hurt(S, C, u, d); }
  for (const k of STACKS) if (u.stacks[k] && k !== 'poison' && !u.added[k]) { if (--u.stacks[k] <= 0) delete u.stacks[k]; }
  u.added = {}; tick(u); u.turns++;
  const stat = u.side === 'E' && u.stacks.shock && C.units.some(h => h.side === 'H' && up(h) && h.fx.staticf) ? 5 * u.stacks.shock : 0;
  u.next = C.time + delayOf(u, wt) + stat;
}
function endTurn(S, C, u, wt) { finishTurn(S, C, u, wt); checkOver(S, C); if (!C.over) nextUp(S, C); }
function checkOver(S, C) { if (!living(C, 'E').length) C.over = 'win'; else if (!living(C, 'H').filter(u => !u.npc).length) C.over = 'lose'; else if (C.obj && C.obj.k === 'hold' && C.round > C.obj.rounds) { C.over = 'win'; for (const u of living(C, 'E')) u.hp = 0; } }
// the next unit to act: lowest place on the timeline, heroes first on ties
function nextOf(C) { let best = null; for (const u of C.units) if (up(u) && (!best || u.next < best.next || (u.next === best.next && u.side === 'H' && best.side !== 'H'))) best = u; return best; }
function nextUp(S, C) {
  for (let guard = 0; guard < 500 && !C.over; guard++) {
    const u = nextOf(C); if (!u) { checkOver(S, C); return; }
    C.time = Math.max(C.time, u.next); const r = Math.floor(C.time / 100) + 1; while (C.round < r) { C.round++; objRound(S, C); checkOver(S, C); } if (C.over) return;
    if (!up(u)) continue; C.cur = u.id;
    for (const x of C.units) if (x.states.Covered && x.states.Covered.by === u.id) delete x.states.Covered;
    if (u.fx.regen) heal(C, u, u.fx.regen);
    if (u.cls === 'mage') gainRes(u, 1);
    if (u.drainAll) { let tot = 0; for (const h of living(C, 'H')) { const d = 2 + Math.floor(u.lvl / 2); hurt(S, C, h, d); tot += d; } heal(C, u, tot * 0.5); say(C, `${u.name} drains the party.`); }
    if (u.burnAll) for (const h of living(C, 'H')) addStack(S, C, h, 'burn', 1, u);
    checkOver(S, C); if (C.over) return;
    if (helpless(u)) { const fr = has(u, 'Frozen'); say(C, `${u.name} is ${fr ? 'frozen solid' : 'stunned'} and loses the turn.`); delete u.states.Stunned; delete u.states.Frozen; if (fr && u.stacks.frost) u.stacks.frost = 1; u.added.frost = true;
      finishTurn(S, C, u, 'n'); u.states.Steady = { t: 1 }; checkOver(S, C); continue; }
    return;
  }
}
// the next n turns as they stand (everyone assumed to take Normal actions), for the timeline strip
function projectTurns(C, n, curWt) {
  const nx = {}; for (const u of C.units) if (up(u)) nx[u.id] = u.next; const out = []; const cur = unit(C, C.cur);
  if (cur && up(cur) && !C.over) { out.push({ id: cur.id, at: C.time, now: true }); nx[cur.id] = C.time + delayOf(cur, curWt || 'n'); }
  const skip = {}; for (const u of C.units) if (up(u) && helpless(u) && u !== cur) skip[u.id] = true;
  while (out.length < n) { let id = null; for (const k of Object.keys(nx)) if (id === null || nx[k] < nx[id] || (nx[k] === nx[id] && k[0] === 'h' && id[0] !== 'h')) id = k; if (id === null) break;
    const u = unit(C, id); out.push({ id, at: nx[id], skip: !!skip[id], wind: !!(u.wind && !out.some(e => e.id === id && !e.now)) }); skip[id] = false; nx[id] += delayOf(u, 'n'); }
  return out;
}
// action: { k: 'skill', id, t } | { k: 'item', id, t } | { k: 'move' } | { k: 'defend' } | { k: 'revive', t } | { k: 'wind', id, t }
function act(S, C, a) {
  const u = unit(C, C.cur); if (!u || C.over) return false; C.fx = []; let wt = 'n';
  if (a.k === 'skill') { const sk = SK[a.id]; if (!usable(C, u, a.id) || !targetsFor(C, u, sk).includes(a.t)) return false; u.wind = null;
    useSkill(S, C, u, sk, a.t); if (sk.cd) u.cds[a.id] = sk.cd + 1; if (sk.once) u.used[a.id] = true; wt = sk.wt || 'n'; }
  else if (a.k === 'wind') { u.wind = { id: a.id, t: a.t }; say(C, `${u.name} gathers itself for something terrible…`); C.fx.push({ id: u.id, tag: 'winding up' }); wt = 'q'; }
  else if (a.k === 'item') { const it = S.bag.find(x => x.id === a.id), c = CONS[a.id]; if (!it || !targetsFor(C, u, { ...c, ty: 'ranged' }).includes(a.t)) return false;
    useSkill(S, C, u, { ...c, ty: 'ranged', heal: 0, gain: 0 }, a.t); if (--it.qty <= 0) S.bag.splice(S.bag.indexOf(it), 1); wt = 'q'; }
  else if (a.k === 'move') { u.row = u.row === 'F' ? 'B' : 'F'; say(C, `${u.name} moves to the ${u.row === 'F' ? 'front' : 'back'} row.`); wt = 'q'; }
  else if (a.k === 'defend') { addState(C, u, 'Guard', 1, u); const n = C.units.find(x => x.npc && up(x)); if (n && u.side === 'H') { n.states.Covered = { t: 99, by: u.id }; say(C, `${u.name} defends, covering ${n.name}.`); } else say(C, `${u.name} defends.`); wt = 'q'; }
  else if (a.k === 'revive') { const t = unit(C, a.t); if (!t || !t.down || t.side !== u.side) return false; t.down = false; t.hp = Math.max(1, Math.round(t.max * 0.2)); t.next = C.time + delayOf(t, 'n'); say(C, `${u.name} helps ${t.name} up.`); }
  else return false;
  endTurn(S, C, u, wt); return true;
}
function threat(u) { return (u.w.die + 1) / 2 + u.st.might; }
// how much the AI likes an action: expected damage, kills, stacks, control, healing, protection
function scoreSkill(C, u, sk, tspec, mates) {
  const ts = resolveTargets(C, u, sk, tspec), pts = sk.cost === 'all' ? u.res || 0 : 0, hidden = has(u, 'Hidden'); let s = 0;
  const tl = sk.special === 'missiles' ? living(C, other(u.side)).slice(0, 3) : sk.special === 'chain' && ts[0] ? ts.concat(living(C, other(u.side)).filter(x => x !== ts[0]).slice(0, 2)) : ts;
  if (sk.m || sk.flat !== undefined) for (const t of tl) {
    const p = evadable(u, sk, t) ? 1 - t.eva / 100 : 1, { d, rx } = calc(u, sk, t, (dieOf(u, sk) + 1) / 2, hidden || helpless(t), pts);
    const hit = Math.min(d, t.hp); s += p * (hit + (d >= t.hp ? 5 + threat(t) : 0) + (t.obj ? 18 : 0) + (t.boss ? 1 : 0));
    if (rx === 'Overload') s += (t.stacks.burn || 0) * 3 * living(C, t.side).filter(o => o !== t && o.row === t.row).length;
    if (sk.special === 'evis' && t.stacks.bleed) s += stackPow(t)('bleed') * t.stacks.bleed * (t.stacks.bleed + 1);
    if (sk.special === 'thunder' && t.stacks.shock) s += t.stacks.shock * (3 + u.lvl) * living(C, t.side).filter(o => o.row === t.row).length + (t.stacks.shock >= 4 ? threat(t) : 0);
    if (sk.special === 'holyfire' && t.stacks.burn) s += t.stacks.burn * 2 * mates.filter(m => m.hp < m.max).length;
    if (d >= t.hp) continue;
    for (const [k, v] of Object.entries(sk.st || {})) { if ((t.bres && t.bres[k] === 0) || (t.stacks[k] || 0) >= 5) continue; const n = Math.min(v, 5 - (t.stacks[k] || 0)), pw = 1 + Math.floor(u.lvl / 2);
      s += p * n * (k === 'frost' ? threat(t) * 0.3 + (u.skills.includes('icelance') ? 2 : 0) + ((t.stacks.frost || 0) + n >= 4 && !has(t, 'Steady') ? threat(t) * 1.2 : 0) : k === 'shock' ? pw * 2 + (u.skills.includes('thunder') ? 2 : 0) : k === 'sunder' ? 1.5 + u.lvl * 0.3 : k === 'poison' ? pw * 2.5 : pw * 1.8); }
    for (const [st, , ch] of sk.ap || []) if (!has(t, st) && !(st === 'Stunned' && has(t, 'Steady'))) s += p * (ch === undefined ? 1 : ch) * (st === 'Stunned' ? threat(t) : st === 'Slowed' ? threat(t) * 0.5 : 2);
    const push = (sk.push || 0) + (sk.pushPer || 0) * pts; if (push) s += p * threat(t) * push / 100;
  }
  if (sk.fin && pts < 3 && u.side === 'H') s *= 0.5 + pts * 0.15;
  if (sk.heal || sk.flatHeal || sk.healP) for (const t of ts) { const v = sk.healP ? t.max * sk.healP : sk.flatHeal ? sk.flatHeal + 4 * u.lvl : ((u.w.sp + 1) / 2 + u.st.spirit * 1.5) * sk.heal, miss = t.max - t.hp, dirt = ['bleed', 'burn', 'poison'].reduce((a, k) => a + (t.stacks[k] || 0) * stackPow(t)(k), 0) + (DEBUFFS.some(x => has(t, x)) ? 6 : 0);
    if (miss < v * 0.5 && t.hp / t.max > 0.4 && dirt < 4) continue; s += Math.min(v, miss) * (t.hp / t.max < 0.4 ? 1.7 : 1.1) + dirt * 1.2; }
  if (sk.reviveP) s += 22;
  if (sk.cover) for (const t of ts) s += t.npc ? 6 : t.hp / t.max < 0.4 && u.hp / u.max > 0.6 ? 7 : 0;
  const winding = living(C, other(u.side)).some(e => e.wind), low = mates.filter(m => m.hp / m.max < 0.5).length;
  if (sk.buff && u.side === 'H') for (const [b] of sk.buff) for (const t of ts) { if (has(t, b)) continue;
    s += b === 'Taunt' ? (u.hp / u.max > 0.5 ? 2 + 4 * low : 0) : b === 'Guard' ? (sk.tg === 'allies' ? 1 + 2 * low + (winding ? 8 : 0) : 1) : b === 'Blessed' ? (t === u ? 0 : 2 + threat(t) * 0.5) : b === 'Hidden' ? (u.hp / u.max < 0.5 ? 7 : 2) + (winding ? 4 : 0) : b === 'FrostArmour' ? (t.row === 'F' ? 3 : 1) : b === 'Sanctuary' ? 1 + 1.5 * living(C, other(u.side)).filter(e => e.skills.some(id => SK[id].ty === 'spell')).length + (winding ? 6 : 0) : 0; }
  if (sk.buff && u.side === 'E') s += 6;
  if (sk.selfAp) s -= 2;
  if (sk.summon) s += living(C, 'E').length <= 3 ? 14 : 0;
  if (sk.gain && u.side === 'H' && u.resMax) s += Math.min(sk.gain, u.resMax - u.res) * 2;
  if (typeof sk.cost === 'number' && u.side === 'H') s -= sk.cost * 0.6;
  return s;
}
function aiHero(S, C, u) {
  const mates = living(C, 'H'); let best = { k: 'defend' }, bs = 1.5 + (living(C, 'E').some(e => e.wind) ? 4 : 0);
  for (const id of ['attack', ...u.skills]) { if (!usable(C, u, id)) continue; const sk = SK[id]; for (const t of targetsFor(C, u, sk)) { const s = scoreSkill(C, u, sk, t, mates) * (id === 'attack' ? 0.9 : 1); if (s > bs) { bs = s; best = { k: 'skill', id, t }; } } }
  if (u.npc) return best;
  const downed = C.units.filter(x => x.side === 'H' && x.down && !x.npc);
  for (const it of S.bag) { const c = CONS[it.id]; if (c.tg === 'downed' && downed.length && bs < 26) { bs = 26; best = { k: 'item', id: it.id, t: downed[0].id }; }
    else if (c.flatHeal) { for (const m of mates) if (m.hp / m.max < 0.35) { const s = Math.min(c.flatHeal + 4 * u.lvl, m.max - m.hp) * 1.3; if (s > bs) { bs = s; best = { k: 'item', id: it.id, t: m.id }; } } }
    else if (c.flat !== undefined && (C.boss || C.elite || living(C, 'E').length >= 4)) for (const t of targetsFor(C, u, { ...c, ty: 'ranged' })) { const s = scoreSkill(C, u, { ...c, ty: 'ranged' }, t, mates) * 0.8; if (s > bs + 4) { bs = s; best = { k: 'item', id: it.id, t }; } } }
  if (downed.length && bs < 16 && mates.length <= 2) { bs = 16; best = { k: 'revive', t: downed[0].id }; }
  if (best.k === 'defend' && u.row === 'B' && !u.w.reach && frontOf(C, 'H').length && u.skills.every(id => skillType(u, SK[id]) === 'melee' || SK[id].ty === 'buff')) best = { k: 'move' };
  return best;
}
function aiEnemy(S, C, u) {
  if (u.wind) { const w = u.wind; const ok = usable(C, u, w.id) ? targetsFor(C, u, SK[w.id]) : []; if (ok.length) return { k: 'skill', id: w.id, t: ok.includes(w.t) ? w.t : ok[0] }; u.wind = null; }
  const opts = []; const mates = living(C, 'E');
  if (u.flee) return { k: 'defend' };
  for (const id of u.skills) { if (!usable(C, u, id)) continue; const sk = SK[id];
    if (sk.heal && !mates.some(m => m.hp / m.max < 0.6)) continue;
    for (const t of targetsFor(C, u, sk)) { let s = scoreSkill(C, u, sk, t, mates); if (sk.tg === 'ally') { const m = unit(C, t); s = m.hp / m.max < 0.6 ? (m.max - m.hp) * 0.8 : 0; } if (s > 0) { if (S.diff && C.focus && C.focus[t]) s *= K.focus ** C.focus[t]; opts.push([{ k: 'skill', id, t }, s * (S.diff ? 0.9 + 0.2 * rnd(S) : 0.6 + 0.8 * rnd(S))]); } } }
  if (!opts.length) return u.row === 'B' || targetsFor(C, u, SK.e_hit).length ? { k: 'defend' } : { k: 'move' };
  opts.sort((a, b) => b[1] - a[1]); const pickd = opts[0][0];
  if (u.boss && SK[pickd.id].big && SK[pickd.id].tg !== 'self') { const ok = targetsFor(C, u, SK[pickd.id]); if (ok.includes(pickd.t)) return { k: 'wind', id: pickd.id, t: pickd.t }; }
  if (pickd.t && pickd.t[0] === 'h') { C.focus = C.focus || {}; C.focus[pickd.t] = (C.focus[pickd.t] || 0) + 1; } return pickd;
}
function startCombat(S, enc) {
  const n = S.party.length, C = { units: S.party.map(heroUnit), round: 1, time: 0, cur: null, log: [], fx: [], over: null, lv: enc.lv, n, nextId: 0, kind: enc.kind, boss: enc.kind === 'boss', elite: enc.kind === 'elite', first: null, name: enc.name || '', obj: enc.obj ? { ...enc.obj } : null };
  C.rng = () => rnd(S);
  if (S.comp) C.units.push(compUnit(S));
  const rows = { F: 0, B: 0 };
  for (const key of enc.list) { const u = enemyUnit(S, key, enc.lv + (EN[key].elite || EN[key].boss ? 0.5 : 0), C.nextId++, n); if (rows[u.row] >= 3) u.row = u.row === 'F' ? 'B' : 'F'; rows[u.row]++; C.units.push(u); }
  if (!C.units.some(u => u.side === 'E' && u.row === 'F')) C.units.find(u => u.side === 'E').row = 'F';
  const dup = {}; for (const u of C.units) if (u.side === 'E') dup[u.name] = (dup[u.name] || 0) + 1; const seen = {}; for (const u of C.units) if (u.side === 'E' && dup[u.name] > 1) { seen[u.name] = (seen[u.name] || 0) + 1; u.name += ' ' + 'ABCDEF'[seen[u.name] - 1]; }
  for (const u of C.units) if (u.side === 'H' && up(u)) { if (u.fx.startGuard) u.states.Guard = { t: 1, fresh: true }; if (u.fx.startTaunt) u.states.Taunt = { t: 2, fresh: true }; if (u.fx.startHidden) u.states.Hidden = { t: 2, fresh: true }; }
  const aura = {}; for (const u of C.units) if (u.side === 'H' && u.fx.aura) mergeFx(aura, u.fx.aura); for (const u of C.units) if (u.side === 'H') { u.fx = mergeFx({ ...u.fx, immune: (u.fx.immune || []).slice() }, aura); u.arm += aura.arm || 0; }
  for (const u of C.units) if (u.boss && EN[u.key].next) u.name = S.q.name;
  if (enc.ltn) { const e = C.units.find(u => u.elite); if (e) e.name = enc.ltn.split(',')[0]; }
  const mod = S.nextMod; S.nextMod = null;
  if (S.camp) for (const u of C.units) if (u.side === 'E') S.camp.codex.en[u.key] = 1;
  C.frail = hasMod(S, 'frail'); if (hasMod(S, 'swift') && mod !== 'ambush') C.first = 'E';
  if (C.name) say(C, C.name + (enc.text ? ': ' + enc.text : '.'));
  for (const u of C.units) prep(S, C, u);
  if (hasMod(S, 'cursed')) for (const u of living(C, 'H')) u.stacks.sunder = 2;
  if (mod === 'ambush') { C.first = 'H'; for (const u of living(C, 'E')) { u.hp = Math.round(u.hp * 0.85); u.stacks.sunder = 1; } say(C, 'You catch them off guard: the enemy starts hurt and Sundered, and you act first.'); }
  if (mod === 'surprised') { C.first = 'E'; say(C, 'You are caught off guard: the enemy acts first.'); }
  if (mod === 'exposed') { for (const u of living(C, 'E')) u.stacks.sunder = 2; say(C, 'You know their weak points: the enemy starts with 2 Sunder.'); }
  if (C.boss && S.q.bossHp) { const b = C.units.find(u => u.boss); b.hp = b.max = Math.max(1, Math.round(b.max * (1 + S.q.bossHp))); say(C, S.q.bossHp < 0 ? `Your earlier work has weakened ${S.q.name}.` : `${S.q.name} has grown stronger while you delayed.`); }
  if (C.elite && (S.q.flags.eliteWeak || (S.q.leads || 0) >= 2)) { const b = C.units.find(u => u.elite); if (b) { b.hp = b.max = Math.round(b.max * 0.75); say(C, 'What you learned on the road pays off: their leader is not ready for you.'); } }
  objStart(S, C);
  for (const u of C.units) { if (!u.stacks) prep(S, C, u); u.next = Math.round(delayOf(u, 'n') * (0.35 + 0.65 * rnd(S)) * (C.first === u.side ? 0.4 : C.first ? 1.3 : 1)); }
  S.C = C; S.screen = 'combat'; S.stats.fights++; nextUp(S, C); return C;
}
