const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic.replace('WAVE_REST = 12','WAVE_REST = '+(process.env.REST||12))+`
const HPK=+process.env.HPK||1,GK=+process.env.GK||1;for(const k in FOES){FOES[k].hp=Math.round(FOES[k].hp*HPK);FOES[k].gold=Math.round(FOES[k].gold*GK)}

if(process.argv[3]==='spots'){SPOTS.forEach(([x,y],i)=>{const n=nearestS(x,y);const near=SPOTS.filter(([a,b],j)=>j!==i&&Math.hypot(a-x,b-y)<60).length;let cover=0;for(let s=0;s<PL;s+=10){const [px,py]=at(s);if(Math.hypot(px-x,py-y)<=140)cover+=10}console.log(i,[x,y].join(','),'dist to road',n.d.toFixed(0),'road covered at range 140:',cover,near?'TOO CLOSE to another spot':'',(x<20||y<45||x>VW-20||y>VH-20)?'EDGE':'')});console.log('road length',PL.toFixed(0));process.exit()}
// bots: a build order of [spot, type], then upgrades; never use spells, never call early
const byCover=SPOTS.map((p,i)=>{let c=0;for(let s=0;s<PL;s+=10){const [px,py]=at(s);if(Math.hypot(px-p[0],py-p[1])<=140)c+=10}return [i,c]}).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
const plans={
 none:[],
 mixed:byCover.map((s,k)=>[s,['archer','guard','mage','bomb'][k%4]]),
 mixedNoGuard:byCover.map((s,k)=>[s,['archer','mage','bomb'][k%3]]),
 archer:byCover.map(s=>[s,'archer']),mage:byCover.map(s=>[s,'mage']),bomb:byCover.map(s=>[s,'bomb']),guard:byCover.map(s=>[s,'guard']),
 archerMage:byCover.map((s,k)=>[s,['archer','mage'][k%2]]),
};
function play(plan,seed,early,spells){const G=newGame(seed,process.env.HARD==='1');let pi=0,acc=0;callWave(G);
 while(!G.over&&G.t<1500){step(G,1/30);acc+=1/30;if(acc<0.5)continue;acc=0;
  // spend: next build in the plan, else cheapest upgrade
  for(let guard=0;guard<6;guard++){ if(pi<plan.length){const [s,t]=plan[pi];if(G.gold>=TOWERS[t].cost[0]){build(G,s,t);pi++;continue}
     // while saving for the next build, do not upgrade unless the plan is at least 6 towers in
     if(pi<6)break;}
    let best=-1,bc=1e9;G.towers.forEach((tw,i)=>{if(tw&&tw.lvl<2){const c=TOWERS[tw.type].cost[tw.lvl+1];if(c<bc){bc=c;best=i}}});if(best>=0&&G.gold>=bc){upgrade(G,best);continue}break;}
  if(early&&G.nextIn!==null&&G.nextIn>0&&G.foes.length<4&&!G.spawnQ.length)callWave(G);
  if(spells){if(G.cd.fire<=0){let b=null,bn=3;for(const e of G.foes){const n=G.foes.filter(f=>Math.hypot(f.x-e.x,f.y-e.y)<60).length;if(n>bn){bn=n;b=e}}if(b)castFire(G,b.x,b.y)}
   if(G.cd.reinf<=0&&G.foes.length){const lead=G.foes.filter(e=>!e.fly).sort((a,b)=>b.s-a.s)[0];if(lead)castReinf(G,...at(lead.s+40))}}
 }
 return G;}
for(const name of Object.keys(plans)){const res=[];for(let seed=1;seed<=20;seed++){const G=play(plans[name],seed,process.argv[3]==='early',process.argv[4]==='spells');res.push(G)}
 const wins=res.filter(g=>g.won).length,avgL=(res.reduce((a,g)=>a+g.lives,0)/res.length).toFixed(1),avgW=(res.reduce((a,g)=>a+g.wave+1,0)/res.length).toFixed(1);
 console.log(name.padEnd(13),'wins',String(wins).padStart(2)+'/20','avg lives',avgL.padStart(5),'avg wave reached',avgW,'avg time',(res.reduce((a,g)=>a+g.t,0)/res.length/60).toFixed(1)+'min');}
`);
