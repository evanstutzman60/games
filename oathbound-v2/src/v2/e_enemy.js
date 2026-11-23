function enemyUnit(S, key, lv, k, n) {
  const e = EN[key], big = e.elite || e.boss, iron = hasMod(S, 'armored') ? 3 : 0, small = n === 1 ? 0.62 : n === 2 ? 0.88 : 1, size = (big ? 0.4 + 0.15 * n : 1) * small, ease = rampOf(S), atk = e.atk + 1.3 * (lv - 1) + K.atk - (n === 1 ? 1.5 : 0) - K.easeAtk * ease, agi = Math.round(e.agi + 0.4 * (lv - 1));
  const vet = S.diff ? 1 : 0, hp = Math.max(1, Math.round(e.hp * (1 + 0.4 * (lv - 1)) * size * K.hp * (big ? K.bigHp : 1) * (1 - K.easeHp * ease) * (vet ? K.vetHp : 1))), a = Math.round(atk + vet * K.vetAtk), fx = {};
  if (hasMod(S, 'regen') || e.regen) fx.regen = Math.ceil(hp * (e.regen || 0.05));
  return { id: 'e' + k, side: 'E', key, name: e.n, fam: e.fam, ar: e.ar, aff: affOf(e), bres: bresOf(e), row: e.row, hp, max: hp, st: { might: a, agility: agi, mind: a, spirit: a }, lvl: Math.round(lv), fx,
    arm: e.arm + Math.floor((lv - 1) / 2) + iron, ward: e.ward + Math.floor((lv - 1) / 2) + iron, defb: 0, w: { die: e.die + Math.floor(lv - 1), sp: e.die + Math.floor(lv - 1), bonus: 0, stk: {} },
    skills: e.sk.slice(), states: {}, cds: {}, used: {}, elite: e.elite, boss: e.boss };
}
// Bosses: lieutenants at their side, and a change at 66% and 33% health
const BOSSP = {
  wyrm: { lt: ['flamecaller', 'flamecaller'], p: ['fly', 'enrage'], t: ['Ashwing beats its great wings and takes to the air. Only Frost or Shock can bring it down within reach of blades.', 'Ashwing crashes to the ground, enraged and burning.'] },
  necro: { lt: ['bonearcher', 'ghoul'], p: ['raise', 'drain'], t: ['Mother Vex raises the fallen around her.', 'Mother Vex begins to drain the life from everyone near her.'] },
  knight: { lt: ['skeleton', 'skeleton'], p: ['iron', 'unshield'], t: ['Ser Aldous raises his shield: he takes half damage until Sundered 3 times.', 'Ser Aldous casts his shield aside and swings with both hands.'] },
  banditking: { lt: ['archer', 'thug'], p: ['reinforce', 'haste'], t: ['Garrick roars for his gang.', 'Garrick fights in the open, fast and furious.'] },
  prophet: { lt: ['acolyte', 'zealot'], p: ['shield', 'burnall'], t: ['The Prophet wraps herself in her followers\' faith: she takes no damage while they stand.', 'The Prophet sets the very air alight.'] },
  beastlord: { lt: ['wolf', 'wolf'], p: ['howl', 'savage'], t: ['The Antlered Man howls, and his pack quickens.', 'The Antlered Man drops to all fours, savage: every blow Sunders.'] }
};
function bossPhase(S, C, b) {
  const cfg = BOSSP[b.key]; if (!cfg) return; const want = b.hp / b.max < 0.33 ? 2 : b.hp / b.max < 0.66 ? 1 : 0;
  while ((b.phase || 0) < want) { b.phase = (b.phase || 0) + 1; const eff = cfg.p[b.phase - 1]; say(C, cfg.t[b.phase - 1]); C.fx.push({ id: b.id, tag: 'Phase ' + (b.phase + 1) });
    const add = (key, k) => { for (let i = 0; i < k; i++) { if (living(C, 'E').length >= 6) break; const u = prep(S, C, enemyUnit(S, key, C.lv, C.nextId++, C.n)); if (living(C, 'E').filter(x => x.row === u.row).length >= 3) u.row = u.row === 'F' ? 'B' : 'F'; u.next = C.time + delayOf(u, 'n'); C.units.push(u); } };
    if (eff === 'fly') b.states.Flying = { t: 99 };
    if (eff === 'enrage') b.burnHits = true; if (eff === 'enrage' || eff === 'unshield' || eff === 'haste') { delete b.states.Flying; b.iron = false; b.states[eff === 'haste' ? 'Hasted' : 'Enraged'] = { t: 99 }; }
    if (eff === 'raise') add('skeleton', 1); if (eff === 'drain') b.drainAll = true; if (eff === 'iron') b.iron = true; if (eff === 'reinforce') add('thug', 2);
    if (eff === 'shield') { if (!living(C, 'E').some(u => u !== b && ['acolyte', 'zealot'].includes(u.key))) add('acolyte', 2); b.states.Shielded = { t: 99 }; }
    if (eff === 'burnall') b.burnAll = true;
    if (eff === 'howl') { add('wolf', 1); for (const u of living(C, 'E')) if (u.key === 'wolf') u.states.Hasted = { t: 99 }; }
    if (eff === 'savage') { b.states.Enraged = { t: 99 }; b.sunderHits = true; }
  }
}
