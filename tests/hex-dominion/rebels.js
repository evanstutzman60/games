// What do holdouts actually do? Usage: node rebels.js <html> <games>
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=+process.argv[3]||40;let bands=0,sacks=0,repelled=0,fromNation=0,capLost=0,games=0,killed=0,endAlive=0,dr=0;
for(let g=0;g<N;g++){const S=newGame(310000+g,-1);S.ai=[3,2,3,2];let li=0;const seen=new Set();
 while(S.winner<0&&S.round<250){aiTurnAll(S);const alive=S.nations.filter(x=>x.alive).length;nextTurn(S);
  if(S.nations.filter(x=>x.alive).length!==alive)capLost++;
  for(;li<S.log.length;li++){const l=S.log[li];if(/^Rebels took a (town|port) from/.test(l)){sacks++;fromNation++}else if(/^Rebels occupied a free/.test(l))sacks++;else if(/repelled a Rebels attack/.test(l))repelled++;else if(/destroyed a Rebels/.test(l))killed++}
  for(const c of S.cells){if(c.army&&(c.army.count<1||c.army.count>99||c.army.morale<1||c.army.morale>5||(c.land&&c.army.owner!==c.owner)))throw new Error('bad state');if(c.army&&c.army.owner===4&&!seen.has(c.army)){seen.add(c.army);}}}
 bands+=seen.size;games++;if(S.winner<0)dr++;endAlive+=S.cells.filter(c=>c.army&&c.army.owner===4).length}
console.log('games',games,'draws',dr,'| rebel army objects seen',bands,'| towns sacked',sacks,'(from nations',fromNation+')','| assaults repelled',repelled,'| rebel armies destroyed',killed,'| nations eliminated during rebel phase',capLost,'| rebel armies left at end',endAlive);
`);
