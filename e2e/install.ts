/**
 * Phase 2 seam driver. Bypasses the interactive @clack shell (the design's
 * "thin untested shell") and drives the tool's real apply pipeline through its
 * documented seam: run(answers, { cwd, exec: realExec }). realExec shells out
 * for real (npm install, npx husky), so this exercises the whole pipeline —
 * registry, plan(), apply(), package.json merge, file overwrite — against a
 * fresh target directory.
 *
 *   npx tsx e2e/install.ts <targetDir> <answers.json>
 */
import { readFileSync } from 'node:fs';
import { realExec } from '../src/exec';
import { run } from '../src/run';
import type { Answers } from '../src/types';

async function main(): Promise<void> {
  const [, , cwd, answersPath] = process.argv;
  if (!cwd || !answersPath) throw new Error('usage: install.ts <targetDir> <answers.json>');
  const answers = JSON.parse(readFileSync(answersPath, 'utf8')) as Answers;
  console.log(`[install] cwd=${cwd}`);
  console.log(`[install] answers=${JSON.stringify(answers)}`);
  const { actions } = await run(answers, { cwd, exec: realExec });
  console.log(`[install] applied ${actions.length} actions`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
