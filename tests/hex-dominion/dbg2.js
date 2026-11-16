const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const S=newGame(+process.argv[3],-1);
while(S.winner<0&&S.round<150){aiTurnAll(S);nextTurn(S);}
const al=S.nations.filter(n=>n.alive);const sh=strengths(S);const big=al.reduce((a,b)=>sh[a.id]>sh[b.id]?a:b).id;
for(const v of al){if(v.id===big)continue;const cap=v.cap;console.log('victim',v.id,'cap',JSON.stringify(S.cells[cap].army),'pact',S.pact[big][v.id]);
S.cells.forEach((c,j)=>{if(c.army&&hexDist(j,cap)<=3&&j!==cap)console.log('  ',j,'d',hexDist(j,cap),c.army.owner,c.army.count,c.army.morale)});}
while(S.cur!==big){nextTurn(S)}
for(let k=0;k<5;k++){const m=aiPick(S,big);console.log('pick',JSON.stringify(m),m&&JSON.stringify(S.cells[m.from].army),m&&S.cells[m.to].army&&JSON.stringify(S.cells[m.to].army));if(!m)break;doMove(S,m.from,m.to)}
`);
