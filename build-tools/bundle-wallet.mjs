import {build} from 'rolldown';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await build({input:resolve(root,'build-tools/wallet-okx-source.mjs'),platform:'browser',output:{file:resolve(root,'public/vendor/okx-connect.mjs'),format:'esm',minify:true}});
await build({input:resolve(root,'build-tools/verify-source.mjs'),platform:'node',output:{file:resolve(root,'server/vendor/verify-message.mjs'),format:'esm',minify:true}});
