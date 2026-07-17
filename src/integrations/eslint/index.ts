import { multiselect } from '@clack/prompts';
import { orExit } from '../../prompt-util';
import type { EslintChoice, EslintRuleId, Integration } from '../../types';
import { ALL_ESLINT_RULES, eslintConfig } from './template';

const RULE_OPTIONS: { value: EslintRuleId; label: string }[] = ALL_ESLINT_RULES.map((rule) => ({
  value: rule,
  label: rule,
}));

/**
 * Always-on base (`@eslint/js` recommended + typescript-eslint recommended +
 * stylistic). The five clean-code rules are a pre-checked multiselect. Shipped
 * as ESM `eslint.config.mjs`. When prettier is also selected, appends
 * `eslint-config-prettier` to disable formatting-conflict rules (ADR-0006).
 */
export const eslint: Integration = {
  id: 'eslint',
  label: 'eslint — linting',
  devDependencies: ['eslint', '@eslint/js', 'typescript-eslint'],

  async promptSubOptions(): Promise<EslintChoice> {
    const rules = orExit(
      await multiselect({
        message: 'eslint: clean-code rules (space toggles, enter accepts all)',
        options: RULE_OPTIONS,
        initialValues: ALL_ESLINT_RULES,
        required: false,
      }),
    );
    return { rules };
  },

  plan(ctx, choice) {
    const rules = (choice as EslintChoice | undefined)?.rules ?? ALL_ESLINT_RULES;
    const withPrettier = ctx.selected.includes('prettier');
    const dev = [...this.devDependencies];
    if (withPrettier) dev.push('eslint-config-prettier');
    return [
      { kind: 'installDeps', dev },
      { kind: 'writeFile', path: 'eslint.config.mjs', contents: eslintConfig(rules, withPrettier), overwrite: true },
    ];
  },
};
