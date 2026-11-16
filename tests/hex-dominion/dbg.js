const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const S=newGame(1008,-1);
while(S.winner<0&&S.round<150){aiTurnAll(S);nextTurn(S);}
const cap=S.nations[3].cap;console.log('cap',cap,JSON.stringify(S.cells[cap]));
S.cells.forEach((c,j)=>{if(c.army&&hexDist(j,cap)<=4&&j!==cap)console.log(j,'d',hexDist(j,cap),JSON.stringify(c.army))});
while(S.cur!==2){nextTurn(S)}
const dist=objectiveDist(S,2);console.log('dists near',NB[cap].map(x=>x<0?-1:dist[x]));
for(let k=0;k<5;k++){const m=aiPick(S,2);console.log('pick',JSON.stringify(m),m&&JSON.stringify(S.cells[m.from].army),m&&hexDist(m.to,cap));if(!m)break;doMove(S,m.from,m.to)}
let tops=[];S.cells.forEach((c,j)=>{if(c.army&&c.army.owner===2)tops.push([c.army.count,c.army.morale,hexDist(j,cap)])});tops.sort((a,b)=>b[0]-a[0]);console.log(tops.slice(0,12).join(' | '));
`);
