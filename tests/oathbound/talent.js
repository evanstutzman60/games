// Talent pair test: for one subclass, forces each choice at each talent level and compares campaign results on the same seeds.
// Usage: node talent.js <logic.js> <sub> <campaigns> [diff]
const fs=require('fs');let src=fs.readFileSync(process.argv[2],'utf8');if(src.includes('// ===LOGIC-START==='))src=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(src+`
const SUB=process.argv[3],N=+process.argv[4]||60,DIFF=process.argv[5]===undefined?1:+process.argv[5],party=['warrior','rogue','mage','priest'];
const ci=party.indexOf(Object.keys(CLASSES).find(c=>CLASSES[c].subs[SUB]));
function run(k,c){let w=0,t=0,wipes=0;for(let g=0;g<N;g++){const S=newCampaign(70000+g,party.map(c=>({cls:c,ctrl:'ai'})),DIFF);S.forceSub=[];S.forceSub[ci]=SUB;S.forceTal=[];S.forceTal[ci]=[];S.forceTal[ci][k]=c;
 const first={};let n=0;while(S.camp.ch<=5&&S.camp.wipes<20&&n++<300000){if(S.screen==='chapter'&&!first[S.camp.last.ch]){first[S.camp.last.ch]=1;if(S.camp.last.ch>=3){t++;if(S.camp.last.win)w++}}autoStep(S)}wipes+=S.camp.wipes}
 return [w/t,wipes/N]}
const out=[];for(let k=0;k<5;k++){const a=run(k,0),b=run(k,1),T=TALENTS[SUB][k];out.push('  L'+(k+6)+' '+T[0][0].padEnd(18)+(a[0]*100).toFixed(0).padStart(3)+'% '+a[1].toFixed(1)+' wipes | '+T[1][0].padEnd(18)+(b[0]*100).toFixed(0).padStart(3)+'% '+b[1].toFixed(1)+' wipes | gap '+((a[0]-b[0])*100).toFixed(0))}
console.log(SUB+' (chapters 3 to 5, first-try win rate)');console.log(out.join('\\n'));
`);
