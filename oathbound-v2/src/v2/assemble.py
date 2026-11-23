import re
p='/home/claude/rpg2/logic.js'; s=open('/home/claude/rpg/logic.js').read()
V=lambda f: open('/home/claude/rpg2/v2/'+f).read().rstrip('\n')
def between(a, b, new, incl_b=False):
    global s
    i=s.index(a); j=s.index(b, i)
    if incl_b: j=s.index('\n', j)+1
    s=s[:i]+new+('\n' if not incl_b else '\n')+s[j:] if not incl_b else s[:i]+new+'\n'+s[j:]
def R(a,b,c=1):
    global s
    assert s.count(a)==c,(a[:60],s.count(a)); s=s.replace(a,b)
between('// States. Tactical states', '// ---------- classes ----------', V('a_skills.js')+'\n')
between('const CLASSES = {', '// ---------- items ----------', V('b_classes.js')+'\n')
between('const CONS = {', 'for (const k in CONS) CONS[k].id = k;', V('c_items.js'), incl_b=True)
s=re.sub(r"const SUBFX = \{[^\n]*\n", "const SUBFX = { guardian: { arm: 2, hp: 8 }, berserker: { hp: 10, leech: 0.1 }, assassin: { crit: 1, def: 2, hp: 8 }, ranger: {}, cryomancer: {}, stormcaller: {}, lightbringer: { healm: 0.2 }, flamekeeper: { arm: 2, hp: 12, healm: 0.4, leech: 0.15 } };\n", s, count=1)
R("* (1 - 0.12 * h.wounds)", "* (1 - 0.1 * h.wounds)")
between('// a Ranger fights from the back row', 'const ARMT = {', V('d_units.js'), incl_b=True)
between('function enemyUnit(S, key, lv, k, n) {', '// ---------- combat ----------', V('e_enemy.js')+'\n\n')
between('// ---------- combat ----------', 'function endCombat(S) {', V('f_engine.js')+'\n')
# K knobs
R("const XP_AT = [0, 15, 35, 60, 88],", "const XP_AT = [0, 20, 50, 88, 127],")
R("const K = { nodeXp: 6,", "const K = { bigHp: 1, nodeXp: 2,")
# XP with catch-up, objective bonus, wounds at act end
R("S.xp += Math.round(10 * big);\n  S.loot = { gold, xp: Math.round(10 * big),", "const xpg = xpGain(S, 10 * big) + (C.obj && C.obj.won ? xpGain(S, 4) : 0);\n  S.loot = { gold, xp: xpg,")
R("if (!S.camp && !['fight', 'elite', 'boss'].includes(S.map[S.pos].type)) S.xp += K.nodeXp;", "if (!S.camp && !['fight', 'elite', 'boss'].includes(S.map[S.pos].type)) xpGain(S, K.nodeXp);")
R("const xpAt = (S, lv) => (S.camp ? CAMP_XP : XP_AT)[lv];", """const xpAt = (S, lv) => (S.camp ? CAMP_XP : XP_AT)[lv];
// catch-up: the level a party should be at this stop; below it, all XP is +50%
function expLevel(S) { const n = S.map[S.pos]; if (!n) return 1; const xs = S.map.filter(m => m.act === n.act).map(m => m.x), lo = Math.min(...xs), hi = Math.max(...xs), f = hi > lo ? (n.x - lo) / (hi - lo) : 0;
  return n.act === 1 ? 1 + 2 * f : n.act === 2 ? Math.min(4.5, 3 + 2 * f) : 4.5 + f; }
function curLevel(S) { const lv = S.party[0].level; if (lv >= maxLevel(S)) return lv; const a = xpAt(S, lv - 1), b = xpAt(S, lv); return lv + (S.xp - a) / (b - a); }
function xpGain(S, base) { const v = Math.round(base * (!S.camp && curLevel(S) < expLevel(S) ? K.catchUp : 1)); S.xp += v; return v; }""")
R("const K = { bigHp", "const K = { catchUp: 1.3, bigHp")
R("hp: 2.2, atk: 3.05,", "hp: 2.05, atk: 2.65,")
R("vetHp: 1.15,", "vetHp: 1.34,")
R("const K = { catchUp: 1.3, bigHp: 1,", "const K = { catchUp: 1.3, bigHp: 0.85,")
R("const ok = o.k === 'runner' ? !o.escaped : o.k === 'timed' ? C.round <= o.rounds : o.k === 'protect' ? up(C.units.find(u => u.npc)) : true;", "const ok = o.k === 'runner' ? !o.escaped : o.k === 'timed' ? C.round <= o.rounds : o.k === 'protect' ? up(C.units.find(u => u.npc)) : true; o.won = ok;")
R("  if (S.comp && !S.camp && n.act > S.comp.act) {", "  if (!S.camp && S.lastAct && n.act > S.lastAct) { for (const h of S.party) { const m0 = maxHp(h); h.wounds = 0; h.hp = Math.min(maxHp(h), h.hp + maxHp(h) - m0); } S.q.log.push({ t: 'A new act: every wound has healed.', good: true }); } if (!S.camp) S.lastAct = n.act;\n  if (S.comp && !S.camp && n.act > S.comp.act) {")
# fewer, sturdier enemies; lieutenants beside the boss
R("clamp(n + (S.stats.fights >= 3 && rnd(S) < 0.3 + 0.1 * Math.min(3, P) ? 1 : 0)", "clamp(n - 1 + (S.stats.fights >= 3 && rnd(S) < 0.3 + 0.1 * Math.min(3, P) ? 1 : 0)", 2)
R("if (kind === 'boss') { list.push(S.q.boss); for (let k = 0; k < Math.max(0, n - 2) + more; k++) list.push(pick(S, pool)); }", "if (kind === 'boss') { list.push(S.q.boss); const lt = (BOSSP[S.q.boss] || {}).lt || []; for (let k = 0; k < Math.max(0, n - 2) + more; k++) list.push(lt[k] || pick(S, pool)); }")
# hold reinforcements and companions join the timeline
R("const u = enemyUnit(S, pick(S, pool), C.lv, C.nextId++, C.n); C.units.push(u); say(C, `More of them arrive: ${u.name}.`);", "const u = prep(S, C, enemyUnit(S, pick(S, pool), C.lv, C.nextId++, C.n)); u.next = C.time + delayOf(u, 'n'); C.units.push(u); say(C, `More of them arrive: ${u.name}.`);")
R("return { id: 'c0', side: 'H', comp: true, name: c.n,", "return { id: 'c0', side: 'H', comp: true, cls: c.cls, name: c.n,")
R("w: { die: w.die[t], sp: (w.sp ? w.sp[t] : 4 + t), hit: w.hit || 0, bonus: w.bonus || 0, fin: w.fin, ranged: w.ranged, reach: w.reach, phys: w.phys, bu: w.bu }, skills: c.sk.slice()", "w: { die: w.die[t], sp: (w.sp ? w.sp[t] : 4 + t), bonus: w.bonus || 0, fin: w.fin, ranged: w.ranged, reach: w.reach, phys: w.phys, stk: {} }, skills: c.sk.slice()")
R("w: 'bow', sk: ['aimed', 'knife'],", "w: 'bow', cls: 'rogue', sk: ['quickshot', 'venomarrow'],")
R("w: 'sword', sk: ['bash', 'taunt', 'sunder'],", "w: 'sword', cls: 'warrior', sk: ['heavy', 'shove', 'taunt'],")
R("w: 'staff', sk: ['mend', 'frost', 'gust'],", "w: 'staff', cls: 'priest', sk: ['mend', 'frostshard', 'spark'],")
R("w: 'axe', sk: ['trip', 'cleave'],", "w: 'axe', cls: 'warrior', sk: ['heavy', 'cleave'],")
open(p,'w').write(s)
print('ok')
