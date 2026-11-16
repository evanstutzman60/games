const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const js=src.split('<script>')[1].split('</script>')[0];
const els={};const mk=()=>{const cl=new Set();const e={style:{},classList:{toggle(c,on){(on===undefined?!cl.has(c):on)?cl.add(c):cl.delete(c)},add(c){cl.add(c)},remove(c){cl.delete(c)},contains(c){return cl.has(c)}},children:[],append(...a){e.children.push(...a)},addEventListener(t,f){e['on_'+t]=f},set innerHTML(v){e.children=[]},get innerHTML(){return ''},
 getContext:()=>new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true}}),clientWidth:1200,clientHeight:700,getBoundingClientRect:()=>({left:0,top:0,width:960,height:600})};return e};
global.document={getElementById:id=>els[id]||(els[id]=mk()),createElement:mk,createTextNode:t=>({t}),querySelector:()=>mk(),addEventListener(t,f){global['doc_'+t]=f}};global.window={addEventListener(){}};
let raf=null;global.requestAnimationFrame=f=>{raf=f};
const all=(e,out=[])=>{(e.children||[]).forEach(c=>{if(c&&c.onclick)out.push(c);if(c)all(c,out)});return out};
eval(js+`
let ts0=0,presses=0,picks=0;const tick=n=>{for(let k=0;k<n;k++){ts0+=100;const f=raf;raf=null;speed=3;f(ts0)}};
const pressHome=label=>{const b=all(els.homewrap).find(x=>x.textContent===label&&!x.disabled);if(!b)throw new Error('no home button '+label);b.onclick();presses++};
// home screens
save.stars=[3,3,3,3,3,3,3,0];save.hard=process.env.HARD==='1';if(process.env.NOSTARS)save.stars=[1,1,1,1,1,1,1,0];for(const t of ['Tower upgrades','Heroes','Campaign'])pressHome(t);
showHome('upgrades');let bought=0;for(let k=0;k<30;k++){const b=all(els.homewrap).find(x=>/\\u2605$/.test(x.textContent||'')&&!x.disabled);if(!b)break;b.onclick();bought++}
showHome('heroes');for(let k=0;k<12;k++){const b=all(els.homewrap).find(x=>/\\u2605$/.test(x.textContent||'')&&!x.disabled);if(!b)break;b.onclick();bought++}
if(freeStars()<0)throw new Error('overspent stars');
let results=[];
for(const [lvl,hero] of [[0,'knight'],[4,'ranger'],[7,'mage'],[-1,'knight']]){save.pick=hero;showHome('campaign');
 if(lvl>=0){const plays=all(els.homewrap).filter(x=>x.textContent==='Play');plays[lvl].onclick()}else pressHome('Random map');
 tick(3);els.next.onclick();let n=0,menuUsed=new Set();
 while(!G.over&&n++<60000){tick(1);
  if(n%6===0){const i=(n/6)%SPOTS.length|0;const [x,y]=SPOTS[i];els.cv.on_mousemove({clientX:x,clientY:y});els.cv.on_click({clientX:x,clientY:y});
    const bs=els.menu.children.filter(c=>c.onclick&&!c.disabled&&!/^Sell|^Move/.test(c.children[0].textContent));if(bs.length){const b=bs[(n/6|0)%bs.length];menuUsed.add(b.children[0].textContent.replace(/ \\d\\/2$/,''));b.onclick();presses++}
    els.cv.on_click({clientX:3,clientY:597});}
  if(n%40===5&&G.foes.length){const e=G.foes[0];const cy=e.y-(e.fly?26:6),clear=!mode&&!SPOTS.some(([x,y])=>Math.hypot(e.x-x,cy-y)<27)&&!(G.hero&&Math.hypot(e.x-G.hero.man.x,cy-G.hero.man.y+8)<19)&&e.x>0&&e.x<960;els.cv.on_click({clientX:e.x,clientY:cy});if(clear){picks++;if(pickKind!=='foe'||!pick)throw new Error('enemy not picked')}tick(1);setMode('');}
  if(n%50===9&&G.hero&&!G.hero.man.dead){els.hmove.onclick();const lead=G.foes.slice().sort((a,b)=>b.s-a.s)[0];const [hx,hy]=at(lead?lead.s+50:PL/2,hero==='knight'?0:40);els.cv.on_click({clientX:hx,clientY:hy});global.doc_keydown({key:'q',code:'KeyQ',preventDefault(){}});}
  if(n%120===7){els.fire.onclick();if(mode==='fire'){const e=G.foes[0];els.cv.on_click({clientX:e?e.x:400,clientY:e?e.y:300})}}
  if(n%70===11){els.reinf.onclick();if(mode==='reinf'){const [x,y]=at(PL*0.5);els.cv.on_click({clientX:x,clientY:y})}}
  if(n%30===0&&G.nextIn>0&&G.foes.length<3)els.next.onclick();
 }
 tick(2);results.push((lvl>=0?'L'+(lvl+1):'random')+' '+hero+': '+(G.won?'won '+G.lives+' lives':'lost on wave '+(G.wave+1))+', hero level '+G.hero.lvl+', distinct menu actions '+menuUsed.size+', leaked '+G.leaked+', minutes '+(G.t/60).toFixed(1)+', towers '+G.towers.filter(t=>t).length+' (level 4: '+G.towers.filter(t=>t&&t.lvl===3).length+')');
}
console.log('star purchases',bought,'| stars left',freeStars(),'| saved stars',save.stars.join(''));console.log(results.join('\\n'));console.log('button presses',presses,'| enemies inspected',picks);
`);
