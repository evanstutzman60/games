const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
let nb=0,useless=0,riv=0,none=0,maps=300;
for(let g=0;g<maps;g++){const S=newGame(70000+g,-1),cells=S.cells;let b=0;
 cells.forEach((c,i)=>{if(c.t===3)riv++;if(!c.bridge)return;b++;nb++;riv++;
  // useless = removing the bridge does not lengthen any trip between its land neighbours by 3+ steps
  const L=NB[i].filter(y=>y>=0&&cells[y].land);let best=0;
  const walk=(a,t)=>{const d=new Map([[a,0]]),q=[a];for(let h=0;h<q.length;h++){const p=q[h];if(d.get(p)>=12)continue;for(const x of NB[p])if(x>=0&&x!==i&&cells[x].land&&!d.has(x)){if(x===t)return d.get(p)+1;d.set(x,d.get(p)+1);q.push(x)}}return 99};
  for(let a=0;a<L.length;a++)for(let k=a+1;k<L.length;k++)if(!NB[L[a]].includes(L[k]))best=Math.max(best,walk(L[a],L[k]));
  if(best<5)useless++;});
 if(!b)none++;}
console.log('maps',maps,'| river hexes per map',(riv/maps).toFixed(1),'| bridges per map',(nb/maps).toFixed(2),'| bridges saving under 3 steps',useless,'of',nb,'| maps with no bridge',none);
`);
