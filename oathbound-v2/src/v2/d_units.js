// a Ranger fights from the back row, so the rogue's Slash becomes a Quick Shot
const RANGER_SWAP = { slash: 'quickshot' }, swapSk = (h, id) => h.sub === 'ranger' && RANGER_SWAP[id] || id;
function known(h) { const c = CLASSES[h.cls], out = c.base.slice(0, h.level >= 2 ? 4 : 3).map(id => swapSk(h, id)); if (h.sub) out.push(...c.subs[h.sub].sk.slice(0, h.level - 2)); return out; }
function autoEquip(h) { h.eq = known(h).filter(id => SK[id].ty !== 'passive'); }
function newHero(seat, i) { const c = CLASSES[seat.cls];
  const h = { name: seat.name || c.n, cls: seat.cls, sub: null, ctrl: seat.ctrl, player: seat.player || '', level: 1, wounds: 0, row: c.row, hp: 0, eq: [], tal: [],
    gear: { w: mkWeapon(c.start[0], 1), off: c.start[1] ? mkShield(1) : null, a: mkArmor(c.start[2], 1), t1: null, t2: null } };
  h.hp = maxHp(h); autoEquip(h); return h; }
function heroUnit(h, i) {
  const fx = normFx(heroFx(h)), g = h.gear, w = WT[g.w.type], t = g.w.tier - 1, st = {}; for (const s of STATS) st[s] = heroStat(h, s);
  if (w.crit) fx.crit = (fx.crit || 0) + w.crit; if (w.init) fx.init = (fx.init || 0) + w.init; if (w.hit) fx.hit = (fx.hit || 0) + w.hit;
  const kn = known(h); for (const id of kn) if (SK[id].fx) mergeFx(fx, SK[id].fx);
  const stk = {}; for (const [k, v] of Object.entries(normFx({ bu: { ...(w.bu || {}) } }).bu || {})) stk[k] = Math.min(1, v / 40);
  return { id: 'h' + i, side: 'H', hi: i, cls: h.cls, sub: h.sub, name: h.name, row: h.row, hp: h.hp, max: maxHp(h), st, lvl: h.level, fx,
    arm: (g.a ? ARMOR[g.a.type].arm[g.a.tier - 1] : 0) + (g.off ? offOf(g.off).arm[g.off.tier - 1] : 0) + (fx.arm || 0), ward: (g.a ? ARMOR[g.a.type].ward[g.a.tier - 1] : 0) + (fx.ward || 0), defb: (g.off ? offOf(g.off).def[g.off.tier - 1] : 0) + (fx.def || 0),
    w: { die: w.die[t], sp: (w.sp ? w.sp[t] : 4 + t) + (fx.spd || 0), bonus: w.bonus || 0, fin: w.fin, reach: w.reach, ranged: w.ranged, splash: w.splash, xbow: w.xbow, phys: w.phys, stk },
    skills: kn.filter(id => SK[id].ty !== 'passive'), states: {}, cds: {}, used: {}, down: h.hp <= 0 };
}

// ---------- enemies ----------
// ar: armour type (how Slash, Pierce and Strike land); aff: elemental multipliers; bres 0 = immune to that stack
const ARMT = { cloth: { slash: 1.2, pierce: 1, strike: 0.9 }, hide: { slash: 1.1, pierce: 1.1, strike: 0.9 }, mail: { slash: 0.85, pierce: 1.2, strike: 1 }, plate: { slash: 0.8, pierce: 0.9, strike: 1.2 }, bone: { slash: 0.85, pierce: 0.8, strike: 1.2 }, spirit: { slash: 0.6, pierce: 0.6, strike: 0.6 } };
