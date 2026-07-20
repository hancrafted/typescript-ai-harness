import { apply, type ApplyOpts } from './apply';
import { buildPlan } from './plan';
import type { Action, Answers } from './types';

/** Run-level options: the apply seam plus the `--yes` flag, which the plan (not apply) consumes. */
export interface RunOpts extends ApplyOpts {
  /** `--yes`: headless. Flows into the plan so Integrations can pick a headless-safe path (ADR-0005). */
  yes?: boolean;
}

/**
 * The single primary seam (Testing Decisions): build the declarative plan for a
 * resolved set of answers and apply it against `cwd` using the injected `exec`.
 * Tests drive this directly; the interactive layer sits above it.
 */
export async function run(answers: Answers, opts: RunOpts): Promise<{ actions: Action[] }> {
  const actions = buildPlan(answers, opts.cwd, opts.yes ?? false);
  await apply(actions, opts);
  return { actions };
}
