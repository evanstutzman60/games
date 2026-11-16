// Drives the real UI code against a small fake DOM, clicking random enabled buttons. Usage: node uitest.js <index.html> <runs> <humans>
const fs=require('fs');const html=fs.readFileSync(process.argv[2],'utf8');const js=html.split('<script>')[1].split('</script>')[0];
const RUNS=+process.argv[3]||5,HUM=+process.argv[4]||1;let seed=7;const R=()=>{seed=(seed*1103515245+12345)&0x7fffffff;return seed/0x7fffffff};
class El{constructor(t){this.tag=t;this.kids=[];this.attrs={};this.className='';this.style={};this.scrollTop=0;this.scrollLeft=0}
 setAttribute(k,v){this.attrs[k]=v;if(k==='value')this.value=v;if(k==='checked')this.checked=true}
 append(...c){for(const x of c)this.kids.push(x)} replaceChildren(...c){this.kids=c}
 set textContent(v){this.kids=[String(v)]} get textContent(){return this.kids.map(k=>typeof k==='string'?k:k.textContent||'').join('')}
 get nodeType(){return 1}}
const ids={};for(const id of ['hud','main','party','modal','mbody','fast','helpb','newb','log'])ids[id]=new El('div');ids.fast.checked=true;
const mem={};const timers=[];
global.document={getElementById:id=>ids[id]||null,createElement:t=>new El(t),createElementNS:(n,t)=>new El(t),createTextNode:t=>String(t)};
global.localStorage={getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v},removeItem:k=>{delete mem[k]}};
global.setTimeout=(f)=>{timers.push(f);return timers.length};global.clearTimeout=()=>{timers.length=0};
const walk=(e,out)=>{if(!e||typeof e==='string')return out;if((e.tag==='button'||e.tag==='g'||e.tag==='div')&&e.onclick&&!('disabled' in e.attrs))out.push(e);if(e.tag==='input'&&e.attrs.type==='checkbox'&&e.onchange&&!('disabled' in e.attrs))out.push(e);for(const k of e.kids)walk(k,out);return out};
const text=e=>typeof e==='string'?e:(e.kids||[]).map(text).join(' ');
eval(js+`
let done=0,wins=0,clicks=0,screens={},sheets=0;
for(let run=0;run<RUNS;run++){S=null;seats=null;render();
 diff=run%2;const cls=Object.keys(CLASSES);seats=[0,1,2,3].map(i=>({ctrl:i<HUM?'human':(i<2+run%3?'ai':'none'),cls:cls[(i+run)%4],name:'H'+i}));render();
 const b=walk(ids.main,[]).find(e=>text(e).startsWith('Begin'));b.onclick();
 for(let n=0;n<60000&&S&&S.screen!=='end';n++){
  screens[S.screen]=(screens[S.screen]||0)+1;
  if(timers.length){const f=timers.pop();timers.length=0;f();continue}
  if(ids.modal.className==='show'){const mb=walk(ids.mbody,[]);const e=mb[Math.floor(R()*mb.length)];clicks++;if(e.tag==='input'){e.checked=!e.checked;e.onchange({target:e})}else e.onclick();if(R()<0.5)closeModal();continue}
  if(R()<0.02){sheet(Math.floor(R()*S.party.length));sheets++;continue}
  if(R()<0.004){rules();continue}
  if(R()<0.03){openPack();continue}
  let bs=walk(ids.main,[]);if(!bs.length)throw new Error('no buttons on '+S.screen);
  if(S.screen==='combat'){const t=bs.filter(e=>/tgt/.test(e.className));if(t.length&&R()<0.9)bs=t;else{const sk=bs.filter(e=>e.tag==='button'&&!/Defend|Move to|Supplies/.test(text(e)));if(sk.length&&R()<0.85)bs=sk}}
  if(S.screen==='shop'&&R()<0.3)bs=bs.filter(e=>text(e)==='Leave');
  const e=bs[Math.floor(R()*bs.length)];clicks++;e.onclick({target:e});
  if(n===59999)throw new Error('run did not finish, screen '+S.screen)}
 if(S){done++;if(S.result==='victory')wins++;const nb=walk(ids.main,[]).find(e=>text(e)==='New adventure');if(!text(ids.main).includes('oath'))throw new Error('no ending');nb.onclick()}}
if(mem['oathbound-v1'])throw new Error('save not cleared');
console.log('humans',HUM,'| runs finished',done,'of',RUNS,'| wins',wins,'| clicks',clicks,'| hero sheets opened',sheets,'| screens seen',Object.keys(screens).join(','));
`);
