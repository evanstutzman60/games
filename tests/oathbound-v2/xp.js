const fs=require('fs');eval(fs.readFileSync(process.argv[2],'utf8')+`
const N=+process.argv[3]||100,a2=[],a3=[],bs=[];
for(let g=0;g<N;g++){const S=newRun(9000+g,['warrior','rogue','mage','priest'].map((c,i)=>({cls:c,name:'H'+i,ctrl:'ai'})),0);let n=0,la=0,lb=0;
 while(S.screen!=='end'&&n++<30000){const nd=S.pos>=0?S.map[S.pos]:null;if(nd&&nd.act!==la){la=nd.act;if(la===2)a2.push(S.xp);if(la===3)a3.push(S.xp)}if(S.screen==='combat'&&S.C&&S.C.boss&&!lb){lb=1;bs.push(S.xp)}autoStep(S)}}
const q=(a,p)=>{a=a.slice().sort((x,y)=>x-y);return a[Math.floor(p*(a.length-1))]};
console.log('xp entering act2 p10/50/90',q(a2,.1),q(a2,.5),q(a2,.9),'| act3',q(a3,.1),q(a3,.5),q(a3,.9),'| boss',q(bs,.1),q(bs,.5),q(bs,.9))`)
