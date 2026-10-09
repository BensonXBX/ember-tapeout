"""Deterministic frontend-only DeWeb pack; no server/credentials, entry last."""
from pathlib import Path
import argparse,base64,gzip,hashlib,json,re,shutil,zipfile
ROOT=Path(__file__).resolve().parents[1];PUBLIC=ROOT/'public';OUT=ROOT/'deweb-upload'
parser=argparse.ArgumentParser();parser.add_argument('--previous-manifest',type=Path);args=parser.parse_args()
if OUT.exists():shutil.rmtree(OUT)
OUT.mkdir();sha=lambda b:hashlib.sha256(b).hexdigest();metadata={}
def store(raw,category,name,mime,compress=False):
 data=gzip.compress(raw,compresslevel=9,mtime=0) if compress else raw
 stem=Path(name).stem;ext=Path(name).suffix;path=f'{category}/{stem}.{sha(data)[:16]}{ext}'+('.gz.bin' if compress else '')
 f=OUT/path;f.parent.mkdir(parents=True,exist_ok=True);f.write_bytes(data)
 item=dict(path=path,mime=mime,bytes=len(data),sha256=sha(data),rawBytes=len(raw),rawSha256=sha(raw),gzip=compress);metadata[path]=item;return item
mime={'.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.txt':'text/plain; charset=utf-8'}
assets={}
for f in sorted((PUBLIC/'assets').glob('*')):
 assets['assets/'+f.name]=store(f.read_bytes(),'media',f.name,mime[f.suffix])
assets['favicon.svg']=store((PUBLIC/'favicon.svg').read_bytes(),'media','favicon.svg',mime['.svg'])
# Extract large inline logos once so markup-only changes do not republish them.
html=(PUBLIC/'arena.html').read_text()
def inline(m):
 raw=base64.b64decode(m[1],validate=True);asset=store(raw,'media','logo-'+sha(raw)[:8]+'.png','image/png');return './'+asset['path']
html=re.sub(r'data:image/png;base64,([A-Za-z0-9+/=]+)',inline,html)
def resources(code):
 for key,item in sorted(assets.items(),key=lambda x:-len(x[0])):
  code=code.replace('/games/ember/'+key,'./'+item['path']).replace('./'+key,'./'+item['path'])
 return code
html=resources(html);html=re.sub(r'<script type="module"[^>]*>\s*</script>','',html);html=re.sub(r'<link[^>]*rel="stylesheet"[^>]*>','',html);html=html.replace('href="/games/ember/"','href="./"')
app=json.loads((PUBLIC/'manifest.webmanifest').read_text());app.update(id='../',start_url='../',scope='../');app['icons']=[dict(i,src='../'+assets[i['src'].removeprefix('./')]['path']) for i in app['icons']]
install=store(json.dumps(app,ensure_ascii=False,separators=(',',':')).encode(),'install','app.webmanifest','application/manifest+json')
html=html.replace('./manifest.webmanifest','./'+install['path'])
page=store(html.encode(),'page','arena.html','text/html; charset=utf-8',True)
styles=[store(resources((PUBLIC/f).read_text()).encode(),'styles',f,'text/css',True) for f in ['arena.css','interface.css']]
modules={}
pattern=re.compile(r'''(["'])(\./[^"'\s?]+\.mjs)(?:\?v=[^"'\s]+)?\1''')
for f in sorted(PUBLIC.rglob('*.mjs')):
 key=str(f.relative_to(PUBLIC))
 if key=='finance-admin.mjs':continue
 code=resources(f.read_text()).replace("'/games/ember/api/arena'","'https://tapeoutexplorer.com/games/ember/api/arena'").replace("'./api/auth'","'https://tapeoutexplorer.com/games/ember/api/auth'").replace("'./api/finance'","'https://tapeoutexplorer.com/games/ember/api/finance'")
 edges=[];original=code
 for m in list(pattern.finditer(original)):
  target=(f.parent/m[2]).resolve();dep=str(target.relative_to(PUBLIC.resolve()));literal=m[0];dynamic=bool(re.search(r'import\(\s*$',original[:m.start()]))
  if not target.is_file():raise ValueError(dep)
  if dynamic:
   code=code.replace('import('+literal+')','globalThis.__EMBER_IMPORT__('+json.dumps(dep)+')');edges.append(dict(id=dep,dynamic=True))
  else:
   stable=json.dumps('./'+Path(dep).name);code=code.replace(literal,stable);edges.append(dict(id=dep,literal=stable,dynamic=False))
 if '/games/ember/assets/' in code or "fetch('./api/" in code:raise ValueError('Unconverted resource: '+key)
 modules[key]={**store(code.encode(),'code',key.replace('/','-'),'text/javascript',True),'edges':edges}
# No cycles or dependencies on omitted administration code.
done=set();active=set()
def visit(k):
 if k in done:return
 if k in active:raise ValueError('Module cycle '+k)
 active.add(k)
 for e in modules[k]['edges']:visit(e['id'])
 active.remove(k);done.add(k)
for k in modules:visit(k)
store((PUBLIC/'vendor/licenses.txt').read_bytes(),'licenses','third-party.txt','text/plain; charset=utf-8',True)
release=dict(format=1,entry='arena.mjs',page=page,styles=styles,modules=modules)
manifest=store(json.dumps(release,ensure_ascii=False,separators=(',',':')).encode(),'release','manifest.json','application/json',True)
loader=store((ROOT/'build-tools/deweb-loader.js').read_bytes(),'runtime','loader.js','text/javascript')
entry='''<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="余烬 EMBER"><meta name="theme-color" content="#13283e"><title>余烬 · EMBER</title><link rel="manifest" href="./INSTALL"><link rel="apple-touch-icon" href="./ICON"></head><body style="margin:0;background:#11283c;color:#f0d39b"><p style="padding:24px;font:16px system-ui">余烬 · 正在载入 / Loading…</p><script id="ember-release" type="application/json">SELECTION</script><script type="module" src="./LOADER"></script></body></html>'''.replace('INSTALL',install['path']).replace('ICON',assets['assets/app-192.png']['path']).replace('SELECTION',json.dumps(dict(manifest=manifest),separators=(',',':'))).replace('LOADER',loader['path'])
(OUT/'index.html').write_text(entry)
assert len(entry.encode())<=24000
files=[dict(path=str(p.relative_to(OUT)),bytes=p.stat().st_size,sha256=sha(p.read_bytes()),chunks=(p.stat().st_size+23999)//24000) for p in sorted(OUT.rglob('*')) if p.is_file()];files.sort(key=lambda f:(f['path']=='index.html',f['path']))
report=dict(version=json.loads((ROOT/'release.json').read_text())['version'],format=1,entry='index.html',entryLast=True,depositRoomsEnabled=bool(re.search(r'DEPOSIT_ROOMS_ENABLED\s*=\s*true', (PUBLIC/'feature-policy.mjs').read_text())),apiOrigin='https://tapeoutexplorer.com',totalBytes=sum(f['bytes'] for f in files),totalChunks=sum(f['chunks'] for f in files),files=files)
assert report['totalBytes']<8_000_000
(ROOT/'DEWEB_MANIFEST.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
if args.previous_manifest:
 old=json.loads(args.previous_manifest.read_text());before={f['path']:f['sha256'] for f in old['files']};changed=[f for f in files if before.get(f['path'])!=f['sha256']];(ROOT/'DEWEB_UPDATE_PLAN.json').write_text(json.dumps(dict(entryLast=True,retainOldResources=True,verifyOnChain=True,reusedFiles=len(files)-len(changed),uploadBytes=sum(f['bytes'] for f in changed),files=changed),indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k!='files'},ensure_ascii=False));print('files',len(files),'entryBytes',len(entry.encode()))
