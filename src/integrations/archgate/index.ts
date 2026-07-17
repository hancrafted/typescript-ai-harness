import { select } from '@clack/prompts';
import { orExit } from '../../prompt-util';
import type { ArchgateChoice, ArchgateEditor, Integration } from '../../types';

const EDITORS: { value: ArchgateEditor; label: string }[] = [
  { value: 'claude', label: 'Claude Code' },
  { value: 'cursor', label: 'Cursor' },
  { value: 'vscode', label: 'VS Code' },
  { value: 'copilot', label: 'GitHub Copilot' },
  { value: 'opencode', label: 'opencode' },
];

/**
 * archgate owns its own `.archgate/` scaffolding and ships `init`, so we
 * shell out rather than copy a snapshot that would rot (ADR-0005). No ADRs are
 * copied in the MVP. `--install-plugin` is not used (it needs a prior login).
 */
export const archgate: Integration = {
  id: 'archgate',
  label: 'archgate — deterministic ADR governance',
  devDependencies: ['archgate'],

  async promptSubOptions(): Promise<ArchgateChoice> {
    const editor = orExit(
      await select<ArchgateEditor>({
        message: 'archgate: which editor integration?',
        options: EDITORS,
        initialValue: 'claude',
      }),
    );
    return { editor };
  },

  plan(_ctx, choice) {
    const editor = (choice as ArchgateChoice | undefined)?.editor ?? 'claude';
    return [
      { kind: 'installDeps', dev: ['archgate'] },
      { kind: 'runCommand', command: 'npx', args: ['archgate', 'init', '--editor', editor] },
    ];
  },
};
