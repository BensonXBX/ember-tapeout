import {build} from 'rolldown';
await build({input:'build-tools/finance-source.mjs',platform:'node',output:{file:'server/vendor/finance-ethers.mjs',format:'esm',minify:true}});
