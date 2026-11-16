const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`
const NG=+process.argv[3],base=+process.argv[4],out=process.argv[5];
const NAMES=['region','land5','land8','towns6','towns10','town4dist','ore6','oreRegion','ports8','fishSites','seaNearCap','millSites','farmLand','mtnNearCap','mtnRegion','capNearest','capMean','open4','bridges6','contested','islandTowns','pos'];
function feats(S){const cells=S.cells,N=W*H,caps=S.nations.map(n=>n.cap);
 const ld=caps.map(ci=>{const d=new Array(N).fill(99);d[ci]=0;const q=[ci];for(let h=0;h<q.length;h++)for(const x of NB[q[h]])if(x>=0&&cells[x].land&&d[x]>d[q[h]]+1){d[x]=d[q[h]]+1;q.push(x)}return d});
 const reg=cells.map((c,i)=>{if(!c.land)return -1;let b=-1,bd=99,tie=false;for(let k=0;k<4;k++){if(ld[k][i]<bd){bd=ld[k][i];b=k;tie=false}else if(ld[k][i]===bd)tie=true}return tie||bd>=99?-1:b});
 const nbLand=(i,f)=>NB[i].some(x=>x>=0&&cells[x].land&&f(x));
 return caps.map((cap,k)=>{const d=ld[k];let region=0,land5=0,land8=0,towns6=0,towns10=0,ore6=0,oreRegion=0,ports8=0,fish=0,seaCap=0,mill=0,farm=0,mtn3=0,mtnReg=0,open4=0,br=0,cont=0,isl=0;const td=[];
  cells.forEach((c,i)=>{
   if(c.land){if(reg[i]===k)region++;if(d[i]<=5)land5++;if(d[i]<=8)land8++;if(d[i]===4)open4++;
     if(c.town){td.push(d[i]);if(d[i]<=6)towns6++;if(d[i]<=10)towns10++;const o=Math.min(...[0,1,2,3].filter(j=>j!==k).map(j=>ld[j][i]));if(d[i]>=5&&d[i]<=10&&d[i]<=o+1)cont++;if(d[i]>=99&&hexDist(cap,i)<=8)isl++;}
     if(c.port&&d[i]<=8)ports8++;if(c.bridge&&d[i]<=6)br++;
     if(reg[i]===k&&!c.town&&c.capital<0&&!c.port&&!c.bridge&&cells.some((t,j)=>(t.town||t.capital===k)&&reg[j]===k&&hexDist(i,j)<=2))farm++;}
   else if(c.sea){if(nbLand(i,x=>reg[x]===k))fish++;if(hexDist(cap,i)<=3)seaCap++;}
   else if(c.t===3){if(nbLand(i,x=>reg[x]===k))mill++;}
   else if(c.t===2){if(hexDist(cap,i)<=3)mtn3++;if(nbLand(i,x=>reg[x]===k))mtnReg++;if(c.ore){if(nbLand(i,x=>d[x]<=6))ore6++;if(nbLand(i,x=>reg[x]===k))oreRegion++;}}
  });
  td.sort((a,b)=>a-b);const t4=td.slice(0,4).reduce((a,b)=>a+Math.min(b,20),0)/4;const oc=[0,1,2,3].filter(j=>j!==k).map(j=>Math.min(40,d[caps[j]]));
  return [region,land5,land8,towns6,towns10,t4,ore6,oreRegion,ports8,fish,seaCap,mill,farm,mtn3,mtnReg,Math.min(...oc),oc.reduce((a,b)=>a+b,0)/3,open4,br,cont,isl,(k-S.first+4)%4];});}
if(!fs.existsSync(out))fs.writeFileSync(out,JSON.stringify({names:NAMES})+'\\n');
for(let g=0;g<NG;g++){const S=newGame(base+g,-1);const f=feats(S);while(S.winner<0&&S.round<250){aiTurnAll(S);nextTurn(S);}fs.appendFileSync(out,JSON.stringify({g:base+g,win:S.winner,rounds:S.round,f})+'\\n');}

`);
