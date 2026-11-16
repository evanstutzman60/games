const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=+process.argv[3]||30;const wins={};const rounds=[];let sea=0,t0=Date.now(),maxCapTurtle=0,genMs=0;
for(let g=0;g<N;g++){const tg=Date.now();const S=newGame(5000+g,-1);genMs+=Date.now()-tg;let seaMoves=0;
 // symmetry + sanity
 S.cells.forEach((c,i)=>{if(c.t!==4)sym(i).forEach(y=>{const d=S.cells[y];if(d.t!==c.t||d.town!==c.town||d.port!==c.port||d.bridge!==c.bridge)throw new Error('asym '+g)})});
 while(S.winner<0&&S.round<200){aiTurnAll(S);for(const c of S.cells){if(c.army&&c.sea)seaMoves++;}nextTurn(S);}
 for(const c of S.cells){if(c.army){if(!(c.land||c.sea))throw new Error('army on bad terrain');if(c.land&&c.army.owner!==c.owner)throw new Error('owner');if(c.army.count<1||c.army.count>99||c.army.morale>c.army.count||c.army.morale<0)throw new Error('bad army')}if(!c.land&&c.owner>=0)throw new Error('owned nonland')}
 const pos=S.winner<0?-1:(S.winner-S.first+4)%4;wins[pos]=(wins[pos]||0)+1;if(S.winner>=0)rounds.push(S.round);if(seaMoves)sea++;
}
rounds.sort((a,b)=>a-b);console.log('wins',JSON.stringify(wins),'median',rounds[rounds.length>>1],'p90',rounds[(rounds.length*0.9)|0],'games with ships',sea,'genMs',genMs,'total s',(Date.now()-t0)/1000);
`);
