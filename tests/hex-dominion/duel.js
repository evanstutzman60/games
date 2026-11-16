// Head-to-head: two seats play AI level A, two play level B, alternating which seats. Usage: node duel.js <html> <games> <A> <B> [seedBase] [json feature flags for level-3 seats]
const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const N=+process.argv[3]||60,A=+process.argv[4]||3,B=+process.argv[5]||2,base=+process.argv[6]||600000,flags=process.argv[7]?Object.assign({},NOVET,JSON.parse(process.argv[7])):null;
let wa=0,wb=0,dr=0;const rounds=[];const t0=Date.now();
for(let g=0;g<N;g++){const S=newGame(base+g,-1);const seat=g%2?[A,B,A,B]:[B,A,B,A];S.ai=seat;if(flags)S.vet=seat.map(()=>flags);
 while(S.winner<0&&S.round<250){aiTurnAll(S);nextTurn(S);}
 for(const c of S.cells)if(c.army&&(c.army.count<1||c.army.count>99||c.army.morale<1||c.army.morale>5||(c.land&&c.army.owner!==c.owner)))throw new Error('bad state');
 if(S.winner<0)dr++;else{rounds.push(S.round);if(seat[S.winner]===A)wa++;else wb++}}
rounds.sort((a,b)=>a-b);const dec=wa+wb;
console.log((process.argv[7]||'all features').padEnd(34),'level',A,'wins',wa,'| level',B,'wins',wb,'| draws',dr,'| share',(wa/dec*100).toFixed(0)+'%','| median rounds',rounds[rounds.length>>1],'|',((Date.now()-t0)/1000).toFixed(0)+'s');
`);
