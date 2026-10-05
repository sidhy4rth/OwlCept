// Bundles the extension into dist/ (load that folder as an unpacked extension).
import { build, context } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const watch = process.argv.includes('--watch');
const out = new URL('./dist/', import.meta.url).pathname;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(new URL('./static/', import.meta.url).pathname, out, { recursive: true });

const common = { bundle: true, target: 'chrome111', logLevel: 'info', legalComments: 'none', minify: !watch, sourcemap: watch ? 'inline' : false };
const configs = [
  { ...common, entryPoints: ['src/hook.ts'], outfile: `${out}hook.js`, format: 'iife' },
  { ...common, entryPoints: ['src/content.ts'], outfile: `${out}content.js`, format: 'iife' },
  { ...common, entryPoints: ['src/popup.ts'], outfile: `${out}popup.js`, format: 'iife' },
  { ...common, entryPoints: ['src/dashboard.ts'], outfile: `${out}dashboard.js`, format: 'iife' },
  { ...common, entryPoints: ['src/incident.ts'], outfile: `${out}incident.js`, format: 'iife' },
  { ...common, entryPoints: ['src/background.ts'], outfile: `${out}background.js`, format: 'esm' },
];

if (watch) {
  for (const c of configs) await (await context(c)).watch();
} else {
  await Promise.all(configs.map((c) => build(c)));
}
