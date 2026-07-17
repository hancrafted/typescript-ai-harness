import { apply, type ApplyOpts } from './apply';
import { buildPlan } from './plan';
import type { Action, Answers } from './types';

/**
 * The single primary seam (Testing Decisions): build the declarative plan for a
 * resolved set of answers and apply it against `cwd` using the injected `exec`.
 * Tests drive this directly; the interactive layer sits above it.
 */
export async function run(answers: Answers, opts: ApplyOpts): Promise<{ actions: Action[] }> {
  const actions = buildPlan(answers, opts.cwd);
  await apply(actions, opts);
  return { actions };
}
