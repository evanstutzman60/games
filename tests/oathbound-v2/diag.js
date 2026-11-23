// diag.js logic N diff: what the AI actually does in v2 combat
const fs=require('fs');eval(fs.readFileSync(process.argv[2],'utf8')+`
const N=+process.argv[3]||40,DIFF=+process.argv[4]||0;const use={},ev={freeze:0,stun:0,melt:0,over:0,shat:0,evis:0,thunder:0,hf:0,lance:0,wind:0,dodge:0,cleanse:0},bossT=[],fightT=[];let wins=0;
const _act=act;act=function(S,C,a){const u=unit(C,C.cur);if(u&&u.side==='H'&&!u.npc&&!u.comp){const key=(S.party[u.hi].sub||u.cls)+':'+(a.k==='skill'?a.id:a.k);use[key]=(use[key]||0)+1}if(a.k==='wind')ev.wind++;const r=_act(S,C,a);for(const l of C.log.slice(-6)){}return r};
const _say=say;
for(let g=0;g<N;g++){const S=newRun(7000+g,['warrior','rogue','mage','priest'].map((c,i)=>({cls:c,name:'H'+i,ctrl:'ai'})),DIFF);let n=0,lastC=null;
 while(S.screen!=='end'&&n++<40000){if(S.C&&S.C!==lastC){if(lastC)fightT.push(lastC.time);lastC=S.C}autoStep(S)}
 if(lastC&&lastC.boss)bossT.push(lastC.time);if(S.result==='victory')wins++;
 }
console.log('win',wins/N);const by={};for(const[k,v]of Object.entries(use)){const[c,s]=k.split(':');(by[c]=by[c]||[]).push(s+' '+v)}for(const[c,l]of Object.entries(by))console.log(c.padEnd(13),l.sort((a,b)=>b.split(' ')[1]-a.split(' ')[1]).join(', '));
console.log('avg fight ticks',(fightT.reduce((a,b)=>a+b,0)/fightT.length).toFixed(0),'boss ticks',(bossT.reduce((a,b)=>a+b,0)/Math.max(1,bossT.length)).toFixed(0),'winds',ev.wind)`)
