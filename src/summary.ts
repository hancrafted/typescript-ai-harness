import type { Action } from './types';

/** One human-readable line per Action, for the plan summary and `--dry-run`. */
export function summarize(actions: Action[]): string[] {
  return actions.map(describe);
}

function describe(action: Action): string {
  switch (action.kind) {
    case 'writeFile':
      return describeWrite(action);
    case 'mergePackageJson':
      return `merge  package.json scripts: ${Object.keys(action.patch.scripts ?? {}).join(', ')}`;
    case 'appendLines':
      return `append ${action.path} += ${action.lines.join(', ')}`;
    case 'installDeps':
      return `install ${action.dev.join(', ')}`;
    case 'runCommand':
      return `run    ${action.command} ${action.args.join(' ')}`;
    default:
      // The bundle-materialisation kinds (ADR-0010 §5), grouped so this switch
      // stays within the complexity budget; still exhaustive — a new kind that
      // reaches here won't be assignable to describeBundle's parameter.
      return describeBundle(action);
  }
}

function describeWrite(action: Extract<Action, { kind: 'writeFile' }>): string {
  return `${action.overwrite ? 'write ' : 'write?'} ${action.path}`;
}

function describeBundle(action: Extract<Action, { kind: 'copyAsset' | 'symlink' }>): string {
  switch (action.kind) {
    case 'copyAsset':
      return `copy   ${action.to} (from bundled asset)`;
    case 'symlink':
      return `symlink ${action.path} -> ${action.target}`;
  }
}
