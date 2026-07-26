import type { Integration } from '../../types';
import { knipConfig } from './template';

/**
 * knip finds unused files, dependencies, and exports. Ships a tool-owned
 * `knip.json` (archgate-aware — see template), the `knip` script, and a slot in
 * the composed `verify` chain (added by husky, pre-push only — knip is a
 * project-wide gate, not a per-commit fixer). No sub-options in the MVP.
 */
export const knip: Integration = {
  id: 'knip',
  label: 'knip — unused files, deps & exports',
  devDependencies: ['knip'],

  plan(ctx) {
    return [
      { kind: 'installDeps', dev: [...this.devDependencies] },
      { kind: 'writeFile', path: 'knip.json', contents: knipConfig(ctx.selected), overwrite: true },
      { kind: 'mergePackageJson', patch: { scripts: { knip: 'knip' } } },
    ];
  },
};
