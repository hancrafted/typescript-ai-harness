import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  // `assets/**` holds the captured Core bundle — byte copies of `.archgate/**`
  // files, which are themselves eslint-ignored (they answer to archgate, not the
  // repo's lint rules), so the mirror is ignored on the same grounds (ADR-0010 §1).
  { ignores: ['node_modules/**', 'dist/**', 'coverage/**', '.archgate/**', 'assets/**', '.claude/worktrees/**'] },
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, tseslint.configs.stylistic],
    rules: {
      complexity: ['error', 7],
      'max-lines-per-function': ['error', 30],
      'max-params': ['error', 3],
      'max-depth': ['error', 3],
      'max-lines': ['error', 250],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: { 'max-lines-per-function': 'off', 'max-lines': 'off' },
  },
  eslintConfigPrettier,
);
