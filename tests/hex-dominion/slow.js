const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
for(let g=0;g<400;g++){const t=Date.now();const S=newGame(50000+g,-1);const sets=["mixed","troops","mixed","troops"];const perm=[0,1,2,3].map(k=>sets[(k+g)%4]);
 S.noInvest=perm.map(k=>k==='troops');let steps=0;
 while(S.winner<0&&S.round<200){const n=S.cur;aiDiplomacy(S,n);aiEconomy(S,n);let k=0;while(S.movesLeft>0&&S.winner<0){const m=pickFor(S,n);if(!m)break;const ev=doMove(S,m.from,m.to);if(!ev||++k>50){console.log('STUCK game',g,'round',S.round,'nation',n,'move',JSON.stringify(m),'ev',JSON.stringify(ev),'from',JSON.stringify(S.cells[m.from]),'to',JSON.stringify(S.cells[m.to]),'movesLeft',S.movesLeft);process.exit()}}
  if(S.winner<0)aiEndDiplomacy(S,n);nextTurn(S);if(Date.now()-t>8000){console.log('SLOW game',g,'round',S.round,'armies',S.cells.filter(c=>c.army).length);process.exit()}}
}console.log('all fine');`);
