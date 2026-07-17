import type { Integration } from '../../types';
import { vitestConfig } from './template';

/**
 * Minimal vitest setup: `vitest.config.ts`, `test` / `test:watch` scripts, and a
 * `coverage/` gitignore entry. No sub-options in the MVP.
 */
export const vitest: Integration = {
  id: 'vitest',
  label: 'vitest — testing',
  devDependencies: ['vitest', '@vitest/coverage-v8'],

  plan() {
    return [
      { kind: 'installDeps', dev: [...this.devDependencies] },
      { kind: 'writeFile', path: 'vitest.config.ts', contents: vitestConfig(), overwrite: true },
      { kind: 'mergePackageJson', patch: { scripts: { test: 'vitest run', 'test:watch': 'vitest watch' } } },
      { kind: 'appendLines', path: '.gitignore', lines: ['coverage/'] },
    ];
  },
};
