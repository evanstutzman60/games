// States: few, each with a big plain effect. Durations count the affected unit's own turns.
const STATE_INFO = {
  Frozen: 'Frozen solid: skips its next turn and was knocked 40 ticks down the timeline. Every hit on it is a critical, and Strike or lightning hits Shatter it for double damage.',
  Stunned: 'Dazed: skips its next turn and was knocked 25 ticks down the timeline. Every hit on it is a critical.',
  Hidden: 'Enemies cannot target you, and attacks that hit a row or everyone deal half damage to you. Your next attack is a critical and ends it.',
  Taunt: 'Enemies must attack this hero if they can.',
  Guard: 'Takes 30% less damage.',
  Hasted: 'Speed +30%: acts more often.', Slowed: 'Speed -30%: acts less often.',
  Blessed: 'Its next attack deals +40% damage.',
  Covered: 'Another hero takes the hits meant for this one.',
  Reckless: 'Takes 20% more damage until its next turn.',
  FrostArmour: '+3 ward, and anyone who hits it in melee gains 1 Frost.',
  Sanctuary: '+5 ward until the priest acts again.',
  Steady: 'Just recovered its footing: cannot be Stunned or Frozen again yet.',
  Flying: 'In the air: melee attacks cannot reach it until it has 3 or more Frost or Shock.',
  Enraged: 'Enraged: acts 30% faster and hits 20% harder.',
  Shielded: 'Protected by its followers: takes no damage while they stand.'
};
const DEBUFFS = ['Frozen', 'Stunned', 'Slowed', 'Reckless'];
// Stacks: up to 5 of each on a target. They hold while someone keeps adding to them; at the end of the target's turn, any kind that got
// nothing new since its last turn drops by one. Poison never fades. Bleed, Burn, Poison and Shock damage is 1 + half the applier's level per stack.
const STACKS = ['frost', 'shock', 'bleed', 'poison', 'burn', 'sunder'];
const STACK_NAME = { frost: 'Frost', shock: 'Shock', bleed: 'Bleed', poison: 'Poison', burn: 'Burn', sunder: 'Sunder' };
const STACK_INFO = {
  frost: 'Frost: it deals 6% less damage per stack. At 4 stacks it is Frozen. Ice Lance cashes Frost in; fire on Frost Melts it.',
  shock: 'Shock: every hit on it deals extra lightning damage per stack. Thunderclap cashes Shock in.',
  bleed: 'Bleed: damage per stack at the end of its turn. Eviscerate cashes Bleed in.',
  poison: 'Poison: small damage per stack each turn, it heals 20% less per stack, and it never fades. Rogue finishers deal +25% per Poison stack.',
  burn: 'Burn: damage per stack at the end of its turn. Holy Fire cashes Burn in; lightning on Burn Overloads it.',
  sunder: 'Sunder: it takes 10% more damage from everyone per stack.'
};
const REACT_INFO = { Melt: 'Fire on a target with Frost: +40% damage per Frost stack, and the Frost is used up.', Overload: 'Lightning on a target with Burn: the Burn is used up and explodes across its row.', Shatter: 'A Strike or lightning hit on a Frozen target: double damage, and the freeze ends.' };
const BU_NAME = STACK_NAME, BU_INFO = STACK_INFO;

// ---------- skills ----------
// ty: melee | ranged | spell | heal | buff | passive     tg: one | row | all | ally | allies | self | downed
// wt: q (Quick, 70) | n (Normal, 100) | h (Heavy, 140): how far down the timeline the user goes after acting
// gain: resource points it builds; cost: points it spends, or 'all' for finishers (fin: extra damage per point spent)
// st: stacks it adds to each target; push: ticks it knocks the target down the timeline; cash: { k, per } consumes those stacks for +per damage each
// el: fire | frost | lightning | holy | arcane; physical skills use the weapon's Slash, Pierce or Strike unless dt says otherwise; wpn: melee or ranged by weapon
const SK = {
  attack: { n: 'Attack', ty: 'melee', wpn: true, tg: 'one', m: 1, wt: 'n' },
  // warrior: Rage
  heavy: { n: 'Heavy Swing', ty: 'melee', tg: 'one', m: 1.1, st: { sunder: 1 }, gain: 1, wt: 'n' },
  shove: { n: 'Shove', ty: 'melee', tg: 'one', m: 0.5, push: 25, gain: 1, wt: 'q' },
  taunt: { n: 'Taunt', ty: 'buff', tg: 'self', buff: [['Taunt', 1]], cost: 1, wt: 'q' },
  cleave: { n: 'Cleave', ty: 'melee', tg: 'row', m: 0.8, st: { sunder: 1 }, cost: 2, wt: 'h' },
  shieldwall: { n: 'Shield Wall', ty: 'buff', tg: 'allies', buff: [['Guard', 1]], cost: 2, wt: 'q' },
  intercept: { n: 'Intercept', ty: 'buff', tg: 'ally', cover: true, cost: 1, wt: 'q' },
  slam: { n: 'Shield Slam', ty: 'melee', tg: 'one', m: 0.6, cost: 'all', fin: 0.25, pushPer: 15, wt: 'n' },
  reckless: { n: 'Reckless Swing', ty: 'melee', tg: 'one', m: 1.4, st: { sunder: 2 }, gain: 2, selfAp: ['Reckless', 1], wt: 'n' },
  whirl: { n: 'Whirlwind', ty: 'melee', tg: 'all', m: 0.8, st: { sunder: 1 }, cost: 3, wt: 'h' },
  execute: { n: 'Execute', ty: 'melee', tg: 'one', m: 1.0, cost: 'all', fin: 0.3, pay: { s: ['low'], m: 2 }, wt: 'h' },
  // rogue: Combo
  slash: { n: 'Slash', ty: 'melee', tg: 'one', m: 0.9, st: { bleed: 1 }, gain: 1, wt: 'q' },
  quickshot: { n: 'Quick Shot', ty: 'ranged', tg: 'one', m: 0.9, st: { bleed: 1 }, gain: 1, wt: 'q' },
  knife: { n: 'Throwing Knife', ty: 'ranged', tg: 'one', m: 0.7, dt: 'pierce', gain: 1, wt: 'q' },
  smoke: { n: 'Smoke Bomb', ty: 'buff', tg: 'self', buff: [['Hidden', 2]], gain: 2, cd: 4, wt: 'q' },
  evis: { n: 'Eviscerate', ty: 'melee', wpn: true, tg: 'one', m: 0.6, cost: 'all', fin: 0.3, rfin: true, special: 'evis', wt: 'n' },
  backstab: { n: 'Backstab', ty: 'melee', tg: 'one', m: 1.2, gain: 2, pay: { s: ['hidden', 'helpless'], m: 1.5 }, wt: 'n' },
  envenom: { n: 'Envenom', ty: 'melee', tg: 'one', m: 0.8, st: { poison: 2 }, gain: 1, wt: 'n' },
  garrote: { n: 'Garrote', ty: 'melee', tg: 'one', m: 0.5, cost: 'all', fin: 0.15, rfin: true, special: 'garrote', wt: 'n' },
  venomarrow: { n: 'Venom Arrow', ty: 'ranged', tg: 'one', m: 0.8, dt: 'pierce', st: { poison: 2 }, gain: 1, wt: 'n' },
  pinning: { n: 'Pinning Shot', ty: 'ranged', tg: 'one', m: 0.6, dt: 'pierce', cost: 'all', fin: 0.15, rfin: true, pushPer: 10, wt: 'n' },
  volley: { n: 'Volley', ty: 'ranged', tg: 'row', m: 0.4, dt: 'pierce', cost: 'all', fin: 0.15, rfin: true, st: { bleed: 1 }, wt: 'h' },
  // mage: Focus
  abolt: { n: 'Arcane Bolt', ty: 'spell', tg: 'one', m: 1.0, gain: 1, wt: 'n' },
  frostshard: { n: 'Frost Shard', ty: 'spell', el: 'frost', tg: 'one', m: 0.8, st: { frost: 1 }, gain: 1, wt: 'n' },
  spark: { n: 'Spark', ty: 'spell', el: 'lightning', tg: 'one', m: 0.8, st: { shock: 1 }, gain: 1, wt: 'n' },
  missiles: { n: 'Arcane Missiles', ty: 'spell', tg: 'all', m: 0.5, special: 'missiles', cost: 2, wt: 'n' },
  icelance: { n: 'Ice Lance', ty: 'spell', el: 'frost', tg: 'one', m: 1.0, cash: { k: 'frost', per: 0.4, frozen: 2 }, cost: 2, wt: 'n' },
  frostarmor: { n: 'Frost Armour', ty: 'buff', tg: 'ally', buff: [['FrostArmour', 2]], cost: 1, wt: 'q' },
  blizzard: { n: 'Blizzard', ty: 'spell', el: 'frost', tg: 'all', m: 0.5, st: { frost: 2 }, cost: 3, wt: 'h' },
  chain: { n: 'Chain Lightning', ty: 'spell', el: 'lightning', tg: 'one', m: 0.7, st: { shock: 1 }, special: 'chain', cost: 2, wt: 'n' },
  thunder: { n: 'Thunderclap', ty: 'spell', el: 'lightning', tg: 'one', m: 0.6, special: 'thunder', cost: 3, wt: 'h' },
  staticfield: { n: 'Static Field', ty: 'passive', tg: 'self', fx: { staticf: 1 } },
  // priest: Faith
  smite: { n: 'Smite', ty: 'spell', el: 'holy', tg: 'one', m: 1.0, gain: 1, wt: 'n' },
  mend: { n: 'Mend', ty: 'heal', tg: 'ally', heal: 1, gain: 1, wt: 'q' },
  bless: { n: 'Bless', ty: 'buff', tg: 'ally', buff: [['Blessed', 3]], cost: 1, wt: 'q' },
  revive: { n: 'Revive', ty: 'heal', tg: 'downed', reviveP: 0.3, cost: 2, once: true, wt: 'n' },
  radiance: { n: 'Radiance', ty: 'heal', tg: 'allies', heal: 0.7, cost: 3, wt: 'h' },
  sanctuary: { n: 'Sanctuary', ty: 'buff', tg: 'allies', buff: [['Sanctuary', 1]], cost: 2, wt: 'n' },
  judgement: { n: 'Judgement', ty: 'spell', el: 'holy', tg: 'one', m: 1.4, cost: 2, wt: 'n' },
  searing: { n: 'Searing Strike', ty: 'melee', el: 'fire', holyHeal: true, tg: 'one', m: 1.0, st: { burn: 2 }, gain: 1, wt: 'n' },
  pyre: { n: 'Pyre', ty: 'spell', el: 'fire', holyHeal: true, tg: 'row', m: 0.5, st: { burn: 1 }, cost: 2, wt: 'n' },
  holyfire: { n: 'Holy Fire', ty: 'melee', el: 'fire', holyHeal: true, tg: 'one', m: 0.7, cost: 'all', fin: 0.2, cash: { k: 'burn', per: 0.3 }, special: 'holyfire', wt: 'h' },
  // enemies (cooldowns count their own turns; big: bosses wind these up a turn ahead)
  e_hit: { n: 'Strike', ty: 'melee', tg: 'one', m: 1 },
  e_shot: { n: 'Shot', ty: 'ranged', tg: 'one', m: 1 },
  e_bolt: { n: 'Dark Bolt', ty: 'spell', tg: 'one', m: 1 },
  e_trip: { n: 'Hamstring', ty: 'melee', tg: 'one', m: 0.8, st: { bleed: 1 }, cd: 2 },
  e_mark: { n: 'Pick a Target', ty: 'ranged', tg: 'one', m: 0.7, st: { sunder: 1 }, cd: 2 },
  e_fire: { n: 'Firebrand', ty: 'spell', el: 'fire', tg: 'one', m: 0.9, st: { burn: 2 }, cd: 2 },
  e_bite: { n: 'Paralysing Bite', ty: 'melee', tg: 'one', m: 0.8, ap: [['Stunned', 1, 0.35]], cd: 3 },
  e_venom: { n: 'Venom Spit', ty: 'ranged', tg: 'one', m: 0.6, st: { poison: 2 }, cd: 2 },
  e_web: { n: 'Web', ty: 'ranged', tg: 'one', m: 0.5, ap: [['Slowed', 2, 1]], cd: 3 },
  e_expose: { n: 'Hex', ty: 'spell', tg: 'one', m: 0.6, st: { sunder: 2 }, cd: 2 },
  e_heal: { n: 'Dark Mending', ty: 'heal', tg: 'ally', heal: 1, cd: 2 },
  e_cleave: { n: 'Sweep', ty: 'melee', tg: 'row', m: 0.8, cd: 2 },
  e_drain: { n: 'Life Drain', ty: 'spell', tg: 'one', m: 1, leech: 0.5 },
  e_rally: { n: 'Rally', ty: 'buff', tg: 'allies', buff: [['Blessed', 2]], cd: 4 },
  e_charge: { n: 'Wild Charge', ty: 'melee', tg: 'one', m: 1.4, selfSt: { sunder: 2 }, cd: 2 },
  e_crush: { n: 'Crushing Blow', ty: 'melee', tg: 'one', m: 1.5, st: { sunder: 1 }, cd: 2, big: true },
  e_maul: { n: 'Maul', ty: 'melee', tg: 'one', m: 1.4, ap: [['Stunned', 1, 0.3]], cd: 2 },
  e_roar: { n: 'Roar', ty: 'spell', tg: 'all', m: 0.3, st: { sunder: 1 }, cd: 4 },
  e_curse: { n: 'Withering Curse', ty: 'spell', tg: 'all', m: 0.3, st: { sunder: 1 }, cd: 4 },
  e_deathbolt: { n: 'Death Bolt', ty: 'spell', tg: 'one', m: 1.5, cd: 2, big: true },
  e_breath: { n: 'Fire Breath', ty: 'spell', el: 'fire', tg: 'row', m: 0.8, st: { burn: 2 }, cd: 3, big: true },
  e_tail: { n: 'Tail Sweep', ty: 'melee', tg: 'row', m: 0.8, ap: [['Stunned', 1, 0.3]], cd: 2 },
  e_firewave: { n: 'Wall of Flame', ty: 'spell', el: 'fire', tg: 'row', m: 0.6, st: { burn: 1 }, cd: 3 },
  e_frost: { n: 'Grave Chill', ty: 'spell', el: 'frost', tg: 'one', m: 0.9, st: { frost: 2 }, cd: 2 },
  e_rouse: { n: 'Sound the Alarm', ty: 'buff', tg: 'self', summon: 'cutpurse', k: 1, cd: 3 },
  e_raise: { n: 'Raise Dead', ty: 'buff', tg: 'self', summon: 'skeleton', k: 2, cd: 4 },
  e_callthugs: { n: 'Call the Gang', ty: 'buff', tg: 'self', summon: 'thug', k: 2, cd: 5 },
  e_callwolves: { n: 'Call the Pack', ty: 'buff', tg: 'self', summon: 'wolf', k: 2, cd: 4 },
  e_callimps: { n: 'Summon Imps', ty: 'buff', tg: 'self', summon: 'imp', k: 2, cd: 4 }
};
for (const k in SK) SK[k].id = k;
const pct = v => Math.round(v * 100) + '%';
const EL_NAME = { fire: 'Fire', frost: 'Frost', lightning: 'Lightning', holy: 'Holy', arcane: 'Arcane' }, DT_NAME = { slash: 'Slash', pierce: 'Pierce', strike: 'Strike' };
const WT_NAME = { q: 'Quick', n: 'Normal', h: 'Heavy' };
function skillDesc(sk) {
  const p = [], tg = { one: 'one enemy', row: 'an enemy row', all: 'all enemies', ally: 'one ally', allies: 'the whole party', self: 'yourself', downed: 'a fallen ally' }[sk.tg];
  const kind = sk.el ? EL_NAME[sk.el] : sk.ty === 'spell' ? 'Arcane' : sk.dt ? DT_NAME[sk.dt] : 'Weapon';
  if (sk.ty === 'passive') return 'Passive: Shocked enemies lose 5 ticks per Shock stack every time they act.';
  if (sk.m) p.push(`${kind} ${sk.wpn ? 'attack (melee or ranged by weapon)' : { melee: 'melee attack', ranged: 'ranged attack', spell: 'spell' }[sk.ty]} on ${sk.special === 'missiles' ? 'three random enemies' : tg} for ${pct(sk.m)} damage.`);
  if (sk.special === 'chain') p.push('Jumps to two more enemies.');
  if (sk.el === 'holy' || sk.holyHeal) p.push('Holy: heals your most wounded ally for 20% of the damage.'); if (sk.el === 'arcane' || (sk.ty === 'spell' && !sk.el)) p.push('Ignores half of ward.');
  for (const [k, v] of Object.entries(sk.st || {})) p.push(`+${v} ${STACK_NAME[k]}.`);
  if (sk.fin) p.push(`Spends all points: +${pct(sk.fin)} damage per point.`);
  if (sk.rfin) p.push('+25% per Poison stack on the target.');
  if (sk.cash) p.push(`Uses up the target's ${STACK_NAME[sk.cash.k]}: +${pct(sk.cash.per)} damage per stack${sk.cash.frozen ? '; x2 on a Frozen target' : ''}.`);
  if (sk.special === 'evis') p.push('Then deals all of the target\'s remaining Bleed at once, doubled.');
  if (sk.special === 'garrote') p.push('Adds 1 Bleed and 1 Poison per point spent.');
  if (sk.special === 'thunder') p.push('Uses up the target\'s Shock: lightning damage per stack to it and its row; Stuns it at 4 or more.');
  if (sk.special === 'holyfire') p.push('Heals the party for each Burn stack used up.');
  if (sk.push) p.push(`Knocks the target ${sk.push} ticks down the timeline.`); if (sk.pushPer) p.push(`Knocks the target ${sk.pushPer} ticks down the timeline per point.`);
  if (sk.pay) p.push(`${sk.pay.s.map(s => ({ low: 'Against enemies below 30% health', hidden: 'From Hidden', helpless: 'against a Frozen or Stunned target' })[s]).join(' or ')}: x${sk.pay.m} damage.`);
  if (sk.heal) p.push(`Heals ${tg} (${pct(sk.heal)} strength) and cleanses Bleed, Burn, Poison and one bad state.`);
  if (sk.reviveP) p.push(`Brings a fallen ally back at ${pct(sk.reviveP)} health.`);
  if (sk.cover) p.push('Until your next turn, you take the hits meant for that ally.');
  for (const [s, t, c] of sk.ap || []) p.push(`${c < 1 ? pct(c) + ' chance to apply' : 'Applies'} ${s}.`);
  for (const [s] of sk.buff || []) p.push(`${s === 'Hidden' ? 'You become Hidden' : `Grants ${s} to ${tg}`}: ${STATE_INFO[s]}`);
  if (sk.selfAp) p.push(`Leaves you ${sk.selfAp[0]}.`);
  if (sk.leech) p.push(`Heals the user for ${pct(sk.leech)} of the damage.`);
  if (sk.summon) p.push('Calls reinforcements.');
  const res = []; if (sk.gain) res.push(`+${sk.gain} point${sk.gain > 1 ? 's' : ''}`); if (typeof sk.cost === 'number') res.push(`costs ${sk.cost}`); if (sk.wt) res.push(WT_NAME[sk.wt] + ' action');
  if (sk.once) res.push('once per fight'); else if (sk.cd) res.push(`cooldown ${sk.cd}`);
  if (res.length) p.push(res.join(', ').replace(/^./, c => c.toUpperCase()) + '.');
  return p.join(' ');
}
