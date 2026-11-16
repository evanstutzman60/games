const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
let shown=0;
for(let g=0;g<30&&shown<2;g++){const S=newGame(5000+g,-1);
 while(S.winner<0&&S.round<200){aiTurnAll(S);nextTurn(S);}
 if(S.winner>=0)continue;shown++;
 const sh=strengths(S);const al=S.nations.filter(n=>n.alive);const big=al.reduce((a,b)=>sh[a.id]>sh[b.id]?a:b).id;
 console.log('seed',5000+g,'shares',sh.map(x=>x.toFixed(2)).join(' '),'big',big);
 const ch=c=>c.t===4?' ':c.sea?(c.army?'s':'~'):c.t===2?'^':c.t===3?'|':c.army?String(c.army.owner):c.capital>=0?'C':c.town?'T':c.port?'P':c.bridge?'=':c.owner>=0?'abcd'[c.owner]:'.';
 for(let r=0;r<H;r++){console.log((r&1?' ':'')+S.cells.slice(r*W,r*W+W).map(ch).join(' '))}
 while(S.cur!==big)nextTurn(S);
 const cd=objectiveDist(S,big,true);
 const arm=[];S.cells.forEach((c,i)=>{if(c.army&&c.army.owner===big)arm.push([c.army.count,c.army.morale,cd[i],i])});arm.sort((a,b)=>b[0]-a[0]);console.log('armies cnt,mor,capDist,idx:',arm.slice(0,10).join(' | '));
 for(const n of al)console.log(' cap',n.id,n.cap,JSON.stringify(S.cells[n.cap].army));
 for(let k=0;k<5;k++){const m=aiPick(S,big);if(!m){console.log('no pick');break}console.log('pick',m.from,'->',m.to,JSON.stringify(S.cells[m.from].army),'target',JSON.stringify(S.cells[m.to].army),'capDist',cd[m.from],cd[m.to]);doMove(S,m.from,m.to)}
}`);
