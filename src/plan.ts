import { registry } from './integrations/registry';
import type { Action, Answers, Ctx, SubChoice } from './types';

/**
 * Generic baseline tsconfig, written only if absent (ADR-0002). TypeScript is
 * not a selectable Integration, but `verify` runs `tsc --noEmit`, so a target
 * with no tsconfig still needs one. Bundler resolution keeps it tsx-friendly
 * and avoids forcing `.js` extensions on relative imports.
 */
const TSCONFIG = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "noEmit": true
  },
  "include": ["src", "*.ts", "*.mts"]
}
`;

/**
 * Compose the full Action[] for a selection: baseline actions first, then each
 * selected Integration's plan in registry order (which fixes run-command
 * ordering — interactive `archgate init` before husky). Pure: no IO, safe to
 * render/preview.
 */
export function buildPlan(answers: Answers, cwd: string, yes = false): Action[] {
  const selected = answers.integrations;
  const ctx: Ctx = { cwd, selected, yes };
  const actions: Action[] = [
    // TypeScript is baseline: `verify` runs `tsc --noEmit` and a target may have
    // no tsconfig. Not a selectable Integration (ADR-0002).
    { kind: 'installDeps', dev: ['typescript'] },
    { kind: 'appendLines', path: '.gitignore', lines: ['node_modules/', '.env'] },
    { kind: 'writeFile', path: 'tsconfig.json', contents: TSCONFIG, overwrite: false },
  ];
  for (const integration of registry) {
    if (!selected.includes(integration.id)) continue;
    actions.push(...integration.plan(ctx, answers[integration.id] as SubChoice));
  }
  return actions;
}
