import { multiselect, select } from '@clack/prompts';
import { orExit } from '../../prompt-util';
import type { ImportSort, Integration, PrettierChoice } from '../../types';
import { prettierConfig } from './template';

const DEP_FOR: Partial<Record<ImportSort, string>> = {
  'organize-imports': 'prettier-plugin-organize-imports',
  ianvs: '@ianvs/prettier-plugin-sort-imports',
};

async function promptImportSort(): Promise<ImportSort> {
  const enabled = orExit(
    await multiselect({
      message: 'prettier: enable automatic import sorting?',
      options: [{ value: 'on', label: 'Sort imports on format' }],
      initialValues: ['on'],
      required: false,
    }),
  );
  if (!enabled.includes('on')) return 'off';
  return orExit(
    await select<ImportSort>({
      message: 'prettier: which import-sort plugin? (pick one — they cannot coexist)',
      options: [
        { value: 'organize-imports', label: 'organize-imports', hint: 'sorts + merges + REMOVES UNUSED (destructive)' },
        { value: 'ianvs', label: '@ianvs/sort-imports', hint: 'grouped, configurable, non-destructive' },
      ],
      initialValue: 'organize-imports',
    }),
  );
}

/**
 * Opinionated `.prettierrc.json` plus a mutually-exclusive import-sort strategy
 * (ADR-0006). Adds `format` / `format:check` scripts.
 */
export const prettier: Integration = {
  id: 'prettier',
  label: 'prettier — formatting',
  devDependencies: ['prettier'],

  async promptSubOptions(): Promise<PrettierChoice> {
    return { importSort: await promptImportSort() };
  },

  plan(_ctx, choice) {
    const importSort = (choice as PrettierChoice | undefined)?.importSort ?? 'organize-imports';
    const dev = [...this.devDependencies];
    const plugin = DEP_FOR[importSort];
    if (plugin) dev.push(plugin);
    return [
      { kind: 'installDeps', dev },
      { kind: 'writeFile', path: '.prettierrc.json', contents: prettierConfig(importSort), overwrite: true },
      // Keep build artifacts out of `prettier --check .` (coverage/ holds JSON
      // prettier would otherwise try to format, failing `verify`). Append-only,
      // like .gitignore, so a re-run preserves the user's own added entries.
      { kind: 'appendLines', path: '.prettierignore', lines: ['node_modules', 'coverage', 'dist'] },
      {
        kind: 'mergePackageJson',
        patch: { scripts: { format: 'prettier --write .', 'format:check': 'prettier --check .' } },
      },
    ];
  },
};
