const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
for(let g=0;g<30;g++){const t=Date.now();const S=newGame(1000+g,-1);
 while(S.winner<0&&S.round<200){aiTurnAll(S);nextTurn(S);}
 const tr=[0,0,0,0];let na=0;for(const c of S.cells)if(c.army){tr[c.army.owner]+=c.army.count;na++}
 console.log(g,'winner',S.winner,'round',S.round,'alive',S.nations.map(n=>+n.alive).join(''),'troops',tr,'armies',na,'pacts',JSON.stringify(S.pact.map(r=>r.map(Number).join(''))),Date.now()-t,'ms');
 
}`);
