const fs=require('fs');eval(fs.readFileSync(process.argv[2],'utf8')+`
const N=+process.argv[3]||150;let a3=0,bs=0,nb=0,na=0,w=0;
for(let g=0;g<N;g++){const S=newRun(4000+g,['warrior','rogue','mage','priest'].map((c,i)=>({cls:c,name:'H'+i,ctrl:'ai'})),+process.argv[4]||0);let n=0,la=0,lb=0;
 while(S.screen!=='end'&&n++<30000){const nd=S.pos>=0?S.map[S.pos]:null;if(nd&&nd.act!==la){la=nd.act;if(la===3){na++;if(S.party[0].level>=5)a3++}}if(S.screen==='combat'&&S.C&&S.C.boss&&!lb){lb=1;nb++;if(S.party[0].level>=5)bs++}autoStep(S)}if(S.result==='victory')w++}
console.log('level 5 at act 3 start',Math.round(a3/na*100)+'%','| at boss',Math.round(bs/nb*100)+'%','| win',Math.round(w/N*100)+'%')`)
