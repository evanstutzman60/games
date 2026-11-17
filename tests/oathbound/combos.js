// Every combination of the four subclasses (Warrior, Rogue, Mage, Priest) in campaign play.
// Reports first-try win rate over chapters 3 to 5 (after paths are chosen). Usage: node combos.js <logic.js> <campaigns> [diff] [part 0|1|all]
const fs=require('fs');let src=fs.readFileSync(process.argv[2],'utf8');if(src.includes('// ===LOGIC-START==='))src=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(src+`
if(process.env.SUBFX)Object.assign(SUBFX,JSON.parse(process.env.SUBFX));const N=+process.argv[3]||60,DIFF=+process.argv[4]||0,PART=process.argv[5]||'all',party=['warrior','rogue','mage','priest'];
const subs=party.map(c=>Object.keys(CLASSES[c].subs));const out=[];
for(let m=0;m<16;m++){if(PART!=='all'&&(m%2)!==+PART)continue;const pick=party.map((c,i)=>subs[i][(m>>i)&1]);let w=0,t=0,wipes=0;
 for(let g=0;g<N;g++){const S=newCampaign(60000+g,party.map(c=>({cls:c,ctrl:'ai'})),DIFF);S.forceSub=pick;const first={};let n=0;
  while(S.camp.ch<=5&&S.camp.wipes<20&&n++<300000){if(S.screen==='chapter'&&!first[S.camp.last.ch]){first[S.camp.last.ch]=1;if(S.camp.last.ch>=3){t++;if(S.camp.last.win)w++}}autoStep(S)}wipes+=S.camp.wipes}
 out.push([pick.join(' '),w/t,wipes/N])}
out.sort((a,b)=>b[1]-a[1]);for(const [p,r,wp] of out)console.log((r*100).toFixed(0).padStart(3)+'%  wipes '+wp.toFixed(1).padStart(4)+'  '+p);
`);
