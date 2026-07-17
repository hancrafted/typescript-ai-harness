import { cancel, confirm, intro, isCancel, log, multiselect, note, outro, spinner } from '@clack/prompts';
import { apply } from './apply';
import { realExec } from './exec';
import { registry } from './integrations/registry';
import { buildPlan } from './plan';
import { orExit } from './prompt-util';
import { summarize } from './summary';
import type { Answers, IntegrationId } from './types';

async function selectIntegrations(): Promise<IntegrationId[]> {
  return orExit(
    await multiselect({
      message: 'Which harness integrations? (all preselected — space toggles, enter confirms)',
      options: registry.map((integration) => ({ value: integration.id, label: integration.label })),
      initialValues: registry.map((integration) => integration.id),
      required: false,
    }),
  );
}

async function gatherAnswers(): Promise<Answers> {
  const integrations = await selectIntegrations();
  const answers: Answers = { integrations };
  for (const integration of registry) {
    if (!integrations.includes(integration.id) || !integration.promptSubOptions) continue;
    Object.assign(answers, { [integration.id]: await integration.promptSubOptions() });
  }
  return answers;
}

async function confirmAndApply(answers: Answers, cwd: string): Promise<void> {
  const actions = buildPlan(answers, cwd);
  note(summarize(actions).join('\n'), 'Planned changes');
  const ok = await confirm({ message: 'Apply this harness to the current project?' });
  if (isCancel(ok) || !ok) {
    cancel('Aborted — nothing was changed.');
    return;
  }
  const progress = spinner();
  progress.start('Applying harness');
  await apply(actions, { cwd, exec: realExec, log: (message) => progress.message(message) });
  progress.stop('Harness applied.');
  outro('Done. Review the changes and commit when ready.');
}

function previewOnly(answers: Answers, cwd: string): void {
  note(summarize(buildPlan(answers, cwd)).join('\n'), 'Planned changes (dry run)');
  outro('Dry run — nothing was changed.');
}

export async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const cwd = process.cwd();
  intro('ai-harness-setup');
  const answers = await gatherAnswers();
  if (dryRun) previewOnly(answers, cwd);
  else await confirmAndApply(answers, cwd);
}

main().catch((error: unknown) => {
  log.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
