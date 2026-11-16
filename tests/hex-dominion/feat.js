const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
let ok=0;const T=(name,c)=>{if(!c)throw new Error('FAIL '+name);ok++};
for(let seed=1;seed<=30;seed++){const S=newGame(seed,0);const n=S.cur,N=S.nations[n],cap=N.cap,cells=S.cells;N.gold=500;
 // roads: a 3-hex road out of the capital extends reach
 const base=reachable(S,cap).res.size;
 const n1=NB[cap].find(x=>x>=0&&cells[x].land);const n2=NB[n1].find(x=>x>=0&&cells[x].land&&hexDist(cap,x)===2&&!cells[x].army);
 T('road1',build(S,n,cap,'road')&&build(S,n,n1,'road'));
 if(n2!==undefined&&cells[n2].owner===n){T('road2',build(S,n,n2,'road'));const want=NB[n2].some(x=>x>=0&&cells[x].land&&hexDist(cap,x)===3&&!blocked(S,n,cells[x]));
  const far=[...reachable(S,cap).res.keys()].some(k=>hexDist(cap,k)===3);T('road reach',far===want);}
 T('tower',buildCost(S,n,n1,'tower')>0&&build(S,n,n1,'tower')&&cells[n1].tower&&buildCost(S,n,n1,'tower')<0);
 T('walls',build(S,n,cap,'walls')&&cells[cap].walls===3&&buildCost(S,n,cap,'walls')<0);
 T('shop',build(S,n,cap,'shop')&&build(S,n,cap,'shop')&&buildCost(S,n,cap,'shop')<0);
 const g0=N.gold;T('recruit',recruit(S,n,cap,5)===5&&N.gold===g0-5);
 T('research',research(S,n,'N',2)&&!research(S,n,'N',0)&&N.tech.N[2]&&techCost(N,'N')===25);N.researched=false;N.tech={M:[1,1,1,1],E:[1,1,1,1],N:[1,1,1,1]};
 // every reachable move for every army executes without error, incl. pass-through terrain and embarking anywhere
 for(let r=0;r<12&&S.winner<0;r++){const m=S.cur;S.nations[m].tech={M:[1,1,1,1],E:[1,1,1,1],N:[1,1,1,1]};S.nations[m].gold+=50;aiEconomy(S,m);
   cells.forEach((c,i)=>{if(c.army&&c.army.owner===m&&movers(S,i)>0&&S.movesLeft>0){const {res}=reachable(S,i,movers(S,i));const ks=[...res.keys()];if(ks.length){const to=ks[(S.rng()*ks.length)|0];T('dest ok',cells[to].land||cells[to].sea);const ev=doMove(S,i,to);T('move',ev);}}});
   cells.forEach(c=>{if(c.army)T('army terrain',c.land||c.sea);if(c.army&&c.land)T('own',c.army.owner===c.owner);if(c.army)T('morale',c.army.morale>=1&&c.army.morale<=5&&c.army.count>=1&&c.army.count<=99)});
   // bridge + port builds wherever legal
   S.nations[m].gold+=100;let b=cells.findIndex((c,i)=>buildCost(S,m,i,'bridge')>=0);if(b>=0)T('bridge',build(S,m,b,'bridge')&&cells[b].land&&cells[b].bridge);
   for(const k of ['farm','mill','mine','fish']){const j=cells.findIndex((c,i)=>buildCost(S,m,i,k)>=0);if(j>=0){S.nations[m].gold+=50;T(k,build(S,m,j,k)&&cells[j].b===k&&cells[j].bo===m&&income(S,m).w[k]>0);}}
   cells.forEach(c=>{if(c.b){T('work owner',c.bo>=0&&S.nations[c.bo].alive);if(c.b==='farm')T('farm own',c.owner===c.bo)}});
   let p=cells.findIndex((c,i)=>buildCost(S,m,i,'wharf')>=0);if(p>=0){S.nations[m].gold+=20;T('wharf',build(S,m,p,'wharf')&&cells[p].wharf&&!isTown(cells[p]));if(!cells[p].army){cells[p].army={owner:m,count:5,morale:3,moved:false};T('wharf embark',[...reachable(S,p).res.keys()].some(k=>cells[k].sea));cells[p].army=null;}}
   nextTurn(S);}
}
// splitting, recruits and auto-garrison
for(let seed=1;seed<=20;seed++){const S=newGame(seed,0);const n=S.cur,N=S.nations[n],cap=N.cap,cells=S.cells;N.gold=500;const A=cells[cap];
 A.army.count=40;A.army.fresh=0;T('quarter',movers(S,cap,0.25)===10&&movers(S,cap,0.5)===20&&movers(S,cap,0.75)===30&&movers(S,cap)===40);
 const dest=[...reachable(S,cap,20).res].find(([k,t])=>t==='move')[0];const ev=doMove(S,cap,dest,0.5);T('split move',ev&&A.army&&A.army.count===20&&cells[dest].army.count===20&&!A.army.moved&&cells[dest].army.moved);
 A.army.count=15;T('too small',movers(S,cap,0.5)===-1&&movers(S,cap,0.25)===-1);
 recruit(S,n,cap,30);T('fresh',A.army.count===45&&A.army.fresh===30&&movers(S,cap)===15);
 const d2=[...reachable(S,cap,15).res].find(([k,t])=>t==='move');if(d2){const e2=doMove(S,cap,d2[0]);T('recruits stay',e2&&A.army&&A.army.count===30&&A.army.fresh===30&&cells[d2[0]].army.count===15&&movers(S,cap)===-1);}
 // brand-new army in an empty town cannot move
 const tw=cells.findIndex((c,i)=>c.owner===n&&isTown(c)&&!c.army&&i!==cap);
 // auto-garrison: an army of 40 leaving a restless town leaves 10
 const t2=cells.findIndex((c,i)=>c.town&&c.owner<0&&!c.army);if(t2>=0){cells[t2].owner=n;cells[t2].unrest=3;cells[t2].army={owner:n,count:40,morale:3,moved:false,fresh:0};T('auto garrison',movers(S,t2)===30);S.auto[n]=false;T('auto off',movers(S,t2)===40);S.auto[n]=true;cells[t2].army.count=15;T('auto small',movers(S,t2)===15);}
 nextTurn(S);while(S.cur!==n)nextTurn(S);T('matured',A.army.fresh===0&&movers(S,cap)===A.army.count);}
console.log('feature checks passed:',ok);
`);
