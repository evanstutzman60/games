const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const js=src.split('<script>')[1].split('</script>')[0];
const els={};const mk=()=>{const e={style:{},classList:{toggle(){},add(){},remove(){}},children:[],append(...a){e.children.push(...a)},addEventListener(t,f){e['on_'+t]=f},set innerHTML(v){e.children=[]},get innerHTML(){return ''},
 getContext:()=>new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true}}),clientWidth:1200,clientHeight:700,getBoundingClientRect:()=>({left:0,top:0,width:960,height:600}),value:'0'};return e};
global.document={getElementById:id=>els[id]||(els[id]=mk()),createElement:mk,querySelector:()=>mk(),addEventListener(){}};global.window={addEventListener(){}};
let raf=null;global.requestAnimationFrame=f=>{raf=f};
eval(js+`
let ts=0,clicks=0,games=0,wins=0;const press=()=>{const bs=els.menu.children.filter(c=>c.onclick&&!c.disabled);if(bs.length){bs[0].onclick();clicks++}};
for(let n=0;n<200000&&games<3;n++){ts+=100;const f=raf;raf=null;speed=3;f(ts);
 if(G.over){games++;if(G.won)wins++;els.again.onclick();continue}
 if(n===2)els.next.onclick();
 if(n%20===0){const i=(n/20)%SPOTS.length|0;const [x,y]=SPOTS[i];els.cv.on_mousemove({clientX:x,clientY:y});els.cv.on_click({clientX:x,clientY:y});press();els.cv.on_click({clientX:5,clientY:590});}
 if(n%300===7){els.fire.onclick();if(mode==='fire'){const e=G.foes[0];els.cv.on_click({clientX:e?e.x:400,clientY:e?e.y:300})}}
 if(n%90===11){els.reinf.onclick();if(mode==='reinf'){const [x,y]=at(PL*0.5);els.cv.on_click({clientX:x,clientY:y})}}
 if(n%500===13){const gi=G.towers.findIndex(t=>t&&t.type==='guard');if(gi>=0){const [x,y]=SPOTS[gi];els.cv.on_click({clientX:x,clientY:y});const mv=els.menu.children.find(c=>c.onclick&&c.children[0]&&c.children[0].textContent==='Move soldiers');if(mv){mv.onclick();const tw=G.towers[gi];els.cv.on_click({clientX:tw.rally[0]+15,clientY:tw.rally[1]});}}}
 if(G.wave<0&&n>3)els.next.onclick();
}
console.log('interface smoke test: games finished',games,'won',wins,'menu clicks',clicks);
`);
