// Which starting-geography features predict the winner? Features are taken relative to the map's own average,
// because what matters is being better off than the other three nations on the same map.
const fs = require('fs');
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
const useW = process.argv.find(a => a.startsWith('--weights='));
let names = null; const games = [];
for (const f of files) for (const line of fs.readFileSync(f, 'utf8').split('\n')) { if (!line) continue; const o = JSON.parse(line); if (o.names) names = o.names; else if (o.win >= 0) games.push(o); }
const F = names.length, G = games.length;
// relative features, then z-score across all nation-rows
const rel = games.map(g => g.f.map(r => r.map((v, j) => v - (g.f[0][j] + g.f[1][j] + g.f[2][j] + g.f[3][j]) / 4)));
const sd = names.map((_, j) => { let s = 0; for (const g of rel) for (const r of g) s += r[j] * r[j]; return Math.sqrt(s / (G * 4)) || 1; });
const X = rel.map(g => g.map(r => r.map((v, j) => v / sd[j])));
console.log(`games ${G}`);
// 1) one feature at a time: win rate of the nation with the highest vs lowest value on its map
const uni = names.map((nm, j) => { let hi = 0, lo = 0, n = 0;
  games.forEach((g, gi) => { const v = X[gi].map(r => r[j]); const mx = Math.max(...v), mn = Math.min(...v); if (mx - mn < 1e-9) return; n++;
    const his = v.map((x, k) => x === mx ? k : -1).filter(k => k >= 0), los = v.map((x, k) => x === mn ? k : -1).filter(k => k >= 0);
    if (his.includes(g.win)) hi += 1 / his.length; if (los.includes(g.win)) lo += 1 / los.length; });
  return { nm, hi: hi / n, lo: lo / n, n, sd: sd[j] }; });
// 2) all features together: conditional logit (softmax over the four nations), ridge-regularised, 5-fold cross-validated
function fit(idx, cols, l2 = 0.02) { const w = new Array(F).fill(0);
  for (let it = 0; it < 1500; it++) { const gr = new Array(F).fill(0);
    for (const gi of idx) { const u = X[gi].map(r => cols.reduce((s, j) => s + w[j] * r[j], 0)), m = Math.max(...u), e = u.map(x => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0);
      for (let k = 0; k < 4; k++) { const d = (k === games[gi].win ? 1 : 0) - e[k] / z; for (const j of cols) gr[j] += d * X[gi][k][j]; } }
    for (const j of cols) w[j] += 0.05 * (gr[j] / idx.length - l2 * w[j]); }
  return w; }
function score(idx, w) { let ll = 0, top = 0, bot = 0;
  for (const gi of idx) { const u = X[gi].map(r => r.reduce((s, v, j) => s + w[j] * v, 0)), m = Math.max(...u), e = u.map(x => Math.exp(x - m)), z = e.reduce((a, b) => a + b, 0);
    ll += Math.log(e[games[gi].win] / z); if (u.indexOf(m) === games[gi].win) top++; if (u.indexOf(Math.min(...u)) === games[gi].win) bot++; }
  return { ll: ll / idx.length, top: top / idx.length, bot: bot / idx.length }; }
const all = games.map((_, i) => i), cols = names.map((_, j) => j), geoCols = cols.filter(j => names[j] !== 'pos');
function cv(colset) { let ll = 0, top = 0, bot = 0; for (let k = 0; k < 5; k++) { const tr = all.filter(i => i % 5 !== k), te = all.filter(i => i % 5 === k), s = score(te, fit(tr, colset)); ll += s.ll / 5; top += s.top / 5; bot += s.bot / 5; } return { ll, top, bot }; }
const cAll = cv(cols), cGeo = cv(geoCols), cPos = cv([names.indexOf('pos')]);
const w = fit(all, cols);
console.log('\nfeature            sd     weight   best-on-map wins   worst-on-map wins');
names.map((nm, j) => ({ nm, j })).sort((a, b) => Math.abs(w[b.j]) - Math.abs(w[a.j])).forEach(({ nm, j }) =>
  console.log(nm.padEnd(14), sd[j].toFixed(2).padStart(6), w[j].toFixed(3).padStart(9), (uni[j].hi * 100).toFixed(1).padStart(12) + '%', (uni[j].lo * 100).toFixed(1).padStart(16) + '%'));
console.log(`\ncross-validated: chance = 25.0% / log-loss 1.386`);
console.log(`turn position only : model's favourite wins ${(cPos.top * 100).toFixed(1)}%, its least favoured ${(cPos.bot * 100).toFixed(1)}%, log-loss ${(-cPos.ll).toFixed(3)}`);
console.log(`geography only     : model's favourite wins ${(cGeo.top * 100).toFixed(1)}%, its least favoured ${(cGeo.bot * 100).toFixed(1)}%, log-loss ${(-cGeo.ll).toFixed(3)}`);
console.log(`geography + turn   : model's favourite wins ${(cAll.top * 100).toFixed(1)}%, its least favoured ${(cAll.bot * 100).toFixed(1)}%, log-loss ${(-cAll.ll).toFixed(3)}`);
const pos = [0, 0, 0, 0]; games.forEach(g => pos[g.f[g.win][names.indexOf('pos')]]++); console.log('wins by turn position', pos.map(x => (x / G * 100).toFixed(1) + '%').join(' / '));
fs.writeFileSync('tests/hex-dominion/weights.json', JSON.stringify({ names, sd, w }));
if (useW) { // score these games with weights fitted on another data set (out-of-sample check of a fix)
  const o = JSON.parse(fs.readFileSync(useW.split('=')[1], 'utf8')); let top = 0, bot = 0;
  games.forEach((g, gi) => { const u = rel[gi].map(r => r.reduce((s, v, j) => o.names[j] === 'pos' ? s : s + o.w[j] * v / o.sd[j], 0)); if (u.indexOf(Math.max(...u)) === g.win) top++; if (u.indexOf(Math.min(...u)) === g.win) bot++; });
  console.log(`old geography weights applied to these games: favourite wins ${(top / G * 100).toFixed(1)}%, least favoured ${(bot / G * 100).toFixed(1)}%`); }
