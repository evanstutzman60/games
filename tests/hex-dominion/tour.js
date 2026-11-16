const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=+process.argv[3]||20;const mode=process.argv[4]||'mix';const w={1:0,2:0,d:0};const rounds=[];const pos=[0,0,0,0];let t0=Date.now(),riv=0,seaC=0,land=0;
for(let g=0;g<N;g++){const S=newGame(9000+g,-1);
 if(mode==='mix')S.ai=g%2?[1,2,1,2]:[2,1,2,1]; else S.ai=[+mode,+mode,+mode,+mode];
 S.cells.forEach(c=>{if(c.t===3||c.bridge)riv++;if(c.sea)seaC++;if(c.land)land++});
 while(S.winner<0&&S.round<200){aiTurnAll(S);nextTurn(S);}
 for(const c of S.cells){if(c.army){if(!(c.land||c.sea))throw new Error('terrain');if(c.land&&c.army.owner!==c.owner)throw new Error('owner');if(c.army.count<1||c.army.count>99||c.army.morale>c.army.count||c.army.morale<0)throw new Error('army')}if(!c.land&&c.owner>=0)throw new Error('owned')}
 if(S.winner<0)w.d++;else{w[S.ai[S.winner]]++;rounds.push(S.round);pos[(S.winner-S.first+4)%4]++}
}
rounds.sort((a,b)=>a-b);console.log(mode,'v1 wins',w[1],'v2 wins',w[2],'draws',w.d,'| by turn position',pos.join('/'),'| median rounds',rounds[rounds.length>>1],'| avg river+bridge',(riv/N).toFixed(1),'sea',(seaC/N).toFixed(0),'land',(land/N).toFixed(0),'|',((Date.now()-t0)/1000).toFixed(0)+'s');
`);
