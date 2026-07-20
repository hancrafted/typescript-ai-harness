import { cancel, confirm, intro, isCancel, log, multiselect, note, outro, spinner } from '@clack/prompts';
import { apply } from './apply';
import { realExec } from './exec';
import { registry } from './integrations/registry';
import { buildPlan } from './plan';
import { orExit } from './prompt-util';
import { summarize } from './summary';
import type { Answers, IntegrationId } from './types';

async function selectIntegrations(yes: boolean): Promise<IntegrationId[]> {
  if (yes) return registry.map((integration) => integration.id);
  return orExit(
    await multiselect({
      message: 'Which harness integrations? (all preselected — space toggles, enter confirms)',
      options: registry.map((integration) => ({ value: integration.id, label: integration.label })),
      initialValues: registry.map((integration) => integration.id),
      required: false,
    }),
  );
}

/**
 * `--yes`: skip every prompt and apply defaults (Testing Decisions' "untested
 * prompt shell" bypass, now exposed as a real flag). Integrations are all
 * selected; sub-option choices are left `undefined` so each Integration's own
 * `plan()` fallback (already required for tests) supplies the default.
 */
async function gatherAnswers(yes: boolean): Promise<Answers> {
  const integrations = await selectIntegrations(yes);
  const answers: Answers = { integrations };
  if (yes) return answers;
  for (const integration of registry) {
    if (!integrations.includes(integration.id) || !integration.promptSubOptions) continue;
    Object.assign(answers, { [integration.id]: await integration.promptSubOptions() });
  }
  return answers;
}

async function confirmAndApply(answers: Answers, cwd: string, yes: boolean): Promise<void> {
  const actions = buildPlan(answers, cwd, yes);
  note(summarize(actions).join('\n'), 'Planned changes');
  if (!yes) {
    const ok = await confirm({ message: 'Apply this harness to the current project?' });
    if (isCancel(ok) || !ok) {
      cancel('Aborted — nothing was changed.');
      return;
    }
  }
  const progress = spinner();
  progress.start('Applying harness');
  await apply(actions, { cwd, exec: realExec, log: (message) => progress.message(message) });
  progress.stop('Harness applied.');
  if (yes && answers.integrations.includes('archgate')) {
    // Headless: the direct-write path doesn't install the Claude plugin (US-13),
    // so point the developer to it. Interactive `archgate init` installs it itself.
    log.info('Run `archgate plugin install` to enable the archgate Claude plugin.');
  }
  outro('Done. Review the changes and commit when ready.');
}

function previewOnly(answers: Answers, cwd: string, yes: boolean): void {
  note(summarize(buildPlan(answers, cwd, yes)).join('\n'), 'Planned changes (dry run)');
  outro('Dry run — nothing was changed.');
}

export async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const yes = process.argv.includes('--yes');
  const cwd = process.cwd();
  intro('typescript-ai-harness');
  const answers = await gatherAnswers(yes);
  if (dryRun) previewOnly(answers, cwd, yes);
  else await confirmAndApply(answers, cwd, yes);
}

main().catch((error: unknown) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
