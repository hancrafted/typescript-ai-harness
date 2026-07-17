import type { EslintRuleId } from '../../types';

/**
 * Reference values for the five clean-code rules (sourced from the reference
 * harness, ~/ai-workspace). The multiselect toggles which rules appear; the
 * values themselves are fixed here (per-rule value tuning is deferred).
 */
const RULE_VALUES: Record<EslintRuleId, [level: 'error', limit: number]> = {
  complexity: ['error', 7],
  'max-lines-per-function': ['error', 30],
  'max-params': ['error', 3],
  'max-depth': ['error', 3],
  'max-lines': ['error', 250],
};

export const ALL_ESLINT_RULES: EslintRuleId[] = [
  'complexity',
  'max-lines-per-function',
  'max-params',
  'max-depth',
  'max-lines',
];

// Imports are emitted in organize-imports order (alphabetical by specifier) so
// a fresh target passes `prettier --check .` even before its first format run.
function header(withPrettier: boolean): string {
  const lines = ["import js from '@eslint/js';"];
  if (withPrettier) lines.push("import eslintConfigPrettier from 'eslint-config-prettier';");
  lines.push("import tseslint from 'typescript-eslint';");
  return lines.join('\n');
}

const OPEN = `

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
`;

const AFTER_BASE = `  },
  {
    files: ['**/*.test.ts'],
    rules: { 'max-lines-per-function': 'off', 'max-lines': 'off' },
  },`;

function ruleLine(rule: EslintRuleId): string {
  const [level, limit] = RULE_VALUES[rule];
  const key = /^[a-z]+$/.test(rule) ? rule : `'${rule}'`;
  return `      ${key}: ['${level}', ${limit}],`;
}

function rulesBlock(rules: EslintRuleId[]): string {
  if (!rules.length) return '    rules: {},';
  return `    rules: {\n${rules.map(ruleLine).join('\n')}\n    },`;
}

/**
 * Assemble a generic two-tier `eslint.config.mjs` (ESM, so it loads regardless
 * of the target's package `type`). A programmatic-exception artifact: the
 * selected rules are injected, and `eslint-config-prettier` is appended when
 * prettier is also selected (ADR-0006). Output is prettier-clean so `verify`
 * (`prettier --check .`) passes on a fresh target. Globs are generic (ADR-0003).
 */
export function eslintConfig(rules: EslintRuleId[], withPrettier: boolean): string {
  const tail = `${withPrettier ? '\n  eslintConfigPrettier,' : ''}\n);\n`;
  return `${header(withPrettier)}${OPEN}${rulesBlock(rules)}\n${AFTER_BASE}${tail}`;
}
