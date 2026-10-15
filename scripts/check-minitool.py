from pathlib import Path
from html.parser import HTMLParser
import re,zipfile,json,hashlib
root=Path('minitool-dist')
allowed={'.html','.css','.js','.png','.jpg','.jpeg','.gif','.webp','.svg','.woff','.woff2','.json'}
class CheckHTML(HTMLParser):
 def __init__(self):super().__init__();self.refs=[];self.ids=set();self.scripts=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  assert tag not in ['iframe','object','base'],tag
  assert not any(k.startswith('on') for k in a), 'Inline events'
  if 'id' in a:self.ids.add(a['id'])
  if tag=='script':
   assert a.get('src') and a.get('type')!='module','Script must be external classic script'
   self.scripts.append(a['src'])
  if tag=='meta':assert a.get('http-equiv','').lower()!='content-security-policy','Container owns CSP'
  for k in ['src','href']:
   if k in a:
    assert a[k].startswith('./'),'Resource must be local relative path: '+a[k]
    self.refs.append(a[k])
  assert 'download' not in a and a.get('target')!='_blank','Unavailable capability'
p=CheckHTML();html=(root/'index.html').read_text();p.feed(html)
assert 'viewport-fit=cover' in html and 'lang="zh-CN"' in html
assert p.scripts==['./security.js','./runtime.js','./app.js']
for ref in p.refs:assert (root/ref[2:]).is_file(),ref
for f in root.iterdir():
 assert f.is_file() and f.suffix in allowed,f
 if f.suffix=='.js':
  s=f.read_text()
  assert not re.search(r'\bfetch\s*\(|XMLHttpRequest|serviceWorker|new\s+(?:Worker|SharedWorker|WebSocket|EventSource|RTCPeerConnection|Function)\b|WebAssembly|navigator\.(?:clipboard|geolocation|storage|credentials|locks)|window\.(?:open|prompt)\s*\(|\.download\s*=|\beval\s*\(',s),f
  assert not re.search(r'(?m)^\s*(?:import|export)\s|\?\.|\?\?',s),f
  if f.name=='app.js':
   for selector in re.findall(r'(?:document\.querySelector\(|:\s*document\.querySelector\()"#([a-zA-Z0-9_-]+)"',s):
    # An obsolete, unused import handle must not remain in generated code.
    assert selector in p.ids,selector
 if f.suffix=='.css':assert not re.search(r'url\(\s*[\'"]?https?://',f.read_text()),f
zip_path=Path('personal-wallet-minitool.zip')
with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted(root.iterdir()):z.write(f,f.name)
with zipfile.ZipFile(zip_path) as z:
 assert 'index.html' in z.namelist()
 assert all('/' not in n for n in z.namelist())
 assert all(z.read(f.name)==f.read_bytes() for f in root.iterdir())
print(json.dumps({'files':len(list(root.iterdir())),'zipBytes':zip_path.stat().st_size,'sha256':hashlib.sha256(zip_path.read_bytes()).hexdigest(),'result':'PASS'},indent=2))
