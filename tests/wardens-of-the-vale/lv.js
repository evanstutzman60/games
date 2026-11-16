const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const cmd=process.argv[3];
// reference bot: mixed towers by road coverage, upgrades cheapest first, specializes, buys abilities. No spells, no hero, no early calls.
function refMod(i){const m=NO_MOD();let stars=Math.floor(2.4*i);const ks=['archer','mage','bomb','guard','spell'];let guard=0;
 while(stars>0&&guard++<60){let done=false;for(const k of ks){const n=m.tree[k];if(n<3&&TIER_COST[n]<=stars){m.tree[k]++;stars-=TIER_COST[n];done=true}}if(!done)break}return m}
function play(def,mod,seed,o){o=o||{};const G=newGame(def,mod,{seed,hard:o.hard,hero:o.hero});
 const order=SPOTS.map((p,i)=>{let c=0;for(let s=0;s<PL;s+=10){const [px,py]=at(s);if(Math.hypot(px-p[0],py-p[1])<=140)c+=10}return [i,c]}).sort((a,b)=>b[1]-a[1]).map(x=>x[0]);
 const types=o.types||['archer','guard','mage','archer','bomb','mage'];const plan=order.map((s,k)=>[s,types[k%types.length]]);let pi=0,acc=0;callWave(G);
 while(!G.over&&G.t<2400){step(G,1/30);acc+=1/30;if(acc<0.5)continue;acc=0;
  for(let g=0;g<8;g++){ if(pi<plan.length){const [s,t]=plan[pi];if(G.gold>=price(G,t,TOWERS[t].cost[0])){build(G,s,t);pi++;continue} if(pi<4)break;}
   let best=null,bc=1e9;G.towers.forEach((tw,i)=>{if(!tw)return;if(tw.lvl<2){const c=upgradeCost(G,i);if(c<bc){bc=c;best=()=>upgrade(G,i)}}
     else if(tw.lvl===2){const sp=o.spec!==undefined?o.spec:i%2;const c=upgradeCost(G,i,sp);if(c<bc){bc=c;best=()=>upgrade(G,i,sp)}}
     else for(let a=0;a<2;a++)if(tw.ab[a]<2){const c=TOWERS[tw.type].spec[tw.spec].abil[a].cost[tw.ab[a]];if(c<bc){bc=c;best=()=>buyAbility(G,i,a)}}});
   if(best&&G.gold>=bc){best();continue}break;}
  if(o.early&&G.nextIn!==null&&G.nextIn>0&&G.foes.length<4&&!G.spawnQ.length)callWave(G);
  if(o.spells){if(G.cd.fire<=0){let b=null,bn=3;for(const e of G.foes){const n=G.foes.filter(f=>Math.hypot(f.x-e.x,f.y-e.y)<60).length;if(n>bn){bn=n;b=e}}if(b)castFire(G,b.x,b.y)}
   if(G.cd.reinf<=0&&G.foes.length){const lead=G.foes.filter(e=>!e.fly).sort((a,b)=>b.s-a.s)[0];if(lead)castReinf(G,...at(lead.s+40))}}
  if(G.hero){const lead=G.foes.filter(e=>!e.fly||G.hero.cls!=='knight').sort((a,b)=>b.s-a.s)[0];if(lead){const [hx,hy]=at(Math.min(PL-60,lead.s+50),G.hero.cls==='knight'?0:40);moveHero(G,hx,hy)}heroCast(G)}
 }
 return G;}
const run=(def,mod,o,n)=>{let w=0,l=0,st=0,t=0;for(let s=1;s<=n;s++){const G=play(def,mod,s,o);if(G.won){w++;st+=stars(G)}l+=G.lives;t+=G.t}return{w,l:l/n,st:st/n,t:t/n/60}};
if(cmd==='maps'){for(let i=0;i<8;i++){const d=campaignLevel(i);console.log(i+1,LEVELS[i].name.padEnd(18),'road',d.pl.toFixed(0),'spots',d.spots.length,'waves',d.waves.length,'gold',d.gold,'| last wave:',d.waves[d.waves.length-1].map(g=>g[1]+' '+g[0]).join(', '));}
 let bad=0,ms=Date.now();for(let s=1;s<=300;s++){const d=genLevel(s,1+s%8,1);if(d.spots.length<10||d.pl<1300||d.path.length<4)bad++;}console.log('300 random maps: unusable',bad,'ms each',((Date.now()-ms)/300).toFixed(1));}
const KIT={spells:1,early:1,hero:'knight'};
if(cmd==='calib'){const out=[];for(let i=0;i<8;i++){let lo=0.4,hi=8,k=1;for(let it=0;it<9;it++){k=(lo+hi)/2;LEVELS[i].k=k;const r=run(campaignLevel(i),refMod(i),KIT,6);if(r.l>11)lo=k;else hi=k;}
  LEVELS[i].k=+((lo+hi)/2).toFixed(2);const r=run(campaignLevel(i),refMod(i),KIT,10);out.push(LEVELS[i].k);console.log(i+1,'k',LEVELS[i].k,'full-kit bot wins',r.w+'/10','avg lives',r.l.toFixed(1),'minutes',r.t.toFixed(1));}
 console.log('K='+JSON.stringify(out));}
if(cmd==='check'){for(let i=0;i<8;i++){const d=campaignLevel(i),m=refMod(i);const a=run(d,m,{},8),b=run(d,m,{spells:1,early:1,hero:'knight'},8),c=run(d,NO_MOD(),{spells:1,early:1,hero:'knight'},8),h=run(d,m,{spells:1,early:1,hero:'knight',hard:1},8);
  console.log(i+1,'ref (no spells/hero):',a.w+'/8',a.l.toFixed(1),'| full kit:',b.w+'/8','lives',b.l.toFixed(1),'stars',b.st.toFixed(1),'| full kit, no star upgrades:',c.w+'/8',c.l.toFixed(1),'| Veteran full kit:',h.w+'/8',h.l.toFixed(1),'|',a.t.toFixed(1)+'min');}}
if(cmd==='mono'){const i=+process.argv[4]||4,d=campaignLevel(i),m=refMod(i);for(const [n,o] of [['mixed spec A',{spec:0}],['mixed spec B',{spec:1}],['archer only',{types:['archer']}],['mage only',{types:['mage']}],['bomb only',{types:['bomb']}],['guard only',{types:['guard']}],['archer+mage',{types:['archer','mage']}],['no guard',{types:['archer','mage','bomb']}]]){const r=run(d,m,Object.assign(process.argv[5]==='kit'?{spells:1,early:1}:{},o),8);console.log(('level '+(i+1)+' '+n).padEnd(24),'wins',r.w+'/8','lives',r.l.toFixed(1));}}
if(cmd==='hero'){const i=+process.argv[4]||3,d=campaignLevel(i);for(const h of [null,'knight','ranger','mage']){const m=refMod(i);m.hero={knight:3,ranger:3,mage:3};const r=run(d,m,{hero:h,spells:1,early:1},6),r0=run(d,refMod(i),{hero:h,spells:1,early:1},6);console.log('level',i+1,'hero',String(h).padEnd(7),'no hero tree: lives',r0.l.toFixed(1),'| full hero tree: lives',r.l.toFixed(1));}}
`);
eval(logic+`
if(process.argv[3]==='rich'){const i=5,base=campaignLevel(i);
 for(const sp of [0,1]){let wins=0,lives=0,ab=0,l4=0;for(let s=1;s<=6;s++){const d=Object.assign({},base,{gold:6000,k:base.k*3.2});const G=newGame(d,NO_MOD(),{seed:s});
   const order=SPOTS.map((p,j)=>j);const types=['archer','guard','mage','bomb'];order.forEach((j,k)=>{build(G,j,types[k%4]);upgrade(G,j);upgrade(G,j);if(k<8){upgrade(G,j,sp);buyAbility(G,j,0);buyAbility(G,j,0);buyAbility(G,j,1);buyAbility(G,j,1)}});
   G.towers.forEach(t=>{if(t&&t.lvl===3){l4++;ab+=t.ab[0]+t.ab[1]}});callWave(G);while(!G.over&&G.t<2400)step(G,1/30);if(G.won)wins++;lives+=G.lives;
   for(const e of G.foes)if(!(e.hp===e.hp)||!(e.s===e.s))throw new Error('NaN enemy');for(const m of G.men)if(!(m.hp===m.hp)||!(m.x===m.x))throw new Error('NaN man');}
  console.log('level 6 at 3.2x enemy health, 8 level-4 towers, path',sp?'B':'A','| level-4 towers',l4/6,'abilities',ab/6,'| wins',wins+'/6','avg lives',(lives/6).toFixed(1));}}
`);
