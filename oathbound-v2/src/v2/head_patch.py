p='/home/claude/rpg2/head.html'; s=open('/home/claude/rpg/head.html').read()
s=s.replace('<title>Oathbound</title>','<title>Oathbound v2</title>').replace('<h1>OATHBOUND</h1>','<h1>OATHBOUND <small style="font-size:12px;color:#ffd36b">v2 test</small></h1>')
css=open('/home/claude/rpg2/v2/v2.css').read()
assert s.count('</style>')==1; s=s.replace('</style>',css+'</style>'); open(p,'w').write(s); print('head ok')
