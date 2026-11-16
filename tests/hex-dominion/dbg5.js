const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
for(let g=0;g<14;g++){const S=newGame(5000+g,-1);const tr=[];let lastR=0;let fights=0,capAtt=0;
 while(S.winner<0&&S.round<200){const L=S.log.length;aiTurnAll(S);nextTurn(S);if(S.round%50===0&&S.round!==lastR){lastR=S.round;tr.push(strengths(S).map(x=>x.toFixed(2)).join('/')+' p'+S.pact.flat().filter(Boolean).length/2)}}
 const caps=S.nations.filter(n=>n.alive).map(n=>{const a=S.cells[n.cap].army;return n.id+':'+(a?a.count+'/'+a.morale:'empty')}).join(' ');
 let mor=0,cnt=0,na=0;S.cells.forEach(c=>{if(c.army){mor+=c.army.morale;cnt+=c.army.count;na++}});
 console.log(5000+g,S.winner<0?'STALE':'win@'+S.round,tr.join('  '),'| caps',caps,'| avg size',(cnt/na).toFixed(0),'avg morale',(mor/na).toFixed(0));
}`);
