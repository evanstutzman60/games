const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const js=src.split('<script>')[1].split('</script>')[0];
const mk=()=>{const e={style:{},classList:{toggle(){},add(){},remove(){}},children:[],append(...a){e.children.push(...a)},addEventListener(t,f){e['on_'+t]=f},set innerHTML(v){e.children=[]},get innerHTML(){return ''},
 getContext:()=>new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true}}),parentElement:{clientWidth:1000},clientWidth:984,clientHeight:500,getBoundingClientRect:()=>({left:0,top:0}),value:'0',checked:true};return e};
const els={};global.document={getElementById:id=>els[id]||(els[id]=mk()),createElement:mk,createTextNode:t=>({t})};
global.window={addEventListener(){},devicePixelRatio:1};
const timers=[];global.setTimeout=(f)=>{timers.push(f);return timers.length};global.clearTimeout=()=>{};
eval(js+`
let turns=0;
function pump(){let g=0;while(timers.length&&g++<5000){timers.shift()()}}
for(let t=0;t<400&&S.winner<0;t++){pump();
  if($('modal').classList.on){}
  if(S.cur===humanId&&S.nations[humanId].human){ // play human via AI picks through click handler path
    S.offers.length=0;
    for(let k=0;k<5;k++){const m=aiPick(S,humanId);if(!m)break;const [x1,y1]=center(m.from),[x2,y2]=center(m.to);
      els.cv.on_click({clientX:x1,clientY:y1});els.cv.on_click({clientX:x2,clientY:y2});els.cv.on_mousemove({clientX:x2,clientY:y2});}
    turns++;const r0=S.round,c0=S.cur;els.end.onclick();if(turns<6||turns%60===0)console.log('t',turns,'round',r0,'cur',c0,'->',S.cur,'busy',busy,'timers',timers.length,'gold',S.nations[humanId].gold);
  } else if(!S.nations[humanId].human){ // defeated: press "Watch the rest"
    const b=els.mbtns.children[0]; if(b&&b.onclick){els.mbtns.children=[];b.onclick();} else break;
  }
}
console.log('human turns',turns,'round',S.round,'winner',S.winner,'log',S.log.length);
`);
