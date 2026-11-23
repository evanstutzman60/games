// combos1.js logic N diff part: single-adventure win rate for all 16 path combinations
const fs=require('fs');eval(fs.readFileSync(process.argv[2],'utf8')+`
const N=+process.argv[3]||60,DIFF=+process.argv[4]||0,PART=process.argv[5]||'all',party=['warrior','rogue','mage','priest'];
const subs=party.map(c=>Object.keys(CLASSES[c].subs));const out=[];
for(let m=0;m<16;m++){if(PART!=='all'&&(m%2)!==+PART)continue;const pk=party.map((c,i)=>subs[i][(m>>i)&1]);let w=0;
 for(let g=0;g<N;g++){const S=newRun(80000+g,party.map(c=>({cls:c,ctrl:'ai'})),DIFF);S.forceSub=pk;let n=0;while(S.screen!=='end'&&n++<40000)autoStep(S);if(S.result==='victory')w++}
 out.push([pk.join(' '),w/N])}
out.sort((a,b)=>b[1]-a[1]);for(const [p,r] of out)console.log((r*100).toFixed(0).padStart(3)+'%  '+p);`)
