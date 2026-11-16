const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
let logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
const lv=fs.readFileSync('tests/wardens-of-the-vale/lv.js','utf8');const botSrc=lv.slice(lv.indexOf('function refMod'),lv.indexOf("if(cmd==='maps')"));
eval(logic+botSrc+`
const i=7,d=campaignLevel(i);
for(const mode of ['none','ranger','ranger0','rangerStill']){let L=0,dmgH=0,xp=0;for(let s=1;s<=4;s++){
  const _hs=hs; if(mode==='ranger0'){hs=G=>{const o=_hs(G);o.dmg=[0,0];return o}}
  const _mv=moveHero; if(mode==='rangerStill'){moveHero=()=>true}
  const G=play(d,refMod(i),s,{hero:mode==='none'?null:'ranger',spells:1,early:1});L+=G.lives;if(G.hero)xp+=G.hero.xp;hs=_hs;moveHero=_mv;}
 console.log(mode.padEnd(12),'avg lives',(L/4).toFixed(1),'hero xp',(xp/4).toFixed(0));}
`);
