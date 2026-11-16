const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
let shown=0;
for(let g=0;g<30&&shown<4;g++){const S=newGame(5000+g,-1);
 while(S.winner<0&&S.round<200){aiTurnAll(S);nextTurn(S);}
 if(S.winner>=0)continue;shown++;
 const tr=[0,0,0,0],na=[0,0,0,0],ships=[0,0,0,0];S.cells.forEach(c=>{if(c.army){tr[c.army.owner]+=c.army.count;na[c.army.owner]++;if(c.sea)ships[c.army.owner]++}});
 console.log('seed',5000+g,'alive',S.nations.map(n=>+n.alive).join(''),'troops',tr,'armies',na,'ships',ships,'pacts',S.pact.map(r=>r.map(Number).join('')).join(','));
 const ch=c=>c.t===4?' ':c.sea?(c.army?'s':'~'):c.t===2?'^':c.t===3?'|':c.army?String(c.army.owner):c.capital>=0?'C':c.town?'T':c.port?'P':c.bridge?'=':c.owner>=0?'abcd'[c.owner]:'.';
 for(let r=0;r<H;r++){console.log((r&1?' ':'')+S.cells.slice(r*W,r*W+W).map(ch).join(' '))}
 for(const n of S.nations){if(!n.alive)continue;const c=S.cells[n.cap];console.log(' cap',n.id,JSON.stringify(c.army))}
 console.log(S.log.slice(-5).join(' | '));
}`);
