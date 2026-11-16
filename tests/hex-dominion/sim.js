const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
const wins=[0,0,0,0];let stale=0,rounds=[];
eval(logic+`
for(let g=0;g<200;g++){const S=newGame(1000+g,-1);
 while(S.winner<0&&S.round<400){aiTurnAll(S);nextTurn(S);}
 if(S.winner<0)stale++;else{wins[S.winner]++;rounds.push(S.round);}
 // invariants
 for(const c of S.cells){if(c.army&&(c.army.owner!==c.owner||c.army.count<1||c.army.count>99||c.army.morale>c.army.count||c.army.morale<0))throw new Error('bad army '+JSON.stringify(c));}
}`);
rounds.sort((a,b)=>a-b);
console.log('wins',wins,'stalemates',stale,'median rounds',rounds[rounds.length>>1],'max',rounds[rounds.length-1]);
