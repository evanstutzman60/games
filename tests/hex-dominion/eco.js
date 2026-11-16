const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=+process.argv[3]||20;const mode=process.argv[4]||'all';const w={inv:0,no:0,d:0};const rounds=[];const pos=[0,0,0,0];let t0=Date.now();
const works={farm:0,mill:0,mine:0,fish:0};let burned=0;let techs=0,shops=0,walls=0,revolts=0,rebels=0,storms=0,cut=0,games=0,elim=0;
for(let g=0;g<N;g++){const S=newGame(30000+g,-1);
 const A=g%2?[1,0,1,0]:[0,1,0,1]; if(mode==='ab')S.noInvest=A.map(x=>!x);
 while(S.winner<0&&S.round<200){aiTurnAll(S);for(const c of S.cells)if(c.army&&c.army.cut)cut++;nextTurn(S);}
 for(const c of S.cells){if(c.army){if(!(c.land||c.sea))throw new Error('terrain');if(c.land&&c.army.owner!==c.owner)throw new Error('owner '+c.army.owner+' '+c.owner);if(c.army.count<1||c.army.count>99||c.army.morale>5||c.army.morale<1)throw new Error('army')}if(!c.land&&c.owner>=0)throw new Error('owned');if(c.owner===4&&!c.army){}}
 for(const n of S.nations){if(n.gold<0||n.fund<0)throw new Error('gold');techs+=techCount(n,'M')+techCount(n,'E')+techCount(n,'N')}
 S.cells.forEach(c=>{if(c.b)works[c.b]++;shops+=c.shop;walls+=c.walls;if(c.owner===4)rebels++});
 revolts+=S.log.filter(x=>x.includes('revolted')).length;burned+=S.log.filter(x=>x.includes('burned')).length;storms+=S.log.filter(x=>x.includes('stormed')||x.includes('threw back')).length;elim+=S.nations.filter(n=>!n.alive).length;
 games++;
 if(S.winner<0)w.d++;else{rounds.push(S.round);pos[(S.winner-S.first+4)%4]++; if(mode==='ab'){if(A[S.winner])w.inv++;else w.no++}}
}
rounds.sort((a,b)=>a-b);console.log(mode,'decided',rounds.length,'draws',w.d,mode==='ab'?('| investors '+w.inv+' vs troops-only '+w.no):'','| position',pos.join('/'),'| median rounds',rounds[rounds.length>>1],'| per game: techs',(techs/games).toFixed(1),'shops',(shops/games).toFixed(1),'walls',(walls/games).toFixed(1),'revolts',(revolts/games).toFixed(1),'wall assaults',(storms/games).toFixed(1),'rebel towns left',(rebels/games).toFixed(1),'cut-off army-turns',(cut/games).toFixed(0),'eliminations',(elim/games).toFixed(1),'works standing at end',JSON.stringify(works),'burned',(burned/games).toFixed(1),'|',((Date.now()-t0)/1000).toFixed(0)+'s');
`);
