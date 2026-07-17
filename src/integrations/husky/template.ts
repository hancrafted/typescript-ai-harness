import type { HuskyHook, IntegrationId } from '../../types';

/**
 * `verify` (pre-push, and the command the AI runs while working): full-repo
 * checks, no mutation. Composed only from the selected Integrations (ADR-0007);
 * `tsc --noEmit` always runs.
 */
export function verifyScript(selected: IntegrationId[]): string {
  const parts: string[] = [];
  if (selected.includes('archgate')) parts.push('archgate check');
  if (selected.includes('eslint')) parts.push('eslint .');
  if (selected.includes('prettier')) parts.push('prettier --check .');
  parts.push('tsc --noEmit');
  if (selected.includes('vitest')) parts.push('vitest run');
  return parts.join(' && ');
}

/**
 * `verify:commit` (pre-commit): staged autofix via lint-staged, then full-repo
 * correctness. `tsc --noEmit` runs here too — every commit must be provably
 * green because git history is project memory (ADR-0007).
 */
export function verifyCommitScript(selected: IntegrationId[]): string {
  const parts: string[] = ['lint-staged'];
  if (selected.includes('archgate')) parts.push('archgate check');
  parts.push('tsc --noEmit');
  if (selected.includes('vitest')) parts.push('vitest run');
  return parts.join(' && ');
}

const q = (command: string): string => `"${command}"`;

/**
 * `.lintstagedrc.json` — staged-only autofix commands, prettier-clean JSON.
 * eslint --fix runs before prettier --write so formatting wins. Standalone file
 * keeps package.json minimal.
 */
export function lintStagedConfig(selected: IntegrationId[]): string {
  const tsFixers: string[] = [];
  if (selected.includes('eslint')) tsFixers.push('eslint --fix');
  if (selected.includes('prettier')) tsFixers.push('prettier --write');
  const entries: string[] = [];
  if (tsFixers.length) entries.push(`"*.ts": [${tsFixers.map(q).join(', ')}]`);
  if (selected.includes('prettier')) entries.push('"*.{js,mjs,cjs,json,md,yml,yaml}": ["prettier --write"]');
  if (!entries.length) return '{}\n';
  return `{\n${entries.map((entry) => `  ${entry}`).join(',\n')}\n}\n`;
}

const COMMIT_MSG_HOOK = `# Minimal Conventional Commits header check.
# Full Keep-a-Changelog body validation is deferred.
header=$(head -1 "$1")
pattern='^(feat|fix|docs|refactor|chore|style|test|perf|build|ci|revert)(\\([^)]+\\))?!?: .+'
if ! printf '%s' "$header" | grep -Eq "$pattern"; then
  echo "✖ Commit message must follow Conventional Commits: type(scope): summary"
  echo "  got: $header"
  exit 1
fi
`;

/** Body written to each `.husky/<hook>` file. */
export const HOOK_BODY: Record<HuskyHook, string> = {
  'pre-commit': 'npm run verify:commit\n',
  'pre-push': 'npm run verify\n',
  'commit-msg': COMMIT_MSG_HOOK,
};
