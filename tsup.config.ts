import { defineConfig } from 'tsup';

// Bundles the CLI entry (src/cli.ts) into a single self-contained ESM file at
// dist/cli.mjs — the published `bin` (ADR-0001, amended). @clack/prompts is a
// devDependency, so tsup inlines it (it externalizes only `dependencies` /
// `peerDependencies`, of which the published tarball has none); the result has
// zero runtime dependency installs. The shebang banner makes the artifact a
// directly executable bin. This is repo-local release tooling and is never part
// of the harness installed into Target projects (ADR-0003).
export default defineConfig({
  entry: { cli: 'src/cli.ts' },
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  outExtension: () => ({ js: '.mjs' }),
  banner: { js: '#!/usr/bin/env node' },
  splitting: false,
  sourcemap: false,
  dts: false,
  clean: true,
});
