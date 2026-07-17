import { multiselect } from '@clack/prompts';
import { orExit } from '../../prompt-util';
import type { Action, HuskyChoice, HuskyHook, Integration } from '../../types';
import { HOOK_BODY, lintStagedConfig, verifyCommitScript, verifyScript } from './template';

const HOOK_OPTIONS: { value: HuskyHook; label: string; hint: string }[] = [
  { value: 'commit-msg', label: 'commit-msg', hint: 'conventional-commit header check' },
  { value: 'pre-commit', label: 'pre-commit', hint: 'verify:commit — autofix staged + full-repo correctness' },
  { value: 'pre-push', label: 'pre-push', hint: 'verify — full-repo checks, no mutation' },
];

const DEFAULT_HOOKS: HuskyHook[] = ['pre-commit', 'pre-push'];

/**
 * husky owns cross-Integration composition (ADR-0004/0007): it assembles the
 * `verify` / `verify:commit` scripts and `.lintstagedrc.json` from the overall
 * selection. Sets `prepare: husky` in the target so hooks are wired on install
 * (the tool's own repo guards `prepare` separately — see ADR-0001 / US-36).
 */
export const husky: Integration = {
  id: 'husky',
  label: 'husky — git hooks + commit verification',
  devDependencies: ['husky', 'lint-staged'],

  async promptSubOptions(): Promise<HuskyChoice> {
    const hooks = orExit(
      await multiselect({
        message: 'husky: which git hooks?',
        options: HOOK_OPTIONS,
        initialValues: DEFAULT_HOOKS,
        required: false,
      }),
    );
    return { hooks };
  },

  plan(ctx, choice) {
    const hooks = (choice as HuskyChoice | undefined)?.hooks ?? DEFAULT_HOOKS;
    const actions: Action[] = [
      { kind: 'installDeps', dev: [...this.devDependencies] },
      {
        kind: 'mergePackageJson',
        patch: {
          scripts: {
            prepare: 'husky',
            verify: verifyScript(ctx.selected),
            'verify:commit': verifyCommitScript(ctx.selected),
          },
        },
      },
      { kind: 'writeFile', path: '.lintstagedrc.json', contents: lintStagedConfig(ctx.selected), overwrite: true },
    ];
    for (const hook of hooks) {
      actions.push({ kind: 'writeFile', path: `.husky/${hook}`, contents: HOOK_BODY[hook], overwrite: true });
    }
    actions.push({ kind: 'runCommand', command: 'npx', args: ['husky'] });
    return actions;
  },
};
