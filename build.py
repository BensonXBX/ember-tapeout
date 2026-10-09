"""Create a bounded runtime release. No databases, reports or launcher scripts."""
from pathlib import Path
import gzip
import hashlib
import json
import shutil

ROOT = Path(__file__).resolve().parent

def build():
    out = ROOT / 'dist'
    if out.exists():
        shutil.rmtree(out)
    out.mkdir()
    for folder in ('public', 'server'):
        for path in (ROOT / folder).rglob('*'):
            if not path.is_file():
                continue
            allowed = (path.suffix in {'.html', '.css', '.mjs', '.svg', '.png', '.webp', '.webmanifest', '.txt'} if folder == 'public'
                       else path.suffix in {'.mjs', '.js', '.json', '.sql'} or path.name == 'LICENSE')
            if not allowed:
                continue
            target = out / path.relative_to(ROOT)
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(path.read_bytes())
            if folder == 'public' and path.suffix in {'.html', '.css', '.mjs', '.svg', '.webmanifest', '.txt'}:
                target.with_name(target.name + '.gz').write_bytes(gzip.compress(target.read_bytes(), mtime=0))
    shutil.copyfile(ROOT / 'release.json', out / 'release.json')
    manifest = {str(p.relative_to(out)): hashlib.sha256(p.read_bytes()).hexdigest()
                for p in sorted(out.rglob('*')) if p.is_file()}
    (ROOT / 'release-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print(f'{len(manifest)} files, {sum(p.stat().st_size for p in out.rglob("*") if p.is_file())} bytes')
    return out

if __name__ == '__main__':
    build()
