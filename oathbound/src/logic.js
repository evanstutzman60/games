// ---------- helpers ----------
function rnd(S) { S.seed = (S.seed + 0x6D2B79F5) | 0; let t = S.seed; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const ri = (S, n) => Math.floor(rnd(S) * n), pick = (S, a) => a[ri(S, a.length)], die = (S, n) => 1 + ri(S, n);
function shuffle(S, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = ri(S, i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const STATS = ['might', 'agility', 'mind', 'spirit'], STAT_NAME = { might: 'Might', agility: 'Agility', mind: 'Mind', spirit: 'Spirit' };
const K = { campLv: [0, 0.85, 2.15, 3.9, 4.8], vetLv: [0, 0.25, 1.1, 0.85, 1.2], conLv: 2.5, rankLv: 1.0, hp: 1.5, atk: 1.4, heroHeal: 0.15, vetHp: 1.1, vetAtk: 0.5, vetHeal: 0.12 };   // global difficulty knobs, set by simulation

const STATE_INFO = {
  Burning: 'Takes fire damage at the start of each of its turns.',
  Stunned: 'Loses its next turn and is easier to hit. Cannot be stunned again straight away.',
  Marked: 'Attacks against it get +3 to hit and +25% damage.',
  Exposed: 'Armour counts as zero and physical hits deal +25%.',
  Prone: 'Melee attacks against it get +4 to hit; it deals half damage on its next turn, then stands.',
  Guard: 'Takes half damage.', Taunt: 'Enemies must attack this target if they can.',
  Blessed: '+2 to hit and +20% damage.', Hidden: 'Cannot be singled out; the next attack is a critical hit.',
  Steady: 'Cannot be stunned.'
};
const DEBUFFS = ['Burning', 'Stunned', 'Marked', 'Exposed', 'Prone'];

// ---------- skills ----------
// ty: melee | ranged | spell | heal | buff     tg: one | row | all | ally | allies | self
// m: damage multiplier, ap: [[state, turns, chance]], pay: { s: [states], m, consume, ap }, cd: cooldown, w: how much the AI likes to keep it equipped
const SK = {
  attack: { n: 'Attack', ty: 'melee', tg: 'one', m: 1 },
  // Warrior
  bash: { n: 'Shield Bash', ty: 'melee', tg: 'one', m: 0.8, ap: [['Stunned', 1, 0.6]], cd: 3, w: 6 },
  sunder: { n: 'Sunder', ty: 'melee', tg: 'one', m: 1, ap: [['Exposed', 3, 1]], cd: 2, w: 7 },
  taunt: { n: 'Taunt', ty: 'buff', tg: 'self', buff: [['Taunt', 2], ['Guard', 1]], cd: 3, w: 5 },
  trip: { n: 'Trip', ty: 'melee', tg: 'one', m: 0.7, ap: [['Prone', 1, 1]], cd: 2, w: 4 },
  cleave: { n: 'Cleave', ty: 'melee', tg: 'row', m: 0.7, pay: { s: ['Prone'], m: 1.5 }, cd: 2, w: 6 },
  bulwark: { n: 'Bulwark', ty: 'buff', tg: 'allies', buff: [['Guard', 1]], cd: 4, w: 7 },
  slam: { n: 'Shield Slam', ty: 'melee', tg: 'one', m: 1.2, pay: { s: ['Exposed'], m: 1.3, ap: ['Stunned', 1] }, cd: 2, w: 8 },
  laststand: { n: 'Last Stand', ty: 'heal', tg: 'self', healP: 0.4, buff: [['Taunt', 2], ['Guard', 2]], once: true, w: 8 },
  reckless: { n: 'Reckless Swing', ty: 'melee', tg: 'one', m: 1.8, selfAp: ['Exposed', 2], pay: { s: ['Exposed'], m: 1.4 }, cd: 1, w: 8 },
  execute: { n: 'Execute', ty: 'melee', tg: 'one', m: 1, pay: { s: ['Stunned', 'Prone'], m: 2.2 }, cd: 2, w: 8 },
  whirl: { n: 'Whirlwind', ty: 'melee', tg: 'row', m: 1.25, pay: { s: ['Burning', 'Marked'], m: 1.4 }, cd: 3, w: 9 },
  // Rogue
  knife: { n: 'Throwing Knife', ty: 'ranged', tg: 'one', m: 0.5, ap: [['Marked', 3, 1]], cd: 1, w: 6 },
  backstab: { n: 'Backstab', ty: 'melee', tg: 'one', m: 1, pay: { s: ['Marked', 'Stunned', 'Prone'], m: 1.8 }, cd: 1, w: 8 },
  smoke: { n: 'Smoke Bomb', ty: 'buff', tg: 'self', buff: [['Hidden', 2]], cd: 3, w: 3 },
  hamstring: { n: 'Hamstring', ty: 'melee', tg: 'one', m: 0.8, ap: [['Prone', 1, 1]], cd: 2, w: 5 },
  dirty: { n: 'Dirty Trick', ty: 'ranged', tg: 'one', m: 0.5, ap: [['Exposed', 2, 1]], cd: 2, w: 5 },
  ambush: { n: 'Ambush', ty: 'melee', tg: 'one', m: 1.4, pay: { s: ['Marked'], m: 2, consume: true }, cd: 2, w: 9 },
  garrote: { n: 'Garrote', ty: 'melee', tg: 'one', m: 0.9, ap: [['Stunned', 1, 0.7]], cd: 3, w: 7 },
  deathmark: { n: 'Death Mark', ty: 'melee', tg: 'one', m: 1.2, pay: { s: DEBUFFS, m: 2.5 }, cd: 4, w: 9 },
  aimed: { n: 'Aimed Shot', ty: 'ranged', tg: 'one', m: 1.5, pay: { s: ['Marked'], m: 1.8, consume: true }, cd: 2, w: 9 },
  volley: { n: 'Volley', ty: 'ranged', tg: 'row', m: 0.8, ap: [['Marked', 2, 0.5]], cd: 2, w: 8 },
  pinning: { n: 'Pinning Shot', ty: 'ranged', tg: 'one', m: 1.2, ap: [['Prone', 1, 1], ['Exposed', 2, 1]], cd: 3, w: 9 },
  // Mage
  firebolt: { n: 'Firebolt', ty: 'spell', tg: 'one', m: 1, ap: [['Burning', 3, 1]], cd: 1, w: 7 },
  frost: { n: 'Frost Shock', ty: 'spell', tg: 'one', m: 0.8, ap: [['Stunned', 1, 0.5]], cd: 3, w: 6 },
  missile: { n: 'Arcane Missile', ty: 'spell', tg: 'one', m: 0.9, sure: true, pay: { s: ['Marked'], m: 1.6 }, w: 6 },
  gust: { n: 'Gust', ty: 'spell', tg: 'row', m: 0.5, ap: [['Prone', 1, 0.6]], cd: 3, w: 5 },
  weaken: { n: 'Weaken', ty: 'spell', tg: 'one', m: 0.4, ap: [['Exposed', 3, 1]], cd: 2, w: 4 },
  detonate: { n: 'Detonate', ty: 'spell', tg: 'one', m: 1, pay: { s: ['Burning'], m: 2.2, consume: true }, cd: 1, w: 9 },
  flamewave: { n: 'Flame Wave', ty: 'spell', tg: 'row', m: 0.8, ap: [['Burning', 3, 1]], cd: 2, w: 8 },
  inferno: { n: 'Inferno', ty: 'spell', tg: 'all', m: 1, pay: { s: ['Burning'], m: 1.5 }, cd: 5, w: 9 },
  chain: { n: 'Chain Lightning', ty: 'spell', tg: 'row', m: 0.9, pay: { s: ['Stunned', 'Prone'], m: 1.5 }, cd: 2, w: 9 },
  thunder: { n: 'Thunderclap', ty: 'spell', tg: 'all', m: 0.5, ap: [['Stunned', 1, 0.4]], cd: 4, w: 8 },
  tempest: { n: 'Tempest', ty: 'spell', tg: 'one', m: 1.8, ap: [['Stunned', 1, 0.6]], pay: { s: ['Exposed'], m: 1.6 }, cd: 4, w: 9 },
  // Priest
  mend: { n: 'Mend', ty: 'heal', tg: 'ally', heal: 1, cd: 1, w: 10 },
  smite: { n: 'Smite', ty: 'spell', tg: 'one', m: 1, holy: true, pay: { s: ['Burning', 'Marked'], m: 1.5 }, w: 6 },
  bless: { n: 'Bless', ty: 'buff', tg: 'ally', buff: [['Blessed', 3]], cd: 2, w: 4 },
  rebuke: { n: 'Rebuke', ty: 'spell', tg: 'one', m: 0.6, holy: true, ap: [['Exposed', 2, 1]], cd: 2, w: 5 },
  sanctuary: { n: 'Sanctuary', ty: 'heal', tg: 'allies', heal: 0.5, cleanse: true, cd: 4, w: 7 },
  radiance: { n: 'Radiance', ty: 'heal', tg: 'allies', heal: 0.8, cd: 3, w: 9 },
  purify: { n: 'Purify', ty: 'heal', tg: 'ally', heal: 0.8, cleanse: true, buff: [['Guard', 1]], cd: 2, w: 7 },
  sunburst: { n: 'Sunburst', ty: 'spell', tg: 'all', m: 0.9, holy: true, pay: { s: ['Marked', 'Exposed'], m: 1.5 }, cd: 4, w: 9 },
  crushing: { n: 'Crushing Blow', ty: 'melee', tg: 'one', m: 1.4, ap: [['Exposed', 3, 1]], cd: 2, w: 8 },
  judgement: { n: 'Judgement', ty: 'melee', tg: 'one', m: 1.1, holy: true, pay: { s: ['Prone', 'Exposed'], m: 1.6, ap: ['Stunned', 1] }, cd: 3, w: 8 },
  holyfire: { n: 'Holy Fire', ty: 'melee', tg: 'one', m: 1.4, holy: true, ap: [['Burning', 3, 1]], leech: 0.7, cd: 3, w: 9 },
  // enemies
  e_hit: { n: 'Strike', ty: 'melee', tg: 'one', m: 1 },
  e_shot: { n: 'Shot', ty: 'ranged', tg: 'one', m: 1 },
  e_bolt: { n: 'Dark Bolt', ty: 'spell', tg: 'one', m: 1 },
  e_trip: { n: 'Knockdown', ty: 'melee', tg: 'one', m: 0.8, ap: [['Prone', 1, 0.6]], cd: 2 },
  e_mark: { n: 'Pick a Target', ty: 'ranged', tg: 'one', m: 0.7, ap: [['Marked', 2, 1]], cd: 2 },
  e_fire: { n: 'Firebrand', ty: 'spell', tg: 'one', m: 0.9, ap: [['Burning', 2, 1]], cd: 1 },
  e_bite: { n: 'Paralysing Bite', ty: 'melee', tg: 'one', m: 0.8, ap: [['Stunned', 1, 0.35]], cd: 3 },
  e_web: { n: 'Web', ty: 'ranged', tg: 'one', m: 0.5, ap: [['Stunned', 1, 0.4]], cd: 3 },
  e_expose: { n: 'Hex', ty: 'spell', tg: 'one', m: 0.6, ap: [['Exposed', 2, 1]], cd: 2 },
  e_heal: { n: 'Dark Mending', ty: 'heal', tg: 'ally', heal: 1, cd: 2 },
  e_cleave: { n: 'Sweep', ty: 'melee', tg: 'row', m: 0.8, cd: 2 },
  e_drain: { n: 'Life Drain', ty: 'spell', tg: 'one', m: 1, leech: 0.5 },
  e_rally: { n: 'Rally', ty: 'buff', tg: 'allies', buff: [['Blessed', 2]], cd: 4 },
  e_charge: { n: 'Wild Charge', ty: 'melee', tg: 'one', m: 1.4, selfAp: ['Exposed', 2], cd: 2 },
  e_crush: { n: 'Crushing Blow', ty: 'melee', tg: 'one', m: 1.5, cd: 2 },
  e_maul: { n: 'Maul', ty: 'melee', tg: 'one', m: 1.4, ap: [['Prone', 1, 0.5]], cd: 2 },
  e_roar: { n: 'Roar', ty: 'spell', tg: 'all', m: 0.3, sure: true, ap: [['Prone', 1, 0.5]], cd: 4 },
  e_curse: { n: 'Withering Curse', ty: 'spell', tg: 'all', m: 0.3, ap: [['Exposed', 2, 0.8]], cd: 4 },
  e_deathbolt: { n: 'Death Bolt', ty: 'spell', tg: 'one', m: 1.5, cd: 2 },
  e_breath: { n: 'Fire Breath', ty: 'spell', tg: 'all', m: 0.7, ap: [['Burning', 2, 1]], cd: 3 },
  e_tail: { n: 'Tail Sweep', ty: 'melee', tg: 'row', m: 0.8, ap: [['Prone', 1, 0.6]], cd: 2 },
  e_firewave: { n: 'Wall of Flame', ty: 'spell', tg: 'row', m: 0.7, ap: [['Burning', 2, 1]], cd: 2 },
  e_raise: { n: 'Raise Dead', ty: 'buff', tg: 'self', summon: 'skeleton', k: 2, cd: 4 },
  e_callthugs: { n: 'Call the Gang', ty: 'buff', tg: 'self', summon: 'thug', k: 2, cd: 5 },
  e_callwolves: { n: 'Call the Pack', ty: 'buff', tg: 'self', summon: 'wolf', k: 2, cd: 4 },
  e_callimps: { n: 'Summon Imps', ty: 'buff', tg: 'self', summon: 'imp', k: 2, cd: 4 }
};
for (const k in SK) SK[k].id = k;
const pct = v => Math.round(v * 100) + '%';
function skillDesc(sk) {
  const p = [], tg = { one: 'one enemy', row: 'an enemy row', all: 'all enemies', ally: 'one ally', allies: 'the whole party', self: 'yourself' }[sk.tg];
  if (sk.m) p.push(`${{ melee: 'Melee', ranged: 'Ranged', spell: 'Spell' }[sk.ty]} attack on ${tg} for ${pct(sk.m)} damage${sk.holy ? ' (holy)' : ''}${sk.sure ? ', never misses' : ''}.`);
  if (sk.heal) p.push(`Heals ${tg} (${pct(sk.heal)} strength).`);
  if (sk.healP) p.push(`Restores ${pct(sk.healP)} of your health.`);
  if (sk.cleanse) p.push('Removes harmful states.');
  for (const [s, t, c] of sk.ap || []) p.push(`${c < 1 ? pct(c) + ' chance to apply' : 'Applies'} ${s} (${t} turn${t > 1 ? 's' : ''}).`);
  for (const [s, t] of sk.buff || []) p.push(`Grants ${s} to ${tg} (${t} turn${t > 1 ? 's' : ''}).`);
  if (sk.selfAp) p.push(`Leaves you ${sk.selfAp[0]}.`);
  if (sk.pay) p.push(`Against ${sk.pay.s.length === 5 ? 'any harmful state' : sk.pay.s.join(' or ')}: x${sk.pay.m} damage${sk.pay.ap ? ' and applies ' + sk.pay.ap[0] : ''}${sk.pay.consume ? ' (uses up the state)' : ''}.`);
  if (sk.leech) p.push(`Heals the ${sk.ty === 'melee' && sk.holy ? 'party' : 'user'} for ${pct(sk.leech)} of the damage.`);
  if (sk.summon) p.push('Calls reinforcements.');
  if (sk.once) p.push('Once per fight.'); else if (sk.cd) p.push(`Cooldown ${sk.cd}.`);
  return p.join(' ');
}

// ---------- classes ----------
const CLASSES = {
  warrior: { n: 'Warrior', row: 'F', hp: 30, hpl: 8, st: [4, 2, 1, 2], grow: ['might', 'agility'], wp: ['sword', 'axe', 'mace', 'spear', 'flail', 'warhammer', 'rapier', 'crossbow'], shield: true, armor: 3, base: ['bash', 'sunder', 'taunt', 'trip', 'cleave'], start: ['sword', 'shield', 'medium'],
    blurb: 'Holds the front row. Stuns, exposes and knocks enemies down for others to finish.',
    subs: { guardian: { n: 'Guardian', sk: ['bulwark', 'slam', 'laststand'], blurb: 'Shields the party and turns Exposed enemies into Stunned ones.' }, berserker: { n: 'Berserker', sk: ['reckless', 'execute', 'whirl'], blurb: 'Huge hits on Exposed, Stunned and Prone enemies, at the cost of safety.' } } },
  rogue: { n: 'Rogue', row: 'F', hp: 22, hpl: 6, st: [2, 4, 2, 1], grow: ['agility', 'might'], wp: ['dagger', 'sword', 'bow', 'rapier', 'crossbow'], shield: false, armor: 2, base: ['knife', 'backstab', 'smoke', 'hamstring', 'dirty'], start: ['dagger', null, 'light'],
    blurb: 'Marks targets and punishes any enemy that is Marked, Stunned or Prone.',
    subs: { assassin: { n: 'Assassin', sk: ['ambush', 'garrote', 'deathmark'], blurb: 'Melee burst that cashes in every harmful state.' }, ranger: { n: 'Ranger', sk: ['aimed', 'volley', 'pinning'], blurb: 'Fights from the back row with a bow; marks whole rows and pins targets.' } } },
  mage: { n: 'Mage', row: 'B', hp: 18, hpl: 5, st: [1, 2, 4, 2], grow: ['mind', 'spirit'], wp: ['staff', 'dagger', 'wand'], shield: false, armor: 1, base: ['firebolt', 'frost', 'missile', 'gust', 'weaken'], start: ['staff', null, 'light'],
    blurb: 'Spells ignore armour. Sets enemies Burning, Stunned, Prone or Exposed from the back row.',
    subs: { pyromancer: { n: 'Pyromancer', sk: ['detonate', 'flamewave', 'inferno'], blurb: 'Spreads Burning and detonates it.' }, stormcaller: { n: 'Stormcaller', sk: ['chain', 'thunder', 'tempest'], blurb: 'Stuns groups and chains lightning through Stunned and Prone rows.' } } },
  priest: { n: 'Priest', row: 'B', hp: 22, hpl: 6, st: [2, 1, 2, 4], grow: ['spirit', 'might'], wp: ['mace', 'staff', 'spear', 'flail', 'warhammer', 'wand'], shield: true, armor: 3, base: ['mend', 'smite', 'bless', 'rebuke', 'sanctuary'], start: ['mace', 'shield', 'light'],
    blurb: 'Heals and blesses. Holy damage is strong against the undead.',
    subs: { lightbringer: { n: 'Lightbringer', sk: ['radiance', 'purify', 'sunburst'], blurb: 'Party-wide healing and a holy blast that punishes Marked and Exposed foes.' }, warpriest: { n: 'Warpriest', sk: ['crushing', 'judgement', 'holyfire'], blurb: 'Fights in the front row; exposes, stuns and heals through damage.' } } }
};

// ---------- items ----------
const WT = {
  sword: { n: 'Sword', die: [8, 10, 12], hit: 1, note: '+1 to hit' },
  axe: { n: 'Greataxe', die: [10, 12, 14], two: true, splash: true, note: 'two-handed; basic attacks also hit a second front-row enemy for half' },
  mace: { n: 'Mace', die: [6, 8, 10], bonus: 1, pierce: true, note: 'ignores armour' },
  dagger: { n: 'Dagger', die: [4, 6, 8], fin: true, assassin: true, note: 'uses Agility; always crits Marked or Stunned targets, and crits deal double' },
  spear: { n: 'Spear', die: [7, 9, 11], two: true, reach: true, note: 'two-handed; melee skills work from the back row' },
  bow: { n: 'Bow', die: [7, 9, 11], two: true, ranged: true, fin: true, note: 'two-handed; basic attacks are ranged and use Agility' },
  staff: { n: 'Staff', die: [4, 5, 6], sp: [8, 10, 12], two: true, note: 'two-handed; much stronger spells and heals' },
  wand: { n: 'Wand', die: [4, 5, 6], sp: [6, 8, 10], hit: 1, note: 'one-handed; stronger spells and heals, +1 to hit' },
  rapier: { n: 'Rapier', die: [6, 8, 10], fin: true, hit: 2, crit: 1, note: 'uses Agility; +2 to hit and crits on 19+' },
  flail: { n: 'Flail', die: [7, 9, 11], proc: ['Prone', 0.3], note: 'melee hits have a 30% chance to knock the target Prone' },
  warhammer: { n: 'Warhammer', die: [10, 12, 14], two: true, pierce: true, hit: -1, proc: ['Stunned', 0.15], note: 'two-handed; ignores armour, -1 to hit, melee hits have a 15% chance to Stun' },
  crossbow: { n: 'Crossbow', die: [9, 11, 13], two: true, ranged: true, xbow: true, init: -3, note: 'two-handed; basic attacks are ranged and use Might or Agility, -3 initiative' }
};
for (const w of Object.values(WT)) { w.die.push(w.die[2] + 2, w.die[2] + 4); if (w.sp) w.sp.push(w.sp[2] + 2, w.sp[2] + 4); }
const TIER = ['', 'Fine ', 'Masterwork ', 'Runed ', 'Legendary '], PRICE = [20, 45, 90, 160, 260];
const ARMOR = { light: { n: ['Robes', 'Warded Robes', 'Archmage Robes', 'Runewoven Robes', 'Robes of the Magi'], arm: [0, 1, 1, 2, 2], ward: [1, 2, 4, 5, 7], rank: 1 }, medium: { n: ['Leathers', 'Brigandine', 'Shadowmail', 'Wyrmhide', 'Nightweave'], arm: [1, 2, 3, 4, 5], ward: [0, 1, 1, 2, 3], rank: 2 }, heavy: { n: ['Chainmail', 'Half-plate', 'Full Plate', 'Runed Plate', 'Dragonscale Plate'], arm: [2, 4, 5, 6, 8], ward: [0, 0, 1, 2, 3], rank: 3, slow: 1 } };
const TRINKETS = [
  ['Ring of Might', { might: 1 }, 1], ['Ring of Agility', { agility: 1 }, 1], ['Ring of Mind', { mind: 1 }, 1], ['Ring of Spirit', { spirit: 1 }, 1],
  ['Belt of Giants', { might: 2 }, 3], ['Cat-step Boots', { agility: 2 }, 3], ['Circlet of Insight', { mind: 2 }, 3], ['Saint\'s Knucklebone', { spirit: 2 }, 3],
  ['Amulet of Vigor', { hp: 8 }, 1], ['Heartstone', { hp: 16 }, 3], ['Iron Buckle', { arm: 1 }, 1], ['Ward Charm', { ward: 2 }, 1],
  ['Hawk Feather', { hit: 1 }, 1], ['Lucky Coin', { crit: 2 }, 2], ['Troll Tooth', { regen: 2 }, 2], ['Sentinel\'s Badge', { startGuard: 1 }, 2],
  ['Steady Stone', { immune: 'Stunned' }, 2], ['Salamander Scale', { immune: 'Burning' }, 1], ['Rootfoot Charm', { immune: 'Prone' }, 1],
  ['Lingering Censer', { dur: 1 }, 2], ['Hourglass Charm', { cdr: 1 }, 2], ['Thorn Bracers', { thorns: 3 }, 2], ['Leech Fang', { leech: 0.15 }, 2],
  ['Quickening Spur', { init: 4 }, 1], ['Executioner\'s Token', { pay: 0.3 }, 2],
  ['Whetstone Pendant', { dmg: 1 }, 1], ['Giant\'s Knuckle', { dmg: 3 }, 3], ['Warding Sigil', { immune: 'Marked' }, 1], ['Marching Drum', { init: 2, hp: 4 }, 1],
  ['Bloodstone', { leech: 0.1, hp: 4 }, 2], ['Duelist\'s Glove', { hit: 1, crit: 1 }, 2], ['Ember Charm', { procs: [['Burning', 0.2]] }, 2], ['Tracker\'s Eye', { procs: [['Marked', 0.25]] }, 2],
  ['Rending Hook', { procs: [['Exposed', 0.2]] }, 2], ['Pilgrim\'s Flask', { healm: 0.2 }, 2], ['Guardian Idol', { arm: 1, ward: 1 }, 2], ['Featherfall Cloak', { agility: 1, init: 2 }, 2],
  ['Scholar\'s Lens', { mind: 1, hit: 1 }, 2], ['Bear Totem', { might: 1, hp: 6 }, 2], ['Prayer Beads', { spirit: 1, regen: 1 }, 2], ['Stormglass Vial', { procs: [['Stunned', 0.1]] }, 3],
  ['Phoenix Feather', { phoenix: 1 }, 3], ['Veil of Shadows', { startHidden: 1 }, 3], ['Mirror Shard', { ward: 3, immune: 'Exposed' }, 3]
];
// off-hand items: shields for the armoured classes, tomes for casters, parrying daggers for the quick
const OFF = { shield: { n: 'Shield', cls: ['warrior', 'priest'], def: [2, 3, 4, 5, 6], arm: [0, 1, 1, 2, 2], fx: [{}, {}, {}, {}, {}] }, tome: { n: 'Tome', cls: ['mage', 'priest'], def: [0, 0, 0, 0, 0], arm: [0, 0, 0, 0, 0], fx: [{ mind: 1 }, { mind: 1, spirit: 1 }, { mind: 2, spirit: 2 }, { mind: 3, spirit: 2 }, { mind: 4, spirit: 3 }] },
  parry: { n: 'Parrying Dagger', cls: ['rogue', 'warrior'], def: [1, 2, 2, 3, 3], arm: [0, 0, 0, 0, 0], fx: [{}, { crit: 1 }, { crit: 1, hit: 1 }, { crit: 1, hit: 2 }, { crit: 2, hit: 2 }] } };
const offOf = it => OFF[it.type || 'shield'];
const FX_TEXT = { def: v => `+${v} defence`, spd: v => `spell die +${v}`, lowhp: v => `+${pct(v)} damage while below half health`, exec: v => `+${pct(v)} damage to enemies below 30% health`, aoe: v => `+${pct(v)} damage with row and all-enemy skills`, dr: v => `takes ${pct(v)} less damage`, pen: v => `ignores ${v} armour and ward`,
  chance: v => `+${pct(v)} to your chances of applying states`, opener: () => 'first attack each fight is a critical hit', killHeal: v => `heal ${pct(v)} of your health on a kill`, spread: () => 'when a Burning enemy dies, the fire jumps to another', vs: v => v.map(p => `+${pct(p[1])} damage to ${p[0]} enemies`).join(', '), aura: v => 'the whole party gains: ' + fxText(v),
  dmg: v => `+${v} damage on every hit`, phoenix: () => 'once per fight, survive a killing blow', procs: v => v.map(p => `hits have a ${pct(p[1])} chance to apply ${p[0]}`).join(', '), healm: v => `your heals are ${pct(v)} stronger`, startHidden: () => 'starts every fight Hidden', startTaunt: () => 'starts every fight with Taunt', might: v => `+${v} Might`, agility: v => `+${v} Agility`, mind: v => `+${v} Mind`, spirit: v => `+${v} Spirit`, hp: v => `+${v} health`, arm: v => `+${v} armour`, ward: v => `+${v} ward (reduces spell damage)`, hit: v => `+${v} to hit`,
  crit: v => `crits on a roll of ${20 - v}+`, regen: v => `regain ${v} health each turn`, startGuard: () => 'starts every fight with Guard', immune: v => `immune to ${v}`, dur: v => `states you apply last ${v} turn longer`,
  cdr: v => `cooldowns are ${v} turn shorter`, thorns: v => `melee attackers take ${v} damage`, leech: v => `heal for ${pct(v)} of damage dealt`, init: v => `+${v} initiative`, pay: v => `combo bonuses are +${v} stronger` };
const CONS = {
  potion: { n: 'Healing Potion', tg: 'ally', flatHeal: 16, price: 12, d: 'Heals one ally for 16 (+4 per level).' },
  greater: { n: 'Greater Potion', tg: 'ally', flatHeal: 34, price: 26, d: 'Heals one ally for 34 (+4 per level).', tier: 2 },
  fury: { n: 'Elixir of Fury', tg: 'ally', buff: [['Blessed', 3]], price: 12, d: 'One ally is Blessed for 3 turns.' },
  stoneskin: { n: 'Stoneskin Draught', tg: 'ally', buff: [['Guard', 2]], price: 12, d: 'One ally has Guard for 2 turns.' },
  thunderstone: { n: 'Thunderstone', tg: 'all', flat: 2, ap: [['Stunned', 1, 0.35]], price: 20, d: 'Damages all enemies with a 35% chance to Stun each.', tier: 2 },
  tears: { n: 'Phoenix Tears', tg: 'downed', reviveP: 0.8, price: 30, d: 'Revives a downed ally at 80% health.', tier: 3 },
  salts: { n: 'Smelling Salts', tg: 'downed', reviveP: 0.4, price: 15, d: 'Revives a downed ally at 40% health.' },
  firebomb: { n: 'Firebomb', tg: 'row', flat: 5, ap: [['Burning', 3, 1]], price: 14, d: 'Damages an enemy row and sets it Burning.' },
  flash: { n: 'Flash Powder', tg: 'row', flat: 1, ap: [['Stunned', 1, 0.6]], price: 16, d: '60% chance to Stun each enemy in a row.' },
  oil: { n: 'Sundering Oil', tg: 'one', flat: 2, ap: [['Exposed', 3, 1], ['Marked', 3, 1]], price: 10, d: 'One enemy becomes Exposed and Marked.' },
  tangle: { n: 'Tanglefoot Bag', tg: 'row', flat: 1, ap: [['Prone', 1, 1]], price: 10, d: 'Knocks an enemy row Prone.' },
  tonic: { n: 'Cleansing Tonic', tg: 'ally', flatHeal: 8, cleanse: true, price: 8, d: 'Removes harmful states from an ally and heals 8.' }
};
for (const k in CONS) CONS[k].id = k;
// rarity: gear gains one step per affix; trinkets by their tier; set pieces have their own
const RAR = ['Common', 'Uncommon', 'Rare', 'Epic', 'Set', 'Relic'], PROC_T = { Burning: 3, Marked: 2, Exposed: 2, Prone: 1, Stunned: 1 };
const AFFIX = {
  flaming: { n: 'Flaming', on: 'w', pre: 1, fx: { procs: [['Burning', 0.25]] } }, hunters: { n: 'Hunter\'s', on: 'w', pre: 1, fx: { procs: [['Marked', 0.25]] } }, sundering: { n: 'Sundering', on: 'w', pre: 1, fx: { procs: [['Exposed', 0.2]] } },
  keen: { n: 'Keen', on: 'w', pre: 1, fx: { crit: 1 } }, balanced: { n: 'Balanced', on: 'w', pre: 1, fx: { hit: 1 } }, vampiric: { n: 'Vampiric', on: 'w', pre: 1, fx: { leech: 0.1 } }, swift: { n: 'Swift', on: 'w', pre: 1, fx: { init: 3 } },
  sturdy: { n: 'Sturdy', on: 'a', pre: 1, fx: { arm: 1 } }, warded: { n: 'Warded', on: 'a', pre: 1, fx: { ward: 2 } }, spiked: { n: 'Spiked', on: 'a', pre: 1, fx: { thorns: 2 } }, stalwart: { n: 'Stalwart', on: 'a', pre: 1, fx: { hp: 8 } }, mending: { n: 'Mending', on: 'a', pre: 1, fx: { regen: 1 } },
  might: { n: 'Might', fx: { might: 1 } }, agility: { n: 'Agility', fx: { agility: 1 } }, mind: { n: 'Mind', fx: { mind: 1 } }, spirit: { n: 'Spirit', fx: { spirit: 1 } }, vigor: { n: 'Vigor', fx: { hp: 6 } }, duelist: { n: 'the Duelist', fx: { pay: 0.15 } }, lingering: { n: 'Lingering', fx: { dur: 1 } }
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
  dawnbreaker: { k: 'weapon', type: 'sword', n: 'Dawnbreaker', fx: { dmg: 3, hit: 1, procs: [['Burning', 0.3]] } }, widowmaker: { k: 'weapon', type: 'dagger', n: 'Widowmaker', fx: { crit: 3, vs: [['Marked', 0.3]] } },
  stormcall: { k: 'weapon', type: 'staff', n: 'Stormcall', fx: { spd: 4, chance: 0.15, mind: 2 } }, longwatch: { k: 'weapon', type: 'bow', n: 'Longwatch', fx: { pen: 4, hit: 2, init: 4 } },
  kingsbane: { k: 'weapon', type: 'warhammer', n: 'Kingsbane', fx: { exec: 0.4, dmg: 2 } }, gravemace: { k: 'weapon', type: 'mace', n: 'Gravemace', fx: { leech: 0.2, spirit: 2, might: 1 } },
  oathkeeper: { k: 'shield', type: 'shield', n: 'Oathkeeper', fx: { arm: 2, dr: 0.1, startGuard: 1 } }, mountain: { k: 'armor', type: 'heavy', n: 'Mountain\'s Heart', fx: { hp: 25, regen: 3 } },
  shadowskin: { k: 'armor', type: 'medium', n: 'Shadowskin', fx: { def: 3, agility: 2, startHidden: 1 } }, mantle: { k: 'armor', type: 'light', n: 'Mantle of Stars', fx: { ward: 4, mind: 2, cdr: 1 } },
  tear: { k: 'trinket', n: 'Saint\'s Tear', fx: { healm: 0.35, spirit: 2 } }, embercrown: { k: 'trinket', n: 'Crown of Embers', fx: { aoe: 0.25, pay: 0.3 } }
};
function mergeFx(into, fx) { for (const [k, v] of Object.entries(fx || {})) { if (k === 'immune') (into.immune = into.immune || []).push(...[].concat(v)); else if (k === 'procs') into.procs = (into.procs || []).concat(v); else if (k === 'vs') into.vs = (into.vs || []).concat(v); else if (k === 'aura') into.aura = mergeFx(into.aura || {}, v); else into[k] = (into[k] || 0) + v; } return into; }
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
  berserker: [[['Bloodlust', { lowhp: 0.25 }], ['Brutal Force', { dmg: 3, hp: 6 }]], [['Butcher', { exec: 0.3 }], ['Thick Hide', { hp: 14 }]], [['Feast', { killHeal: 0.15 }], ['Savage', { crit: 2 }]], [['Opportunist', { vs: [['Prone', 0.3], ['Stunned', 0.3]] }], ['Relentless', { cdr: 1 }]], [['Rampage', { aoe: 0.3 }], ['Deathless Rage', { phoenix: 1 }]]],
  assassin: [[['Opener', { opener: 1 }], ['Precision', { hit: 2 }]], [['Lethality', { crit: 2 }], ['Slippery', { def: 2 }]], [['Exploit Weakness', { pay: 0.4 }], ['Venom', { procs: [['Exposed', 0.25]] }]], [['Cull', { exec: 0.35 }], ['Shadowstep', { startHidden: 1 }]], [['Master Assassin', { vs: [['Marked', 0.45]], crit: 1 }], ['Quick Hands', { cdr: 1 }]]],
  ranger: [[['Eagle Eye', { hit: 2 }], ['Fleet', { init: 5 }]], [['Hunter\'s Mark', { procs: [['Marked', 0.3]] }], ['Camouflage', { def: 3, hp: 8 }]], [['Piercing Arrows', { pen: 3 }], ['Steady Aim', { crit: 2, dmg: 1 }]], [['Suppressing Fire', { aoe: 0.3 }], ['Predator', { vs: [['Marked', 0.3]] }]], [['Deadeye', { dmg: 3 }], ['Trapper', { chance: 0.2, dur: 1 }]]],
  pyromancer: [[['Kindling', { procs: [['Burning', 0.3]] }], ['Focus', { mind: 1, hit: 1 }]], [['Wildfire', { spread: 1 }], ['Ember Ward', { ward: 3, immune: 'Burning' }]], [['Scorch', { vs: [['Burning', 0.25]] }], ['Lingering Flames', { dur: 1 }]], [['Conflagration', { aoe: 0.3 }], ['Quickened Casting', { cdr: 1 }]], [['Heart of Fire', { pay: 0.5 }], ['Arcane Might', { spd: 4 }]]],
  stormcaller: [[['Static', { chance: 0.15 }], ['Focus', { mind: 1, hit: 1 }]], [['Overload', { vs: [['Stunned', 0.3]] }], ['Storm Ward', { ward: 3, def: 1 }]], [['Forked Lightning', { aoe: 0.3 }], ['Tailwind', { init: 5, def: 2 }]], [['Thunderstruck', { procs: [['Prone', 0.25]] }], ['Quickened Casting', { cdr: 1 }]], [['Eye of the Storm', { pen: 4, crit: 1 }], ['Arcane Might', { spd: 4 }]]],
  lightbringer: [[['Gentle Hands', { healm: 0.2 }], ['Devotion', { spirit: 1, hp: 6 }]], [['Beacon', { aura: { regen: 2 } }], ['Sanctified', { ward: 3 }]], [['Radiant', { vs: [['Marked', 0.25], ['Exposed', 0.25]] }], ['Swift Prayers', { cdr: 1 }]], [['Benediction', { aura: { hit: 1, regen: 1 } }], ['Martyr', { hp: 14 }]], [['Miracle Worker', { healm: 0.3 }], ['Divine Wrath', { spd: 4 }]]],
  warpriest: [[['Zeal', { dmg: 3, hp: 6 }], ['Devotion', { spirit: 1, hp: 6 }]], [['Armour of Faith', { arm: 2 }], ['Smiter', { hit: 2 }]], [['Crusader', { aura: { dmg: 1 } }], ['Righteous Fury', { vs: [['Exposed', 0.25]] }]], [['Hammer of Judgement', { chance: 0.15, procs: [['Stunned', 0.1]] }], ['Blood for Blessing', { leech: 0.15 }]], [['Avatar of War', { dr: 0.12, lowhp: 0.2 }], ['Shepherd', { healm: 0.25, aura: { regen: 2 } }]]]
};
const talentsOf = h => h.sub ? (h.tal || []).map((c, k) => c === 0 || c === 1 ? TALENTS[h.sub][k][c] : null).filter(Boolean) : [];
function setTalent(S, hi, k, c) { const h = S.party[hi]; if (!h || !h.sub || k < 0 || k > h.level - 6 || (c !== 0 && c !== 1)) return false; h.tal = h.tal || []; const m0 = maxHp(h); h.tal[k] = c; h.hp = clamp(h.hp + Math.max(0, maxHp(h) - m0), 1, maxHp(h)); return true; }

// ---------- heroes ----------
function heroFx(h) { const fx = {}, sets = {}; for (const g of Object.values(h.gear)) { if (!g) continue; mergeFx(fx, g.fx); if (g.set) sets[g.set] = (sets[g.set] || 0) + 1; }
  for (const [k, n] of Object.entries(sets)) for (const [need, b] of Object.entries(SETS[k].bonus)) if (n >= +need) mergeFx(fx, b);
  for (const t of talentsOf(h)) mergeFx(fx, t[1]); if (h.bonus) mergeFx(fx, h.bonus); return fx; }
function heroStat(h, s) { const c = CLASSES[h.cls], L = h.level - 1, fx = heroFx(h);
  return c.st[STATS.indexOf(s)] + (c.grow[0] === s ? L : c.grow[1] === s ? L >> 1 : 0) + (fx[s] || 0) - (s === 'agility' && h.gear.a && ARMOR[h.gear.a.type].slow ? 1 : 0); }
function maxHp(h) { const c = CLASSES[h.cls]; return Math.max(1, Math.round((c.hp + c.hpl * (h.level - 1) + (heroFx(h).hp || 0)) * (1 - 0.12 * h.wounds))); }
function known(h) { const c = CLASSES[h.cls], out = c.base.slice(0, h.level >= 2 ? 5 : 4); if (h.sub) out.push(...c.subs[h.sub].sk.slice(0, h.level - 2)); return out; }
function autoEquip(h) { h.eq = known(h).slice().sort((a, b) => SK[b].w - SK[a].w).slice(0, 4); }
function newHero(seat, i) { const c = CLASSES[seat.cls];
  const h = { name: seat.name || c.n, cls: seat.cls, sub: null, ctrl: seat.ctrl, player: seat.player || '', level: 1, wounds: 0, row: c.row, hp: 0, eq: [], tal: [],
    gear: { w: mkWeapon(c.start[0], 1), off: c.start[1] ? mkShield(1) : null, a: mkArmor(c.start[2], 1), t1: null, t2: null } };
  h.hp = maxHp(h); h.eq = known(h).slice(0, 4); return h; }
function heroUnit(h, i) {
  const fx = heroFx(h), g = h.gear, w = WT[g.w.type], t = g.w.tier - 1, st = {}; for (const s of STATS) st[s] = heroStat(h, s);
  if (w.crit) fx.crit = (fx.crit || 0) + w.crit; if (w.init) fx.init = (fx.init || 0) + w.init; if (w.proc) fx.procs = (fx.procs || []).concat([[w.proc[0], w.proc[1], 'melee']]);
  return { id: 'h' + i, side: 'H', hi: i, name: h.name, row: h.row, hp: h.hp, max: maxHp(h), st, lvl: h.level, fx,
    arm: (g.a ? ARMOR[g.a.type].arm[g.a.tier - 1] : 0) + (g.off ? offOf(g.off).arm[g.off.tier - 1] : 0) + (fx.arm || 0), ward: (g.a ? ARMOR[g.a.type].ward[g.a.tier - 1] : 0) + (fx.ward || 0), defb: (g.off ? offOf(g.off).def[g.off.tier - 1] : 0) + (fx.def || 0),
    w: { die: w.die[t], sp: (w.sp ? w.sp[t] : 4 + t) + (fx.spd || 0), hit: w.hit || 0, bonus: w.bonus || 0, pierce: w.pierce, fin: w.fin, assassin: w.assassin, reach: w.reach, ranged: w.ranged, splash: w.splash, xbow: w.xbow },
    skills: h.eq.slice(), states: {}, cds: {}, used: {}, down: h.hp <= 0 };
}

// ---------- enemies ----------
const FAM = { bandit: { n: 'Bandits', weak: 'Undisciplined: Marked bandits take +50% instead of +25%.' }, undead: { n: 'Undead', weak: 'Unholy: holy damage is +50%.' }, beast: { n: 'Beasts', weak: 'Fur and hide: Burning deals double.' }, cult: { n: 'Cultists', weak: 'Fragile focus: Stunned cultists take +50% damage.' } };
const EN = {
  cutpurse: { n: 'Cutpurse', fam: 'bandit', hp: 12, atk: 2, agi: 4, arm: 0, ward: 0, die: 4, row: 'F', sk: ['e_hit'] },
  thug: { n: 'Thug', fam: 'bandit', hp: 18, atk: 3, agi: 1, arm: 1, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_trip'] },
  archer: { n: 'Bandit Archer', fam: 'bandit', hp: 11, atk: 3, agi: 3, arm: 0, ward: 0, die: 6, row: 'B', sk: ['e_shot', 'e_mark'] },
  hedgemage: { n: 'Hedge Mage', fam: 'bandit', hp: 10, atk: 3, agi: 2, arm: 0, ward: 1, die: 6, row: 'B', sk: ['e_fire', 'e_expose'], act: 2 },
  captain: { n: 'Bandit Captain', fam: 'bandit', hp: 40, atk: 4, agi: 3, arm: 2, ward: 0, die: 8, row: 'F', sk: ['e_hit', 'e_cleave', 'e_rally'], elite: true },
  skeleton: { n: 'Skeleton', fam: 'undead', hp: 13, atk: 3, agi: 2, arm: 2, ward: 0, die: 6, row: 'F', sk: ['e_hit'] },
  zombie: { n: 'Zombie', fam: 'undead', hp: 24, atk: 3, agi: 0, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_trip'] },
  bonearcher: { n: 'Bone Archer', fam: 'undead', hp: 10, atk: 3, agi: 3, arm: 1, ward: 0, die: 6, row: 'B', sk: ['e_shot'] },
  ghoul: { n: 'Ghoul', fam: 'undead', hp: 16, atk: 4, agi: 3, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_bite'], act: 2 },
  wraith: { n: 'Wraith', fam: 'undead', hp: 14, atk: 4, agi: 4, arm: 0, ward: 2, die: 6, row: 'B', sk: ['e_drain', 'e_expose'], ether: true, act: 2 },
  warden: { n: 'Barrow Warden', fam: 'undead', hp: 42, atk: 5, agi: 2, arm: 3, ward: 0, die: 8, row: 'F', sk: ['e_hit', 'e_crush', 'e_curse'], elite: true },
  wolf: { n: 'Wolf', fam: 'beast', hp: 12, atk: 3, agi: 4, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_trip'] },
  boar: { n: 'Tusker', fam: 'beast', hp: 18, atk: 3, agi: 2, arm: 1, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_charge'] },
  spider: { n: 'Giant Spider', fam: 'beast', hp: 11, atk: 2, agi: 3, arm: 0, ward: 0, die: 5, row: 'B', sk: ['e_shot', 'e_web'] },
  bats: { n: 'Bat Swarm', fam: 'beast', hp: 9, atk: 2, agi: 6, arm: 0, ward: 0, die: 4, row: 'B', sk: ['e_shot'], act: 2 },
  bear: { n: 'Cave Bear', fam: 'beast', hp: 48, atk: 5, agi: 2, arm: 1, ward: 0, die: 10, row: 'F', sk: ['e_hit', 'e_maul', 'e_roar'], elite: true },
  acolyte: { n: 'Acolyte', fam: 'cult', hp: 10, atk: 2, agi: 2, arm: 0, ward: 1, die: 5, row: 'B', sk: ['e_bolt', 'e_heal'] },
  zealot: { n: 'Zealot', fam: 'cult', hp: 15, atk: 4, agi: 3, arm: 0, ward: 0, die: 6, row: 'F', sk: ['e_hit', 'e_charge'] },
  hexer: { n: 'Hexer', fam: 'cult', hp: 10, atk: 3, agi: 2, arm: 0, ward: 2, die: 6, row: 'B', sk: ['e_bolt', 'e_expose', 'e_mark'], act: 2 },
  imp: { n: 'Imp', fam: 'cult', hp: 9, atk: 3, agi: 5, arm: 0, ward: 1, die: 4, row: 'F', sk: ['e_fire', 'e_hit'] },
  champion: { n: 'Cult Champion', fam: 'cult', hp: 44, atk: 5, agi: 3, arm: 2, ward: 2, die: 8, row: 'F', sk: ['e_hit', 'e_crush', 'e_rally'], elite: true },
  // bosses
  banditking: { n: 'Bandit King', fam: 'bandit', hp: 90, atk: 6, agi: 4, arm: 2, ward: 1, die: 10, row: 'F', sk: ['e_hit', 'e_cleave', 'e_crush', 'e_rally', 'e_callthugs'], boss: true },
  necro: { n: 'Necromancer', fam: 'undead', hp: 72, atk: 6, agi: 3, arm: 0, ward: 3, die: 9, row: 'B', sk: ['e_drain', 'e_curse', 'e_deathbolt', 'e_raise'], boss: true },
  knight: { n: 'Hollow Knight', fam: 'undead', hp: 100, atk: 6, agi: 2, arm: 4, ward: 1, die: 10, row: 'F', sk: ['e_hit', 'e_crush', 'e_cleave', 'e_curse'], boss: true },
  beastlord: { n: 'Beastlord', fam: 'beast', hp: 85, atk: 6, agi: 4, arm: 1, ward: 1, die: 10, row: 'F', sk: ['e_hit', 'e_maul', 'e_roar', 'e_callwolves'], boss: true },
  prophet: { n: 'Prophet', fam: 'cult', hp: 72, atk: 6, agi: 3, arm: 0, ward: 3, die: 9, row: 'B', sk: ['e_fire', 'e_firewave', 'e_heal', 'e_callimps'], boss: true },
  arch1: { n: 'The Regent', fam: 'cult', hp: 95, atk: 6, agi: 4, arm: 2, ward: 2, die: 10, row: 'F', sk: ['e_hit', 'e_crush', 'e_curse', 'e_rally', 'e_callimps'], boss: true, next: 'arch2' },
  arch2: { n: 'The Regent Unbound', fam: 'cult', hp: 100, atk: 7, agi: 4, arm: 1, ward: 4, die: 11, row: 'F', sk: ['e_deathbolt', 'e_breath', 'e_drain', 'e_raise', 'e_tail'], boss: true },
  wyrm: { n: 'Wyrm', fam: 'cult', hp: 110, atk: 6, agi: 3, arm: 3, ward: 2, die: 10, row: 'F', sk: ['e_hit', 'e_breath', 'e_tail'], boss: true }
};
function enemyUnit(S, key, lv, k, n) {
  const e = EN[key], big = e.elite || e.boss, iron = hasMod(S, 'armored') ? 3 : 0, small = n === 1 ? 0.62 : n === 2 ? 0.88 : 1, size = (big ? 0.4 + 0.15 * n : 1) * small, atk = e.atk + 1.3 * (lv - 1) + K.atk - (n === 1 ? 1.5 : 0), agi = Math.round(e.agi + 0.6 * (lv - 1));
  const vet = S.diff ? 1 : 0, hp = Math.max(1, Math.round(e.hp * (1 + 0.4 * (lv - 1)) * size * K.hp * (vet ? K.vetHp : 1))), a = Math.round(atk + vet * K.vetAtk);
  return { id: 'e' + k, side: 'E', key, name: e.n, fam: e.fam, row: e.row, hp, max: hp, st: { might: a, agility: agi, mind: a, spirit: a }, lvl: Math.round(lv), fx: hasMod(S, 'regen') ? { regen: Math.ceil(hp * 0.05) } : {},
    arm: e.arm + Math.floor((lv - 1) / 2) + iron, ward: e.ward + Math.floor((lv - 1) / 2) + iron, defb: 0, w: { die: e.die + Math.floor(lv - 1), sp: e.die + Math.floor(lv - 1), hit: 0, bonus: 0 },
    skills: e.sk.slice(), states: {}, cds: {}, used: {}, elite: e.elite, boss: e.boss, ether: e.ether };
}

// ---------- combat ----------
const has = (u, s) => !!u.states[s];
const up = u => u.hp > 0 && !u.down;
const living = (C, side) => C.units.filter(u => u.side === side && up(u));
const frontOf = (C, side) => living(C, side).filter(u => u.row === 'F');
const other = side => side === 'H' ? 'E' : 'H';
const unit = (C, id) => C.units.find(u => u.id === id);
const say = (C, t) => { C.log.push(t); if (C.log.length > 200) C.log.shift(); };
function addState(C, t, s, turns, src) {
  if ((t.fx.immune || []).includes(s) || (s === 'Stunned' && has(t, 'Steady'))) { say(C, `${t.name} shrugs off ${s}.`); return false; }
  t.states[s] = { t: turns + (src && src !== t && DEBUFFS.includes(s) ? src.fx.dur || 0 : 0), pow: 2 + (src ? src.lvl : 1), fresh: C.cur === t.id }; return true;
}
const atkStat = (u, sk) => sk.holy ? u.st.spirit : sk.ty === 'spell' ? u.st.mind : u.side === 'H' && (u.w.fin && sk.ty !== 'spell') ? Math.max(u.st.agility, sk.ty === 'ranged' ? 0 : u.st.might) : sk.ty === 'ranged' ? (u.w.xbow ? Math.max(u.st.might, u.st.agility) : u.st.agility) : u.st.might;
function skillType(u, sk) { return sk.id === 'attack' && u.w.ranged ? 'ranged' : sk.ty; }
function hitNeed(att, sk, t) {
  if (sk.sure || sk.flat !== undefined) return 2;
  const ty = skillType(att, sk), bonus = atkStat(att, { ...sk, ty }) + att.w.hit + (att.fx.hit || 0) + (has(att, 'Blessed') ? 2 : 0) + (has(t, 'Marked') ? 3 : 0) + (has(t, 'Stunned') || (has(t, 'Prone') && ty === 'melee') ? 4 : 0);
  return clamp(9 + t.st.agility + t.defb - bonus, 2, 20);
}
// damage for a given die roll; pure, so the AI can use it with the average roll
function damage(att, sk, t, roll, crit) {
  const ty = skillType(att, sk), phys = ty !== 'spell';
  let base = sk.flat !== undefined ? sk.flat + 2 * att.lvl : roll + att.w.bonus + (att.fx.dmg || 0) + atkStat(att, { ...sk, ty });
  let m = sk.flat !== undefined ? 1 : sk.m;
  const payoff = sk.pay && sk.pay.s.some(s => has(t, s)); if (payoff) m *= sk.pay.m + (att.fx.pay || 0);
  if (has(t, 'Marked')) m *= t.fam === 'bandit' ? 1.5 : 1.25;
  if (has(t, 'Exposed') && phys) m *= 1.25;
  if (has(att, 'Blessed')) m *= 1.2;
  if (has(att, 'Prone')) m *= 0.5;
  if (sk.holy && t.fam === 'undead') m *= 1.5;
  if (t.fam === 'cult' && has(t, 'Stunned')) m *= 1.5;
  if (t.ether && phys) m *= 0.5;
  if (att.fx.lowhp && att.hp / att.max < 0.5) m *= 1 + att.fx.lowhp; if (att.fx.exec && t.hp / t.max < 0.3) m *= 1 + att.fx.exec; if (att.fx.aoe && sk.tg !== 'one') m *= 1 + att.fx.aoe;
  for (const [vs, v] of att.fx.vs || []) if (has(t, vs)) m *= 1 + v;
  if (crit) m *= att.w.assassin ? 2 : 1.5;
  const armour = sk.flat !== undefined ? 0 : Math.max(0, (phys ? (has(t, 'Exposed') || att.w.pierce ? 0 : t.arm) : t.ward) - (att.fx.pen || 0));
  let d = Math.max(1, Math.round(base * m) - armour); if (has(t, 'Guard')) d = Math.max(1, Math.round(d / 2)); if (t.fx.dr) d = Math.max(1, Math.round(d * (1 - t.fx.dr)));
  return { d, payoff };
}
const dieOf = (att, sk) => skillType(att, sk) === 'spell' ? att.w.sp : att.w.die;
// who a skill may be pointed at: unit ids, row letters, or a single placeholder for skills without a choice
function targetsFor(C, att, sk) {
  const ty = skillType(att, sk), foes = living(C, other(att.side)), mates = living(C, att.side);
  if (sk.tg === 'self' || sk.tg === 'allies') return ['-'];
  if (sk.tg === 'ally') return mates.map(u => u.id);
  if (sk.tg === 'downed') return C.units.filter(u => u.side === att.side && u.down).map(u => u.id);
  if (!foes.length) return [];
  const melee = ty === 'melee';
  if (melee && att.row === 'B' && !att.w.reach && frontOf(C, att.side).length) return [];
  const ff = frontOf(C, other(att.side)), pool = melee && ff.length ? ff : foes;
  if (sk.tg === 'all') return ['-'];
  if (sk.tg === 'row') return melee ? [pool[0].row] : ['F', 'B'].filter(r => foes.some(u => u.row === r));
  let c = pool.filter(u => !has(u, 'Hidden')); if (!c.length) c = pool;
  const tn = c.filter(u => has(u, 'Taunt')); return (tn.length ? tn : c).map(u => u.id);
}
function resolveTargets(C, att, sk, t) {
  const foes = living(C, other(att.side)), mates = living(C, att.side);
  if (sk.tg === 'self') return [att]; if (sk.tg === 'allies') return mates; if (sk.tg === 'all') return foes;
  if (sk.tg === 'row') return foes.filter(u => u.row === t); const u = unit(C, t); return u ? [u] : [];
}
function hurt(S, C, t, d, src) {
  t.hp -= d;
  if (t.hp <= 0) { t.hp = 0; t.states = {};
    if (t.side === 'H' && C.n === 1 && !C.grit) { C.grit = true; t.hp = Math.round(t.max * 0.3); say(C, `${t.name} staggers, grits their teeth and fights on. (A lone hero gets one second wind per fight.)`); }
    else if (t.side === 'H' && t.fx.phoenix && !t.used.phoenix) { t.used.phoenix = true; t.hp = Math.round(t.max * 0.25); say(C, `${t.name}'s Phoenix Feather burns away, and ${t.name} fights on.`); }
    else if (t.side === 'H') { t.down = true; const h = S.party[t.hi]; if (h.wounds < 4) h.wounds++; say(C, `${t.name} is down!`); S.stats.downs++; }
    else if (EN[t.key] && EN[t.key].next) { const nu = enemyUnit(S, EN[t.key].next, C.lv + 0.5, 0, C.n); Object.assign(t, nu, { id: t.id, row: t.row, name: S.q.name + ', Unbound' }); if (S.camp) S.camp.codex.en[nu.key] = 1; say(C, `${S.q.name} falls, and rises again, changed. The true fight begins.`); }
    else { say(C, `${t.name} is destroyed.`); S.stats.kills++; } }
}
function heal(C, t, v) { if (C.frail && t.side === 'H') v /= 2; const a = Math.min(t.max - t.hp, Math.max(0, Math.round(v))); t.hp += a; return a; }
function strike(S, C, att, sk, t, forceCrit, scale) {
  const need = hitNeed(att, sk, t), r = die(S, 20), ty = skillType(att, sk);
  if (r < need || (r === 1 && !sk.sure && sk.flat === undefined)) { say(C, `${att.name} uses ${sk.n} on ${t.name}: rolled ${r}, needed ${need}. Miss.`); C.fx.push({ id: t.id, miss: 1 }); return 0; }
  const opener = sk.flat === undefined && att.fx.opener && !att.used.opener; if (opener) att.used.opener = true;
  const crit = sk.flat === undefined && (forceCrit || opener || r >= 20 - (att.fx.crit || 0) || (att.w.assassin && ty !== 'spell' && (has(t, 'Marked') || has(t, 'Stunned'))));
  let { d, payoff } = damage(att, sk, t, die(S, dieOf(att, sk)), crit); if (scale) d = Math.max(1, Math.round(d * scale));
  say(C, `${att.name} uses ${sk.n} on ${t.name}: rolled ${r} (needed ${need})${crit ? ', critical' : ''}${payoff ? ', combo' : ''}. ${d} damage.`);
  C.fx.push({ id: t.id, d, crit, payoff }); if (payoff) S.stats.combos++;
  if (payoff && sk.pay.consume) for (const s of sk.pay.s) delete t.states[s];
  const burning = has(t, 'Burning'); hurt(S, C, t, d, att);
  if (!up(t) && up(att)) { if (att.fx.killHeal) heal(C, att, att.max * att.fx.killHeal); if (att.fx.spread && burning) { const o = living(C, other(att.side)).find(u => !has(u, 'Burning')); if (o && addState(C, o, 'Burning', 3, att)) say(C, `The fire leaps to ${o.name}.`); } }
  if (up(t)) { for (const [s, turns, ch] of sk.ap || []) if (rnd(S) < ch + (att.fx.chance || 0) && addState(C, t, s, turns, att)) say(C, `${t.name} is ${s}.`);
    if (payoff && sk.pay.ap && addState(C, t, sk.pay.ap[0], sk.pay.ap[1], att)) say(C, `${t.name} is ${sk.pay.ap[0]}.`);
    if (sk.flat === undefined) for (const [ps, ch, only] of att.fx.procs || []) if ((!only || ty === only) && !has(t, ps) && rnd(S) < ch && addState(C, t, ps, PROC_T[ps], att)) say(C, `${att.name}'s gear leaves ${t.name} ${ps}.`); }
  if (t.fx.thorns && ty === 'melee' && up(att)) { say(C, `${att.name} takes ${t.fx.thorns} from thorns.`); hurt(S, C, att, t.fx.thorns); }
  return d;
}
function useSkill(S, C, att, sk, tspec) {
  const ts = resolveTargets(C, att, sk, tspec), hidden = has(att, 'Hidden'); let total = 0;
  if (sk.m || sk.flat !== undefined) { if (hidden) delete att.states.Hidden;
    for (const t of ts) if (up(t)) total += strike(S, C, att, sk, t, hidden);
    if (sk.id === 'attack' && att.w.splash && ts[0]) { const o = frontOf(C, other(att.side)).find(u => u !== ts[0] && u.row === ts[0].row); if (o) total += strike(S, C, att, sk, o, false, 0.5); }
    const leech = (sk.leech || 0); if (total && up(att)) { if (leech && sk.holy && att.side === 'H') { for (const m of living(C, 'H')) heal(C, m, total * leech / 2); say(C, `The party is healed by ${sk.n}.`); } else if (leech) heal(C, att, total * leech); if (att.fx.leech) heal(C, att, total * att.fx.leech); }
  }
  if (sk.heal || sk.flatHeal || sk.healP) for (const t of ts) { if (!up(t)) continue; const v = sk.healP ? t.max * sk.healP : sk.flatHeal ? sk.flatHeal + 4 * att.lvl : (die(S, att.w.sp) + att.st.spirit * 1.5) * sk.heal * (has(att, 'Blessed') ? 1.2 : 1) * (1 + (att.fx.healm || 0));
    const a = heal(C, t, v); say(C, `${att.name} uses ${sk.n}: ${t.name} regains ${a}.`); C.fx.push({ id: t.id, h: a }); }
  if (sk.cleanse) for (const t of ts) for (const s of DEBUFFS) delete t.states[s];
  if (sk.buff) { for (const t of ts) for (const [s, turns] of sk.buff) addState(C, t, s, turns, att); if (!sk.heal && !sk.healP) say(C, `${att.name} uses ${sk.n}.`); }
  if (sk.selfAp && up(att)) addState(C, att, sk.selfAp[0], sk.selfAp[1], att);
  if (sk.reviveP) for (const t of ts) if (t.down) { t.down = false; t.hp = Math.max(1, Math.round(t.max * sk.reviveP)); say(C, `${att.name} revives ${t.name}.`); }
  if (sk.summon) { let made = 0; for (let k = 0; k < sk.k; k++) { if (living(C, 'E').length >= 6) break; const u = enemyUnit(S, sk.summon, C.lv, C.nextId++, C.n); if (living(C, 'E').filter(x => x.row === u.row).length >= 3) u.row = u.row === 'F' ? 'B' : 'F'; C.units.push(u); made++; }
    say(C, made ? `${att.name} uses ${sk.n}: ${made} ${EN[sk.summon].n}${made > 1 ? 's' : ''} join the fight.` : `${att.name} calls for help, but none comes.`); }
}
function usable(C, u, id) { return !u.cds[id] && !u.used[id]; }
function endTurn(S, C, u) {
  for (const s of Object.keys(u.states)) { const st = u.states[s]; if (st.fresh) st.fresh = false; else if (--st.t <= 0) delete u.states[s]; }
  for (const k of Object.keys(u.cds)) if (--u.cds[k] <= 0) delete u.cds[k];
  checkOver(S, C); if (!C.over) nextUp(S, C);
}
function checkOver(S, C) { if (!living(C, 'E').length) C.over = 'win'; else if (!living(C, 'H').length) C.over = 'lose'; }
function newRound(S, C) { C.round++; C.order = C.units.filter(up).map(u => [u.id, u.st.agility + die(S, 6) + (u.fx.init || 0) + (C.first === u.side ? 20 : 0)]).sort((a, b) => b[1] - a[1]).map(x => x[0]); C.oi = -1; if (C.round > 1) C.first = null; }
// advance to the next unit that actually gets to act
function nextUp(S, C) {
  for (let guard = 0; guard < 500 && !C.over; guard++) {
    C.oi++; if (C.oi >= C.order.length) { newRound(S, C); continue; }
    const u = unit(C, C.order[C.oi]); if (!u || !up(u)) continue; C.cur = u.id;
    if (has(u, 'Burning')) { const d = u.states.Burning.pow * (u.fam === 'beast' ? 2 : 1); say(C, `${u.name} burns for ${d}.`); C.fx.push({ id: u.id, d }); hurt(S, C, u, d); checkOver(S, C); if (!up(u)) continue; }
    if (u.fx.regen) heal(C, u, u.fx.regen);
    if (has(u, 'Stunned')) { say(C, `${u.name} is stunned and loses the turn.`); delete u.states.Stunned; u.states.Steady = { t: u.boss ? 3 : u.elite ? 2 : 1, fresh: true };
      for (const s of Object.keys(u.states)) { const st = u.states[s]; if (st.fresh) st.fresh = false; else if (--st.t <= 0) delete u.states[s]; }
      for (const k of Object.keys(u.cds)) if (--u.cds[k] <= 0) delete u.cds[k]; continue; }
    return;
  }
}
// action: { k: 'skill', id, t } | { k: 'item', id, t } | { k: 'move' } | { k: 'defend' } | { k: 'revive', t }
function act(S, C, a) {
  const u = unit(C, C.cur); if (!u || C.over) return false; C.fx = [];
  if (a.k === 'skill') { const sk = SK[a.id]; if (!usable(C, u, a.id) || !targetsFor(C, u, sk).includes(a.t)) return false;
    useSkill(S, C, u, sk, a.t); if (sk.cd) u.cds[a.id] = Math.max(1, sk.cd - (u.fx.cdr || 0)) + 1; if (sk.once) u.used[a.id] = true; }
  else if (a.k === 'item') { const it = S.bag.find(x => x.id === a.id), c = CONS[a.id]; if (!it || !targetsFor(C, u, { ...c, ty: 'ranged' }).includes(a.t)) return false;
    useSkill(S, C, u, { ...c, ty: 'ranged', heal: 0 }, a.t); if (--it.qty <= 0) S.bag.splice(S.bag.indexOf(it), 1); }
  else if (a.k === 'move') { u.row = u.row === 'F' ? 'B' : 'F'; say(C, `${u.name} moves to the ${u.row === 'F' ? 'front' : 'back'} row.`); }
  else if (a.k === 'defend') { addState(C, u, 'Guard', 1, u); say(C, `${u.name} defends.`); }
  else if (a.k === 'revive') { const t = unit(C, a.t); if (!t || !t.down || t.side !== u.side) return false; t.down = false; t.hp = Math.max(1, Math.round(t.max * 0.2)); say(C, `${u.name} helps ${t.name} up.`); }
  else return false;
  endTurn(S, C, u); return true;
}
function threat(u) { return (u.w.die + 1) / 2 + u.st.might; }
function scoreSkill(C, u, sk, tspec, mates) {
  const ts = resolveTargets(C, u, sk, tspec); let s = 0;
  if (sk.m || sk.flat !== undefined) for (const t of ts) {
    const p = (21 - hitNeed(u, sk, t)) / 20, { d } = damage(u, sk, t, (dieOf(u, sk) + 1) / 2, has(u, 'Hidden'));
    s += p * (Math.min(d, t.hp) + (d >= t.hp ? 5 + threat(t) : 0) + (t.boss ? 1 : 0));
    for (const [st, turns, ch] of sk.ap || []) { if (has(t, st) || (st === 'Stunned' && has(t, 'Steady')) || d >= t.hp) continue;
      let v = st === 'Stunned' ? threat(t) : st === 'Prone' ? threat(t) * 0.5 + 1 : st === 'Exposed' ? t.arm * 2 + 2 : st === 'Marked' ? 3 : (2 + u.lvl) * turns * 0.7 * (t.fam === 'beast' ? 2 : 1);
      if (mates.some(m => m !== u && m.skills.some(id => SK[id].pay && SK[id].pay.s.includes(st) && !m.cds[id]))) v += 4 + u.lvl;
      s += p * ch * v; }
  }
  if (sk.heal || sk.flatHeal || sk.healP) for (const t of ts) { const v = sk.healP ? t.max * sk.healP : sk.flatHeal ? sk.flatHeal + 4 * u.lvl : ((u.w.sp + 1) / 2 + u.st.spirit * 1.5) * sk.heal, miss = t.max - t.hp;
    if (miss < v * 0.5 && t.hp / t.max > 0.4) continue; s += Math.min(v, miss) * (t.hp / t.max < 0.4 ? 1.7 : 1.1); }
  if (sk.cleanse) for (const t of ts) s += DEBUFFS.filter(x => has(t, x)).length * 3;
  if (sk.buff && u.side === 'H') for (const [b] of sk.buff) for (const t of ts) { if (has(t, b)) continue; const low = mates.filter(m => m.hp / m.max < 0.5).length;
    s += b === 'Taunt' ? (u.hp / u.max > 0.5 ? 3 + 4 * low : 0) : b === 'Guard' ? (sk.tg === 'allies' ? 1.5 + 2 * low : 1) : b === 'Blessed' ? 2 + threat(t) * 0.5 : b === 'Hidden' ? (u.hp / u.max < 0.5 ? 7 : 3) : 0; }
  if (sk.buff && u.side === 'E') s += 6;
  if (sk.selfAp) s -= 2;
  if (sk.summon) s += living(C, 'E').length <= 3 ? 14 : 0;
  return s;
}
function aiHero(S, C, u) {
  const mates = living(C, 'H'); let best = { k: 'defend' }, bs = 1.5;
  for (const id of ['attack', ...u.skills]) { if (!usable(C, u, id)) continue; const sk = SK[id]; for (const t of targetsFor(C, u, sk)) { const s = scoreSkill(C, u, sk, t, mates) * (id === 'attack' ? 0.95 : 1); if (s > bs) { bs = s; best = { k: 'skill', id, t }; } } }
  const downed = C.units.filter(x => x.side === 'H' && x.down);
  for (const it of S.bag) { const c = CONS[it.id]; if (c.tg === 'downed' && downed.length && bs < 26) { bs = 26; best = { k: 'item', id: it.id, t: downed[0].id }; }
    else if (c.flatHeal) { for (const m of mates) if (m.hp / m.max < 0.35) { const s = Math.min(c.flatHeal + 4 * u.lvl, m.max - m.hp) * 1.3; if (s > bs) { bs = s; best = { k: 'item', id: it.id, t: m.id }; } } }
    else if (c.flat !== undefined && (C.boss || C.elite || living(C, 'E').length >= 4)) for (const t of targetsFor(C, u, { ...c, ty: 'ranged' })) { const s = scoreSkill(C, u, { ...c, ty: 'ranged' }, t, mates) * 0.8; if (s > bs + 4) { bs = s; best = { k: 'item', id: it.id, t }; } } }
  if (downed.length && bs < 16 && mates.length <= 2) { bs = 16; best = { k: 'revive', t: downed[0].id }; }
  if (best.k === 'defend' && u.row === 'B' && !u.w.reach && frontOf(C, 'H').length && u.skills.every(id => SK[id].ty === 'melee' || SK[id].ty === 'buff')) best = { k: 'move' };
  return best;
}
function aiEnemy(S, C, u) {
  const opts = []; const mates = living(C, 'E');
  for (const id of u.skills) { if (!usable(C, u, id)) continue; const sk = SK[id];
    if (sk.heal && !mates.some(m => m.hp / m.max < 0.6)) continue;
    for (const t of targetsFor(C, u, sk)) { let s = scoreSkill(C, u, sk, t, mates); if (sk.tg === 'ally') { const m = unit(C, t); s = m.hp / m.max < 0.6 ? (m.max - m.hp) * 0.8 : 0; } if (s > 0) opts.push([{ k: 'skill', id, t }, s * (S.diff ? 0.9 + 0.2 * rnd(S) : 0.6 + 0.8 * rnd(S))]); } }
  if (!opts.length) return u.row === 'B' || targetsFor(C, u, SK.e_hit).length ? { k: 'defend' } : { k: 'move' };
  opts.sort((a, b) => b[1] - a[1]); return opts[0][0];
}
function startCombat(S, enc) {
  const n = S.party.length, C = { units: S.party.map(heroUnit), round: 0, order: [], oi: -1, cur: null, log: [], fx: [], over: null, lv: enc.lv, n, nextId: 0, kind: enc.kind, boss: enc.kind === 'boss', elite: enc.kind === 'elite', first: null };
  const rows = { F: 0, B: 0 };
  for (const key of enc.list) { const u = enemyUnit(S, key, enc.lv + (EN[key].elite || EN[key].boss ? 0.5 : 0), C.nextId++, n); if (rows[u.row] >= 3) u.row = u.row === 'F' ? 'B' : 'F'; rows[u.row]++; C.units.push(u); }
  if (!C.units.some(u => u.side === 'E' && u.row === 'F')) C.units.find(u => u.side === 'E' && !u.boss || true).row = 'F';
  const dup = {}; for (const u of C.units) if (u.side === 'E') dup[u.name] = (dup[u.name] || 0) + 1; const seen = {}; for (const u of C.units) if (u.side === 'E' && dup[u.name] > 1) { seen[u.name] = (seen[u.name] || 0) + 1; u.name += ' ' + 'ABCDEF'[seen[u.name] - 1]; }
  for (const u of C.units) if (u.side === 'H' && up(u)) { if (u.fx.startGuard) u.states.Guard = { t: 1, fresh: true }; if (u.fx.startTaunt) u.states.Taunt = { t: 2, fresh: true }; if (u.fx.startHidden) u.states.Hidden = { t: 2, fresh: true }; }
  const aura = {}; for (const u of C.units) if (u.side === 'H' && u.fx.aura) mergeFx(aura, u.fx.aura); for (const u of C.units) if (u.side === 'H') { u.fx = mergeFx({ ...u.fx, immune: (u.fx.immune || []).slice() }, aura); u.arm += aura.arm || 0; }
  for (const u of C.units) if (u.boss && EN[u.key].next) u.name = S.q.name;
  const mod = S.nextMod; S.nextMod = null;
  if (S.camp) for (const u of C.units) if (u.side === 'E') S.camp.codex.en[u.key] = 1;
  C.frail = hasMod(S, 'frail'); if (hasMod(S, 'swift') && mod !== 'ambush') C.first = 'E'; if (hasMod(S, 'cursed')) for (const u of living(C, 'H')) u.states.Exposed = { t: 2 };
  if (mod === 'ambush') { C.first = 'H'; for (const u of living(C, 'E')) { u.hp = Math.round(u.hp * 0.85); u.states.Exposed = { t: 2 }; } say(C, 'You catch them off guard: the enemy starts hurt and Exposed, and you act first.'); }
  if (mod === 'surprised') { C.first = 'E'; say(C, 'You are caught off guard: the enemy acts first.'); }
  if (mod === 'exposed') { for (const u of living(C, 'E')) u.states.Exposed = { t: 3 }; say(C, 'You know their weak points: the enemy starts Exposed.'); }
  if (C.boss && S.q.bossHp) { const b = C.units.find(u => u.boss); b.hp = b.max = Math.max(1, Math.round(b.max * (1 + S.q.bossHp))); say(C, S.q.bossHp < 0 ? `Your earlier work has weakened ${S.q.name}.` : `${S.q.name} has grown stronger while you delayed.`); }
  if (C.elite && S.q.flags.eliteWeak) { const b = C.units.find(u => u.elite); if (b) b.hp = Math.round(b.hp * 0.75); }
  S.C = C; S.screen = 'combat'; S.stats.fights++; newRound(S, C); nextUp(S, C); return C;
}
function endCombat(S) {
  const C = S.C; for (const u of C.units) if (u.side === 'H') { const h = S.party[u.hi]; h.row = u.row; h.hp = u.down ? 0 : u.hp; }
  if (C.over === 'lose') { S.C = null; if (S.camp) chapterEnd(S, false); else { S.screen = 'end'; S.result = 'defeat'; } return; }
  for (const h of S.party) { const m = maxHp(h); h.hp = h.hp <= 0 ? Math.round(m * 0.25) : Math.min(m, h.hp + Math.round(m * (S.diff ? K.vetHeal : K.heroHeal) * (hasMod(S, 'frail') ? 0.5 : 1))); }
  const node = S.map[S.pos], big = C.boss ? 3 : C.elite ? 1.8 : 1; S.C = null;
  if (C.boss && !S.camp) { S.screen = 'end'; S.result = 'victory'; S.gold += 100; return; }
  const P = pw(S), gold = Math.round((10 + 6 * P + ri(S, 8)) * big * (1 + perk(S, 'gold'))); S.gold += gold; S.stats.gold = (S.stats.gold || 0) + gold; if (C.boss) S.stats.bosses = (S.stats.bosses || 0) + 1; S.xp += Math.round(10 * big);
  S.loot = { gold, xp: Math.round(10 * big), items: rollLoot(S, Math.round(P) + (C.elite || C.boss ? 1 : 0)) }; S.screen = 'loot';
  if (node.lt) { const sp = rollSet(S, Math.round(P) + 1); if (sp) S.loot.items[0] = sp; }
  if (C.boss && S.camp && S.q.rank >= 3 && rnd(S) < 0.3 + 0.2 * S.q.mods.length) { const u = rollUnique(S); if (u) S.loot.items[1] = u; }
}

// How far along the party is, on the one-shot's scale of acts (1 to 3). In a campaign it keeps climbing with the chapters.
const pw = S => S.camp ? Math.min(6, S.camp.ch) + (S.screen !== 'town' && S.pos >= 0 && S.map[S.pos].act > 1 ? 0.5 : 0) : S.pos >= 0 ? S.map[S.pos].act : 1;
const maxTier = S => S.camp ? Math.min(5, S.camp.ch + 1) : 3, maxLevel = S => S.camp ? 10 : 5;
const evAct = (S, n) => !S.camp ? n.act : n.act > 1 ? 3 : S.camp.ch <= 2 ? 1 : 2;

// ---------- loot, shops, rest ----------
function rollAffixes(S, it, n) {
  const on = it.k === 'weapon' ? 'w' : 'a', pres = Object.keys(AFFIX).filter(a => AFFIX[a].pre && AFFIX[a].on === on), sufs = Object.keys(AFFIX).filter(a => !AFFIX[a].pre), out = [];
  if (n >= 3 || (n === 2 && rnd(S) < 0.7) || (n === 1 && rnd(S) < 0.5)) out.push(pick(S, pres));
  while (out.length < n) { const a = pick(S, sufs); if (!out.includes(a)) out.push(a); } it.afx = out; return finish(it);
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
    if (r === 'weapon') it = mkWeapon(pick(S, Object.keys(WT)), tier); else if (r === 'armor') it = mkArmor(pick(S, Object.keys(ARMOR)), tier); else it = mkShield(tier, pick(S, Object.keys(OFF)));
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
  const v = pick(S, VILLAINS), q = { vi: VILLAINS.indexOf(v), name: v.name, vtitle: v.title, fam: v.fam, boss: v.boss, lt: v.lt, minions: v.m, lair: pick(S, v.lair), region: pick(S, REGIONS), town: pick(S, TOWNS), patron: pick(S, PATRONS), relic: pick(S, RELICS), twist: pick(S, TWISTS), bossHp: 0, flags: {}, used: [] };
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
const EV = {}; for (const e of EVENTS) EV[e.id] = e;
function finalText(S) { const f = S.q.flags, p = [`${S.q.lair} at last. Beyond this door waits ${S.q.name}.`];
  if (f.spared) p.push('The scout you spared marked the quiet ways in.'); if (f.cruel) p.push('The road behind you is not proud of you.'); if (f.helped) p.push(`In ${S.q.town} they are lighting candles for you.`);
  if (f.betrayed) p.push(`${S.q.patron} will answer for this, after.`); if (f.puppet) p.push(`Remember: the true enemy is the ${S.q.relic}.`); if (f.mercy) p.push('You mean to take the villain alive.'); if (f.allies) p.push('Horns sound at the outer gate: the other company has kept its word.'); if (f.toolate) p.push('The sky is turning faster now.');
  if (f.freed) p.push('Freed prisoners are loose in the halls behind you.'); return p.join(' '); }
function eventText(S, e) { return fill(S, e.x.replace('{FINAL}', finalText(S)).replace('{W}', S.q.vtitle).replace('{MO}', S.q.motive)); }
function pickEvent(S, act) {
  const ok = e => !S.q.used.includes(e.id) && !(e.act && !e.act.includes(act)) && e.id !== 'hook' && (!e.req || S.q.flags[e.req]);
  const due = EVENTS.filter(e => e.req && ok(e)), gen = EVENTS.filter(e => !e.req && ok(e));
  const plot = gen.filter(e => e.act); const e = due.length && rnd(S) < 0.7 ? pick(S, due) : plot.length && rnd(S) < 0.45 ? pick(S, plot) : pick(S, gen.length ? gen : EVENTS.filter(x => !x.act && !x.req)); return e.id;
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
  S.map = nodes; S.layers = layers.length; S.acts = acts;
}
function options(S) { return S.pos < 0 ? [0] : S.map[S.pos].next; }
function encounter(S, kind) {
  const node = S.map[S.pos], act = node.act, n = S.party.length, prog = S.map.filter(m => m.act === act && m.x < node.x && m.lane === 1).length / 14, P = pw(S),
    lv = S.camp ? 0.875 * (1 + (Math.min(5, S.camp.ch) - 1) * 1.9 + (act - 1) * 0.95 + prog * 2) + 0.125 + (S.camp.ch <= 5 ? K.campLv[S.camp.ch - 1] + (S.diff ? K.vetLv[S.camp.ch - 1] : 0) : K.campLv[4] + (S.diff ? K.vetLv[4] : 0) + K.conLv + K.rankLv * ((S.q.rank || 1) - 1)) : act * 1.5 - 0.5 + prog;
  const fam = kind === 'boss' || node.lt || rnd(S) < 0.7 ? S.q.fam : pick(S, ['beast', 'bandit']);
  const pool = Object.keys(EN).filter(k => EN[k].fam === fam && !EN[k].elite && !EN[k].boss && (EN[k].act || 1) <= P), list = [];
  const more = hasMod(S, 'swarm') ? 1 : 0;
  if (kind === 'boss') { list.push(S.q.boss); for (let k = 0; k < Math.max(0, n - 2) + more; k++) list.push(pick(S, pool)); }
  else if (kind === 'elite') { const el = node.lt ? S.q.lt : Object.keys(EN).find(k => EN[k].fam === fam && EN[k].elite); list.push(el); for (let k = 0; k < Math.max(0, n - 1 - (P < 2 ? 1 : 0)) + more; k++) list.push(pick(S, pool)); }
  else { const cnt = clamp(n + (rnd(S) < 0.3 + 0.1 * Math.min(3, P) ? 1 : 0) - (P === 1 && node.x <= 1 ? 1 : 0) + more, 1, 6); for (let k = 0; k < cnt; k++) list.push(pick(S, pool)); }
  return { kind, lv, list };
}
function travel(S, id) {
  if (S.screen !== 'map' || !options(S).includes(id)) return false; S.pos = id; const n = S.map[id]; n.seen = true; S.stats.nodes++;
  if (n.type === 'fight' || n.type === 'elite' || n.type === 'boss') startCombat(S, encounter(S, n.type === 'fight' ? 'normal' : n.type));
  else if (n.type === 'event') openEvent(S, n.ev || pickEvent(S, evAct(S, n)));
  else if (n.type === 'shop') openShop(S); else S.screen = 'rest';
  return true;
}
const XP_AT = [0, 16, 38, 64, 96], CAMP_XP = [0, 22, 56, 106, 162, 224, 291, 364, 442, 526];
const xpAt = (S, lv) => (S.camp ? CAMP_XP : XP_AT)[lv];
const lvlDue = S => { const lv = S.party[0].level; return lv < maxLevel(S) && S.xp >= xpAt(S, lv); };
function afterNode(S) { if (S.camp && S.pos >= 0 && S.map[S.pos].type === 'boss' && S.map[S.pos].done) chapterEnd(S, true); else S.screen = 'map'; }
function finishNode(S) {
  S.map[S.pos].done = true; S.shop = null; S.leader++;
  if (lvlDue(S)) { levelUp(S); return; }
  afterNode(S);
}
function levelUp(S) {
  const gained = []; for (const h of S.party) { const before = known(h), m0 = maxHp(h); h.level++; h.hp += maxHp(h) - m0; h.hp = Math.min(maxHp(h), h.hp + Math.round(maxHp(h) * 0.2)); gained.push(known(h).filter(k => !before.includes(k))); }
  S.lvl = { level: S.party[0].level, gained, need: S.party[0].level === 3 ? S.party.map(() => true) : [], needT: S.party[0].level >= 6 ? S.party.map(h => !!h.sub) : [] }; S.screen = 'levelup';
  S.party.forEach((h, i) => { for (const k of gained[i]) if (h.eq.length < 4) h.eq.push(k); else if (h.ctrl === 'ai') autoEquip(h); });
}
function pickSub(S, hi, sub) { const h = S.party[hi]; if (!S.lvl || !S.lvl.need[hi] || !CLASSES[h.cls].subs[sub]) return false; h.sub = sub; S.lvl.need[hi] = false; const sk = CLASSES[h.cls].subs[sub].sk[0]; S.lvl.gained[hi] = [sk]; subGear(h, sub);
  if (h.eq.length < 4) h.eq.push(sk); else { const drop = h.eq.slice().sort((a, b) => SK[a].w - SK[b].w)[0]; if (h.ctrl === 'ai' || SK[drop].w < SK[sk].w) h.eq[h.eq.indexOf(drop)] = sk; }
  return true; }
function subGear(h, sub) { if (sub === 'ranger') { const w = h.gear.w; if (w.type !== 'bow' && w.type !== 'crossbow' && !w.set) h.gear.w = finish({ k: 'weapon', type: 'bow', tier: w.tier, afx: w.afx.slice() }); h.row = 'B'; } if (sub === 'warpriest') h.row = 'F'; if (sub === 'lightbringer') h.row = 'B'; h.hp = Math.min(h.hp, maxHp(h)); }
function pickTalent(S, hi, c) { if (!S.lvl || !S.lvl.needT[hi] || !setTalent(S, hi, S.lvl.level - 6, c)) return false; S.lvl.needT[hi] = false; return true; }
function closeLevel(S) { if (!S.lvl || S.lvl.need.some(Boolean) || S.lvl.needT.some(Boolean)) return false; S.lvl = null; if (lvlDue(S)) levelUp(S); else afterNode(S); return true; }
function setEq(S, hi, ids) { const h = S.party[hi], k = known(h); if (ids.length > 4 || ids.some(x => !k.includes(x)) || new Set(ids).size !== ids.length) return false; h.eq = ids.slice(); return true; }

// ---------- campaign: five chapters against one hidden enemy, then open-ended contracts ----------
const ARCH = [{ name: 'Vharos', title: 'the Pale Regent', sigil: 'a crowned skull', hold: 'the Black Citadel' }, { name: 'Queen Ysolde', title: 'the Winter Queen', sigil: 'a white stag', hold: 'the Frozen Court' }, { name: 'Malachar', title: 'the Ash Prophet', sigil: 'a burning eye', hold: 'the Cinder Throne' }];
const TRAIN = { talent: 15, sub: 80 };
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
  const q = { vi, name: v.name, vtitle: v.title, fam: v.fam, boss: v.boss, lt: v.lt, minions: v.m, lair: pick(S, v.lair), region: pick(S, REGIONS), town: pick(S, TOWNS), patron: pick(S, PATRONS), relic: pick(S, RELICS), twist: 'none', bossHp: 0, flags: {}, used: [], rank: rank || 0, mods: mods || [] };
  q.motive = c.ch === 5 ? 'has been behind every warlord you have faced, and is nearly ready to take the realm whole' : c.ch === 4 ? fill({ q }, `is ${A.name}'s champion, and holds the last road to ${A.hold}`) : fill({ q }, pick(S, MOTIVES).t);
  q.title = (c.ch <= 5 ? `Chapter ${c.ch}: ` : `Contract, rank ${rank}: `) + `${v.title.replace(/^the /, 'The ')} of ${q.lair}`; return q;
}
function townStock(S) { const t = S.camp.ch + (S.camp.ch > 5 ? 1 : 0), items = [rollGear(S, t), rollGear(S, t), rollGear(S, t), rollGear(S, t + 1), rollGear(S, t + 1), rollTrinket(S, t), rollTrinket(S, t + 1), rollTrinket(S, t + 1), mkCons('potion', 2), mkCons('salts', 1), rollCons(S, t, 1), rollCons(S, t, 1)];
  if (room(S, 'armoury')) items.unshift(rollGear(S, t + 1), rollGear(S, t + 1), rollGear(S, t + 1), rollTrinket(S, t + 1));
  for (const it of items) it.price = Math.round(it.price * 1.2 * (1 - perk(S, 'disc'))); return { items, healCost: room(S, 'infirmary') ? 0 : 10 + 10 * Math.min(6, t), town: true }; }
function enterTown(S) { const c = S.camp; S.screen = 'town'; S.pos = -1; S.C = null; S.ev = null; S.loot = null; S.lvl = null; S.nextMod = null; S.map = []; refreshBonus(S);
  if (c.ch > 5) { const R = c.rank; c.board = [[R, 0], [R, 1], [R + 1, 1 + ri(S, 2)]].map(([rank, m]) => campQuest(S, rank, shuffle(S, Object.keys(MODS)).slice(0, m))); S.q = c.board[0]; } else { c.board = null; S.q = campQuest(S); }
  S.shop = townStock(S); for (const h of S.party) h.hp = maxHp(h); checkAch(S); }
function startChapter(S, k) { const c = S.camp; if (S.screen !== 'town') return false; if (c.board) S.q = c.board[clamp(k || 0, 0, 2)]; S.shop = null; c.downs0 = S.stats.downs; c.news = []; genMap(S); S.pos = -1; S.screen = 'map'; for (let n = 0; n < perk(S, 'potion'); n++) addBag(S, mkCons('potion', 1)); return true; }
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
function changeSub(S, hi) { const h = S.party[hi]; if (S.screen !== 'town' || !h || !h.sub || S.gold < trainCost(S, 'sub')) return false; S.gold -= trainCost(S, 'sub'); h.sub = Object.keys(CLASSES[h.cls].subs).find(k => k !== h.sub); subGear(h, h.sub); autoEquip(h); h.hp = Math.min(h.hp, maxHp(h)); return true; }

function newRun(seed, seats, diff) {
  const S = { v: 5, diff: diff ? 1 : 0, seed: seed | 0, seed0: seed | 0, party: seats.map(newHero), gold: 20, xp: 0, bag: [{ id: 'potion', qty: 2 }], stash: [], pos: -1, screen: 'map', C: null, ev: null, loot: null, shop: null, lvl: null, nextMod: null, leader: 0, result: null,
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
    if (it.k === 'weapon') { const w = WT[it.type]; if (cur && cur.type !== it.type) s -= 0.6; if (w.two && h.gear.off) s -= 1; if (it.type === 'staff' && cur.type !== 'staff') s -= h.cls === 'mage' ? -2 : 0.5; if (it.type === 'bow' && h.sub !== 'ranger') s -= 2; if (it.type === 'crossbow' && h.row === 'F') s -= 1.5; if (it.type === 'wand' && cur.type === 'staff') s -= 1; if (h.cls === 'priest' && h.sub !== 'warpriest' && !WT[it.type].sp && WT[cur.type].sp) s -= 2; if (WT[it.type].sp && h.sub === 'warpriest') s -= 2; if (h.sub === 'ranger' && it.type !== 'bow') s -= 3; if (h.cls === 'mage' && !WT[it.type].sp) s -= 3; if (it.type === 'spear' && h.cls === 'priest' && h.sub !== 'warpriest') s -= 1; }
    if (it.k === 'shield' && h.gear.w && WT[h.gear.w.type].two) s -= 3; if (it.k === 'shield' && it.type === 'tome' && h.sub === 'warpriest') s -= 1; if (it.k === 'shield' && cur && cur.type !== it.type && it.type === 'parry') s -= 1; if (it.k === 'armor' && ARMOR[it.type].slow && h.cls !== 'warrior') s -= 0.5; if (it.k === 'armor' && cur && ARMOR[it.type].rank < ARMOR[cur.type].rank && h.row === 'F') s -= 1;
    if (it.k === 'trinket') { s = itemScore(it) + (h.gear.t1 && h.gear.t2 ? -Math.min(itemScore(h.gear.t1), itemScore(h.gear.t2)) - 0.2 : 1.5); if (h.gear.t1 && h.gear.t2 && h.gear.t1.set) s -= 2; const f = it.fx; for (const st of STATS) if (f[st]) s += CLASSES[h.cls].grow[0] === st ? 1 : -1; if (f.thorns || f.startGuard || f.arm) s += h.row === 'F' ? 0.5 : -0.5; }
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
  if (h.cls === 'priest') return S.party.some((o, j) => j !== i && o.cls === 'priest' && o.sub !== 'warpriest') || S.party.length === 1 ? 'warpriest' : 'lightbringer'; return subs[ri(S, 2)]; }
function aiEventChoice(S) { const e = EV[S.ev.id]; let best = 0, bs = -9; const frac = S.party.reduce((a, h) => a + h.hp / maxHp(h), 0) / S.party.length;
  e.c.forEach((c, i) => { let s; const val = o => (o.gold || 0) / 12 + (o.healP || 0) * 6 * (1.2 - frac) - (o.hurtP || 0) * 12 - (o.hurtR || 0) * 5 - (o.wound || 0) * 4 + (o.xp || 0) / 4 + (o.item ? 2.5 : 0) + (o.item2 ? 1.5 : 0) - (o.boss || 0) * 30 + (o.next === 'ambush' ? 2 : o.next === 'surprised' ? -2 : o.next ? 1 : 0) + (o.fight ? (frac > 0.7 ? 0.5 : -3) : 0) + (o.flag === 'eliteWeak' || o.flag2 === 'eliteWeak' ? 2 : 0) + (o.flag === 'cruel' || o.flag === 'desecrated' ? -1.5 : 0) + (o.flag === 'helped' || o.flag === 'spared' ? 1 : 0);
    if (c.s) { const { need } = checkInfo(S, c), pOk = (21 - need) / 20, pMid = c.mid ? Math.min(0.2, 1 - pOk) : 0; s = pOk * val(c.ok) + pMid * val(c.mid || {}) + (1 - pOk - pMid) * val(c.bad); }
    else if (c.random) s = c.random.reduce((a, o) => a + val(o), 0) / c.random.length; else s = val(c);
    if (c.cost) { const cost = Math.round(c.cost * (0.7 + 0.3 * pw(S))); s = S.gold >= cost ? s - cost / 14 : -99; }
    if (s > bs) { bs = s; best = i; } }); return best; }
function aiRoute(S) { const opts = options(S), frac = S.party.reduce((a, h) => a + h.hp / maxHp(h), 0) / S.party.length, w = S.party.reduce((a, h) => a + h.wounds, 0);
  let best = opts[0], bs = -9; for (const id of opts) { const t = S.map[id].type; let s = t === 'rest' ? (frac < 0.6 || w ? 4 : 0.5) : t === 'shop' ? (S.gold >= 45 ? 2.5 : 0.8) + (w && S.gold > 20 ? 1 : 0) : t === 'event' ? 1.8 : t === 'elite' ? (frac > 0.8 && !w ? 2 : -1) : frac > 0.55 ? 2 : 0.6; s += rnd(S) * 0.5; if (s > bs) { bs = s; best = id; } } return best; }
