// Campaign simulation with an all-AI party. Usage: node simc.js <logic.js|index.html> <campaigns> [party] [diff] [chapters to play, default 5]
const fs=require('fs');let src=fs.readFileSync(process.argv[2],'utf8');if(src.includes('// ===LOGIC-START==='))src=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(src+`
const N=+process.argv[3]||40,party=(process.argv[4]||'warrior,rogue,mage,priest').split(','),DIFF=+process.argv[5]||0,CH=+process.argv[6]||5;if(process.env.KC)K.campLv=process.env.KC.split(',').map(Number);
const tries=Array(CH+1).fill(0),first=Array(CH+1).fill(0),wins=Array(CH+1).fill(0),lvl=Array(CH+1).fill(0),gold=Array(CH+1).fill(0),tier=Array(CH+1).fill(0),fights=Array(CH+1).fill(0);let saga=0,wipes=0,steps=0,sets3=0;const t0=Date.now();
for(let g=0;g<N;g++){const S=newCampaign(9000+g,party.map((c,i)=>({cls:c,name:CLASSES[c].n+i,ctrl:'ai'})),DIFF);let n=0,att={},f0=0;
 while(S.camp.ch<=CH&&S.camp.wipes<12){const sc=S.screen;
  if(sc==='town'&&S.shop&&!S._t){}
  if(sc==='chapter'&&!S._seen){const L=S.camp.last,c=L.ch;att[c]=(att[c]||0)+1;tries[c]++;if(L.win){wins[c]++;if(att[c]===1)first[c]++;lvl[c]+=S.party[0].level;gold[c]+=S.gold;tier[c]+=S.party.reduce((a,h)=>a+h.gear.w.tier,0)/S.party.length;fights[c]+=S.stats.fights-f0}f0=S.stats.fights}
  if(!autoStep(S))throw new Error('stuck on '+S.screen+' seed '+(9000+g)+' ch '+S.camp.ch);
  if(++n>300000)throw new Error('loop '+S.screen);
  if(S.screen!=='combat')for(const h of S.party)if(!(h.hp>=0)||h.hp>maxHp(h)||h.eq.length>4)throw new Error('bad hero '+JSON.stringify(h))}
 JSON.parse(JSON.stringify(S));if(S.camp.ch>CH)saga++;wipes+=S.camp.wipes;steps+=n;for(const h of S.party)for(const k in SETS)if(setCount(h,k)===SETS[k].pieces.length)sets3++}
console.log(party.join(','),DIFF?'VETERAN':'standard','| finished',saga+'/'+N,'| wipes per campaign',(wipes/N).toFixed(1),'| full sets worn at end',(sets3/N).toFixed(2),'|',((Date.now()-t0)/1000).toFixed(0)+'s');
for(let c=1;c<=CH;c++)console.log('  chapter',c,'first-try win',(first[c]/Math.max(1,N)*100).toFixed(0)+'%','| attempts',tries[c],'| level after',(lvl[c]/Math.max(1,wins[c])).toFixed(1),'| fights',(fights[c]/Math.max(1,wins[c])).toFixed(1),'| gold',(gold[c]/Math.max(1,wins[c])).toFixed(0),'| weapon quality',(tier[c]/Math.max(1,wins[c])).toFixed(1));
`);
