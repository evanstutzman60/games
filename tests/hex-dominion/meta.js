const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=+process.argv[3]||200;
const FOC={workshops:['shop','walls'],works:['mine','fish','farm','mill','walls'],tech:['techM','techE','techN','walls'],techM:['techM','walls'],techE:['techE','walls'],techN:['techN','walls'],eco:['shop','mine','fish','farm','mill','walls'],ecoM:['shop','mine','fish','farm','mill','walls','techM'],mixed:null,troops:'none'};
const sets=JSON.parse(process.argv[4]);const wins={};sets.forEach(k=>wins[k]=0);let draws=0;const built={};const ore=[],mt=[];let rounds=[];
for(let g=0;g<N;g++){const S=newGame(50000+g,-1);const perm=[0,1,2,3].map(k=>sets[(k+g)%4]);
 S.only=perm.map(k=>FOC[k]==='none'?null:FOC[k]);S.noInvest=perm.map(k=>FOC[k]==='none');
 ore.push(S.cells.filter(c=>c.ore).length);mt.push(S.cells.filter(c=>c.t===2).length);
 while(S.winner<0&&S.round<200){aiTurnAll(S);nextTurn(S);}
 S.cells.forEach(c=>{if(c.b)built[c.b]=(built[c.b]||0)+1;if(c.shop)built.shop=(built.shop||0)+c.shop});
 if(S.winner<0)draws++;else{wins[perm[S.winner]]++;rounds.push(S.round)}}
rounds.sort((a,b)=>a-b);const avg=a=>(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1);
console.log(JSON.stringify(wins),'draws',draws,'median rounds',rounds[rounds.length>>1],'| ore sites/map',avg(ore),'min',Math.min(...ore),'mountain hexes/map',avg(mt),'| standing at end per game',Object.entries(built).map(([k,v])=>k+' '+(v/N).toFixed(1)).join(', '));
`);
