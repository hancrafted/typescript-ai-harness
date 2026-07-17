import type { ImportSort } from '../../types';

/**
 * Opinionated base config (ADR-0006). printWidth 120 is chosen for diff/edit
 * stability in an agentic environment, not any output-quality claim.
 */
const BASE_ENTRIES = [
  '"semi": true',
  '"singleQuote": true',
  '"trailingComma": "all"',
  '"printWidth": 120',
  '"tabWidth": 2',
  '"arrowParens": "always"',
  '"endOfLine": "lf"',
];

/** The chosen plugin is injected. The two are mutually exclusive (only one ever written). */
function pluginEntries(importSort: ImportSort): string[] {
  if (importSort === 'organize-imports') return ['"plugins": ["prettier-plugin-organize-imports"]'];
  if (importSort === 'ianvs') {
    return [
      '"plugins": ["@ianvs/prettier-plugin-sort-imports"]',
      '"importOrder": ["<BUILTIN_MODULES>", "<THIRD_PARTY_MODULES>", "^[.]"]',
    ];
  }
  return [];
}

/**
 * Assemble `.prettierrc.json` as prettier-clean JSON (inline arrays, no trailing
 * commas) so the file passes `verify`'s own `prettier --check .`.
 */
export function prettierConfig(importSort: ImportSort): string {
  const entries = [...BASE_ENTRIES, ...pluginEntries(importSort)];
  return `{\n${entries.map((entry) => `  ${entry}`).join(',\n')}\n}\n`;
}
