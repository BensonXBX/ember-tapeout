import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import solc from 'solc';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
test('downloadable verification input recompiles to the exact deployed artifact, including all dependencies and immutable references',()=>{
 const source=read('../contracts/verification-source.mjs'),bundle=JSON.parse(source.slice(source.indexOf('export default ')+15).trim().slice(0,-1)),artifact=JSON.parse(read('../contracts/artifact.json'));
 assert.deepEqual(bundle.input,JSON.parse(read('../contracts/standard-input.json')));assert.equal(bundle.compiler,'v'+solc.version().split('.Emscripten')[0]);
 assert.equal(bundle.input.sources['EmberEscrow.sol'].content,read('../contracts/EmberEscrow.sol'));
 const out=JSON.parse(solc.compile(JSON.stringify(bundle.input)));assert.ok(!out.errors?.some(e=>e.severity==='error'));
 const c=out.contracts['EmberEscrow.sol'].EmberEscrow;assert.equal('0x'+c.evm.bytecode.object,artifact.bytecode);assert.equal('0x'+c.evm.deployedBytecode.object,artifact.runtime);assert.deepEqual(c.abi,artifact.abi);assert.deepEqual(artifact,JSON.parse(read('../server/escrow-artifact.json')));
});
