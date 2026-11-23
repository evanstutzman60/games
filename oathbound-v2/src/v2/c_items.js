const CONS = {
  potion: { n: 'Healing Potion', tg: 'ally', flatHeal: 16, price: 12, d: 'Heals one ally for 16 (+4 per level) and cleanses Bleed, Burn, Poison and one bad state.' },
  greater: { n: 'Greater Potion', tg: 'ally', flatHeal: 34, price: 26, d: 'Heals one ally for 34 (+4 per level) and cleanses them.', tier: 2 },
  fury: { n: 'Elixir of Fury', tg: 'ally', buff: [['Blessed', 3]], price: 12, d: 'One ally is Blessed: their next attack deals +40%.' },
  stoneskin: { n: 'Stoneskin Draught', tg: 'ally', buff: [['Guard', 2]], price: 12, d: 'One ally takes 30% less damage for 2 turns.' },
  thunderstone: { n: 'Thunderstone', tg: 'all', flat: 2, el: 'lightning', st: { shock: 2 }, price: 20, d: 'Lightning damage to all enemies and 2 Shock each.', tier: 2 },
  tears: { n: 'Phoenix Tears', tg: 'downed', reviveP: 0.8, price: 30, d: 'Revives a downed ally at 80% health.', tier: 3 },
  salts: { n: 'Smelling Salts', tg: 'downed', reviveP: 0.4, price: 15, d: 'Revives a downed ally at 40% health.' },
  firebomb: { n: 'Firebomb', tg: 'row', flat: 5, el: 'fire', st: { burn: 2 }, price: 14, d: 'Fire damage to an enemy row and 2 Burn each.' },
  frostflask: { n: 'Frost Flask', tg: 'row', flat: 3, el: 'frost', st: { frost: 2 }, price: 12, d: 'Frost damage to an enemy row and 2 Frost each.' },
  flash: { n: 'Flash Powder', tg: 'row', flat: 1, push: 30, price: 16, d: 'Knocks an enemy row 30 ticks down the timeline.' },
  oil: { n: 'Oil Pot', tg: 'one', flat: 1, st: { burn: 3 }, price: 10, d: 'Douses one enemy in burning oil: 3 Burn.' },
  tangle: { n: 'Tanglefoot Bag', tg: 'row', flat: 1, ap: [['Slowed', 2, 1]], price: 12, d: 'Slows an enemy row for 2 turns.' },
  venom: { n: 'Vial of Venom', tg: 'one', flat: 1, st: { poison: 3 }, price: 14, d: '3 Poison on one enemy.' },
  tonic: { n: 'Cleansing Tonic', tg: 'ally', flatHeal: 8, price: 8, d: 'Heals an ally for 8 and cleanses them.' }
};
for (const k in CONS) CONS[k].id = k;
// what old item effects mean under the new rules: chance-based states become stacks
const PROC_MAP = { Burning: 'burn', Numbed: 'frost', Marked: 'sunder', Exposed: 'sunder', Frozen: 'frost' }, BU_MAP = { bleed: 'bleed', poison: 'poison', stagger: 'sunder' };
function normFx(fx) {
  if (fx.procs) fx.procs = fx.procs.map(([s, ch, only]) => [PROC_MAP[s] || s, ch, only]);
  if (fx.bu) { const o = {}; for (const [k, v] of Object.entries(fx.bu)) o[BU_MAP[k]] = (o[BU_MAP[k]] || 0) + v; fx.bu = o; }
  if (fx.immune) fx.immune = [].concat(fx.immune).map(s => PROC_MAP[s] || s);
  if (fx.vs) fx.vs = fx.vs.map(([s, v]) => [PROC_MAP[s] || s, v]);
  return fx;
}
Object.assign(FX_TEXT, { bu: v => Object.entries(normFx({ bu: v }).bu).map(([k, a]) => `${Math.round(Math.min(1, a / 40) * 100)}% chance per hit to add 1 ${STACK_NAME[k]}`).join(', '),
  procs: v => normFx({ procs: v }).procs.map(p => `hits have a ${pct(p[1])} chance to add 1 ${STACK_NAME[p[0]] || p[0]}`).join(', '), def: v => `+${v * 3}% evasion`, hit: v => `+${v} damage`, crit: v => `critical hits deal +${v * 20}%`,
  init: v => `+${v / 2} speed`, cdr: v => `start each fight with ${v} more resource point${v > 1 ? 's' : ''}`, dur: v => `skills that add stacks add ${v} more`, pay: v => `finishers and cash-ins deal +${pct(v)}`,
  immune: v => `immune to ${[].concat(v).map(s => STACK_NAME[PROC_MAP[s] || s] || s).join(' and ')}`, vs: v => normFx({ vs: v }).vs.map(p => `+${pct(p[1])} damage to targets with ${STACK_NAME[p[0]] || p[0]}`).join(', ') });
