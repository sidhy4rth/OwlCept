// Builds the static site into dist/ (deployable as-is; also bundled into the Android app).
import { build } from 'esbuild';
import { cpSync, mkdirSync, rmSync } from 'node:fs';

const out = new URL('./dist/', import.meta.url).pathname;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(new URL('./static/', import.meta.url).pathname, out, { recursive: true });
await build({
  entryPoints: { app: 'src/main.ts', fleet: 'src/fleet.ts' },
  outdir: out,
  bundle: true,
  format: 'iife',
  target: ['chrome90', 'safari15', 'firefox100'],
  minify: true,
  legalComments: 'none',
  logLevel: 'info',
});
