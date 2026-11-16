const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
let maps=300,nb=0,ends=0,useless=0,none=0,rivNo=0,rivers=0;
for(let g=0;g<maps;g++){const S=newGame(80000+g,-1),cells=S.cells;const isR=c=>c.t===3||c.bridge;let b=0;
 const up=i=>{let m=0;cells.forEach((o,j)=>{if(o.down===i&&isR(o))m=Math.max(m,1+up(j))});return m};
 // each river segment: from a headwater down to where it ends; count rivers with no bridge
 cells.forEach((c,i)=>{if(!isR(c))return;if(cells.some(o=>o.down===i))return;rivers++;let p=i,has=false;while(p>=0&&!cells[p].sea){if(cells[p].bridge)has=true;p=cells[p].down}if(!has)rivNo++;});
 cells.forEach((c,i)=>{if(!c.bridge)return;nb++;b++;let toMouth=0,p=c.down;while(p>=0&&!cells[p].sea){toMouth++;p=cells[p].down}const fromSrc=up(i);if(toMouth<=1||fromSrc<=1)ends++;});
 if(!b)none++;}
console.log('maps',maps,'| bridges/map',(nb/maps).toFixed(2),'| bridges within 1 hex of a source or mouth',ends,'of',nb,'('+(ends/nb*100).toFixed(0)+'%)','| headwater-to-water courses with no bridge',rivNo,'of',rivers,'| maps with no bridge',none);
`);
