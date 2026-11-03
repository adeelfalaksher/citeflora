import {build} from 'vite';
import {fileURLToPath} from 'node:url';

await build({
  configFile:false,
  build:{
    ssr:fileURLToPath(new URL('../worker/api.ts',import.meta.url)),
    outDir:fileURLToPath(new URL('../dist/api',import.meta.url)),
    emptyOutDir:true,
    minify:true,
    target:'es2022',
    rollupOptions:{external:['cloudflare:workers'],output:{format:'es',entryFileNames:'worker.js'}},
  },
});
