const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=+process.argv[3];const V=Object.assign({},AI_P,JSON.parse(process.argv[4]));const w={a:0,b:0,d:0};
for(let g=0;g<N;g++){const S=newGame(20000+g,-1);const A=g%2?[1,0,1,0]:[0,1,0,1];S.params=A.map(x=>x?V:AI_P);
 while(S.winner<0&&S.round<150){aiTurnAll(S);nextTurn(S);}
 if(S.winner<0)w.d++;else if(A[S.winner])w.a++;else w.b++;}
console.log(process.argv[4],'variant',w.a,'base',w.b,'draw',w.d);
`);
