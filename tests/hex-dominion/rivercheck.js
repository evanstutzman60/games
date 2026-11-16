const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
let mapsWithJoin=0;const kinds={touch:0};let maps=+process.argv[3]||300,bad=0,riv=0,hexes=0,joins=0,lakes=0,ms=0,nobridge=0;
for(let g=0;g<maps;g++){const t=Date.now();const S=newGame(80000+g,-1),cells=S.cells;ms+=Date.now()-t;let br=0;
 const isR=c=>c.t===3||c.bridge;const j0=joins;
 cells.forEach((c,i)=>{if(c.bridge)br++;if(!isR(c))return;hexes++;
  if(c.down<0){bad++;return}
  // follow the flow: must reach water without revisiting a hex
  let p=i,seen=new Set();while(p>=0&&!cells[p].sea){if(seen.has(p)){bad++;break}seen.add(p);if(!NB[p].includes(cells[p].down)){bad++;break}p=cells[p].down;if(p>=0&&!cells[p].sea&&!isR(cells[p])){bad++;break}}
  // a river hex may only touch other river hexes it flows to or from
  NB[i].forEach(q=>{if(q>=0&&isR(cells[q])&&cells[q].down!==i&&c.down!==q){bad++;kinds.touch++}});
  const ups=cells.filter((o,j)=>o.down===i).length;if(ups>=2)joins++;
  if(ups===0&&!NB[i].some(q=>q>=0&&cells[q].t===2))bad+=1000;   // every headwater must rise beside a mountain
  if(c.down>=0&&cells[c.down].sea){riv++;const flood=new Set([c.down]),q=[c.down];while(q.length){const x=q.pop();for(const y of NB[x])if(y>=0&&cells[y].sea&&!flood.has(y)){flood.add(y);q.push(y)}}if(flood.size<10)lakes++;}
 });if(joins>j0)mapsWithJoin++;if(!br)nobridge++;}
console.log('maps',maps,'| river hexes/map',(hexes/maps).toFixed(1),'| river mouths/map',(riv/maps).toFixed(2),'(into lakes',lakes+')','| confluences',joins,'| maps with a confluence',mapsWithJoin,'| violations',bad,JSON.stringify(kinds),'| maps without a bridge',nobridge,'| ms/map',(ms/maps).toFixed(0));
`);
