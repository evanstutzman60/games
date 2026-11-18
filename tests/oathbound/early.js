// early.js logic N party diff: share of runs wiped within the first 1/2/3 fights
const fs=require('fs');let src=fs.readFileSync(process.argv[2],'utf8');
eval(src+`
const N=+process.argv[3]||200,party=(process.argv[4]||'warrior,rogue,mage,priest').split(','),DIFF=+process.argv[5]||0;
const NOV=+process.env.NOVICE||0;if(NOV){const _ai=aiHero;aiHero=function(S,C,u){if(u.npc||u.comp||Math.random()>NOV)return _ai(S,C,u);const opts=[];for(const id of ['attack',...u.skills]){if(!usable(C,u,id))continue;for(const t of targetsFor(C,u,SK[id]))opts.push({k:'skill',id,t})}return opts.length?opts[Math.floor(Math.random()*opts.length)]:_ai(S,C,u)}}
const d=[0,0,0,0,0,0],NM={};const C_n=C=>C.units.filter(u=>u.side==='E').map(u=>u.key).join('+');let hpAfter1=0,c1=0;
for(let g=0;g<N;g++){const S=newRun(5000+g,party.map((c,i)=>({cls:c,name:'H'+i,ctrl:'ai'})),DIFF);let n=0,f=0,was=false;
 while(S.screen!=='end'&&f<6&&n++<20000){const inC=S.screen==='combat';if(inC&&S.C)S._cn=(S.C.name||'?')+'/'+S.C.kind+'/'+C_n(S.C);autoStep(S);if(inC&&S.screen!=='combat'){f++;if(f===1&&S.screen!=='end'){hpAfter1+=S.party.reduce((a,h)=>a+h.hp/maxHp(h),0)/S.party.length;c1++}}}
 if(S.screen==='end'&&S.result!=='victory'&&f<=6){d[Math.max(0,f-1)]++;if(f<=3){NM[S._cn]=(NM[S._cn]||0)+1}}}
console.log(Object.entries(NM).sort((a,b)=>b[1]-a[1]).slice(0,12).map(x=>x.join(':')).join(' | '));
console.log(party.join(','),'diff',DIFF,'wiped in fight 1..6:',d.map(x=>(x/N*100).toFixed(0)+'%').join(' '),'| avg hp after fight 1',(hpAfter1/c1*100).toFixed(0)+'%')`)
