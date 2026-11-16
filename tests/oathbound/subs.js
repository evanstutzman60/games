// Veteran campaign win rate (chapters 3 to 5, first try) with one subclass forced. Usage: node subs.js <logic.js> <campaigns> <sub...>
const fs=require('fs');let src=fs.readFileSync(process.argv[2],'utf8');if(src.includes('// ===LOGIC-START==='))src=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(src+`
const N=+process.argv[3],party=['warrior','rogue','mage','priest'];
for(const SUB of process.argv.slice(4)){const ci=party.indexOf(Object.keys(CLASSES).find(c=>CLASSES[c].subs[SUB]));let w=0,t=0;
 for(let g=0;g<N;g++){const S=newCampaign(80000+g,party.map(c=>({cls:c,ctrl:'ai'})),1);S.forceSub=[];S.forceSub[ci]=SUB;const first={};let n=0;
  while(S.camp.ch<=5&&S.camp.wipes<20&&n++<300000){if(S.screen==='chapter'&&!first[S.camp.last.ch]){first[S.camp.last.ch]=1;if(S.camp.last.ch>=3){t++;if(S.camp.last.win)w++}}autoStep(S)}}
 console.log(SUB.padEnd(13),(w/t*100).toFixed(0)+'%')}
`);
