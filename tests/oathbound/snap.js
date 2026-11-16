// Serialise the map SVG the UI draws to a file so it can be rasterised and looked at.
const fs=require('fs');const html=fs.readFileSync(process.argv[2],'utf8');const js=html.split('<script>')[1].split('</script>')[0];
class El{constructor(t){this.tag=t;this.kids=[];this.attrs={};this.className='';this.style={}}
 setAttribute(k,v){this.attrs[k]=v} append(...c){for(const x of c)this.kids.push(x)} replaceChildren(...c){this.kids=c}
 set textContent(v){this.kids=[String(v)]} get nodeType(){return 1}}
const ids={};for(const id of ['hud','main','party','modal','mbody','fast','helpb','newb','log'])ids[id]=new El('div');
global.document={getElementById:id=>ids[id]||null,createElement:t=>new El(t),createElementNS:(n,t)=>new El(t),createTextNode:t=>String(t)};
global.localStorage={getItem:()=>null,setItem(){},removeItem(){}};global.setTimeout=()=>0;global.clearTimeout=()=>{};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const ser=e=>typeof e==='string'?esc(e):`<${e.tag}${Object.entries(e.attrs).map(([k,v])=>` ${k}="${esc(v)}"`).join('')}${e.className?` class="${e.className}"`:''}>${e.kids.map(ser).join('')}</${e.tag}>`;
const find=(e,t)=>{if(typeof e==='string')return null;if(e.tag===t)return e;for(const k of e.kids){const r=find(k,t);if(r)return r}return null};
eval(js+`
S=newRun(+process.argv[4]||12345,[{cls:'warrior',ctrl:'human',name:'Brann',player:'Player 1'},{cls:'mage',ctrl:'ai',name:'Ilyra'}]);
const steps=+process.argv[5]||0;for(let k=0;k<steps;k++){S.screen='map';const o=options(S);S.pos=o[k%o.length];S.map[S.pos].done=true;S.map[S.pos].seen=true}
if(S.pos>=0)S.map[S.pos].done=true;S.screen='map';render();
const svg=find(ids.main,'svg');svg.attrs.xmlns='http://www.w3.org/2000/svg';svg.attrs.width=960;svg.attrs.height=660;fs.writeFileSync(process.argv[3],ser(svg));console.log('wrote',process.argv[3]);
`);
