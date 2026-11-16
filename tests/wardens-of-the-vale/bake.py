import subprocess,re,json,sys
p='wardens-of-the-vale/index.html'
out=subprocess.run(['node','tests/wardens-of-the-vale/lv.js',p,'calib'],capture_output=True,text=True).stdout
print(out)
K=json.loads(re.search(r'K=(\[.*\])',out).group(1))
s=open(p).read()
names=re.findall(r"\{ name: '([^']+)', seed: (\d+), k: [\d.]+ \}",s)
assert len(names)==8
for (n,sd),k in zip(names,K):
    s=re.sub(r"\{ name: '%s', seed: %s, k: [\d.]+ \}"%(re.escape(n),sd),"{ name: '%s', seed: %s, k: %s }"%(n,sd,k),s)
open(p,'w').write(s)
