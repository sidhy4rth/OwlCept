// Builds dist/owlcept-engine.js: one plain script for embedded JavaScript
// engines (Jint in the Windows agent). It defines globalThis.OwlCept.
import { build } from 'esbuild';

await build({
  entryPoints: [new URL('./host/entry.ts', import.meta.url).pathname],
  outfile: new URL('./dist/owlcept-engine.js', import.meta.url).pathname,
  bundle: true,
  format: 'iife',
  target: 'es2020',
  legalComments: 'none',
  logLevel: 'info',
});

// dist/owlcept.mjs: the command-line tool as one file (Node 18+), attached to releases.
await build({
  entryPoints: [new URL('./cli/owlcept.ts', import.meta.url).pathname],
  outfile: new URL('./dist/owlcept.mjs', import.meta.url).pathname,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node18',
  legalComments: 'none',
  logLevel: 'info',
});
