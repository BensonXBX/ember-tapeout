"""Generate public verification metadata; never read runtime finance configuration."""
from pathlib import Path
import hashlib,json
root=Path(__file__).resolve().parents[1]
a=json.loads((root/'contracts/artifact.json').read_text());source=json.loads((root/'contracts/standard-input.json').read_text())
assert a==json.loads((root/'server/escrow-artifact.json').read_text())
assert source['sources']['EmberEscrow.sol']['content']==(root/'contracts/EmberEscrow.sol').read_text()
p=root/'contracts/verification-source.mjs'
p.write_text('// Public compiler input. No runtime configuration.\nexport default '+json.dumps({'compiler':'v'+a['compiler'].split('.Emscripten')[0],'contract':'EmberEscrow.sol:EmberEscrow','license':'MIT','input':source},ensure_ascii=False,separators=(',',':'))+';\n')
print('Public verification input SHA256:',hashlib.sha256(p.read_bytes()).hexdigest())
