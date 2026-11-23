// ---------- helpers ----------
function rnd(S) { S.seed = (S.seed + 0x6D2B79F5) | 0; let t = S.seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const ri = (S, n) => Math.floor(rnd(S) * n), pick = (S, a) => a[ri(S, a.length)], die = (S, n) => 1 + ri(S, n);
function shuffle(S, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(S, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STATS = ['might', 'agility', 'mind', 'spirit'], STAT_NAME = { might: 'Might', agility: 'Agility', mind: 'Mind', spirit: 'Spirit' };
const K = { catchUp: 1.3, bigHp: 0.85, nodeXp: 2, lateLv: 0.4, vetLate: 0.25, easeN: 7, easeVet: 3, easeAtk: 1.2, easeHp: 0.25, glance: 4, mindCrit: 4, mightHp: 2, spiritResist: 0.03, spiritHeal: 0.03, focus: 0.7, campLv: [-0.32, 0.95, 3.7, 5.9, 7.3], vetLv: [0.05, 1.9, 2.85, 4.3, 2.6], conLv: 3.6, rankLv: 1.0, hp: 2.05, atk: 2.65, heroHeal: 0.15, vetHp: 1.34, vetAtk: 0.5, vetHeal: 0.12 };   // global difficulty knobs, set by simulation

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

// ---------- classes ----------
const CLASSES = {
  warrior: { n: 'Warrior', row: 'F', hp: 30, hpl: 8, st: [4, 2, 1, 2], grow: ['might', 'agility'], wp: ['sword', 'axe', 'mace', 'spear', 'flail', 'warhammer', 'crossbow'], shield: true, armor: 3, base: ['heavy', 'shove', 'taunt', 'cleave'], start: ['sword', 'shield', 'medium'],
    blurb: 'Holds the front row with heavy weapons. Builds Rage by hitting and being hit, and Sunders enemies so the whole party hits harder.',
    subs: { guardian: { n: 'Guardian', sk: ['shieldwall', 'intercept', 'slam'], blurb: 'Shields the party, takes hits for allies, and slams enemies down the timeline.' }, berserker: { n: 'Berserker', sk: ['reckless', 'whirl', 'execute'], blurb: 'Reckless swings that pile on Sunder, then an Execute that spends every point of Rage.' } } },
  rogue: { n: 'Rogue', row: 'F', hp: 22, hpl: 6, st: [2, 4, 2, 1], grow: ['agility', 'might'], wp: ['dagger', 'sabre', 'rapier', 'bow', 'crossbow'], shield: false, armor: 2, base: ['slash', 'knife', 'smoke', 'evis'], start: ['dagger', null, 'light'],
    blurb: 'Quick blades that build Combo and Bleed, then a finisher that spends it all. Agile enough to dodge some attacks.',
    subs: { assassin: { n: 'Assassin', sk: ['backstab', 'envenom', 'garrote'], blurb: 'Strikes from Hidden, poisons, and garrotes for huge Bleed and Poison.' }, ranger: { n: 'Ranger', sk: ['venomarrow', 'pinning', 'volley'], blurb: 'Fights from the back row with a bow: venom arrows, pinning shots and volleys.' } } },
  mage: { n: 'Mage', row: 'B', hp: 18, hpl: 5, st: [1, 2, 4, 2], grow: ['mind', 'spirit'], wp: ['staff', 'dagger', 'wand'], shield: false, armor: 1, base: ['abolt', 'frostshard', 'spark', 'missiles'], start: ['staff', null, 'light'],
    blurb: 'Blue magic: arcane bolts, frost that piles up until enemies freeze, and lightning that charges them. Gains Focus every turn.',
    subs: { cryomancer: { n: 'Cryomancer', sk: ['icelance', 'frostarmor', 'blizzard'], blurb: 'Piles Frost on enemies until they freeze, then cashes it in with Ice Lance.' }, stormcaller: { n: 'Stormcaller', sk: ['chain', 'thunder', 'staticfield'], blurb: 'Spreads Shock across the field and detonates it with Thunderclap.' } } },
  priest: { n: 'Priest', row: 'B', hp: 22, hpl: 6, st: [2, 1, 2, 4], grow: ['spirit', 'might'], wp: ['mace', 'staff', 'spear', 'flail', 'warhammer', 'wand'], shield: true, armor: 3, base: ['smite', 'mend', 'bless', 'revive'], start: ['mace', 'shield', 'light'],
    blurb: 'Heals and cleanses with every heal, and builds Faith to spend on big prayers. Holy damage heals as it strikes.',
    subs: { lightbringer: { n: 'Lightbringer', sk: ['radiance', 'sanctuary', 'judgement'], blurb: 'Party-wide healing, warding prayers and a holy blast.' }, flamekeeper: { n: 'Flamekeeper', sk: ['searing', 'pyre', 'holyfire'], blurb: 'A holy-fire zealot in the front row: sets enemies Burning and cashes the flames in to heal the party.' } } }
};

// ---------- items ----------
const WT = {
  sword: { n: 'Sword', die: [8, 10, 12], hit: 1, phys: 'slash', bu: { bleed: 10, stagger: 10 }, note: 'Slash; +1 to hit; builds a little Bleed and Stagger' },
  axe: { n: 'Greataxe', die: [10, 12, 14], two: true, splash: true, phys: 'slash', bu: { stagger: 25 }, note: 'two-handed heavy Slash; builds Stagger; basic attacks also hit a second front-row enemy for half' },
  sabre: { n: 'Sabre', die: [6, 8, 10], fin: true, hit: 1, phys: 'slash', bu: { bleed: 30 }, note: 'curved Slash; uses Agility; +1 to hit; builds Bleed fast' },
  mace: { n: 'Mace', die: [7, 9, 11], bonus: 1, phys: 'strike', bu: { stagger: 20 }, note: 'Strike; builds Stagger' },
  dagger: { n: 'Dagger', die: [4, 6, 8], fin: true, assassin: true, phys: 'pierce', bu: { bleed: 20 }, note: 'Pierce; uses Agility; builds Bleed; always crits Marked, Stunned or Frozen targets, and its crits deal double' },
  spear: { n: 'Spear', die: [7, 9, 11], two: true, reach: true, phys: 'pierce', note: 'two-handed Pierce; melee skills work from the back row' },
  bow: { n: 'Bow', die: [7, 9, 11], two: true, ranged: true, fin: true, phys: 'pierce', note: 'two-handed Pierce; basic attacks are ranged and use Agility' },
  staff: { n: 'Staff', die: [4, 5, 6], sp: [8, 10, 12], two: true, phys: 'strike', bu: { stagger: 10 }, note: 'two-handed; much stronger spells and heals' },
  wand: { n: 'Wand', die: [4, 5, 6], sp: [6, 8, 10], hit: 1, phys: 'strike', note: 'one-handed; stronger spells and heals, +1 to hit' },
  rapier: { n: 'Rapier', die: [6, 8, 10], fin: true, hit: 2, crit: 1, phys: 'pierce', bu: { bleed: 10 }, note: 'Pierce; uses Agility; +2 to hit and crits on 19+' },
  flail: { n: 'Flail', die: [7, 9, 11], phys: 'strike', bu: { stagger: 30 }, note: 'Strike; builds Stagger fast' },
  warhammer: { n: 'Warhammer', die: [10, 12, 14], two: true, hit: -1, phys: 'strike', bu: { stagger: 35 }, note: 'two-handed Strike; -1 to hit; builds Stagger very fast' },
  crossbow: { n: 'Crossbow', die: [9, 11, 13], two: true, ranged: true, xbow: true, init: -3, phys: 'pierce', note: 'two-handed Pierce; basic attacks are ranged and use Might or Agility, -3 initiative' }
};
for (const w of Object.values(WT)) { w.die.push(w.die[2] + 2, w.die[2] + 4); if (w.sp) w.sp.push(w.sp[2] + 2, w.sp[2] + 4); }
const TIER = ['', 'Fine ', 'Masterwork ', 'Runed ', 'Legendary '], PRICE = [20, 45, 90, 160, 260];
const ARMOR = { light: { n: ['Robes', 'Warded Robes', 'Archmage Robes', 'Runewoven Robes', 'Robes of the Magi'], arm: [0, 1, 1, 2, 2], ward: [1, 2, 4, 5, 7], rank: 1 }, medium: { n: ['Leathers', 'Brigandine', 'Shadowmail', 'Wyrmhide', 'Nightweave'], arm: [1, 2, 3, 4, 5], ward: [0, 1, 1, 2, 3], rank: 2 }, heavy: { n: ['Chainmail', 'Half-plate', 'Full Plate', 'Runed Plate', 'Dragonscale Plate'], arm: [2, 4, 5, 6, 8], ward: [0, 0, 1, 2, 3], rank: 3, slow: 1 } };
const TRINKETS = [
  ['Ring of Might', { might: 1 }, 1], ['Ring of Agility', { agility: 1 }, 1], ['Ring of Mind', { mind: 1 }, 1], ['Ring of Spirit', { spirit: 1 }, 1],
  ['Belt of Giants', { might: 2 }, 3], ['Cat-step Boots', { agility: 2 }, 3], ['Circlet of Insight', { mind: 2 }, 3], ['Saint\'s Knucklebone', { spirit: 2 }, 3],
  ['Amulet of Vigor', { hp: 8 }, 1], ['Heartstone', { hp: 16 }, 3], ['Iron Buckle', { arm: 1 }, 1], ['Ward Charm', { ward: 2 }, 1],
  ['Hawk Feather', { hit: 1 }, 1], ['Lucky Coin', { crit: 2 }, 2], ['Troll Tooth', { regen: 2 }, 2], ['Sentinel\'s Badge', { startGuard: 1 }, 2],
  ['Steady Stone', { immune: 'Stunned' }, 2], ['Salamander Scale', { immune: 'Burning' }, 1], ['Rootfoot Charm', { immune: 'Exposed' }, 1],
  ['Lingering Censer', { dur: 1 }, 2], ['Hourglass Charm', { cdr: 1 }, 2], ['Thorn Bracers', { thorns: 3 }, 2], ['Leech Fang', { leech: 0.15 }, 2],
  ['Quickening Spur', { init: 4 }, 1], ['Executioner\'s Token', { pay: 0.3 }, 2],
  ['Whetstone Pendant', { dmg: 1 }, 1], ['Giant\'s Knuckle', { dmg: 3 }, 3], ['Warding Sigil', { ward: 2, def: 1 }, 1], ['Marching Drum', { init: 2, hp: 4 }, 1],
  ['Bloodstone', { leech: 0.1, hp: 4 }, 2], ['Duelist\'s Glove', { hit: 1, crit: 1 }, 2], ['Ember Charm', { procs: [['Burning', 0.2]] }, 2], ['Tracker\'s Eye', { procs: [['Marked', 0.25]] }, 2],
  ['Rending Hook', { bu: { bleed: 20 } }, 2], ['Pilgrim\'s Flask', { healm: 0.2 }, 2], ['Guardian Idol', { arm: 1, ward: 1 }, 2], ['Featherfall Cloak', { agility: 1, init: 2 }, 2],
  ['Scholar\'s Lens', { mind: 1, hit: 1 }, 2], ['Bear Totem', { might: 1, hp: 6 }, 2], ['Prayer Beads', { spirit: 1, regen: 1 }, 2], ['Stormglass Vial', { bu: { stagger: 20 } }, 3],
  ['Phoenix Feather', { phoenix: 1 }, 3], ['Veil of Shadows', { startHidden: 1 }, 3], ['Mirror Shard', { ward: 3, def: 2 }, 3],
  ['Ring of Power', { primary: 1 }, 1], ['Band of Power', { primary: 1, hp: 4 }, 2], ['Crown of Power', { primary: 2 }, 3],
  ['Viper Fang', { bu: { poison: 20 } }, 2], ['Rimefrost Charm', { procs: [['Numbed', 0.25]] }, 2], ['Brand of the Inquisitor', { vs: [['Burning', 0.2], ['Numbed', 0.2], ['Frozen', 0.2]] }, 3]
];
// off-hand items: shields for the armoured classes, tomes for casters, parrying daggers for the quick
const OFF = { shield: { n: 'Shield', cls: ['warrior', 'priest'], def: [2, 3, 4, 5, 6], arm: [0, 1, 1, 2, 2], fx: [{}, {}, {}, {}, {}] }, tome: { n: 'Tome', cls: ['mage', 'priest'], def: [0, 0, 0, 0, 0], arm: [0, 0, 0, 0, 0], fx: [{ mind: 1 }, { mind: 1, spirit: 1 }, { mind: 2, spirit: 2 }, { mind: 3, spirit: 2 }, { mind: 4, spirit: 3 }] },
  parry: { n: 'Parrying Dagger', cls: ['rogue', 'warrior'], def: [1, 2, 2, 3, 3], arm: [0, 0, 0, 0, 0], fx: [{}, { crit: 1 }, { crit: 1, hit: 1 }, { crit: 1, hit: 2 }, { crit: 2, hit: 2 }] } };
const offOf = it => OFF[it.type || 'shield'];
const FX_TEXT = { bu: v => Object.entries(v).map(([k, a]) => `hits add +${a} ${BU_NAME[k]}`).join(', '), primary: v => `+${v} to your class's main stat`, def: v => `+${v} defence`, spd: v => `spell die +${v}`, lowhp: v => `+${pct(v)} damage while below half health`, exec: v => `+${pct(v)} damage to enemies below 30% health`, aoe: v => `+${pct(v)} damage with row and all-enemy skills`, dr: v => `takes ${pct(v)} less damage`, pen: v => `ignores ${v} armour and ward`,
  chance: v => `+${pct(v)} to your chances of applying states`, opener: () => 'first attack each fight is a critical hit', killHeal: v => `heal ${pct(v)} of your health on a kill`, spread: () => 'when a Burning enemy dies, the fire jumps to another', vs: v => v.map(p => `+${pct(p[1])} damage to ${p[0]} enemies`).join(', '), aura: v => 'the whole party gains: ' + fxText(v),
  dmg: v => `+${v} damage on every hit`, phoenix: () => 'once per fight, survive a killing blow', procs: v => v.map(p => `hits have a ${pct(p[1])} chance to apply ${p[0]}`).join(', '), healm: v => `your heals are ${pct(v)} stronger`, startHidden: () => 'starts every fight Hidden', startTaunt: () => 'starts every fight with Taunt', might: v => `+${v} Might`, agility: v => `+${v} Agility`, mind: v => `+${v} Mind`, spirit: v => `+${v} Spirit`, hp: v => `+${v} health`, arm: v => `+${v} armour`, ward: v => `+${v} ward (reduces spell damage)`, hit: v => `+${v} to hit`,
  crit: v => `crits on a roll of ${20 - v}+`, regen: v => `regain ${v} health each turn`, startGuard: () => 'starts every fight with Guard', immune: v => `immune to ${v}`, dur: v => `states you apply last ${v} turn longer`,
  cdr: v => `cooldowns are ${v} turn shorter`, thorns: v => `melee attackers take ${v} damage`, leech: v => `heal for ${pct(v)} of damage dealt`, init: v => `+${v} initiative`, pay: v => `combo bonuses are +${v} stronger` };
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
// rarity: gear gains one step per affix; trinkets by their tier; set pieces have their own
const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Set', 'Relic'], PROC_T = { Burning: 3, Exposed: 2, Marked: 3, Numbed: 2 };
const AFFIX = {
  flaming: { n: 'Flaming', on: 'w', pre: 1, fx: { procs: [['Burning', 0.25]] } }, hunters: { n: 'Heavy', on: 'w', pre: 1, fx: { bu: { stagger: 15 } } }, serrated: { n: 'Serrated', on: 'w', pre: 1, fx: { bu: { bleed: 15 } } }, venomous: { n: 'Venomous', on: 'w', pre: 1, fx: { bu: { poison: 25 } } }, frosted: { n: 'Frostbitten', on: 'w', pre: 1, fx: { procs: [['Numbed', 0.25]] } }, sundering: { n: 'Sundering', on: 'w', pre: 1, fx: { procs: [['Exposed', 0.2]] } },
  keen: { n: 'Keen', on: 'w', pre: 1, fx: { crit: 1 } }, balanced: { n: 'Balanced', on: 'w', pre: 1, fx: { hit: 1 } }, vampiric: { n: 'Vampiric', on: 'w', pre: 1, fx: { leech: 0.1 } }, swift: { n: 'Swift', on: 'w', pre: 1, fx: { init: 3 } },
  sturdy: { n: 'Sturdy', on: 'a', pre: 1, fx: { arm: 1 } }, warded: { n: 'Warded', on: 'a', pre: 1, fx: { ward: 2 } }, spiked: { n: 'Spiked', on: 'a', pre: 1, fx: { thorns: 2 } }, stalwart: { n: 'Stalwart', on: 'a', pre: 1, fx: { hp: 8 } }, mending: { n: 'Mending', on: 'a', pre: 1, fx: { regen: 1 } },
  power: { n: 'Power', fx: { primary: 1 } }, power2: { n: 'Power', fx: { primary: 1 } }, might: { n: 'Might', fx: { might: 1 } }, agility: { n: 'Agility', fx: { agility: 1 } }, mind: { n: 'Mind', fx: { mind: 1 } }, spirit: { n: 'Spirit', fx: { spirit: 1 } }, vigor: { n: 'Vigor', fx: { hp: 6 } }, duelist: { n: 'the Duelist', fx: { pay: 0.15 } }, lingering: { n: 'Lingering', fx: { dur: 1 } }
};
const SETS = {
  dawn: { n: 'Bulwark of the Dawn', pieces: [{ k: 'shield', n: 'Dawnguard Shield' }, { k: 'armor', type: 'heavy', n: 'Dawnplate' }, { k: 'trinket', n: 'Dawnstar Medal', fx: { hp: 6 } }], bonus: { 2: { arm: 2 }, 3: { thorns: 4, startGuard: 1, startTaunt: 1 } } },
  night: { n: 'Nightstalker\'s Kit', pieces: [{ k: 'weapon', type: 'dagger', n: 'Nightfang' }, { k: 'armor', type: 'medium', n: 'Nightstalker Leathers' }, { k: 'trinket', n: 'Shadow Clasp', fx: { agility: 1 } }], bonus: { 2: { crit: 1, init: 4 }, 3: { startHidden: 1, pay: 0.4 } } },
  ember: { n: 'Emberweave', pieces: [{ k: 'weapon', type: 'staff', n: 'Emberbrand Staff' }, { k: 'armor', type: 'light', n: 'Emberweave Robes' }, { k: 'trinket', n: 'Cinder Heart', fx: { mind: 1 } }], bonus: { 2: { mind: 2 }, 3: { procs: [['Burning', 0.35]], dur: 1 } } },
  mercy: { n: 'Vestments of Mercy', pieces: [{ k: 'shield', n: 'Aegis of Mercy' }, { k: 'armor', type: 'light', n: 'Vestments of Mercy' }, { k: 'trinket', n: 'Rosary of Mercy', fx: { spirit: 1 } }], bonus: { 2: { spirit: 2 }, 3: { healm: 0.3, regen: 3 } } },
  signet: { n: 'The Twin Signets', pieces: [{ k: 'trinket', n: 'Sun Signet', fx: { might: 1 } }, { k: 'trinket', n: 'Moon Signet', fx: { mind: 1 } }], bonus: { 2: { hp: 10, hit: 1 } } }
};
// relics: one-of-a-kind items that only turn up on contracts of rank 3 and above
const UNIQUES = {
  dawnbreaker: { k: 'weapon', type: 'sword', n: 'Dawnbreaker', fx: { dmg: 3, hit: 1, procs: [['Burning', 0.3]] } }, widowmaker: { k: 'weapon', type: 'dagger', n: 'Widowmaker', fx: { crit: 3, vs: [['Marked', 0.3]], bu: { poison: 20 } } },
  stormcall: { k: 'weapon', type: 'staff', n: 'Stormcall', fx: { spd: 4, bu: { stagger: 20 }, mind: 2 } }, longwatch: { k: 'weapon', type: 'bow', n: 'Longwatch', fx: { pen: 4, hit: 2, init: 4 } },
  kingsbane: { k: 'weapon', type: 'warhammer', n: 'Kingsbane', fx: { exec: 0.4, dmg: 2, bu: { stagger: 20 } } }, gravemace: { k: 'weapon', type: 'mace', n: 'Gravemace', fx: { leech: 0.2, spirit: 2, might: 1 } },
  oathkeeper: { k: 'shield', type: 'shield', n: 'Oathkeeper', fx: { arm: 2, dr: 0.1, startGuard: 1 } }, mountain: { k: 'armor', type: 'heavy', n: 'Mountain\'s Heart', fx: { hp: 25, regen: 3 } },
  shadowskin: { k: 'armor', type: 'medium', n: 'Shadowskin', fx: { def: 3, agility: 2, startHidden: 1 } }, mantle: { k: 'armor', type: 'light', n: 'Mantle of Stars', fx: { ward: 4, mind: 2, cdr: 1 } },
  tear: { k: 'trinket', n: 'Saint\'s Tear', fx: { healm: 0.35, spirit: 2 } }, embercrown: { k: 'trinket', n: 'Crown of Embers', fx: { aoe: 0.25, pay: 0.3 } }
};
function mergeFx(into, fx) { for (const [k, v] of Object.entries(fx || {})) { if (k === 'immune') (into.immune = into.immune || []).push(...[].concat(v)); else if (k === 'procs') into.procs = (into.procs || []).concat(v); else if (k === 'vs') into.vs = (into.vs || []).concat(v); else if (k === 'bu') { into.bu = { ...(into.bu || {}) }; for (const [b, a] of Object.entries(v)) into.bu[b] = (into.bu[b] || 0) + a; } else if (k === 'aura') into.aura = mergeFx(into.aura || {}, v); else into[k] = (into[k] || 0) + v; } return into; }
// fills in the derived fields (name, effects, rarity, price) after an item is made or changed
function finish(it) {
  if (it.k === 'cons') { it.r = 0; return it; }
  const piece = it.set ? SETS[it.set].pieces[it.pi] : it.uq ? UNIQUES[it.uq] : null, afx = it.afx || [];
  if (it.k !== 'trinket' || piece) { it.fx = {}; if (piece) mergeFx(it.fx, piece.fx); if (it.k === 'shield') mergeFx(it.fx, offOf(it).fx[it.tier - 1]); for (const a of afx) mergeFx(it.fx, AFFIX[a].fx); }
  const base = piece ? (it.k === 'trinket' ? '' : TIER[it.tier - 1]) + piece.n : it.k === 'weapon' ? TIER[it.tier - 1] + WT[it.type].n : it.k === 'shield' ? TIER[it.tier - 1] + offOf(it).n : it.k === 'armor' ? ARMOR[it.type].n[it.tier - 1] : it.n;
  const pre = afx.filter(a => AFFIX[a].pre).map(a => AFFIX[a].n + ' ').join(''), suf = afx.filter(a => !AFFIX[a].pre).map(a => AFFIX[a].n);
  it.n = pre + base + (suf.length ? ' of ' + suf.join(' and ') : '');
  it.r = it.uq ? 5 : piece ? 4 : it.k === 'trinket' ? it.tier : afx.length;
  it.price = Math.round((it.k === 'trinket' ? 15 + 15 * it.tier : PRICE[it.tier - 1] * (it.k === 'shield' ? 0.8 : 1)) * (it.uq ? 3 : piece ? 2 : 1 + 0.35 * afx.length)); return it;
}
function mkWeapon(type, tier) { return finish({ k: 'weapon', type, tier, afx: [] }); }
function mkShield(tier, type) { return finish({ k: 'shield', type: type || 'shield', tier, afx: [] }); }
function mkArmor(type, tier) { return finish({ k: 'armor', type, tier, afx: [] }); }
function mkTrinket(i) { const t = TRINKETS[i]; return finish({ k: 'trinket', ti: i, n: t[0], fx: t[1], tier: t[2] }); }
function mkCons(id, qty) { return finish({ k: 'cons', id, n: CONS[id].n, qty: qty || 1, price: CONS[id].price * (qty || 1) }); }
function mkUnique(id) { const u = UNIQUES[id]; return finish({ k: u.k, type: u.type, tier: 5, uq: id, ti: -1, afx: [] }); }
function mkSet(set, pi, tier) { const p = SETS[set].pieces[pi]; return finish({ k: p.k, type: p.type, tier: p.k === 'trinket' ? 3 : tier, set, pi, ti: -1, afx: [] }); }
function fxText(fx) { return Object.entries(fx || {}).map(([k, v]) => FX_TEXT[k] ? FX_TEXT[k](v) : '').filter(Boolean).join(', '); }
function itemDesc(it) {
  if (it.k === 'cons') return CONS[it.id].d + (it.qty > 1 ? ` (x${it.qty})` : '');
  let d = '';
  if (it.k === 'weapon') { const w = WT[it.type]; d = `d${w.die[it.tier - 1]} damage${w.bonus ? '+' + w.bonus : ''}${w.sp ? `, d${w.sp[it.tier - 1]} spell die` : ''}; ${w.note}.`; }
  else if (it.k === 'shield') { const o = offOf(it), t = it.tier - 1; d = `Off-hand${o.def[t] ? `, +${o.def[t]} defence` : ''}${o.arm[t] ? `, +${o.arm[t]} armour` : ''}. Not usable with two-handed weapons.`; }
  else if (it.k === 'armor') { const a = ARMOR[it.type]; d = `${it.type[0].toUpperCase() + it.type.slice(1)} armour: ${a.arm[it.tier - 1]} armour, ${a.ward[it.tier - 1]} ward${a.slow ? ', -1 Agility' : ''}.`; }
  const f = fxText(it.fx); return (d + (f ? ' ' + f[0].toUpperCase() + f.slice(1) + '.' : '')).trim();
}
function setCount(h, set) { return Object.values(h.gear).filter(g => g && g.set === set).length; }
function setLines(set) { const s = SETS[set]; return Object.entries(s.bonus).map(([n, fx]) => `${n} pieces: ${fxText(fx)}`); }
function canUse(h, it) { const c = CLASSES[h.cls];
  if (it.k === 'weapon') return c.wp.includes(it.type) || (it.type === 'bow' && h.sub === 'ranger');
  if (it.k === 'shield') return offOf(it).cls.includes(h.cls); if (it.k === 'armor') return ARMOR[it.type].rank <= c.armor; return true; }
function itemScore(it) { if (!it) return 0; return it.tier + (it.uq ? 2.5 : it.set ? 1.2 : it.k === 'trinket' ? 0 : 0.4 * (it.afx || []).length); }
// what equipping would replace; returns the old item (or null)
function slotOf(h, it) { return it.k === 'weapon' ? 'w' : it.k === 'shield' ? 'off' : it.k === 'armor' ? 'a' : (!h.gear.t1 ? 't1' : !h.gear.t2 ? 't2' : 't1'); }
// Equipping never destroys anything: whatever comes off goes into the shared pack.
function equip(S, h, it) {
  const slot = slotOf(h, it), old = h.gear[slot], m0 = maxHp(h);
  if (slot === 't1' && old && h.gear.t2) { h.gear.t1 = h.gear.t2; h.gear.t2 = it; } else h.gear[slot] = it;
  if (old) S.stash.push(old);
  if (it.k === 'weapon' && WT[it.type].two && h.gear.off) { S.stash.push(h.gear.off); h.gear.off = null; }
  if (it.k === 'shield' && h.gear.w && WT[h.gear.w.type].two) { S.stash.push(h.gear.w); const si = S.stash.findIndex(x => x.k === 'weapon' && !WT[x.type].two && canUse(h, x)); h.gear.w = si >= 0 ? S.stash.splice(si, 1)[0] : mkWeapon({ warrior: 'sword', rogue: 'dagger', mage: 'wand', priest: 'mace' }[h.cls], 1); }
  h.hp = clamp(h.hp + Math.max(0, maxHp(h) - m0), 1, maxHp(h));
}
const packable = S => S.screen !== 'combat' && S.screen !== 'end';
function fromStash(S, si, hi) { const it = S.stash[si], h = S.party[hi]; if (!packable(S) || !it || !h || !canUse(h, it)) return false; S.stash.splice(si, 1); equip(S, h, it); return true; }
function unequip(S, hi, slot) { const h = S.party[hi]; if (!packable(S) || !h || slot === 'w' || !h.gear[slot]) return false; S.stash.push(h.gear[slot]); h.gear[slot] = null; if (slot === 't1' && h.gear.t2) { h.gear.t1 = h.gear.t2; h.gear.t2 = null; } h.hp = clamp(h.hp, 1, maxHp(h)); return true; }
const sellValue = (S, it) => Math.round(it.price * (room(S, 'armoury') ? 0.75 : 0.5));
function sellStash(S, si) { const it = S.stash[si]; if (!it || (S.screen !== 'shop' && S.screen !== 'town')) return false; S.gold += sellValue(S, it); S.stash.splice(si, 1); return true; }

// ---------- talents: one of two at each of levels 6 to 10 ----------
const TALENTS = {
  guardian: [[['Iron Skin', { arm: 2 }], ['Shield Wall', { def: 2 }]], [['Stalwart', { hp: 16 }], ['Retribution', { thorns: 4 }]], [['Rallying Presence', { aura: { arm: 1 } }], ['Unbreakable', { immune: 'Stunned' }]], [['Punisher', { vs: [['Exposed', 0.25]] }], ['Second Wind', { regen: 4 }]], [['Living Fortress', { dr: 0.2, hp: 10 }], ['Warden\'s Oath', { startGuard: 1, startTaunt: 1 }]]],
  berserker: [[['Bloodlust', { lowhp: 0.25 }], ['Brutal Force', { dmg: 3, hp: 6 }]], [['Butcher', { exec: 0.3 }], ['Thick Hide', { hp: 14 }]], [['Feast', { killHeal: 0.15 }], ['Savage', { crit: 2 }]], [['Opportunist', { vs: [['Stunned', 0.35], ['Exposed', 0.15]] }], ['Relentless', { cdr: 1 }]], [['Rampage', { aoe: 0.3, bu: { bleed: 10 } }], ['Deathless Rage', { phoenix: 1 }]]],
  assassin: [[['Opener', { opener: 1 }], ['Precision', { hit: 2 }]], [['Lethality', { crit: 2 }], ['Slippery', { def: 2 }]], [['Exploit Weakness', { pay: 0.4 }], ['Venom', { bu: { poison: 25 } }]], [['Cull', { exec: 0.35 }], ['Shadowstep', { startHidden: 1 }]], [['Master Assassin', { vs: [['Marked', 0.45]], crit: 1 }], ['Quick Hands', { cdr: 1 }]]],
  ranger: [[['Eagle Eye', { hit: 2 }], ['Fleet', { init: 5 }]], [['Hunter\'s Mark', { procs: [['Marked', 0.3]] }], ['Camouflage', { def: 3, hp: 8 }]], [['Piercing Arrows', { pen: 3 }], ['Steady Aim', { crit: 2, dmg: 1 }]], [['Suppressing Fire', { aoe: 0.3 }], ['Predator', { vs: [['Marked', 0.3]] }]], [['Deadeye', { dmg: 3 }], ['Trapper', { chance: 0.2, dur: 1 }]]],
  cryomancer: [[['Rime', { procs: [['Numbed', 0.3]] }], ['Focus', { mind: 1, hit: 1 }]], [['Permafrost', { dur: 1 }], ['Ice Armour', { ward: 3, immune: 'Numbed' }]], [['Cold Snap', { vs: [['Numbed', 0.25]] }], ['Glacial Ward', { aura: { ward: 1 }, def: 1 }]], [['Hailstorm', { aoe: 0.3 }], ['Quickened Casting', { cdr: 1 }]], [['Heart of Winter', { vs: [['Frozen', 0.5]] }], ['Arcane Might', { spd: 4 }]]],
  stormcaller: [[['Static', { bu: { stagger: 15 } }], ['Focus', { mind: 1, hit: 1 }]], [['Overcharge', { vs: [['Stunned', 0.3]] }], ['Storm Ward', { ward: 3, def: 1 }]], [['Forked Lightning', { aoe: 0.3 }], ['Tailwind', { init: 5, def: 2 }]], [['Thunderstruck', { bu: { stagger: 20 } }], ['Quickened Casting', { cdr: 1 }]], [['Eye of the Storm', { pen: 4, crit: 1 }], ['Arcane Might', { spd: 4 }]]],
  lightbringer: [[['Gentle Hands', { healm: 0.2 }], ['Devotion', { spirit: 1, hp: 6 }]], [['Beacon', { aura: { regen: 2 } }], ['Sanctified', { ward: 3 }]], [['Radiant', { vs: [['Burning', 0.25], ['Numbed', 0.25]] }], ['Swift Prayers', { cdr: 1 }]], [['Benediction', { aura: { hit: 1, regen: 1 } }], ['Martyr', { hp: 14 }]], [['Miracle Worker', { healm: 0.3 }], ['Divine Wrath', { spd: 4 }]]],
  flamekeeper: [[['Zeal', { dmg: 3, hp: 6 }], ['Devotion', { spirit: 1, hp: 6 }]], [['Armour of Faith', { arm: 2 }], ['Fire Ward', { ward: 2, immune: 'Burning' }]], [['Crusader', { aura: { dmg: 1 } }], ['Righteous Fire', { vs: [['Burning', 0.25]] }]], [['Kindled Faith', { procs: [['Burning', 0.3]] }], ['Blood for Blessing', { leech: 0.15 }]], [['Avatar of Flame', { dr: 0.12, lowhp: 0.2 }], ['Shepherd', { healm: 0.25, aura: { regen: 2 } }]]]
};
// each path's built-in strengths, on top of its skills
const SUBFX = { guardian: { arm: 2, hp: 8 }, berserker: { hp: 10, leech: 0.1 }, assassin: { crit: 1, def: 2, hp: 8 }, ranger: {}, cryomancer: {}, stormcaller: {}, lightbringer: { healm: 0.2 }, flamekeeper: { arm: 2, hp: 12, healm: 0.4, leech: 0.15 } };
const talentsOf = h => h.sub ? (h.tal || []).map((c, k) => c === 0 || c === 1 ? TALENTS[h.sub][k][c] : null).filter(Boolean) : [];
function setTalent(S, hi, k, c) { const h = S.party[hi]; if (!h || !h.sub || k < 0 || k > h.level - 6 || (c !== 0 && c !== 1)) return false; h.tal = h.tal || []; const m0 = maxHp(h); h.tal[k] = c; h.hp = clamp(h.hp + Math.max(0, maxHp(h) - m0), 1, maxHp(h)); return true; }

// ---------- heroes ----------
function heroFx(h) { const fx = {}, sets = {}; for (const g of Object.values(h.gear)) { if (!g) continue; mergeFx(fx, g.fx); if (g.set) sets[g.set] = (sets[g.set] || 0) + 1; }
  for (const [k, n] of Object.entries(sets)) for (const [need, b] of Object.entries(SETS[k].bonus)) if (n >= +need) mergeFx(fx, b);
  if (h.sub && SUBFX[h.sub]) mergeFx(fx, SUBFX[h.sub]); for (const t of talentsOf(h)) mergeFx(fx, t[1]); if (h.bonus) mergeFx(fx, h.bonus); return fx; }
function heroStat(h, s) { const c = CLASSES[h.cls], L = h.level - 1, fx = heroFx(h);
  return c.st[STATS.indexOf(s)] + (c.grow[0] === s ? L : c.grow[1] === s ? L >> 1 : 0) + (fx[s] || 0) + (c.grow[0] === s ? fx.primary || 0 : 0) - (s === 'agility' && h.gear.a && ARMOR[h.gear.a.type].slow ? 1 : 0); }
function maxHp(h) { const c = CLASSES[h.cls]; return Math.max(1, Math.round((c.hp + c.hpl * (h.level - 1) + (heroFx(h).hp || 0) + K.mightHp * heroStat(h, 'might')) * (1 - 0.1 * h.wounds))); }
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
const AR_NAME = { cloth: 'Cloth or flesh', hide: 'Hide', mail: 'Mail', plate: 'Plate', bone: 'Bone', spirit: 'Spirit' };
const FAM = {
  bandit: { n: 'Bandits', aff: {}, bres: {}, weak: 'Bandits panic when Marked (+25% damage taken).' },
  undead: { n: 'Undead', aff: { holy: 1.5, fire: 1.25, frost: 0.75 }, bres: { bleed: 0, poison: 0 }, weak: 'Weak to holy (x1.5) and fire (x1.25); shrug off frost (x0.75); cannot bleed or be poisoned.' },
  beast: { n: 'Beasts', aff: { fire: 1.5, lightning: 0.8 }, bres: { bleed: 1.25 }, weak: 'Weak to fire (x1.5) and bleed easily; thick hides dull lightning (x0.8).' },
  cult: { n: 'Cultists', aff: { fire: 0.5, holy: 1.3 }, bres: {}, weak: 'Fire-blessed (fire x0.5) but weak to holy (x1.3).' }
};
const EN = {
  cutpurse: { n: 'Cutpurse', fam: 'bandit', ar: 'cloth', hp: 12, atk: 2, agi: 4, arm: 0, ward: 0, die: 4, row: 'F', sk: ['e_hit'] },
  thug: { n: 'Thug', fam: 'bandit', ar: 'mail', hp: 18, atk: 3, agi: 1, arm: 1, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_trip'] },
  archer: { n: 'Bandit Archer', fam: 'bandit', ar: 'cloth', hp: 11, atk: 3, agi: 3, arm: 0, ward: 0, die: 6, row: 'B', sk: ['e_shot', 'e_mark'] },
  xbow: { n: 'Crossbowman', fam: 'bandit', ar: 'mail', hp: 14, atk: 4, agi: 2, arm: 2, ward: 0, die: 8, row: 'B', sk: ['e_shot'], act: 2 },
  hedgemage: { n: 'Hedge Mage', fam: 'bandit', ar: 'cloth', hp: 10, atk: 3, agi: 2, arm: 0, ward: 1, die: 6, row: 'B', sk: ['e_fire', 'e_expose'], act: 2 },
  captain: { n: 'Bandit Captain', fam: 'bandit', ar: 'mail', hp: 40, atk: 4, agi: 3, arm: 2, ward: 0, die: 8, row: 'F', sk: ['e_hit', 'e_cleave', 'e_rally'], elite: true },
  skeleton: { n: 'Skeleton', fam: 'undead', ar: 'bone', hp: 13, atk: 3, agi: 2, arm: 2, ward: 0, die: 6, row: 'F', sk: ['e_hit'] },
  zombie: { n: 'Zombie', fam: 'undead', ar: 'cloth', hp: 24, atk: 3, agi: 0, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_trip'] },
  drowned: { n: 'Drowned One', fam: 'undead', ar: 'cloth', aff: { lightning: 1.5, fire: 0.75 }, hp: 22, atk: 3, agi: 1, arm: 0, ward: 1, die: 7, row: 'F', sk: ['e_hit', 'e_frost'] },
  bonearcher: { n: 'Bone Archer', fam: 'undead', ar: 'bone', hp: 10, atk: 3, agi: 3, arm: 1, ward: 0, die: 6, row: 'B', sk: ['e_shot'] },
  ghoul: { n: 'Ghoul', fam: 'undead', ar: 'hide', hp: 16, atk: 4, agi: 3, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_bite'], act: 2 },
  wraith: { n: 'Wraith', fam: 'undead', ar: 'spirit', hp: 14, atk: 4, agi: 4, arm: 0, ward: 2, die: 6, row: 'B', sk: ['e_drain', 'e_expose'], act: 2 },
  warden: { n: 'Barrow Warden', fam: 'undead', ar: 'plate', hp: 42, atk: 5, agi: 2, arm: 3, ward: 0, die: 8, row: 'F', sk: ['e_hit', 'e_crush', 'e_curse'], elite: true },
  wolf: { n: 'Wolf', fam: 'beast', ar: 'hide', hp: 12, atk: 3, agi: 4, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_trip'] },
  boar: { n: 'Tusker', fam: 'beast', ar: 'hide', hp: 18, atk: 3, agi: 2, arm: 1, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_charge'] },
  spider: { n: 'Giant Spider', fam: 'beast', ar: 'hide', hp: 11, atk: 2, agi: 3, arm: 0, ward: 0, die: 5, row: 'B', sk: ['e_venom', 'e_web'] },
  lurker: { n: 'Marsh Lurker', fam: 'beast', ar: 'hide', aff: { fire: 1, frost: 1.3 }, hp: 20, atk: 3, agi: 2, arm: 1, ward: 0, die: 7, row: 'F', sk: ['e_hit', 'e_venom'] },
  bats: { n: 'Bat Swarm', fam: 'beast', ar: 'hide', hp: 9, atk: 2, agi: 6, arm: 0, ward: 0, die: 4, row: 'B', sk: ['e_shot'], act: 2 },
  bear: { n: 'Cave Bear', fam: 'beast', ar: 'hide', hp: 48, atk: 5, agi: 2, arm: 1, ward: 0, die: 10, row: 'F', sk: ['e_hit', 'e_maul', 'e_roar'], elite: true },
  troll: { n: 'Hill Troll', fam: 'beast', ar: 'hide', hp: 52, atk: 5, agi: 1, arm: 2, ward: 0, die: 10, row: 'F', sk: ['e_hit', 'e_crush', 'e_roar'], elite: true, regen: 0.05 },
  acolyte: { n: 'Acolyte', fam: 'cult', ar: 'cloth', hp: 10, atk: 2, agi: 2, arm: 0, ward: 1, die: 5, row: 'B', sk: ['e_bolt', 'e_heal'] },
  zealot: { n: 'Zealot', fam: 'cult', ar: 'cloth', hp: 15, atk: 3, agi: 3, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_charge'] },
  flamecaller: { n: 'Flamecaller', fam: 'cult', ar: 'cloth', hp: 10, atk: 3, agi: 2, arm: 0, ward: 2, die: 5, row: 'B', sk: ['e_fire', 'e_firewave'], act: 2 },
  hexer: { n: 'Hexer', fam: 'cult', ar: 'cloth', hp: 10, atk: 3, agi: 2, arm: 0, ward: 2, die: 6, row: 'B', sk: ['e_bolt', 'e_expose', 'e_mark'], act: 2 },
  imp: { n: 'Imp', fam: 'cult', ar: 'hide', hp: 9, atk: 3, agi: 5, arm: 0, ward: 1, die: 4, row: 'F', sk: ['e_fire', 'e_hit'] },
  champion: { n: 'Cult Champion', fam: 'cult', ar: 'plate', hp: 44, atk: 5, agi: 3, arm: 2, ward: 2, die: 8, row: 'F', sk: ['e_hit', 'e_crush', 'e_rally'], elite: true },
  // story enemies: fight objectives
  runner: { n: 'Messenger', fam: 'bandit', ar: 'cloth', hp: 7, atk: 2, agi: 2, arm: 0, ward: 0, die: 4, row: 'B', sk: ['e_shot'], story: true },
  // bosses
  banditking: { n: 'Bandit King', fam: 'bandit', ar: 'mail', hp: 90, atk: 6, agi: 4, arm: 2, ward: 1, die: 10, row: 'F', sk: ['e_hit', 'e_cleave', 'e_crush', 'e_rally', 'e_callthugs'], boss: true },
  necro: { n: 'Necromancer', fam: 'undead', ar: 'cloth', bres: { bleed: 0.6, poison: 0.6 }, hp: 64, atk: 6, agi: 3, arm: 0, ward: 3, die: 9, row: 'B', sk: ['e_drain', 'e_curse', 'e_deathbolt', 'e_raise'], boss: true },
  knight: { n: 'Hollow Knight', fam: 'undead', ar: 'plate', hp: 100, atk: 6, agi: 2, arm: 4, ward: 1, die: 10, row: 'F', sk: ['e_hit', 'e_crush', 'e_cleave', 'e_curse'], boss: true },
  beastlord: { n: 'Beastlord', fam: 'beast', ar: 'hide', hp: 85, atk: 6, agi: 4, arm: 1, ward: 1, die: 10, row: 'F', sk: ['e_hit', 'e_maul', 'e_roar', 'e_callwolves'], boss: true },
  prophet: { n: 'Prophet', fam: 'cult', ar: 'cloth', hp: 72, atk: 6, agi: 3, arm: 0, ward: 3, die: 9, row: 'B', sk: ['e_fire', 'e_firewave', 'e_heal', 'e_callimps'], boss: true },
  arch1: { n: 'The Regent', fam: 'cult', ar: 'plate', hp: 95, atk: 6, agi: 4, arm: 2, ward: 2, die: 10, row: 'F', sk: ['e_hit', 'e_crush', 'e_curse', 'e_rally', 'e_callimps'], boss: true, next: 'arch2' },
  arch2: { n: 'The Regent Unbound', fam: 'cult', ar: 'spirit', aff: { fire: 0.5, holy: 1.5 }, hp: 100, atk: 7, agi: 4, arm: 1, ward: 4, die: 11, row: 'F', sk: ['e_deathbolt', 'e_breath', 'e_drain', 'e_raise', 'e_tail'], boss: true },
  wyrm: { n: 'Wyrm', fam: 'cult', ar: 'plate', aff: { fire: 0.25, frost: 1.5, holy: 1 }, hp: 96, atk: 6, agi: 3, arm: 3, ward: 2, die: 10, row: 'F', sk: ['e_hit', 'e_breath', 'e_tail'], boss: true }
};
const affOf = e => ({ ...FAM[e.fam].aff, ...(e.aff || {}) }), bresOf = e => ({ bleed: 1, poison: 1, stagger: 1, ...FAM[e.fam].bres, ...(e.bres || {}) });
// the first few fights of a run ramp up to full strength, so a new party can find its feet
const rampOf = S => Math.max(0, 1 - (S.stats ? S.stats.fights : 9) / (S.diff ? K.easeVet : K.easeN));
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

function endCombat(S) {
  const C = S.C; for (const u of C.units) if (u.side === 'H' && !u.npc && !u.comp) { const h = S.party[u.hi]; h.row = u.row; h.hp = u.down ? 0 : u.hp; }
  const comp = C.units.find(u => u.comp), lost = [];
  if (comp && S.comp) { if (comp.down || !up(comp)) { lost.push(`${S.comp.name} is too badly hurt to go on, and leaves the party.`); S.comp = null; } else S.comp.hp = comp.hp; }
  if (C.over === 'lose') { S.C = null; if (S.camp) chapterEnd(S, false); else { S.screen = 'end'; S.result = 'defeat'; } return; }
  const objNote = objEnd(S, C);
  for (const h of S.party) { const m = maxHp(h); h.hp = h.hp <= 0 ? Math.round(m * 0.25) : Math.min(m, h.hp + Math.round(m * (S.diff ? K.vetHeal : K.heroHeal) * (hasMod(S, 'frail') ? 0.5 : 1))); }
  if (S.comp) S.comp.hp = Math.min(S.comp.max, S.comp.hp + Math.round(S.comp.max * 0.2));
  const node = S.map[S.pos], big = C.boss ? 3 : C.elite ? 1.8 : 1; S.C = null;
  if (C.boss && !S.camp) { S.screen = 'end'; S.result = 'victory'; S.gold += 100; return; }
  const P = pw(S), gold = Math.round((10 + 6 * P + ri(S, 8)) * big * (1 + perk(S, 'gold'))); S.gold += gold; S.stats.gold = (S.stats.gold || 0) + gold; if (C.boss) S.stats.bosses = (S.stats.bosses || 0) + 1; const xpg = xpGain(S, 10 * big) + (C.obj && C.obj.won ? xpGain(S, 4) : 0);
  S.loot = { gold, xp: xpg, items: rollLoot(S, Math.round(P) + (C.elite || C.boss ? 1 : 0)), notes: [objNote, ...lost].filter(Boolean) }; S.screen = 'loot';
  if (node.lt) { const sp = rollSet(S, Math.round(P) + 1); if (sp) S.loot.items[0] = sp; }
  if (C.boss && S.camp && S.q.rank >= 3 && rnd(S) < 0.3 + 0.2 * S.q.mods.length) { const u = rollUnique(S); if (u) S.loot.items[1] = u; }
}

// How far along the party is, on the one-shot's scale of acts (1 to 3). In a campaign it keeps climbing with the chapters.
const pw = S => S.camp ? Math.min(6, S.camp.ch) + (S.screen !== 'town' && S.pos >= 0 && S.map[S.pos].act > 1 ? 0.5 : 0) : S.pos >= 0 ? S.map[S.pos].act : 1;
const maxTier = S => S.camp ? Math.min(5, S.camp.ch + 1) : 3, maxLevel = S => S.camp ? 10 : 5;
const evAct = (S, n) => !S.camp ? n.act : n.act > 1 ? 3 : S.camp.ch <= 2 ? 1 : 2;

// ---------- loot, shops, rest ----------
function rollAffixes(S, it, n) {
  // stat suffixes come up less often than 'of Power', which always feeds the wearer's main stat
  const on = it.k === 'weapon' ? 'w' : 'a', pres = Object.keys(AFFIX).filter(a => AFFIX[a].pre && AFFIX[a].on === on), sufs = Object.keys(AFFIX).filter(a => !AFFIX[a].pre), out = [];
  if (n >= 3 || (n === 2 && rnd(S) < 0.7) || (n === 1 && rnd(S) < 0.5)) out.push(pick(S, pres));
  while (out.length < n) { const a = pick(S, sufs); if (!out.includes(a) && !(a.startsWith('power') && out.some(x => x.startsWith('power')))) out.push(a); } it.afx = out; return finish(it);
}
const RAR_W = [[0, 0, 0, 0], [55, 33, 11, 1], [35, 38, 22, 5], [20, 35, 32, 13], [12, 30, 36, 22]];
function rollRarity(S, lvl) { const w = RAR_W[clamp(lvl, 1, 4)]; let r = rnd(S) * 100; for (let k = 0; k < 4; k++) { r -= w[k]; if (r < 0) return k; } return 0; }
function rollSet(S, tier) {
  const owned = {}; for (const g of S.party.flatMap(h => Object.values(h.gear)).concat(S.stash)) if (g && g.set) (owned[g.set] = owned[g.set] || new Set()).add(g.pi);
  const opts = []; for (const k of Object.keys(SETS)) SETS[k].pieces.forEach((p, pi) => { if (owned[k] && owned[k].has(pi)) return; const it = mkSet(k, pi, clamp(tier, 2, maxTier(S))); if (S.party.some(h => canUse(h, it))) opts.push([it, owned[k] ? 14 : 1]); });
  if (!opts.length) return null; let r = rnd(S) * opts.reduce((a, o) => a + o[1], 0); for (const o of opts) { r -= o[1]; if (r < 0) return o[0]; } return opts[0][0];
}
// lvl: act of the stop, +1 for elites; it sets base quality, rarity odds and the chance of a set piece
function rollGear(S, lvl, kind) {
  const tier = S.camp ? clamp(Math.ceil(lvl * 0.75), 1, 5) : clamp(lvl, 1, 3);
  if (!kind && rnd(S) < [0, 0.05, 0.11, 0.16, 0.26][clamp(lvl, 1, 4)]) { const it = rollSet(S, tier); if (it) return it; }
  for (let tries = 0; tries < 30; tries++) { const r = kind || pick(S, ['weapon', 'weapon', 'armor', 'shield']); let it;
    const want = S.party.filter(h => h.sub).map(h => SUBWP[h.sub]);
    if (r === 'weapon') it = mkWeapon(want.length && rnd(S) < 0.5 ? pick(S, want) : pick(S, Object.keys(WT)), tier); else if (r === 'armor') it = mkArmor(pick(S, Object.keys(ARMOR)), tier); else it = mkShield(tier, pick(S, Object.keys(OFF)));
    rollAffixes(S, it, rollRarity(S, lvl));
    if (S.party.some(h => canUse(h, it) && itemScore(h.gear[slotOf(h, it)]) <= itemScore(it) && !(h.gear[slotOf(h, it)] && h.gear[slotOf(h, it)].n === it.n))) return it; }
  return rollTrinket(S, tier);
}
function rollTrinket(S, tier) { const have = new Set(S.stash.filter(x => x.k === 'trinket').map(x => x.ti)); for (const h of S.party) for (const s of ['t1', 't2']) if (h.gear[s]) have.add(h.gear[s].ti);
  tier = clamp(tier, 1, 3); const pool = TRINKETS.map((t, i) => i).filter(i => TRINKETS[i][2] <= tier && !have.has(i)); return mkTrinket(pool.length ? pick(S, pool) : ri(S, TRINKETS.length)); }
function rollCons(S, tier, qty) { tier = clamp(tier, 1, 3); const pool = Object.keys(CONS).filter(k => (CONS[k].tier || 1) <= tier); return mkCons(pick(S, pool), qty); }
function rollLoot(S, lvl) { const up1 = () => lvl + (rnd(S) < 0.2 ? 1 : 0); return [rollGear(S, up1()), rnd(S) < 0.6 ? rollTrinket(S, up1()) : rollGear(S, up1()), rollCons(S, lvl, 2)]; }
function addBag(S, it) { const b = S.bag.find(x => x.id === it.id); if (b) b.qty += it.qty; else S.bag.push({ id: it.id, qty: it.qty }); }
function give(S, it, hi) { if (it.k === 'cons') { addBag(S, it); return true; } note(S, it); if (hi < 0) { S.stash.push(it); return true; } const h = S.party[hi]; if (!h || !canUse(h, it)) return false; equip(S, h, it); return true; }
function takeLoot(S, k, hi) { if (k < 0) S.gold += 10; else if (!give(S, S.loot.items[k], hi === undefined ? -1 : hi)) return false; S.loot = null; finishNode(S); return true; }
function openShop(S) { const t = Math.round(pw(S)), items = [rollGear(S, t), rollGear(S, t), rollGear(S, t + 1), rollTrinket(S, t), rollTrinket(S, t + 1), mkCons('potion', 1), mkCons('salts', 1), rollCons(S, t, 1)];
  const disc = S.q.flags.helped ? 0.8 : 1; for (const it of items) it.price = Math.round(it.price * (0.8 + 0.2 * Math.min(3, t)) * disc); S.shop = { items, healCost: 10 + 5 * t }; S.screen = 'shop'; }
function buy(S, k, hi) { const it = S.shop.items[k]; if (!it || it.sold || S.gold < it.price) return false; if (it.k !== 'cons' && hi >= 0 && !(S.party[hi] && canUse(S.party[hi], it))) return false; S.gold -= it.price; give(S, it, hi); it.sold = true; return true; }
// the smith works on equipped gear: raise its quality, add an enchantment, or reroll the ones it has
const SMITH = { upgrade: 'Improve', enchant: 'Enchant', reforge: 'Reforge' };
function smithCost(it, op, S) { if (!it || it.k === 'cons') return 0;
  if (op === 'upgrade') return it.k !== 'trinket' && it.tier < (S ? maxTier(S) : 3) ? Math.round([30, 60, 140, 260][it.tier - 1] * (S && room(S, 'forge') ? 0.75 : 1)) : 0;
  if (it.set || it.uq || it.k === 'trinket') return 0; const n = (it.afx || []).length, f = S && room(S, 'forge') ? 0.75 : 1; return Math.round((op === 'enchant' ? (n < 3 ? [30, 50, 75][n] : 0) : n ? 20 : 0) * f); }
function smith(S, hi, slot, op) { const h = S.party[hi], it = h && h.gear[slot], cost = smithCost(it, op, S); if (!cost || S.gold < cost || !S.shop) return false; S.gold -= cost;
  const m0 = maxHp(h); if (op === 'upgrade') { it.tier++; finish(it); } else if (op === 'enchant') { const want = it.afx.length + 1, keep = it.afx.slice(); for (let k = 0; k < 40; k++) { rollAffixes(S, it, want); if (keep.every(a => it.afx.includes(a))) break; it.afx = keep; } if (it.afx.length < want) { rollAffixes(S, it, want); } }
  else { const old = it.afx.join(); for (let k = 0; k < 10; k++) { rollAffixes(S, it, it.afx.length); if (it.afx.join() !== old) break; } }
  h.hp = clamp(h.hp + Math.max(0, maxHp(h) - m0), 1, maxHp(h)); S.stats.smith = (S.stats.smith || 0) + 1; return true; }
function buyHeal(S) { if (S.gold < S.shop.healCost) return false; S.gold -= S.shop.healCost; for (const h of S.party) { if (h.wounds) h.wounds = S.shop.town ? 0 : h.wounds - 1; h.hp = maxHp(h); } return true; }
function doRest(S, k) { for (const h of S.party) { if (k === 0 && h.wounds) h.wounds--; const m = maxHp(h); h.hp = Math.min(m, h.hp + Math.round(m * (k === 0 ? 0.6 : 0.25))); }
  if (k === 1) { addBag(S, rollCons(S, Math.round(pw(S)), 1)); addBag(S, mkCons('potion', 1)); } if (k === 2) S.xp += 8; finishNode(S); }

// ---------- quest generation ----------
const VILLAINS = [
  { name: 'Garrick the Red', title: 'the Bandit King', fam: 'bandit', boss: 'banditking', lt: 'captain', m: 'outlaws', lair: ['Redcap Keep', 'the Gallows Fort', 'Thornwall Hold'] },
  { name: 'Mother Vex', title: 'the Necromancer', fam: 'undead', boss: 'necro', lt: 'warden', m: 'walking dead', lair: ['the Ossuary', 'Hollowbarrow', 'the Drowned Crypt'] },
  { name: 'Ser Aldous the Hollow', title: 'the Fallen Knight', fam: 'undead', boss: 'knight', lt: 'warden', m: 'grave-soldiers', lair: ['Castle Mournwatch', 'the Broken Chapel', 'Oathfall Tower'] },
  { name: 'the Antlered Man', title: 'the Beastlord', fam: 'beast', boss: 'beastlord', lt: 'bear', m: 'maddened beasts', lair: ['the Heartwood', 'Fang Hollow', 'the Bramble Throne'] },
  { name: 'Prophet Ilsabet', title: 'the Prophet', fam: 'cult', boss: 'prophet', lt: 'champion', m: 'cultists', lair: ['the Ember Sanctum', 'the Temple Below', 'the Hall of Ash'] },
  { name: 'Ashwing', title: 'the Wyrm', fam: 'cult', boss: 'wyrm', lt: 'champion', m: 'wyrm-sworn cultists', lair: ['Cinder Peak', 'the Scorched Vault', 'Smokemaw Cavern'] }
];
const MOTIVES = [
  { t: 'means to seize the {R} and rule {P} with it', r: 1 }, { t: 'wants revenge on {H}, the town that cast {V} out' }, { t: 'is gathering strength to claim the old crown of {P}' },
  { t: 'is trying to wake something that sleeps beneath {L}' }, { t: 'demands tribute from every village in {P}, and burns those that refuse' }
];
const REGIONS = ['the Greymarch', 'the Vale of Sorrows', 'the Thornwood', 'the Ashen Coast', 'the Saltfen', 'the High Moors'];
const TOWNS = ['Oakhollow', 'Brindleford', 'Millhaven', 'Stonecross', 'Wickham', 'Farrow'];
const PATRONS = ['Reeve Halda', 'Brother Osric', 'Lady Merewen', 'Old Tam the miller', 'Captain Yorek', 'the widow Ansel'];
const RELICS = ['Crown of Thorns', 'Lantern of Souls', 'Horn of Winter', 'Black Chalice', 'Sunstone'];
const TWISTS = ['betrayal', 'puppet', 'kin', 'rivals', 'toolate'];
function newQuest(S) {
  const v = pick(S, VILLAINS), q = { vi: VILLAINS.indexOf(v), name: v.name, vtitle: v.title, fam: v.fam, boss: v.boss, lt: v.lt, minions: v.m, lair: pick(S, v.lair), region: pick(S, REGIONS), town: pick(S, TOWNS), patron: pick(S, PATRONS), relic: pick(S, RELICS), twist: pick(S, TWISTS), bossHp: 0, flags: {}, used: [], leads: 0, log: [] };
  q.motive = fill({ q }, pick(S, MOTIVES).t); q.title = `${v.title.replace(/^the /, 'The ')} of ${q.lair}`; return q;
}
function fill(S, t) { const q = S.q; return t.replace(/\{V\}/g, q.name).replace(/\{P\}/g, q.region).replace(/\{L\}/g, q.lair).replace(/\{M\}/g, q.minions).replace(/\{T\}/g, q.patron).replace(/\{H\}/g, q.town).replace(/\{R\}/g, 'the ' + q.relic); }

// ---------- events ----------
// A choice with s (a stat) is a d20 check: ok / mid / bad. Without s it simply happens (cost = gold).
// Effects: gold, healP, hurtP (everyone), hurtR (the roller), item ('gear'|'trinket'|'cons'), xp, flag, wound, next ('ambush'|'surprised'|'exposed'), fight ('normal'|'elite'), boss (changes boss health)
const EVENTS = [
  { id: 'hook', t: 'A job in {H}', x: '{T} meets you at the edge of {H}. {V}, {W}, {MO}. The {M} already hold the roads. "End it," {T} says, "and {P} will remember your names."', c: [
    { l: 'Haggle for an advance', s: 'mind', ok: { x: '{T} grumbles and hands over a purse.', gold: 30 }, mid: { x: 'You get a few coins and a sour look.', gold: 12 }, bad: { x: '{T} will not be moved. You leave with nothing but directions.' } },
    { l: 'Swear an oath to see it done', s: 'spirit', ok: { x: 'The words settle on you like a warm cloak.', healP: 1, xp: 6 }, mid: { x: 'The oath is sworn. It feels heavier than you expected.', xp: 3 }, bad: { x: 'You stumble over the words. An awkward silence follows.' } },
    { l: 'Ask around about the enemy first', s: 'agility', ok: { x: 'A stable boy shows you where their sentries sleep.', next: 'ambush' }, mid: { x: 'You learn how they fight, if not where.', next: 'exposed' }, bad: { x: 'Your questions reach the wrong ears.', next: 'surprised' } } ] },
  { id: 'toll', t: 'The toll', x: 'A felled tree blocks the road. Rough figures lean on it. "Road tax," one says. "For the upkeep."', c: [
    { l: 'Pay the toll', cost: 15, x: 'They wave you through, counting your coins.' },
    { l: 'Make them reconsider', s: 'might', ok: { x: 'One look at you and they find somewhere else to be. They leave a purse behind.', gold: 15, xp: 4 }, bad: { x: 'They do not scare. Steel comes out.', fight: 'normal' } },
    { l: 'Slip around through the brush', s: 'agility', ok: { x: 'You pass unseen, and pass their camp on the way.', item: 'cons' }, mid: { x: 'Thorns and mud, but you are through.', hurtP: 0.08 }, bad: { x: 'A branch snaps. They are on you at once.', fight: 'normal', next: 'surprised' } } ] },
  { id: 'shrine', t: 'A roadside shrine', x: 'A small stone shrine stands in a ring of wild flowers. Offerings of coin and silver glint in the bowl.', c: [
    { l: 'Kneel and pray', s: 'spirit', ok: { x: 'A stillness comes over you. Your hurts ease.', healP: 0.5, flag: 'devout' }, mid: { x: 'A quiet moment. It helps a little.', healP: 0.2 }, bad: { x: 'Nothing answers.' } },
    { l: 'Take the offerings', x: 'The coins are cold in your hand. Something watches you leave.', gold: 30, flag: 'desecrated' },
    { l: 'Walk on', x: 'You leave the shrine as you found it.' } ] },
  { id: 'traveler', t: 'The wounded traveller', x: 'A man lies by the road with an arrow in his thigh. His pack has spilled open beside him.', c: [
    { l: 'Tend his wound', s: 'spirit', ok: { x: 'He will walk again. He presses a keepsake into your hand and tells you what he saw of the {M}.', item: 'trinket', flag: 'helped' }, mid: { x: 'You do what you can. He thanks you and limps toward {H}.', flag: 'helped', xp: 4 }, bad: { x: 'You do what you can. It is not enough, and it costs you supplies.', hurtP: 0.05 } },
    { l: 'Take his pack and go', x: 'He is in no state to stop you.', gold: 20, item: 'cons', flag: 'cruel' },
    { l: 'Leave him', x: 'You have your own troubles.' } ] },
  { id: 'ravine', t: 'The ravine', x: 'The bridge is gone. The ravine is deep, the far side close, and a fallen pine lies half across.', c: [
    { l: 'Haul the pine into place', s: 'might', ok: { x: 'It holds. You cross dry and in good time.', xp: 6 }, mid: { x: 'It holds, barely. Pulled muscles all round.', hurtP: 0.08 }, bad: { x: 'The trunk rolls. Someone goes down with it.', hurtR: 0.3 } },
    { l: 'Climb down and up', s: 'agility', ok: { x: 'Quick hands, sure feet. You find a dead climber\'s satchel on a ledge.', item: 'cons', xp: 4 }, mid: { x: 'Scraped and winded, you make it.', hurtP: 0.08 }, bad: { x: 'A bad fall.', hurtR: 0.3 } },
    { l: 'Take the long way round', x: 'Hours lost, and a cold night on the hill.', hurtP: 0.1 } ] },
  { id: 'chest', t: 'The strongbox', x: 'In the ruins of a watch-house you find an iron strongbox bolted to the floor.', c: [
    { l: 'Pick the lock', s: 'agility', ok: { x: 'The lock gives with a soft click.', item: 'gear', gold: 10 }, mid: { x: 'The lock gives, and so does a needle trap.', item: 'gear', hurtR: 0.2 }, bad: { x: 'The pick snaps. A needle bites deep.', hurtR: 0.3 } },
    { l: 'Smash it open', s: 'might', ok: { x: 'The lid buckles.', item: 'gear' }, mid: { x: 'It opens, but glass crunches inside. Only coins survive.', gold: 25 }, bad: { x: 'The box wins.', hurtR: 0.15 } },
    { l: 'Study it for traps first', s: 'mind', ok: { x: 'You find the catch, disarm it, and lift the lid at leisure.', item: 'gear', gold: 20, xp: 4 }, mid: { x: 'You find the trap but not the trick of the lock. You pry out a few coins.', gold: 15 }, bad: { x: 'You learn nothing and lose the light.' } } ] },
  { id: 'gambler', t: 'Dice by the fire', x: 'A cheerful stranger shares his fire and rattles a cup of dice. "A friendly game?"', c: [
    { l: 'Play it straight', s: 'mind', ok: { x: 'You read the odds better than he does.', gold: 30 }, mid: { x: 'You break even and hear some useful gossip.', xp: 4 }, bad: { x: 'He is very good at this.', gold: -20 } },
    { l: 'Palm the dice', s: 'agility', ok: { x: 'He never notices. He pays up in goods.', gold: 20, item: 'cons' }, bad: { x: 'He notices. So do his friends in the dark.', fight: 'normal' } },
    { l: 'Decline', x: 'You sleep with one eye open.' } ] },
  { id: 'merchant', t: 'The stuck wagon', x: 'A merchant\'s wagon sits axle-deep in mud. She is swearing at the horse, who is ignoring her.', c: [
    { l: 'Put your shoulders to it', s: 'might', ok: { x: 'The wagon rolls free. She insists you take something.', item: 'trinket', flag: 'helped' }, mid: { x: 'It takes an hour, but it moves. She shares her supper.', healP: 0.15, flag: 'helped' }, bad: { x: 'The wheel cracks. She is not grateful.' } },
    { l: 'Rig a lever', s: 'mind', ok: { x: 'A plank, a rock and a little thought. She pays you for the lesson.', gold: 25, flag: 'helped' }, bad: { x: 'The plank snaps and catches someone across the shin.', hurtR: 0.15 } },
    { l: 'Help yourselves to the cargo', x: 'She runs. The wagon is yours.', gold: 25, item: 'cons', flag: 'cruel' } ] },
  { id: 'cache', t: 'The alchemist\'s cache', x: 'Under a cairn you find a rotted satchel of stoppered flasks. The labels have long since washed away.', c: [
    { l: 'Work out what they are', s: 'mind', ok: { x: 'Three are still good, and you know which.', item: 'cons', item2: 'cons' }, mid: { x: 'One is certainly safe.', item: 'cons' }, bad: { x: 'You cannot tell them apart and leave them.' } },
    { l: 'Drink one and find out', x: 'Bold.', random: [{ x: 'Warmth floods your limbs.', healP: 0.4 }, { x: 'It was lamp oil.', hurtP: 0.1 }, { x: 'You feel sharper than you have in days.', xp: 8 }] },
    { l: 'Leave them', x: 'Some things are buried for a reason.' } ] },
  { id: 'riddle', t: 'The speaking stone', x: 'A weathered stone face is set into the hillside. As you pass, its eyes open. "Answer me," it says, "and take what I guard."', c: [
    { l: 'Answer the riddle', s: 'mind', dc: 1, ok: { x: 'The mouth opens wide. Something gleams inside.', item: 'trinket', xp: 6 }, mid: { x: '"Close," the stone admits, and tells you a secret of {L} instead.', xp: 8 }, bad: { x: 'The eyes close. The hillside is only a hillside.' } },
    { l: 'Pry the mouth open', s: 'might', dc: 2, ok: { x: 'Stone cracks. You take the prize.', item: 'trinket' }, bad: { x: 'The stone bites.', hurtR: 0.3 } },
    { l: 'Move on', x: 'You have no time for games.' } ] },
  { id: 'battlefield', t: 'The old battlefield', x: 'Rusted helms and split shields lie under the grass. At dusk the air turns cold and you hear marching.', c: [
    { l: 'Speak the rites for the dead', s: 'spirit', ok: { x: 'The marching stops. Something like thanks passes over you.', healP: 0.3, xp: 8, flag: 'devout' }, mid: { x: 'The cold lifts a little.', xp: 4 }, bad: { x: 'The dead do not care for your words. You do not sleep.', hurtP: 0.08 } },
    { l: 'Search the field for arms', s: 'agility', ok: { x: 'Under a cairn of shields, something still sharp.', item: 'gear' }, mid: { x: 'A few coins, green with age.', gold: 15 }, bad: { x: 'A cold hand closes on an ankle.', hurtR: 0.25 } },
    { l: 'Hurry through', x: 'You do not look back.' } ] },
  { id: 'cub', t: 'The snare', x: 'A young wolf is caught in a wire snare, half strangled, snapping at anything near. The {M} set this.', c: [
    { l: 'Calm it and cut it free', s: 'spirit', ok: { x: 'It lets you close. Freed, it stays a moment, then leads you to a camp the trappers left in a hurry.', item: 'cons', gold: 15, xp: 4 }, mid: { x: 'It bolts the moment the wire parts.', xp: 4 }, bad: { x: 'It bites before it runs.', hurtR: 0.2 } },
    { l: 'Wait for the trappers', s: 'agility', ok: { x: 'They come at dusk, and never see you.', next: 'ambush', fight: 'normal' }, bad: { x: 'They come from behind.', next: 'surprised', fight: 'normal' } },
    { l: 'Leave it', x: 'Not your concern.' } ] },
  { id: 'veteran', t: 'The old soldier', x: 'A grey veteran keeps a camp by the road and watches you approach with a professional eye. "You hold that like a broom," he says.', c: [
    { l: 'Pay him for a lesson', cost: 20, x: 'He is a hard teacher and a good one.', xp: 14 },
    { l: 'Spar with him', s: 'might', ok: { x: 'You put him on his back. He laughs and shows you how he let you.', xp: 12 }, mid: { x: 'He wins, and explains exactly why.', xp: 7 }, bad: { x: 'He wins, and it hurts.', xp: 3, hurtR: 0.15 } },
    { l: 'Nod and keep walking', x: 'He shrugs.' } ] },
  { id: 'shortcut', t: 'The low road', x: 'The road forks. The high road is safe and watched. The low road runs through fog and reeds, right under the noses of the {M}.', c: [
    { l: 'Creep along the low road', s: 'agility', ok: { x: 'You come out behind their pickets.', next: 'ambush', xp: 4 }, mid: { x: 'You get through, wet and unseen.' }, bad: { x: 'A horn sounds in the fog.', next: 'surprised' } },
    { l: 'Take the high road', x: 'Slow, steady and dull.' } ] },
  { id: 'scout', act: [1], t: 'The captured scout', x: 'You catch one of the {M} asleep at a watch-fire. Bound and wide awake now, the scout stares at you.', c: [
    { l: 'Get answers the hard way', s: 'might', ok: { x: 'The scout talks. You learn who leads them here, and how they fight.', flag: 'eliteWeak', flag2: 'cruel' }, bad: { x: 'The scout spits and says nothing.', flag: 'cruel' } },
    { l: 'Talk them round and let them go', s: 'mind', ok: { x: 'By the end the scout is close to tears. "I never wanted this." They tell you all they know and run for home.', flag: 'spared', flag2: 'eliteWeak' }, mid: { x: 'The scout says little, but goes free and does not forget it.', flag: 'spared' }, bad: { x: 'The scout goes free, laughing at you.', flag: 'spared' } },
    { l: 'Take their purse and leave them tied', x: 'Someone will find them. Probably.', gold: 20, flag: 'cruel' } ] },
  { id: 'refugees', act: [1, 2], t: 'The road out', x: 'Families from the outlying farms crowd the road with handcarts. Behind them, smoke. Some of the {M} are not far behind.', c: [
    { l: 'Hold the road while they get clear', x: 'You plant your feet and wait.', fight: 'normal', flag: 'helped', xp: 6 },
    { l: 'Give them coin for the journey', cost: 20, x: 'They bless your names all the way to {H}.', flag: 'helped' },
    { l: 'Push past', x: 'You cannot save everyone.' } ] },
  { id: 'supply', act: [2], t: 'The supply train', x: 'Three laden mules and a bored guard: stores bound for {L}.', c: [
    { l: 'Burn the lot', s: 'agility', ok: { x: 'It goes up like a beacon. {V} will go hungry.', boss: -0.12, xp: 6 }, mid: { x: 'You fire one load before the guard raises the alarm.', boss: -0.06, fight: 'normal' }, bad: { x: 'The guard is not as bored as he looked.', fight: 'normal', next: 'surprised' } },
    { l: 'Steal what you can carry', s: 'agility', dc: -2, ok: { x: 'You leave the guard snoring and the mules lighter.', item: 'gear', item2: 'cons' }, bad: { x: 'A mule brays.', fight: 'normal' } },
    { l: 'Let it pass and follow it', s: 'mind', ok: { x: 'It leads you to a side gate nobody mentioned.', next: 'ambush', xp: 6 }, bad: { x: 'You lose the trail in the dark.' } } ] },
  { id: 'parley', act: [2], t: 'An offer', x: 'A rider under a white rag hails you. "My captain serves {V} for pay, not love. Pay better, and the way ahead may be less well guarded."', c: [
    { l: 'Pay the bribe', cost: 35, x: 'The rider counts it twice and nods.', flag: 'eliteWeak' },
    { l: 'Promise payment you do not intend to make', s: 'mind', ok: { x: 'The rider believes every word.', flag: 'eliteWeak' }, bad: { x: 'The rider laughs and wheels away. They will be ready for you.', next: 'surprised' } },
    { l: 'Send the rider back with a threat', s: 'might', ok: { x: 'The rider goes pale. Word of you will spread through their camp.', next: 'exposed' }, bad: { x: 'The rider is unimpressed.' } } ] },
  { id: 'returns', act: [2, 3], req: 'spared', t: 'A familiar face', x: 'A hooded figure steps from the trees with open hands. It is the scout you let go. "I owe you. There is a way into {L} they do not watch."', c: [
    { l: 'Follow the scout', x: 'The path is real. So is the stolen gear the scout hands over at the end of it.', item: 'gear', boss: -0.08, xp: 6 },
    { l: 'Thank them and send them home', x: '"Then take this, at least." A small bundle, and the scout is gone.', item: 'trinket' } ] },
  { id: 'vengeance', act: [2, 3], req: 'cruel', t: 'What goes around', x: 'Word of how you treat people on the road has travelled faster than you have. The ones waiting at the ford are not {V}\'s. They are somebody\'s kin.', c: [
    { l: 'Fight your way through', x: 'There is nothing to say.', fight: 'normal', next: 'surprised' },
    { l: 'Pay blood-money', cost: 40, x: 'They take the silver. They do not forgive you.' },
    { l: 'Talk them down', s: 'spirit', dc: 2, ok: { x: 'You find the words. They let you pass, in silence.' }, bad: { x: 'The words are not enough.', fight: 'normal', next: 'surprised' } } ] },
  { id: 'curse', act: [2, 3], req: 'desecrated', t: 'The debt', x: 'The coins you took from the shrine have grown heavy. Tonight they are hot to the touch, and the fire burns blue.', c: [
    { l: 'Make amends', s: 'spirit', ok: { x: 'You bury the coins with a prayer. The night lets go of you.', gold: -30 }, bad: { x: 'You bury the coins. It is not enough: something follows you out of the dark.', gold: -30, wound: 1 } },
    { l: 'Keep the coins and keep walking', x: 'By morning each of you carries a cold ache that will not shift.', hurtP: 0.2, wound: 1 } ] },
  { id: 'gratitude', act: [2, 3], req: 'helped', t: 'Friends on the road', x: 'A carter flags you down. "You are the ones who helped our people. {H} sent this after you."', c: [
    { l: 'Accept with thanks', x: 'Bread, bandages and a few things better than either.', healP: 0.3, item: 'cons', item2: 'cons' },
    { l: 'Ask for news instead', x: 'The carter knows the back ways. You will arrive where you are not expected.', next: 'ambush', xp: 6 } ] },
  { id: 'cells', act: [3], t: 'The cells', x: 'Beneath {L} you find a row of locked cells. Hands reach through the bars. Somewhere above, a guard is whistling.', c: [
    { l: 'Pick the locks quietly', s: 'agility', ok: { x: 'They slip away one by one. The last presses something into your hand.', item: 'trinket', xp: 8, flag: 'freed' }, mid: { x: 'You free them, but the whistling has stopped.', flag: 'freed', next: 'surprised' }, bad: { x: 'The lock jams and the guard comes running.', fight: 'normal' } },
    { l: 'Break the doors down', s: 'might', ok: { x: 'Iron shrieks. The prisoners pour out and fall on the guards for you.', flag: 'freed', boss: -0.06 }, bad: { x: 'The noise brings the whole watch.', fight: 'normal', next: 'surprised' } },
    { l: 'Leave them for now', x: 'After. If there is an after.' } ] },
  { id: 'wards', act: [3], t: 'The warding circle', x: 'Chalk, bone and candle-stubs ring the last door. The air hums. This is where {V} draws strength.', c: [
    { l: 'Unpick the working', s: 'mind', ok: { x: 'Line by line you unmake it. Far off, something screams in rage.', boss: -0.12, xp: 6 }, mid: { x: 'You break part of it before it bites back.', boss: -0.06, hurtR: 0.2 }, bad: { x: 'The circle flares.', hurtP: 0.15 } },
    { l: 'Bless the ground', s: 'spirit', ok: { x: 'The candles gutter and go out.', boss: -0.1, healP: 0.2 }, mid: { x: 'The hum falters.', boss: -0.05 }, bad: { x: 'Your prayer dies in your throat.' } },
    { l: 'Step over it carefully', x: 'Best not to touch.' } ] },
  { id: 'lair', act: [9], t: 'The threshold', x: '{FINAL}', c: [
    { l: 'Bind your wounds and go in ready', x: 'A last quiet moment.', healP: 0.35 },
    { l: 'Go in fast, before they are set', s: 'agility', ok: { x: 'You are through the door before the alarm.', next: 'ambush' }, mid: { x: 'Fast, but not fast enough to matter.' }, bad: { x: 'They heard you coming.', next: 'surprised' } },
    { l: 'Call {V} out', s: 'spirit', ok: { x: 'Your voice carries through every hall. Some of the {M} decide they would rather be elsewhere.', boss: -0.1 }, mid: { x: 'Only echoes answer.' }, bad: { x: 'Laughter answers.' } } ] },
  // twists, shown at the end of act two
  { id: 'tw_betrayal', act: [9], t: 'The letter', x: 'On the body of a courier you find a letter in a hand you know. {T} has been paying {V} all along, and has just sold your route. You were never meant to come back.', c: [
    { l: 'Set a trap of your own', s: 'mind', ok: { x: 'When {T}\'s hirelings come, you are waiting.', next: 'ambush', gold: 30, flag: 'betrayed' }, bad: { x: 'They come sooner than you planned.', next: 'surprised', flag: 'betrayed' } },
    { l: 'Press on before they find you', s: 'agility', ok: { x: 'You are long gone when they reach your camp.', flag: 'betrayed', xp: 6 }, bad: { x: 'They catch your rearguard.', hurtP: 0.12, flag: 'betrayed' } } ] },
  { id: 'tw_puppet', act: [9], t: 'The thing that speaks', x: 'A dying lieutenant tells you the truth with a kind of relief. {V} does not rule here. {R} does. It whispers, and {V} obeys.', c: [
    { l: 'Learn how to break its hold', s: 'mind', ok: { x: 'You find the old words in the lieutenant\'s papers. When the time comes, you will know what to say.', boss: -0.15, flag: 'puppet' }, mid: { x: 'You learn part of it.', boss: -0.07, flag: 'puppet' }, bad: { x: 'The papers are ash. You will have to do this the hard way.', flag: 'puppet' } },
    { l: 'Steel yourselves against the whisper', s: 'spirit', ok: { x: 'It tries your minds in the night, and finds no door.', healP: 0.3, xp: 8, flag: 'puppet' }, bad: { x: 'It finds a door. Nobody sleeps.', hurtP: 0.12, flag: 'puppet' } } ] },
  { id: 'tw_kin', act: [9], t: 'The locket', x: 'In the lieutenant\'s tent hangs a small portrait: a child, and a younger {T}. On the back, a name. {V} is {T}\'s own blood, lost years ago, and {T} sent you without a word of it.', c: [
    { l: 'Resolve to bring {V} back alive if you can', x: 'It will be harder. You know it.', boss: 0.08, flag: 'mercy', xp: 10 },
    { l: 'Blood changes nothing', x: 'You have seen what {V} has done.', flag: 'kin' },
    { l: 'Use it: send word that {T} lives and grieves', s: 'spirit', ok: { x: 'Your message reaches {L}. They say {V} has not spoken since.', boss: -0.12, flag: 'kin' }, bad: { x: 'The messenger does not return.', flag: 'kin' } } ] },
  { id: 'tw_rivals', act: [9], t: 'The other company', x: 'You are not the only ones hunting {V}. A hard-eyed company in good mail has made camp on the same ridge. Their captain smiles. "There is only one bounty."', c: [
    { l: 'Offer to share the work and the pay', s: 'spirit', ok: { x: 'They agree. They will hit the outer gate while you go for the heart.', boss: -0.15, flag: 'allies' }, bad: { x: '"Half is not one," the captain says, and reaches for a sword.', fight: 'elite' } },
    { l: 'Drive them off', x: 'There is only one bounty.', fight: 'elite', flag: 'rivals' },
    { l: 'Slip away in the night and get ahead of them', s: 'agility', ok: { x: 'By dawn you have half a day on them.', xp: 8 }, bad: { x: 'They were watching. They take the best of your supplies as a lesson.', gold: -30 } } ] },
  { id: 'tw_toolate', act: [9], t: 'The sky over {L}', x: 'The clouds above {L} have begun to turn, slowly, like water round a drain. Whatever {V} set out to do is already half done.', c: [
    { l: 'Work out a counter to it', s: 'mind', ok: { x: 'There is a flaw in the working, and now you know it.', boss: -0.05, flag: 'toolate' }, mid: { x: 'You cannot stop it, but you can be ready.', boss: 0.06, flag: 'toolate' }, bad: { x: 'It is beyond you.', boss: 0.14, flag: 'toolate' } },
    { l: 'Force-march to get there sooner', s: 'might', ok: { x: 'You arrive worn but early.', hurtP: 0.1, boss: -0.05, flag: 'toolate' }, bad: { x: 'You arrive exhausted, and no sooner.', hurtP: 0.15, boss: 0.14, flag: 'toolate' } } ] }
];
// villain, region, chain and companion encounters. v: villains it belongs to, rg: regions, req: a flag that must be set.
EVENTS.push(
  // ----- Garrick the Red, the Bandit King -----
  { id: 'bk_poster', v: ['banditking'], act: [1, 2], t: 'Wanted', x: 'Nailed to a milestone: your own faces, crudely drawn, and a price. Below it, in a neater hand, a list of the patrols on this road.', c: [
    { l: 'Study the patrol list', s: 'mind', ok: { x: 'You memorise the times. The next patrol will never see you coming.', next: 'ambush', lead: 1 }, mid: { x: 'You get the gist of it.', next: 'exposed' }, bad: { x: 'The list is a forgery, left to be found.', next: 'surprised' } },
    { l: 'Tear it down and move on', x: 'A small, satisfying act.' } ] },
  { id: 'bk_fence', v: ['banditking'], t: 'The fence', x: 'A man in a fine coat runs a stall of very nice things, all of which belonged to someone else last week. "Friends of Garrick get a discount," he winks.', c: [
    { l: 'Pretend to be friends of Garrick', s: 'mind', ok: { x: 'He believes you, sells you something good, and lets slip where Garrick\'s captain drinks.', item: 'gear', lead: 1 }, bad: { x: 'He sees through you and whistles. Three men step out of the alley.', fight: 'normal' } },
    { l: 'Buy honestly', cost: 25, x: 'Stolen or not, it is fine work.', item: 'gear' },
    { l: 'Return the goods to the villagers', s: 'might', ok: { x: 'He decides not to argue. The villagers weep to see their things again.', flag: 'helped', xp: 6 }, bad: { x: 'He argues, with friends.', fight: 'normal', flag: 'helped' } } ] },
  { id: 'bk_tribute', v: ['banditking'], act: [1, 2], t: 'The tribute', x: 'In a hamlet square, the headman is counting out the village\'s last coins for Garrick\'s collectors, due at noon.', c: [
    { l: 'Pay the tribute for them', cost: 30, x: 'The headman cannot speak. His daughter kisses your hands.', flag: 'helped', xp: 6 },
    { l: 'Wait for the collectors', x: 'Noon comes, and so do they.', fight: 'normal', next: 'ambush', flag: 'helped' },
    { l: 'Teach the villagers to hide their stores', s: 'mind', ok: { x: 'By noon there is nothing to find. The collectors leave empty-handed and confused.', flag: 'helped', lead: 1 }, bad: { x: 'The collectors find the cellar anyway.' } } ] },
  // ----- Mother Vex, the Necromancer -----
  { id: 'nv_graves', v: ['necro'], t: 'The open graves', x: 'A whole churchyard stands open: every grave dug out from below.', c: [
    { l: 'Consecrate the ground', s: 'spirit', ok: { x: 'The earth settles. Whatever left these graves will be weaker for it.', boss: -0.06 }, mid: { x: 'You do what you can.', xp: 4 }, bad: { x: 'The ground is too fouled for prayer.' } },
    { l: 'Follow the trail of earth', s: 'agility', ok: { x: 'It leads to a hidden barrow-door, and a ledger of names.', lead: 1, xp: 4 }, bad: { x: 'The trail ends at a river.' } } ] },
  { id: 'nv_letters', v: ['necro'], act: [1, 2], t: 'Letters in the dark', x: 'A dead courier still clutches a satchel of letters, written in a cipher and sealed with black wax.', c: [
    { l: 'Break the cipher', s: 'mind', dc: 1, ok: { x: 'Mother Vex writes to her Gravewarden: where to meet, and when.', lead: 1, xp: 6 }, mid: { x: 'You read enough to know a name: the Gravewarden.', xp: 4 }, bad: { x: 'It is beyond you.' } },
    { l: 'Burn them', x: 'Whatever was planned will have to be planned again.', boss: -0.03 } ] },
  { id: 'nv_widow', v: ['necro'], t: 'The widow\'s husband', x: 'A widow begs you: her husband came home last night, three weeks after they buried him. He is sitting at the table. He will not speak.', c: [
    { l: 'Lay him to rest gently', s: 'spirit', ok: { x: 'He closes his eyes. She thanks you, and gives you his old sword.', item: 'gear', flag: 'helped' }, bad: { x: 'He does not go gently.', fight: 'normal', flag: 'helped' } },
    { l: 'Ask him who raised him', s: 'mind', ok: { x: 'His lips move once: a woman\'s name, and a place.', lead: 1 }, bad: { x: 'He only stares.', hurtR: 0.1 } } ] },
  // ----- Ser Aldous, the Fallen Knight -----
  { id: 'kn_oathstone', v: ['knight'], t: 'The oath-stone', x: 'A standing stone carved with a knight\'s oath. Someone has struck out the name: Aldous.', c: [
    { l: 'Recite the oath aloud', s: 'spirit', ok: { x: 'Your voice rings across the valley. Far off, something in black armour stops, and listens.', boss: -0.08 }, mid: { x: 'The words feel heavy, and true.', xp: 6 }, bad: { x: 'The stone is cold and silent.' } },
    { l: 'Read the lesser names below', s: 'mind', ok: { x: 'The names of his sworn knights. One, Hollin, has a home not far from here.', lead: 1 }, bad: { x: 'Weather has taken them.' } } ] },
  { id: 'kn_squire', v: ['knight'], act: [1, 2], t: 'The last squire', x: 'An old man in a mended surcoat sits by the road. He served Ser Aldous forty years ago, when Aldous was the best of men.', c: [
    { l: 'Ask how Aldous fell', x: '"Grief," he says. "His lady died, and he made a bargain to bring her back. You cannot strike him while he wears her token. Take it from him first." He gives you his blessing, and his old shield-sword.', lead: 1, item: 'gear' },
    { l: 'Give him bread and coin', cost: 10, x: 'He blesses you. "Win quickly. He was a kind man once."', flag: 'helped', healP: 0.2 } ] },
  { id: 'kn_cavalry', v: ['knight'], act: [2, 3], t: 'The ghost riders', x: 'At midnight the road shakes. A column of dead horsemen is coming, and the only cover is a ditch.', c: [
    { l: 'Hide in the ditch', s: 'agility', ok: { x: 'They pass over you like cold wind. You count them: fewer than you feared.', lead: 1, xp: 4 }, bad: { x: 'A rider turns his eyeless helm toward you.', fight: 'normal', next: 'surprised' } },
    { l: 'Stand in the road', x: 'Steel answers steel.', fight: 'elite' } ] },
  // ----- The Antlered Man, the Beastlord -----
  { id: 'bl_stag', v: ['beastlord'], t: 'The white stag', x: 'A white stag stands bound in briars, a crown of thorns twisted into its antlers. The forest is watching.', c: [
    { l: 'Free it gently', s: 'spirit', ok: { x: 'The stag bows its head, and is gone. The forest seems to breathe out.', boss: -0.08 }, bad: { x: 'It panics and gores you on its way free.', hurtR: 0.2, boss: -0.04 } },
    { l: 'Leave it bound', x: 'It watches you go.' } ] },
  { id: 'bl_traps', v: ['beastlord'], act: [1, 2], t: 'The trappers\' cache', x: 'A cache of steel traps and poison, left by trappers who will not be coming back.', c: [
    { l: 'Take the poison', x: 'Wolfsbane, still potent.', item: 'cons', item2: 'cons' },
    { l: 'Set the traps on the beast-paths', s: 'agility', ok: { x: 'By morning the paths are quieter.', boss: -0.05, xp: 4 }, bad: { x: 'You catch your own foot.', hurtR: 0.2 } } ] },
  { id: 'bl_druid', v: ['beastlord'], t: 'The druid\'s warning', x: 'An old woman with moss in her hair: "He was a druid like me, before the wood spoke to him too loudly. The beasts follow his horn. Silence the horn."', c: [
    { l: 'Learn the calls of the pack', s: 'mind', ok: { x: 'Now you will hear them coming.', next: 'ambush', lead: 1 }, bad: { x: 'It all sounds like howling to you.' } },
    { l: 'Ask for her blessing', s: 'spirit', ok: { x: 'Leaves fall around you; your wounds close.', healP: 0.4 }, bad: { x: 'She shakes her head. "Not you."' } } ] },
  // ----- Prophet Ilsabet -----
  { id: 'pr_sermon', v: ['prophet'], t: 'The sermon', x: 'In a market square, a cult preacher promises that the fire will cleanse the unworthy. The crowd is listening.', c: [
    { l: 'Listen for what they want', s: 'mind', ok: { x: 'Between the fire and the glory, he names a gathering: the Ember Rite, three nights from now.', lead: 1 }, bad: { x: 'Just fire and glory.' } },
    { l: 'Shout him down', s: 'spirit', ok: { x: 'The crowd turns from him. He slinks away.', flag: 'helped', xp: 4 }, bad: { x: 'His followers turn on you.', fight: 'normal' } } ] },
  { id: 'pr_books', v: ['prophet'], act: [1, 2], t: 'The burning library', x: 'Zealots are throwing a monastery\'s books into the flames. An old monk tries to save them one at a time.', c: [
    { l: 'Save what you can', s: 'agility', ok: { x: 'You pull a chest of scrolls from the fire. The monk presses one on you: a ward against flame.', item: 'trinket', xp: 4 }, bad: { x: 'Smoke and heat drive you back.', hurtP: 0.08 } },
    { l: 'Drive the zealots off', x: 'They are not interested in leaving.', fight: 'normal', flag: 'helped' } ] },
  { id: 'pr_doubter', v: ['prophet'], act: [1, 2], t: 'The doubting acolyte', x: 'A young acolyte in singed robes sits alone, crying. She saw what the Prophet does to those who doubt.', c: [
    { l: 'Persuade her to leave the cult', s: 'spirit', ok: { x: 'She tells you everything: the sanctum, the choir, Brother Cinder.', lead: 1, boss: -0.04 }, bad: { x: 'Fear wins. She runs back to them.' } },
    { l: 'Let her be', x: 'Some doors must be opened from inside.' } ] },
  // ----- Ashwing, the Wyrm -----
  { id: 'wy_scale', v: ['wyrm'], t: 'The shed scale', x: 'A scale as big as a shield, still warm, lies in a scorched field.', c: [
    { l: 'Study where it came from', s: 'mind', ok: { x: 'There is a scar beneath where this scale grew. Ashwing has a weak spot.', boss: -0.1 }, bad: { x: 'It is a scale. A big one.' } },
    { l: 'Sell it', x: 'An armourer in the next village pays handsomely.', gold: 40 } ] },
  { id: 'wy_cart', v: ['wyrm'], act: [1, 2], t: 'The tribute cart', x: 'An unguarded cart of gold, bound for the mountain. The driver has fled.', c: [
    { l: 'Return it to the villages', x: 'They will remember this.', flag: 'helped', xp: 8 },
    { l: 'Keep it', x: 'Gold is gold.', gold: 50, flag: 'cruel' },
    { l: 'Leave it as bait and wait', x: 'Someone comes for it, as you knew they would.', fight: 'normal', next: 'ambush', lead: 1 } ] },
  { id: 'wy_sick', v: ['wyrm'], t: 'Dragon-sickness', x: 'A man sits in a burned house clutching a single coin from the hoard. He hears the dragon\'s voice in it.', c: [
    { l: 'Talk him back to himself', s: 'spirit', ok: { x: 'He drops the coin. "The voice said: the bridge, then the tunnels, then me."', lead: 1 }, bad: { x: 'He screams and runs.' } },
    { l: 'Take the coin', x: 'It is warm, and it whispers.', gold: 20, hurtR: 0.1 } ] },
  // ----- regions -----
  { id: 'rg_tree', rg: ['the Thornwood'], t: 'The singing tree', x: 'Deep in the wood an ancient oak hums softly in a wind you cannot feel.', c: [
    { l: 'Rest beneath it', x: 'You sleep, and wake healed.', healP: 0.4 },
    { l: 'Ask it what it knows', s: 'spirit', ok: { x: 'The humming changes. You understand, somehow, which paths are safe.', next: 'ambush', xp: 6 }, bad: { x: 'It keeps its counsel.' } } ] },
  { id: 'rg_wisps', rg: ['the Saltfen'], t: 'Will-o\'-the-wisps', x: 'Pale lights bob above the black water, drifting away from the path.', c: [
    { l: 'Follow them', s: 'agility', ok: { x: 'They lead to a drowned shrine full of offerings.', item: 'trinket', gold: 15 }, bad: { x: 'The bog takes your boots, and nearly more.', hurtP: 0.12 } },
    { l: 'Stay on the path', x: 'Wise.' } ] },
  { id: 'rg_wreck', rg: ['the Ashen Coast'], t: 'The wreck', x: 'A merchant ship lies broken on the rocks. The tide is coming in.', c: [
    { l: 'Search the hold before the tide', s: 'agility', ok: { x: 'Crates of good steel, and you are out before the water.', item: 'gear' }, mid: { x: 'One crate, and wet boots.', item: 'cons' }, bad: { x: 'A wave throws you against the hull.', hurtR: 0.25 } },
    { l: 'Bury the drowned crew', x: 'It takes hours. It is the right thing.', xp: 6, flag: 'helped' } ] },
  { id: 'rg_light', rg: ['the Ashen Coast'], t: 'The lighthouse keeper', x: 'The keeper\'s lamp is dark: no oil since the raiders came. He sees everything that moves on this coast.', c: [
    { l: 'Buy him oil', cost: 15, x: 'The lamp burns again, and he tells you where the raiders land.', lead: 1, next: 'ambush' },
    { l: 'Ask anyway', s: 'mind', ok: { x: 'He talks, grudgingly.', lead: 1 }, bad: { x: '"Bring oil," he says, and shuts the door.' } } ] },
  { id: 'rg_stones', rg: ['the High Moors'], t: 'The standing stones', x: 'A ring of stones on the moor top. The wind stops as you step inside.', c: [
    { l: 'Touch the tallest stone', s: 'spirit', ok: { x: 'Old strength flows into you.', xp: 10, healP: 0.2 }, bad: { x: 'Cold, like touching the grave.', hurtP: 0.08 } },
    { l: 'Walk around them', x: 'Some places are better left alone.' } ] },
  { id: 'rg_fort', rg: ['the Greymarch'], t: 'The border fort', x: 'A half-manned fort on the old border. The sergeant eyes you. "We could use blades. We could use coin more."', c: [
    { l: 'Pay for their scouting reports', cost: 20, x: 'Good reports, carefully drawn.', lead: 1, next: 'exposed' },
    { l: 'Train with the garrison', x: 'A long, useful day.', xp: 10 } ] },
  { id: 'rg_ferry', rg: ['the Vale of Sorrows'], t: 'The ferryman', x: 'A hooded ferryman waits at the black river. "Two coins each," he says, "and I take you the quiet way."', c: [
    { l: 'Pay the fare', cost: 20, x: 'The river is silent, and so is he. You land behind the enemy.', next: 'ambush', healP: 0.15 },
    { l: 'Cross by the bridge', x: 'The long way. The watched way.', hurtP: 0.05 } ] },
  // ----- chains -----
  { id: 'box1', act: [1], t: 'The sealed box', x: 'A pedlar with too many rings offers you a small black box, sealed with lead. "Lucky," he says. "Very lucky. Cheap, too."', c: [
    { l: 'Buy it', cost: 12, x: 'It is heavier than it looks.', flag: 'box' },
    { l: 'Decline', x: 'He shrugs and walks on, a little too quickly.' } ] },
  { id: 'box2', act: [2, 3], req: 'box', t: 'The whispering box', x: 'The pedlar\'s box has begun to whisper at night. Everyone has heard it now.', c: [
    { l: 'Break the seal', s: 'spirit', ok: { x: 'A cold light, then calm: inside is a charm of real power, and nothing else.', item: 'trinket', flag: 'boxopen' }, bad: { x: 'Something leaves the box, and passes through you on its way out.', wound: 1, flag: 'boxopen' } },
    { l: 'Bury it deep', x: 'The whispering stops.', flag: 'boxburied' },
    { l: 'Sell it on', x: 'A collector pays well, and asks where you got it.', gold: 35, flag: 'boxsold' } ] },
  { id: 'box3', act: [3], req: 'boxburied', t: 'The grateful dead', x: 'Where you buried the box, a pale figure waits: an old king, long bound inside it. "You let me rest," he says. "Take my last gift."', c: [
    { l: 'Accept his blessing', x: 'His hand is cold on your brow, then warm.', healP: 0.5, xp: 10, item: 'trinket' } ] },
  { id: 'box3b', act: [3], req: 'boxsold', t: 'The collector\'s men', x: 'The collector who bought the box has sent men after you. He wants to know where the rest of it is.', c: [
    { l: 'Fight them', x: 'There is no rest of it.', fight: 'normal' },
    { l: 'Pay them off', cost: 30, x: 'They leave, unconvinced.' } ] },
  { id: 'des1', act: [1, 2], t: 'The deserter', x: 'A man in {V}\'s colours kneels in the road with his hands up. "I ran. I won\'t go back. Kill me or let me go."', c: [
    { l: 'Let him go', x: '"I won\'t forget." He runs south.', flag: 'deserter' },
    { l: 'Hand him over to {H}', x: 'The reeve pays a bounty. The man does not look at you.', gold: 25, flag: 'cruel' },
    { l: 'Take him with you', s: 'spirit', ok: { x: 'Tam, he says his name is. He can swing an axe, and he knows their ways.', comp: 'deserter' }, bad: { x: 'He does not trust you, and slips away in the night.', flag: 'deserter' } } ] },
  { id: 'des2', act: [2, 3], req: 'deserter', t: 'A gate left open', x: 'At the edge of {V}\'s camp a guard lifts his helm: the deserter you spared. He has gone back, for you.', c: [
    { l: 'Slip through his gate', x: 'He looks away as you pass.', boss: -0.08, next: 'ambush' } ] },
  // ----- companions -----
  { id: 'cm_hunter', rg: ['the Thornwood', 'the High Moors', 'the Greymarch'], act: [1, 2], t: 'The hunter\'s camp', x: 'A hunter sits beside the ashes of his village, stringing a bow with steady hands. "They came from {L}," he says. "I am going there."', c: [
    { l: 'Ask him to come with you', s: 'spirit', ok: { x: 'Aldric nods once. He will walk with you as far as the next stage of your road.', comp: 'hunter' }, bad: { x: '"I hunt alone," he says.' } },
    { l: 'Share your food', x: 'He tells you about the paths ahead.', lead: 1 } ] },
  { id: 'cm_witch', rg: ['the Saltfen', 'the Vale of Sorrows', 'the Thornwood'], act: [1, 2], t: 'The hedge-witch', x: 'A stooped woman in a hut on stilts. "I have been waiting for you," says Mother Ysel. "Took your time."', c: [
    { l: 'Ask her to join you', x: 'She is already packing.', comp: 'witch' },
    { l: 'Ask for remedies', x: 'She fills your packs and sends you off.', healP: 0.3, item: 'cons' } ] },
  { id: 'cm_knight', act: [1, 2], t: 'The knight in the ditch', x: 'A knight lies in a ditch beside his dead horse, a crossbow bolt in his thigh. "Ser Corin," he gasps. "I was hunting the same quarry as you."', c: [
    { l: 'Tend his wound', s: 'spirit', ok: { x: 'He stands, and draws his sword. "My blade is yours, for a while."', comp: 'knight' }, mid: { x: 'He will live, but cannot fight. He gives you his spare kit.', item: 'gear' }, bad: { x: 'He will live, but you have spent your bandages.', hurtP: 0.05 } },
    { l: 'Take his purse and go', x: 'He curses you as you walk away.', gold: 25, flag: 'cruel' } ] },
  { id: 'cm_return', req: 'friend', act: [1, 2], t: 'An old friend', x: 'A familiar figure waits at the crossroads: someone who fought beside you before.', c: [
    { l: 'Welcome them back', x: '"Thought you might need me," they say.', comp: 'friend' } ] }
);
const EV = {}; for (const e of EVENTS) EV[e.id] = e;
function finalText(S) { const f = S.q.flags, p = [`${S.q.lair} at last. Beyond this door waits ${S.q.name}.`];
  if (f.spared) p.push('The scout you spared marked the quiet ways in.'); if (f.cruel) p.push('The road behind you is not proud of you.'); if (f.helped) p.push(`In ${S.q.town} they are lighting candles for you.`);
  if (f.betrayed) p.push(`${S.q.patron} will answer for this, after.`); if (f.puppet) p.push(`Remember: the true enemy is the ${S.q.relic}.`); if (f.mercy) p.push('You mean to take the villain alive.'); if (f.allies) p.push('Horns sound at the outer gate: the other company has kept its word.'); if (f.toolate) p.push('The sky is turning faster now.');
  if (f.freed) p.push('Freed prisoners are loose in the halls behind you.'); return p.join(' '); }
function eventText(S, e) { return fill(S, e.x.replace('{FINAL}', finalText(S)).replace('{W}', S.q.vtitle).replace('{MO}', S.q.motive)); }
function pickEvent(S, act) {
  const seen = new Set(S.seen || []), fits = e => (!e.v || e.v.includes(S.q.boss)) && (!e.rg || e.rg.includes(S.q.region)) && !(e.comp && S.comp);
  const ok = e => !S.q.used.includes(e.id) && !(e.act && !e.act.includes(act)) && !e.id.startsWith('tw_') && e.id !== 'hook' && e.id !== 'lair' && (!e.req || S.q.flags[e.req]) && fits(e) && !(e.c.some(c => c.comp || (c.ok && c.ok.comp)) && S.comp);
  const due = EVENTS.filter(e => e.req && ok(e)), local = EVENTS.filter(e => !e.req && (e.v || e.rg) && ok(e)), gen = EVENTS.filter(e => !e.req && !e.v && !e.rg && ok(e));
  const fresh = list => { const f = list.filter(e => !seen.has(e.id)); return f.length ? f : list; };
  const e = due.length && rnd(S) < 0.75 ? pick(S, due) : local.length && rnd(S) < 0.6 ? pick(S, fresh(local)) : gen.length ? pick(S, fresh(gen)) : local.length ? pick(S, local) : EV.toll; return e.id;
}
const baseDC = (S, c) => Math.round(9 + 2 * pw(S) + (c.dc || 0));
function checkInfo(S, c) { let hi = 0; S.party.forEach((h, i) => { if (heroStat(h, c.s) > heroStat(S.party[hi], c.s)) hi = i; });
  const stat = heroStat(S.party[hi], c.s), need = clamp(baseDC(S, c) - stat, 2, 20); return { hi, stat, need, odds: (21 - need) / 20 }; }
function openEvent(S, id) { S.q.used.push(id); S.ev = { id, result: null }; S.screen = 'event'; }
function applyFx(S, o, hi) {
  const act = Math.round(pw(S)), sc = 0.7 + 0.3 * pw(S), got = [];
  if (o.gold) { const g = Math.round(o.gold * sc); S.gold = Math.max(0, S.gold + g); got.push(`${g > 0 ? '+' : ''}${g} gold`); }
  if (o.healP) { for (const h of S.party) h.hp = Math.min(maxHp(h), h.hp + Math.round(maxHp(h) * o.healP)); got.push('the party is healed'); }
  if (o.hurtP) { for (const h of S.party) h.hp = Math.max(1, h.hp - Math.round(maxHp(h) * o.hurtP)); got.push('everyone is hurt'); }
  if (o.hurtR && hi >= 0) { const h = S.party[hi]; h.hp = Math.max(1, h.hp - Math.round(maxHp(h) * o.hurtR)); got.push(`${h.name} is hurt`); }
  if (o.wound) { const h = S.party[hi >= 0 ? hi : ri(S, S.party.length)]; if (h.wounds < 4) { h.wounds++; h.hp = Math.min(h.hp, maxHp(h)); } got.push(`${h.name} takes a wound`); }
  if (o.xp) { S.xp += o.xp; got.push(`+${o.xp} experience`); }
  for (const k of ['flag', 'flag2']) if (o[k]) S.q.flags[o[k]] = true;
  if (o.lead) { S.q.leads = (S.q.leads || 0) + o.lead; S.q.log.push({ t: 'A lead on ' + S.q.name + '\'s plans.', good: true }); got.push('a lead'); }
  if (o.comp) { const key = o.comp === 'friend' ? pick(S, Object.keys((S.camp && S.camp.friends) || { knight: 1 })) : o.comp; joinComp(S, key); S.q.log.push({ t: `${COMPANIONS[key].n} joins you.`, good: true }); got.push(`${COMPANIONS[key].n} joins the party`); }
  if (o.boss) { S.q.bossHp += o.boss; got.push(o.boss < 0 ? `${S.q.name} is weakened` : `${S.q.name} grows stronger`); }
  if (o.next) { S.nextMod = o.next; got.push({ ambush: 'you will have the jump on the next enemy', surprised: 'the next enemy will have the jump on you', exposed: 'the next enemy starts Exposed' }[o.next]); }
  const items = []; for (const k of ['item', 'item2']) if (o[k]) { const it = o[k] === 'gear' ? rollGear(S, act) : o[k] === 'trinket' ? rollTrinket(S, act) : rollCons(S, act, 1); if (it.k === 'cons') { addBag(S, it); got.push(`found ${it.n}`); } else items.push(it); }
  return { got, items, fight: o.fight };
}
function chooseEvent(S, ci) {
  const e = EV[S.ev.id], c = e.c[ci]; if (S.ev.result) return false; let o = c, roll = null, hi = -1;
  if (c.cost) { const cost = Math.round(c.cost * (0.7 + 0.3 * pw(S))); if (S.gold < cost) return false; S.gold -= cost; }
  if (c.s) { const info = checkInfo(S, c), r = die(S, 20); hi = info.hi; const tot = r + info.stat, dc = baseDC(S, c);
    const out = r === 20 || (tot >= dc && r !== 1) ? 'ok' : tot >= dc - 4 && c.mid ? 'mid' : 'bad'; o = c[out]; roll = { hi, r, stat: info.stat, dc, out, s: c.s }; S.stats.checks++; if (out === 'ok') S.stats.passed++; }
  if (c.random) o = pick(S, c.random);
  const res = applyFx(S, o, hi); S.ev.result = { text: fill(S, (c.x && c.random ? c.x + ' ' : '') + o.x), roll, got: res.got, items: res.items, fight: res.fight }; return true;
}
// found gear from an event is handed out one piece at a time
function eventGive(S, hi) { const r = S.ev.result, it = r.items[0]; if (!it) return false; if (!give(S, it, hi)) return false; r.items.shift(); return true; }
function continueEvent(S) { const r = S.ev.result; if (!r || r.items.length) return false; S.ev = null; if (r.fight) startCombat(S, encounter(S, r.fight)); else finishNode(S); return true; }

// ---------- story: the plot spine, named fights, objectives and companions ----------
// Each adventure has three stages: pick up the trail (I), break the villain's strength (II), storm the lair (III).
// A campaign chapter runs stages I and II in its first act and III in its second.
// Fight objectives: runner (kill the messenger before he escapes), timed (win within N rounds), hold (survive N rounds), protect (keep someone alive).
// ok/fail: 'lead' (a lead on the lieutenant), 'weaken' and 'breach' (the villain starts the final fight weaker), 'alert' (the villain is warned).
const FIGHTS = {
  banditking: {
    lt: ['Red Morwen, Garrick\'s captain', 'One-Eyed Brask, master of the gate'],
    1: [{ n: 'The burning farmstead', x: '{V}\'s riders are torching a farm on the road out of {H}. The farmer is still inside.', r: ['thug', 'cutpurse', 'archer'], obj: { k: 'protect', npc: 'Farmer Hobb', ok: 'lead', okx: 'Hobb saw which way the riders went, and who led them.', fail: 'Hobb did not make it.' } },
      { n: 'The toll-post at the ford', x: 'A barricade, a brazier, and a lookout with a fast horse.', r: ['thug', 'thug', 'archer'], obj: { k: 'runner', rounds: 4, ok: 'lead', okx: 'The lookout\'s saddlebags hold {V}\'s orders.', fail: 'The lookout gallops off to warn {V}.' } }],
    2: [{ n: 'The payroll wagon', x: 'An iron-bound wagon carrying the pay of {V}\'s sellswords.', r: ['thug', 'xbow', 'cutpurse', 'hedgemage'], obj: { k: 'timed', rounds: 7, ok: 'weaken', okx: 'Without their pay, half of {V}\'s hired blades drift away.', fail: 'The wagon rolls on to {L}.' } },
      { n: 'Hostages at Millbrook', x: 'Villagers who could not pay the tribute are being marched off in chains.', r: ['thug', 'archer', 'cutpurse', 'thug'], obj: { k: 'protect', npc: 'The hostages', ok: 'weaken', okx: 'The freed villagers bar their doors to {V}\'s collectors for good.', fail: 'The hostages are dragged away in the confusion.' } },
      { n: 'The smugglers\' cove', x: 'Boats of stolen goods bound for {L}, and a runner ready to signal the ships.', r: ['cutpurse', 'xbow', 'thug'], obj: { k: 'runner', rounds: 4, ok: 'weaken', okx: 'The signal never comes; the supply ships turn back.', fail: 'A lantern flashes from the cliff. The ships slip away.' } }],
    3: [{ n: 'The outer palisade', x: 'The walls of {L}. Hold the breach long enough and the defence collapses.', r: ['thug', 'xbow', 'archer', 'thug'], obj: { k: 'hold', rounds: 4, ok: 'breach', okx: 'The palisade is yours; the defenders fall back in disorder.' } },
      { n: 'The gatehouse', x: 'Take the gatehouse before they drop the portcullis.', r: ['thug', 'thug', 'xbow', 'hedgemage'], obj: { k: 'timed', rounds: 7, ok: 'breach', okx: 'The portcullis stays up.', fail: 'The portcullis slams down; you find another way, slowly.' } }]
  },
  necro: {
    lt: ['The Gravewarden', 'Sister Mott, keeper of the bone-carts'],
    1: [{ n: 'Grave-robbers in the chapel yard', x: 'Hired diggers are filling a cart with the newly buried, watched by things that should be under the earth.', r: ['cutpurse', 'zombie', 'skeleton'], obj: { k: 'runner', rounds: 4, ok: 'lead', okx: 'The fleeing digger drops a ledger: names, dates, and a place.', fail: 'The digger escapes with the ledger.' } },
      { n: 'The restless barrow', x: 'The barrow on the hill has opened. Its dead are walking toward {H}.', r: ['skeleton', 'skeleton', 'bonearcher'], obj: { k: 'protect', npc: 'The barrow-keeper', ok: 'lead', okx: 'The old barrow-keeper knows who broke the seals.', fail: 'The barrow-keeper falls among the bones.' } }],
    2: [{ n: 'The bone-cart convoy', x: 'Carts piled with corpses, bound for {L}. Every one is a soldier for {V}.', r: ['zombie', 'skeleton', 'bonearcher', 'ghoul'], obj: { k: 'timed', rounds: 7, ok: 'weaken', okx: 'The carts burn. {V} will have fewer servants.', fail: 'Some carts get through.' } },
      { n: 'The plague village', x: 'The living have barred themselves in the church while the risen claw at the doors.', r: ['zombie', 'zombie', 'ghoul'], obj: { k: 'protect', npc: 'The church door', ok: 'weaken', okx: 'Nobody here will rise for {V} tonight.', fail: 'The door gives way. Tomorrow there will be more risen.' } }],
    3: [{ n: 'The ossuary gate', x: 'Walls of stacked skulls, and the dead pouring out to meet you.', r: ['skeleton', 'bonearcher', 'wraith', 'skeleton'], obj: { k: 'hold', rounds: 4, ok: 'breach', okx: 'The flood of dead slows to a trickle.' } },
      { n: 'The embalming halls', x: 'Vats and tables and things half-finished. Burn it before they wake.', r: ['ghoul', 'wraith', 'zombie'], obj: { k: 'timed', rounds: 7, ok: 'breach', okx: 'The halls burn. {V}\'s reserves are gone.', fail: 'Some of the half-finished things crawl away into the dark.' } }]
  },
  knight: {
    lt: ['Sir Hollin the Faithless', 'The Black Squire'],
    1: [{ n: 'Pilgrims on the old road', x: 'Grave-soldiers in rusted livery have fallen on a column of pilgrims.', r: ['skeleton', 'skeleton', 'bonearcher'], obj: { k: 'protect', npc: 'The pilgrims', ok: 'lead', okx: 'A pilgrim recognised the livery: Sir Hollin\'s men, sworn to {V} in life and death.', fail: 'Few pilgrims survive to tell anyone anything.' } },
      { n: 'The broken shrine', x: 'A herald in black is reading {V}\'s proclamation to the dead.', r: ['skeleton', 'zombie', 'runner'], obj: { k: 'runner', rounds: 4, ok: 'lead', okx: 'The herald\'s scroll names the muster-field.', fail: 'The herald rides off into the mist.' } }],
    2: [{ n: 'The muster at the barrow-field', x: 'Rank on rank of dead soldiers, forming up under {V}\'s banner. Break them before they finish.', r: ['skeleton', 'skeleton', 'bonearcher', 'wraith'], obj: { k: 'timed', rounds: 7, ok: 'weaken', okx: 'The muster breaks. {V} rides to war with half an army.', fail: 'The column forms and marches.' } },
      { n: 'The cursed armoury', x: 'An old royal armoury, now forging blades for the dead.', r: ['skeleton', 'ghoul', 'bonearcher'], obj: { k: 'hold', rounds: 4, ok: 'weaken', okx: 'You hold the forge long enough to wreck it.' } }],
    3: [{ n: 'The drawbridge', x: 'Mournwatch\'s drawbridge, and its dead garrison.', r: ['skeleton', 'warden', 'bonearcher'], obj: { k: 'hold', rounds: 4, ok: 'breach', okx: 'The bridge holds; the garrison does not.' } },
      { n: 'The chapel of oaths', x: 'Where {V} once swore to protect this land. The dead kneel here still.', r: ['wraith', 'skeleton', 'bonearcher'], obj: { k: 'timed', rounds: 7, ok: 'breach', okx: 'You break the altar where the oath was broken. Somewhere above, {V} cries out.', fail: 'The dead rise from their prayers.' } }]
  },
  beastlord: {
    lt: ['Old Greyback', 'The Briar Troll'],
    1: [{ n: 'The maddened herd', x: 'Cattle and boar, driven mad by a horn you can hear on the wind, are trampling a shepherd\'s fold.', r: ['boar', 'boar', 'wolf'], obj: { k: 'protect', npc: 'The shepherd', ok: 'lead', okx: 'The shepherd knows the horn: it comes from the old wood, where the Antlered Man was first seen.', fail: 'The shepherd is trampled.' } },
      { n: 'Wolves at the woodcutters\' camp', x: 'A pack too large and too clever, hunting as if someone commands it.', r: ['wolf', 'wolf', 'wolf', 'spider'], obj: { k: 'timed', rounds: 6, ok: 'lead', okx: 'Among the dead wolves is one wearing a collar of braided thorn.', fail: 'The pack scatters into the trees.' } }],
    2: [{ n: 'The poisoned spring', x: 'Spiders the size of dogs are fouling the spring that waters three villages.', r: ['spider', 'spider', 'lurker'], obj: { k: 'timed', rounds: 7, ok: 'weaken', okx: 'The spring runs clean. The beasts that drink from it are themselves again.', fail: 'The spring stays fouled.' } },
      { n: 'The hunting lodge', x: 'Hunters are holed up in their lodge with the whole forest at the door.', r: ['wolf', 'boar', 'bats', 'spider'], obj: { k: 'protect', npc: 'The hunters', ok: 'weaken', okx: 'The hunters will guide you through the wood, and know where the Antlered Man sleeps.', fail: 'The lodge burns.' } }],
    3: [{ n: 'The thorn wall', x: 'A living wall of briars, and everything with teeth behind it.', r: ['wolf', 'boar', 'spider'], obj: { k: 'hold', rounds: 4, ok: 'breach', okx: 'The wall withers as you cut your way in.' } },
      { n: 'The heart of the wood', x: 'The oldest trees, where the beasts gather to be blessed.', r: ['bats', 'wolf', 'spider', 'boar'], obj: { k: 'timed', rounds: 7, ok: 'breach', okx: 'You scatter the gathering before the blessing is done.', fail: 'The howling rises to a roar.' } }]
  },
  prophet: {
    lt: ['Brother Cinder', 'The Ashen Champion'],
    1: [{ n: 'The street preacher', x: 'A wild-eyed preacher is whipping a crowd into a mob. When steel comes out, he runs.', r: ['zealot', 'acolyte', 'runner'], obj: { k: 'runner', rounds: 4, ok: 'lead', okx: 'The preacher talks: Brother Cinder gives the orders, from a chapel outside town.', fail: 'The preacher is gone, and the crowd hates you for it.' } },
      { n: 'The burned chapel', x: 'Zealots are burning the old chapel with its priest still inside.', r: ['zealot', 'zealot', 'imp'], obj: { k: 'protect', npc: 'Brother Aldo', ok: 'lead', okx: 'Brother Aldo has been watching the cult for months, and tells you everything.', fail: 'Brother Aldo dies in the smoke.' } }],
    2: [{ n: 'The pilgrim column', x: 'New converts marching to {L}, with an escort of fanatics.', r: ['zealot', 'acolyte', 'flamecaller'], obj: { k: 'timed', rounds: 7, ok: 'weaken', okx: 'The converts scatter home. Fewer voices for {V}\'s choir.', fail: 'The column reaches {L}.' } },
      { n: 'The pyre at Wickham', x: 'They have built a pyre in the square, and someone is tied to it.', r: ['zealot', 'flamecaller', 'imp'], obj: { k: 'protect', npc: 'The condemned', ok: 'weaken', okx: 'Wickham turns on the cult that night.', fail: 'The pyre is lit.' } }],
    3: [{ n: 'The ember stair', x: 'A long stair of hot stone, and the faithful defending every step.', r: ['zealot', 'imp', 'flamecaller'], obj: { k: 'hold', rounds: 4, ok: 'breach', okx: 'The stair is yours.' } },
      { n: 'The inner sanctum', x: 'The choir that feeds {V}\'s fire. Silence it.', r: ['hexer', 'flamecaller', 'zealot'], obj: { k: 'timed', rounds: 7, ok: 'breach', okx: 'The singing stops, and {V}\'s fire gutters.', fail: 'The hymn reaches its end.' } }]
  },
  wyrm: {
    lt: ['The Scale-Priest', 'Ashwing\'s Champion'],
    1: [{ n: 'Wyrm-sworn raiders', x: 'Raiders in scale-painted masks, collecting tribute for the dragon. One rides for the mountain.', r: ['zealot', 'imp', 'archer'], obj: { k: 'runner', rounds: 4, ok: 'lead', okx: 'The rider\'s pouch holds a map of the tribute roads.', fail: 'The rider vanishes toward the smoking peak.' } },
      { n: 'The scorched hamlet', x: 'Imps are picking through the ashes of a hamlet that did not pay.', r: ['imp', 'imp', 'zealot'], obj: { k: 'protect', npc: 'The survivors', ok: 'lead', okx: 'The survivors saw the Scale-Priest who leads the raids.', fail: 'There are no survivors.' } }],
    2: [{ n: 'The tribute caravan', x: 'Gold, cattle and captives on the road to the mountain.', r: ['zealot', 'hexer', 'imp'], obj: { k: 'timed', rounds: 7, ok: 'weaken', okx: 'Ashwing will go hungry, and a hungry dragon is a careless one.', fail: 'The caravan climbs out of reach.' } },
      { n: 'The egg shrine', x: 'Cultists tending a clutch of eggs in a cave of embers.', r: ['flamecaller', 'acolyte', 'zealot'], obj: { k: 'hold', rounds: 4, ok: 'weaken', okx: 'The eggs are broken. Somewhere, a dragon screams.' } }],
    3: [{ n: 'The cinder bridge', x: 'A bridge of black rock over a river of fire.', r: ['zealot', 'imp', 'flamecaller'], obj: { k: 'hold', rounds: 4, ok: 'breach', okx: 'The bridge is held.' } },
      { n: 'The hoard tunnels', x: 'The tunnels to the hoard, and the cult\'s last defenders.', r: ['imp', 'flamecaller', 'zealot', 'hexer'], obj: { k: 'timed', rounds: 7, ok: 'breach', okx: 'You reach the hoard before the alarm.', fail: 'Horns sound in the deep.' } }]
  },
  arch1: {
    lt: ['The Regent\'s Marshal', 'The Regent\'s Shadow'],
    1: [{ n: 'The Regent\'s outriders', x: 'Riders under the crowned seal, carrying orders to every garrison.', r: 'fam', obj: { k: 'runner', rounds: 4, ok: 'lead', okx: 'The orders reveal the Regent\'s plan for the siege.', fail: 'The orders get through.' } },
      { n: 'The burning march', x: 'The Regent\'s host is burning its way across the borderlands.', r: 'fam', obj: { k: 'protect', npc: 'The refugees', ok: 'lead', okx: 'Among the refugees is a deserter from the Regent\'s own guard.', fail: 'The refugees are cut down.' } }],
    2: [{ n: 'The siege lines', x: 'Trenches and engines ringing the last free city.', r: 'fam', obj: { k: 'timed', rounds: 7, ok: 'weaken', okx: 'The siege engines burn.', fail: 'The engines keep firing.' } },
      { n: 'The supply depot', x: 'The grain and steel that feeds the Regent\'s war.', r: 'fam', obj: { k: 'hold', rounds: 4, ok: 'weaken', okx: 'The depot burns for three days.' } }],
    3: [{ n: 'The black gate', x: 'The gate of the stronghold, and its picked guard.', r: 'fam', obj: { k: 'hold', rounds: 4, ok: 'breach', okx: 'The gate falls.' } },
      { n: 'The throne-hall approach', x: 'The last corridor before the throne.', r: 'fam', obj: { k: 'timed', rounds: 7, ok: 'breach', okx: 'You reach the throne before the Regent is ready.', fail: 'The Regent is waiting.' } }]
  }
};
// the land itself: creatures and dangers of each region, often stirred up by the villain
const REGION_FIGHTS = {
  'the Thornwood': [{ n: 'Wolves on the trail', x: 'Driven from their dens by {V}\'s {M}, a starving pack has found easier prey: you.', r: ['wolf', 'wolf', 'wolf'] }, { n: 'Spider hollow', x: 'The path runs through webs as thick as sails.', r: ['spider', 'spider', 'boar'] }],
  'the Saltfen': [{ n: 'Things in the reeds', x: 'Something long and pale moves through the water toward you.', r: ['lurker', 'lurker', 'drowned'] }, { n: 'The drowned causeway', x: 'The dead of the fen walk the causeway at dusk.', r: ['drowned', 'drowned', 'spider'] }],
  'the Ashen Coast': [{ n: 'Wreckers on the shore', x: 'False lights on the cliffs, and men with clubs waiting for the wrecks.', r: ['cutpurse', 'thug', 'xbow'] }, { n: 'The sea-cave', x: 'The tide cave is full of things that came in with the storm.', r: ['bats', 'drowned', 'lurker'] }],
  'the High Moors': [{ n: 'The barrow-downs', x: 'The old kings under the moor are restless tonight.', r: ['skeleton', 'bonearcher', 'skeleton'] }, { n: 'Moor beasts', x: 'Boar and wolf, hungry after a hard winter.', r: ['boar', 'wolf', 'bats'] }],
  'the Greymarch': [{ n: 'The deserters\' camp', x: 'Men who ran from {V}\'s war, now preying on anyone weaker.', r: ['thug', 'archer', 'cutpurse'] }, { n: 'The hill-fort ruin', x: 'Something nests in the old hill-fort.', r: ['skeleton', 'bats', 'boar'] }],
  'the Vale of Sorrows': [{ n: 'The mourners\' road', x: 'The vale\'s dead do not rest easy, and {V}\'s coming has woken them.', r: ['zombie', 'skeleton', 'bats'] }, { n: 'The weeping mill', x: 'The mill wheel turns by itself, and the miller is not alive.', r: ['ghoul', 'zombie', 'zombie'] }]
};
// fights that are part of the villain's campaign but carry no special objective
const GENERIC_FIGHTS = { 1: [{ n: 'A patrol of {M}', x: 'They are watching the roads for anyone who might cause trouble.' }, { n: 'Scouts on the ridge', x: '{V}\'s scouts have spotted you first.' }, { n: 'The waystation', x: '{M} have taken the waystation and its stores.' }],
  2: [{ n: 'A raiding band', x: 'Raiders sent out by {V}, coming back laden.' }, { n: 'The forward camp', x: 'A camp of {M}, closer to {H} than you would like.' }, { n: 'Reinforcements on the march', x: 'A column on its way to {L}.' }],
  3: [{ n: 'Sentries of {L}', x: 'The outer guard of the lair.' }, { n: 'The last ridge', x: 'Within sight of {L}, they make a stand.' }] };
const OBJ_TEXT = { runner: o => `Kill the Messenger before round ${o.rounds + 1}, or he escapes.`, timed: o => `Win within ${o.rounds} rounds.`, hold: o => `Hold out for ${o.rounds} rounds; enemies keep coming.`, protect: o => `Keep ${o.npc} alive.` };
const stageOf = (S, n) => !S.camp ? n.act : n.act === 2 ? 3 : n.x <= 2 ? 1 : 2;
function fightSet(S) { return FIGHTS[S.q.boss] || FIGHTS.arch1; }
// give every fight on the map a named situation, without repeats
function nameFights(S) {
  const used = new Set(), set = fightSet(S), reg = REGION_FIGHTS[S.q.region] || [];
  let lt = 0;
  for (const n of S.map) {
    if (n.type === 'elite' || n.type === 'boss') { if (n.type === 'elite') { n.ltn = set.lt[Math.min(lt, set.lt.length - 1)]; lt += n.lt ? 1 : 0; n.fname = n.lt ? n.ltn : 'A dangerous foe'; } else n.fname = S.q.lair; continue; }
    if (n.type !== 'fight') continue;
    const st = stageOf(S, n), pool = (set[st] || []).map((f, i) => ['v' + st + i, f]).filter(([k]) => !used.has(k)), rpool = reg.map((f, i) => ['r' + i, f]).filter(([k]) => !used.has(k));
    const takeRegion = rpool.length && (!pool.length || rnd(S) < 0.3);
    const gpool = GENERIC_FIGHTS[st].map((f, i) => ['g' + st + i, f]).filter(([k]) => !used.has(k));
    const [k, f] = takeRegion ? pick(S, rpool) : pool.length ? pick(S, pool) : gpool.length ? pick(S, gpool) : ['g' + st + '0', GENERIC_FIGHTS[st][0]];
    used.add(k); n.ft = k; n.fname = fill(S, f.n);
  }
}
const fightOf = (S, n) => { if (!n || !n.ft) return null; const k = n.ft[0]; if (k === 'r') return (REGION_FIGHTS[S.q.region] || [])[+n.ft.slice(1)]; if (k === 'g') return { ...GENERIC_FIGHTS[+n.ft[1]][+n.ft.slice(2)], r: 'fam' }; return fightSet(S)[+n.ft[1]][+n.ft.slice(2)]; };
// objectives inside a fight
function objStart(S, C) {
  const o = C.obj; if (!o) return;
  if (o.k === 'runner' && !C.units.some(u => u.key === 'runner')) { const u = enemyUnit(S, 'runner', C.lv, C.nextId++, C.n); u.row = 'B'; C.units.push(u); }
  for (const u of C.units) if (u.key === 'runner') { u.flee = true; u.obj = true; }
  if (o.k === 'protect') { const hp = Math.round((8 + 4 * C.lv) * (S.diff ? 0.85 : 1)); C.units.push({ id: 'n0', side: 'H', npc: true, name: o.npc, row: 'B', hp, max: hp, st: { might: 1, agility: 1, mind: 1, spirit: 1 }, lvl: 1, fx: {}, arm: 0, ward: 0, defb: 0, w: { die: 2, sp: 2, hit: 0, bonus: 0 }, skills: [], states: {}, cds: {}, used: {} }); }
  say(C, 'Objective: ' + OBJ_TEXT[o.k](o));
}
function objRound(S, C) {
  const o = C.obj; if (!o || C.round < 2) return;
  if (o.k === 'runner') for (const u of living(C, 'E').filter(u => u.flee)) if (C.round > o.rounds) { u.hp = 0; u.down = true; o.escaped = true; say(C, `${u.name} breaks away and escapes!`); }
  if (o.k === 'hold' && C.round <= o.rounds) { const pool = (o.pool || []).filter(k => EN[k] && !EN[k].elite); if (pool.length && living(C, 'E').length < Math.max(2, C.n)) { const u = prep(S, C, enemyUnit(S, pick(S, pool), C.lv, C.nextId++, C.n)); u.next = C.time + delayOf(u, 'n'); C.units.push(u); say(C, `More of them arrive: ${u.name}.`); } }
  if (o.k === 'hold' && C.round > o.rounds) say(C, 'You have held long enough. The rest break and flee.');
}
function objEnd(S, C) {
  const o = C.obj; if (!o) return '';
  const ok = o.k === 'runner' ? !o.escaped : o.k === 'timed' ? C.round <= o.rounds : o.k === 'protect' ? up(C.units.find(u => u.npc)) : true; o.won = ok;
  const q = S.q, eff = ok ? o.ok : o.failEff || (o.k === 'runner' ? 'alert' : null), line = fill(S, ok ? o.okx : o.fail || '');
  if (eff === 'lead') { q.leads = (q.leads || 0) + 1; }
  if (eff === 'weaken') q.bossHp -= 0.07;
  if (eff === 'breach') q.bossHp -= 0.06;
  if (eff === 'alert') q.bossHp += 0.04;
  const tag = eff === 'lead' ? ' (a lead)' : eff === 'weaken' ? ` (${q.name} is weakened)` : eff === 'breach' ? ` (the way to ${q.name} is clearer)` : eff === 'alert' ? ` (${q.name} is warned)` : '';
  q.log.push({ t: (C.name || 'Fight') + ': ' + line + tag, good: ok });
  return (ok ? 'Objective complete. ' : 'Objective failed. ') + line + tag;
}
const ACT_GOAL = {
  1: q => `Pick up the trail. Win the named fights and follow leads to learn about ${q.name}'s lieutenant. Two leads, and the lieutenant is caught unready (${Math.min(2, q.leads || 0)}/2).`,
  2: q => `Break ${q.name}'s strength. Every objective you complete weakens ${q.name} for the final fight.`,
  3: q => `Storm ${q.lair}. Clear the approaches before you face ${q.name}.`
};
const actGoal = S => { const n = S.pos >= 0 ? S.map[S.pos] : S.map[0]; const st = !S.camp ? n.act : n.act === 2 ? 3 : (S.q.leads || 0) >= 2 || n.x > 2 ? 2 : 1; return ACT_GOAL[st](S.q); };
const bossOdds = S => Math.round(-S.q.bossHp * 100);

// ---------- companions: a fifth fighter for a while ----------
const COMPANIONS = {
  hunter: { n: 'Aldric the Hunter', d: 'a bowman who knows these woods', hp: 22, hpl: 6, st: [2, 4, 1, 2], w: 'bow', cls: 'rogue', sk: ['quickshot', 'venomarrow'], row: 'B', arm: 1 },
  knight: { n: 'Ser Corin', d: 'a knight without a lord', hp: 30, hpl: 8, st: [4, 2, 1, 2], w: 'sword', cls: 'warrior', sk: ['heavy', 'shove', 'taunt'], row: 'F', arm: 3, defb: 2 },
  witch: { n: 'Mother Ysel', d: 'a hedge-witch of the fens', hp: 18, hpl: 5, st: [1, 2, 4, 3], w: 'staff', cls: 'priest', sk: ['mend', 'frostshard', 'spark'], row: 'B', arm: 0 },
  deserter: { n: 'Tam the Deserter', d: 'one of the villain\'s own men, turned', hp: 24, hpl: 7, st: [3, 3, 1, 1], w: 'axe', cls: 'warrior', sk: ['heavy', 'cleave'], row: 'F', arm: 2 }
};
function joinComp(S, key) { const c = COMPANIONS[key], lv = S.party[0].level, max = Math.round((c.hp + c.hpl * (lv - 1)) * 1.1); S.comp = { key, name: c.n, hp: max, max, act: S.pos >= 0 ? S.map[S.pos].act : 1 }; if (S.camp) S.camp.friends = { ...(S.camp.friends || {}), [key]: true }; }
function compUnit(S) {
  const c = COMPANIONS[S.comp.key], lv = S.party[0].level, w = WT[c.w], t = clamp(Math.round(pw(S)), 1, 5) - 1, up1 = Math.floor((lv - 1) / 2), st = {};
  STATS.forEach((s, i) => st[s] = c.st[i] + (i === c.st.indexOf(Math.max(...c.st)) ? lv - 1 : up1));
  return { id: 'c0', side: 'H', comp: true, cls: c.cls, name: c.n, row: c.row, hp: S.comp.hp, max: S.comp.max, st, lvl: lv, fx: {}, arm: c.arm + Math.floor(lv / 3), ward: Math.floor(lv / 3), defb: c.defb || 0,
    w: { die: w.die[t], sp: (w.sp ? w.sp[t] : 4 + t), bonus: w.bonus || 0, fin: w.fin, ranged: w.ranged, reach: w.reach, phys: w.phys, stk: {} }, skills: c.sk.slice(), states: {}, cds: {}, used: {} };
}

// ---------- map ----------
// Three acts, one band of the map each, snaking left-to-right, right-to-left, left-to-right. Every choice layer has three lanes
// and a fixed mix of stop types, so no route is starved of fights, rest or trade.
function genMap(S) {
  const nodes = [], layers = []; let x = 0;
  const add = (act, type, extra) => { const n = { id: nodes.length, act, x, type, next: [], lane: 1, ...extra }; nodes.push(n); return n.id; };
  const single = (act, type, extra) => { layers.push([add(act, type, extra)]); x++; };
  const acts = S.camp ? 2 : 3;
  for (let act = 1; act <= acts; act++) {
    if (act === 1) single(1, 'event', { ev: 'hook' });
    const wild = () => hasMod(S, 'elites') ? 'elite' : pick(S, act > 1 ? ['elite', 'event', 'fight'] : ['event', 'fight']);
    const decks = [['fight', 'fight', 'event'], ['fight', 'event', 'shop'], ['fight', 'event', wild()], ['rest', rnd(S) < 0.5 ? 'fight' : 'event', rnd(S) < 0.5 ? 'shop' : 'fight']];
    if (hasMod(S, 'elites')) decks[1][1] = 'elite';
    for (const deck of decks) { layers.push(shuffle(S, deck).map((t, lane) => add(act, hasMod(S, 'nocamp') && t === 'rest' ? 'fight' : t, { lane }))); x++; }
    if (act === 2 && !S.camp) single(2, 'event', { ev: 'tw_' + S.q.twist });
    if (act === acts) single(act, 'event', { ev: 'lair' });
    single(act, act === acts ? 'boss' : 'elite', { lt: true });
  }
  for (let i = 0; i + 1 < layers.length; i++) { const a = layers[i], b = layers[i + 1];
    if (a.length === 1 || b.length === 1) { for (const id of a) nodes[id].next = b.slice(); continue; }
    a.forEach((id, k) => { nodes[id].next.push(b[k]); const d = k === 0 ? 1 : k === 2 ? -1 : rnd(S) < 0.5 ? 1 : -1;
      if (rnd(S) < 0.55 && !nodes[a[k + d]].next.includes(b[k])) nodes[id].next.push(b[k + d]); nodes[id].next.sort((p, q) => p - q); }); }
  // positions on a 960 x 660 sheet
  const perAct = [0, 0, 0, 0]; for (const l of layers) perAct[nodes[l[0]].act]++;
  const seenCol = [0, 0, 0, 0];
  for (const l of layers) { const act = nodes[l[0]].act, col = seenCol[act]++, f = perAct[act] === 1 ? 0.5 : col / (perAct[act] - 1), fx = act === 2 ? 1 - f : f;
    for (const id of l) { const n = nodes[id], one = l.length === 1; n.px = Math.round(95 + fx * 770 + (one ? 0 : (rnd(S) - 0.5) * 30) + (act > 1 && col === 0 ? (act === 2 ? -1 : 1) * (2 - n.lane) * 46 : 0)); n.py = Math.round((acts === 2 ? 190 + (act - 1) * 280 : 140 + (act - 1) * 200) + (one ? 0 : (n.lane - 1) * (acts === 2 ? 78 : 62) + (rnd(S) - 0.5) * 18)); } }
  S.map = nodes; S.layers = layers.length; S.acts = acts; nameFights(S);
}
function options(S) { return S.pos < 0 ? [0] : S.map[S.pos].next; }
function encounter(S, kind) {
  const node = S.map[S.pos], act = node.act, n = S.party.length, prog = S.map.filter(m => m.act === act && m.x < node.x && m.lane === 1).length / 14, P = pw(S),
    lv = S.camp ? 0.875 * (1 + (Math.min(5, S.camp.ch) - 1) * 1.9 + (act - 1) * 0.95 + prog * 2) + 0.125 + (S.camp.ch <= 5 ? K.campLv[S.camp.ch - 1] + (S.diff ? K.vetLv[S.camp.ch - 1] : 0) : K.campLv[4] + (S.diff ? K.vetLv[4] : 0) + K.conLv + K.rankLv * ((S.q.rank || 1) - 1)) : act * 1.5 - 0.5 + prog + K.lateLv * (act - 1) + (S.diff ? K.vetLate * (act - 1) : 0);
  const fam = kind === 'boss' || node.lt || rnd(S) < 0.7 ? S.q.fam : pick(S, ['beast', 'bandit']);
  const pool = Object.keys(EN).filter(k => EN[k].fam === fam && !EN[k].elite && !EN[k].boss && (EN[k].act || 1) <= P), list = [];
  const more = hasMod(S, 'swarm') ? 1 : 0, ft = kind === 'normal' ? fightOf(S, node) : null;
  if (ft) { const roster = ft.r === 'fam' ? pool : ft.r, cnt = clamp(n - 1 + (S.stats.fights >= 3 && rnd(S) < 0.3 + 0.1 * Math.min(3, P) ? 1 : 0) - (S.stats.fights === 0 || (P === 1 && node.x <= 1) ? 1 : 0) + more, 1, 6);
    for (let k = 0; k < cnt; k++) list.push(k < roster.length ? roster[k] : pick(S, roster.filter(r => r !== 'runner')));
    if (roster.includes('runner') && !list.includes('runner')) list[list.length - 1] = 'runner';
    const obj = ft.obj ? { ...ft.obj, pool: roster.filter(r => r !== 'runner') } : null; return { kind, lv, list, name: fill(S, ft.n), text: fill(S, ft.x), obj }; }
  if (kind === 'boss') { list.push(S.q.boss); const lt = (BOSSP[S.q.boss] || {}).lt || []; for (let k = 0; k < Math.max(0, n - 2) + more; k++) list.push(lt[k] || pick(S, pool)); }
  else if (kind === 'elite') { const el = node.lt ? S.q.lt : Object.keys(EN).find(k => EN[k].fam === fam && EN[k].elite); list.push(el); for (let k = 0; k < Math.max(0, n - 1 - (P < 2 ? 1 : 0)) + more; k++) list.push(pick(S, pool)); }
  else { const cnt = clamp(n - 1 + (S.stats.fights >= 3 && rnd(S) < 0.3 + 0.1 * Math.min(3, P) ? 1 : 0) - (S.stats.fights === 0 || (P === 1 && node.x <= 1) ? 1 : 0) + more, 1, 6); for (let k = 0; k < cnt; k++) list.push(pick(S, pool)); }
  return { kind, lv, list, name: node.fname && kind !== 'normal' ? node.fname : '', ltn: kind === 'elite' && node.lt ? node.ltn : null };
}
function travel(S, id) {
  if (S.screen !== 'map' || !options(S).includes(id)) return false; S.pos = id; const n = S.map[id]; n.seen = true; S.stats.nodes++;
  if (!S.camp && S.lastAct && n.act > S.lastAct) { for (const h of S.party) { const m0 = maxHp(h); h.wounds = 0; h.hp = Math.min(maxHp(h), h.hp + maxHp(h) - m0); } S.q.log.push({ t: 'A new act: every wound has healed.', good: true }); } if (!S.camp) S.lastAct = n.act;
  if (S.comp && !S.camp && n.act > S.comp.act) { S.q.log.push({ t: `${S.comp.name} parts ways with you at the end of the act.`, good: true }); S.comp = null; }
  if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startCombat(S, encounter(S, n.type === 'fight' ? 'normal' : n.type));
  else if (n.type === 'event') openEvent(S, n.ev || pickEvent(S, evAct(S, n)));
  else if (n.type === 'shop') openShop(S); else S.screen = 'rest';
  return true;
}
const XP_AT = [0, 20, 50, 88, 127], CAMP_XP = [0, 22, 56, 106, 162, 224, 291, 364, 442, 526];
const xpAt = (S, lv) => (S.camp ? CAMP_XP : XP_AT)[lv];
// catch-up: the level a party should be at this stop; below it, all XP is +50%
function expLevel(S) { const n = S.map[S.pos]; if (!n) return 1; const xs = S.map.filter(m => m.act === n.act).map(m => m.x), lo = Math.min(...xs), hi = Math.max(...xs), f = hi > lo ? (n.x - lo) / (hi - lo) : 0;
  return n.act === 1 ? 1 + 2 * f : n.act === 2 ? Math.min(4.5, 3 + 2 * f) : 4.5 + f; }
function curLevel(S) { const lv = S.party[0].level; if (lv >= maxLevel(S)) return lv; const a = xpAt(S, lv - 1), b = xpAt(S, lv); return lv + (S.xp - a) / (b - a); }
function xpGain(S, base) { const v = Math.round(base * (!S.camp && curLevel(S) < expLevel(S) ? K.catchUp : 1)); S.xp += v; return v; }
const lvlDue = S => { const lv = S.party[0].level; return lv < maxLevel(S) && S.xp >= xpAt(S, lv); };
function afterNode(S) { if (S.camp && S.pos >= 0 && S.map[S.pos].type === 'boss' && S.map[S.pos].done) chapterEnd(S, true); else S.screen = 'map'; }
function finishNode(S) {
  S.map[S.pos].done = true; S.shop = null; S.leader++; if (!S.camp && !['fight', 'elite', 'boss'].includes(S.map[S.pos].type)) xpGain(S, K.nodeXp);
  if (lvlDue(S)) { levelUp(S); return; }
  afterNode(S);
}
function levelUp(S) {
  const gained = []; for (const h of S.party) { const before = known(h), m0 = maxHp(h); h.level++; h.hp += maxHp(h) - m0; h.hp = Math.min(maxHp(h), h.hp + Math.round(maxHp(h) * 0.2)); gained.push(known(h).filter(k => !before.includes(k))); }
  S.lvl = { level: S.party[0].level, gained, need: S.party[0].level === 3 ? S.party.map(() => true) : [], needT: S.party[0].level >= 6 ? S.party.map(h => !!h.sub) : [] }; S.screen = 'levelup';
  S.party.forEach((h, i) => { for (const k of gained[i]) if (h.eq.length < 4) h.eq.push(k); else if (h.ctrl === 'ai') autoEquip(h); });
}
function pickSub(S, hi, sub, take) { const h = S.party[hi]; if (!S.lvl || !S.lvl.need[hi] || !CLASSES[h.cls].subs[sub]) return false; h.sub = sub; S.lvl.need[hi] = false; const sk = CLASSES[h.cls].subs[sub].sk[0]; S.lvl.gained[hi] = [sk]; subGear(h, sub, S, take);
  if (h.eq.length < 4) h.eq.push(sk); else { const drop = h.eq.slice().sort((a, b) => SK[a].w - SK[b].w)[0]; if (h.ctrl === 'ai' || SK[drop].w < SK[sk].w) h.eq[h.eq.indexOf(drop)] = sk; }
  return true; }
// each path's signature weapon: on choosing a path the hero may have their weapon remade as it, keeping its quality and properties;
// the old weapon goes to the pack. Rangers need their bow to fight from the back row.
const SUBWP = { guardian: 'sword', berserker: 'axe', assassin: 'dagger', ranger: 'bow', cryomancer: 'staff', stormcaller: 'staff', lightbringer: 'mace', flamekeeper: 'mace' };
const pathWeapon = (h, sub) => { const w = h.gear.w, t = SUBWP[sub]; return !w || w.type === t || w.set || w.uq || (sub === 'ranger' && w.type === 'crossbow') ? null : finish({ k: 'weapon', type: t, tier: w.tier, afx: (w.afx || []).filter(a => AFFIX[a].on !== 'a') }); };
function subGear(h, sub, S, take) { const nw = take === false ? null : pathWeapon(h, sub);
  if (nw) { if (S) { S.stash.push(h.gear.w); note(S, nw); } h.gear.w = nw; if (WT[nw.type].two && h.gear.off) { if (S) S.stash.push(h.gear.off); h.gear.off = null; } }
  if (sub === 'ranger') { h.row = 'B'; h.eq = h.eq.map(id => swapSk(h, id)); } if (sub === 'flamekeeper') h.row = 'F'; if (sub === 'lightbringer') h.row = 'B'; h.hp = Math.min(h.hp, maxHp(h)); }
function pickTalent(S, hi, c) { if (!S.lvl || !S.lvl.needT[hi] || !setTalent(S, hi, S.lvl.level - 6, c)) return false; S.lvl.needT[hi] = false; return true; }
function closeLevel(S) { if (!S.lvl || S.lvl.need.some(Boolean) || S.lvl.needT.some(Boolean)) return false; S.lvl = null; if (lvlDue(S)) levelUp(S); else afterNode(S); return true; }
function setEq(S, hi, ids) { const h = S.party[hi], k = known(h); if (ids.length > 4 || ids.some(x => !k.includes(x)) || new Set(ids).size !== ids.length) return false; h.eq = ids.slice(); return true; }

// ---------- campaign: five chapters against one hidden enemy, then open-ended contracts ----------
const ARCH = [{ name: 'Vharos', title: 'the Pale Regent', sigil: 'a crowned skull', hold: 'the Black Citadel' }, { name: 'Queen Ysolde', title: 'the Winter Queen', sigil: 'a white stag', hold: 'the Frozen Court' }, { name: 'Malachar', title: 'the Ash Prophet', sigil: 'a burning eye', hold: 'the Cinder Throne' }];
const TRAIN = { talent: 15, sub: 80 };
// older saves: rebuild every item from the current tables, so renamed or changed effects apply
function migrate(S) { const fix = it => { if (!it || it.k === 'cons') return; if (it.k === 'trinket' && it.ti >= 0 && !it.set && !it.uq && TRINKETS[it.ti]) { it.n = TRINKETS[it.ti][0]; it.fx = JSON.parse(JSON.stringify(TRINKETS[it.ti][1])); } finish(it); };
  for (const h of S.party) { Object.values(h.gear).forEach(fix); h.eq = h.eq.map(id => swapSk(h, id)).filter(id => known(h).includes(id)); h.hp = Math.min(h.hp, maxHp(h)); } (S.stash || []).forEach(fix); if (S.shop) S.shop.items.forEach(fix); if (S.loot) S.loot.items.forEach(fix); if (S.ev && S.ev.result) S.ev.result.items.forEach(fix);
  for (const h of S.party) { if (h.sub === 'pyromancer') h.sub = 'cryomancer'; if (h.sub === 'warpriest') h.sub = 'flamekeeper'; }
  S.v = 6; S.comp = S.comp || null; if (S.q) { S.q.log = S.q.log || []; S.q.leads = S.q.leads || 0; } if (S.camp && S.camp.board) for (const b of S.camp.board) { b.log = b.log || []; b.leads = b.leads || 0; }
  for (const b of S.bag || []) if (!CONS[b.id]) b.qty = 0; S.bag = (S.bag || []).filter(b => b.qty > 0); if (S.camp) refreshBonus(S); return S; }
function newCampaign(seed, seats, diff) {
  const S = newRun(seed, seats, diff); const a = ri(S, ARCH.length);
  S.camp = { ch: 1, arch: a, order: shuffle(S, VILLAINS.map((v, i) => i)).slice(0, 4), done: [], wipes: 0, last: null, saga: false, rank: 1, best: 0, contracts: 0, doubles: 0, flawless: 0, downs0: 0, sagaWipes: -1, board: null, estate: null,
    trophies: {}, ach: {}, news: [], perk: null, codex: { set: {}, tr: {}, wp: {}, en: {}, uq: {} },
    lore: ['The roads of the realm have grown dangerous all at once, as if by arrangement. You have sworn to find out why, one warlord at a time.'] };
  S.gold = 30; for (const h of S.party) for (const g of Object.values(h.gear)) note(S, g); enterTown(S); return S;
}
// ---------- renown: contracts, the estate, trophies, the codex and deeds ----------
const MODS = { regen: ['Festering', 'Enemies regenerate 5% of their health each turn.'], nocamp: ['Forced March', 'There are no camps on the road.'], elites: ['Champions', 'More elite fights stand in the way.'], swarm: ['Horde', 'One more enemy in every fight.'],
  frail: ['Blighted', 'All healing on the party is halved.'], armored: ['Ironclad', 'Enemies have +3 armour and ward.'], swift: ['Ambushers', 'Enemies act first in the opening round.'], cursed: ['Hexed', 'Heroes start every fight Exposed.'] };
const hasMod = (S, m) => !!(S.q && S.q.mods && S.q.mods.includes(m));
const ROOMS = { hall: ['Trophy hall', 300, 'Trophies are put on display, and their bonuses take effect.'], library: ['Library', 300, 'Completed pages of the codex grant their rewards.'], armoury: ['Armoury', 400, 'Spare gear sells for 75% instead of 50%, and the merchant brings four more pieces of better stock.'],
  forge: ['Master forge', 500, 'All smith work costs a quarter less.'], infirmary: ['Infirmary', 250, 'The healer works for free.'], yard: ['Training yard', 250, 'Changing talents and retraining are free.'] };
const room = (S, id) => !!(S.camp && S.camp.estate && S.camp.estate.rooms[id]);
const trainCost = (S, kind) => room(S, 'yard') ? 0 : TRAIN[kind];
function buildRoom(S, id) { const c = S.camp; if (S.screen !== 'town' || !c.estate || !ROOMS[id] || c.estate.rooms[id] || S.gold < ROOMS[id][1]) return false; S.gold -= ROOMS[id][1]; c.estate.rooms[id] = true; refreshBonus(S); if (S.shop && room(S, 'infirmary')) S.shop.healCost = 0; checkAch(S); return true; }
const TROPHY = {
  banditking: { n: 'Garrick\'s Red Banner', d: 'Taken from the Bandit King.', perk: { gold: 0.04 } }, necro: { n: 'Mother Vex\'s Bone Flute', d: 'Taken from the Necromancer.', fx: { ward: 1 } }, knight: { n: 'The Hollow Helm', d: 'Taken from the Fallen Knight.', fx: { arm: 1 } },
  beastlord: { n: 'Antlers of the Beastlord', d: 'Taken from the Antlered Man.', fx: { hp: 4 } }, prophet: { n: 'The Prophet\'s Brazier', d: 'Taken from Prophet Ilsabet.', fx: { regen: 1 } }, wyrm: { n: 'Ashwing\'s Fang', d: 'Taken from the Wyrm.', perk: { disc: 0.06 } },
  arch: { n: 'The Broken Seal', d: 'All that remains of the saga\'s true enemy.', fx: { hp: 6 }, perk: { gold: 0.04 } }, flawless: { n: 'The Unblemished Shield', d: 'Finish a chapter or contract with no hero downed.', fx: { hp: 3 } },
  unbroken: { n: 'The Unbroken Oath', d: 'Complete the saga without once being driven back.', fx: { init: 2 } }, veteran: { n: 'Veteran\'s Laurels', d: 'Complete the saga on Veteran.', fx: { hit: 1 } },
  doubled: { n: 'The Gambler\'s Die', d: 'Complete a contract with two modifiers.', perk: { potion: 1 } }, rank5: { n: 'Writ of Renown', d: 'Complete a contract of rank 5.', fx: { dmg: 1 } }, rank10: { n: 'Star of the Realm', d: 'Complete a contract of rank 10.', fx: { crit: 1 } }
};
const PERK_TEXT = { gold: v => `+${pct(v)} gold from fights and rewards`, disc: v => `${pct(v)} off at the merchant`, potion: v => `${v} free healing potion at the start of each outing` };
const bonusText = t => [t.fx ? 'each hero: ' + fxText(t.fx) : '', ...Object.entries(t.perk || {}).map(([k, v]) => PERK_TEXT[k](v))].filter(Boolean).join('; ');
// the codex: everything the party has found or fought
const CODEX = [
  { id: 'set', n: 'Set pieces', total: () => Object.values(SETS).reduce((a, x) => a + x.pieces.length, 0), fx: { hp: 5 } }, { id: 'tr', n: 'Trinkets', total: () => TRINKETS.length, perk: { gold: 0.05 } },
  { id: 'wp', n: 'Weapon types', total: () => Object.keys(WT).length, fx: { hit: 1 } }, { id: 'en', n: 'Bestiary', total: () => Object.keys(EN).length, fx: { dmg: 1 } }, { id: 'uq', n: 'Relics', total: () => Object.keys(UNIQUES).length, fx: { crit: 1 } }
];
function note(S, it) { if (!S.camp || !it || it.k === 'cons') return; const c = S.camp.codex; if (it.uq) c.uq[it.uq] = 1; else if (it.set) c.set[it.set + it.pi] = 1; else if (it.k === 'trinket') c.tr[it.ti] = 1; if (it.k === 'weapon') c.wp[it.type] = 1; }
const codexHave = (S, id) => Object.keys(S.camp.codex[id]).length;
const perk = (S, k) => (S.camp && S.camp.perk && S.camp.perk[k]) || 0;
function refreshBonus(S) { const c = S.camp; if (!c) return; const fx = {}, pk = { gold: 0, disc: 0, potion: 0 }, add = t => { mergeFx(fx, t.fx); for (const [k, v] of Object.entries(t.perk || {})) pk[k] += v; };
  if (room(S, 'hall')) for (const id of Object.keys(c.trophies)) add(TROPHY[id]); if (room(S, 'library')) for (const pg of CODEX) if (codexHave(S, pg.id) >= pg.total()) add(pg);
  c.perk = pk; for (const h of S.party) { const m0 = maxHp(h); h.bonus = fx; h.hp = clamp(h.hp + Math.max(0, maxHp(h) - m0), 0, maxHp(h)); } }
function rollUnique(S) { const have = new Set(S.party.flatMap(h => Object.values(h.gear)).concat(S.stash).filter(g => g && g.uq).map(g => g.uq)), fresh = Object.keys(UNIQUES).filter(k => !have.has(k) && !S.camp.codex.uq[k]), pool = fresh.length ? fresh : Object.keys(UNIQUES).filter(k => !have.has(k));
  for (const id of shuffle(S, pool)) { const it = mkUnique(id); if (S.party.some(h => canUse(h, it))) return it; } return null; }
// deeds: [id, name, what to do, target, how far along]
const fullSets = S => S.party.reduce((a, h) => a + Object.keys(SETS).filter(k => setCount(h, k) === SETS[k].pieces.length).length, 0);
const ACH = [
  ['f1', 'First Blood', 'Win a fight', 1, S => S.stats.kills], ['f100', 'Seasoned', 'Fight 100 battles', 100, S => S.stats.fights], ['k250', 'Slayer', 'Destroy 250 enemies', 250, S => S.stats.kills], ['k1000', 'A Thousand Cuts', 'Destroy 1,000 enemies', 1000, S => S.stats.kills],
  ['c100', 'Combo Artist', 'Land 100 combos', 100, S => S.stats.combos], ['c500', 'Maestro', 'Land 500 combos', 500, S => S.stats.combos], ['b20', 'Giant Slayer', 'Defeat 20 bosses', 20, S => S.stats.bosses || 0],
  ['ch1', 'The First Step', 'Complete chapter one', 1, S => S.camp.done.length], ['ch3', 'A Name at Last', 'Complete chapter three', 3, S => S.camp.done.length], ['saga', 'Oathkeeper', 'Complete the saga', 1, S => S.camp.saga ? 1 : 0],
  ['unbroken', 'Unbroken', 'Complete the saga without being driven back', 1, S => S.camp.saga && S.camp.sagaWipes === 0 ? 1 : 0], ['vet', 'The Hard Way', 'Complete the saga on Veteran', 1, S => S.camp.saga && S.diff ? 1 : 0],
  ['fl1', 'Untouched', 'Finish a chapter or contract with no hero downed', 1, S => S.camp.flawless], ['fl5', 'Untouchable', 'Do so five times', 5, S => S.camp.flawless],
  ['talk', 'Silver Tongue', 'Pass 50 checks', 50, S => S.stats.passed], ['rich', 'Deep Pockets', 'Hold 1,000 gold at once', 1000, S => S.gold], ['earn', 'Fortune', 'Earn 5,000 gold in all', 5000, S => S.stats.gold || 0], ['smith', 'Friend of the Forge', 'Have the smith work 25 times', 25, S => S.stats.smith || 0],
  ['set1', 'Matched Set', 'Have a hero wear a complete set', 1, fullSets], ['set3', 'Dressed to Kill', 'Wear three complete sets across the party', 3, fullSets],
  ['leg1', 'Legend in the Making', 'Equip a Legendary item', 1, S => S.party.some(h => Object.values(h.gear).some(g => g && g.k !== 'trinket' && g.tier === 5)) ? 1 : 0], ['leg3', 'Clad in Legend', 'Have one hero in a Legendary weapon, off-hand and armour', 1, S => S.party.some(h => ['w', 'off', 'a'].every(sl => h.gear[sl] && h.gear[sl].tier === 5)) ? 1 : 0],
  ['uq1', 'Relic Hunter', 'Find a relic', 1, S => codexHave(S, 'uq')], ['uq5', 'Reliquary', 'Find five different relics', 5, S => codexHave(S, 'uq')], ['beasts', 'Naturalist', 'Fight every kind of enemy', Object.keys(EN).length, S => codexHave(S, 'en')],
  ['con1', 'For Hire', 'Complete a contract', 1, S => S.camp.contracts], ['r5', 'Renowned', 'Complete a rank 5 contract', 5, S => S.camp.best], ['r10', 'Living Legend', 'Complete a rank 10 contract', 10, S => S.camp.best], ['dbl', 'Glutton for Punishment', 'Complete a contract with two modifiers', 1, S => S.camp.doubles],
  ['keep', 'Lord of the Manor', 'Build every room at Oathkeep', Object.keys(ROOMS).length, S => S.camp.estate ? Object.keys(S.camp.estate.rooms).length : 0]
];
function checkAch(S) { const c = S.camp, out = []; if (!c) return out; for (const [id, n, , goal, fn] of ACH) if (!c.ach[id] && fn(S) >= goal) { c.ach[id] = true; S.gold += 25; out.push(n); c.news.push(n); } return out; }

function campQuest(S, rank, mods) {
  const c = S.camp, A = ARCH[c.arch]; let v, vi;
  if (c.ch === 5) { const fam = pick(S, ['undead', 'cult', 'bandit']); v = { name: A.name, title: A.title, fam, boss: 'arch1', lt: Object.keys(EN).find(k => EN[k].fam === fam && EN[k].elite), m: `${A.name}'s host`, lair: [A.hold] }; vi = -1; }
  else { vi = c.ch <= 4 ? c.order[c.ch - 1] : ri(S, VILLAINS.length); v = VILLAINS[vi]; }
  const q = { vi, name: v.name, vtitle: v.title, fam: v.fam, boss: v.boss, lt: v.lt, minions: v.m, lair: pick(S, v.lair), region: pick(S, REGIONS), town: pick(S, TOWNS), patron: pick(S, PATRONS), relic: pick(S, RELICS), twist: 'none', bossHp: 0, flags: c.friends && Object.keys(c.friends).length ? { friend: true } : {}, used: [], rank: rank || 0, mods: mods || [], leads: 0, log: [] };
  q.motive = c.ch === 5 ? 'has been behind every warlord you have faced, and is nearly ready to take the realm whole' : c.ch === 4 ? fill({ q }, `is ${A.name}'s champion, and holds the last road to ${A.hold}`) : fill({ q }, pick(S, MOTIVES).t);
  q.title = (c.ch <= 5 ? `Chapter ${c.ch}: ` : `Contract, rank ${rank}: `) + `${v.title.replace(/^the /, 'The ')} of ${q.lair}`; return q;
}
function townStock(S) { const t = S.camp.ch + (S.camp.ch > 5 ? 1 : 0), items = [rollGear(S, t), rollGear(S, t), rollGear(S, t), rollGear(S, t + 1), rollGear(S, t + 1), rollTrinket(S, t), rollTrinket(S, t + 1), rollTrinket(S, t + 1), mkCons('potion', 2), mkCons('salts', 1), rollCons(S, t, 1), rollCons(S, t, 1)];
  if (room(S, 'armoury')) items.unshift(rollGear(S, t + 1), rollGear(S, t + 1), rollGear(S, t + 1), rollTrinket(S, t + 1));
  for (const it of items) it.price = Math.round(it.price * 1.2 * (1 - perk(S, 'disc'))); return { items, healCost: room(S, 'infirmary') ? 0 : 10 + 10 * Math.min(6, t), town: true }; }
function enterTown(S) { const c = S.camp; S.screen = 'town'; S.pos = -1; S.C = null; S.ev = null; S.loot = null; S.lvl = null; S.nextMod = null; S.map = []; refreshBonus(S);
  if (c.ch > 5) { const R = c.rank; c.board = [[R, 0], [R, 1], [R + 1, 1 + ri(S, 2)]].map(([rank, m]) => campQuest(S, rank, shuffle(S, Object.keys(MODS)).slice(0, m))); S.q = c.board[0]; } else { c.board = null; S.q = campQuest(S); }
  S.shop = townStock(S); for (const h of S.party) h.hp = maxHp(h); checkAch(S); }
function startChapter(S, k) { const c = S.camp; if (S.screen !== 'town') return false; if (c.board) S.q = c.board[clamp(k || 0, 0, 2)]; S.shop = null; S.comp = null; c.downs0 = S.stats.downs; c.news = []; genMap(S); S.pos = -1; S.screen = 'map'; for (let n = 0; n < perk(S, 'potion'); n++) addBag(S, mkCons('potion', 1)); return true; }
function chapterEnd(S, win) {
  const c = S.camp, q = S.q, A = ARCH[c.arch], last = { win, ch: c.ch, title: q.title, lines: [] };
  if (!win) { c.wipes++; const lost = S.gold >> 1; S.gold -= lost; for (const h of S.party) { if (h.wounds < 3) h.wounds++; } last.lines.push(`The party is beaten back from ${q.lair} and carried home to lick its wounds. ${lost} gold is lost on the road, and everyone returns wounded. ${q.name} still stands.`); }
  else { const contract = c.ch > 5, pay = Math.round((contract ? (60 + 25 * q.rank) * (1 + 0.35 * q.mods.length) : 50 + 30 * c.ch) * (1 + perk(S, 'gold'))); S.gold += pay; S.stats.gold = (S.stats.gold || 0) + pay;
    const tro = id => { if (!c.trophies[id]) { c.trophies[id] = true; last.lines.push(`Trophy: ${TROPHY[id].n}.`); } };
    tro(q.boss === 'arch1' ? 'arch' : q.boss); if (S.stats.downs === c.downs0) { c.flawless++; tro('flawless'); }
    if (contract) { c.contracts++; c.best = Math.max(c.best, q.rank); if (q.rank >= c.rank) c.rank = q.rank + 1; if (q.mods.length >= 2) { c.doubles++; tro('doubled'); } if (q.rank >= 5) tro('rank5'); if (q.rank >= 10) tro('rank10'); }
    if (c.ch === 5) { c.sagaWipes = c.wipes; c.estate = { rooms: {} }; if (!c.wipes) tro('unbroken'); if (S.diff) tro('veteran'); last.lines.push('The grateful realm grants you a ruined keep of your own, Oathkeep. It has every comfort of town, and room to build.'); } last.lines.push(`${q.name} is defeated, and ${q.lair} stands empty. ${q.patron} pays the promised ${pay} gold.`);
    const clue = c.ch === 1 ? `Among ${q.name}'s things you find a seal you do not know: ${A.sigil}. Someone was paying for all this.`
      : c.ch === 2 ? `${q.name} carried unsigned orders under the same seal, ${A.sigil}. They speak of gathering strength "for the hour that is coming".`
      : c.ch === 3 ? `With a last breath ${q.name} gives up a name: ${A.name}, ${A.title}. Every warlord you have fought was a servant, and the master sits in ${A.hold}.`
      : c.ch === 4 ? `${A.name}'s champion is dead. The road to ${A.hold} lies open, and nothing stands between you and the one who started all of this.`
      : c.ch === 5 ? `${A.name}, ${A.title}, is no more. The seal of ${A.sigil} is broken, and the realm is free. There will always be other troubles, and there is always a notice board.`
      : `Another contract closed. The notice board never stays empty for long.`;
    last.lines.push(clue); if (!contract) c.lore.push(`${q.title}. ${clue}`); c.done.push({ ch: c.ch, name: q.name, title: q.vtitle, level: S.party[0].level, rank: q.rank }); if (c.done.length > 40) c.done.splice(5, 1); if (c.ch === 5) c.saga = true; }
  c.last = last; S.screen = 'chapter'; refreshBonus(S); for (const n of checkAch(S)) last.lines.push(`Deed done: ${n} (+25 gold).`);
}
function closeChapter(S) { if (S.screen !== 'chapter') return false; if (S.camp.last.win && S.camp.ch <= 5) S.camp.ch++; enterTown(S); return true; }
// the training hall: change a talent, or retrain into the other path
function retrain(S, hi, k, c) { const h = S.party[hi]; if (S.screen !== 'town' || !h || !h.tal || h.tal[k] === c || h.tal[k] === undefined || S.gold < trainCost(S, 'talent') || !setTalent(S, hi, k, c)) return false; S.gold -= trainCost(S, 'talent'); h.hp = Math.min(h.hp, maxHp(h)); return true; }
function changeSub(S, hi, take) { const h = S.party[hi]; if (S.screen !== 'town' || !h || !h.sub || S.gold < trainCost(S, 'sub')) return false; S.gold -= trainCost(S, 'sub'); h.sub = Object.keys(CLASSES[h.cls].subs).find(k => k !== h.sub); subGear(h, h.sub, S, take); autoEquip(h); h.hp = Math.min(h.hp, maxHp(h)); return true; }

function newRun(seed, seats, diff) {
  const S = { v: 6, comp: null, diff: diff ? 1 : 0, seed: seed | 0, seed0: seed | 0, party: seats.map(newHero), gold: 20, xp: 0, bag: [{ id: 'potion', qty: 2 }], stash: [], pos: -1, screen: 'map', C: null, ev: null, loot: null, shop: null, lvl: null, nextMod: null, leader: 0, result: null,
    stats: { fights: 0, kills: 0, downs: 0, combos: 0, checks: 0, passed: 0, nodes: 0 } };
  for (let k = 0; k < 5; k++) rnd(S); S.q = newQuest(S); genMap(S); return S;
}
function ending(S) { const q = S.q, f = q.flags, p = [];
  if (S.result !== 'victory') return `The party fell ${S.pos >= 0 && S.map[S.pos].act === 3 ? 'within sight of' : 'on the road to'} ${q.lair}. ${q.name} still holds ${q.region}.`;
  p.push(f.mercy ? `${q.name} is beaten and bound, alive. ${q.patron} weeps to see it.` : `${q.name} is dead, and ${q.lair} stands empty.`);
  if (f.puppet) p.push(`You break the ${q.relic} on the stones. The whispering stops.`); if (f.betrayed) p.push(`${q.patron} was gone from ${q.town} before you returned. There is a price on that head now.`);
  if (f.allies) p.push('The other company takes its half without complaint.'); if (f.kin && !f.mercy) p.push(`${q.patron} pays you in full, and never speaks to you again.`); if (f.toolate) p.push('The sky above the lair closes like a healing wound.');
  p.push(f.cruel && !f.helped ? `${q.region} is free, though few there are glad to see you pass.` : f.helped ? `In ${q.town} they will tell this story for a hundred years.` : `${q.region} is free.`); return p.join(' '); }

// ---------- autoplay: every decision an AI seat (or a test) needs ----------
function aiGive(S, it) { let best = -1, bs = 0; S.party.forEach((h, i) => { if (!canUse(h, it)) return; const slot = slotOf(h, it), cur = h.gear[slot]; let s = itemScore(it) - itemScore(cur) + (cur ? 0 : 1.5); if (it.set) s += setCount(h, it.set) * 1.5 - (cur && cur.set === it.set ? 9 : 0); else if (cur && cur.set && setCount(h, cur.set) > 1) s -= 2;
    if (it.k === 'weapon') { const w = WT[it.type]; if (cur && cur.type !== it.type) s -= 0.6; if (w.two && h.gear.off) s -= 1; if (it.type === 'staff' && cur.type !== 'staff') s -= h.cls === 'mage' ? -2 : 0.5; if (it.type === 'bow' && h.sub !== 'ranger') s -= 2; if (h.sub && SUBWP[h.sub] === it.type) s += 0.8; else if (h.sub && cur && SUBWP[h.sub] === cur.type) s -= 0.8; if (it.type === 'crossbow' && h.row === 'F') s -= 1.5; if (it.type === 'wand' && cur.type === 'staff') s -= 1; if (h.cls === 'priest' && h.sub !== 'flamekeeper' && !WT[it.type].sp && WT[cur.type].sp) s -= 2; if (WT[it.type].sp && h.sub === 'flamekeeper') s -= 2; if (h.sub === 'ranger' && it.type !== 'bow') s -= 3; if (h.cls === 'mage' && !WT[it.type].sp) s -= 3; if (it.type === 'spear' && h.cls === 'priest' && h.sub !== 'flamekeeper') s -= 1; }
    if (it.k === 'shield' && h.gear.w && WT[h.gear.w.type].two) s -= 3; if (it.k === 'shield' && it.type === 'tome' && h.sub === 'flamekeeper') s -= 1; if (it.k === 'shield' && cur && cur.type !== it.type && it.type === 'parry') s -= 1; if (it.k === 'armor' && ARMOR[it.type].slow && h.cls !== 'warrior') s -= 0.5; if (it.k === 'armor' && cur && ARMOR[it.type].rank < ARMOR[cur.type].rank && h.row === 'F') s -= 1;
    if (it.k === 'trinket') { s = itemScore(it) + (h.gear.t1 && h.gear.t2 ? -Math.min(itemScore(h.gear.t1), itemScore(h.gear.t2)) - 0.2 : 1.5); if (h.gear.t1 && h.gear.t2 && h.gear.t1.set) s -= 2; const f = it.fx; for (const st of STATS) if (f[st]) s += CLASSES[h.cls].grow[0] === st ? 1 : -0.3; if (f.primary) s += f.primary; if (f.thorns || f.startGuard || f.arm) s += h.row === 'F' ? 0.5 : -0.5; }
    if (s > bs) { bs = s; best = i; } }); return best; }
function autoStep(S) {
  if (S.screen === 'map') { for (let n = 0; n < 4; n++) { let done = false; for (let si = 0; si < S.stash.length && !done; si++) { const hi = aiGive(S, S.stash[si]); if (hi >= 0) done = fromStash(S, si, hi); } if (!done) break; } return travel(S, aiRoute(S)); }
  if (S.screen === 'combat') { const C = S.C; if (C.over) { endCombat(S); return true; } const u = unit(C, C.cur); return act(S, C, u.side === 'H' ? aiHero(S, C, u) : aiEnemy(S, C, u)); }
  if (S.screen === 'event') { if (!S.ev.result) return chooseEvent(S, aiEventChoice(S)); if (S.ev.result.items.length) return eventGive(S, aiGive(S, S.ev.result.items[0])); return continueEvent(S); }
  if (S.screen === 'loot') { let best = -1, bs = 0.4, who = -1; S.loot.items.forEach((it, k) => { if (it.k === 'cons') { if (0.9 > bs) { bs = 0.9; best = k; who = 0; } return; } const hi = aiGive(S, it); if (hi < 0) return; const h = S.party[hi], s = it.k === 'trinket' ? 1.2 + itemScore(it) * 0.2 : itemScore(it) - itemScore(h.gear[slotOf(h, it)]) + 0.5; if (s > bs) { bs = s; best = k; who = hi; } }); return takeLoot(S, best, who); }
  if (S.screen === 'shop') { if (!aiShop(S)) finishNode(S); return true; }
  if (S.screen === 'town') { if (S.camp.estate) for (const id of ['hall', 'library', 'forge', 'armoury', 'infirmary', 'yard']) if (buildRoom(S, id)) return true; if (!aiShop(S)) startChapter(S, S.aiPick || 0); return true; }
  if (S.screen === 'chapter') return closeChapter(S);
  if (S.screen === 'rest') { const frac = S.party.reduce((a, h) => a + h.hp / maxHp(h), 0) / S.party.length; doRest(S, frac < 0.75 || S.party.some(h => h.wounds) ? 0 : 2); return true; }
  if (S.screen === 'levelup') { S.lvl.need.forEach((n, i) => { if (n) pickSub(S, i, aiSub(S, i)); }); S.lvl.needT.forEach((n, i) => { const f = S.forceTal && S.forceTal[i]; if (n) pickTalent(S, i, f && f[S.lvl.level - 6] !== undefined ? f[S.lvl.level - 6] : ri(S, 2)); }); return closeLevel(S); }
  return false;
}
function aiShop(S) { for (let si = S.stash.length - 1; si >= 0; si--) if (aiGive(S, S.stash[si]) < 0) sellStash(S, si); const hurtish = S.party.some(h => h.wounds > 0) || S.party.reduce((a, h) => a + h.hp / maxHp(h), 0) / S.party.length < 0.55; if (hurtish && buyHeal(S)) return true;
    for (let hi = 0; hi < S.party.length; hi++) { const c = smithCost(S.party[hi].gear.w, 'upgrade', S); if (c && S.gold >= c + 10 && smith(S, hi, 'w', 'upgrade')) return true; }
    for (let k = 0; k < S.shop.items.length; k++) { const it = S.shop.items[k]; if (it.sold || it.price > S.gold) continue; if (it.k === 'cons') { const have = (S.bag.find(b => b.id === it.id) || { qty: 0 }).qty; if ((it.id === 'potion' || it.id === 'salts') && have < 2 && buy(S, k, 0)) return true; continue; }
      const hi = aiGive(S, it); if (hi < 0) continue; const h = S.party[hi]; if ((it.k === 'trinket' ? !(h.gear.t1 && h.gear.t2) : itemScore(it) > itemScore(h.gear[slotOf(h, it)])) && buy(S, k, hi)) return true; }
    for (let hi = 0; hi < S.party.length; hi++) for (const [slot, op] of [['w', 'upgrade'], ['a', 'upgrade'], ['w', 'enchant'], ['off', 'upgrade']]) { const c = smithCost(S.party[hi].gear[slot], op, S); if (c && S.gold >= c + 15 && smith(S, hi, slot, op)) return true; }
    return false; }
function aiSub(S, i) { const h = S.party[i], subs = Object.keys(CLASSES[h.cls].subs); if (S.forceSub && S.forceSub[i]) return S.forceSub[i];
  if (h.cls === 'priest') return S.party.some((o, j) => j !== i && o.cls === 'priest' && o.sub !== 'flamekeeper') || S.party.length === 1 ? 'flamekeeper' : 'lightbringer'; return subs[ri(S, 2)]; }
function aiEventChoice(S) { const e = EV[S.ev.id]; let best = 0, bs = -9; const frac = S.party.reduce((a, h) => a + h.hp / maxHp(h), 0) / S.party.length;
  e.c.forEach((c, i) => { let s; const val = o => (o.gold || 0) / 12 + (o.healP || 0) * 6 * (1.2 - frac) - (o.hurtP || 0) * 12 - (o.hurtR || 0) * 5 - (o.wound || 0) * 4 + (o.xp || 0) / 4 + (o.item ? 2.5 : 0) + (o.item2 ? 1.5 : 0) - (o.boss || 0) * 30 + (o.next === 'ambush' ? 2 : o.next === 'surprised' ? -2 : o.next ? 1 : 0) + (o.fight ? (frac > 0.7 ? 0.5 : -3) : 0) + (o.flag === 'eliteWeak' || o.flag2 === 'eliteWeak' ? 2 : 0) + (o.flag === 'cruel' || o.flag === 'desecrated' ? -1.5 : 0) + (o.flag === 'helped' || o.flag === 'spared' ? 1 : 0) + (o.comp && !S.comp ? 4 : 0) + (o.lead ? 2.5 : 0);
    if (c.s) { const { need } = checkInfo(S, c), pOk = (21 - need) / 20, pMid = c.mid ? Math.min(0.2, 1 - pOk) : 0; s = pOk * val(c.ok) + pMid * val(c.mid || {}) + (1 - pOk - pMid) * val(c.bad); }
    else if (c.random) s = c.random.reduce((a, o) => a + val(o), 0) / c.random.length; else s = val(c);
    if (c.cost) { const cost = Math.round(c.cost * (0.7 + 0.3 * pw(S))); s = S.gold >= cost ? s - cost / 14 : -99; }
    if (s > bs) { bs = s; best = i; } }); return best; }
function aiRoute(S) { const opts = options(S), frac = S.party.reduce((a, h) => a + h.hp / maxHp(h), 0) / S.party.length, w = S.party.reduce((a, h) => a + h.wounds, 0);
  let best = opts[0], bs = -9; for (const id of opts) { const t = S.map[id].type; let s = t === 'rest' ? (frac < 0.6 || w ? 4 : 0.5) : t === 'shop' ? (S.gold >= 45 ? 2.5 : 0.8) + (w && S.gold > 20 ? 1 : 0) : t === 'event' ? 1.8 : t === 'elite' ? (frac > 0.8 && !w ? 2 : -1) : frac > 0.55 ? 2 : 0.6; s += rnd(S) * 0.5; if (s > bs) { bs = s; best = id; } } return best; }
