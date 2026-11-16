const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
let logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=60,built={},burned={},lost={},sites={ore:0};let oreOwnedTurns=0,oreReachTurns=0;
const _build=build;build=function(S,n,i,what){const r=_build(S,n,i,what);if(r)built[what]=(built[what]||0)+1;return r};
const _pill=pillage;pillage=function(S,c,n){burned[c.b]=(burned[c.b]||0)+1;return _pill(S,c,n)};
let mineAfford=0,mineAvail=0,turns=0,firstMine=[];
for(let g=0;g<N;g++){const S=newGame(400000+g,-1);sites.ore+=S.cells.filter(c=>c.ore).length;let fm=-1;
 while(S.winner<0&&S.round<250){const n=S.cur;turns++;
  if(S.cells.some((c,i)=>c.ore&&!c.b&&buildCost(S,n,i,'mine')>=0))mineAvail++;
  const before=built.mine||0;aiTurnAll(S);if(fm<0&&(built.mine||0)>before)fm=S.round;
  const alive=new Set(S.nations.filter(x=>x.alive).map(x=>x.id));nextTurn(S);}
 if(fm>=0)firstMine.push(fm);}
firstMine.sort((a,b)=>a-b);
console.log('per game, built:',Object.entries(built).map(([k,v])=>k+' '+(v/N).toFixed(1)).join(', '));
console.log('per game, burned:',Object.entries(burned).map(([k,v])=>k+' '+(v/N).toFixed(1)).join(', '));
console.log('ore sites per map',(sites.ore/N).toFixed(1),'| share of AI turns with an open ore site in reach',(mineAvail/turns*100).toFixed(0)+'%','| games with any mine',firstMine.length+'/'+N,'median round of first mine',firstMine[firstMine.length>>1]);
`);
