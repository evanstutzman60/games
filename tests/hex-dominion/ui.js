const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');const NH=+process.argv[3]||2;
const js=src.split('<script>')[1].split('</script>')[0];
const mk=()=>{const e={set id(v){els[v]=e},style:{},classList:{toggle(){},add(){},remove(){}},children:[],append(...a){e.children.push(...a)},addEventListener(t,f){e['on_'+t]=f},set innerHTML(v){e.children=[]},get innerHTML(){return ''},
 getContext:()=>new Proxy({},{get:(t,k)=>k in t?t[k]:()=>{},set:(t,k,v)=>{t[k]=v;return true}}),parentElement:{clientWidth:1000,clientHeight:700},clientWidth:984,clientHeight:500,getBoundingClientRect:()=>({left:0,top:0}),value:'2',checked:true};return e};
const els={};global.document={querySelector(){return null},body:{style:{setProperty(){}},classList:{toggle(){return false},contains(){return false}}},addEventListener(){},documentElement:{},getElementById:id=>els[id]||(els[id]=mk()),createElement:mk,createTextNode:t=>({t})};
global.window={addEventListener(){},devicePixelRatio:1,innerWidth:1400};
const timers=[];global.setTimeout=(f)=>{timers.push(f);return timers.length};global.clearTimeout=()=>{};
eval(js.replace("sel.value = i === 0 ? 'h' : 'a';","sel.value = i < "+NH+" ? 'h' : 'a';")+`
let turns=[0,0,0,0],passes=0,offersSeen=0,games=0,walk=0;
function pump(){let g=0;while(timers.length&&g++<20000){timers.shift()()}}
for(let t=0;t<3000&&games<3;t++){pump();
  const btns=document.getElementById('mbtns').children.slice();document.getElementById('mtitle');
  if(btns.length){els.mbtns.children=[];const title=els.mtitle.textContent||'';
    if(/turn$/.test(title))passes++;if(/proposes peace/.test(title))offersSeen++;
    if(S.winner>=0){games++;btns[btns.length-1].onclick();continue}            // New map
    (/proposes peace/.test(title)?btns[(t%2)]:btns[0]).onclick();continue}       // alternate decline/accept, else first button
  if(S.winner<0&&S.cur===humanId&&S.nations[humanId].human&&!busy){const n=humanId;turns[n]++;
    // exercise the panels: focus hexes of every kind, press every enabled button in the orders and tech cards once in a while
    if(turns[n]%3===1){for(const i of [S.nations[n].cap,...S.cells.map((c,i)=>i).filter(i=>(S.cells[i].owner===n||NB[i].some(q=>q>=0&&S.cells[q].owner===n))&&(i*7+t)%11===0).slice(0,6)]){const [x,y]=center(i);els.cv.on_click({clientX:x,clientY:y});
       const bs=[];const collect=e=>{(e.children||[]).forEach(ch=>{if(ch&&ch.onclick&&!ch.disabled)bs.push(ch);collect(ch)})};collect(els.orders);if(bs.length){bs[(t+i)%bs.length].onclick();walk++}}
      const tb=[];const col2=e=>{(e.children||[]).forEach(ch=>{if(ch&&ch.onclick&&!ch.disabled)tb.push(ch);col2(ch)})};col2(els.tech);if(tb.length)tb[t%tb.length].onclick();
      const nb=[];const col3=e=>{(e.children||[]).forEach(ch=>{if(ch&&ch.onclick&&!ch.disabled)nb.push(ch);col3(ch)})};col3(els.nations);if(nb.length&&t%5===0)nb[t%nb.length].onclick();}
    aiEconomy(S,n);deselect();
    for(let k=0;k<12&&S.movesLeft>0&&S.winner<0;k++){const m=aiPick2(S,n);if(!m)break;const [x1,y1]=center(m.from),[x2,y2]=center(m.to);els.cv.on_click({clientX:x1,clientY:y1});els.cv.on_click({clientX:x2,clientY:y2});els.cv.on_mousemove({clientX:x2,clientY:y2});}
    if(S.winner<0)els.end.onclick();
  }
}
console.log('humans',NH,'| human turns by nation',turns.join('/'),'| pass prompts',passes,'| peace offers shown',offersSeen,'| panel buttons pressed',walk,'| games finished',games,'| round',S.round);
`);
