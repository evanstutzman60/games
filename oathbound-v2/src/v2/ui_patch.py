import re
s=open('/home/claude/rpg/ui.js').read()
def R(a,b,c=1):
    global s
    assert s.count(a)==c,(a[:70],s.count(a)); s=s.replace(a,b)
def between(a,b,new):
    global s
    i=s.index(a); j=s.index(b,i); s=s[:i]+new+s[j:]
R("SAVE = 'oathbound-slots'","SAVE = 'oathbound2-slots'")
# single adventure only in this test build
i=s.index("h('p', null, 'Mode: ',"); j=s.index("h('p', null, 'Difficulty: '",i)
s=s[:i]+"h('p', { class: 'small dim' }, 'Test build of the new combat: single adventure only. Campaign and contracts come back once this plays well.'),\n    "+s[j:]
R("Human players share this screen and take turns; AI allies fill the other seats.'),","Human players share this screen and take turns; AI allies fill the other seats.'),\n    h('p', { class: 'small', style: 'color:#ffd36b' }, 'Oathbound v2: every attack lands, turns run on a timeline, setups stack up and wait for you, and each class builds its own resource. Open How it works for the rules.'),")
between("function unitCard(C, u, targets, onPick, pv) {","function renderCombat(main) {", r'''function unitCard(C, u, targets, onPick, pv) {
  const st = Object.keys(u.states), fx = (C.fx || []).filter(f => f.id === u.id), tgt = targets && targets.includes(u.id), stk = STACKS.filter(k => u.stacks && u.stacks[k]);
  return h('div', { class: `unit ${u.side}${u.id === C.cur && !C.over ? ' cur' : ''}${tgt ? ' tgt' : ''}${up(u) ? '' : ' down'}${u.boss ? ' boss' : ''}`, onclick: () => { if (tgt) onPick(u.id); else { inspect = u.id; render(); } } },
    h('div', { class: 'un' }, u.name), hpBar(u.hp, u.max), h('div', { class: 'small dim' }, up(u) ? `${u.hp}/${u.max}` : u.side === 'H' ? 'down' : 'dead', u.ar ? ` · ${AR_NAME[u.ar].split(' ')[0]}` : '', u.eva ? ` · ${u.eva}% dodge` : '', u.npc ? ' · protect' : u.comp ? ' · companion' : u.flee ? ' · fleeing' : ''),
    u.side === 'H' && RES[u.cls] && !u.npc ? h('div', { class: 'res', title: `${resName(u)}: ${u.res} of 5 points` }, resName(u) + ' ', h('span', { class: 'dots' }, '●'.repeat(u.res || 0) + '○'.repeat(5 - (u.res || 0)))) : null,
    stk.length ? h('div', null, stk.map(k => h('span', { class: 'stk ' + k, title: STACK_INFO[k] }, `${STACK_NAME[k]} ${u.stacks[k]}`))) : null,
    h('div', null, st.map(s => h('span', { class: `chip ${s}${DEBUFFS.includes(s) ? '' : ' good'}`, title: STATE_INFO[s] }, s + (u.states[s].t > 1 && u.states[s].t < 10 ? ' ' + u.states[s].t : '')))),
    u.wind ? h('div', { class: 'wind' }, '! Winding up something big') : null,
    pv ? h('div', { class: 'pv' }, h('b', null, `${pv.lo === pv.hi ? pv.lo : pv.lo + ' to ' + pv.hi} damage`), pv.p < 1 ? h('span', { class: 'dim' }, ` · ${Math.round(pv.p * 100)}% to land`) : null, pv.tags.length ? h('div', { class: 'dim' }, pv.tags.join(', ')) : null) : null,
    fx.map(f => h('span', { class: 'pop ' + (f.miss ? 'm' : f.h !== undefined ? 'h' : 'd') }, f.miss ? 'dodged' : f.h !== undefined ? '+' + f.h : f.d !== undefined ? '-' + f.d + (f.crit ? '!' : '') + (f.tag ? ' ' + f.tag : '') : f.tag)));
}
function describeUnit(C, u) {
  if (u.npc) return `${u.name}: keep them alive. They take half damage from attacks that hit a row or everyone; Defend to cover them.`; if (u.comp) return `${u.name}, companion. Fights on their own.`;
  const sp = `Speed ${Math.round(speedOf(u) * 10) / 10}`;
  if (u.side === 'H') { const x = S.party[u.hi]; return `${u.name}, ${subName(x)}. ${STATS.map(s => STAT_NAME[s] + ' ' + u.st[s]).join(', ')}; ${sp}; ${u.arm} armour, ${wardOf(u)} ward${u.eva ? `, ${u.eva}% dodge` : ''}.`; }
  const ar = ARMT[u.ar], els = Object.entries(u.aff).filter(([, v]) => v !== 1).map(([k, v]) => `${EL_NAME[k]} x${v}`), imm = STACKS.filter(k => u.bres && u.bres[k] === 0).map(k => STACK_NAME[k]);
  return `${u.name} (${FAM[u.fam].n}). ${AR_NAME[u.ar]}: Slash x${ar.slash}, Pierce x${ar.pierce}, Strike x${ar.strike}.${els.length ? ' ' + els.join(', ') + '.' : ''}${imm.length ? ' Immune to ' + imm.join(' and ') + '.' : ''} ${u.arm} armour, ${u.ward} ward, ${sp}${u.eva ? `, ${u.eva}% dodge` : ''}. Uses: ${u.skills.map(k => SK[k].n).join(', ')}.`;
}
// the next ten turns; with a skill picked, a dashed marker shows where the acting hero lands after using it
function orderStrip(C) {
  const cur = unit(C, C.cur), sk = sel && sel.k === 'skill' ? SK[sel.id] : null, wt = sel ? (sk ? sk.wt || 'n' : sel.k === 'item' ? 'q' : 'n') : null;
  let ghosted = false; const chips = projectTurns(C, 10, wt || 'n').map(e => { const u = unit(C, e.id); if (!u) return null; const ghost = !!wt && e.id === C.cur && !e.now && !ghosted; if (ghost) ghosted = true;
    return h('span', { class: 'to ' + (u.side === 'H' ? 'toh' : 'toe') + (e.now ? ' tonow' : '') + (e.skip ? ' toskip' : '') + (ghost ? ' toghost' : '') + (e.wind ? ' towind' : '') + (inspect === e.id ? ' tosel' : ''),
      title: e.skip ? `${u.name} is ${has(u, 'Frozen') ? 'Frozen' : 'Stunned'} and will lose this turn` : e.wind ? `${u.name} is winding up a big attack` : `${u.name}: Speed ${Math.round(speedOf(u) * 10) / 10}`, onclick: () => { inspect = e.id; render(); } }, e.now ? '▶ ' : '', e.wind ? '! ' : '', u.name, e.skip ? ' (skips)' : ''); });
  return h('div', { class: 'torder', title: 'Speed is 8 + Agility. After acting you move down the timeline: Quick 70, Normal 100, Heavy 140 ticks, divided by Speed/10.' }, h('span', { class: 'tolab' }, 'Next turns'), chips,
    wt && cur ? h('span', { class: 'tolab' }, `dashed: ${cur.name} after this ${WT_NAME[wt].toLowerCase()} action`) : null);
}
''')
R("""    const btn = id => { const sk = SK[id], cd = cur.cds[id], gone = cur.used[id], none = !targetsFor(C, cur, sk).length;
      return h('button', { class: sel && sel.k === 'skill' && sel.id === id ? 'on' : '', disabled: !!cd || !!gone || none, title: skillDesc(sk), onclick: () => pickA({ k: 'skill', id }) }, sk.n, cd ? h('span', { class: 'cd' }, ` (${cd})`) : gone ? h('span', { class: 'cd' }, ' (used)') : ''); };""",
"""    const btn = id => { const sk = SK[id], cd = cur.cds[id], gone = cur.used[id], none = !targetsFor(C, cur, sk).length, cost = sk.cost === 'all' ? ' (all)' : typeof sk.cost === 'number' ? ` (${sk.cost})` : sk.gain ? ` (+${sk.gain})` : '';
      return h('button', { class: sel && sel.k === 'skill' && sel.id === id ? 'on' : '', disabled: !usable(C, cur, id) || none, title: skillDesc(sk), onclick: () => pickA({ k: 'skill', id }) }, sk.n, h('span', { class: 'cd' }, cost), cd ? h('span', { class: 'cd' }, ` cooldown ${cd - 1 || 1}`) : gone ? h('span', { class: 'cd' }, ' used') : ''); };""")
R("cur.streak ? h('span', { class: 'dim' }, ` · +${cur.streak * 3} to hit after missing`) : ''", "RES[cur.cls] ? h('span', { class: 'dim' }, ` · ${resName(cur)} ${cur.res}/5. Numbers on buttons: (cost), (+points it builds), (all) for finishers.`) : ''")
R("'Pick an action, then a glowing target; each target shows your hit chance, damage, multipliers and meter buildup. Click any combatant to see its armour, weaknesses and meters.'", "'Pick an action, then a glowing target; each target shows the damage range and what changes it. The strip at the top shows who acts next, and with a skill picked, where you will land. Click any combatant for details.'")
R("Object.keys(u.states).map(s => `${s}: ${STATE_INFO[s]}`).join(' ')", "Object.keys(u.states).map(s => `${s}: ${STATE_INFO[s]}`).join(' '), ' ', STACKS.filter(k => u.stacks && u.stacks[k]).map(k => `${STACK_NAME[k]} ${u.stacks[k]}: ${STACK_INFO[k]}`).join(' ')")
R("const b = 'Spend your turn to get a downed ally back on their feet at 20% health.'","const b = 'Spend your turn to get a downed ally back on their feet at 20% health.'",0)
# hero sheet
between("function statText(x, u, st) {","function sheet(i) {", r'''function statText(x, u, st) {
  if (st === 'might') return `+${K.mightHp} health per point; melee and heavy-weapon damage.`;
  if (st === 'agility') return `Speed on the timeline (yours is ${Math.round(speedOf(u) * 10) / 10}); ${u.eva || 0}% chance to dodge single-target physical attacks; bow and light-blade damage.`;
  if (st === 'mind') return `spell damage; +1 starting ${RES[x.cls] ? RES[x.cls][0] : 'point'} at 3 and again at 6 Mind.`;
  return `healing done and received; ${u.st.spirit * 5}% chance to shrug off each stack an enemy puts on you.`; }
''')
R("const x = S.party[i], g = x.gear, free = S.screen !== 'combat', u = heroUnit(x, i);","const x = S.party[i], g = x.gear, free = S.screen !== 'combat', u = prep(S, null, heroUnit(x, i));")
R("`${u.arm} armour (subtracted from physical hits), ${u.ward} ward (subtracted from spells), ${u.defb ? `+${u.defb} defence, ` : ''}${u.max} health.`","`${u.arm} armour (each point cuts physical damage by 6%, up to 50%), ${u.ward} ward (the same for spells), ${u.max} health.`")
i=s.index("h('h3', null, `Skills (${x.eq.length}/4 equipped)`)"); j=s.index("h('p', null, h('button', { class: 'primary', onclick: closeModal }, 'Close'))",i)
s=s[:i]+"h('h3', null, `Skills (all usable in combat; ${RES[x.cls] ? RES[x.cls][0] : 'points'}: ${CLASSES[x.cls].n === 'Mage' ? 'starts at 2, +1 every turn' : 'see each skill'})`), known(x).map(id => h('div', { class: 'sk small' }, h('b', null, SK[id].n), ' ', skillDesc(SK[id]))),\n    "+s[j:]
# rules
i=s.index("h('p', null, h('b', null, 'Rows. ')"); j=s.index("h('p', null, h('b', null, 'Going down. ')",i)
s=s[:i]+r"""h('p', null, h('b', null, 'Rows. '), 'Melee attacks can only reach the enemy front row while anyone stands in it, and can only be made from your own front row (spears reach from the back). Ranged attacks and spells reach anyone.'),
    h('p', null, h('b', null, 'The timeline. '), 'There are no rounds. The strip at the top shows the next ten turns. Speed is 8 + Agility. After acting you move down the timeline by the action\'s weight (Quick 70, Normal 100, Heavy 140 ticks) divided by Speed/10, so quick actions bring your next turn sooner. Pick a skill to see a dashed marker where you will land. Shoves, stuns and freezes knock enemies down the timeline.'),
    h('p', null, h('b', null, 'Attacks. '), 'Every attack lands. Very agile units (rogues, wolves, imps) may dodge single-target physical attacks, shown as a % on their card; spells and area attacks always land. Damage is a range, shown on each target before you click. Armour cuts physical damage by 6% per point (up to 50%); ward does the same for spells, and arcane ignores half of it. Critical hits (x1.5) come from Hidden and against Frozen or Stunned targets.'),
    h('p', null, h('b', null, 'Resources. '), 'Each class has 0 to 5 points, shown as dots on its card. Warrior Rage: +1 when you hit, +1 when you are hit. Rogue Combo: from quick builders and Smoke Bomb. Mage Focus: +1 every turn and +1 per basic spell. Priest Faith: from heals and holy hits, and +1 when an ally drops below half health. Builders add points (+1), big skills cost them (2), and finishers spend them all (all) for more damage per point.'),
    h('p', null, h('b', null, 'Stacks. '), 'Setups are stacks on a target, up to 5 of each, shown on its card. ', Object.values(STACK_INFO).join(' '), ' Stacks hold while someone keeps adding to them; at the end of the target\'s turn, any kind that got nothing new drops by one. Poison never fades.'),
    h('p', null, h('b', null, 'Reactions. '), Object.entries(REACT_INFO).map(([k, v]) => `${k}: ${v}`).join(' ')),
    h('p', null, h('b', null, 'Healing. '), 'Every heal, from a prayer or a potion, also cleanses Bleed, Burn, Poison and one bad state.'),
    h('p', null, h('b', null, 'Stats. '), 'Might: +2 health per point, melee and heavy-weapon damage. Agility: Speed, dodge above 4, bow and light-blade damage. Mind: spell damage and a starting resource point at 3 and 6. Spirit: healing, and a 5% chance per point to shrug off each stack an enemy puts on you.'),
    h('p', null, h('b', null, 'Damage types. '), 'Weapons and physical skills deal Slash (swords, axes, sabres), Pierce (daggers, rapiers, spears, bows) or Strike (maces, hammers, staves). Each enemy wears Cloth, Hide, Mail, Plate, Bone or Spirit, which takes a little more or less from each. Elements: fire, frost, lightning, holy (heals your most wounded ally as it strikes; Flamekeeper fire does too) and arcane.'),
    h('p', null, h('b', null, 'Bosses. '), 'Each villain fights with two lieutenants and changes at 66% and 33% health. Before their biggest attacks they wind up: a ! appears on the timeline and on their card. That is the moment for Defend, Shield Wall, Sanctuary or Smoke Bomb.'),
    h('p', null, h('b', null, 'The road. '), 'Every fight is part of the story, and many have an objective (stop the messenger, protect someone, hold the breach, win quickly). Time for objectives is counted in markers of 100 ticks. When protecting someone, enemies only go for them from their second turn, they take half damage from area attacks, and Defend covers them.'),
    DEBUFFS.concat(['Guard', 'Taunt', 'Blessed', 'Hidden']).map(s => h('div', { class: 'small' }, h('span', { class: 'chip ' + s + (DEBUFFS.includes(s) ? '' : ' good') }, s), ' ', STATE_INFO[s])),
    """+s[j:]
R("'A hero at zero health is down and takes a wound (12% less maximum health) until healed at a camp or merchant. Allies can help them up mid-fight. If everyone is down, the adventure ends.'","'A hero at zero health is down and takes a wound (10% less maximum health, up to 3). Camps and merchants heal wounds, and every wound heals at the start of a new act. Allies can help them up mid-fight. If everyone is down, the adventure ends.'")
R('`  round ${C.round}`', '`  marker ${C.round}`')
open('/home/claude/rpg2/ui.js','w').write(s); print('ui ok')
