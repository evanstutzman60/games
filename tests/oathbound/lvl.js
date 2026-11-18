// lvl.js logic N: hero level reached at the start of each act and at the boss (single adventure, Standard)
const fs=require('fs');eval(fs.readFileSync(process.argv[2],'utf8')+`
const N=+process.argv[3]||100;const at={1:[],2:[],3:[],boss:[]};let xpEnd=0,w=0;
for(let g=0;g<N;g++){const S=newRun(9000+g,['warrior','rogue','mage','priest'].map((c,i)=>({cls:c,name:'H'+i,ctrl:'ai'})),+process.argv[4]||0);let n=0,la=0,lb=false;
 while(S.screen!=='end'&&n++<30000){if(S.screen==='map'||S.screen==='combat'){const nd=S.map[S.pos];if(nd&&nd.act!==la){la=nd.act;at[la]&&at[la].push(S.party[0].level)}if(S.screen==='combat'&&S.C&&S.C.boss&&!lb){lb=true;at.boss.push(S.party[0].level)}}autoStep(S)}
 if(S.result==='victory')w++;xpEnd+=S.xp}
const av=a=>a.length?(a.reduce((x,y)=>x+y,0)/a.length).toFixed(2):'-';console.log('level at act1',av(at[1]),'act2',av(at[2]),'act3',av(at[3]),'boss',av(at.boss),'| xp at end',(xpEnd/N).toFixed(0),'| win',w/N)`)
