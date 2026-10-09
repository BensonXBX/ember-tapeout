"""Version local module/CSS references from dependency content, leaves assets intact."""
from pathlib import Path
import hashlib,re
root=Path(__file__).resolve().parents[1]/'public'
done=set();active=set()
pattern=re.compile(r'''(["'])(\./[^"'\s?]+\.(?:mjs|css)|/games/ember/[^"'\s?]+\.(?:mjs|css))(?:\?v=[^"'\s]+)?\1''')
def update(p):
 if p in done:return
 if p in active:raise ValueError('Circular versioned import: '+str(p))
 active.add(p);text=p.read_text()
 def replace(m):
  uri=m[2];target=(root/uri.removeprefix('/games/ember/') if uri.startswith('/games/ember/') else p.parent/uri).resolve()
  if not target.is_relative_to(root.resolve()) or not target.is_file():return m[0]
  update(target);h=hashlib.sha256(target.read_bytes()).hexdigest()[:16]
  return m[1]+uri+'?v='+h+m[1]
 new=pattern.sub(replace,text)
 if new!=text:p.write_text(new)
 active.remove(p);done.add(p)
for p in sorted(root.rglob('*')):
 if p.suffix in ('.html','.mjs','.css') and 'vendor' not in p.parts:update(p)
print('Verified',len(done),'frontend files')
