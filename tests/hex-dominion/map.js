const fs=require('fs');const src=fs.readFileSync(process.argv[2],'utf8');
const logic=src.split('// ===LOGIC-START===')[1].split('// ===LOGIC-END===')[0];
eval(logic+`for(const seed of [11,12,13]){const S=newGame(seed,-1);
 const ch=c=>c.sea?'~':c.t===2?'^':c.t===3?'|':c.capital>=0?'C':c.town&&c.port?'I':c.town?'T':c.port?'P':c.bridge?'=':'.';
 for(let r=0;r<H;r++){console.log((r&1?' ':'')+S.cells.slice(r*W,r*W+W).map(ch).join(' '))}console.log('')}`);
